import { NextRequest, NextResponse } from 'next/server';
import { evaluateMockAnswer, generateFinalMockReport } from '@/lib/aiFallback';
import { MockTurnFeedback } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, role = 'Full-Stack Engineer', difficulty = 'Senior', question, userAnswer, turnIndex = 1, turns = [] } = body;

    // 1. Generate Interview Questions
    if (action === 'generate_questions') {
      const questionsByRole: Record<string, string[]> = {
        'Frontend Engineer': [
          'Can you explain how the React Virtual DOM diffing algorithm works, and how keys optimize list reconciliation?',
          'How would you architect a micro-frontend application with shared state and isolated CSS styling?',
          'Walk me through how you optimize Core Web Vitals (LCP, FID/INP, CLS) in a high-traffic e-commerce web app.'
        ],
        'Backend Engineer': [
          'How do you design database indexing for a table with 50 million rows that handles heavy concurrent writes and reads?',
          'Explain the trade-offs between asynchronous event-driven messaging (Kafka/RabbitMQ) and synchronous gRPC in microservices.',
          'Walk me through how you implement distributed locking across multiple API worker nodes using Redis or database primitives.'
        ],
        'Full-Stack Engineer': [
          'How do you handle end-to-end type safety between your database schema, backend API, and React frontend?',
          'Describe how you would design an idempotent payment processing workflow that gracefully recovers from transient network drops.',
          'What strategies do you use for real-time bidirectional communication between server and client at scale?'
        ],
        'System Design / Architect': [
          'Design a globally distributed rate limiting service that protects downstream microservices with sub-millisecond latency.',
          'How would you design a real-time notification service delivering push, SMS, and email to 100M active users?',
          'Walk me through the architectural evolution from a monolithic application to an event-driven decoupled architecture.'
        ],
        'Behavioral / Leadership': [
          'Tell me about a time you had a fundamental technical disagreement with a team lead or product manager. How did you resolve it?',
          'Describe a critical production outage where you were the primary on-call engineer. What was your triage protocol?',
          'Give an example of a project where you had to balance technical debt repayment against aggressive product feature deadlines.'
        ]
      };

      const selected = questionsByRole[role] || questionsByRole['Full-Stack Engineer'];
      return NextResponse.json({
        questions: selected.map((q, idx) => ({
          id: `mq_${idx + 1}`,
          question: q,
          category: role
        }))
      });
    }

    // 2. Evaluate Candidate Answer
    if (action === 'evaluate') {
      if (!userAnswer || !question) {
        return NextResponse.json({ error: 'Question and userAnswer are required for evaluation' }, { status: 400 });
      }

      const feedback: MockTurnFeedback = evaluateMockAnswer(question, userAnswer, turnIndex);
      return NextResponse.json({ feedback });
    }

    // 3. Generate Final Report
    if (action === 'report') {
      const report = generateFinalMockReport(role, difficulty, turns as MockTurnFeedback[]);
      return NextResponse.json({ report });
    }

    return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
