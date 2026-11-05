import { SessionRecord, QuestionItem } from './types';
import { 
  UserProfile, 
  ProjectRecord, 
  TargetJobDescription, 
  ActiveInterviewContext,
  PracticeTurnFeedback 
} from './profileTypes';

const DB_NAME = 'EchoInterviewCopilotDB';
const DB_VERSION = 2;

// Store names
const SESSIONS_STORE = 'sessions';
const FAVORITES_STORE = 'favorites';
const CUSTOM_QUESTIONS_STORE = 'customQuestions';
const USER_PROFILE_STORE = 'userProfile';
const PROJECTS_STORE = 'projects';
const JOB_DESCRIPTIONS_STORE = 'jobDescriptions';
const ACTIVE_CONTEXT_STORE = 'activeContext';
const PRACTICE_HISTORY_STORE = 'practiceHistory';

// Single profile ID constant
export const DEFAULT_PROFILE_ID = 'default_user_profile';
export const DEFAULT_CONTEXT_ID = 'active_interview_context';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(FAVORITES_STORE)) {
        db.createObjectStore(FAVORITES_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CUSTOM_QUESTIONS_STORE)) {
        db.createObjectStore(CUSTOM_QUESTIONS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(USER_PROFILE_STORE)) {
        db.createObjectStore(USER_PROFILE_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(JOB_DESCRIPTIONS_STORE)) {
        db.createObjectStore(JOB_DESCRIPTIONS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(ACTIVE_CONTEXT_STORE)) {
        db.createObjectStore(ACTIVE_CONTEXT_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PRACTICE_HISTORY_STORE)) {
        db.createObjectStore(PRACTICE_HISTORY_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ----------------- SESSIONS (EXISTING) -----------------

export async function getAllSessions(): Promise<SessionRecord[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SESSIONS_STORE, 'readonly');
      const store = tx.objectStore(SESSIONS_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const sorted = (req.result as SessionRecord[]).sort((a, b) => b.createdAt - a.createdAt);
        resolve(sorted);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('copilot_sessions');
      return raw ? JSON.parse(raw) : [];
    }
    return [];
  }
}

export async function saveSession(session: SessionRecord): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SESSIONS_STORE, 'readwrite');
      const store = tx.objectStore(SESSIONS_STORE);
      const req = store.put(session);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    if (typeof window !== 'undefined') {
      const sessions = await getAllSessions();
      const existingIdx = sessions.findIndex(s => s.id === session.id);
      if (existingIdx >= 0) {
        sessions[existingIdx] = session;
      } else {
        sessions.unshift(session);
      }
      localStorage.setItem('copilot_sessions', JSON.stringify(sessions));
    }
  }
}

export async function deleteSession(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SESSIONS_STORE, 'readwrite');
      const store = tx.objectStore(SESSIONS_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    if (typeof window !== 'undefined') {
      const sessions = (await getAllSessions()).filter(s => s.id !== id);
      localStorage.setItem('copilot_sessions', JSON.stringify(sessions));
    }
  }
}

// ----------------- FAVORITES (EXISTING) -----------------

export async function getFavoriteQuestionIds(): Promise<string[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FAVORITES_STORE, 'readonly');
      const store = tx.objectStore(FAVORITES_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        resolve((req.result as { id: string }[]).map(item => item.id));
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('copilot_favorites');
      return raw ? JSON.parse(raw) : [];
    }
    return [];
  }
}

export async function toggleFavoriteQuestion(id: string): Promise<boolean> {
  const currentFavs = await getFavoriteQuestionIds();
  const isFav = currentFavs.includes(id);

  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FAVORITES_STORE, 'readwrite');
      const store = tx.objectStore(FAVORITES_STORE);
      if (isFav) {
        const req = store.delete(id);
        req.onsuccess = () => resolve(false);
        req.onerror = () => reject(req.error);
      } else {
        const req = store.put({ id, addedAt: Date.now() });
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      }
    });
  } catch {
    if (typeof window !== 'undefined') {
      const updated = isFav ? currentFavs.filter(f => f !== id) : [...currentFavs, id];
      localStorage.setItem('copilot_favorites', JSON.stringify(updated));
      return !isFav;
    }
    return !isFav;
  }
}

// ----------------- CUSTOM QUESTIONS (EXISTING) -----------------

