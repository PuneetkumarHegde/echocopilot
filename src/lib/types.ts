export type ModuleType = 'copilot' | 'mock' | 'resume' | 'questions' | 'history';

export type AnswerMode = 'coding' | 'system_design' | 'behavioral' | 'general';

export type AudioSourceMode = 'mic_only' | 'device_only' | 'both';

export type AnswerTriggerPolicy = 'meeting_only' | 'mic_only' | 'both';

export type AudioPipelineStatus = 
  | 'idle' 
  | 'listening' 
  | 'paused' 
  | 'transcribing' 
  | 'question_detected'
  | 'generating_answer' 
  | 'answer_ready' 
  | 'error';

export interface AudioInputDevice {
  deviceId: string;
  label: string;
  groupId?: string;
}

export interface TranscriptTurn {
  id: string;
  speaker: 'interviewer' | 'candidate';
  source?: 'mic' | 'meeting' | 'manual';
  text: string;
  timestamp: number;
  isFinal?: boolean;
  triggeredAnswer?: boolean;
}

export interface CopilotAnswer {
  id: string;
  question: string;
  mode: AnswerMode;
  summary: string;
  spokenScript?: string;
  bullets: string[];
  codeSnippet?: {
    language: string;
    code: string;
    explanation?: string;
    timeComplexity?: string;
    spaceComplexity?: string;
  };
  complexity?: {
    time: string;
    space: string;
  };
  tradeoffs?: string[];
  starExample?: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
  rawText?: string;
  timestamp: number;
}

export interface SessionRecord {
  id: string;
  title: string;
  createdAt: number;
  durationSeconds: number;
  mode: AnswerMode;
  targetRole?: string;
  transcript: TranscriptTurn[];
  answers: CopilotAnswer[];
  notes?: string;
}

export interface QuestionItem {
  id: string;
  title: string;
  category: 'Java' | 'SQL' | 'Data Structures & Algorithms' | 'Cybersecurity' | 'Behavioral' | 'System Design';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  companies: string[];
  roles: string[];
  question: string;
  answerSummary: string;
  keyPoints: string[];
  codeSnippet?: {
    language: string;
    code: string;
  };
  complexity?: {
    time: string;
    space: string;
  };
  pitfalls?: string[];
  isCustom?: boolean;
}

export interface MockQuestion {
  id: string;
  question: string;
  category: string;
  context?: string;
}

export interface MockTurnFeedback {
  turnIndex: number;
  question: string;
  userAnswer: string;
  scores: {
    correctness: number;
    clarity: number;
    completeness: number;
    communication: number;
  };
  feedback: string;
  strengths: string[];
  improvements: string[];
  suggestedFollowUp?: string;
}

export interface MockInterviewReport {
  id: string;
  role: string;
  difficulty: string;
  overallScore: number;
  categoryScores: {
    correctness: number;
    clarity: number;
    completeness: number;
    communication: number;
  };
  summary: string;
  keyStrengths: string[];
  priorityFixes: string[];
  turns: MockTurnFeedback[];
  createdAt: number;
}

export interface ResumeBulletImprovement {
  original: string;
  improved: string;
  explanation: string;
  metricsAdded: string;
}

export interface ResumeAnalysisResult {
  overallScore: number;
  verdict: string;
  matchedSkills: string[];
  missingSkills: string[];
  keywordsDetected: string[];
  missingKeywords: string[];
  strengths: string[];
  weaknesses: string[];
  bulletImprovements: ResumeBulletImprovement[];
  disclaimer: string;
}

export interface ApiHealthStatus {
  hasOpenAi: boolean;
  hasAnthropic: boolean;
  hasDeepgram: boolean;
  activeProvider: string;
}
