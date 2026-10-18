import { NextResponse } from 'next/server';

export async function GET() {
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY);
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasGroq = Boolean(process.env.GROQ_API_KEY);
  const hasDeepgram = Boolean(process.env.DEEPGRAM_API_KEY);

  let activeProvider = 'Smart Built-in Engine (Offline/Zero-Key Ready)';
  if (hasAnthropic) {
    activeProvider = 'Anthropic Claude 3.5 Sonnet';
  } else if (hasOpenAi) {
    activeProvider = 'OpenAI GPT-4o';
  } else if (hasGroq) {
    activeProvider = 'Groq Llama 3.3 70B (Ultra-Fast)';
  }

  return NextResponse.json({
    hasOpenAi,
    hasAnthropic,
    hasGroq,
    hasDeepgram,
    activeProvider,
    webSpeechAvailable: true,
    timestamp: Date.now()
  });
}
