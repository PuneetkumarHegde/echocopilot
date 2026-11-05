import { NextRequest, NextResponse } from 'next/server';
import { 
  generateOllamaAnswer, 
  generateSmartCopilotAnswer, 
  buildQuestionSpecificPrompt, 
  parseStreamingAnswer,
  cleanDirectSpeakableAnswer,
  cleanSupportingSummary,
  buildStage1Prompt,
  buildStage2Prompt,
  TECHNICAL_INTERVIEW_SYSTEM_PROMPT,
  buildInterviewAssistantPrompt
} from '@/lib/aiFallback';
import { generatePersonalizedAnswer } from '@/lib/personalizedEngine';
import { classifyQuestionIntent, selectContextForIntent, QuestionIntent, IsolatedContext } from '@/lib/intentClassifier';
import { generateStructuredComparison, isKnownComparison, getComparisonHandlerName } from '@/lib/comparisonEngine';
import { generateTechnicalAnswer, hasDeterministicTechnicalAnswer } from '@/lib/technicalEngine';
import { validateTechnicalAnswer, validateFactualClaims } from '@/lib/answerValidator';
import { normalizeTechnicalTerms, resolveGitCanonicalConcept } from '@/lib/technicalTermNormalizer';
import { INITIAL_USER_PROFILE, INITIAL_PROJECTS } from '@/lib/storage';
import { AnswerMode, CopilotAnswer } from '@/lib/types';
import { QuestionCategory, classifyUtterance, isQuestionReadyForAnswer } from '@/lib/questionClassifier';

interface CopilotRequestBody {
  prompt: string;
  mode?: AnswerMode;
  provider?: 'groq' | 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'builtin';
  apiKey?: string;
  model?: string;
  ollamaUrl?: string;
  resumeContext?: string;
  jobDescription?: string;
  stream?: boolean;
  category?: QuestionCategory;
  contextHistory?: Array<{ question: string; summary: string }>;
  temperature?: number;
  maxTokens?: number;
  interviewLanguage?: string;
}

const SYSTEM_INTERVIEW_PROMPT = `You are EchoCopilot, an elite AI interview copilot assisting a candidate in a real technical interview. Your answers must sound exactly like a real, well-prepared candidate responding naturally, professionally, and fluently to an interviewer.

PRIMARY OBJECTIVES:
- Natural, conversational, and confident candidate delivery.
- Technically accurate, precise, and practical.
- Complete enough to speak directly aloud to an interviewer without needing to wait for subsequent notes.
- Structured logically with clear paragraph breaks.
- Strictly free from textbook lectures, meta-commentary, and conversational filler ("Certainly!", "Sure", "Here is the answer", "Let's understand this").

MANDATORY RULES BY QUESTION TYPE:

1. FOR COMPARISON QUESTIONS ("What is the difference between X and Y?", "X vs Y", "Compare X and Y"):
   - Start with ONE natural introductory sentence identifying that both concepts belong to the domain but differ in several key ways.
   - Explain each important difference separately as a complete, speakable statement explaining BOTH sides.
   - Use natural transitions with bold dimension labels:
     **First, [dimension]:** [Explain both sides of the comparison clearly in the same point].

     **Second, [dimension]:** [Explain both sides clearly].

     **Third, [dimension]:** [Explain both sides clearly].

     **Finally, [usage / conclusion dimension]:** [Explain both sides clearly].
   - MANDATORY: Leave ONE BLANK LINE between consecutive points. DO NOT merge the answer into one long single-paragraph wall of text.
   - Conclude with a natural closing sentence: "That's the main difference between [Concept A] and [Concept B]."
   - In "summary", provide the progressive supporting technical explanation: Reference Comparison Table, compilable code examples with expected output, and architectural trade-offs.

2. FOR DEFINITION QUESTIONS ("What is X?", "Explain X"):
   - Start directly with a clear, concise definition.
   - Explain its core purpose and how it works under the hood in a natural conversational flow.
   - Give a relevant practical example or real-world application when useful.

3. FOR HOW AND WHY QUESTIONS:
   - Start with the direct answer.
   - Explain the working or reasoning in a clear, logical sequence.
   - Include a concrete engineering example.

4. FOR PROGRAMMING QUESTIONS:
   - Explain the approach first in plain English.
   - Provide minimal, correct compilable code.
   - Explain the critical logic and include time/space complexity.

5. FOR DSA QUESTIONS:
   - State the approach first.
   - Explain the algorithm step-by-step.
   - Provide clean code, state time and space complexity, and highlight essential edge cases.

6. FOR PROJECT QUESTIONS:
   - Answer using the candidate's verified project facts in the first person ("I built", "In my project", "We implemented").
   - Never fabricate fictional metrics, unverified features, or unrecorded motivations.

7. FOR HR & BEHAVIORAL QUESTIONS:
   - Use natural first-person conversational English ("I", "in my experience").
   - Follow a natural STAR structure without sounding robotic or reciting bulleted lists.

Format your response strictly as a JSON object:
{
  "directAnswer": "The complete, natural interview answer that the candidate can immediately speak aloud. For comparisons, this MUST include the opening sentence, each point separated by blank lines (**First, [dimension]:** ...), and the closing sentence.",
  "spokenScript": "Same as directAnswer.",
  "summary": "Progressive supporting technical details (comparison table, code snippets with expected output, deep architectural trade-offs). Do not repeat directAnswer.",
  "bullets": [
    "Key Point / Difference 1",
    "Key Point / Difference 2",
    "Key Point / Difference 3"
  ],
  "codeSnippet": null, // Include ONLY when relevant: { "language": "...", "code": "...", "explanation": "...", "timeComplexity": "...", "spaceComplexity": "..." }
  "tradeoffs": [
    "Key engineering trade-off 1"
  ]
}

Return ONLY valid JSON. Do not wrap in markdown \`\`\`json or add introductory text.`;