export async function getCustomQuestions(): Promise<QuestionItem[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CUSTOM_QUESTIONS_STORE, 'readonly');
      const store = tx.objectStore(CUSTOM_QUESTIONS_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as QuestionItem[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('copilot_custom_questions');
      return raw ? JSON.parse(raw) : [];
    }
    return [];
  }
}

export async function saveCustomQuestion(question: QuestionItem): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CUSTOM_QUESTIONS_STORE, 'readwrite');
      const store = tx.objectStore(CUSTOM_QUESTIONS_STORE);
      const req = store.put(question);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    if (typeof window !== 'undefined') {
      const items = await getCustomQuestions();
      items.unshift(question);
      localStorage.setItem('copilot_custom_questions', JSON.stringify(items));
    }
  }
}

// ----------------- PERSONAL PROFILE (NEW) -----------------

export const INITIAL_USER_PROFILE: UserProfile = {
  id: DEFAULT_PROFILE_ID,
  name: 'Candidate Engineer',
  title: 'Full-Stack Software Engineer',
  email: '',
  location: '',
  summary: 'Software engineer passionate about high-throughput distributed systems, scalable web architectures, and resilient backend services.',
  education: [
    {
      id: 'edu_1',
      institution: 'University of Technology',
      degree: 'Bachelor of Technology',
      fieldOfStudy: 'Computer Science & Engineering',
      startDate: '2020',
      endDate: '2024',
      gpaOrGrade: '3.8 / 4.0',
      reasonForDegree: 'I chose Computer Science because I wanted deep structural mastery of distributed systems, algorithms, operating system concurrency, and network protocols.',
      highlights: ['Dean\'s Honor List', 'Head of Competitive Programming Club']
    }
  ],
  technicalSkills: [
    {
      category: 'Languages',
      skills: [
        {
          name: 'Java',
          level: 'Advanced',
          yearsOfExperience: 3,
          rationale: 'I chose Java because of its robust multithreading model, strong type safety, mature ecosystem, and prominence in high-throughput enterprise backends.'
        },
        {
          name: 'TypeScript',
          level: 'Advanced',
          yearsOfExperience: 3,
          rationale: 'TypeScript gives end-to-end type safety across client and server boundaries, preventing entire categories of runtime defects.'
        },
        {
          name: 'SQL',
          level: 'Advanced',
          yearsOfExperience: 3,
          rationale: 'Relational data modeling and transaction isolation are indispensable for mission-critical financial and transactional applications.'
        },
        {
          name: 'Python',
          level: 'Intermediate',
          yearsOfExperience: 2,
          rationale: 'Used for automation scripting, data pipelines, and rapid prototyping.'
        }
      ]
    },
    {
      category: 'Frameworks & Libraries',
      skills: [
        {
          name: 'Spring Boot',
          level: 'Advanced',
          yearsOfExperience: 3,
          rationale: 'Selected for enterprise REST microservices, auto-configured dependency injection, and battle-tested ORM integration via Spring Data JPA.'
        },
        {
          name: 'React / Next.js',
          level: 'Advanced',
          yearsOfExperience: 3,
          rationale: 'App Router and Server Components provide fast time-to-first-byte and clean architectural separation of server and client state.'
        },
        {
          name: 'Node.js',
          level: 'Advanced',
          yearsOfExperience: 3,
          rationale: 'Event-driven, non-blocking I/O ideal for real-time WebSocket communication and lightweight microservices.'
        }
      ]
    },
    {
      category: 'Databases & Storage',
      skills: [
        {
          name: 'PostgreSQL',
          level: 'Advanced',
          yearsOfExperience: 3,
          rationale: 'Strict ACID compliance, rich indexing mechanisms (B-tree, GIN), and native JSONB support make it an ideal primary data store.'
        },
        {
          name: 'Redis',
          level: 'Intermediate',
          yearsOfExperience: 2,
          rationale: 'Sub-millisecond in-memory cache and distributed locking primitive for rate limiting and session management.'
        }
      ]
    },
    {
      category: 'Cloud & DevOps',
      skills: [
        { name: 'Docker', level: 'Intermediate', yearsOfExperience: 2 },
        { name: 'Git & CI/CD', level: 'Advanced', yearsOfExperience: 4 },
        { name: 'Linux', level: 'Intermediate', yearsOfExperience: 3 }
      ]
    }
  ],
  careerGoals: {
    targetRoles: ['Full-Stack Engineer', 'Backend Engineer', 'Software Engineer II'],
    targetCompaniesOrIndustries: ['Enterprise SaaS', 'High-Growth Tech', 'FinTech'],
    shortTermGoals: 'Contribute to distributed backend microservices handling high concurrency, while deepening expertise in system observability and fault tolerance.',
    longTermGoals: 'Lead architectural design of large-scale, fault-tolerant distributed platforms as a Staff Engineer or Solutions Architect.',
    techStackRationale: {
      'Java': 'Java anchors my backend engineering because of its JVM performance, predictable garbage collection tuning, memory model, and rich Spring Boot ecosystem.',
      'PostgreSQL': 'I rely on PostgreSQL over document stores for transactional workloads because relational integrity, foreign key constraints, and explain-analyzed indexes prevent silent data corruption.',
      'Next.js': 'I use Next.js App Router for frontend engineering because Server Components reduce client JS payloads while enabling dynamic, responsive user experiences.'
    },
    cybersecurityOrDomainAdvantage: 'My foundation in cybersecurity principles ensures I integrate security into the software development lifecycle from day one—enforcing defense-in-depth, strict input sanitization, least-privilege RBAC, and secure token rotation rather than bolting security on as an afterthought.'
  },
  workExperience: [
    {
      id: 'work_1',
      company: 'Tech Innovations Lab',
      role: 'Software Engineering Intern',
      type: 'Internship',
      location: 'Remote',
      startDate: '2023-05',
      endDate: '2023-08',
      isCurrent: false,
      description: 'Engineered backend microservices and automated data synchronization pipelines.',
      achievements: [
        'Optimized slow database queries by redesigning composite indexes, reducing p99 latency from 850ms to 92ms.',
        'Implemented Redis caching layer that reduced database read load by 42% during peak hours.',
        'Wrote integration tests increasing test coverage from 58% to 84%.'
      ],
      technologiesUsed: ['Java', 'Spring Boot', 'PostgreSQL', 'Redis', 'Docker']
    }
  ],
  hackathonsAndCerts: [
    {
      id: 'cert_1',
      title: 'AWS Certified Cloud Practitioner',
      issuerOrEvent: 'Amazon Web Services',
      date: '2023',
      type: 'Certification',
      description: 'Validated foundational knowledge of AWS cloud services, security policies, and architectural best practices.'
    },
    {
      id: 'hack_1',
      title: 'First Place - National University Hackathon',
      issuerOrEvent: 'TechFest 2023',
      date: '2023-11',
      type: 'Hackathon',
      description: 'Built a collaborative peer learning platform with real-time screen sharing and AI code synthesis within 36 hours.'
    }
  ],
  strengthsAndWeaknesses: {
    technicalStrengths: [
      'Relational schema design, query indexing, and query optimization in PostgreSQL',
      'Building robust REST APIs in Java Spring Boot and TypeScript Node.js',
      'Systematic debugging and root cause analysis in production outages',
      'Security-first mindset: input validation, sanitization, and token security'
    ],
    areasForImprovement: [
      {
        area: 'Kubernetes production orchestration at scale',
        remediationAction: 'Hands-on lab training deploying multi-pod clusters with Helm charts and automated horizontal pod autoscaling (HPA).'
      },
      {
        area: 'Advanced distributed tracing with OpenTelemetry',
        remediationAction: 'Instrumenting sample microservice architectures with Jaeger and OpenTelemetry collectors to observe request propagation.'
      }
    ]
  },
  realChallenges: [
    {
      id: 'chal_1',
      title: 'PostgreSQL Connection Pool Starvation during Flash Sale Peak',
      context: 'During an unannounced traffic surge, the backend service experienced API timeouts and HTTP 500 errors.',
      technicalProblem: 'Database connection pool max limit (20 connections) was exhausted because unindexed search queries held transactions open for over 4.5 seconds each, blocking all subsequent incoming requests.',
      investigationSteps: 'Checked PostgreSQL pg_stat_activity to identify locked transactions and ran EXPLAIN ANALYZE on slow queries.',
      solutionAndFix: 'Added a composite B-tree index on (status, created_at) and configured connection pool timeout to fail-fast after 250ms, while caching hot catalog queries in Redis.',
      tradeoffsConsidered: 'Considered simply doubling connection pool size, but that would have overwhelmed DB CPU without solving query inefficiency.',
      lessonsLearned: 'Never treat database connection pools as infinite buffers; address underlying query latency and apply circuit breakers before scaling resource allocations.',
      relatedProjectOrRole: 'Tech Innovations Lab Internship'
    }
  ],
  updatedAt: Date.now()
};

