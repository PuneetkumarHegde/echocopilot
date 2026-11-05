export interface EducationRecord {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate?: string;
  endDate?: string;
  gpaOrGrade?: string;
  reasonForDegree?: string; // e.g. "Why did you choose your degree or specialization?"
  highlights?: string[];
}

export interface SkillItem {
  name: string;
  level?: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  yearsOfExperience?: number;
  rationale?: string; // e.g. Why chosen / how it supports career goals
}

export interface SkillCategoryGroup {
  category: 'Languages' | 'Frameworks & Libraries' | 'Databases & Storage' | 'Cloud & DevOps' | 'Tools & Architectures' | string;
  skills: SkillItem[];
}

export interface CareerGoals {
  targetRoles: string[];
  targetCompaniesOrIndustries?: string[];
  shortTermGoals?: string;
  longTermGoals?: string;
  techStackRationale?: Record<string, string>; // e.g. { "Java": "I specialize in Java because...", "PostgreSQL": "..." }
  cybersecurityOrDomainAdvantage?: string; // e.g. "How does your cybersecurity background help in software development?"
}

export interface WorkExperienceRecord {
  id: string;
  company: string;
  role: string;
  type: 'Full-time' | 'Part-time' | 'Internship' | 'Contract';
  location?: string;
  startDate: string;
  endDate?: string;
  isCurrent?: boolean;
  description: string;
  achievements: string[];
  technologiesUsed: string[];
}

export interface AchievementOrCertRecord {
  id: string;
  title: string;
  issuerOrEvent: string;
  date: string;
  type: 'Hackathon' | 'Certification' | 'Award' | 'Publication';
  description?: string;
  credentialUrl?: string;
}

export interface StrengthsAndWeaknesses {
  technicalStrengths: string[];
  areasForImprovement: Array<{
    area: string;
    remediationAction: string; // What the candidate is doing to improve
  }>;
}

export interface RealChallengeRecord {
  id: string;
  title: string; // e.g. "Redis connection pool starvation during load spike"
  context: string;
  technicalProblem: string;
  investigationSteps?: string;
  solutionAndFix: string;
  tradeoffsConsidered?: string;
  lessonsLearned: string;
  relatedProjectOrRole?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  title: string;
  email?: string;
  phone?: string;
  location?: string;
  summary?: string;
  education: EducationRecord[];
  technicalSkills: SkillCategoryGroup[];
  careerGoals: CareerGoals;
  workExperience: WorkExperienceRecord[];
  hackathonsAndCerts: AchievementOrCertRecord[];
  strengthsAndWeaknesses: StrengthsAndWeaknesses;
  realChallenges: RealChallengeRecord[];
  updatedAt: number;
}

// ----------------- PROJECT VAULT -----------------

export interface TechChoiceItem {
  name: string;
  role: 'Frontend' | 'Backend' | 'Database' | 'Cache' | 'Infra' | 'Testing' | 'Other';
  whyChosen: string; // "Why did you select this project's technology stack?"
  alternativesConsidered?: string; // "Why PostgreSQL instead of MongoDB?"
}

export interface MajorFeatureItem {
  id: string;
  name: string;
  description: string;
  implementationDetails: string;
}

export interface VerifiedContributionItem {
  id: string;
  area: string;
  description: string;
  isPersonallyImplemented: boolean; // Confirmed by user vs team contribution
  evidenceCodeFiles?: string[];
}

export interface ProjectChallengeItem {
  id: string;
  challenge: string;
  solution: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  tagline: string;
  problemStatement: string;
  targetUsers: string;
  architecture: string; // Architecture overview
  technologyStack: TechChoiceItem[];
  majorFeatures: MajorFeatureItem[];
  databaseSchemaAndApi: {
    databaseType: string;
    majorEntitiesOrTables: string[];
    apiDesignPatterns: string[]; // REST, GraphQL, gRPC, WebSocket
    keyEndpoints?: string[];
  };
  securityAndPerformance: {
    securityMeasures: string[];
    performanceOptimizations: string[];
  };
  verifiedContributions: VerifiedContributionItem[];
  challengesAndSolutions: ProjectChallengeItem[];
  limitationsAndImprovements: {
    knownLimitations: string[];
    whatWouldYouImproveIfRebuilt: string; // "What would you improve if you rebuilt your project?"
  };
  repoUrl?: string;
  localPath?: string;
  sourceCodeSnippets?: Array<{
    filePath: string;
    description: string;
    snippet: string;
    myContributionConfirmed: boolean;
  }>;
  updatedAt: number;
}

// ----------------- TARGET JOB DESCRIPTION -----------------

export interface TargetJobDescription {
  id: string;
  title: string;
  company: string;
  location?: string;
  rawText: string;
  extractedSkills: string[];
  keyRequirements: string[];
  whyInterested?: string; // "Why are you interested in this company and role?"
  updatedAt: number;
}

// ----------------- PERSONALIZED QUESTION & ANSWER -----------------

export type QuestionCategoryType =
  | 'Tech Choice Rationale'
  | 'Career & Motivation'
  | 'Verified Contributions'
  | 'System Architecture & Trade-offs'
  | 'Difficult Bugs & Outages'
  | 'Rebuilding & Future Vision'
  | 'Behavioral & Leadership'
  | 'General Technical';

export interface PersonalizedQuestion {
  id: string;
  question: string;
  category: QuestionCategoryType;
  source: 'profile' | 'project' | 'resume' | 'job_description' | 'hybrid';
  relatedSubject?: string; // e.g. "Java", "PostgreSQL vs MongoDB", "EchoCopilot"
  difficulty: 'Easy' | 'Medium' | 'Hard';
  contextSnippet?: string;
  recommendedDurationSeconds?: number;
}

export interface MissingContextCard {
  missingField: string;
  suggestedPrompt: string;
  suggestedCategory: 'skills' | 'projects' | 'challenges' | 'education' | 'goals' | 'experience' | 'achievements';
  targetEntityId?: string;
  entityName?: string;
}

export interface PersonalizedAnswer {
  id: string;
  question: string;
  length: 'short' | 'medium' | 'detailed';
  structure: {
    directAnswer: string;
    personalMotivation: string;
    supportingExample: string;
    roleOrCareerConnection: string;
  };
  spokenScript: string;
  bullets: string[];
  missingContextDetected?: MissingContextCard;
  timestamp: number;
}

// ----------------- INTERVIEW PRACTICE STUDIO -----------------

export type InterviewPracticeTrack = 
  | 'hr' 
  | 'technical' 
  | 'project_deep_dive' 
  | 'resume' 
  | 'job_description';

export interface PracticeTurnFeedback {
  turnIndex: number;
  question: string;
  userAnswer: string;
  rubricScores: {
    correctness: number; // 1-10
    clarity: number;     // 1-10
    relevance: number;   // 1-10
    confidence: number;  // 1-10
  };
  overallTurnScore: number;
  strengths: string[];
  improvements: string[];
  confidenceWordingFeedback: string;
  adaptiveFollowUp: string;
  modelAnswer?: {
    short: string;
    medium: string;
    detailed: string;
  };
}

export interface ActiveInterviewContext {
  activeProfileId?: string;
  selectedProjectIds: string[];
  targetJobId?: string;
  practiceTrack: InterviewPracticeTrack;
}