function buildIntentAwareSystemPrompt(intent: QuestionIntent, isolatedContext: IsolatedContext): string {
  let prompt = SYSTEM_INTERVIEW_PROMPT;

  if (intent === 'COMPARISON') {
    prompt += `\n\nCRITICAL MANDATORY COMPARISON RULES:
The user is asking a comparison question between concepts.
You MUST follow the 6-step structure in "summary":
1. Direct Interview Answer (30–45s speakable answer without boilerplate).
2. Definitions of the concepts (separated with clear labels and blank lines).
3. Key differences in natural, clearly labeled sentences (**Label:** sentence) followed by a Reference Comparison Table.
4. Compilable code examples & expected output (or tool workflow).
5. Practical use cases & engineering trade-offs.
6. Concise conclusion.
Strict Negative Rule: Never invent differences or inject unrelated concepts (e.g. if comparing Array vs ArrayList, do NOT discuss concurrency, network latency, or distributed systems; if comparing Git Pull vs Pull Request, PR is GitHub review workflow and git pull is local CLI fetch+merge)!`;
  } else if (intent === 'PROJECT_SPECIFIC') {
    const proj = isolatedContext.relevantProject;
    if (proj) {
      prompt += `\n\nPROJECT VAULT SOURCE OF TRUTH FOR "${proj.name.toUpperCase()}":
- Project Name & Purpose: ${proj.name} — ${proj.tagline}
- Problem Statement: ${proj.problemStatement}
- Target Users: ${proj.targetUsers}
- Architecture: ${proj.architecture}
- Technology Stack: ${proj.technologyStack.map(t => `${t.name} (${t.whyChosen})`).join('; ')}
- Database & APIs: ${proj.databaseSchemaAndApi.databaseType} (${(proj.databaseSchemaAndApi.majorEntitiesOrTables || []).join(', ')})
- Verified Contributions (Confirmed Coded): ${proj.verifiedContributions.filter(c => c.isPersonallyImplemented).map(c => `${c.area}: ${c.description}`).join('; ') || 'Core service implementation'}
- Technical Challenges & Fixes: ${proj.challengesAndSolutions.map(c => `${c.challenge} -> ${c.solution}`).join('; ')}
- Future Rebuild Vision: ${proj.limitationsAndImprovements.whatWouldYouImproveIfRebuilt}

STRICT ACCURACY RULES:
- Only attribute parts of the project that are verified personal contributions.
- Do NOT invent fictional metrics, unverified features, or unrecorded motivations.
- Follow the 7-step project explanation structure: 1. Intro, 2. Problem, 3. Solution, 4. Tech stack, 5. Verified contribution, 6. Technical challenge, 7. Outcome & potential rebuild improvements.`;
    }
  } else if (intent === 'PERSONAL_CAREER') {
    const p = isolatedContext.relevantProfile;
    if (p) {
      prompt += `\n\nCANDIDATE VERIFIED CAREER PROFILE:
- Title: ${p.title}
- Degree: ${p.education[0] ? `${p.education[0].degree} in ${p.education[0].fieldOfStudy} from ${p.education[0].institution} (${p.education[0].reasonForDegree || ''})` : 'Not specified'}
- Primary Skills: ${p.technicalSkills.map(g => `${g.category}: ${g.skills.map(s => `${s.name} (${s.rationale || ''})`).join(', ')}`).join('; ')}
- Target Roles: ${p.careerGoals.targetRoles.join(', ')}
- Technical Strengths: ${p.strengthsAndWeaknesses.technicalStrengths.join(', ')}
- Work Experience / Internships: ${p.workExperience.map(w => `${w.company} (${w.role}, ${w.type}): ${w.achievements.join(', ')}`).join('; ') || 'None recorded yet.'}

STRICT PERSONAL RULES:
- Speak in first-person ("I", "my") suitable for a candidate speaking aloud in an interview.
- NEVER invent internships, work experience, achievements, or metrics not present in this profile.
- If the question asks for an achievement during an internship and none is recorded, state that no internship is recorded in the profile and prompt the user to add it.`;
    }
  } else if (intent === 'GENERAL_TECHNICAL' || intent === 'CONCEPT_EXPLANATION' || intent === 'DSA_PROBLEM' || intent === 'CODING_REQUEST') {
    prompt += `\n\nSTRICT CONTEXT ISOLATION RULE:
This is a general technical or computer science question.
Answer purely from established software engineering and computer science principles.
DO NOT inject candidate project descriptions, portfolio references, or unrelated interview histories. Keep the explanation accurate, clean, and proportional. Include compilable code with expected output for programming topics and complexity for algorithms.`;
  }

  return prompt;
}

