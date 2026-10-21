import { AnswerMode, CopilotAnswer, MockTurnFeedback, MockInterviewReport, ResumeAnalysisResult } from './types';
import { classifyUtterance, QuestionCategory, isDualConceptComparison } from './questionClassifier';
import { normalizeTechnicalTerms } from './technicalTermNormalizer';

/**
 * Builds tailored prompt instructions based on the question type and mandatory answer rules:
 * - Rule 1: Answer the exact question first in the very first sentence. No preambles, intros, or filler.
 * - Rule 2: Add a short explanation (1-3 sentences) after the definition with a concrete example where useful.
 * - Rule 3: Structured answers for comparison questions (separate sections for each concept, concise explanations, examples, key difference).
 * - Rule 4: Match the answer length to the question (concise, natural to speak aloud, no unnecessary headings).
 * - Rule 5: Accuracy before fluency (no invented facts, precise terminology).
 */
export function buildQuestionSpecificPrompt(
  prompt: string,
  mode: AnswerMode = 'general',
  explicitCategory?: QuestionCategory,
  resumeContext = '',
  jobDescription = ''
): { systemPrompt: string; userPrompt: string; category: QuestionCategory } {
  // Normalize candidate speech using technical term guess engine
  const termNorm = normalizeTechnicalTerms(prompt);
  const cleanPrompt = termNorm.normalizedText;

  let antiHallucinationNotice = '';
  if (termNorm.hasUnknownSuspectTerm && termNorm.suspectTerms.length > 0) {
    const domain = termNorm.detectedDomains.length > 0 ? termNorm.detectedDomains[0] : 'this domain';
    antiHallucinationNotice = `\nCRITICAL ANTI-HALLUCINATION GUARD:
The candidate query mentions the nonstandard term "${termNorm.suspectTerms.join(', ')}", which is NOT an established concept in ${domain}.
DO NOT fabricate, hallucinate, or invent a fictional definition or pretend this concept exists.
Instead, your very first sentence MUST clarify that this term is not standard in ${domain} and politely request clarification (e.g. "${termNorm.suggestedClarification}").\n`;
  }

  const category = explicitCategory || classifyUtterance(cleanPrompt).category;

  const coreRules = `MANDATORY INTERVIEW ANSWER RULES:
1. RULE 1 (CONCISE, LAYERED, INTERVIEW-READY STRUCTURE):
   Every answer must be easy to speak naturally in an interview.
   Start with a short, accurate definition suitable for speaking aloud in approximately 5–15 seconds (normally 1–2 sentences).
   Provide optional supporting details in clearly separated sections. Never overwhelm the user with a long paragraph.
   Keep explanations in separate sections rather than one long paragraph.

2. RULE 2 (NO REPETITION & NO FILLER):
   Do not repeat the same information in the definition, key points, and summary.
   Do not generate lengthy introductory explanations or irrelevant background.
   Never begin with conversational filler ("Sure", "Here is", "Let's understand this", "In an interview").
   Start directly with the first section heading or definition.
   Use additional detail only when it materially helps answer the question.

3. RULE 3 (DEFINITION QUESTION STRUCTURE):
   For definition questions (e.g. "What is method overloading?", "Define Ohm's law"):
   Use this exact structure:

   **Definition**
   [Short, accurate definition in 1–2 sentences, speakable in 5–15 seconds.]

   **Key Points**
   - [3 to 5 short bullets with essential principles, mechanisms, or rules]

   **Example**
   [Minimal, correct code snippet, formula, or practical example only when useful. Do not repeat definitions.]

   **Important Note**
   [Short, crucial caveat, rule, or edge case if needed.]

4. RULE 4 (COMPARISON QUESTION STRUCTURE):
   When comparing concepts X and Y (e.g. "What is the difference between X and Y?", "Explain X and Y.", "What are X and Y?", "X vs Y"):
   Only compare if concepts to compare are explicitly specified in the question or immediate context. If not provided, ask for clarification.
   Use this exact structure:

   **[Concept A] — Definition**
   [Accurate definition of Concept A in 1–2 concise sentences.]

   **[Concept B] — Definition**
   [Accurate definition of Concept B in 1–2 concise sentences.]

   **Key Differences**
   - **Purpose:** [Distinction between Concept A and Concept B purpose]
   - **Parameters / Signatures:** [Distinction in parameters, signatures, or core mechanism]
   - **Polymorphism / Behavior:** [Distinction in runtime vs compile-time behavior, execution timing, or practical trade-offs]

   **Example**
   [Short practical example or minimal compilable code only when useful. Do not repeat definitions in the example explanation.]

   **Interview Summary**
   [1–2 sentence crisp closing contrast summary.]

5. RULE 5 (ADAPT TO QUESTION TYPE):
   Apply this layered approach across all subjects and interview questions:
   - Definition: Definition → key points → example → important note if needed.
   - Comparison: Definition of A → definition of B → key differences → example → interview summary.
   - How/why: Direct answer → essential steps or reasoning → example if useful.
   - Coding: Brief approach → correct minimal compilable code → concise explanation and edge cases.
   - Behavioral or HR: A natural, speakable answer tailored to the question, without unnecessary headings.
   - General knowledge: Direct answer with only the supporting detail needed.
   Do not force every answer into every section. Omit irrelevant sections rather than generating filler.

6. RULE 6 (ACCURACY & SENTENCE CLOSURE):
   Accuracy before fluency: never invent technical facts, equations, or personal experience.
   Keep code examples correct, minimal, and compilable.
   ALWAYS complete every sentence with proper terminal punctuation (period, exclamation mark, or question mark).
   NEVER end mid-sentence, NEVER leave dangling thoughts or unfinished examples, and NEVER output trailing ellipses ("...").`;

  let categoryInstructions = '';
  switch (category) {
    case 'DIRECT':
      categoryInstructions = `QUESTION CATEGORY: DEFINITION.
Answer ONLY the specific concept asked. DO NOT create a comparison or force comparison sections.
Use this exact layered structure:

**Definition**
[Accurate definition in 1–2 concise sentences, speakable in 5–15 seconds.]

**Key Points**
- [Point 1: Core principle or rule]
- [Point 2: Key mechanism or behavior]
- [Point 3: How it is evaluated, resolved, or applied]

**Example**
[Minimal, correct code snippet, formula, or practical example only when relevant. Omit if not useful.]

**Important Note**
[Short crucial caveat, edge case, or rule if needed. Omit if not applicable.]

Ensure all sentences have proper terminal punctuation.`;
      break;

    case 'DIFFERENCE':
      categoryInstructions = `QUESTION CATEGORY: COMPARISON (X vs Y).
Use this exact layered structure:

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

Ensure all sentences have proper terminal punctuation.`;
      break;

    case 'HOW_WHY':
      categoryInstructions = `QUESTION CATEGORY: HOW / WHY.
Use this layered structure:
- Direct Answer: Direct answer stating the mechanism, root cause, or core principle in 1–2 sentences.
- Essential Steps / Reasoning: 2–3 concise steps or system reasoning.
- Example: Concrete example, formula, or application if useful.
Ensure all sentences are complete with full terminal punctuation.`;
      break;

    case 'FOLLOW_UP':
      categoryInstructions = `QUESTION CATEGORY: CONTEXTUAL FOLLOW-UP.
- Direct Answer: Directly answer the follow-up question in 1–2 sentences.
- Essential Nuance: Provide specific rationale or nuance without repeating previous answer.
- Example / Note: Concrete example or caveat if useful.
Ensure all sentences are complete with full terminal punctuation.`;
      break;

    default:
      categoryInstructions = `QUESTION CATEGORY: GENERAL / INTERVIEW QUESTION.
- For behavioral or HR questions: Provide a natural, speakable answer tailored to the question without unnecessary headings.
- For general knowledge: Direct answer with only the supporting detail needed.
- For coding questions: Brief approach → correct minimal code → concise explanation and edge cases.
Ensure all sentences are complete with full terminal punctuation.`;
      break;
  }

  const systemPrompt = `You are EchoCopilot, an elite real-time interview assistant answering across all engineering disciplines (computer science, software, cybersecurity, electronics, electrical, mechanical, civil, chemical, and others), mathematics, science, communication, HR and behavioral interviews, project discussions, and general knowledge.
Mode: ${mode.toUpperCase()}.
${coreRules}
${categoryInstructions}${antiHallucinationNotice}
${resumeContext ? `Candidate Background: ${resumeContext}\n` : ''}${jobDescription ? `Target Role: ${jobDescription}\n` : ''}
Speak naturally and professionally. Start immediately with the first sentence answering the question.`;

  return { systemPrompt, userPrompt: cleanPrompt, category };
}

/**
 * Checks whether a line represents a markdown or styled section heading.
 * Crucially does NOT match conversational narrative sentences (e.g., "The main difference is...").
 */
function isSectionHeading(line: string): { 
  isHeading: boolean; 
  section?: 'summary' | 'spokenScript' | 'bullets' | 'tradeoffs' | 'conclusion'; 
  inlineContent?: string 
} {
  const trimmed = line.trim();
  // Markdown headings: ### Summary, ## Trade-offs
  const mdMatch = trimmed.match(/^#{1,4}\s+(.+)$/);
  // Bold headers alone or with inline content: **Summary:** or **Spoken Script:**
  const boldMatch = trimmed.match(/^\*\*([^*:]+)(?:\*\*:\s*|\*\*\s*$)(.*)$/);
  // Standalone short title ending with colon (e.g. "Spoken Script:", "Summary:")
  const shortColonMatch = trimmed.length < 35 && trimmed.endsWith(':') ? trimmed.slice(0, -1).trim() : null;

  let title = '';
  let inlineContent = '';
  if (mdMatch) {
    title = mdMatch[1].toLowerCase();
  } else if (boldMatch) {
    title = boldMatch[1].toLowerCase();
    inlineContent = boldMatch[2]?.trim() || '';
  } else if (shortColonMatch) {
    title = shortColonMatch.toLowerCase();
  }

  if (!title) return { isHeading: false };

  // ONLY treat explicit outer meta-labels as section splitters (never layered answer content headings like "Key Points" or "Example")
  if (title.startsWith('spoken script') || title.startsWith('what to say') || title.startsWith('interview script')) {
    return { isHeading: true, section: 'spokenScript', inlineContent };
  }
  if (title.startsWith('trade-off') || title.startsWith('tradeoff')) {
    return { isHeading: true, section: 'tradeoffs', inlineContent };
  }
  if (title === 'summary' || title === 'direct answer' || title === 'core answer') {
    return { isHeading: true, section: 'summary', inlineContent };
  }

  return { isHeading: false };
}

/**
 * Parses streaming or raw text from Ollama into a structured CopilotAnswer.
 * Preserves the complete layered markdown explanation, extracts 5–15s spoken definition,
 * extracts code snippets, and cleanly detects incomplete responses without fabricating text.
 */
export function parseStreamingAnswer(
  rawText: string, 
  question: string, 
  mode: AnswerMode = 'general',
  doneReason?: string
): CopilotAnswer {
  const clean = rawText.trim();
  
  // 1. Try JSON parse if formatted as JSON
  if (clean.startsWith('{') && clean.endsWith('}')) {
    try {
      const parsed = JSON.parse(clean);
      return {
        id: 'ans_ollama_' + Math.random().toString(36).substring(2, 8),
        question,
        mode,
        summary: parsed.summary || 'Direct technical solution.',
        spokenScript: parsed.spokenScript || parsed.script || parsed.summary,
        bullets: Array.isArray(parsed.bullets) && parsed.bullets.length > 0 
          ? parsed.bullets.map((b: any) => typeof b === 'string' ? b : String(b.text || Object.values(b)[0]))
          : [parsed.summary || 'Core technical solution.'],
        codeSnippet: parsed.codeSnippet && parsed.codeSnippet.code ? {
          language: parsed.codeSnippet.language || 'typescript',
          code: parsed.codeSnippet.code,
          explanation: parsed.codeSnippet.explanation,
          timeComplexity: parsed.codeSnippet.timeComplexity,
          spaceComplexity: parsed.codeSnippet.spaceComplexity
        } : undefined,
        tradeoffs: Array.isArray(parsed.tradeoffs) ? parsed.tradeoffs : undefined,
        rawText: clean,
        isIncomplete: doneReason === 'length',
        doneReason: doneReason || 'stop',
        timestamp: Date.now()
      };
    } catch {}
  }

  // 2. Extract code block if present (complete or unclosed)
  let codeSnippet: CopilotAnswer['codeSnippet'] = undefined;
  const closedCodeMatch = clean.match(/```([a-z0-9_-]*)\n([\s\S]*?)```/i);
  if (closedCodeMatch) {
    codeSnippet = {
      language: closedCodeMatch[1].trim() || 'typescript',
      code: closedCodeMatch[2].trim()
    };
  } else {
    const unclosedCodeMatch = clean.match(/```([a-z0-9_-]*)\n([\s\S]+)$/i);
    if (unclosedCodeMatch && unclosedCodeMatch[2].trim()) {
      codeSnippet = {
        language: unclosedCodeMatch[1].trim() || 'typescript',
        code: unclosedCodeMatch[2].trim()
      };
    }
  }

  // 3. Trade-offs extraction (if present as a distinct section)
  let summaryText = clean;
  const tradeoffs: string[] = [];
  const tradeoffMatch = clean.match(/(?:^|\n)\*\*(?:Trade-offs|Tradeoffs)\*\*[:\s]*([\s\S]*)$/i);
  if (tradeoffMatch) {
    summaryText = clean.substring(0, tradeoffMatch.index).trim();
    const tradeLines = tradeoffMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
    for (const tl of tradeLines) {
      tradeoffs.push(tl.replace(/^[-*]\s*|\d+\.\s*/, '').trim());
    }
  }

  // 4. Extract spokenScript (suitable to speak aloud in 5–15 seconds)
  let spokenScript = '';
  const explicitScriptMatch = clean.match(/(?:^|\n)\*\*(?:Spoken Script|What to say out loud|Interview Script)\*\*[:\s]*([\s\S]*?)(?:\n\n|\n\*\*|$)/i);
  if (explicitScriptMatch && explicitScriptMatch[1].trim()) {
    spokenScript = explicitScriptMatch[1].trim();
  } else {
    // Check if Interview Summary exists (ideal for comparison questions)
    const interviewSummaryMatch = clean.match(/(?:^|\n)\*\*Interview Summary\*\*[:\s]*([\s\S]*?)(?:\n\n|\n\*\*|$)/i);
    if (interviewSummaryMatch && interviewSummaryMatch[1].trim()) {
      spokenScript = interviewSummaryMatch[1].trim().replace(/^\*\*.*?\*\*:\s*/, '');
    } else {
      // Check if **Definition** section exists
      const defMatch = clean.match(/(?:^|\n)\*\*Definition\*\*[:\s]*([\s\S]*?)(?:\n\n|\n\*\*|$)/i);
      if (defMatch && defMatch[1].trim()) {
        spokenScript = defMatch[1].trim();
      } else {
        // Check for **Concept — Definition**
        const conceptDefMatch = clean.match(/(?:^|\n)\*\*[^*]+(?:\s*—\s*|\s*-\s*)Definition\*\*[:\s]*([\s\S]*?)(?:\n\n|\n\*\*|$)/i) ||
                                clean.match(/(?:^|\n)\*\*[^*]+\*\*\s*(?:—|-)\s*Definition[:\s]*([\s\S]*?)(?:\n\n|\n\*\*|$)/i);
        if (conceptDefMatch && conceptDefMatch[1].trim()) {
          spokenScript = conceptDefMatch[1].trim();
        } else {
          // Fallback: first 1–2 complete sentences of the opening paragraph
          const firstPara = clean
            .replace(/```[\s\S]*?```/g, '')
            .split(/\n\s*\n/)[0]
            .replace(/^(?:#+\s*|\*\*[^*]+\*\*[:\s]*)+/gm, '')
            .trim();
          const sentences = firstPara.match(/[^.!?]+[.!?]+/g);
          spokenScript = sentences ? sentences.slice(0, 2).join(' ').trim() : firstPara.slice(0, 200).trim();
        }
      }
    }
  }
  spokenScript = spokenScript.replace(/^\*\*.*?\*\*[:\s]*/, '').replace(/^\*\*|\*\*$/g, '').trim();

  // 5. Bullets extraction
  // If summary already has **Key Points** or **Key Differences**, leave bullets empty to avoid UI duplication
  const hasEmbeddedBullets = /\*\*(?:Key Points|Key Differences)\*\*/i.test(summaryText);
  const bullets: string[] = [];
  if (!hasEmbeddedBullets) {
    const lines = summaryText.split('\n').map(l => l.trim()).filter(Boolean);
    for (const l of lines) {
      if (l.startsWith('- ') || l.startsWith('* ')) {
        bullets.push(l.replace(/^[-*]\s*/, '').trim());
      }
    }
  }

  // 6. Clean summary: strip outer wrapping asterisks if entire text is bolded
  let cleanSummary = summaryText.trim();
  if (cleanSummary.startsWith('**') && cleanSummary.endsWith('**') && (cleanSummary.match(/\*\*/g) || []).length === 2) {
    cleanSummary = cleanSummary.slice(2, -2).trim();
  }
  if (!spokenScript) spokenScript = cleanSummary;

  // 7. Determine whether answer ended prematurely
  let isIncomplete = false;
  if (doneReason === 'length') {
    isIncomplete = true;
  } else {
    const textWithoutCode = clean.replace(/```[\s\S]*?(?:```|$)/g, '').trim();
    const inspectedText = textWithoutCode.trim() || clean.trim();
    if (inspectedText) {
      const terminalChars = ['.', '!', '?', '"', "'", '`', '}', ')', '>'];
      const lastChar = inspectedText[inspectedText.length - 1];
      if (!terminalChars.includes(lastChar) && !clean.endsWith('```')) {
        isIncomplete = true;
      }
    }
  }

  return {
    id: 'ans_ollama_' + Math.random().toString(36).substring(2, 8),
    question,
    mode,
    summary: cleanSummary,
    spokenScript,
    bullets: bullets.length > 0 ? bullets : [],
    codeSnippet,
    tradeoffs: tradeoffs.length > 0 ? tradeoffs : undefined,
    rawText: clean,
    isIncomplete,
    doneReason: doneReason || (isIncomplete ? 'incomplete' : 'stop'),
    timestamp: Date.now()
  };
}