export async function getUserProfile(): Promise<UserProfile> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(USER_PROFILE_STORE, 'readonly');
      const store = tx.objectStore(USER_PROFILE_STORE);
      const req = store.get(DEFAULT_PROFILE_ID);
      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result as UserProfile);
        } else {
          // Initialize with default
          saveUserProfile(INITIAL_USER_PROFILE).then(() => resolve(INITIAL_USER_PROFILE));
        }
      };
      req.onerror = () => resolve(INITIAL_USER_PROFILE);
    });
  } catch {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('copilot_user_profile');
      if (raw) {
        try { return JSON.parse(raw); } catch {}
      }
      localStorage.setItem('copilot_user_profile', JSON.stringify(INITIAL_USER_PROFILE));
    }
    return INITIAL_USER_PROFILE;
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const updated: UserProfile = { ...profile, id: DEFAULT_PROFILE_ID, updatedAt: Date.now() };
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(USER_PROFILE_STORE, 'readwrite');
      const store = tx.objectStore(USER_PROFILE_STORE);
      const req = store.put(updated);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    if (typeof window !== 'undefined') {
      localStorage.setItem('copilot_user_profile', JSON.stringify(updated));
    }
  }
}

// ----------------- PROJECT VAULT (NEW) -----------------

export const INITIAL_PROJECTS: ProjectRecord[] = [
  {
    id: 'proj_echocopilot',
    name: 'EchoCopilot',
    tagline: 'Real-Time AI Interview Copilot & Career Assistant',
    problemStatement: 'Engineers face high anxiety, blank-out moments, and difficulty articulating their authentic project contributions during technical and behavioral interviews.',
    targetUsers: 'Software engineers, candidates preparing for technical interviews, and tech job seekers.',
    architecture: 'Full-stack Next.js App Router application with dual audio pipeline (Web Audio API & Web Speech), client-side IndexedDB persistence, and an Electron frameless floating overlay with native screen-capture exclusion.',
    technologyStack: [
      {
        name: 'Next.js 16 (App Router)',
        role: 'Frontend',
        whyChosen: 'Next.js App Router provides unified server route handlers for AI streaming, automatic code splitting, and zero-configuration Turbopack performance.',
        alternativesConsidered: 'Considered pure Vite React SPA, but Next.js provided native Server-Sent Events (SSE) streaming and Node.js route handlers without requiring a separate backend service.'
      },
      {
        name: 'TypeScript',
        role: 'Frontend',
        whyChosen: 'Guarantees strict type safety across audio processing buffers, multi-speaker transcripts, and structured AI response payloads.',
        alternativesConsidered: 'JavaScript was considered but rejected due to high risk of runtime type errors with complex audio and stream models.'
      },
      {
        name: 'Tailwind CSS v4',
        role: 'Frontend',
        whyChosen: 'Provides responsive, dark-mode first utility styling with high rendering performance and zero runtime CSS overhead.'
      },
      {
        name: 'IndexedDB',
        role: 'Database',
        whyChosen: 'Stores all candidate profiles, transcripts, and verified contributions 100% locally on the candidate\'s machine with zero cloud data transmission for privacy.',
        alternativesConsidered: 'Cloud databases (Firebase / Supabase) were considered but rejected to honor strict user privacy guarantees.'
      },
      {
        name: 'Web Audio & Web Speech API',
        role: 'Other',
        whyChosen: 'Enables direct in-browser microphone capture, meeting tab capture via getDisplayMedia, and client-side speech recognition with zero server latency.'
      }
    ],
    majorFeatures: [
      {
        id: 'feat_1',
        name: 'Dual Audio Stream Capture & Feedback Loop Prevention',
        description: 'Separates candidate microphone voice from meeting interviewer audio to prevent self-transcription loops.',
        implementationDetails: 'Uses distinct MediaStreamTracks, Web Audio AnalyserNodes, and speaker identification heuristics.'
      },
      {
        id: 'feat_2',
        name: 'Personalized Career Context & Anti-Hallucination Engine',
        description: 'Synthesizes authentic first-person interview answers from verified project contributions and personal career goals.',
        implementationDetails: 'Constructs 4-tier structured responses (Direct Answer -> Motivation -> Real Example -> Career Goal) and prompts candidate if key data is missing.'
      },
      {
        id: 'feat_3',
        name: 'Floating Electron HUD with Screen-Capture Exclusion',
        description: 'Provides an always-on-top transparent HUD hidden from screen sharing.',
        implementationDetails: 'Leverages Electron BrowserWindow.setContentProtection(true) using Windows WDA_EXCLUDEFROMCAPTURE.'
      }
    ],
    databaseSchemaAndApi: {
      databaseType: 'Client-side IndexedDB (EchoInterviewCopilotDB)',
      majorEntitiesOrTables: ['userProfile', 'projects', 'jobDescriptions', 'sessions', 'practiceHistory'],
      apiDesignPatterns: ['REST Next.js Route Handlers', 'Server-Sent Events (SSE) Streaming'],
      keyEndpoints: ['/api/copilot', '/api/personalized-answer', '/api/personalized-questions', '/api/mock']
    },
    securityAndPerformance: {
      securityMeasures: [
        'Strict Secret Sanitizer blocking .env, API keys, tokens, and passwords from ever being indexed',
        'Zero cloud transmission of candidate profile and session transcripts by default'
      ],
      performanceOptimizations: [
        'Sub-300ms time-to-first-token streaming via local Ollama and Groq',
        '30-second speech question deduplication cache to prevent redundant LLM invocations'
      ]
    },
    verifiedContributions: [
      {
        id: 'vc_1',
        area: 'Personalized Career & Question Generation Engine',
        description: 'Personally architected the dynamic question generator, anti-hallucination guardrail, and 4-part answer synthesis engine.',
        isPersonallyImplemented: true
      },
      {
        id: 'vc_2',
        area: 'Secret Sanitizer & Credential Shield',
        description: 'Personally implemented the regex and filename scanner that filters secrets and .env files before project indexing.',
        isPersonallyImplemented: true
      },
      {
        id: 'vc_3',
        area: 'IndexedDB Version 2 Persistence Layer',
        description: 'Personally designed the multi-store client database with localStorage fallback and export/import.',
        isPersonallyImplemented: true
      }
    ],
    challengesAndSolutions: [
      {
        id: 'pc_1',
        challenge: 'Acoustic Feedback Loop in Live Copilot',
        solution: 'Reading an AI answer aloud triggered the microphone, creating an endless AI self-prompt loop. Solved by implementing source-separated MediaStreams and an Answer Trigger Policy that only invokes AI when meeting tab audio speaks.'
      },
      {
        id: 'pc_2',
        challenge: 'Preventing AI Hallucination on Missing Contributions',
        solution: 'Built an explicit missing context detector that checks if personal technical choices or contributions exist; if absent, the engine returns an interactive follow-up question card rather than fabricating an answer.'
      }
    ],
    limitationsAndImprovements: {
      knownLimitations: [
        'Web Speech API requires Google Chrome or Microsoft Edge for native continuous transcription.'
      ],
      whatWouldYouImproveIfRebuilt: 'I would integrate a local WebAssembly-based Whisper model for fully browser-native offline transcription across all browsers without requiring Python or external STT servers.'
    },
    updatedAt: Date.now()
  }
];