// Call Groq Llama 3.3 70B (ultra-fast ~250-400ms inference)
async function callGroq(prompt: string, apiKey: string, model = 'llama-3.3-70b-versatile', mode: AnswerMode = 'general', customSystemPrompt?: string): Promise<CopilotAnswer | null> {
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: customSystemPrompt || SYSTEM_INTERVIEW_PROMPT },
        { role: 'user', content: `Interview Question (Mode: ${mode.toUpperCase()}):\n${prompt}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 1200
    })
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.warn('[Groq API Error]:', err);
    return null;
  }

  const data = await resp.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) return null;

  return parseJsonResponse(raw, prompt, mode, 'groq', model);
}

// Call OpenAI (GPT-4o or GPT-4o-mini)
async function callOpenAI(prompt: string, apiKey: string, model = 'gpt-4o-mini', mode: AnswerMode = 'general', customSystemPrompt?: string): Promise<CopilotAnswer | null> {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: customSystemPrompt || SYSTEM_INTERVIEW_PROMPT },
        { role: 'user', content: `Interview Question (Mode: ${mode.toUpperCase()}):\n${prompt}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 1200
    })
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.warn('[OpenAI API Error]:', err);
    return null;
  }

  const data = await resp.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) return null;

  return parseJsonResponse(raw, prompt, mode, 'openai', model);
}

// Call Anthropic Claude
async function callAnthropic(prompt: string, apiKey: string, model = 'claude-3-5-sonnet-20241022', mode: AnswerMode = 'general', customSystemPrompt?: string): Promise<CopilotAnswer | null> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model || 'claude-3-5-sonnet-20241022',
      system: customSystemPrompt || SYSTEM_INTERVIEW_PROMPT,
      messages: [
        { role: 'user', content: `Interview Question (Mode: ${mode.toUpperCase()}):\n${prompt}` }
      ],
      max_tokens: 1200,
      temperature: 0.2
    })
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.warn('[Anthropic API Error]:', err);
    return null;
  }

  const data = await resp.json();
  const raw = data.content?.[0]?.text;
  if (!raw) return null;

  return parseJsonResponse(raw, prompt, mode, 'anthropic', model);
}

// Helper to safely parse and structure JSON into CopilotAnswer
function parseJsonResponse(raw: string, prompt: string, mode: AnswerMode, provider: string, modelName: string): CopilotAnswer {
  let cleanJson = raw.trim();
  const fenceMatch = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1] && fenceMatch[1].trim().startsWith('{')) {
    cleanJson = fenceMatch[1].trim();
  } else if (!cleanJson.startsWith('{')) {
    const firstBrace = cleanJson.indexOf('{');
    const lastBrace = cleanJson.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
    }
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleanJson);
  } catch {
    // If strict JSON parse fails, unescape literal quotes and newlines
    try {
      const fixed = cleanJson
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"');
      parsed = JSON.parse(fixed);
    } catch {
      parsed = { summary: cleanJson, spokenScript: cleanJson.slice(0, 200) };
    }
  }

  const directAnswer = cleanDirectSpeakableAnswer(parsed.directAnswer || parsed.spokenScript || parsed.summary || '');
  const cleanSummary = cleanSupportingSummary(parsed.summary || 'Direct technical solution.', directAnswer);

  return {
    id: `ans_${provider}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    question: prompt,
    mode,
    directAnswer,
    summary: cleanSummary || parsed.summary || 'Direct technical solution.',
    spokenScript: directAnswer,
    bullets: Array.isArray(parsed.bullets) && parsed.bullets.length > 0
      ? parsed.bullets.map((b: any) => {
          if (typeof b === 'string') return b;
          if (b && typeof b === 'object') {
            return b.text ? `${b.text}: ${b.architecture || b.mechanism || ''}`.trim() : Object.values(b).filter(v => typeof v === 'string').join(' - ');
          }
          return String(b);
        })
      : [parsed.summary || 'Core solution mechanism.'],
    codeSnippet: parsed.codeSnippet && parsed.codeSnippet.code ? {
      language: parsed.codeSnippet.language || 'typescript',
      code: parsed.codeSnippet.code,
      explanation: parsed.codeSnippet.explanation,
      timeComplexity: parsed.codeSnippet.timeComplexity,
      spaceComplexity: parsed.codeSnippet.spaceComplexity
    } : undefined,
    complexity: parsed.codeSnippet?.timeComplexity ? {
      time: parsed.codeSnippet.timeComplexity,
      space: parsed.codeSnippet.spaceComplexity || 'O(1)'
    } : undefined,
    tradeoffs: Array.isArray(parsed.tradeoffs)
      ? parsed.tradeoffs.map((t: any) => typeof t === 'string' ? t : (t.text || Object.values(t).filter(v => typeof v === 'string').join(' - ')))
      : undefined,
    timestamp: Date.now()
  };
}

function createDeterministicSSEStream(answer: CopilotAnswer, source: string, startTime: number) {
  const encoder = new TextEncoder();
  const directAnswer = answer.directAnswer || answer.spokenScript || '';
  return new Response(new ReadableStream({
    start(controller) {
      const t1 = Math.max(1, Date.now() - startTime);
      controller.enqueue(encoder.encode(`event: first_token\ndata: ${JSON.stringify({ timeToFirstTokenMs: t1 })}\n\n`));
      controller.enqueue(encoder.encode(`event: stage1_chunk\ndata: ${JSON.stringify({ text: directAnswer })}\n\n`));
      controller.enqueue(encoder.encode(`event: chunk\ndata: ${JSON.stringify({ text: directAnswer })}\n\n`));
      controller.enqueue(encoder.encode(`event: stage1_done\ndata: ${JSON.stringify({ directAnswer, timeToDirectAnswerMs: t1 + 1 })}\n\n`));
      controller.enqueue(encoder.encode(`event: stage2_chunk\ndata: ${JSON.stringify({ text: answer.summary })}\n\n`));
      const totalTimeMs = Math.max(2, Date.now() - startTime);
      controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({
        answer,
        source,
        timeToFirstTokenMs: t1,
        timeToDirectAnswerMs: t1 + 1,
        totalTimeMs
      })}\n\n`));
      controller.close();
    }
  }), {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    }
  });
}

