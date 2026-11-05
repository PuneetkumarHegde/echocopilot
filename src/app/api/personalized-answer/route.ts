import { NextRequest, NextResponse } from 'next/server';
import { generatePersonalizedAnswer } from '@/lib/personalizedEngine';
import { UserProfile, ProjectRecord, TargetJobDescription } from '@/lib/profileTypes';
import { INITIAL_USER_PROFILE, INITIAL_PROJECTS } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      question, 
      length = 'medium', 
      profile = INITIAL_USER_PROFILE, 
      projects = INITIAL_PROJECTS, 
      targetJob 
    } = body;

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Question string is required' }, { status: 400 });
    }

    const answer = generatePersonalizedAnswer(
      question,
      length as 'short' | 'medium' | 'detailed',
      profile as UserProfile,
      projects as ProjectRecord[],
      targetJob as TargetJobDescription | undefined
    );

    return NextResponse.json({
      answer,
      timestamp: Date.now()
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

