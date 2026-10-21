import { NextRequest, NextResponse } from 'next/server';
import { generateOllamaAnswer, generateSmartCopilotAnswer, buildQuestionSpecificPrompt, parseStreamingAnswer } from '@/lib/aiFallback';
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
}

const SYSTEM_INTERVIEW_PROMPT = `You are EchoCopilot, an elite real-time interview assistant answering questions across all engineering disciplines (computer science, software, cybersecurity, electronics, electrical, mechanical, civil, chemical, and other engineering subjects), mathematics, science, communication, HR and behavioral interviews, project discussions, and general knowledge.

MANDATORY RULES:
1. Concise, layered, interview-ready answers: Every answer must be easy to speak naturally in an interview. Start with a short, accurate definition (1–2 sentences, speakable in 5–15 seconds). Provide optional supporting details in clearly separated sections. Never overwhelm the user with a long paragraph.
2. No repetition and no filler: Do not repeat the same information in the definition, key points, and summary. Do not generate lengthy introductory explanations or conversational filler ("Sure", "Here is", "Let's understand this", "In an interview"). Start directly with the first definition or section.
3. For definition questions: Use this exact structure in "summary":
   **Definition**
   [Short, accurate definition in 1–2 sentences, speakable in 5–15 seconds.]

   **Key Points**
   - [3 to 5 short bullets with essential principles, mechanisms, or rules]

   **Example**
   [Minimal, correct code snippet, formula, or practical example only when useful. Do not repeat definitions.]

   **Important Note**
   [Short, crucial caveat, rule, or edge case if needed.]
4. For comparison questions ("What is the difference between X and Y?", "Explain X and Y.", "What are X and Y?", "X vs Y"): Use this exact structure in "summary":
   **[Concept A] — Definition**
   [Accurate definition of Concept A in 1–2 concise sentences.]

   **[Concept B] — Definition**
   [Accurate definition of Concept B in 1–2 concise sentences.]

   **Key Differences**
   - **Purpose:** [Distinction between Concept A and Concept B purpose]
   - **Parameters / Signatures:** [Distinction in parameters, signatures, or core mechanism]
   - **Polymorphism / Behavior:** [Distinction in runtime vs compile-time behavior, or practical trade-offs]

   **Example**
   [Short practical example or minimal compilable code only when useful. Do not repeat definitions in example explanation.]

   **Interview Summary**
   [1–2 sentence crisp closing contrast summary.]
5. For how/why questions: Direct answer → essential steps or reasoning → example if useful.
6. For coding questions: Brief approach → correct minimal compilable code → concise explanation and edge cases.
7. For HR, behavioral, and communication questions: Provide a natural, speakable answer tailored to the question without unnecessary headings.
8. For general knowledge: Direct answer with only the supporting detail needed. Omit irrelevant sections rather than generating filler.
9. Accuracy before fluency: Never invent facts. Complete every sentence with proper terminal punctuation.

Format your response strictly as a JSON object with this schema:
{
  "summary": "Formatted layered markdown according to the question structure above.",
  "spokenScript": "Short, natural script speaking the opening definition aloud in 5–15 seconds, without markdown headings or meta-phrases.",
  "bullets": [
    "Key Point / Difference 1",
    "Key Point / Difference 2",
    "Key Point / Difference 3"
  ],
  "codeSnippet": null, // Include ONLY when relevant/requested: { "language": "...", "code": "...", "explanation": "...", "timeComplexity": "...", "spaceComplexity": "..." }
  "tradeoffs": [
    "Key trade-off or practical engineering consideration 1"
  ]
}

Return ONLY valid JSON. Do not wrap in markdown \`\`\`json or add introductory text.`;