export function isAckOrNonQuestion(query: string): boolean {
  const q = query.trim().toLowerCase().replace(/[.,!?;]+$/, '');
  const ackPatterns = [
    /^(ok|okay|right|cool|got\s+it|fair\s+enough|makes\s+sense|understood|sure|yep|yeah|fine|i\s+see|great|nice)(\s*,?\s*(thanks|thank\s+you))?$/i,
    /^(thanks|thank\s+you)(\s+very\s+much)?$/i
  ];
  return ackPatterns.some(p => p.test(q));
}

export async function POST(req: NextRequest) {
  const requestStartTime = Date.now();
  try {
    const body: CopilotRequestBody = await req.json();
    // Warmup session interceptor to pre-load Ollama model into GPU VRAM
    if ((body as any).warmup) {
      const baseOllama = body.ollamaUrl || process.env.OLLAMA_API_URL || 'http://localhost:11434';
      const genUrl = baseOllama.endsWith('/api/generate') ? baseOllama : `${baseOllama.replace(/\/$/, '')}/api/generate`;
      const modelName = body.model || process.env.OLLAMA_MODEL || 'qwen2.5:3b';
      try {
        await fetch(genUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelName,
            prompt: 'ping',
            stream: false,
            options: { num_predict: 1 },
            keep_alive: '10m'
          }),
          signal: AbortSignal.timeout(6000)
        });
      } catch {}
      return NextResponse.json({ warmedUp: true, model: modelName });
    }

    const { 
      prompt, 
      mode = 'general', 
      provider, 
      apiKey, 
      model, 
      ollamaUrl,
      resumeContext = '', 
      jobDescription = '',
      stream = false,
      category
    } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Question completeness gate: reject incomplete questions (e.g. "What is the difference?")
    const actualQuery = prompt.includes('Interviewer follow-up question:')
      ? (prompt.split('Interviewer follow-up question:')[1]?.replace(/^[\s":]+|[\s":]+$/g, '') || prompt)
      : prompt;

    // Speech-to-Text Normalization & Anti-Hallucination Guard on Unrecognized Terms (Requirement 4 & 5)
    const termResult = normalizeTechnicalTerms(actualQuery);
    if (termResult.hasUnknownSuspectTerm && termResult.suggestedClarification) {
      return NextResponse.json({
        answer: {
          id: `ans_clarify_${Date.now()}`,
          question: prompt,
          mode: mode || 'general',
          summary: `### Clarification Needed\n${termResult.suggestedClarification}`,
          spokenScript: termResult.suggestedClarification,
          bullets: [
            `Unrecognized Term: "${termResult.suspectTerms[0]}" is not a standard concept in this domain.`,
            'Anti-Hallucination Guard: Refusing to fabricate definitions for unverified or mispronounced technical terms.',
            'Action: Please clarify or check the pronunciation.'
          ],
          timestamp: Date.now()
        },
        source: 'term-normalizer',
        intent: 'UNCLEAR_OR_SUSPECT',
        setupNotice: 'Anti-hallucination guard detected an unrecognized technical concept.'
      });
    }

    const cleanQuery = termResult.normalizedText || actualQuery;

    const contextTurns = (body.contextHistory || []).map((h: any) => ({
      question: h.question,
      summary: h.summary || '',
      category: 'GENERAL' as QuestionCategory,
      timestamp: Date.now()
    }));

    const readiness = isQuestionReadyForAnswer(cleanQuery, contextTurns);
    if (!readiness.isReady) {
      if (readiness.needsMoreSpeech) {
        console.warn(`[Copilot API] Incomplete question rejected before provider call: "${prompt}" (${readiness.reason})`);
        return NextResponse.json({
          error: `Incomplete question: ${readiness.reason}`,
          isIncomplete: true,
          reason: readiness.reason,
          needsMoreSpeech: true
        }, { status: 400 });
      }

      // Check if this is an acknowledgement / reaction / greeting (e.g. "Okay.", "Right.", "Got it.")
      const isAck = isAckOrNonQuestion(cleanQuery);
      if (isAck || readiness.reason.toLowerCase().includes('acknowledgement') || readiness.reason.toLowerCase().includes('greeting') || readiness.reason.toLowerCase().includes('reaction')) {
        console.log(`[Copilot API] Acknowledgement or reaction bypassed without generating technical answer: "${cleanQuery}" (${readiness.reason})`);
        return NextResponse.json({
          answer: {
            id: `ans_ack_${Date.now()}`,
            question: prompt,
            mode: mode || 'general',
            summary: '',
            spokenScript: '',
            directAnswer: '',
            bullets: [],
            timestamp: Date.now()
          },
          source: 'acknowledgement-bypass',
          isAcknowledgement: true,
          bypassed: true
        });
      }
    }

    const groqKey = apiKey && provider === 'groq' ? apiKey : process.env.GROQ_API_KEY;
    const openAiKey = apiKey && provider === 'openai' ? apiKey : process.env.OPENAI_API_KEY;
    const anthropicKey = apiKey && provider === 'anthropic' ? apiKey : process.env.ANTHROPIC_API_KEY;

    // 0. Question Intent Detection & Strict Context Isolation
    const intentResult = classifyQuestionIntent(cleanQuery, contextTurns);
    const isolatedContext = selectContextForIntent(
      intentResult.intent,
      cleanQuery,
      (body as any).profileContext || INITIAL_USER_PROFILE,
      (body as any).projectContext || INITIAL_PROJECTS,
      jobDescription ? {
        id: 'temp_jd',
        title: 'Target Role',
        company: 'Target Company',
        rawText: jobDescription,
        extractedSkills: [],
        keyRequirements: [],
        updatedAt: Date.now()
      } : null,
      resumeContext,
      contextTurns
    );

    const intentAwareSystemPrompt = buildIntentAwareSystemPrompt(intentResult.intent, isolatedContext);

    // Diagnostic Extraction & Knowledge Resolution for Pipeline Verification
    const conceptA = intentResult.extractedConcepts?.conceptA || '';
    const conceptB = intentResult.extractedConcepts?.conceptB || '';
    const conceptC = intentResult.extractedConcepts?.conceptC;

    const gitConceptA = conceptA ? resolveGitCanonicalConcept(conceptA) : null;
    const gitConceptB = conceptB ? resolveGitCanonicalConcept(conceptB) : null;
    const gitSingle = resolveGitCanonicalConcept(cleanQuery);

    const compHandler = intentResult.intent === 'COMPARISON'
      ? getComparisonHandlerName(conceptA, conceptB, cleanQuery, conceptC)
      : null;

    let retrievedKnowledge: string | null = null;
    if (intentResult.intent === 'COMPARISON') {
      const compAns = generateStructuredComparison(conceptA || 'Concept A', conceptB || 'Concept B', cleanQuery, conceptC);
      retrievedKnowledge = compAns?.spokenScript || compAns?.summary || null;
    } else if (hasDeterministicTechnicalAnswer(cleanQuery)) {
      const techAns = generateTechnicalAnswer(cleanQuery);
      retrievedKnowledge = techAns?.spokenScript || techAns?.summary || null;
    }

    const effectiveProvider = provider || (groqKey ? 'groq' : openAiKey ? 'openai' : anthropicKey ? 'anthropic' : 'ollama');
    const effectiveModel = model || (effectiveProvider === 'ollama' ? (process.env.OLLAMA_MODEL || 'qwen2.5:3b') : 'default');

    console.log('[Copilot Execution Pipeline Diagnostic]', {
      normalizedQuestion: cleanQuery,
      extractedConcepts: intentResult.extractedConcepts || null,
      canonicalGitConcepts: {
        conceptA: gitConceptA,
        conceptB: gitConceptB,
        single: gitSingle
      },
      selectedIntent: intentResult.intent,
      selectedComparisonHandler: compHandler,
      hasRetrievedKnowledge: Boolean(retrievedKnowledge),
      provider: effectiveProvider,
      model: effectiveModel
    });

    let enrichedSystemPrompt = intentAwareSystemPrompt;
    if (retrievedKnowledge) {
      enrichedSystemPrompt += `\n\nVERIFIED FACTUAL GROUND TRUTH (DO NOT CONTRADICT):\n${retrievedKnowledge}\nEnsure your explanation strictly adheres to this ground truth.`;
    }

    const shouldInterceptDeterministic = 
      provider === 'builtin' || 
      (!provider && (!groqKey && !openAiKey && !anthropicKey));

    // 0A. Instant Zero-Latency Structured Comparison Interceptor (Section 4 Standard)
    if (intentResult.intent === 'COMPARISON') {
      const isKnown = isKnownComparison(conceptA || '', conceptB || '', cleanQuery, conceptC);
      if (shouldInterceptDeterministic || (isKnown && !provider)) {
        const compAns = generateStructuredComparison(conceptA || 'Concept A', conceptB || 'Concept B', cleanQuery, conceptC);
        const validated = validateTechnicalAnswer(cleanQuery, compAns, 'COMPARISON', intentResult.extractedConcepts);
        if (stream) {
          return createDeterministicSSEStream(validated.repairedAnswer, 'comparison-engine', requestStartTime);
        }
        return NextResponse.json({
          answer: validated.repairedAnswer,
          source: 'comparison-engine',
          intent: 'COMPARISON',
          setupNotice: 'Layered comparison synthesized according to Section 4 standard.'
        });
      }
    }

    // 0B. Instant Zero-Latency Technical & DSA Knowledge Interceptor (Tests A, C)
    if (intentResult.intent === 'DSA_PROBLEM' || intentResult.intent === 'CONCEPT_EXPLANATION' || intentResult.intent === 'GENERAL_TECHNICAL') {
      const isKnownTech = hasDeterministicTechnicalAnswer(cleanQuery);
      if (shouldInterceptDeterministic || (isKnownTech && !provider)) {
        const techAns = generateTechnicalAnswer(cleanQuery);
        if (techAns) {
          const validated = validateTechnicalAnswer(cleanQuery, techAns, intentResult.intent);
          if (stream) {
            return createDeterministicSSEStream(validated.repairedAnswer, 'technical-engine', requestStartTime);
          }
          return NextResponse.json({
            answer: validated.repairedAnswer,
            source: 'technical-engine',
            intent: intentResult.intent,
            setupNotice: isolatedContext.contextNotice
          });
        }
      }
    }

    // 0C. Personalized Career & Project Question Interceptor (Tests D, E, F, G)
    if ((intentResult.intent === 'PERSONAL_CAREER' || intentResult.intent === 'PROJECT_SPECIFIC') &&
        shouldInterceptDeterministic) {
      const pAns = generatePersonalizedAnswer(
        cleanQuery,
        'medium',
        isolatedContext.relevantProfile || INITIAL_USER_PROFILE,
        isolatedContext.relevantProject ? [isolatedContext.relevantProject] : INITIAL_PROJECTS,
        isolatedContext.relevantJobDescription || undefined
      );
      const copilotAns: CopilotAnswer = {
        id: pAns.id,
        question: prompt,
        mode: mode || 'general',
        directAnswer: pAns.spokenScript,
        summary: pAns.structure.directAnswer.startsWith('My project is')
          ? pAns.spokenScript
          : `### 1. Personal Motivation & Rationale\n${pAns.structure.personalMotivation}\n\n### 2. Supporting Real-World Example\n${pAns.structure.supportingExample}\n\n### 3. Connection to Target Role & Goals\n${pAns.structure.roleOrCareerConnection}`,
        spokenScript: pAns.spokenScript,
        bullets: pAns.bullets,
        timestamp: Date.now()
      };

      if (stream) {
        return createDeterministicSSEStream(copilotAns, 'personalized-engine', requestStartTime);
      }
      return NextResponse.json({
        answer: copilotAns,
        source: 'personalized-engine',
        intent: intentResult.intent,
        setupNotice: isolatedContext.contextNotice
      });
    }

    // 1. If Groq selected or Groq Key present
    if ((provider === 'groq' || !provider) && groqKey) {
      try {
        const groqAnswer = await callGroq(prompt, groqKey, model, mode, enrichedSystemPrompt);
        if (groqAnswer) {
          const validated = validateTechnicalAnswer(cleanQuery, groqAnswer, intentResult.intent, intentResult.extractedConcepts);
          return NextResponse.json({
            answer: validated.repairedAnswer,
            source: 'groq',
            intent: intentResult.intent,
            model: model || 'llama-3.3-70b-versatile'
          });
        }
      } catch (err) {
        console.warn('Groq provider attempt failed, falling back:', err);
      }
    }

    // 2. If OpenAI selected or OpenAI Key present
    if ((provider === 'openai' || (!provider && !groqKey)) && openAiKey) {
      try {
        const openAiAnswer = await callOpenAI(prompt, openAiKey, model, mode, enrichedSystemPrompt);
        if (openAiAnswer) {
          const validated = validateTechnicalAnswer(cleanQuery, openAiAnswer, intentResult.intent, intentResult.extractedConcepts);
          return NextResponse.json({
            answer: validated.repairedAnswer,
            source: 'openai',
            intent: intentResult.intent,
            model: model || 'gpt-4o-mini'
          });
        }
      } catch (err) {
        console.warn('OpenAI provider attempt failed, falling back:', err);
      }
    }

    // 3. If Anthropic selected or Anthropic Key present
    if ((provider === 'anthropic') && anthropicKey) {
      try {
        const claudeAnswer = await callAnthropic(prompt, anthropicKey, model, mode, enrichedSystemPrompt);
        if (claudeAnswer) {
          const validated = validateTechnicalAnswer(cleanQuery, claudeAnswer, intentResult.intent, intentResult.extractedConcepts);
          return NextResponse.json({
            answer: validated.repairedAnswer,
            source: 'anthropic',
            intent: intentResult.intent,
            model: model || 'claude-3-5-sonnet'
          });
        }
      } catch (err) {
        console.warn('Anthropic provider attempt failed, falling back:', err);
      }
    }

    // 4A. Real-time Streaming for Local Ollama Model (Single-Pass Low-Latency Fast Streaming)
    if (stream && (provider === 'ollama' || !provider || (!groqKey && !openAiKey && !anthropicKey))) {
      const baseOllama = ollamaUrl || process.env.OLLAMA_API_URL || 'http://localhost:11434';
      const genUrl = baseOllama.endsWith('/api/generate') ? baseOllama : `${baseOllama.replace(/\/$/, '')}/api/generate`;
      const modelName = model || process.env.OLLAMA_MODEL || 'qwen2.5:3b';
      const effectiveTemp = typeof (body as any).temperature === 'number' ? (body as any).temperature : 0.2;
      const isTwoSentences = /two sentences|2 sentences|briefly|in 2 sentences/i.test(cleanQuery);
      const defaultTokens = isTwoSentences ? 250 : 1200;
      const effectiveMaxTokens = typeof (body as any).maxTokens === 'number' ? (body as any).maxTokens : defaultTokens;
      const configuredLanguage = (body as any).interviewLanguage || 'Java';

      const t0 = Date.now();
      const promptPayload = buildInterviewAssistantPrompt(cleanQuery, contextTurns, configuredLanguage);
      const encoder = new TextEncoder();

      const sseStream = new ReadableStream({
        async start(controller) {
          let t4_firstTokenMs = 0;
          let streamedText = '';
          let isStage1 = true;
          let stage1Buffer = '';
          let stage1DoneEmitted = false;
          let doneReason = 'stop';
          let ollamaMetrics: Record<string, any> | undefined = undefined;

          try {
            const ollamaRes = await fetch(genUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: modelName,
                system: promptPayload.systemPrompt,
                prompt: promptPayload.userPrompt,
                stream: true,
                options: {
                  num_gpu: 99,
                  num_thread: 8,
                  num_ctx: 2048,
                  num_predict: effectiveMaxTokens,
                  temperature: effectiveTemp
                },
                keep_alive: '10m'
              }),
              signal: req.signal
            });

            if (ollamaRes.ok && ollamaRes.body) {
              const reader = ollamaRes.body.getReader();
              const decoder = new TextDecoder();
              let buffer = '';

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed) continue;
                  try {
                    const parsed = JSON.parse(trimmed);
                    if (parsed.response) {
                      if (!t4_firstTokenMs) {
                        t4_firstTokenMs = Date.now() - t0;
                        controller.enqueue(
                          encoder.encode(`event: first_token\ndata: ${JSON.stringify({ timeToFirstTokenMs: t4_firstTokenMs })}\n\n`)
                        );
                      }
                      const chunk = parsed.response;
                      streamedText += chunk;

                      if (isStage1) {
                        stage1Buffer += chunk;
                        const stage2MarkerMatch = stage1Buffer.match(/(?:^|\n)(#{2,3}\s*(?:Detailed Explanation|Key Differences|Definitions & Core Properties|Definitions|Underlying Mechanism|Definition, Purpose|How It Works|Internal Working|Protocol Flow|Internal Architecture|Algorithm Steps|Execution Mechanics|Step-by-Step Execution Flow|Defensive Implementation|Code Example|Practical Examples|Practical & Code Example|Practical Code Example|When to Use Which|When to Use Each|Applications & Trade-Offs|Applications, Best Practices|Applications, Significance|Important Note|Hierarchy & Structure|Hierarchy|Types & Classifications|Types, Stages|Types|Core Principles|Root Causes|Prevention Strategies|Prevention|Real-World Examples|Economic Drivers|Photosynthetic Stages|Relational Algebra|Summary Comparison Table)|---|\n\|\s*Dimension\s*\||\n\|\s*Aspect\s*\|)/i);

                        if (stage2MarkerMatch && stage2MarkerMatch.index !== undefined) {
                          isStage1 = false;
                          const stage1Text = stage1Buffer.substring(0, stage2MarkerMatch.index).trim();
                          const directAnswer = cleanDirectSpeakableAnswer(stage1Text);
                          const tStage1Ms = Date.now() - t0;

                          controller.enqueue(
                            encoder.encode(`event: stage1_done\ndata: ${JSON.stringify({ directAnswer, timeToDirectAnswerMs: tStage1Ms })}\n\n`)
                          );
                          stage1DoneEmitted = true;

                          const stage2Start = stage1Buffer.substring(stage2MarkerMatch.index);
                          if (stage2Start) {
                            controller.enqueue(
                              encoder.encode(`event: stage2_chunk\ndata: ${JSON.stringify({ text: stage2Start })}\n\n`)
                            );
                          }
                        } else {
                          let emitText = chunk;
                          if (stage1Buffer.length < 50 && /^(?:#+\s*Interview Answer|(?:\*\*|\*|__)?Interview Answer)/i.test(stage1Buffer.trim())) {
                            emitText = '';
                            const newlineIdx = stage1Buffer.indexOf('\n');
                            if (newlineIdx !== -1) {
                              emitText = stage1Buffer.substring(newlineIdx + 1);
                            }
                          }
                          if (emitText) {
                            controller.enqueue(
                              encoder.encode(`event: stage1_chunk\ndata: ${JSON.stringify({ text: emitText })}\n\n`)
                            );
                          }
                        }
                      } else {
                        controller.enqueue(
                          encoder.encode(`event: stage2_chunk\ndata: ${JSON.stringify({ text: chunk })}\n\n`)
                        );
                      }
                    }
                    if (parsed.done) {
                      doneReason = parsed.done_reason || 'stop';
                      if (parsed.total_duration) {
                        ollamaMetrics = {
                          totalDurationMs: Math.round(parsed.total_duration / 1e6),
                          loadDurationMs: parsed.load_duration ? Math.round(parsed.load_duration / 1e6) : 0,
                          promptEvalDurationMs: parsed.prompt_eval_duration ? Math.round(parsed.prompt_eval_duration / 1e6) : 0,
                          evalDurationMs: parsed.eval_duration ? Math.round(parsed.eval_duration / 1e6) : 0,
                          promptEvalCount: parsed.prompt_eval_count || 0,
                          evalCount: parsed.eval_count || 0,
                          evalTps: (parsed.eval_count && parsed.eval_duration) ? Number((parsed.eval_count / (parsed.eval_duration / 1e9)).toFixed(1)) : undefined
                        };
                      }
                    }
                  } catch {}
                }
              }
            }
          } catch (err) {
            console.warn('[Copilot API] Ollama streaming attempt failed:', err);
          }

          const t6_totalMs = Date.now() - t0;

          // If stage1_done was not yet emitted, emit it now
          if (!stage1DoneEmitted) {
            const directAnswer = cleanDirectSpeakableAnswer(streamedText);
            controller.enqueue(
              encoder.encode(`event: stage1_done\ndata: ${JSON.stringify({ 
                directAnswer, 
                timeToDirectAnswerMs: t6_totalMs 
              })}\n\n`)
            );
          }

          let parsedAnswer = parseStreamingAnswer(streamedText, prompt, mode, doneReason);
          let candidateSpoken = parsedAnswer.directAnswer || cleanDirectSpeakableAnswer(streamedText);

          if (!candidateSpoken) {
            const fb = generateSmartCopilotAnswer(cleanQuery, mode);
            candidateSpoken = fb.directAnswer || fb.spokenScript || fb.summary;
            parsedAnswer = fb;
          }

          // Local factual verification grounded in verified technical rules
          const factualEval = validateFactualClaims(cleanQuery, candidateSpoken);
          const finalCandidateAnswer = factualEval.isFactuallyAccurate ? candidateSpoken : factualEval.repairedText;

          const finalAnswer: CopilotAnswer = {
            id: `ans_ollama_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            question: prompt,
            mode: mode || 'general',
            directAnswer: finalCandidateAnswer,
            spokenScript: finalCandidateAnswer,
            summary: parsedAnswer.summary || '',
            bullets: parsedAnswer.bullets && parsedAnswer.bullets.length > 0 ? parsedAnswer.bullets : [],
            codeSnippet: parsedAnswer.codeSnippet,
            complexity: parsedAnswer.codeSnippet?.timeComplexity ? {
              time: parsedAnswer.codeSnippet.timeComplexity,
              space: parsedAnswer.codeSnippet.spaceComplexity || 'O(1)'
            } : undefined,
            tradeoffs: parsedAnswer.tradeoffs,
            timestamp: Date.now(),
            doneReason
          };

          controller.enqueue(
            encoder.encode(`event: done\ndata: ${JSON.stringify({
              answer: finalAnswer,
              source: 'ollama',
              model: modelName,
              timeToFirstTokenMs: t4_firstTokenMs,
              totalTimeMs: t6_totalMs,
              doneReason,
              ollamaMetrics,
              factualEvaluation: {
                isFactuallyAccurate: factualEval.isFactuallyAccurate,
                rejectedClaimsDetected: factualEval.rejectedClaimsDetected
              }
            })}\n\n`)
          );

          controller.close();
        }
      });

      return new Response(sseStream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive'
        }
      });
    }

    // 4B. Try Local Ollama Model (Synchronous fallback)
    if (provider === 'ollama' || !provider || (!groqKey && !openAiKey && !anthropicKey)) {
      try {
        const ollamaAnswer = await generateOllamaAnswer(
          prompt, 
          mode, 
          resumeContext, 
          jobDescription,
          model || 'qwen2.5:3b',
          ollamaUrl || 'http://localhost:11434',
          category,
          enrichedSystemPrompt,
          {
            temperature: typeof (body as any).temperature === 'number' ? (body as any).temperature : 0.2,
            maxTokens: typeof (body as any).maxTokens === 'number' ? (body as any).maxTokens : (/two sentences|2 sentences|briefly|in 2 sentences/i.test(cleanQuery) ? 250 : 800),
            contextHistory: contextTurns,
            configuredLanguage: (body as any).interviewLanguage || 'Java'
          }
        );

        if (ollamaAnswer) {
          console.log('[Copilot Response Generated from Ollama]', {
            model: model || process.env.OLLAMA_MODEL || 'qwen2.5:3b',
            summaryPreview: (ollamaAnswer.summary || '').slice(0, 160) + '...',
            spokenScriptPreview: (ollamaAnswer.spokenScript || '').slice(0, 120) + '...'
          });
          const validated = validateTechnicalAnswer(cleanQuery, ollamaAnswer, intentResult.intent, intentResult.extractedConcepts);
          return NextResponse.json({ 
            answer: validated.repairedAnswer, 
            source: 'ollama',
            model: model || process.env.OLLAMA_MODEL || 'qwen2.5:3b'
          });
        }
      } catch (ollamaErr) {
        console.warn('[Copilot API] Ollama generation unavailable:', ollamaErr);
      }
    }

    // 5. High-Precision Smart Built-in Fallback Engine (Instant & Guaranteed)
    const fallbackAnswer = generateSmartCopilotAnswer(prompt, mode);
    const validated = validateTechnicalAnswer(cleanQuery, fallbackAnswer, intentResult.intent, intentResult.extractedConcepts);
    return NextResponse.json({
      answer: validated.repairedAnswer,
      source: 'built-in-engine',
      setupNotice: 'Served via built-in interview engine. Configure Groq, OpenAI, or Ollama in Settings ⚙️ for cloud models.'
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
