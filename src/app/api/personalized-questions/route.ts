import { NextRequest, NextResponse } from 'next/server';
import { generatePersonalizedQuestions } from '@/lib/personalizedEngine';
import { UserProfile, ProjectRecord, TargetJobDescription } from '@/lib/profileTypes';
import { INITIAL_USER_PROFILE, INITIAL_PROJECTS } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const profile: UserProfile = body.profile || INITIAL_USER_PROFILE;
    const projects: ProjectRecord[] = body.projects && body.projects.length > 0 ? body.projects : INITIAL_PROJECTS;
    const targetJob: TargetJobDescription | undefined = body.targetJob;
    const resumeText: string | undefined = body.resumeText;

    const questions = generatePersonalizedQuestions(profile, projects, targetJob, resumeText);

    return NextResponse.json({
      questions,
      count: questions.length,
      timestamp: Date.now()
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