export async function getAllProjects(): Promise<ProjectRecord[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(PROJECTS_STORE, 'readonly');
      const store = tx.objectStore(PROJECTS_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const results = req.result as ProjectRecord[];
        if (results && results.length > 0) {
          resolve(results.sort((a, b) => b.updatedAt - a.updatedAt));
        } else {
          // Initialize with default project
          saveProject(INITIAL_PROJECTS[0]).then(() => resolve(INITIAL_PROJECTS));
        }
      };
      req.onerror = () => resolve(INITIAL_PROJECTS);
    });
  } catch {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('copilot_projects');
      if (raw) {
        try { return JSON.parse(raw); } catch {}
      }
      localStorage.setItem('copilot_projects', JSON.stringify(INITIAL_PROJECTS));
    }
    return INITIAL_PROJECTS;
  }
}

export async function getProject(id: string): Promise<ProjectRecord | null> {
  const projects = await getAllProjects();
  return projects.find(p => p.id === id) || null;
}

export async function saveProject(project: ProjectRecord): Promise<void> {
  const updated: ProjectRecord = { ...project, updatedAt: Date.now() };
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PROJECTS_STORE, 'readwrite');
      const store = tx.objectStore(PROJECTS_STORE);
      const req = store.put(updated);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    if (typeof window !== 'undefined') {
      const projects = await getAllProjects();
      const idx = projects.findIndex(p => p.id === updated.id);
      if (idx >= 0) projects[idx] = updated;
      else projects.unshift(updated);
      localStorage.setItem('copilot_projects', JSON.stringify(projects));
    }
  }
}