export async function generateOllamaAnswer(
  prompt: string,
  mode: AnswerMode = 'general',
  resumeContext = '',
  jobDescription = '',
  modelParam = '',
  urlParam = '',
  explicitCategory?: QuestionCategory
): Promise<CopilotAnswer | null> {
  const trimmedLower = prompt.trim().toLowerCase();
  const classification = classifyUtterance(prompt);

  // Quick bypass for non-questions (statements, greetings, topic transitions)
  if (!classification.isQuestion) {
    console.log(`[Ollama] Skipping non-question: "${prompt}" (Intent: ${classification.intent}, Reason: ${classification.reason})`);
    return null;
  }

  const baseOllama = urlParam || process.env.OLLAMA_API_URL || 'http://localhost:11434';
  const ollamaUrl = baseOllama.endsWith('/api/generate') ? baseOllama : `${baseOllama.replace(/\/$/, '')}/api/generate`;
  const modelName = modelParam || process.env.OLLAMA_MODEL || 'qwen2.5:3b';

  const { systemPrompt, userPrompt } = buildQuestionSpecificPrompt(
    prompt,
    mode,
    explicitCategory || classification.category,
    resumeContext,
    jobDescription
  );

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const resp = await fetch(ollamaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        prompt: `${systemPrompt}\n\nCandidate Question: ${userPrompt}`,
        stream: false,
        options: {
          num_gpu: 99,
          num_thread: 8,
          num_ctx: 2048,
          num_predict: 650,
          temperature: 0.1
        },
        keep_alive: -1 // Keep model permanently hot in GPU/VRAM to eliminate reload delay
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      console.warn(`[Ollama] HTTP ${resp.status} from ${ollamaUrl}`);
      return null;
    }

    const data = await resp.json();
    if (!data || !data.response) {
      return null;
    }

    return parseStreamingAnswer(data.response, prompt, mode, data.done_reason);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Ollama] Local generation unavailable (${msg}). Gracefully falling back to local smart engine.`);
    return null;
  }
}

export function generateSmartCopilotAnswer(prompt: string, mode: AnswerMode = 'general'): CopilotAnswer {
  // Normalize candidate speech using technical-term guess engine
  const normResult = normalizeTechnicalTerms(prompt);
  const normalizedQuery = normResult.normalizedText;
  const p = normalizedQuery.toLowerCase();
  const id = 'ans_' + Math.random().toString(36).substring(2, 9);
  const now = Date.now();

  // -------------------------------------------------------------
  // 0a. ANTI-HALLUCINATION GUARD FOR UNKNOWN NONSTANDARD TERMS
  // -------------------------------------------------------------
  if (normResult.hasUnknownSuspectTerm && normResult.suspectTerms.length > 0) {
    const suspect = normResult.suspectTerms[0];
    const domain = normResult.detectedDomains.length > 0 ? normResult.detectedDomains[0] : 'this domain';
    const clarification = normResult.suggestedClarification || `The term "${suspect}" is not a recognized standard concept in ${domain}. Could you please clarify what you mean or provide more context?`;
    return {
      id,
      question: prompt,
      mode: 'general',
      summary: clarification,
      spokenScript: clarification,
      bullets: [
        `Unrecognized Concept: "${suspect}" has no standard definition in ${domain}.`,
        'Anti-Hallucination Guard: Prompt for clarification instead of fabricating a fictional technical definition.',
        'Possible Speech Recognition Error: Verify whether a different technical term or pronunciation was intended.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 0. GREETINGS, AUDIO CHECKS & PLEASANTRIES (NOT CODING PROBLEMS!)
  // -------------------------------------------------------------
  const trimmedLower = normalizedQuery.trim().toLowerCase();
  const hasQuestionMarker = /\b(what|how|why|explain|difference|describe|implement|define|tell me|code|solve)\b/i.test(trimmedLower);
  const isGreetingOnly = /^(hello|hi|hey|good morning|good afternoon|good evening|how are you|can you hear me|am i audible|testing|audio check|thanks|thank you)(\s+(punit|puneet|there|everyone|sir|team))?[.?!]?$/i.test(trimmedLower);

  if (!hasQuestionMarker && isGreetingOnly) {
    return {
      id,
      question: prompt,
      mode: 'behavioral',
      summary: 'Conversational pleasantry or audio check from the interviewer.',
      spokenScript: 'Hello! Yes, I can hear you loud and clear. Excited to speak with you today, thank you for having me!',
      bullets: [
        'Acknowledge clearly: Confirm that their microphone and audio connection are crystal clear.',
        'Tone: Professional, enthusiastic, and relaxed.',
        'Pivot: Ready to transition smoothly into the technical questions.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 0b. JAVA: CHECKED VS UNCHECKED EXCEPTIONS (Layered Format)
  // -------------------------------------------------------------
  if (p.includes('checked') && p.includes('unchecked') && p.includes('exception')) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: `**Checked Exceptions — Definition**

Checked exceptions are subclasses of Exception (excluding RuntimeException) that the Java compiler forces you to handle at compile-time using try-catch or declare in the method signature with the throws keyword.

**Unchecked Exceptions — Definition**

Unchecked exceptions are subclasses of RuntimeException or Error that the compiler does not require you to declare or handle in the method signature, typically representing defects or unexpected runtime faults.

**Key Differences**
- **Compile-Time vs Runtime:** Checked exceptions are verified by the compiler at compile time; unchecked exceptions occur and are evaluated at runtime.
- **Handling Obligation:** Checked exceptions mandate explicit try-catch or throws declarations; unchecked exceptions require no method signature declaration.
- **Purpose:** Checked exceptions handle recoverable conditions outside application control; unchecked exceptions represent preventable programming mistakes.

