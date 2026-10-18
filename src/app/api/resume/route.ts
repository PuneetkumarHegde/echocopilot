import { NextRequest, NextResponse } from 'next/server';
import { analyzeResumeHeuristics } from '@/lib/aiFallback';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resumeText, jobDescription } = body;

    if (!resumeText || typeof resumeText !== 'string') {
      return NextResponse.json({ error: 'Resume text is required' }, { status: 400 });
    }

    const jd = jobDescription || 'Full Stack Software Engineer with TypeScript, React, Node.js, PostgreSQL, Docker, AWS, System Design';
    const analysis = analyzeResumeHeuristics(resumeText, jd);

    return NextResponse.json({
      analysis,
      timestamp: Date.now()
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
