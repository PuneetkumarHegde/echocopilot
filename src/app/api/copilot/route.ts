import { NextRequest, NextResponse } from 'next/server';
import { generateSmartCopilotAnswer } from '@/lib/aiFallback';
import { AnswerMode, CopilotAnswer } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, mode = 'general', resumeContext = '', jobDescription = '' } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const openAiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    // 1. If Anthropic Claude API Key configured
    if (anthropicKey) {
      try {
        const systemPrompt = `You are an elite, real-time AI interview copilot assisting a candidate live in an interview.
The current interview answer mode is: ${mode.toUpperCase()}.
Candidate Resume Background: ${resumeContext || 'Not provided'}
Target Job Description: ${jobDescription || 'Not provided'}

Format your response as a valid JSON object matching this schema:
{
  "summary": "1 concise sentence summarizing the main thesis or algorithm",
  "spokenScript": "A natural, confident 2-3 sentence conversational script in first-person engineer voice explaining how to answer out loud in an interview naturally without sounding like reading a textbook",
  "bullets": ["3-5 clear, impactful bullet points containing direct answers, architecture, or STAR steps"],
  "codeSnippet": {
    "language": "typescript / python / java / sql",
    "code": "clean, working code or architecture snippet",
    "explanation": "brief breakdown of approach",
    "timeComplexity": "O(...) explanation",
    "spaceComplexity": "O(...) explanation"
  },
  "tradeoffs": ["2-3 key engineering trade-offs"],
  "starExample": {
    "situation": "concise situation",
    "task": "candidate task",
    "action": "action taken",
    "result": "quantifiable metrics"
  }
}
Only output the JSON object, nothing else.`;

        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1500,
            system: systemPrompt,
            messages: [{ role: 'user', content: prompt }]
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          const content = data.content?.[0]?.text;
          if (content) {
            try {
              const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
              const parsed = JSON.parse(cleaned);
              const answer: CopilotAnswer = {
                id: 'ans_' + Math.random().toString(36).substring(2, 9),
                question: prompt,
                mode: mode as AnswerMode,
                summary: parsed.summary || 'Direct technical solution.',
                spokenScript: parsed.spokenScript,
                bullets: parsed.bullets || [],
                codeSnippet: parsed.codeSnippet,
                tradeoffs: parsed.tradeoffs,
                starExample: parsed.starExample,
                timestamp: Date.now()
              };
              return NextResponse.json({ answer, source: 'anthropic' });
            } catch (parseErr) {
              console.warn('Failed parsing Claude JSON, using raw text:', parseErr);
            }
          }
        }
      } catch (anthropicErr) {
        console.warn('Anthropic API call failed, falling back:', anthropicErr);
      }
    }

    // 2. If Groq API Key configured (Blazing-fast ~300ms inference)
    const groqKey = process.env.GROQ_API_KEY || (body.provider === 'groq' ? body.apiKey : undefined);
    if (groqKey) {
      try {
        const systemPrompt = `You are a real-time interview copilot. Answer mode: ${mode}.
Provide a structured JSON response with fields: summary (string), spokenScript (a natural, 2-3 sentence conversational script in first-person engineer voice explaining how to say the answer out loud naturally in an interview), bullets (array of strings), codeSnippet (optional object with language, code, explanation, timeComplexity, spaceComplexity), tradeoffs (optional array of strings), starExample (optional object with situation, task, action, result). Return ONLY valid JSON.`;

        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt }
            ]
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            const answer: CopilotAnswer = {
              id: 'ans_' + Math.random().toString(36).substring(2, 9),
              question: prompt,
              mode: mode as AnswerMode,
              summary: parsed.summary || 'Direct technical solution.',
              spokenScript: parsed.spokenScript,
              bullets: parsed.bullets || [],
              codeSnippet: parsed.codeSnippet,
              tradeoffs: parsed.tradeoffs,
              starExample: parsed.starExample,
              timestamp: Date.now()
            };
            return NextResponse.json({ answer, source: 'groq' });
          }
        }
      } catch (groqErr) {
        console.warn('Groq API call failed, falling back:', groqErr);
      }
    }

    // 3. If OpenAI API Key configured
    if (openAiKey) {
      try {
        const systemPrompt = `You are a real-time interview copilot. Answer mode: ${mode}.
Provide a structured JSON response with fields: summary (string), spokenScript (a natural, 2-3 sentence conversational script in first-person engineer voice explaining how to say the answer out loud naturally in an interview), bullets (array of strings), codeSnippet (optional object with language, code, explanation, timeComplexity, spaceComplexity), tradeoffs (optional array of strings), starExample (optional object with situation, task, action, result).`;

        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openAiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt }
            ]
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            const answer: CopilotAnswer = {
              id: 'ans_' + Math.random().toString(36).substring(2, 9),
              question: prompt,
              mode: mode as AnswerMode,
              summary: parsed.summary || 'Direct technical solution.',
              spokenScript: parsed.spokenScript,
              bullets: parsed.bullets || [],
              codeSnippet: parsed.codeSnippet,
              tradeoffs: parsed.tradeoffs,
              starExample: parsed.starExample,
              timestamp: Date.now()
            };
            return NextResponse.json({ answer, source: 'openai' });
          }
        }
      } catch (openAiErr) {
        console.warn('OpenAI API call failed, falling back:', openAiErr);
      }
    }

    // 4. Built-in Smart Fallback Engine (Immediate & Reliable)
    const fallbackAnswer = generateSmartCopilotAnswer(prompt, mode as AnswerMode);
    return NextResponse.json({
      answer: fallbackAnswer,
      source: 'built-in-engine',
      setupNotice: (!openAiKey && !anthropicKey && !groqKey) 
        ? 'Running in zero-config mode with Smart Built-in Engine. You can also add GROQ_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY to .env for arbitrary custom generation.'
        : undefined
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