// Call Groq Llama 3.3 70B (ultra-fast ~250-400ms inference)
async function callGroq(prompt: string, apiKey: string, model = 'llama-3.3-70b-versatile', mode: AnswerMode = 'general'): Promise<CopilotAnswer | null> {
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_INTERVIEW_PROMPT },
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
async function callOpenAI(prompt: string, apiKey: string, model = 'gpt-4o-mini', mode: AnswerMode = 'general'): Promise<CopilotAnswer | null> {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_INTERVIEW_PROMPT },
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
async function callAnthropic(prompt: string, apiKey: string, model = 'claude-3-5-sonnet-20241022', mode: AnswerMode = 'general'): Promise<CopilotAnswer | null> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model || 'claude-3-5-sonnet-20241022',
      system: SYSTEM_INTERVIEW_PROMPT,
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
  const cleanJson = raw.replace(/^```json/gim, '').replace(/^```/gim, '').replace(/```$/gim, '').trim();
  const parsed = JSON.parse(cleanJson);

  return {
    id: `ans_${provider}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    question: prompt,
    mode,
    summary: parsed.summary || 'Direct technical solution.',
    spokenScript: parsed.spokenScript || parsed.summary || 'I would approach this by...',
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

export async function POST(req: NextRequest) {
  try {
    const body: CopilotRequestBody = await req.json();
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

    const contextTurns = (body.contextHistory || []).map((h: any) => ({
      question: h.question,
      summary: h.summary || '',
      category: 'GENERAL' as QuestionCategory,
      timestamp: Date.now()
    }));

    const readiness = isQuestionReadyForAnswer(actualQuery, contextTurns);
    if (!readiness.isReady && readiness.needsMoreSpeech) {
      console.warn(`[Copilot API] Incomplete question rejected before provider call: "${prompt}" (${readiness.reason})`);
      return NextResponse.json({
        error: `Incomplete question: ${readiness.reason}`,
        isIncomplete: true,
        reason: readiness.reason,
        needsMoreSpeech: true
      }, { status: 400 });
    }

    const groqKey = apiKey && provider === 'groq' ? apiKey : process.env.GROQ_API_KEY;
    const openAiKey = apiKey && provider === 'openai' ? apiKey : process.env.OPENAI_API_KEY;
    const anthropicKey = apiKey && provider === 'anthropic' ? apiKey : process.env.ANTHROPIC_API_KEY;

    // 1. If Groq selected or Groq Key present
    if ((provider === 'groq' || !provider) && groqKey) {
      try {
        const groqAnswer = await callGroq(prompt, groqKey, model, mode);
        if (groqAnswer) {
          return NextResponse.json({
            answer: groqAnswer,
            source: 'groq',
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
        const openAiAnswer = await callOpenAI(prompt, openAiKey, model, mode);
        if (openAiAnswer) {
          return NextResponse.json({
            answer: openAiAnswer,
            source: 'openai',
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
        const claudeAnswer = await callAnthropic(prompt, anthropicKey, model, mode);
        if (claudeAnswer) {
          return NextResponse.json({
            answer: claudeAnswer,
            source: 'anthropic',
            model: model || 'claude-3-5-sonnet'
          });
        }
      } catch (err) {
        console.warn('Anthropic provider attempt failed, falling back:', err);
      }
    }

    // 4A. Real-time Streaming for Local Ollama Model (sub-300ms time to first token)
    if (stream && (provider === 'ollama' || !provider || (!groqKey && !openAiKey && !anthropicKey))) {
      const baseOllama = ollamaUrl || process.env.OLLAMA_API_URL || 'http://localhost:11434';
      const genUrl = baseOllama.endsWith('/api/generate') ? baseOllama : `${baseOllama.replace(/\/$/, '')}/api/generate`;
      const modelName = model || process.env.OLLAMA_MODEL || 'qwen2.5:3b';

      const { systemPrompt, userPrompt } = buildQuestionSpecificPrompt(
        prompt,
        mode,
        category,
        resumeContext,
        jobDescription
      );

      const startTime = Date.now();

      try {
        const ollamaStreamRes = await fetch(genUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelName,
            prompt: `${systemPrompt}\n\nCandidate Question: ${userPrompt}`,
            stream: true,
            options: {
              num_gpu: 99,
              num_thread: 8,
              num_ctx: 2048,
              num_predict: 650,
              temperature: 0.1
            },
            keep_alive: -1
          }),
          signal: req.signal
        });

        if (ollamaStreamRes.ok && ollamaStreamRes.body) {
          const encoder = new TextEncoder();
          let firstTokenTimeMs = 0;
          let fullText = '';

          const sseStream = new ReadableStream({
            async start(controller) {
              const reader = ollamaStreamRes.body!.getReader();
              const decoder = new TextDecoder();
              let buffer = '';
              let doneEmitted = false;
              let doneReason = 'stop';

              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  buffer += decoder.decode(value, { stream: true });
                  const lines = buffer.split('\n');
                  buffer = lines.pop() || '';

                  for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) continue;

                    try {
                      const parsed = JSON.parse(trimmedLine);
                      if (parsed.response) {
                        if (!firstTokenTimeMs) {
                          firstTokenTimeMs = Date.now() - startTime;
                          controller.enqueue(
                            encoder.encode(`event: first_token\ndata: ${JSON.stringify({ timeToFirstTokenMs: firstTokenTimeMs })}\n\n`)
                          );
                        }
                        fullText += parsed.response;
                        controller.enqueue(
                          encoder.encode(`event: chunk\ndata: ${JSON.stringify({ text: parsed.response })}\n\n`)
                        );
                      }
                      if (parsed.done && !doneEmitted) {
                        doneEmitted = true;
                        doneReason = parsed.done_reason || 'stop';
                        const totalTimeMs = Date.now() - startTime;
                        const finalAnswer = parseStreamingAnswer(fullText, prompt, mode, doneReason);
                        controller.enqueue(
                          encoder.encode(`event: done\ndata: ${JSON.stringify({
                            answer: finalAnswer,
                            source: 'ollama',
                            model: modelName,
                            timeToFirstTokenMs: firstTokenTimeMs || totalTimeMs,
                            totalTimeMs,
                            doneReason
                          })}\n\n`)
                        );
                      }
                    } catch {}
                  }
                }

                // Flush any final buffered characters from the stream
                buffer += decoder.decode();
                if (buffer.trim()) {
                  const remainingLines = buffer.split('\n');
                  for (const rLine of remainingLines) {
                    const trimmedR = rLine.trim();
                    if (!trimmedR) continue;
                    try {
                      const parsed = JSON.parse(trimmedR);
                      if (parsed.response) {
                        fullText += parsed.response;
                        controller.enqueue(
                          encoder.encode(`event: chunk\ndata: ${JSON.stringify({ text: parsed.response })}\n\n`)
                        );
                      }
                      if (parsed.done && !doneEmitted) {
                        doneEmitted = true;
                        doneReason = parsed.done_reason || 'stop';
                        const totalTimeMs = Date.now() - startTime;
                        const finalAnswer = parseStreamingAnswer(fullText, prompt, mode, doneReason);
                        controller.enqueue(
                          encoder.encode(`event: done\ndata: ${JSON.stringify({
                            answer: finalAnswer,
                            source: 'ollama',
                            model: modelName,
                            timeToFirstTokenMs: firstTokenTimeMs || totalTimeMs,
                            totalTimeMs,
                            doneReason
                          })}\n\n`)
                        );
                      }
                    } catch {}
                  }
                }

                // If stream ended without explicit done event
                if (!doneEmitted && fullText.trim()) {
                  doneEmitted = true;
                  const totalTimeMs = Date.now() - startTime;
                  const finalAnswer = parseStreamingAnswer(fullText, prompt, mode, doneReason);
                  controller.enqueue(
                    encoder.encode(`event: done\ndata: ${JSON.stringify({
                      answer: finalAnswer,
                      source: 'ollama',
                      model: modelName,
                      timeToFirstTokenMs: firstTokenTimeMs || totalTimeMs,
                      totalTimeMs,
                      doneReason
                    })}\n\n`)
                  );
                }
              } catch (streamErr) {
                controller.error(streamErr);
              } finally {
                controller.close();
              }
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
      } catch (ollamaErr) {
        console.warn('[Copilot API] Streaming Ollama error, falling back to synchronous:', ollamaErr);
      }
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
          category
        );

        if (ollamaAnswer) {
          return NextResponse.json({ 
            answer: ollamaAnswer, 
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
    return NextResponse.json({
      answer: fallbackAnswer,
      source: 'built-in-engine',
      setupNotice: 'Served via built-in interview engine. Configure Groq, OpenAI, or Ollama in Settings ⚙️ for cloud models.'
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