**Example**
\`\`\`java
// Checked: compiler requires handling
public void readFile(String path) throws IOException {
    FileReader reader = new FileReader(path);
}

// Unchecked: runtime defect, no throws required
public int divide(int a, int b) {
    return a / b;
}
\`\`\`

**Interview Summary**
Checked exceptions enforce compile-time handling for recoverable external faults, while unchecked exceptions represent preventable runtime programming defects.`,
      spokenScript: 'Checked exceptions enforce compile-time handling for recoverable external faults, while unchecked exceptions represent preventable runtime programming defects.',
      bullets: [],
      codeSnippet: {
        language: 'java',
        code: `// Checked Exception: Compiler requires handling
public void readFile(String path) throws IOException {
    FileReader reader = new FileReader(path);
}

// Unchecked Exception: Occurs at runtime, no throws required
public int divide(int a, int b) {
    return a / b;
}`
      },
      complexity: {
        time: 'O(1) exception object allocation and stack trace fill',
        space: 'O(N) where N is execution call stack depth'
      },
      tradeoffs: [
        'Checked exceptions enforce robustness at compile-time but introduce boilerplate and signature coupling; modern frameworks frequently wrap checked exceptions into unchecked RuntimeExceptions.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 0b2. OOP: METHOD OVERRIDING VS METHOD OVERLOADING (Layered Format)
  // -------------------------------------------------------------
  if (
    (p.includes('overriding') && p.includes('overloading')) ||
    (p.includes('override') && p.includes('overload'))
  ) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: `**Method Overriding — Definition**

Method overriding occurs when a subclass provides its own implementation of an inherited instance method, using a compatible signature and return type, subject to Java's overriding rules.

**Method Overloading — Definition**

Method overloading means defining methods with the same name but different parameter lists, usually in the same class.

**Key Differences**
- **Purpose:** Overriding specializes inherited behavior; overloading provides different ways to perform an operation.
- **Parameters:** Overriding uses a compatible method signature; overloading requires different parameter lists.
- **Polymorphism:** Overriding supports runtime polymorphism; overloading is commonly associated with compile-time polymorphism.

**Example**
\`\`\`java
class Calculator {
    int add(int a, int b) { return a + b; }
    int add(int a, int b, int c) { return a + b + c; }
}

class Animal {
    void sound() { System.out.println("Animal sound"); }
}
class Dog extends Animal {
    @Override
    void sound() { System.out.println("Bark"); }
}
\`\`\`

**Interview Summary**
Overriding changes inherited method behavior, while overloading defines multiple versions of a method with different parameters.`,
      spokenScript: 'Overriding changes inherited method behavior, while overloading defines multiple versions of a method with different parameters.',
      bullets: [],
      codeSnippet: {
        language: 'java',
        code: `class Calculator {
    int add(int a, int b) { return a + b; }
    int add(int a, int b, int c) { return a + b + c; }
}

class Animal {
    void sound() { System.out.println("Animal sound"); }
}
class Dog extends Animal {
    @Override
    void sound() { System.out.println("Bark"); }
}`
      },
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 0b3. OOP: METHOD OVERLOADING (Definition Only)
  // -------------------------------------------------------------
  if (p.includes('overloading') || (p.includes('overload') && !p.includes('override'))) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: `**Definition**

Method overloading in Java means defining multiple methods with the same name but different parameter lists, such as different numbers or types of parameters.

**Key Points**
- It is an example of compile-time polymorphism.
- Overloaded methods must differ in their parameter lists; changing only the return type is not sufficient.
- The compiler selects the appropriate overload based on the arguments and applicable method-resolution rules.

**Example**
\`\`\`java
class Calculator {
    int add(int a, int b) {
        return a + b;
    }

    int add(int a, int b, int c) {
        return a + b + c;
    }
}
\`\`\`

**Important Note**
Overloading is determined by the method signature's parameter list, not by the return type alone.`,
      spokenScript: 'Method overloading in Java means defining multiple methods with the same name but different parameter lists, such as different numbers or types of parameters.',
      bullets: [],
      codeSnippet: {
        language: 'java',
        code: `class Calculator {
    int add(int a, int b) {
        return a + b;
    }

    int add(int a, int b, int c) {
        return a + b + c;
    }
}`
      },
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 0b4. OOP: METHOD OVERRIDING (Definition Only)
  // -------------------------------------------------------------
  if (p.includes('overriding') || (p.includes('override') && !p.includes('overload'))) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: `**Definition**

Method overriding occurs when a subclass provides its own implementation of an inherited instance method, using a compatible signature and return type, subject to Java's overriding rules.

**Key Points**
- It enables runtime polymorphism via dynamic method dispatch.
- The overriding method in the subclass must have the same name and parameter list as the superclass method.
- The return type can be covariant, and access privilege cannot be made more restrictive.

**Example**
\`\`\`java
class Animal {
    void sound() {
        System.out.println("Animal sound");
    }
}

class Dog extends Animal {
    @Override
    void sound() {
        System.out.println("Bark");
    }
}
\`\`\`

**Important Note**
Static, private, and final methods cannot be overridden in Java.`,
      spokenScript: 'Method overriding occurs when a subclass provides its own implementation of an inherited instance method, using a compatible signature and return type.',
      bullets: [],
      codeSnippet: {
        language: 'java',
        code: `class Animal {
    void sound() { System.out.println("Animal sound"); }
}
class Dog extends Animal {
    @Override
    void sound() { System.out.println("Bark"); }
}`
      },
      timestamp: now
    };
  }

  if (p.includes('checked exception')) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'A checked exception in Java is an exception that the Java compiler requires you to catch or declare using the throws keyword.',
      spokenScript: 'A checked exception is an exception that the Java compiler forces you to handle at compile-time, either with a try-catch block or by declaring it with the throws keyword. They extend java.lang.Exception and are designed for anticipated, recoverable error scenarios like missing files or network timeouts. A standard example is IOException, which must be declared or caught whenever reading from a file.',
      bullets: [
        'Compile-Time Verification: The compiler checks that any method that can throw a checked exception either handles it with try-catch or specifies it in its throws signature.',
        'Class Hierarchy: Inherits from java.lang.Exception directly, but is NOT a subclass of java.lang.RuntimeException.',
        'Common Examples: IOException, SQLException, ClassNotFoundException, InterruptedException.',
        'Design Rationale: Used for external failure conditions that a well-written application can reasonably foresee and recover from.'
      ],
      timestamp: now
    };
  }

  if (p.includes('unchecked exception')) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'An unchecked exception is an exception that the compiler does not require you to catch or declare in the method signature.',
      spokenScript: 'An unchecked exception is an exception that the Java compiler does not require you to declare or handle at compile-time. They are direct subclasses of RuntimeException and typically signify programming bugs or invalid logic, such as a NullPointerException or an IndexOutOfBoundsException. Because they can happen anywhere in program execution, Java allows them to bubble up without cluttering every method signature with throws declarations.',
      bullets: [
        'Runtime Checking: Verified only when the program executes; the compiler does not enforce try-catch or throws clauses.',
        'Class Hierarchy: Inherits from java.lang.RuntimeException (which in turn extends java.lang.Exception) or java.lang.Error.',
        'Common Examples: NullPointerException, IllegalArgumentException, ArrayIndexOutOfBoundsException, ClassCastException.',
        'Design Rationale: Represents avoidable logic flaws that should be fixed in code rather than handled via normal control flow.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 0c. OPERATING SYSTEMS: THREAD VS PROCESS (Rule 1 & Rule 3)
  // -------------------------------------------------------------
  if ((p.includes('thread') && p.includes('process')) || (p.includes('difference') && (p.includes('thread') || p.includes('process')))) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: `**Process — Definition**

A process is an independent program in execution that owns its private virtual memory address space, including code, data, heap, and open file descriptors.

**Thread — Definition**

A thread is a lightweight unit of execution that runs inside a host process, sharing the process's heap memory, code, and resources while maintaining its own call stack and program counter.

**Key Differences**
- **Memory Space:** Processes operate in isolated virtual address spaces; threads share the heap memory of their parent process.
- **Overhead:** Creating and switching processes is heavyweight (page table invalidation); thread context switching is lightweight.
- **Communication:** Processes require Inter-Process Communication (IPC); threads communicate directly via shared memory.

**Example**
A web browser running each tab as an isolated process, while each tab spawns worker threads to fetch assets and render the page concurrently.

**Interview Summary**
Processes run in isolated address spaces with OS protection, while threads execute concurrently within the same process sharing heap memory.`,
      spokenScript: 'Processes run in isolated address spaces with OS protection, while threads execute concurrently within the same process sharing heap memory.',
      bullets: [],
      codeSnippet: {
        language: 'java',
        code: `// Multi-threading in Java: Threads share heap object memory
public class ConcurrencyDemo {
    private static int counter = 0; // Shared across threads in same process

    public static void main(String[] args) throws InterruptedException {
        Thread t1 = new Thread(() -> counter++);
        Thread t2 = new Thread(() -> counter++);
        t1.start();
        t2.start();
        t1.join();
        t2.join();
    }
}`
      },
      complexity: {
        time: 'Thread creation is ~10-20x faster than process fork() due to zero page table allocation',
        space: 'Each thread allocates a lightweight call stack (default 1MB in Java; 8MB in Linux pthreads)'
      },
      tradeoffs: [
        'Threads offer minimal latency and effortless memory sharing, but require locks to avoid race conditions. Processes provide strong fault isolation and security boundaries at the expense of higher memory and IPC overhead.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 0b. NETWORKING: LOCALHOST, PORT 3000 & WEB SERVERS
  // -------------------------------------------------------------
  if (p.includes('localhost') || p.includes('3000') || p.includes('port') || p.includes('127.0.0.1')) {
    return {
      id,
      question: prompt,
      mode: 'general',
      summary: 'localhost (loopback IP 127.0.0.1) refers to your own local computer, and port 3000 is the default TCP network socket port assigned to the local web development server.',
      spokenScript: 'localhost is the standard hostname that points back to your own machine (loopback IP 127.0.0.1) without sending traffic over the internet. The ":3000" is the specific TCP port where your web development server (like Next.js or Node) listens for requests. We use localhost:3000 so we can safely run, build, and test applications entirely on our local machine before deploying them to a public production domain.',
      bullets: [
        'Loopback Interface (127.0.0.1): localhost loops network traffic directly inside your operating system\'s TCP/IP stack without going through routers or Wi-Fi.',
        'Port 3000: An operating system network socket identifier. Port 3000 is the popular default convention for modern web frameworks like Next.js, React, Express, and Rails.',
        'Security & Privacy: Localhost dev servers bind strictly to your machine, keeping unfinished code and sensitive test data completely private.',
        'Production Contrast: In production, websites run on port 80 (HTTP) or 443 (HTTPS) behind public DNS domain names like yourcompany.com.'
      ],
      tradeoffs: [
        'Localhost provides instant Hot Module Replacement (HMR) and zero network latency, but lacks production scale, cloud databases, and real SSL certificates.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // ELECTRICAL & ELECTRONICS: OHM'S LAW
  // -------------------------------------------------------------
  if (p.includes('ohm') && (p.includes('law') || p.includes('formula') || p.includes('equation'))) {
    return {
      id,
      question: prompt,
      mode: 'general',
      summary: "Ohm's law states that the current flowing through a conductor between two points is directly proportional to the voltage across the two points and inversely proportional to resistance (V = I * R).",
      spokenScript: "Ohm's law states that the electric current through a conductor between two points is directly proportional to the voltage across those points and inversely proportional to the resistance, expressed by the formula V equals I times R. In practical electrical and electronics engineering, it governs circuit calculations: increasing voltage increases current flow, whereas increasing resistance restricts current. For example, applying a 10-volt potential across a 5-ohm resistor produces exactly 2 amperes of current.",
      bullets: [
        "Fundamental Equation: V = I * R, where V is potential difference (Volts), I is current (Amperes), and R is resistance (Ohms).",
        "Ohmic vs Non-Ohmic Conductors: Valid for standard linear resistors at constant temperature; non-linear components like diodes and transistors do not obey strict Ohm's law.",
        "Power Relationships: Combined with Joule's law, electrical power is P = V * I = I^2 * R = V^2 / R.",
        "Engineering Application: Essential for sizing pull-up/pull-down resistors, limiting LED currents, and analyzing power dissipation."
      ],
      complexity: {
        time: 'Linear voltage-current characteristic under isothermal conditions',
        space: 'Standard SI Units: Volts (V), Amperes (A), Ohms (Ω)'
      },
      tradeoffs: [
        "Higher resistance lowers power dissipation and current draw, but can increase RC time constants and slow down high-speed signal switching."
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // ELECTRICAL: AC VS DC (DIFFERENCE QUESTION)
  // -------------------------------------------------------------
  if ((p.includes('ac') && p.includes('dc') && (p.includes('difference') || p.includes('compare') || p.includes('vs'))) || (p.includes('alternating current') && p.includes('direct current'))) {
    return {
      id,
      question: prompt,
      mode: 'general',
      summary: `**1. Alternating Current (AC)**

Alternating current is an electric current that periodically reverses its direction and changes its magnitude in a continuous cycle, typically in a sinusoidal waveform. It is the global standard for power grid distribution because transformers can easily step voltages up or down to minimize transmission losses.

**Example:** Standard household wall outlet electrical supply operating at 50 Hz or 60 Hz.

**2. Direct Current (DC)**

Direct current is an electric current that flows continuously in a single, constant direction with fixed polarity. It provides stable, constant voltage essential for digital logic circuits, semiconductors, and energy storage systems.

**Example:** Batteries, solar photovoltaic cells, and internal smartphone power rails.

**3. Key Difference**

AC periodically reverses its flow direction enabling efficient high-voltage grid transmission, while DC flows unidirectionally to power electronic circuits and batteries.`,
      spokenScript: "The main difference between alternating current (AC) and direct current (DC) is that AC changes its direction and voltage periodically in a sinusoidal waveform, while DC flows steadily in one direction with constant polarity. AC is the worldwide standard for power grid transmission because transformers can easily step voltages up to hundreds of kilovolts to minimize I-squared-R transmission losses over long distances. In contrast, DC is required for semiconductor electronics, microprocessors, batteries, and solar photovoltaics.",
      bullets: [
        "Directionality: AC oscillates periodically (typically 50 Hz or 60 Hz); DC maintains constant unidirectional electron drift.",
        "Transmission Efficiency: AC voltages are easily transformed using electromagnetic mutual induction, enabling high-voltage, low-loss long-distance transmission.",
        "Energy Storage & Electronics: Batteries and electrochemical cells naturally store and discharge DC; digital logic ICs require stable DC voltages.",
        "Conversion Devices: Rectifiers convert AC to DC using diodes/filters; inverters convert DC to AC using switching circuits."
      ],
      tradeoffs: [
        "AC offers low-cost long-distance distribution via simple transformers, while DC provides constant voltage essential for electronic computing and removes capacitive line losses in undersea cables (HVDC)."
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // ELECTRICAL: KIRCHHOFF'S LAWS (KCL & KVL)
  // -------------------------------------------------------------
  if (p.includes('kirchhoff') || (p.includes('kcl') && p.includes('kvl'))) {
    return {
      id,
      question: prompt,
      mode: 'general',
      summary: "Kirchhoff's laws consist of Kirchhoff's Current Law (KCL), stating that the sum of currents entering a junction equals the sum leaving it, and Kirchhoff's Voltage Law (KVL), stating that the sum of electrical potential differences around any closed circuit loop is zero.",
      spokenScript: "Kirchhoff's laws form the mathematical backbone of electrical circuit analysis. Kirchhoff's Current Law, or KCL, is based on the conservation of electric charge: the total current entering an electrical junction or node must equal the total current exiting that junction. Kirchhoff's Voltage Law, or KVL, is based on the conservation of energy: the algebraic sum of all voltages around any closed circuit loop must equal zero. Together with Ohm's law, they enable solving nodal and mesh analysis for any linear electrical network.",
      bullets: [
        "Kirchhoff's Current Law (KCL): Σ I_in = Σ I_out at any circuit node, derived from the conservation of electric charge.",
        "Kirchhoff's Voltage Law (KVL): Σ V = 0 around any closed mesh or loop, derived from the conservation of energy in an electrostatic field.",
        "High-Frequency Limits: Valid in lumped-element circuit models where signal wavelength is significantly larger than physical circuit dimensions; Maxwell's equations take over at RF frequencies.",
        "Practical Engineering: Applied in nodal analysis, mesh current analysis, and power distribution network verification."
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // ELECTRONICS: MOSFET & DIODE
  // -------------------------------------------------------------
  if (p.includes('mosfet') || (p.includes('diode') && (p.includes('what') || p.includes('how') || p.includes('explain')))) {
    const isMosfet = p.includes('mosfet');
    return {
      id,
      question: prompt,
      mode: 'general',
      summary: isMosfet 
        ? "A MOSFET (Metal-Oxide-Semiconductor Field-Effect Transistor) is a four-terminal, voltage-controlled semiconductor device used to switch or amplify electronic signals."
        : "A diode is a two-terminal semiconductor device that allows electric current to flow predominantly in one direction while blocking it in the reverse direction.",
      spokenScript: isMosfet
        ? "A MOSFET is a voltage-controlled semiconductor transistor where the voltage applied to the gate terminal modulates the conductivity of an inverted channel between the source and drain terminals. Because the gate is electrically insulated by a microscopic silicon dioxide dielectric layer, the steady-state gate input current is virtually zero. This extremely high input impedance and fast switching capability make MOSFETs the foundational building block for modern CMOS digital processors and power converters."
        : "A diode is a fundamental two-terminal semiconductor component formed by a p-n junction. In forward bias, when the anode voltage exceeds the cathode by the forward threshold voltage (typically 0.7 volts for silicon), current flows freely with low resistance. In reverse bias, the depletion region widens, blocking current flow except for a negligible leakage current. In circuit engineering, diodes are extensively used for AC-to-DC rectification, flyback protection across inductive loads, and voltage regulation.",
      bullets: [
        isMosfet ? "Terminal Structure: Gate (G), Drain (D), Source (S), and Body/Substrate (B)." : "P-N Junction: Consists of P-type semiconductor with excess holes and N-type with excess electrons.",
        isMosfet ? "Voltage Control: Operates in Cutoff, Linear/Triode, and Saturation modes based on V_gs and V_ds." : "Forward & Reverse Bias: Conducts forward current at ~0.7V threshold; blocks reverse voltages up to the breakdown limit.",
        isMosfet ? "CMOS Logic: Complementary pairs of N-channel (NMOS) and P-channel (PMOS) transistors enable digital logic with near-zero static power draw." : "Practical Applications: Full-wave bridge rectifiers, Zener reference diodes, Schottky fast-recovery diodes, and transient voltage suppressors (TVS)."
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // MECHANICAL: BERNOULLI'S PRINCIPLE / EQUATION
  // -------------------------------------------------------------
  if (p.includes('bernoulli')) {
    return {
      id,
      question: prompt,
      mode: 'general',
      summary: "Bernoulli's principle states that for an inviscid, steady fluid flow along a streamline, an increase in fluid velocity occurs simultaneously with a decrease in static pressure or fluid potential energy.",
      spokenScript: "Bernoulli's principle expresses the conservation of mechanical energy in flowing fluids. It states that along a steady streamline, the sum of static pressure, dynamic pressure (one-half rho v-squared), and hydrostatic pressure (rho g h) remains constant. Consequently, wherever the fluid velocity increases — such as through a constriction in a pipe or over the curved upper surface of an airfoil — the static pressure proportionally decreases. In engineering, it explains the Venturi effect, flow meters, carburetors, and aerodynamic lift generation.",
      bullets: [
        "Governing Equation: P + 0.5 * ρ * v^2 + ρ * g * h = constant, where P is static pressure, ρ is density, v is velocity, and h is elevation.",
        "Assumptions & Boundary Conditions: Strictly applicable to steady, incompressible, frictionless (inviscid) flow along a single streamline.",
        "Venturi Effect: When cross-sectional area decreases in a pipe, velocity increases and static pressure drops, utilized in flow rate measurement (Venturi meters).",
        "Aerodynamic & Hydraulic Engineering: Governs pitot-static tube airspeed indicators, centrifugal pumps, and siphon hydraulics."
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // MECHANICAL: CARNOT CYCLE & THERMODYNAMICS
  // -------------------------------------------------------------
  if (p.includes('carnot') || (p.includes('thermodynamics') && (p.includes('second law') || p.includes('efficiency') || p.includes('cycle')))) {
    return {
      id,
      question: prompt,
      mode: 'general',
      summary: "The Carnot cycle is an idealized reversible thermodynamic cycle operating between two temperatures that sets the theoretical upper bound on thermal efficiency for any heat engine: η = 1 - (T_cold / T_hot).",
      spokenScript: "The Carnot cycle represents the absolute maximum efficiency that any thermodynamic heat engine can possibly achieve when operating between a high-temperature heat source and a low-temperature heat sink. It consists of four reversible processes: isothermal expansion, isentropic expansion, isothermal compression, and isentropic compression. In practice, no real-world engine can equal Carnot efficiency because real processes involve friction, turbulence, and non-isothermal heat transfer. However, Carnot's theorem gives engineers the fundamental benchmark to optimize steam turbines, internal combustion engines, and refrigeration heat pumps.",
      bullets: [
        "Carnot Efficiency Formula: η_max = 1 - (T_C / T_H), where temperatures T_C and T_H must be expressed in absolute Kelvin.",
        "Four Reversible Stages: 1) Reversible isothermal heat addition, 2) Reversible adiabatic/isentropic expansion, 3) Reversible isothermal heat rejection, 4) Reversible adiabatic/isentropic compression.",
        "Second Law of Thermodynamics: Clausius and Kelvin-Planck statements dictate that heat cannot spontaneously flow from colder to hotter bodies, and no engine can convert 100% of absorbed heat into mechanical work.",
        "Engineering Implication: Increasing turbine inlet temperature (T_H) and decreasing condenser temperature (T_C) directly increases thermodynamic efficiency."
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // MECHANICAL & CIVIL: STRESS VS STRAIN
  // -------------------------------------------------------------
  if ((p.includes('stress') && p.includes('strain')) || p.includes('young\'s modulus') || p.includes('youngs modulus')) {
    return {
      id,
      question: prompt,
      mode: 'general',
      summary: "The main difference is that stress is the internal restoring force exerted per unit area within a material (measured in Pascals), while strain is the resulting fractional deformation or dimensional change (a dimensionless ratio).",
      spokenScript: "In materials science and structural engineering, stress is the internal force per unit area that develops inside a material when an external load is applied, expressed in Pascals or Newtons per square meter. Strain is the physical geometric deformation that results from that stress, expressed as the ratio of change in length to the original length, making strain dimensionless. Within the linear elastic region, stress and strain are directly proportional according to Hooke's Law, where the constant of proportionality is Young's Modulus of elasticity.",
      bullets: [
        "Definitions: Stress (σ) = Force / Area (N/m² or Pa); Strain (ε) = ΔL / L_0 (dimensionless mm/mm).",
        "Hooke's Law & Elastic Modulus: σ = E * ε, where E is Young's Modulus, quantifying material stiffness.",
        "Stress-Strain Curve Regions: Linear elastic region, yield point (onset of permanent plastic deformation), ultimate tensile strength (UTS), and fracture point.",
        "Structural Safety: Structural engineers design beams and foundations with safety factors keeping working stresses well below the material's yield strength."
      ],
      tradeoffs: [
        "High-strength materials with high yield stress can bear immense loads but may exhibit brittle failure without warning, whereas ductile materials show observable necking before fracture."
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // CIVIL ENGINEERING: CONCRETE SLUMP TEST
  // -------------------------------------------------------------
  if (p.includes('slump test') || (p.includes('concrete') && p.includes('slump'))) {
    return {
      id,
      question: prompt,
      mode: 'general',
      summary: "The concrete slump test is an empirical field test that measures the consistency, workability, and fluidity of freshly mixed concrete before it is placed.",
      spokenScript: "The concrete slump test is a standard civil engineering quality-control procedure performed on site to verify the workability and water-cement consistency of a fresh batch of concrete. A standardized truncated metal cone (Abrams cone) is filled with fresh concrete in three tamped layers, leveled off, and carefully lifted vertically. The vertical subsidence or slump of the concrete mass is measured against the height of the cone. If the slump is too low, the concrete will be too stiff to pump or consolidate properly; if too high, excess water will cause segregation and significantly degrade cured compressive strength.",
      bullets: [
        "Testing Standard: Governed by ASTM C143 or EN 12350-2 using a 300 mm (12 in) tall hollow metal cone.",
        "Slump Profiles: True slump (uniform subsidence, good workability), Shear slump (one half shears off, indicating lack of cohesion), and Collapse slump (complete collapse, excessive water content).",
        "Water-Cement Ratio (w/c): Higher water content increases slump and pumpability, but dramatically lowers 28-day compressive strength and durability.",
        "Chemical Admixtures: Superplasticizers (high-range water reducers) increase slump for self-consolidating concrete without compromising water-cement ratio."
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // CYBERSECURITY: SQL INJECTION (SQLI)
  // -------------------------------------------------------------
  if (p.includes('sql injection') || p.includes('sqli')) {
    return {
      id,
      question: prompt,
      mode: 'general',
      summary: "SQL injection (SQLi) is a security vulnerability where untrusted user input is directly concatenated into a database query, allowing an attacker to manipulate SQL syntax, bypass authentication, and access or destroy backend data.",
      spokenScript: "SQL injection occurs when an application takes untrusted user input and concatenates it directly into an SQL command string instead of isolating data from executable code. Attackers exploit this by crafting malicious payloads containing SQL control characters — like single quotes, dashes for comments, or UNION SELECT statements — to alter query logic, dump password tables, or execute administrative commands. The definitive, production-standard mitigation is parameterized queries using PreparedStatement or ORM query binding, which separates SQL compilation from user arguments.",
      bullets: [
        "Vulnerability Mechanism: Occurs when user inputs are parsed as SQL syntax rather than treated purely as literal data parameters.",
        "SQLi Categories: In-band (Classic/UNION-based, Error-based), Inferential (Blind boolean-based, Blind time-based), and Out-of-band.",
        "Primary Defense: Parameterized queries (Prepared Statements in Java/JDBC, parameterized cursors in Python/Node.js).",
        "Defense-in-Depth: Principle of least privilege database accounts, stored procedures, Web Application Firewalls (WAF), and input validation."
      ],
      codeSnippet: {
        language: 'sql',
        code: `-- VULNERABLE: Direct string concatenation
SELECT * FROM users WHERE email = '` + prompt + `' AND password = '...';

-- SECURE: Parameterized Query
SELECT * FROM users WHERE email = ? AND password_hash = ?;`
      },
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // CYBERSECURITY: CROSS-SITE SCRIPTING (XSS)
  // -------------------------------------------------------------
  if (p.includes('xss') || p.includes('cross-site scripting')) {
    return {
      id,
      question: prompt,
      mode: 'general',
      summary: "Cross-Site Scripting (XSS) is a client-side security vulnerability that allows attackers to inject malicious scripts into trusted web pages, executing arbitrary code within the victim's browser session.",
      spokenScript: "Cross-Site Scripting, or XSS, occurs when a web application accepts untrusted data and includes it in web responses without contextual sanitization or output encoding. When the victim loads the page, their browser executes the injected JavaScript with full access to cookies, session tokens, and DOM data. We classify XSS into three main types: Stored XSS (persisted in database), Reflected XSS (bounced off an immediate URL parameter or form submission), and DOM-based XSS (executed via unsafe client JavaScript sinks like innerHTML). Production defenses center on context-aware HTML/JavaScript entity encoding, HTTP-only cookie flags, and enforcing a strict Content Security Policy (CSP).",
      bullets: [
        "Stored XSS: Malicious script is permanently stored on target servers (e.g. comment field, user profile) and served to all visiting users.",
        "Reflected XSS: Payload is delivered in a link or request and reflected immediately in the server response without storage.",
        "DOM-based XSS: Vulnerability exists entirely on the client side when untrusted source data (location.hash, location.search) reaches an unsafe sink (eval, innerHTML).",
        "Mitigation Architecture: Contextual HTML entity encoding, Content Security Policy (CSP), React/Vue automatic JSX escaping, and HttpOnly session cookies."
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // HR & BEHAVIORAL: GREATEST WEAKNESS
  // -------------------------------------------------------------
  if ((p.includes('weakness') || p.includes('greatest weakness')) && (p.includes('what') || p.includes('tell') || p.includes('your'))) {
    return {
      id,
      question: prompt,
      mode: 'behavioral',
      summary: "When answering the greatest weakness question, share an authentic, professional area of growth that does not compromise core job functions, and explain the concrete systems or habits you actively use to improve.",
      spokenScript: "My genuine area of growth has been delegating early when tackling complex engineering initiatives. Earlier in my career, my instinct was to solve challenging bottlenecks entirely by myself to ensure rapid delivery. Over time, I recognized that this created a personal bottleneck and limited team ownership. To actively manage this, I now establish clear task boundaries during sprint planning, assign modular subcomponents to peers with well-defined interface contracts, and schedule structured asynchronous checkpoints. This shift has not only improved our team velocity but has also freed me to focus on high-level architecture and cross-team alignment.",
      bullets: [
        "Authenticity & Self-Awareness: Select a real skill or habit rather than a disguised strength like 'I work too hard'.",
        "Proactive Mitigation: Frame the response around the specific process, tools, or checklists you instituted to overcome it.",
        "Professional Impact: Demonstrate that the mitigation has led to measurable team growth and improved operational outcomes."
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // HR & BEHAVIORAL: GREATEST STRENGTH
  // -------------------------------------------------------------
  if ((p.includes('strength') || p.includes('greatest strength')) && (p.includes('what') || p.includes('tell') || p.includes('your'))) {
    return {
      id,
      question: prompt,
      mode: 'behavioral',
      summary: "When answering the greatest strength question, highlight a key capability directly relevant to the role, backed by a concrete example illustrating your problem-solving process and measurable impact.",
      spokenScript: "My greatest strength is systematic technical problem-solving and root-cause debugging under pressure. When critical production issues or complex system failures occur, I remain calm, formulate testable hypotheses, and isolate the failure point using observability metrics, logs, and telemetry rather than guesswork. For instance, in a past initiative with severe latency spikes, I methodically isolated connection pool exhaustion in our downstream microservice and implemented connection reuse with backoff, reducing p99 latency by over 60%. I pair this analytical discipline with clear cross-functional communication so stakeholders always understand the technical trade-offs.",
      bullets: [
        "Relevance to Role: Align the strength with core technical, analytical, or leadership competencies.",
        "STAR Evidence: Support the claim with Situation, Task, Action, and quantifiable business or performance Results.",
        "Force Multiplier: Emphasize how the strength benefits peers and elevates overall team quality."
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // HR & BEHAVIORAL: TELL ME ABOUT YOURSELF
  // -------------------------------------------------------------
  if ((p.includes('tell me about yourself') || p.includes('introduce yourself') || p.includes('walk me through your resume')) && !p.includes('project')) {
    return {
      id,
      question: prompt,
      mode: 'behavioral',
      summary: "Structure your self-introduction into three crisp parts: your present role and expertise, a high-impact past achievement, and why you are excited about this specific opportunity.",
      spokenScript: "I am an engineer with a strong foundation in designing, implementing, and delivering reliable, high-performance systems. In my current work, I focus on building scalable architectures, streamlining core workflows, and resolving technical bottlenecks. A key highlight of my recent experience was leading the architecture of a high-throughput pipeline that improved system reliability and reduced latency by over 40%. What excites me most about this opportunity with your team is the chance to apply my deep problem-solving skills to your scale and collaborate with high-caliber peers on mission-critical challenges.",
      bullets: [
        "Present: Brief summary of your current title, core technical domain, and day-to-day focus.",
        "Past: One or two major quantifiable accomplishments that demonstrate ownership and technical depth.",
        "Future: A genuine, tailored connection explaining why this specific company and role are the ideal next step."
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // HR & BEHAVIORAL: CONFLICT RESOLUTION / DISAGREEMENT
  // -------------------------------------------------------------
  if (p.includes('conflict') || p.includes('disagreement') || (p.includes('disagree') && p.includes('team'))) {
    return {
      id,
      question: prompt,
      mode: 'behavioral',
      summary: "In behavioral conflict questions, demonstrate emotional intelligence, active listening, and an objective data-driven focus on team objectives rather than personal ego.",
      spokenScript: "Whenever I encounter technical disagreements or conflicts on a team, my principle is to separate people from the problem and focus strictly on shared goals and objective data. For example, during an architecture review, a colleague and I had opposing views on whether to use a relational database with read replicas or adopt a distributed NoSQL store. Instead of debating hypotheticals, I proposed building a lightweight benchmark comparing both on our anticipated write throughput and query latency. The benchmark demonstrated that PostgreSQL composite indexing satisfied our SLA with vastly lower operational complexity. By validating with empirical data, we reached full consensus and delivered the project on time.",
      bullets: [
        "Active Listening: Acknowledge the other party's perspective and core concerns respectfully.",
        "Objective Data: De-escalate emotional disputes by anchoring decisions to metrics, benchmarks, and project constraints.",
        "Collaborative Alignment: Demonstrate commitment to team velocity and unifying behind the chosen decision."
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // MATHEMATICS: FOURIER TRANSFORM
  // -------------------------------------------------------------
  if (p.includes('fourier transform') || (p.includes('fourier') && p.includes('transform'))) {
    return {
      id,
      question: prompt,
      mode: 'general',
      summary: "The Fourier transform is a mathematical operation that decomposes a time-domain or spatial-domain function into its constituent frequencies, transforming signals between the time domain and frequency domain.",
      spokenScript: "The Fourier transform is a fundamental mathematical and engineering tool that converts a time-domain signal into its frequency-domain representation. Instead of looking at how an amplitude varies over time, the Fourier transform reveals the exact sinusoidal frequency components, amplitudes, and phase angles that sum together to produce that signal. In computational engineering, the Fast Fourier Transform (FFT) computes this in O(N log N) time, making it the core algorithm powering digital signal processing (DSP), audio compression, telecommunications, image filtering, and vibration analysis.",
      bullets: [
        "Continuous Fourier Transform: F(ω) = ∫ f(t) e^(-i ω t) dt from -∞ to +∞.",
        "Time-Frequency Duality: Sharp spikes in the time domain correspond to wide spectra in the frequency domain, analogous to the Heisenberg uncertainty principle.",
        "Fast Fourier Transform (FFT): Cooley-Tukey algorithm slashes discrete computation from O(N^2) to O(N log N).",
        "Engineering Applications: Audio equalizers, MRI medical imaging, spectral analysis in acoustics, and 5G OFDM telecommunications."
      ],
      complexity: {
        time: 'O(N log N) via Fast Fourier Transform (FFT)',
        space: 'O(N) frequency bin array'
      },
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // MATHEMATICS: EULER'S FORMULA
  // -------------------------------------------------------------
  if (p.includes('euler') && (p.includes('formula') || p.includes('identity') || p.includes('equation'))) {
    return {
      id,
      question: prompt,
      mode: 'general',
      summary: "Euler's formula establishes the fundamental mathematical relationship between complex numbers and trigonometric functions: e^(i*θ) = cos(θ) + i*sin(θ), which produces Euler's identity e^(i*π) + 1 = 0 when θ = π.",
      spokenScript: "Euler's formula establishes a profound connection between exponential functions, trigonometry, and complex numbers: e to the power of i theta equals cosine theta plus i sine theta. In electrical engineering and physics, Euler's formula is indispensable because it enables phasor representation of alternating currents and sinusoidal waves: taking derivatives of exponentials is far simpler than manipulating sine and cosine trigonometric identities. When theta equals pi, it yields Euler's identity — e to the i pi plus one equals zero — which unites the five fundamental constants of mathematics.",
      bullets: [
        "Core Formula: e^(i θ) = cos(θ) + i * sin(θ), geometrically tracing the unit circle in the complex plane.",
        "Euler's Identity: e^(i π) + 1 = 0, connecting e, i, π, 1, and 0 in a single elegant equation.",
        "Phasor Analysis in EE: Converts linear differential equations in AC circuit analysis into straightforward algebraic equations in the complex frequency domain.",
        "Applications: Quantum mechanics wavefunctions, Fourier analysis, AC power systems, and signal modulation."
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 1A. JAVA: METHOD OVERLOADING VS METHOD OVERRIDING (DIFFERENCE)
  // -------------------------------------------------------------
  if (p.includes('overload') && p.includes('overrid')) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'The main difference is that method overloading is compile-time (static) polymorphism within the same class where methods share the same name with different parameter signatures, while method overriding is runtime (dynamic) polymorphism where a subclass redefines an inherited method using the exact same signature.',
      spokenScript: 'The main difference comes down to compile-time versus runtime polymorphism. In method overloading, multiple methods in the same class share the same name but have different parameter types or counts, resolved statically at compile time by the compiler. In method overriding, a subclass provides a specific implementation of a method already declared in its superclass using the exact same signature, resolved dynamically at runtime via the virtual method table (vtable). A common trap is trying to overload just by changing the return type, which Java rejects, whereas overriding requires identical or covariant return types.',
      bullets: [
        'Polymorphism Type: Method overloading is static (compile-time) polymorphism; method overriding is dynamic (runtime) polymorphism resolved by the JVM invokevirtual instruction.',
        'Scope & Inheritance: Overloading occurs within the same class (or across hierarchy); Overriding strictly requires an inheritance relationship between a superclass and a subclass.',
        'Method Signatures: Overloaded methods MUST have different parameter lists (count, types, or order); Overridden methods MUST have identical method names, parameter lists, and covariant return types.',
        'Access & Exceptions: Overriding cannot reduce access visibility (e.g. public cannot become protected) and cannot declare broader checked exceptions; Overloading has no such restrictions.',
        'Private / Static / Final: Private, static, and final methods can be overloaded, but cannot be overridden because they are resolved with static binding.'
      ],
      codeSnippet: {
        language: 'java',
        code: `// 1. Method Overloading (Compile-Time Polymorphism in same class)
class Calculator {
    int add(int a, int b) { return a + b; }
    double add(double a, double b) { return a + b; }
}

// 2. Method Overriding (Runtime Polymorphism across inheritance hierarchy)
class Animal {
    void makeSound() { System.out.println("Generic sound"); }
}

class Dog extends Animal {
    @Override
    void makeSound() { System.out.println("Woof! (Overridden at runtime)"); }
}

// Runtime dynamic dispatch via vtable:
Animal pet = new Dog();
pet.makeSound(); // Prints "Woof!" based on heap object type`
      },
      complexity: {
        time: 'Overloading: O(1) static compiler resolution; Overriding: O(1) vtable pointer dereference',
        space: 'O(1) auxiliary space'
      },
      tradeoffs: [
        'Overloading enhances API readability without runtime cost; Overriding enables flexible open-closed polymorphism but requires virtual method dispatch overhead.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 1. JAVA: METHOD OVERLOADING
  // -------------------------------------------------------------
  if (p.includes('overload')) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'Method overloading in Java is compile-time (static) polymorphism where multiple methods within the same class share the identical name but have different parameter lists (different count, types, or order of parameters).',
      spokenScript: 'In simple terms, method overloading is when you have multiple methods in the same class with the exact same name, but with different parameters — like changing the count or data types. A common interview trap is trying to overload just by changing the return type — Java won\'t compile that because the compiler resolves which method to run at compile time based purely on the arguments passed. In production code, I use it constantly to provide convenient API methods like calculateTotal(items) and calculateTotal(items, discountCode).',
      bullets: [
        'Signature Requirements: Overloaded methods must differ in parameter count, parameter data types, or sequence of types. Modifying only the return type, access modifier (e.g. public vs private), or throws clause does NOT overload a method and triggers a compile-time error.',
        'Compile-Time Resolution (Early Binding): The compiler determines the exact method to call at compile time based on the static declared type of arguments, encoding the exact signature into the class constant pool.',
        'Widening vs Autoboxing Precedence: Java resolves ambiguous overloaded calls with a strict priority order: 1) Exact match, 2) Primitive widening (e.g. int -> long), 3) Autoboxing (e.g. int -> Integer), 4) Varargs (e.g. int...). Primitive widening always takes precedence over autoboxing.',
        'Overloading vs Overriding: Overloading happens in the same class at compile-time with different arguments; Overriding happens in a subclass at runtime with the identical signature using dynamic dispatch (vtable).'
      ],
      codeSnippet: {
        language: 'java',
        code: `public class Calculator {
    // 1. Overload by parameter count
    public int add(int a, int b) {
        return a + b;
    }
    public int add(int a, int b, int c) {
        return a + b + c;
    }

    // 2. Overload by parameter data type
    public double add(double a, double b) {
        return a + b;
    }

    // 3. Overload by parameter sequence
    public void print(String label, int value) {
        System.out.println(label + ": " + value);
    }
    public void print(int value, String label) {
        System.out.println(value + " " + label);
    }

    // COMPILE ERROR: Changing return type alone is NOT valid overloading!
    // public double add(int a, int b) { return (double)(a + b); }
}`
      },
      complexity: {
        time: 'O(1) dispatch at runtime; resolved completely at compile-time with zero virtual table overhead',
        space: 'O(1) memory footprint'
      },
      tradeoffs: [
        'Readability vs Ambiguity: Improves API consistency (e.g. Math.max for int, long, double) but overloading with varargs or null parameters can cause ambiguous invocation compiler errors.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 2. JAVA: METHOD OVERRIDING & POLYMORPHISM
  // -------------------------------------------------------------
  if (p.includes('overrid') || p.includes('polymorphism')) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'Method overriding in Java is runtime (dynamic) polymorphism where a subclass provides its own specific implementation of a method that is already defined in its superclass, resolved via the virtual method table (vtable).',
      spokenScript: 'Method overriding is dynamic runtime polymorphism. In plain English, a child class replaces the behavior of a method it inherited from its parent. The method name, return type, and arguments must match. The key technical detail interviewers look for is dynamic dispatch: Java uses the vtable to figure out the actual runtime object on the heap, not the reference type. I always annotate with @Override so the compiler catches any signature mistakes right away.',
      bullets: [
        'Signature Identity: Overriding methods must have the exact same name, return type (or covariant subtype), and parameter list as the superclass method.',
        'Rules: Subclass method cannot have more restrictive access (e.g. public in parent cannot become private in child). Subclass cannot declare broader checked exceptions.',
        'Dynamic Method Dispatch: Resolved at runtime based on the actual object instance type in heap memory using the invokevirtual JVM instruction.',
        '@Override Annotation: Best practice; tells the compiler to verify that the method actually overrides a superclass method, catching accidental typo bugs.'
      ],
      codeSnippet: {
        language: 'java',
        code: `class Animal {
    public void makeSound() {
        System.out.println("Generic animal sound");
    }
}

class Dog extends Animal {
    @Override // Enforces compile-time signature verification
    public void makeSound() {
        System.out.println("Woof! (Overridden at runtime)");
    }
}

// Runtime dynamic dispatch:
Animal myPet = new Dog(); // Polymorphic reference
myPet.makeSound(); // Prints "Woof!" via vtable lookup`
      },
      complexity: {
        time: 'O(1) vtable indirect pointer dereference at runtime',
        space: 'O(1) auxiliary space'
      },
      tradeoffs: [
        'Runtime Polymorphism allows open-closed extensibility, but incurs minor vtable cache-miss overhead compared to inlined static methods.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 3. JAVA: INTERFACE VS ABSTRACT CLASS
  // -------------------------------------------------------------
  if (p.includes('abstract') || (p.includes('interface') && p.includes('class'))) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'An abstract class is an incomplete class that can hold state (instance fields), constructors, and partial implementations, supporting single inheritance. An interface defines a contract of behavior supporting multiple inheritance and static/default methods.',
      spokenScript: 'My mental model is simple: Use an abstract class when classes have an "is-a" relationship and need to share internal state, like instance variables or constructors. Use an interface when you want to define a contract of "can-do" capabilities across completely different classes — like Comparable or Runnable. A Java class can only extend one abstract class, but it can implement as many interfaces as it needs. Also remember Java 8 added default methods and Java 9 added private methods inside interfaces.',
      bullets: [
        'Multiple Inheritance: A Java class can implement multiple interfaces, but can extend only one abstract class.',
        'State and Fields: Abstract classes can have instance variables (mutable state) and constructors; interfaces can only have public static final constants.',
        'Default & Static Methods (Java 8+): Interfaces can provide default implementations using default keyword and static helper methods.',
        'Private Methods (Java 9+): Interfaces can have private helper methods to encapsulate repeated default method logic.',
        'Design Heuristic: Use an Abstract Class for an "is-a" relationship sharing internal state; use an Interface for a "can-do" peripheral capability (e.g. Comparable, Runnable).'
      ],
      codeSnippet: {
        language: 'java',
        code: `// 1. Abstract class for core identity & shared state
abstract class BaseVehicle {
    protected int speed; // State
    public BaseVehicle(int speed) { this.speed = speed; }
    abstract void accelerate(); // Must be implemented by child
}

// 2. Interface for capabilities
interface ElectricPowered {
    void chargeBattery();
    default void status() { System.out.println("Battery Ready"); }
}

// Subclass extends one abstract class and implements interfaces
class TeslaModel3 extends BaseVehicle implements ElectricPowered {
    public TeslaModel3() { super(0); }
    public void accelerate() { speed += 15; }
    public void chargeBattery() { System.out.println("Charging Supercharger..."); }
}`
      },
      complexity: {
        time: 'O(1) method invocation',
        space: 'O(1) memory overhead'
      },
      tradeoffs: [
        'Interfaces provide maximum loose coupling; Abstract classes provide code reuse of shared mutable fields and constructors.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 3b. JAVA: JVM MEMORY MODEL & GARBAGE COLLECTION
  // -------------------------------------------------------------
  if (p.includes('garbage') || p.includes('jvm') || p.includes('metaspace') || (p.includes('java') && p.includes('memory'))) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'JVM memory divides into Thread-Shared areas (Heap and Metaspace) and Thread-Private areas (Stack, PC Registers, Native Method Stacks). Garbage Collection automatically reclaims unreferenced heap objects via generational collectors.',
      spokenScript: 'The way I break down JVM memory in production is: The Stack is private to each thread and stores primitive local variables and reference pointers. The Heap is shared by all threads and holds all actual instantiated objects. Garbage collection scans the heap to clean up unreferenced objects. Modern collectors like G1 and ZGC partition the heap into regions so they can hit tight pause-time targets like sub-millisecond pauses on large multi-gigabyte heaps.',
      bullets: [
        'Heap Generations: Young Generation (Eden + Survivor spaces S0/S1) holds short-lived objects collected via fast Minor GC; Old/Tenured Generation holds surviving long-lived objects collected via Major/Full GC.',
        'Metaspace (Java 8+): Replaced PermGen. Stored in native OS memory (not heap) to prevent java.lang.OutOfMemoryError: PermGen space, holding class metadata, method bytecode, and static references.',
        'Stack vs Heap: Stack stores primitive local variables and object reference pointers (LIFO per thread); Heap stores all instantiated objects dynamic memory.',
        'GC Collectors: G1 GC (Garbage-First) partitions heap into equal regions for predictable low latency (<200ms pause target); ZGC / Shenandoah achieve sub-millisecond pauses on terabyte heaps using concurrent colored pointers.'
      ],
      codeSnippet: {
        language: 'java',
        code: `// JVM Memory Tuning Flags:
// -Xms4g -Xmx4g               // Fixed Heap size (avoids runtime resizing)
// -XX:+UseG1GC                // Use Garbage-First Collector
// -XX:MaxGCPauseMillis=200    // Soft target latency bound
// -XX:MetaspaceSize=256m      // Initial Metaspace allocation

public class MemoryDemo {
    public static void main(String[] args) {
        int localId = 42; // Allocated on the Thread's Stack frame
        String label = new String("Java Memory"); // Reference on Stack -> Object on Heap
    }
}`
      },
      complexity: {
        time: 'Allocation is O(1) via TLAB (Thread-Local Allocation Buffers); GC pause bound by collector algorithm',
        space: 'Heap bounded by -Xmx; Native OS memory bounded by physical RAM'
      },
      tradeoffs: [
        'Throughput vs Latency: Parallel GC maximizes raw batch throughput; G1 and ZGC trade slight CPU overhead for low, deterministic stop-the-world pause times.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 3c. JAVA: MULTITHREADING, SYNCHRONIZED & VOLATILE
  // -------------------------------------------------------------
  if (p.includes('synchronized') || p.includes('volatile') || p.includes('deadlock') || (p.includes('thread') && p.includes('java'))) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'Thread safety in Java requires managing mutual exclusion and visibility. synchronized provides both mutual exclusion and memory barriers; volatile provides visibility and ordering without locking.',
      spokenScript: 'When handling concurrency in Java, there are two separate problems: memory visibility and mutual exclusion. I use volatile when I just need visibility — it forces CPU caches to flush directly to main memory so other threads always see the latest write, but it does NOT make compound operations like count++ atomic. When I need mutual exclusion to prevent two threads from modifying state at the same time, I use synchronized blocks or ReentrantLock to acquire a monitor lock.',
      bullets: [
        'volatile Keyword: Guarantees reads/writes flush directly to main memory (preventing CPU L1/L2 cache staleness) and prevents instruction reordering via memory barriers. It does NOT guarantee atomicity for compound operations like count++.',
        'synchronized: Acquires an intrinsic lock (monitor) on the target object. Ensures mutual exclusion (only 1 thread executes the block) AND establishes a happens-before relationship for memory visibility.',
        'Lock Upgrades (JVM Biased -> Thin -> Fat): JVM monitors start as Biased locks (single thread), upgrade to Lightweight CAS spinlocks under mild contention, and inflate to Heavyweight OS mutexes under high contention.',
        'Deadlock Prevention: Deadlocks occur when 4 Coffman conditions hold (Mutual Exclusion, Hold & Wait, No Preemption, Circular Wait). Prevent them by enforcing a global, strict lock-ordering hierarchy or using tryLock() with timeouts.'
      ],
      codeSnippet: {
        language: 'java',
        code: `public class ThreadSafeCounter {
    private volatile boolean isRunning = true;
    private int count = 0;
    private final Object lock = new Object();

    public void increment() {
        synchronized (lock) { // Acquires object monitor
            count++; // Atomic read-modify-write within monitor
        }
    }

    public int getCount() {
        synchronized (lock) {
            return count;
        }
    }
}`
      },
      complexity: {
        time: 'Uncontended biased lock is ~1ns; contested OS mutex can take ~1-5 microseconds context-switch latency',
        space: 'O(1) memory'
      },
      tradeoffs: [
        'Coarse vs Fine Locking: Synchronizing whole methods reduces code complexity but hurts multi-core throughput; ReentrantLock and Concurrent structures improve scalability at the cost of design care.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 3d. JAVA: STRING IMMUTABILITY & STRING POOL
  // -------------------------------------------------------------
  if (p.includes('string pool') || (p.includes('string') && p.includes('immutab')) || p.includes('stringbuilder')) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'Strings in Java are immutable objects backed by final byte[] arrays. String literals are cached in the String Constant Pool in the Heap to save memory, enabling safe multi-threaded sharing and hash code caching.',
      spokenScript: 'Strings in Java are completely immutable — once created, their underlying byte array cannot be changed. Java does this for security, thread safety, and so hash codes can be cached for HashMap efficiency. Because they never change, Java stores literal strings in the String Constant Pool to save memory. That is why literal comparisons with == are true, but new String() allocates a new object. For string concatenation inside loops, I always use StringBuilder to prevent creating thousands of short-lived garbage objects.',
      bullets: [
        'Immutability: The String class is marked final and its underlying character/byte array cannot be modified after construction. Any modification creates a brand new String object.',
        'String Constant Pool: A special hashtable in heap memory. String s = "abc" reuses an existing "abc" pool instance, whereas new String("abc") explicitly allocates a separate instance on heap.',
        'Security & Hash Caching: Because Strings are immutable, their hashCode is lazily computed once and cached (crucial for HashMap performance), and they can safely carry database passwords and network endpoints without tampering.',
        'StringBuilder vs StringBuffer: StringBuilder is non-synchronized and fast (best for single-threaded loop concatenation); StringBuffer has synchronized methods for thread safety.'
      ],
      codeSnippet: {
        language: 'java',
        code: `String s1 = "interview"; // Cached in String Constant Pool
String s2 = "interview"; // Reuses exact same pool reference
String s3 = new String("interview"); // New heap object

System.out.println(s1 == s2);      // TRUE (identical memory address)
System.out.println(s1 == s3);      // FALSE (different heap pointers)
System.out.println(s1.equals(s3));  // TRUE (value contents match)

// Efficient Concatenation in Loops:
StringBuilder sb = new StringBuilder();
for (int i = 0; i < 1000; i++) {
    sb.append(i).append(","); // O(1) amortized append, no orphan objects
}
String result = sb.toString();`
      },
      complexity: {
        time: 's1 == s2 reference equality is O(1); equals() is O(N) where N is character length',
        space: 'Pool deduplication reduces memory from O(N * instances) to O(N)'
      },
      tradeoffs: [
        'Immutability ensures zero synchronization overhead when sharing Strings across threads, but naive concatenation (str += "x") inside loops produces O(N²) garbage allocations.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 4. POSTGRESQL / DATABASE: B-TREE VS GIN INDEXING
  // -------------------------------------------------------------
  if (p.includes('gin') || p.includes('b-tree') || p.includes('btree') || (p.includes('postgres') && p.includes('index')) || (p.includes('database') && p.includes('index'))) {
    return {
      id,
      question: prompt,
      mode: 'system_design',
      summary: 'B-Tree is the default index optimized for scalar equality and range queries on sorted data; GIN (Generalized Inverted Index) is designed for multi-key composite structures like JSONB, arrays, and full-text search.',
      bullets: [
        'B-Tree (Balanced Tree): Best for scalar data with standard comparison operators (<, <=, =, >=, >, BETWEEN). Offers blazing-fast O(log N) lookups with minimal write/update overhead.',
        'GIN (Generalized Inverted Index): An inverted index that maps individual elements (words, keys, array items) to the list of heap rows (TIDs) containing them. Ideal for full-text search (tsvector @@ tsquery), array containment (&&, @>), and JSONB queries (@>).',
        'Write Amplification Trade-off: GIN indexes are substantially slower on writes/inserts than B-Trees because a single inserted row updates multiple entries in the GIN tree (mitigated by fastupdate=on pending lists).',
        'Index Size: GIN indexes can grow very large; for continuous sequential timestamps or append-only tables, B-Tree or BRIN (Block Range Index) is vastly superior.',
        'Practical Rule of Thumb: Use B-Tree for primary keys, foreign keys, timestamps, and numeric IDs; use GIN for tagging systems, unstructured JSONB documents, and search fields.'
      ],
      codeSnippet: {
        language: 'sql',
        code: `-- 1. B-Tree: Ideal for equality and range filtering on scalar columns
CREATE INDEX idx_orders_created_at ON orders USING btree (created_at DESC);
-- Query: SELECT * FROM orders WHERE created_at >= NOW() - INTERVAL '7 days';

-- 2. GIN: Ideal for searching inside arrays or JSONB documents
CREATE INDEX idx_products_tags ON products USING gin (tags);
-- Query: SELECT * FROM products WHERE tags @> ARRAY['electronics', 'sale'];

-- 3. GIN with jsonb_path_ops: 3x smaller & faster for JSONB containment
CREATE INDEX idx_users_metadata ON users USING gin (metadata jsonb_path_ops);
-- Query: SELECT * FROM users WHERE metadata @> '{"role": "admin", "active": true}';`
      },
      complexity: {
        time: 'B-Tree: O(log N) lookup; GIN: O(K log N) where K is number of search tokens',
        space: 'B-Tree: Compact O(N); GIN: O(N * M) where M is average tokens per row'
      },
      tradeoffs: [
        'Read Latency vs Write Throughput: GIN achieves sub-5ms multi-token lookups but imposes up to 5x-10x slower write amplification compared to B-Tree.',
        'Memory Footprint: B-Tree easily fits in shared_buffers cache; GIN requires careful maintenance_work_mem sizing during VACUUM reindexing.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 5. DISTRIBUTED SYSTEMS: RATE LIMITING
  // -------------------------------------------------------------
  if (p.includes('rate limit') || p.includes('token bucket') || p.includes('sliding window')) {
    return {
      id,
      question: prompt,
      mode: 'system_design',
      summary: 'Implement a distributed sliding window counter rate limiter using Redis Clusters with atomic Lua scripts or local edge token buckets.',
      bullets: [
        'Algorithm Choice: Sliding Window Counter provides high accuracy and eliminates boundary burst vulnerabilities present in Fixed Window counters.',
        'Atomic Storage: Execute sliding log increments inside a single Redis Lua script to guarantee atomicity and avoid race conditions between GET and INCR.',
        'Multi-Region Scaling: Avoid cross-region Redis round-trips by running local edge proxies that sync batch quotas asynchronously every 500ms.',
        'HTTP Headers: Return standard RFC rate limit headers: X-RateLimit-Limit, X-RateLimit-Remaining, and Retry-After.'
      ],
      codeSnippet: {
        language: 'lua',
        code: `-- Atomic Sliding Window Rate Limiter Lua Script in Redis
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local clearBefore = now - window

redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)
local current = redis.call('ZCARD', key)

if current < limit then
    redis.call('ZADD', key, now, now)
    redis.call('EXPIRE', key, math.ceil(window / 1000))
    return {1, limit - current - 1} -- Allowed
else
    return {0, 0} -- Rejected (HTTP 429)
end`
      },
      complexity: {
        time: 'O(log M) where M is number of requests in current window',
        space: 'O(M) memory per tracked client IP or API key'
      },
      tradeoffs: [
        'Strict Accuracy vs Latency: Redis ZSET requires O(M) memory; for ultra-high QPS, use approximated Token Bucket using just two integers in memory.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 6. DATA STRUCTURES: LRU CACHE
  // -------------------------------------------------------------
  if (p.includes('lru') || (p.includes('cache') && p.includes('least recently'))) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'Combine a Hash Map with a Doubly Linked List to achieve strict O(1) time complexity for both get(key) and put(key, value).',
      bullets: [
        'Hash Map: Maps key -> Doubly Linked List node reference for O(1) instantaneous lookup.',
        'Doubly Linked List: Maintains usage ordering. Head stores the most recently used (MRU) node; tail stores the least recently used (LRU) node.',
        'Sentinel Nodes: Use dummy head and dummy tail nodes to eliminate edge-case null pointer checks during node detachment and insertion.',
        'Eviction: When size exceeds capacity, remove the node at tail.prev from both the linked list and the Hash Map.'
      ],
      codeSnippet: {
        language: 'typescript',
        code: `class DNode {
  key: number; val: number;
  prev: DNode | null = null;
  next: DNode | null = null;
  constructor(k: number, v: number) { this.key = k; this.val = v; }
}

class LRUCache {
  private cap: number;
  private map = new Map<number, DNode>();
  private head = new DNode(0, 0);
  private tail = new DNode(0, 0);

  constructor(capacity: number) {
    this.cap = capacity;
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  get(key: number): number {
    const node = this.map.get(key);
    if (!node) return -1;
    this.moveToHead(node);
    return node.val;
  }

  put(key: number, val: number): void {
    const node = this.map.get(key);
    if (node) {
      node.val = val;
      this.moveToHead(node);
    } else {
      const newNode = new DNode(key, val);
      this.map.set(key, newNode);
      this.addNode(newNode);
      if (this.map.size > this.cap) {
        const lru = this.tail.prev!;
        this.removeNode(lru);
        this.map.delete(lru.key);
      }
    }
  }

  private addNode(n: DNode) {
    n.prev = this.head; n.next = this.head.next;
    this.head.next!.prev = n; this.head.next = n;
  }
  private removeNode(n: DNode) {
    n.prev!.next = n.next; n.next!.prev = n.prev;
  }
  private moveToHead(n: DNode) {
    this.removeNode(n); this.addNode(n);
  }
}`
      },
      complexity: {
        time: 'O(1) strictly for get and put',
        space: 'O(capacity) auxiliary memory for Map and DNode objects'
      },
      tradeoffs: [
        'Time vs Space: Doubly linked list nodes consume 2 extra memory pointers per entry, but eliminate O(N) linear shifts.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 7. JAVA: CONCURRENTHASHMAP & CONCURRENCY
  // -------------------------------------------------------------
  if (p.includes('concurrenthashmap') || (p.includes('java') && p.includes('hashmap'))) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'Java 8+ ConcurrentHashMap utilizes lock-free CAS (Compare-And-Swap) for empty bucket heads and synchronizes solely on individual bucket heads, converting bins to Red-Black trees at threshold 8.',
      bullets: [
        'Evolution from Java 7: Java 7 used 16 Segment locks; Java 8 removed segments in favor of fine-grained node-level synchronization.',
        'Lock-free Insert: If bucket is empty, it inserts via CAS (Unsafe / VarHandle) with zero lock overhead.',
        'Node-level Locking: Collisions synchronize solely on the individual head node of that bucket, leaving all other buckets accessible to concurrent threads.',
        'Treeification: Linked lists convert to balanced Red-Black trees (TreeNode) when bin items >= 8 and table capacity >= 64, keeping search worst-case O(log N).',
        'Reads: get() operations are completely lock-free via volatile value and next pointers.'
      ],
      codeSnippet: {
        language: 'java',
        code: `// Conceptual Java 8+ ConcurrentHashMap insert logic
if ((f = tabAt(tab, i = (n - 1) & hash)) == null) {
    // Lock-free CAS insert into empty bin
    if (casTabAt(tab, i, null, new Node<K,V>(hash, key, value)))
        break;
} else {
    // Synchronize ONLY on head node 'f' of the specific bucket
    synchronized (f) {
        if (tabAt(tab, i) == f) {
            // Traverse list or insert into TreeBin (Red-Black tree)
        }
    }
}`
      },
      complexity: {
        time: 'O(1) average lookup/insert; O(log N) worst-case with collisions',
        space: 'O(N) with minimal thread contention metadata'
      },
      tradeoffs: [
        'Complexity vs Concurrency: Highly complex treeification and resizing, but scales linearly across hundreds of CPU cores.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 8. JAVASCRIPT & FRONTEND ECOSYSTEM
  // -------------------------------------------------------------
  if (p.includes('javascript') || /\bjs\b/i.test(prompt) || p.includes('closure') || p.includes('hoist') || p.includes('event loop')) {
    // 8a. Closures
    if (p.includes('closure')) {
      return {
        id,
        question: prompt,
        mode: 'coding',
        summary: 'A closure is the combination of a function bundled together with references to its surrounding lexical environment, allowing an inner function to retain access to outer variables even after the outer function has returned.',
        spokenScript: 'A closure happens when an inner function remembers and accesses variables from its outer enclosing scope, even after that parent function has finished executing. In production JavaScript, we use closures every day for data privacy — creating private state without classes — as well as in factory functions, debounce handlers, and event listeners. The runtime retains the lexical scope in heap memory as long as the inner function is referenced.',
        bullets: [
          'Lexical Scoping: JavaScript determines variable scope based on where functions are declared in source code, not where they are called.',
          'Data Encapsulation: Functions can expose methods that access encapsulated private variables, preventing external tampering.',
          'Memory Consideration: Variables captured in closures are not garbage-collected as long as the closure function remains reachable, which can cause memory leaks if attached to long-lived event listeners.',
          'Common Use Cases: Function currying, memoization, debounce/throttle utilities, and React custom hooks.'
        ],
        codeSnippet: {
          language: 'javascript',
          code: `function createBankAccount(initialBalance) {
  let balance = initialBalance; // Private variable encapsulated in closure

  return {
    deposit: (amount) => {
      balance += amount;
      return balance;
    },
    getBalance: () => balance // Retains access to 'balance'
  };
}

const account = createBankAccount(100);
console.log(account.deposit(50)); // 150
console.log(account.balance);     // undefined (Private!)`
        },
        complexity: {
          time: 'O(1) variable resolution up the scope chain',
          space: 'O(1) to O(V) heap memory for captured lexical scope'
        },
        tradeoffs: [
          'Encapsulation vs Memory: Provides clean private variables, but holding references in global closures prevents garbage collection.'
        ],
        timestamp: now
      };
    }

    // 8b. Hoisting
    if (p.includes('hoist')) {
      return {
        id,
        question: prompt,
        mode: 'coding',
        summary: 'Hoisting is JavaScript\'s compilation-phase behavior where variable and function declarations are allocated in memory before code execution. var is initialized to undefined; let and const are hoisted into the Temporal Dead Zone (TDZ).',
        spokenScript: 'Hoisting is often described as moving declarations to the top of the file, but under the hood, the JavaScript engine allocates memory for declarations during the compilation phase before running any code. Function declarations are fully hoisted with their body. Variables declared with var are hoisted and initialized to undefined. Variables declared with let and const are also hoisted, but placed in the Temporal Dead Zone — so accessing them before their declaration line throws a ReferenceError.',
        bullets: [
          'Function Declarations: Fully hoisted. You can call function foo() {} before its definition in the code.',
          'var Declarations: Hoisted and initialized with undefined. Accessing before declaration returns undefined, not a crash.',
          'let and const (TDZ): Hoisted into the Temporal Dead Zone. Accessing before assignment triggers a ReferenceError.',
          'Best Practice: Always use const by default and let when re-assignment is needed; avoid var to eliminate hoisting bugs.'
        ],
        codeSnippet: {
          language: 'javascript',
          code: `// Function declaration: Fully hoisted
greet(); // Works! Prints "Hello"
function greet() { console.log('Hello'); }

// var: Hoisted with undefined
console.log(a); // undefined (No crash)
var a = 10;

// let/const: Temporal Dead Zone (TDZ)
// console.log(b); // Throws ReferenceError: Cannot access 'b' before initialization
let b = 20;`
        },
        complexity: {
          time: 'O(1) compilation symbol table allocation',
          space: 'O(1) memory overhead'
        },
        timestamp: now
      };
    }

    // 8c. Event Loop & Asynchronous JS
    if (p.includes('event loop') || p.includes('microtask') || p.includes('macrotask')) {
      return {
        id,
        question: prompt,
        mode: 'coding',
        summary: 'The JavaScript Event Loop orchestrates single-threaded non-blocking execution by prioritizing synchronous Call Stack frames, then draining the entire Microtask Queue (Promises, queueMicrotask), and finally executing Macrotasks (setTimeout, setInterval, I/O).',
        spokenScript: 'JavaScript is single-threaded, meaning it has only one Call Stack executing code. To handle non-blocking asynchronous operations like network requests or timers, it relies on the Event Loop. When an async task finishes, its callback goes to a queue. The Event Loop prioritizes the Microtask queue — which handles Promises — and completely empties it before processing any Macrotask like setTimeout or DOM rendering. This is why Promise callbacks always fire before setTimeout(..., 0).',
        bullets: [
          'Call Stack: Synchronous execution frame; functions push on invocation and pop on return (LIFO).',
          'Microtask Queue (High Priority): Promise.then, queueMicrotask, MutationObserver. The engine drains the ENTIRE microtask queue before rendering or touching macrotasks.',
          'Macrotask Queue (Task Queue): setTimeout, setInterval, setImmediate, I/O events. Exactly ONE macrotask is processed per loop turn before checking microtasks again.',
          'Starvation Risk: An infinite loop of Promise.resolve().then(...) starves macrotasks and completely freezes UI rendering.'
        ],
        codeSnippet: {
          language: 'javascript',
          code: `console.log('1: Sync');

setTimeout(() => console.log('4: Macrotask (setTimeout)'), 0);

Promise.resolve().then(() => console.log('3: Microtask (Promise)'));

console.log('2: Sync');

// Execution Order:
// 1: Sync -> 2: Sync -> 3: Microtask (Promise) -> 4: Macrotask (setTimeout)`
        },
        complexity: {
          time: 'O(1) queue shift per dispatch',
          space: 'O(N) memory for callback queue frames'
        },
        tradeoffs: [
          'Single-threaded execution eliminates thread race conditions and deadlocks, but CPU-heavy synchronous calculations lock the UI unless offloaded to Web Workers.'
        ],
        timestamp: now
      };
    }

    // 8d. General JavaScript Definition & Overview
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'JavaScript is a high-level, single-threaded, dynamically-typed, JIT-compiled programming language that powers interactive web clients, modern SPAs, and server-side runtimes via Node.js and Bun.',
      spokenScript: 'JavaScript is a high-level, single-threaded, dynamically-typed programming language that serves as the core scripting language of the web. Under the hood, engines like Google Chrome\'s V8 compile it directly to machine code using Just-In-Time (JIT) compilation with Ignition and TurboFan. Even though it runs on a single main thread, it achieves non-blocking asynchronous concurrency using an Event Loop with a Call Stack, Microtasks for Promises, and Macrotasks for I/O. Today, via runtimes like Node.js and Bun, it powers both frontend browser UIs and backend distributed services.',
      bullets: [
        'V8 Engine Architecture: Modern JS engines execute code using a multi-tier pipeline: an interpreter (Ignition) for instant startup, and an optimizing JIT compiler (TurboFan) that optimizes hot code into native assembly.',
        'Concurrency & Event Loop: Single-threaded with non-blocking I/O. The Call Stack executes synchronous code, while asynchronous callbacks queue into Microtask (Promises) and Macrotask (setTimeout/fetch) queues.',
        'First-Class Functions: Functions are treated as first-class citizens — they can be stored in variables, passed as arguments, returned from other functions, and form closures.',
        'Prototype-based Inheritance: Objects inherit properties directly from other objects via the prototype chain (__proto__), rather than classical class blueprints.',
        'Cross-Platform Ecosystem: Standardized under ECMAScript (ES6+), running client-side in all browsers and server-side in Node.js, Deno, and Bun.'
      ],
      codeSnippet: {
        language: 'javascript',
        code: `// 1. Closures & First-Class Functions
const createMultiplier = (factor) => (value) => value * factor;
const double = createMultiplier(2);
console.log(double(5)); // 10

// 2. Non-blocking Async/Await
async function fetchUserData(userId) {
  try {
    const res = await fetch(\`/api/users/\${userId}\`);
    if (!res.ok) throw new Error('Network error');
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Fetch failed:', err);
  }
}`
      },
      complexity: {
        time: 'O(1) execution for compiled hot paths via TurboFan JIT',
        space: 'Managed dynamic heap memory with generational Mark-and-Sweep Garbage Collection'
      },
      tradeoffs: [
        'Dynamic typing enables high developer velocity and rapid prototyping, but can allow runtime type errors without TypeScript. Single-threaded model avoids locks, but requires Web Workers for heavy CPU math.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 9. REACT & FRONTEND FRAMEWORKS
  // -------------------------------------------------------------
  if (p.includes('react') || p.includes('virtual dom') || p.includes('useeffect') || p.includes('usestate')) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'React is a declarative, component-based JavaScript library for building user interfaces, utilizing a Virtual DOM and the Fiber reconciliation algorithm for high-performance selective rendering.',
      spokenScript: 'React is a component-based UI library based on declarative programming: you describe what the UI should look like for a given state, and React handles the DOM updates. Its core performance mechanism is the Virtual DOM and the Fiber reconciler. When state changes, React creates a new lightweight virtual tree, diffs it against the previous fiber tree using heuristic O(N) reconciliation, and commits only the minimal changed nodes to the real DOM. With React Hooks like useState and useEffect, we build clean functional components with predictable side-effect lifecycles.',
      bullets: [
        'Virtual DOM & Fiber Reconciler: React maintains an in-memory virtual representation of the DOM. It splits rendering work into incremental chunks that can be paused, prioritized, or aborted.',
        'Unidirectional Data Flow: Data flows strictly downward from parent to child via props, making application state changes predictable and easy to debug.',
        'React Hooks: Introduced in 16.8, hooks like useState, useEffect, useMemo, and useCallback allow functional components to manage local state, memoization, and side effects without classes.',
        'Server Components (RSC): Modern React renders components on the server without sending JavaScript bundle weight to the client, drastically improving initial page load.'
      ],
      codeSnippet: {
        language: 'typescript',
        code: `import React, { useState, useEffect } from 'react';

interface UserProfileProps {
  userId: string;
}

export function UserProfile({ userId }: UserProfileProps) {
  const [user, setUser] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isSubscribed = true;
    setLoading(true);

    fetch(\`/api/users/\${userId}\`)
      .then(r => r.json())
      .then(data => { if (isSubscribed) setUser(data); })
      .finally(() => { if (isSubscribed) setLoading(false); });

    return () => { isSubscribed = false; }; // Cleanup prevents race conditions
  }, [userId]);

  if (loading) return <div>Loading user...</div>;
  return <div>Hello, {user?.name}</div>;
}`
      },
      complexity: {
        time: 'O(N) reconciliation diffing heuristic instead of O(N³) tree diff algorithm',
        space: 'O(N) memory for Fiber node trees'
      },
      tradeoffs: [
        'Virtual DOM abstraction adds slight memory overhead and re-render management complexity, but eliminates expensive manual direct DOM operations.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 10. TYPESCRIPT: STATIC TYPING & INTERFACES
  // -------------------------------------------------------------
  if (p.includes('typescript') || /\bts\b/i.test(prompt)) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'TypeScript is a statically-typed superset of JavaScript that compiles to plain JavaScript, providing compile-time type verification, interfaces, generics, and self-documenting codebases.',
      spokenScript: 'TypeScript adds a compile-time static type system on top of JavaScript. Everything valid in JavaScript is valid in TypeScript, but TypeScript introduces interfaces, type aliases, generics, and union types. The biggest benefit in production is catching errors — like undefined property access or invalid API payloads — at compile time before code ever hits production. At build time, the TypeScript compiler strips away all type annotations, leaving clean, standard JavaScript.',
      bullets: [
        'Compile-Time Type Safety: Type checking runs entirely during development and build time, producing zero runtime performance overhead.',
        'Interfaces vs Types: Interfaces support declaration merging and are optimized for object shapes and inheritance via extends. Types are more versatile for unions, primitives, and mapped types.',
        'Generics: Allow writing flexible, reusable code components while preserving exact type safety across function boundaries.',
        'Structural Typing: TypeScript uses duck typing — if an object has the required properties and types, it satisfies the type contract regardless of its explicit inheritance.'
      ],
      codeSnippet: {
        language: 'typescript',
        code: `// Generics and Discriminated Unions
type ApiResponse<T> = 
  | { status: 'success'; data: T }
  | { status: 'error'; message: string };

interface User {
  id: number;
  email: string;
}

function handleResponse(res: ApiResponse<User>) {
  if (res.status === 'success') {
    console.log(res.data.email); // Type-safe: TS narrows to success
  } else {
    console.error(res.message);  // Type-safe: TS narrows to error
  }
}`
      },
      tradeoffs: [
        'Increases initial development setup and build compilation time, but dramatically reduces production runtime bugs and refactoring friction in large teams.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 11. PYTHON: CORE ARCHITECTURE & GIL
  // -------------------------------------------------------------
  if (p.includes('python') || p.includes('gil')) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'Python is a high-level, interpreted, dynamically-typed programming language emphasizing developer readability, powered by automatic reference counting memory management and the Global Interpreter Lock (GIL) in CPython.',
      spokenScript: 'Python is known for its clean syntax and massive ecosystem in backend web development, data engineering, and machine learning. In CPython, memory is managed via reference counting combined with a cyclical garbage collector. A classic interview topic is the Global Interpreter Lock (GIL) — a mutex that allows only one native thread to execute Python bytecode at a time. For I/O-bound operations, async/await or threading works well; for CPU-heavy tasks, we bypass the GIL using multiprocessing or native C extensions like NumPy.',
      bullets: [
        'CPython Memory Management: Reference counting automatically deallocates objects when count drops to zero; a cyclic garbage collector detects circular references across 3 generations.',
        'Global Interpreter Lock (GIL): Mutex protecting CPython internal memory structures. Pre-Python 3.13 free-threading builds require multiprocessing for true CPU multicore parallelism.',
        'Decorators & First-Class Functions: Python treats functions as first-class objects; decorators provide clean syntax (@decorator) to wrap and extend function behaviors.',
        'Generators & Iterators: Use the yield keyword to produce streams lazily, evaluating one item at a time with O(1) memory consumption.'
      ],
      codeSnippet: {
        language: 'python',
        code: `# Custom Decorator & Generator in Python
import time
from functools import wraps

def timing_decorator(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        print(f"{func.__name__} took {time.perf_counter() - start:.4f}s")
        return result
    return wrapper

# Lazy Generator: O(1) memory consumption
def stream_large_dataset(limit):
    for i in range(limit):
        yield i * 2`
      },
      complexity: {
        time: 'Interpreted bytecode execution; JIT/native speed achievable via PyPy or NumPy',
        space: 'Automatic dynamic memory management'
      },
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 12. REST APIS & WEB ARCHITECTURE
  // -------------------------------------------------------------
  if (p.includes('rest') || p.includes('restful') || p.includes('http method') || p.includes('idempotent')) {
    return {
      id,
      question: prompt,
      mode: 'system_design',
      summary: 'REST (Representational State Transfer) is an architectural style for stateless, client-server distributed hypermedia systems utilizing standard HTTP methods, uniform resource identifiers (URIs), and standardized status codes.',
      spokenScript: 'REST is an architectural pattern for designing web APIs centered around resources. The key constraints are client-server decoupling, statelessness — meaning each request must contain all the information necessary to process it without server session state — and a uniform interface. We map operations to standard HTTP verbs: GET for safe retrieval, POST for creation, PUT for full replacement, PATCH for partial updates, and DELETE. A key concept interviewers look for is idempotency: GET, PUT, and DELETE are idempotent because executing them multiple times produces the identical server state.',
      bullets: [
        'Statelessness: Server never stores client session state. Enables effortless horizontal scaling behind load balancers.',
        'HTTP Verbs & Idempotency: GET, PUT, DELETE, and HEAD are idempotent. POST is non-idempotent because multiple calls create multiple records.',
        'HTTP Status Codes: 2xx (Success), 3xx (Redirection), 4xx (Client errors like 400 Bad Request, 401 Unauthorized, 404 Not Found), 5xx (Server errors like 500 Internal Error, 503 Service Unavailable).',
        'Resource-Oriented URIs: Use plural nouns rather than verbs (e.g. GET /api/v1/orders/123 instead of /api/getOrder).'
      ],
      codeSnippet: {
        language: 'json',
        code: `// Standard RESTful Endpoint Contract
// GET /api/v1/users/42
{
  "id": 42,
  "name": "Jane Doe",
  "email": "jane@example.com",
  "createdAt": "2026-01-15T08:00:00Z"
}`
      },
      tradeoffs: [
        'REST is simple, standardized, and universally cached via HTTP, but can suffer from over-fetching or under-fetching compared to GraphQL for complex nested UI graphs.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 13. SQL VS NOSQL & DATABASE ARCHITECTURE
  // -------------------------------------------------------------
  if (p.includes('sql') && p.includes('nosql')) {
    return {
      id,
      question: prompt,
      mode: 'system_design',
      summary: `**SQL Relational Databases — Definition**

SQL databases are relational systems that store data in structured tables with predefined schemas, foreign key relationships, and strict ACID transaction guarantees.

**NoSQL Databases — Definition**

NoSQL databases are non-relational systems designed for flexible, schemaless data models including key-value pairs, documents, wide-column stores, or graphs, prioritizing horizontal scale and partition tolerance.

**Key Differences**
- **Data Model:** SQL enforces normalized tables with foreign keys; NoSQL uses flexible documents, key-values, column-families, or graphs.
- **Transactions:** SQL guarantees strict ACID transactions; NoSQL often follows the BASE model for distributed partition tolerance.
- **Scaling:** SQL scales primarily vertically with read replicas; NoSQL shards and partitions horizontally across commodity nodes.

**Example**
PostgreSQL handling financial transactional ledgers, while MongoDB or Redis handles high-throughput unstructured event logging.

**Interview Summary**
SQL databases enforce strict schemas and relational ACID guarantees with vertical scaling, while NoSQL databases provide flexible schemas and horizontal partitioning for distributed scale.`,
      spokenScript: 'SQL databases enforce strict schemas and relational ACID guarantees with vertical scaling, while NoSQL databases provide flexible schemas and horizontal partitioning for distributed scale.',
      bullets: [
        'Data Model: SQL uses normalized tables with foreign keys; NoSQL uses Key-Value (Redis), Document (MongoDB), Column-Family (Cassandra), or Graph (Neo4j).',
        'Transactions: SQL provides strong ACID transactions; NoSQL often follows the BASE model (Basically Available, Soft state, Eventual consistency).',
        'Scaling: SQL scales primarily vertically with read replicas; NoSQL shards and partitions horizontally across commodity servers.',
        'Indexing: B-Tree and B+Tree indexes power O(log N) searches in relational engines; LSM trees optimize write-heavy NoSQL databases.'
      ],
      tradeoffs: [
        'Choose SQL when relationships, data integrity, and ACID transactions are paramount. Choose NoSQL when horizontal write throughput, flexible schemaless documents, or massive data volume exceeds single-node storage.'
      ],
      timestamp: now
    };
  }

  if (p.includes('sql') || p.includes('nosql') || p.includes('database') || p.includes('rdbms')) {
    return {
      id,
      question: prompt,
      mode: 'system_design',
      summary: 'Relational SQL and distributed NoSQL databases provide foundational storage architectures balancing schema consistency against horizontal partition scalability.',
      spokenScript: 'When evaluating database architectures, I examine data relationships, transaction boundaries, and scalability needs. For relational and transactional requirements, SQL engines ensure ACID integrity. For massive write throughput or flexible documents, NoSQL engines provide horizontal partition tolerance.',
      bullets: [
        'Relational Foundations: Structured schemas, relational joins, and strict ACID transactions.',
        'NoSQL Alternatives: Key-value, document, column-family, and graph stores optimizing for horizontal partition tolerance.',
        'Architecture Selection: Driven by access patterns, consistency requirements, and latency targets.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 14. OOP PRINCIPLES (4 PILLARS & SOLID)
  // -------------------------------------------------------------
  if (p.includes('oop') || p.includes('object oriented') || p.includes('encapsulation') || p.includes('pillars of oop') || p.includes('solid')) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'Object-Oriented Programming (OOP) is structured around four foundational pillars: Encapsulation, Abstraction, Inheritance, and Polymorphism, guided by SOLID principles for maintainable system design.',
      spokenScript: 'The four core pillars of Object-Oriented Programming are Encapsulation, Abstraction, Inheritance, and Polymorphism. Encapsulation is bundling data and methods together while restricting direct access to internal state. Abstraction is hiding internal complexity and exposing only essential interfaces. Inheritance lets a child class reuse and extend code from a parent class. Polymorphism allows objects of different types to be treated through a common interface, handled at compile time via overloading or at runtime via overriding. In production, we balance these with composition over inheritance.',
      bullets: [
        'Encapsulation: Bundling fields and methods within a class, hiding internal representation using access modifiers (private/protected).',
        'Abstraction: Exposing clean public interfaces while hiding implementation complexity (e.g. Java interface or abstract class).',
        'Inheritance: Code reuse and hierarchical modeling ("is-a" relationship) from superclasses to subclasses.',
        'Polymorphism: "Many forms" — Static polymorphism via method overloading, and Dynamic polymorphism via method overriding with dynamic dispatch.',
        'SOLID Principles: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion.'
      ],
      codeSnippet: {
        language: 'java',
        code: `// Polymorphism & Encapsulation Example
public abstract class PaymentProcessor {
    private String merchantId; // Encapsulated private field

    public PaymentProcessor(String merchantId) {
        this.merchantId = merchantId;
    }
    // Abstraction: Contract to implement
    public abstract boolean processPayment(double amount);
}

public class StripeProcessor extends PaymentProcessor {
    public StripeProcessor(String merchantId) { super(merchantId); }

    @Override // Polymorphic runtime dispatch
    public boolean processPayment(double amount) {
        System.out.println("Processing $" + amount + " via Stripe");
        return true;
    }
}`
      },
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 15. DOCKER & CONTAINERIZATION
  // -------------------------------------------------------------
  if (p.includes('docker') || p.includes('container') || p.includes('kubernetes')) {
    return {
      id,
      question: prompt,
      mode: 'system_design',
      summary: 'Docker provides lightweight operating-system-level virtualization using Linux namespaces and control groups (cgroups), packaging applications and dependencies into immutable portable containers.',
      spokenScript: 'Docker packages an application and all its dependencies into an immutable container image that runs identically across development, staging, and production. Unlike traditional Virtual Machines that require a full guest operating system on top of a hypervisor, Docker containers share the host Linux kernel. It isolates processes using Linux namespaces for PID, network, and mount points, and uses cgroups to allocate CPU and memory limits. This makes containers start in seconds with near-zero overhead.',
      bullets: [
        'Containers vs VMs: VMs virtualize hardware with a hypervisor and full guest OS (gigabytes in size, minutes to boot). Containers share the host kernel (megabytes in size, sub-second boot).',
        'Linux Primitives: Namespaces provide isolation (process tree, networking, filesystem mounts); Cgroups enforce hardware resource quotas (CPU, RAM).',
        'Image Layers: Docker images are composed of read-only cached filesystem layers created by Dockerfile instructions, topped with a thin writable container layer.',
        'Orchestration: Kubernetes orchestrates multi-container workloads across clusters, handling automated rollouts, service discovery, and auto-scaling.'
      ],
      codeSnippet: {
        language: 'dockerfile',
        code: `# Production Multi-stage Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["npm", "start"]`
      },
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 16. GIT & VERSION CONTROL (REBASE VS MERGE)
  // -------------------------------------------------------------
  if (p.includes('git') || p.includes('rebase') || p.includes('merge')) {
    return {
      id,
      question: prompt,
      mode: 'general',
      summary: 'Git is a distributed version control system. git merge combines branch histories by creating a new merge commit; git rebase rewrites branch history linearly onto the tip of the target branch.',
      spokenScript: 'The choice between git merge and git rebase is about commit history cleanliness versus complete historical accuracy. git merge is non-destructive: it takes two branches and combines them with a new 3-way merge commit, preserving the exact chronological sequence of when commits happened. git rebase, on the other hand, rewrites history by moving the base of your feature branch to the latest commit of main, giving you a clean, linear commit history without cluttering merge commits. The golden rule is: never rebase public shared branches.',
      bullets: [
        'git merge: Preserves true historical context and branch topology. Creates an explicit merge commit with multiple parent commits.',
        'git rebase: Replays your commits one by one onto the new base commit, creating a linear history. Ideal for cleaning up local feature branches before opening a PR.',
        'Golden Rule of Rebase: Never rebase commits that have already been pushed to a public/shared branch, as it changes commit hashes and forces upstream team members to resolve merge conflicts.',
        'Squash and Merge: Combines all feature commits into a single clean commit on main, giving the best of both worlds.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 17. CANDIDATE INTRODUCTION / "TELL ME ABOUT YOURSELF" / "PUNIT"
  // -------------------------------------------------------------
  if (
    p.includes('tell me about yourself') ||
    p.includes('introduce yourself') ||
    p.includes('who are you') ||
    p.includes('walk me through your resume') ||
    (p.includes('punit') && (p.includes('intro') || p.includes('who') || p.includes('about')))
  ) {
    return {
      id,
      question: prompt,
      mode: 'behavioral',
      summary: 'High-impact 60-second professional introduction highlighting full-stack engineering expertise, core stack, major achievements, and role alignment.',
      spokenScript: 'Hi! I am a Full-Stack Software Engineer with strong experience architecting and shipping scalable, high-performance web applications and distributed backend systems. My core technical stack centers around modern JavaScript/TypeScript, React, Node.js, and Java/Python, alongside relational and NoSQL databases. In my work, I focus on building end-to-end features — from responsive, accessible frontends to resilient, low-latency microservices with clean API design. I place a huge emphasis on code quality, automated testing, and observability. I am excited to bring my engineering background to this team and contribute directly to your product goals.',
      bullets: [
        'Present: Current technical role, core tech stack (React, Node.js, Java, TypeScript, Cloud).',
        'Past: Tangible achievements in improving performance, reducing latency, and scaling systems.',
        'Future: Why you are passionate about this specific company and position.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 18. DATABASE: ACID TRANSACTIONS & ISOLATION
  // -------------------------------------------------------------
  if (p.includes('acid') || p.includes('transaction') || p.includes('isolation level') || p.includes('mvcc')) {
    return {
      id,
      question: prompt,
      mode: 'system_design',
      summary: 'ACID guarantees database reliability. Modern engines like PostgreSQL achieve high concurrent isolation via Multi-Version Concurrency Control (MVCC) where writers never block readers and readers never block writers.',
      spokenScript: 'ACID stands for Atomicity, Consistency, Isolation, and Durability — the four guarantees that ensure reliable database transactions. Atomicity ensures all operations in a transaction succeed or all roll back. Consistency maintains schema constraints and invariants. Isolation controls concurrent visibility across four ANSI levels — Read Uncommitted, Read Committed, Repeatable Read, and Serializable. In production engines like PostgreSQL, this is implemented using MVCC (Multi-Version Concurrency Control), allowing readers to never block writers and writers to never block readers.',
      bullets: [
        'Atomicity: All operations succeed or whole transaction rolls back (enforced via Write-Ahead Log / WAL).',
        'Consistency: Preserves declared database constraints (foreign keys, check constraints, unique indexes).',
        'Isolation: Controls visibility of uncommitted writes across 4 ANSI levels: Read Uncommitted, Read Committed, Repeatable Read, and Serializable.',
        'Durability: Committed transactions persist to non-volatile disk storage even in power loss (fsync on WAL).',
        'Anomalies Prevented: Dirty reads (Read Committed+), Non-repeatable reads (Repeatable Read+), Phantom reads & Write Skew (Serializable).'
      ],
      codeSnippet: {
        language: 'sql',
        code: `-- Bank Account Transfer with ACID Transaction
BEGIN;

-- Read and lock sender row to prevent concurrency race condition
SELECT balance FROM accounts WHERE id = 101 FOR UPDATE;

UPDATE accounts SET balance = balance - 500 WHERE id = 101;
UPDATE accounts SET balance = balance + 500 WHERE id = 202;

-- If any step fails, ROLLBACK; else:
COMMIT;`
      },
      complexity: {
        time: 'O(log N) index access + O(1) WAL append',
        space: 'O(1) memory overhead; requires background VACUUM in Postgres to purge dead row versions'
      },
      tradeoffs: [
        'Strict Isolation vs Throughput: Serializable guarantees zero anomalies but incurs abort/retry overhead on serialization failures (HTTP 40001).'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 19. SYSTEM DESIGN / ARCHITECTURE FALLBACK
  // -------------------------------------------------------------
  if (mode === 'system_design' || p.includes('design') || p.includes('scale') || p.includes('distributed') || p.includes('architecture') || p.includes('microservice') || p.includes('kafka')) {
    return {
      id,
      question: prompt,
      mode: 'system_design',
      summary: 'Adopt a horizontally scalable, event-driven microservices architecture with an API gateway, multi-tier distributed caching, and partitioned database storage.',
      spokenScript: 'When architecting this system, I start by clarifying scale: read vs write ratios, latency SLAs, and data durability. I would place an API gateway in front for rate limiting and SSL termination, backed by stateless microservices. For high read throughput, I use Redis cache with a Cache-Aside pattern. For heavy asynchronous writes, an event log like Kafka decouples downstream workers. Finally, we partition the database horizontally once single-node IOPS saturate.',
      bullets: [
        'Scale Estimation: Clarify traffic bounds (e.g. 50M DAU, 10k QPS read, 1k QPS write, 99.99% uptime SLA, p99 latency < 100ms).',
        'API Gateway & Ingress: Envoy or Kong terminates TLS, enforces token-bucket rate limiting, and routes to backend microservices.',
        'Caching Tier: Redis Cluster using Cache-Aside pattern with TTL jitter to eliminate cache stampedes.',
        'Database Tier: Relational PostgreSQL primary/read-replicas; partitioned horizontally by tenant_id via consistent hashing when single-node write IOPS saturate.',
        'Asynchronous Decoupling: Apache Kafka event topics handle asynchronous writes, analytics, and notification fanout.'
      ],
      tradeoffs: [
        'CAP Theorem: Balance strong consistency (CP) for billing/payments against high availability (AP) for user feeds and telemetry.',
        'Sync REST vs Event Bus: Synchronous HTTP calls increase cascading failure risk; use circuit breakers and async messaging for resilience.'
      ],
      timestamp: now
    };
  }

  // Dedicated Array vs ArrayList concept handler
  if (p.includes('array') && (p.includes('arraylist') || p.includes('array list') || p.includes('difference between array') || p.includes('vs'))) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: `**1. Array**

An Array is a fixed-size, contiguous memory data structure whose length is allocated at creation time. It supports primitive types and objects directly with zero heap object wrapper overhead and O(1) index access.

**Example:** \`int[] numbers = new int[5];\` allocating space for five integers.

**2. ArrayList**

An ArrayList is a dynamic, resizable collection wrapper backed internally by an array that automatically grows when capacity is reached. It integrates with the Collections framework and provides utility methods, but stores only object references via autoboxing.

**Example:** \`List<Integer> list = new ArrayList<>();\` adding elements dynamically via \`list.add(42);\`.

**3. Key Difference**

Arrays have a fixed capacity and directly store primitives with minimal overhead, while ArrayList dynamically resizes at runtime and operates only on object types.`,
      spokenScript: 'The primary difference is fixed versus dynamic sizing. Arrays have a fixed capacity allocated at creation and hold primitives with zero memory overhead. An ArrayList dynamically resizes when full and integrates with the Collections API, but only stores object references and incurs slight resizing cost.',
      bullets: [
        'Sizing: Arrays have fixed capacity determined at creation; ArrayList automatically grows dynamically (typically +50%) when capacity is reached.',
        'Data Types: Arrays support both primitives (int, char) and objects directly; ArrayList supports only object types via boxing (Integer, Character).',
        'Memory Efficiency: Arrays are memory-efficient with direct contiguous memory; ArrayList requires extra heap overhead for wrapper objects.',
        'Operations: Both offer O(1) random access by index; ArrayList provides convenient helper methods (add, remove, contains).'
      ],
      codeSnippet: {
        language: 'java',
        code: `// 1. Fixed-size primitive Array\nint[] arr = new int[5];\narr[0] = 42;\n\n// 2. Dynamic resizable ArrayList\nList<Integer> list = new ArrayList<>();\nlist.add(42);\nlist.add(99); // Automatically resizes as elements are added`,
        explanation: 'Use primitive arrays for high-throughput, fixed-size performance; use ArrayList for dynamic business data collections.',
        timeComplexity: 'O(1) index access for both; O(1) amortized add for ArrayList',
        spaceComplexity: 'O(N) contiguous memory'
      },
      tradeoffs: [
        'Memory vs Flexibility: Arrays consume minimal memory but cannot grow; ArrayList handles automatic reallocation at the cost of heap overhead.',
        'Primitives vs Autoboxing: Arrays eliminate heap allocation for primitives, whereas ArrayList incurs autoboxing and pointer chasing.'
      ],
      timestamp: Date.now()
    };
  }

  // -------------------------------------------------------------
  // 20. GENERAL CODING / ALGORITHM PROBLEM (When requested)
  // -------------------------------------------------------------
  const isCodingQuestion = 
    mode === 'coding' && 
    (p.includes('leetcode') || p.includes('two sum') || p.includes('implement a function') || p.includes('solve this problem') || p.includes('write code to'));

  if (isCodingQuestion) {
    return {
      id,
      question: prompt,
      mode: 'coding',
      summary: 'Analyze the problem constraints, evaluate the brute-force baseline, and apply optimal data structures (Hash Map, Two Pointers, or Binary Search) to achieve linear O(N) or logarithmic O(log N) efficiency.',
      spokenScript: 'To solve this, I first look at the constraints and edge cases. A naive brute-force approach would check every single combination, giving us quadratic O(N²) time. Instead, we can optimize this to linear O(N) time in a single pass using a Hash Map to store elements we have already visited. We trade a small amount of memory for significant CPU performance gains.',
      bullets: [
        'Problem Decomposition: Identify inputs, expected outputs, constraints (e.g. array length, integer ranges, negative numbers, duplicates).',
        'Brute Force Evaluation: Explain why naive nested loops result in unacceptable quadratic O(N²) time complexity for large datasets.',
        'Optimal Strategy: Utilize an in-memory Hash Table or Two-Pointer approach to eliminate redundant scanning, reducing time complexity to linear O(N).',
        'Boundary Conditions: Validate edge cases including empty inputs, single-element collections, extreme integer values, and duplicate targets.'
      ],
      codeSnippet: {
        language: 'typescript',
        code: `// Optimal linear time O(N) approach
function solveProblem(items: number[], target: number): [number, number] | null {
  const map = new Map<number, number>();
  for (let i = 0; i < items.length; i++) {
    const complement = target - items[i];
    if (map.has(complement)) {
      return [map.get(complement)!, i];
    }
    map.set(items[i], i);
  }
  return null;
}`
      },
      complexity: {
        time: 'O(N) single-pass traversal',
        space: 'O(N) auxiliary space'
      },
      tradeoffs: [
        'Time vs Space: Sacrifice O(N) memory to achieve optimal linear O(N) execution speed.'
      ],
      timestamp: now
    };
  }

  // -------------------------------------------------------------
  // 21. DYNAMIC SMART TOPIC GENERATOR (NO GENERIC THREE DIMENSIONS FLUFF!)
  // -------------------------------------------------------------
  // Dual-concept comparison fallback: generate structured 3-section comparison
  const dualComparison = isDualConceptComparison(prompt);
  if (dualComparison.isDual && dualComparison.subject1 && dualComparison.subject2) {
    const s1 = dualComparison.subject1.charAt(0).toUpperCase() + dualComparison.subject1.slice(1);
    const s2 = dualComparison.subject2.charAt(0).toUpperCase() + dualComparison.subject2.slice(1);
    const compSummary = `**${s1} — Definition**

${s1} is a fundamental concept in this domain, governing specific principles, operational mechanisms, and core practical use cases.

**${s2} — Definition**

${s2} provides a distinct or complementary mechanism, designed for different operational conditions, practical requirements, and system trade-offs.

**Key Differences**
- **Purpose:** ${s1} specializes in its core domain purpose, whereas ${s2} serves distinct operational goals.
- **Mechanism:** ${s1} operates under its specific system rules, while ${s2} follows alternate functional pathways.
- **Application:** ${s1} is preferred for its target constraints, while ${s2} is selected for complementary requirements.

**Example**
Apply ${s1} when direct domain constraints require it, and choose ${s2} when alternative trade-offs are acceptable.

**Interview Summary**
${s1} governs its specific operational focus, while ${s2} addresses alternative architectural constraints and trade-offs.`;

    const compScript = `${s1} governs its specific operational focus, while ${s2} addresses alternative architectural constraints and trade-offs.`;

    return {
      id,
      question: prompt,
      mode: 'general',
      summary: compSummary,
      spokenScript: compScript,
      bullets: [
        `${s1}: Core principle and primary operational role in this domain.`,
        `${s2}: Distinct mechanism designed for complementary conditions.`,
        `Comparison Summary: Differentiated by their specific constraints, execution models, and practical trade-offs.`
      ],
      timestamp: now
    };
  }

  // Clean topic by stripping greetings, filler phrases, and question marks
  let cleanTopic = prompt
    .replace(/\b(hi|hello|hey|good morning|good afternoon|good evening|punit|puneet|interviewer|candidate)\b/gi, '')
    .replace(/\b(what is|what are|explain|can you tell me about|tell me about|how does|how do|describe|define)\b/gi, '')
    .replace(/[?!.,]/g, '')
    .trim();

  if (!cleanTopic || cleanTopic.length < 2) {
    cleanTopic = prompt.trim();
  }

  // Capitalize first letter of topic
  const formattedTopic = cleanTopic.charAt(0).toUpperCase() + cleanTopic.slice(1);

  // Detect domain context for dynamic fallback
  const isEE = /\b(volt|voltage|current|amp|circuit|resistor|ohm|kirchhoff|diode|mosfet|transistor|rf|ac|dc|frequency|hertz)\b/i.test(prompt);
  const isMechCivil = /\b(stress|strain|fluid|pressure|concrete|thermo|thermodynamics|carnot|bernoulli|engine|beam|torsion|viscosity)\b/i.test(prompt);
  const isCyber = /\b(security|injection|xss|vulnerability|exploit|firewall|encryption|cryptography|malware|cipher)\b/i.test(prompt);
  const isBehavioral = /\b(weakness|strength|conflict|team|leadership|experience|yourself|disagree|tell me)\b/i.test(prompt);
  const isMathScience = /\b(equation|derivative|integral|fourier|laplace|calculus|probability|statistics|eigen|matrix)\b/i.test(prompt);
  const isCS = /\b(algorithm|data structure|cache|database|sql|index|concurrency|process|thread|compiler|memory)\b/i.test(prompt);

  let domainSummary = `${formattedTopic} is a foundational technical concept with established principles and key practical applications.`;
  let domainScript = `To answer directly: ${formattedTopic} is a core subject concept. In practical applications, it provides the fundamental mechanism for analyzing and solving domain-specific challenges. When discussing this, I focus on its governing principles, practical implementation, and key trade-offs.`;

  if (isEE) {
    domainSummary = `${formattedTopic} is a fundamental electrical and electronics principle governing circuit behavior and component operation.`;
    domainScript = `To answer directly: ${formattedTopic} is a core electrical and electronics engineering concept. In circuit design, it governs how signals, voltages, and currents interact at components and junctions. When analyzing this, I examine its governing physical laws, operational tolerances, and practical design considerations.`;
  } else if (isMechCivil) {
    domainSummary = `${formattedTopic} is a core engineering principle applied in mechanical, structural, and materials analysis.`;
    domainScript = `To answer directly: ${formattedTopic} is a foundational engineering principle. In practical mechanical and structural design, it governs physical load responses, fluid dynamics, and thermodynamic efficiency. When evaluating this, I consider its governing equations, safety factors, and material constraints.`;
  } else if (isCyber) {
    domainSummary = `${formattedTopic} is an essential cybersecurity concept focused on threat modeling, vulnerability mitigation, and defensive architecture.`;
    domainScript = `To answer directly: ${formattedTopic} is a critical cybersecurity concept. In modern security engineering, it guides how we identify attack surfaces, mitigate threat vectors, and enforce defense-in-depth. When implementing this, I focus on defensive controls, risk reduction, and proactive verification.`;
  } else if (isBehavioral) {
    domainSummary = `${formattedTopic} evaluates key behavioral competencies, professional teamwork, and structured problem-solving under real-world conditions.`;
    domainScript = `In response to this question: I approach this by demonstrating self-awareness, clear communication, and collaborative ownership. In real-world team settings, I align with stakeholders, evaluate objective data, and focus on delivering high-impact results.`;
  } else if (isMathScience) {
    domainSummary = `${formattedTopic} is a foundational mathematical and scientific concept used for rigorous quantitative analysis and analytical modeling.`;
    domainScript = `To answer directly: ${formattedTopic} is a mathematical and scientific principle used to model complex physical phenomena. In analytical applications, it provides the formal framework to derive solutions, analyze stability, and compute exact values.`;
  } else if (isCS) {
    domainSummary = `${formattedTopic} is a core computer science concept used to design scalable, reliable systems.`;
    domainScript = `To answer directly: ${formattedTopic} is a foundational computer science concept. In practical system architecture, it solves key reliability, performance, and maintainability requirements. When explaining this, I highlight its core runtime mechanism, implementation details, and key architectural trade-offs.`;
  }

  return {
    id,
    question: prompt,
    mode: isBehavioral ? 'behavioral' : 'general',
    summary: domainSummary,
    spokenScript: domainScript,
    bullets: [
      `Core Principle: ${formattedTopic} provides the fundamental basis for analysis and execution in this domain.`,
      `Practical Application: Implementation requires adherence to established best practices, boundary checks, and active verification.`,
      `Trade-Off & Optimization: Balances operational efficiency, accuracy, and maintainability.`
    ],
    tradeoffs: [
      `Carefully evaluate whether ${formattedTopic} introduces unnecessary complexity compared to simpler alternatives for your specific operational constraints.`
    ],
    timestamp: now
  };
}

export function evaluateMockAnswer(
  question: string,
  userAnswer: string,
  turnIndex: number
): MockTurnFeedback {
  const words = userAnswer.trim().split(/\s+/).length;
  
  let correctness = 7;
  let clarity = 8;
  let completeness = 6;
  let communication = 7;

  const lowerAns = userAnswer.toLowerCase();
  
  if (words > 60) completeness += 2;
  if (words < 20) {
    completeness -= 3;
    clarity -= 1;
  }

  if (lowerAns.includes('because') || lowerAns.includes('trade-off') || lowerAns.includes('complexity') || lowerAns.includes('for example')) {
    clarity += 1;
    communication += 1;
  }

  if (lowerAns.includes('o(n)') || lowerAns.includes('index') || lowerAns.includes('cache') || lowerAns.includes('async') || lowerAns.includes('star') || lowerAns.includes('gin') || lowerAns.includes('overload')) {
    correctness = Math.min(10, correctness + 2);
  }

  correctness = Math.max(3, Math.min(10, correctness));
  clarity = Math.max(3, Math.min(10, clarity));
  completeness = Math.max(3, Math.min(10, completeness));
  communication = Math.max(3, Math.min(10, communication));

  const strengths: string[] = [];
  const improvements: string[] = [];

  if (words >= 30) {
    strengths.push('Good explanation depth and detailed reasoning.');
  } else {
    improvements.push('Expand your explanation with more concrete engineering details.');
  }

  if (lowerAns.includes('trade-off') || lowerAns.includes('however') || lowerAns.includes('alternative')) {
    strengths.push('Acknowledged trade-offs and alternative solutions.');
  } else {
    improvements.push('Mention architectural trade-offs (e.g. latency vs consistency, memory vs CPU).');
  }

  strengths.push('Professional technical vocabulary and clear pacing.');

  let suggestedFollowUp = 'Can you walk me through how this design would scale if our traffic increased by 10x?';
  if (lowerAns.includes('cache') || lowerAns.includes('redis')) {
    suggestedFollowUp = 'How would you prevent cache stampedes and ensure cache invalidation consistency?';
  } else if (lowerAns.includes('database') || lowerAns.includes('sql') || lowerAns.includes('index')) {
    suggestedFollowUp = 'What indexing strategy would you use on that table to optimize query execution plans?';
  }

  return {
    turnIndex,
    question,
    userAnswer,
    scores: { correctness, clarity, completeness, communication },
    feedback: `Strong response. You demonstrated a solid grasp of foundational principles with good logical pacing. To make this an elite Staff-level answer, weave in specific production metrics and architectural trade-offs.`,
    strengths,
    improvements,
    suggestedFollowUp
  };
}

export function generateFinalMockReport(
  role: string,
  difficulty: string,
  turns: MockTurnFeedback[]
): MockInterviewReport {
  let totalCorrectness = 0;
  let totalClarity = 0;
  let totalCompleteness = 0;
  let totalCommunication = 0;

  turns.forEach(t => {
    totalCorrectness += t.scores.correctness;
    totalClarity += t.scores.clarity;
    totalCompleteness += t.scores.completeness;
    totalCommunication += t.scores.communication;
  });

  const count = turns.length || 1;
  const avgCorrectness = Math.round((totalCorrectness / count) * 10) / 10;
  const avgClarity = Math.round((totalClarity / count) * 10) / 10;
  const avgCompleteness = Math.round((totalCompleteness / count) * 10) / 10;
  const avgCommunication = Math.round((totalCommunication / count) * 10) / 10;

  const overallScore = Math.round(((avgCorrectness + avgClarity + avgCompleteness + avgCommunication) / 4) * 10);

  return {
    id: 'rep_' + Math.random().toString(36).substring(2, 9),
    role,
    difficulty,
    overallScore,
    categoryScores: {
      correctness: avgCorrectness,
      clarity: avgClarity,
      completeness: avgCompleteness,
      communication: avgCommunication
    },
    summary: `The candidate showed strong competency for a ${difficulty} ${role} role, demonstrating solid architectural thinking, structured problem-solving, and clear technical communication.`,
    keyStrengths: [
      'Logical breakdown of complex problems into manageable sub-components.',
      'Clear, articulate speech structure without excessive hesitation.',
      'Good familiarity with modern cloud and data architectures.'
    ],
    priorityFixes: [
      'Proactively state time and space complexities upfront before writing code.',
      'Quantify past project achievements with concrete business metrics (e.g. latency, revenue, uptime).'
    ],
    turns,
    createdAt: Date.now()
  };
}

export function analyzeResumeHeuristics(resumeText: string, jobDescription: string): ResumeAnalysisResult {
  const commonTechSkills = [
    'typescript', 'javascript', 'react', 'next.js', 'node.js', 'python', 'java', 'go',
    'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'postgresql', 'mysql', 'mongodb',
    'redis', 'kafka', 'graphql', 'rest api', 'ci/cd', 'microservices', 'git', 'terraform',
    'system design', 'distributed systems', 'agile', 'unit testing'
  ];

  const resumeLower = resumeText.toLowerCase();
  const jdLower = jobDescription.toLowerCase();

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  commonTechSkills.forEach(skill => {
    const inJd = jdLower.includes(skill);
    const inResume = resumeLower.includes(skill);

    if (inJd && inResume) {
      matchedSkills.push(skill);
    } else if (inJd && !inResume) {
      missingSkills.push(skill);
    } else if (inResume && matchedSkills.length < 12) {
      matchedSkills.push(skill);
    }
  });

  const totalRelevant = matchedSkills.length + missingSkills.length;
  let matchRatio = totalRelevant > 0 ? (matchedSkills.length / totalRelevant) : 0.65;
  
  if (resumeText.length > 500) matchRatio += 0.05;
  const overallScore = Math.min(94, Math.max(45, Math.round(matchRatio * 100)));

  const bulletImprovements = [
    {
      original: 'Worked on backend APIs and helped improve database queries.',
      improved: 'Architected 12 high-throughput RESTful microservices in Node.js/PostgreSQL, reducing p99 database query latency by 42% via composite indexing and Redis caching.',
      explanation: 'Replaced passive verb "worked on" with strong action verb "Architected" and added quantifiable latency metrics.',
      metricsAdded: '12 microservices, 42% p99 latency reduction'
    },
    {
      original: 'Responsible for CI/CD deployment pipelines and cloud infrastructure.',
      improved: 'Orchestrated automated GitHub Actions CI/CD pipelines deploying containerized workloads to AWS EKS, slashing deployment cycle times from 45 minutes to 4 minutes.',
      explanation: 'Framed responsibility as active ownership with concrete tooling (GitHub Actions, AWS EKS) and measurable efficiency gains.',
      metricsAdded: 'Cut deployment time by 91% (45m -> 4m)'
    },
    {
      original: 'Built user interface components for customer dashboard using React.',
      improved: 'Engineered a modern, responsive analytics dashboard in Next.js/React featuring dynamic virtualization, elevating Lighthouse accessibility to 98% and supporting 15,000 DAU.',
      explanation: 'Highlighted technical complexity (virtualization) and user impact metrics (DAU, Lighthouse score).',
      metricsAdded: '98% Lighthouse accessibility, 15,000 DAU'
    }
  ];

  return {
    overallScore,
    verdict: overallScore >= 80 ? 'Strong Match' : overallScore >= 65 ? 'Competitive Match' : 'Needs Optimization',
    matchedSkills: matchedSkills.slice(0, 10),
    missingSkills: missingSkills.slice(0, 8),
    keywordsDetected: matchedSkills.map(s => s.toUpperCase()),
    missingKeywords: missingSkills.map(s => s.toUpperCase()),
    strengths: [
      'Strong representation of foundational software engineering methodologies.',
      'Clear project timelines and relevant framework exposure.',
      'Modern tech stack alignment.'
    ],
    weaknesses: [
      missingSkills.length > 0 
        ? `Missing key job description competencies: ${missingSkills.slice(0, 4).join(', ')}.`
        : 'Could benefit from more quantified dollar or latency impact metrics.',
      'Several bullet points utilize passive phrasing rather than metric-driven STAR framing.'
    ],
    bulletImprovements,
    disclaimer: 'Transparent heuristic match score based on keyword density and competency overlap, not an official ATS vendor proprietary score.'
  };
}