export async function deleteProject(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PROJECTS_STORE, 'readwrite');
      const store = tx.objectStore(PROJECTS_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    if (typeof window !== 'undefined') {
      const projects = (await getAllProjects()).filter(p => p.id !== id);
      localStorage.setItem('copilot_projects', JSON.stringify(projects));
    }
  }
}

// ----------------- TARGET JOB DESCRIPTIONS (NEW) -----------------

export async function getAllJobDescriptions(): Promise<TargetJobDescription[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(JOB_DESCRIPTIONS_STORE, 'readonly');
      const store = tx.objectStore(JOB_DESCRIPTIONS_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as TargetJobDescription[]).sort((a, b) => b.updatedAt - a.updatedAt));
      req.onerror = () => resolve([]);
    });
  } catch {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('copilot_jds');
      return raw ? JSON.parse(raw) : [];
    }
    return [];
  }
}

export async function saveJobDescription(jd: TargetJobDescription): Promise<void> {
  const updated: TargetJobDescription = { ...jd, updatedAt: Date.now() };
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(JOB_DESCRIPTIONS_STORE, 'readwrite');
      const store = tx.objectStore(JOB_DESCRIPTIONS_STORE);
      const req = store.put(updated);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    if (typeof window !== 'undefined') {
      const jds = await getAllJobDescriptions();
      const idx = jds.findIndex(j => j.id === updated.id);
      if (idx >= 0) jds[idx] = updated;
      else jds.unshift(updated);
      localStorage.setItem('copilot_jds', JSON.stringify(jds));
    }
  }
}

