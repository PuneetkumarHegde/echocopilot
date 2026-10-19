import { NextRequest, NextResponse } from 'next/server';
import { generateOllamaAnswer, generateSmartCopilotAnswer } from '@/lib/aiFallback';
import { AnswerMode, CopilotAnswer } from '@/lib/types';

interface CopilotRequestBody {
  prompt: string;
  mode?: AnswerMode;
  provider?: 'groq' | 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'builtin';
  apiKey?: string;
  model?: string;
  ollamaUrl?: string;
  resumeContext?: string;
  jobDescription?: string;
}

const SYSTEM_INTERVIEW_PROMPT = `You are an elite, principal-level AI technical interview copilot providing live assistance during a software engineering interview.
The candidate needs an authoritative, concise, and interview-ready answer.

Format your response strictly as a JSON object with this exact schema:
{
  "summary": "1 concise sentence delivering the direct, accurate technical answer or definition",
  "spokenScript": "A natural, confident 2-3 sentence conversational script in first-person engineer voice ('In an interview, I would say: ...') explaining how to answer out loud smoothly without sounding robotic or textbook-like",
  "bullets": [
    "Core architecture, mechanism, or principle with exact technical terminology",
    "Internal implementation details (e.g. data structure, algorithm, or concurrency model)",
    "Edge case handling, scaling, or production optimization"
  ],
  "codeSnippet": {
    "language": "typescript/python/java/sql",
    "code": "// clean, production-ready, concise working code snippet\\n",
    "explanation": "Brief breakdown of the approach",
    "timeComplexity": "O(...)",
    "spaceComplexity": "O(...)"
  },
  "tradeoffs": [
    "Key engineering trade-off 1 (e.g., Memory vs CPU, CAP theorem)",
    "Key engineering trade-off 2 (e.g., Consistency vs Read throughput)"
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
      jobDescription = '' 
    } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
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

    // 4. Try Local Ollama Model (qwen2.5:3b / llama3.2)
    if (provider === 'ollama' || !provider || (!groqKey && !openAiKey && !anthropicKey)) {
      try {
        const ollamaAnswer = await generateOllamaAnswer(
          prompt, 
          mode, 
          resumeContext, 
          jobDescription,
          model || 'qwen2.5:3b',
          ollamaUrl || 'http://localhost:11434'
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