export async function deleteJobDescription(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(JOB_DESCRIPTIONS_STORE, 'readwrite');
      const store = tx.objectStore(JOB_DESCRIPTIONS_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    if (typeof window !== 'undefined') {
      const jds = (await getAllJobDescriptions()).filter(j => j.id !== id);
      localStorage.setItem('copilot_jds', JSON.stringify(jds));
    }
  }
}

// ----------------- ACTIVE CONTEXT (NEW) -----------------

export const DEFAULT_ACTIVE_CONTEXT: ActiveInterviewContext = {
  activeProfileId: DEFAULT_PROFILE_ID,
  selectedProjectIds: ['proj_echocopilot'],
  practiceTrack: 'technical'
};

export async function getActiveContext(): Promise<ActiveInterviewContext> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(ACTIVE_CONTEXT_STORE, 'readonly');
      const store = tx.objectStore(ACTIVE_CONTEXT_STORE);
      const req = store.get(DEFAULT_CONTEXT_ID);
      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result as ActiveInterviewContext);
        } else {
          resolve(DEFAULT_ACTIVE_CONTEXT);
        }
      };
      req.onerror = () => resolve(DEFAULT_ACTIVE_CONTEXT);
    });
  } catch {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('copilot_active_context');
      return raw ? JSON.parse(raw) : DEFAULT_ACTIVE_CONTEXT;
    }
    return DEFAULT_ACTIVE_CONTEXT;
  }
}

export async function saveActiveContext(context: ActiveInterviewContext): Promise<void> {
  const toSave = { ...context, id: DEFAULT_CONTEXT_ID };
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ACTIVE_CONTEXT_STORE, 'readwrite');
      const store = tx.objectStore(ACTIVE_CONTEXT_STORE);
      const req = store.put(toSave);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    if (typeof window !== 'undefined') {
      localStorage.setItem('copilot_active_context', JSON.stringify(toSave));
    }
  }
}

// ----------------- PRACTICE HISTORY (NEW) -----------------

export async function savePracticeTurn(turn: PracticeTurnFeedback): Promise<void> {
  const id = `practice_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const item = { ...turn, id, timestamp: Date.now() };

  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PRACTICE_HISTORY_STORE, 'readwrite');
      const store = tx.objectStore(PRACTICE_HISTORY_STORE);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('copilot_practice_history');
      const history = raw ? JSON.parse(raw) : [];
      history.unshift(item);
      localStorage.setItem('copilot_practice_history', JSON.stringify(history.slice(0, 50)));
    }
  }
}
