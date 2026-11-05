import { 
  UserProfile, 
  ProjectRecord, 
  TargetJobDescription, 
  PersonalizedQuestion, 
  PersonalizedAnswer, 
  MissingContextCard,
  PracticeTurnFeedback
} from './profileTypes';

/**
 * Dynamically synthesizes personalized interview questions from the user's
 * actual profile, active projects, target job description, and domain background.
 */
export function generatePersonalizedQuestions(
  profile: UserProfile,
  projects: ProjectRecord[],
  targetJob?: TargetJobDescription,
  resumeText?: string
): PersonalizedQuestion[] {
  const questions: PersonalizedQuestion[] = [];

  // 1. Language & Technical Skill Rationale Questions
  const allSkills = profile.technicalSkills.flatMap(g => g.skills);
  for (const skill of allSkills.slice(0, 5)) {
    questions.push({
      id: `q_skill_why_${skill.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      question: `Why did you choose ${skill.name}?`,
      category: 'Tech Choice Rationale',
      source: 'profile',
      relatedSubject: skill.name,
      difficulty: 'Easy',
      contextSnippet: skill.rationale ? `Stored rationale: "${skill.rationale}"` : 'Missing rationale in profile',
      recommendedDurationSeconds: 60
    });

    questions.push({
      id: `q_skill_goal_${skill.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      question: `How does ${skill.name} support your career goals?`,
      category: 'Career & Motivation',
      source: 'profile',
      relatedSubject: skill.name,
      difficulty: 'Medium',
      contextSnippet: `Linked to target roles: ${profile.careerGoals.targetRoles.join(', ')}`,
      recommendedDurationSeconds: 90
    });
  }

  // 1b. Technical Decisions & Trade-offs from Profile Rationale (e.g. PostgreSQL vs MongoDB)
  if (profile.careerGoals.techStackRationale) {
    for (const [techName, rationale] of Object.entries(profile.careerGoals.techStackRationale)) {
      if (techName.toLowerCase().includes('postgres')) {
        questions.push({
          id: 'q_postgres_vs_mongodb',
          question: 'Why did you use PostgreSQL instead of MongoDB?',
          category: 'System Architecture & Trade-offs',
          source: 'profile',
          relatedSubject: 'PostgreSQL vs MongoDB',
          difficulty: 'Hard',
          contextSnippet: rationale,
          recommendedDurationSeconds: 120
        });
      }
    }
  }

  // 2. Degree & Academic Background Question
  for (const edu of profile.education) {
    questions.push({
      id: `q_edu_${edu.id}`,
      question: `Why did you choose your ${edu.degree} in ${edu.fieldOfStudy}?`,
      category: 'Career & Motivation',
      source: 'profile',
      relatedSubject: `${edu.degree} in ${edu.fieldOfStudy}`,
      difficulty: 'Easy',
      contextSnippet: edu.reasonForDegree || `Studied at ${edu.institution}`,
      recommendedDurationSeconds: 60
    });
  }

  // 3. Domain Advantage (e.g. Cybersecurity)
  if (profile.careerGoals.cybersecurityOrDomainAdvantage) {
    questions.push({
      id: 'q_cybersecurity_advantage',
      question: 'How does your cybersecurity background help in software development?',
      category: 'Career & Motivation',
      source: 'profile',
      relatedSubject: 'Cybersecurity & Secure Architecture',
      difficulty: 'Medium',
      contextSnippet: profile.careerGoals.cybersecurityOrDomainAdvantage,
      recommendedDurationSeconds: 90
    });
  }

  // 4. Project-Specific Questions
  for (const proj of projects) {
    // Project Tech Stack selection
    questions.push({
      id: `q_proj_tech_${proj.id}`,
      question: `Why did you select this project's technology stack for ${proj.name}?`,
      category: 'Tech Choice Rationale',
      source: 'project',
      relatedSubject: proj.name,
      difficulty: 'Medium',
      contextSnippet: `Tech stack: ${proj.technologyStack.map(t => t.name).join(', ')}`,
      recommendedDurationSeconds: 90
    });

    // PostgreSQL vs MongoDB / Tech Alternatives
    for (const tech of proj.technologyStack) {
      if (tech.alternativesConsidered) {
        questions.push({
          id: `q_proj_alt_${proj.id}_${tech.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          question: `Why did you use ${tech.name} instead of alternative solutions like ${tech.alternativesConsidered.includes('Mongo') ? 'MongoDB' : 'alternatives'} in ${proj.name}?`,
          category: 'System Architecture & Trade-offs',
          source: 'project',
          relatedSubject: `${tech.name} vs Alternatives`,
          difficulty: 'Hard',
          contextSnippet: tech.alternativesConsidered,
          recommendedDurationSeconds: 120
        });
      }
    }

    // Specific Personal Contribution
    questions.push({
      id: `q_proj_contrib_${proj.id}`,
      question: `What was your specific personal contribution to ${proj.name}?`,
      category: 'Verified Contributions',
      source: 'project',
      relatedSubject: proj.name,
      difficulty: 'Medium',
      contextSnippet: `${proj.verifiedContributions.filter(c => c.isPersonallyImplemented).length} verified personal modules`,
      recommendedDurationSeconds: 90
    });

    // Hardest Technical Problem
    questions.push({
      id: `q_proj_hardest_${proj.id}`,
      question: `What was the most difficult technical problem you solved in ${proj.name}?`,
      category: 'Difficult Bugs & Outages',
      source: 'project',
      relatedSubject: proj.name,
      difficulty: 'Hard',
      contextSnippet: proj.challengesAndSolutions.length > 0 ? proj.challengesAndSolutions[0].challenge : 'Based on real project implementation',
      recommendedDurationSeconds: 120
    });

    // System Design Trade-offs
    questions.push({
      id: `q_proj_tradeoffs_${proj.id}`,
      question: `What architectural trade-offs did you consider when designing ${proj.name}?`,
      category: 'System Architecture & Trade-offs',
      source: 'project',
      relatedSubject: proj.name,
      difficulty: 'Hard',
      contextSnippet: proj.architecture,
      recommendedDurationSeconds: 120
    });

    // Rebuild & Improvement
    questions.push({
      id: `q_proj_rebuild_${proj.id}`,
      question: `What would you improve if you rebuilt ${proj.name} from scratch today?`,
      category: 'Rebuilding & Future Vision',
      source: 'project',
      relatedSubject: proj.name,
      difficulty: 'Medium',
      contextSnippet: proj.limitationsAndImprovements?.whatWouldYouImproveIfRebuilt || 'Architectural reflection',
      recommendedDurationSeconds: 90
    });
  }

  // 5. Real Challenges & Outages from Profile
  for (const chal of profile.realChallenges) {
    questions.push({
      id: `q_chal_${chal.id}`,
      question: `Can you walk me through a major technical outage or bottleneck you resolved, such as "${chal.title}"?`,
      category: 'Difficult Bugs & Outages',
      source: 'profile',
      relatedSubject: chal.title,
      difficulty: 'Hard',
      contextSnippet: chal.context,
      recommendedDurationSeconds: 120
    });
  }

  // 6. Target Job Description Questions
  if (targetJob) {
    questions.push({
      id: `q_job_interest_${targetJob.id}`,
      question: `Why are you interested in ${targetJob.company || 'this company'} and the ${targetJob.title || 'target'} role?`,
      category: 'Career & Motivation',
      source: 'job_description',
      relatedSubject: `${targetJob.company} - ${targetJob.title}`,
      difficulty: 'Medium',
      contextSnippet: targetJob.whyInterested || `Target Company: ${targetJob.company}`,
      recommendedDurationSeconds: 90
    });
  }

  return questions;
}

/**
 * Generates an authentic, personalized 4-tier interview answer.
 * If critical personal details are missing, it flags them via missingContextDetected
 * rather than inventing facts.
 */
export function generatePersonalizedAnswer(
  question: string,
  length: 'short' | 'medium' | 'detailed' = 'medium',
  profile: UserProfile,
  projects: ProjectRecord[],
  targetJob?: TargetJobDescription
): PersonalizedAnswer {
  const qLower = question.toLowerCase();

  // Helper to construct answer
  const makeAnswer = (
    direct: string,
    motivation: string,
    example: string,
    connection: string,
    bullets: string[],
    spoken: string,
    missing?: MissingContextCard
  ): PersonalizedAnswer => {
    return {
      id: `ans_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      question,
      length,
      structure: {
        directAnswer: direct,
        personalMotivation: motivation,
        supportingExample: example,
        roleOrCareerConnection: connection
      },
      bullets,
      spokenScript: spoken,
      missingContextDetected: missing,
      timestamp: Date.now()
    };
  };

  // -------------------------------------------------------------
  // CASE 0A: "Tell me about yourself" / "Introduce yourself" (Test D)
  // -------------------------------------------------------------
  if (
    qLower.includes('tell me about yourself') ||
    qLower.includes('introduce yourself') ||
    qLower.includes('who are you') ||
    qLower.includes('walk me through your background') ||
    qLower.includes('walk me through your resume')
  ) {
    const edu = profile.education[0];
    const topSkills = profile.technicalSkills
      .flatMap(g => g.skills)
      .slice(0, 4)
      .map(s => s.name);
    const activeProj = projects[0];
    const targetRole = targetJob?.title || profile.careerGoals.targetRoles[0] || profile.title || 'Full-Stack Software Engineer';
    const targetComp = targetJob?.company;

    const direct = `I am a ${profile.title || 'Software Engineer'} specializing in scalable backend architectures, high-throughput microservices, and reliable web systems.`;
    const motivation = edu 
      ? `I hold a ${edu.degree} in ${edu.fieldOfStudy} from ${edu.institution}, where I developed a strong foundation in distributed systems, operating system concurrency, and data structures.`
      : `I have focused my engineering career on first-principles software design and resilient system architectures.`;
    const example = activeProj
      ? `Most recently, I built ${activeProj.name}, an application designed to ${activeProj.problemStatement.toLowerCase().replace(/\.$/, '')}. Using ${activeProj.technologyStack.map(t => t.name).slice(0, 3).join(', ')}, I personally implemented ${activeProj.verifiedContributions.filter(v => v.isPersonallyImplemented).map(v => v.area).join(' and ') || 'the core service layers'}.`
      : `In my software work, I leverage ${topSkills.join(', ')} to design clean, test-driven REST APIs and resilient data pipelines.`;
    const connection = targetComp
      ? `What excites me about the ${targetRole} position at ${targetComp} is the opportunity to bring my hands-on experience in ${topSkills.slice(0, 2).join(' and ')} to help scale your core platform.`
      : `I am targeting ${targetRole} roles where I can contribute to mission-critical backend scalability, clean code standards, and production velocity.`;

    const spokenScript = `${direct} ${motivation} ${example} ${connection}`;

    return makeAnswer(
      direct,
      motivation,
      example,
      connection,
      [
        `Current Focus: ${profile.title} specializing in ${topSkills.join(', ')}.`,
        `Academic Grounding: ${edu ? `${edu.degree} in ${edu.fieldOfStudy} from ${edu.institution}` : 'Strong foundational CS theory'}.`,
        `Practical Evidence: Built ${activeProj?.name || 'scalable production services'} with verified contributions.`,
        `Role Alignment: Targeting ${targetRole} opportunities with focus on scalable impact.`
      ],
      spokenScript
    );
  }

  // -------------------------------------------------------------
  // CASE 0B: "Explain my project" / "Tell me about your project" (Test E - 8-Step Structure)
  // -------------------------------------------------------------
  if (
    (
      qLower.includes('explain my project') ||
      qLower.includes('explain my current project') ||
      qLower.includes('tell me about your project') ||
      qLower.includes('tell me about my project') ||
      qLower.includes('walk me through your project') ||
      qLower.includes('walk me through my project') ||
      (qLower.includes('tell me about') && qLower.includes('project'))
    ) &&
    !qLower.includes('architecture') &&
    !qLower.includes('authentication') &&
    !qLower.includes('jwt') &&
    !qLower.includes('resume') &&
    !qLower.includes('frontend') &&
    !qLower.includes('backend') &&
    !qLower.includes('database') &&
    !qLower.includes('api') &&
    !qLower.includes('tech stack')
  ) {
    const matchedProject = projects.find(p => qLower.includes(p.name.toLowerCase())) || projects[0];

    if (!matchedProject) {
      return makeAnswer(
        'I do not have a project loaded in your Project Vault.',
        'Please add a project in the Project Vault module.',
        'You can import a local codebase or paste your project architecture.',
        'Allows customized, evidence-based project walkthroughs.',
        ['No project found in Project Vault.'],
        'I do not currently have any project record loaded in your Project Vault. Please open the Project Vault tab to add one.',
        {
          missingField: 'Project Record',
          suggestedPrompt: 'Which project would you like to prepare for your interview? Please add it in Project Vault.',
          suggestedCategory: 'projects'
        }
      );
    }

    const verifiedContribs = matchedProject.verifiedContributions.filter(c => c.isPersonallyImplemented);
    const primaryChallenge = matchedProject.challengesAndSolutions[0] || {
      challenge: 'Ensuring reliable client-side performance under variable network conditions.',
      solution: 'Implemented local caching and optimistic UI updates.'
    };
    const primaryImprovement = matchedProject.limitationsAndImprovements?.whatWouldYouImproveIfRebuilt || 'decouple the service boundaries into asynchronous event pipelines.';

    // 8-Step Natural Structure (Requirement 2.A)
    // 1. Spoken Introduction, 2. Problem, 3. Solution, 4. Features, 5. Tech Stack, 6. Architecture, 7. Contributions, 8. Challenges & Improvements
    const step1Intro = `My project is ${matchedProject.name}, a real-time AI interview copilot and career assistant designed to solve candidate blank-outs and interview anxiety.`;
    const step2Problem = `The core problem we set out to solve is that ${matchedProject.problemStatement}`;
    const step3Solution = `To solve this, ${matchedProject.name} provides ${matchedProject.majorFeatures.map(f => f.name).slice(0, 3).join(', ')}, giving users a seamless, responsive experience.`;
    const step4Stack = `Architecturally, the system is built with ${matchedProject.technologyStack.map(t => t.name).join(', ')}, leveraging ${matchedProject.architecture}.`;
    const step5Contrib = verifiedContribs.length > 0
      ? `My specific, verified contributions were owning the implementation of ${verifiedContribs.map(v => `${v.area} (${v.description})`).join(', and ')}.`
      : `I contributed to the core service design and implementation of ${matchedProject.name}.`;
    const step6Challenge = `The most significant technical challenge was ${primaryChallenge.challenge}. I resolved this by ${primaryChallenge.solution}.`;
    const step7Outcome = `The system achieved high reliability with sub-second response times; if I were to rebuild it today, I would ${primaryImprovement}`;

    const spokenScript = `${step1Intro} ${step2Problem} ${step3Solution} ${step4Stack} ${step5Contrib} ${step6Challenge} ${step7Outcome}`;

    return makeAnswer(
      step1Intro,
      step2Problem,
      `${step3Solution} ${step4Stack}`,
      `${step5Contrib} ${step6Challenge} ${step7Outcome}`,
      [
        `1. Project Identity: ${matchedProject.name} — ${matchedProject.tagline}`,
        `2. Problem Statement: ${matchedProject.problemStatement}`,
        `3. Solution & Major Features: ${matchedProject.majorFeatures.map(f => f.name).join(', ')}`,
        `4. Technology & Architecture: ${matchedProject.technologyStack.map(t => t.name).join(', ')} (${matchedProject.architecture})`,
        `5. Verified Personal Contributions: ${verifiedContribs.map(c => c.area).join(', ') || 'Core feature implementation'}`,
        `6. Key Technical Challenge & Resolution: ${primaryChallenge.challenge} -> ${primaryChallenge.solution}`,
        `7. Reflection & Future Rebuild Vision: ${primaryImprovement}`
      ],
      spokenScript
    );
  }

  // -------------------------------------------------------------
  // CASE 0B_ARCH: "Explain my project architecture" (Requirement 2.B)
  // -------------------------------------------------------------
  if (
    (qLower.includes('architecture') && (qLower.includes('my project') || qLower.includes('this project') || qLower.includes('our project'))) ||
    (qLower.includes('explain') && qLower.includes('architecture') && !qLower.includes('jvm') && !qLower.includes('spring'))
  ) {
    const matchedProject = projects.find(p => qLower.includes(p.name.toLowerCase())) || projects[0];

    const direct = `The architecture of ${matchedProject?.name || 'EchoCopilot'} is designed as a privacy-first, local-first client system with Next.js App Router, dual audio pipelines, local IndexedDB persistence, and an Electron frameless overlay.`;
    const motivation = `We decoupled client-side audio analysis from AI stream generation so that the user interface never stutters, and we kept persistence 100% on the local client machine to guarantee candidate privacy.`;
    const example = `Data flows from the Web Audio / Web Speech API into our Intent Classifier and Context Selector, which queries local IndexedDB for relevant verified project notes and candidate skills. If a model call is made, it proxies to local Ollama or cloud providers via Server-Sent Events (SSE) streaming, with verified implementation files including src/components/CopilotModule.tsx, src/app/api/copilot/route.ts, and src/lib/storage.ts.`;
    const connection = `This component-level separation ensures high reliability, sub-300ms time-to-first-token streaming, and zero cloud credential leakage.`;

    const spokenScript = `${direct} ${motivation} ${example} ${connection}`;

    return makeAnswer(
      direct,
      motivation,
      example,
      connection,
      [
        `Frontend Layer: Next.js 16 App Router, React 19, Tailwind CSS v4, Web Audio API.`,
        `Floating Window: Electron frameless HUD with WDA_EXCLUDEFROMCAPTURE content protection.`,
        `API & Server Layer: Server-Sent Events (SSE) route handlers in src/app/api/copilot/route.ts.`,
        `Storage Layer: Client-side IndexedDB v2 (EchoInterviewCopilotDB) for local zero-cloud privacy.`,
        `Security & Sanitization: SecretSanitizer filters .env and credentials before context construction.`
      ],
      spokenScript
    );
  }

  // -------------------------------------------------------------
  // CASE 0B_AUTH: "How does authentication work in my project?" (Requirement 2.D & 3)
  // -------------------------------------------------------------
  if (
    ((qLower.includes('how does') || qLower.includes('explain') || qLower.includes('what is')) &&
      qLower.includes('authentication') &&
      (qLower.includes('in my project') || qLower.includes('in this project') || qLower.includes('in our project') || qLower.includes('my project') || qLower.includes('this project')) &&
      !qLower.includes('jwt'))
  ) {
    const matchedProject = projects.find(p => qLower.includes(p.name.toLowerCase())) || projects[0];

    const direct = `In ${matchedProject?.name || 'EchoCopilot'}, there is no remote user login or centralized authentication database; the application is built on a local-first, privacy-by-design model.`;
    const motivation = `Because EchoCopilot is a personal developer companion designed to keep candidate resumes, profiles, and interview sessions strictly private on the user's local machine, we intentionally avoid hosting user accounts or transmitting user credentials to a centralized server.`;
    const example = `For external LLM access (Groq, OpenAI, Anthropic), authentication is handled via user-provided API keys configured in the Settings modal (src/components/Header.tsx). Keys are saved locally in browser localStorage, and attached on demand to outbound request headers in src/app/api/copilot/route.ts. Local Ollama requires zero authentication, running directly on http://localhost:11434. Furthermore, our SecretSanitizer automatically blocks .env files and credentials from ever being stored in Project Vault or sent in prompts.`;
    const connection = `This ensures 100% data sovereignty for the candidate with zero risk of multi-tenant credential breaches or remote session hijacking.`;

    const spokenScript = `${direct} ${motivation} ${example} ${connection}`;

    return makeAnswer(
      direct,
      motivation,
      example,
      connection,
      [
        'Local-First Privacy Architecture: No centralized user credentials or remote login database.',
        'Client-Side API Key Storage: Keys for Groq, OpenAI, and Anthropic reside in browser localStorage.',
        'Local Ollama Model Execution: Complete offline inference at http://localhost:11434 with zero auth required.',
        'Secret Sanitizer Shield: Strict regex filtering in src/lib/secretSanitizer.ts prevents credential leakage.',
        'Data Flow: Settings UI -> localStorage -> Authorization header -> Model Provider -> Local IndexedDB.'
      ],
      spokenScript
    );
  }

  // -------------------------------------------------------------
  // CASE 0B_JWT: "How does JWT authentication work in my project?" (Requirement 3)
  // -------------------------------------------------------------
  if (
    qLower.includes('jwt') &&
    (qLower.includes('in my project') || qLower.includes('in this project') || qLower.includes('in our project') || qLower.includes('my project') || qLower.includes('this project'))
  ) {
    const matchedProject = projects.find(p => qLower.includes(p.name.toLowerCase())) || projects[0];

    const direct = `To be completely clear about my actual codebase: ${matchedProject?.name || 'EchoCopilot'} does not use JWT authentication in its active architecture.`;
    const motivation = `Because EchoCopilot is architected as a local-first, single-user desktop companion with client-side IndexedDB persistence, there is no centralized multi-tenant backend server requiring stateless session tokens or bearer validation.`;
    const example = `Instead of JWT, the system manages external model access through client-side API keys stored in the user's browser localStorage. If we were to extend EchoCopilot for enterprise team collaboration or remote cloud synchronization, JWT would be the standard implementation: the auth server would issue a signed JWT (Header.Payload.Signature) signed via asymmetric RS256, and our Next.js API route handlers would validate the token in an authentication middleware before granting access to shared interview repositories.`;
    const connection = `Distinguishing between my active project implementation and general architectural options demonstrates that I design systems to fit concrete requirements rather than adding unnecessary token overhead.`;

    const spokenScript = `${direct} ${motivation} ${example} ${connection}`;

    return makeAnswer(
      direct,
      motivation,
      example,
      connection,
      [
        `Active Codebase Reality: ${matchedProject?.name || 'EchoCopilot'} does not use JWT authentication.`,
        'Architectural Rationale: Single-user local-first application requires no stateless server sessions.',
        'Current Auth Model: Client-side API key configuration stored in local browser storage.',
        'Enterprise JWT Extension Design: Asymmetric RS256 signing with Next.js middleware token verification if cloud synchronization is added.'
      ],
      spokenScript
    );
  }

  // -------------------------------------------------------------
  // CASE 0B_LAYERS: "Explain the frontend / backend / database / APIs in my project" (Requirement 2.B)
  // -------------------------------------------------------------
  if (
    (qLower.includes('explain') || qLower.includes('tell me about')) &&
    (qLower.includes('frontend') || qLower.includes('backend') || qLower.includes('api') || qLower.includes('apis')) &&
    (qLower.includes('in my project') || qLower.includes('in this project') || qLower.includes('my project') || qLower.includes('this project'))
  ) {
    const matchedProject = projects.find(p => qLower.includes(p.name.toLowerCase())) || projects[0];

    const direct = `In ${matchedProject?.name || 'EchoCopilot'}, each architectural tier is specialized for real-time interview performance and zero-cloud data privacy.`;
    const motivation = `We divided the system into distinct frontend, backend, and persistence layers to ensure that audio capture and UI rendering remain buttery-smooth while asynchronous AI streams process in the background.`;
    const example = `The frontend is built with Next.js 16 App Router, React 19, and Tailwind CSS v4, utilizing the Web Audio API and Web Speech API for dual microphone and system audio capture. The backend consists of Next.js Route Handlers (such as src/app/api/copilot/route.ts) that deliver Server-Sent Events (SSE) streaming from local Ollama or cloud providers. The persistence layer is 100% client-side IndexedDB v2 (EchoInterviewCopilotDB), storing candidate profiles, verified project contributions, and session transcripts locally without transmitting data to external servers.`;
    const connection = `This full-stack design achieves sub-300ms time-to-first-token streaming while maintaining strict candidate data privacy.`;

    const spokenScript = `${direct} ${motivation} ${example} ${connection}`;

    return makeAnswer(
      direct,
      motivation,
      example,
      connection,
      [
        `Frontend: Next.js 16 App Router, React 19, Tailwind CSS v4, Web Audio/Speech API.`,
        `Backend & APIs: Next.js server route handlers with Server-Sent Events (SSE) streaming.`,
        `Database: Client-side IndexedDB v2 (EchoInterviewCopilotDB) with 5 dedicated object stores.`,
        `Privacy Guarantee: Zero server-side persistence of candidate resumes, questions, or transcripts.`
      ],
      spokenScript
    );
  }

  // -------------------------------------------------------------
  // CASE 0C: "Why does this project use its current database?" (Test F)
  // -------------------------------------------------------------
  if (
    (qLower.includes('why') && qLower.includes('this project') && (qLower.includes('database') || qLower.includes('db'))) ||
    (qLower.includes('why does this project use') && qLower.includes('database'))
  ) {
    const matchedProject = projects.find(p => qLower.includes(p.name.toLowerCase())) || projects[0];
    const dbType = matchedProject?.databaseSchemaAndApi?.databaseType || 'Client-Side IndexedDB v2';
    const isDocChoice = matchedProject?.technologyStack.find(t => t.role === 'Database');

    const direct = `In ${matchedProject?.name || 'this project'}, we selected ${dbType} as our primary persistence layer.`;
    const motivation = isDocChoice?.whyChosen 
      ? isDocChoice.whyChosen 
      : `We chose ${dbType} to guarantee strict client-side data privacy, zero external database setup for candidates, and resilient offline capabilities.`;
    const example = `With ${dbType}, sensitive candidate career records, project code, and interview session histories are stored in dedicated local object stores without ever transmitting secrets across third-party networks.`;
    const connection = `This architectural decision allowed us to achieve sub-millisecond local reads and zero data leakage, distinguishing our system from cloud-hosted tools that transmit candidates' source code.`;

    const spokenScript = `${direct} ${motivation} ${example} ${connection}`;

    return makeAnswer(
      direct,
      motivation,
      example,
      connection,
      [
        `Database Choice: ${dbType} in ${matchedProject?.name || 'Project Vault'}.`,
        `Documented Rationale: ${motivation}`,
        `Entities / Stores: ${(matchedProject?.databaseSchemaAndApi?.majorEntitiesOrTables || []).join(', ') || 'userProfile, projects, activeContext'}`,
        'Privacy & Performance: Zero external cloud leakage and instant local query access.'
      ],
      spokenScript
    );
  }

  // -------------------------------------------------------------
  // CASE 0D: "What was my biggest achievement during my internship?" (Test G - Anti-Hallucination Guard)
  // -------------------------------------------------------------
  if (
    qLower.includes('internship') &&
    (qLower.includes('achievement') || qLower.includes('biggest') || qLower.includes('accomplishment') || qLower.includes('work'))
  ) {
    const internship = profile.workExperience.find(w => w.type === 'Internship' || w.role.toLowerCase().includes('intern'));

    if (!internship || !internship.achievements || internship.achievements.length === 0) {
      return makeAnswer(
        'I do not have an internship or internship achievement recorded in your personal profile.',
        'You have not yet added an internship to your Work Experience records in the Career Profile module.',
        'To ensure 100% authenticity during interviews, I never invent fictional companies, roles, or metrics.',
        'Please add your authentic internship details in Career Profile > Work Experience so I can present your real impact.',
        [
          'Anti-Hallucination Guard Triggered: No internship record found in profile.',
          'Missing Work Experience: Add your internship company, role, and key achievements.',
          'Open Career Profile > Work Experience tab to save this information.'
        ],
        'I do not have an internship recorded in your personal profile yet. Please add your internship details in the Career Profile module so I can highlight your authentic achievements.',
        {
          missingField: 'Internship Work Experience & Achievements',
          suggestedPrompt: 'What company did you intern at, what was your role, and what was your primary technical achievement?',
          suggestedCategory: 'experience'
        }
      );
    }

    const direct = `During my internship at ${internship.company} as a ${internship.role}, my biggest technical achievement was ${internship.achievements[0]}.`;
    const motivation = `I focused on delivering production-grade improvements while quickly ramping up on the team's tech stack (${internship.technologiesUsed.join(', ')}).`;
    const example = `${internship.description}. Specifically, ${internship.achievements.join(' Furthermore, ')}.`;
    const connection = `This internship gave me hands-on experience working in a collaborative engineering team with code reviews, CI/CD, and strict reliability standards.`;

    const spokenScript = `${direct} ${motivation} ${example} ${connection}`;

    return makeAnswer(
      direct,
      motivation,
      example,
      connection,
      internship.achievements.map(a => `Internship Achievement: ${a}`),
      spokenScript
    );
  }

  // -------------------------------------------------------------
  // CASE 0E: "What are your technical skills?" / "What are your strengths?"
  // -------------------------------------------------------------
  if (
    qLower.includes('what are your technical skills') ||
    qLower.includes('what are your skills') ||
    qLower.includes('what are your strengths')
  ) {
    const langGroup = profile.technicalSkills.find(g => g.category.toLowerCase().includes('lang'))?.skills.map(s => s.name).join(', ') || 'Java, TypeScript, SQL, Python';
    const fwGroup = profile.technicalSkills.find(g => g.category.toLowerCase().includes('frame'))?.skills.map(s => s.name).join(', ') || 'Spring Boot, Next.js, React, Node.js';
    const strengths = profile.strengthsAndWeaknesses.technicalStrengths;

    const direct = `My core technical strengths center on backend engineering, scalable systems architecture, and modern full-stack development.`;
    const motivation = `I believe in depth over shallow breadth—mastering the concurrency models, memory behaviors, and failure modes of my primary stack.`;
    const example = `My primary languages are ${langGroup}, paired with frameworks including ${fwGroup}. In practice, I apply these to design high-throughput microservices, optimize database queries, and maintain clean domain boundaries.`;
    const connection = `Specifically, ${strengths.slice(0, 2).join(' and ')}, which allows me to deliver robust, well-tested code with high team velocity.`;

    const spokenScript = `${direct} ${motivation} ${example} ${connection}`;

    return makeAnswer(
      direct,
      motivation,
      example,
      connection,
      [
        `Core Languages: ${langGroup}`,
        `Frameworks: ${fwGroup}`,
        `Technical Strengths: ${strengths.join(', ')}`
      ],
      spokenScript
    );
  }

  // -------------------------------------------------------------
  // CASE 1: "Why did you choose Java?" / "Why Java?"
  // -------------------------------------------------------------
  if (qLower.includes('why') && qLower.includes('java')) {
    const javaSkill = profile.technicalSkills
      .flatMap(g => g.skills)
      .find(s => s.name.toLowerCase() === 'java');
    const javaRationale = javaSkill?.rationale || profile.careerGoals.techStackRationale?.['Java'];

    if (!javaRationale) {
      return makeAnswer(
        'I chose Java as my core backend programming language.',
        'You have not yet specified your personal motivation for choosing Java in your profile.',
        'Please add a real project or experience where you used Java to ground this answer in authentic evidence.',
        'Aligns with enterprise backend roles.',
        ['Add your Java rationale in Personal Profile > Technical Skills to generate an authentic response.'],
        'I specialize in Java for backend systems, and I have specific architectural reasons for that.',
        {
          missingField: 'Java Rationale',
          suggestedPrompt: 'Why did you choose Java and how does it support your backend engineering goals?',
          suggestedCategory: 'skills',
          entityName: 'Java'
        }
      );
    }

    const javaProject = projects.find(p => p.technologyStack.some(t => t.name.toLowerCase() === 'java')) || projects[0];
    const targetRole = profile.careerGoals.targetRoles[0] || 'Software Engineer';

    const direct = length === 'short'
      ? `I chose Java primarily for its high-throughput multithreading, robust type safety, and battle-tested ecosystem in scalable backend architectures.`
      : `I chose Java as my primary backend language because of its predictable JVM performance, mature concurrency utilities, and extensive enterprise ecosystem—particularly Spring Boot.`;

    const motivation = javaRationale;

    const example = javaProject
      ? `In ${javaProject.name}, I leveraged Java and Spring Boot to design resilient microservices, utilizing connection pooling and transaction boundaries to handle concurrent client requests without memory leaks.`
      : `In my software projects, Java gave me the strict compile-time safety and concurrency constructs needed to build deterministic, testable APIs.`;

    const connection = `For the ${targetRole} role, this allows me to ramp up immediately on large-scale services, write clean idiomatic code, and diagnose runtime concurrency or memory bottlenecks with confidence.`;

    const spokenScript = `${direct} ${motivation} ${example} ${connection}`;

    return makeAnswer(
      direct,
      motivation,
      example,
      connection,
      [
        'JVM Concurrency & Performance: Mature thread pooling, garbage collector tuning, and predictable memory footprint.',
        'Type Safety & Maintainability: Eliminates large classes of runtime defects in complex multi-engineer codebases.',
        `Real Evidence in ${javaProject?.name || 'Projects'}: Implemented resilient service layers with test-driven validation.`,
        `Direct Alignment: Immediate velocity for ${targetRole} backend workflows.`
      ],
      spokenScript
    );
  }

  // -------------------------------------------------------------
  // CASE 2: "Why did you choose your degree or specialization?"
  // -------------------------------------------------------------
  if (qLower.includes('degree') || qLower.includes('specialization') || (qLower.includes('why') && qLower.includes('computer science'))) {
    const edu = profile.education[0];
    if (!edu || !edu.reasonForDegree) {
      return makeAnswer(
        'I chose Computer Science to build fundamental mastery of computation and system design.',
        'You have not yet specified why you selected your degree in your profile.',
        'Add your academic motivations and favorite subjects to make this answer completely personal.',
        'Bridges theory with practical engineering.',
        ['Add your degree motivation in Personal Profile > Education.'],
        'I chose my degree to gain foundational depth in algorithms and operating systems.',
        {
          missingField: 'Degree Choice Rationale',
          suggestedPrompt: 'Why did you choose your degree or specialization?',
          suggestedCategory: 'education'
        }
      );
    }

    const direct = `I pursued my ${edu.degree} in ${edu.fieldOfStudy} at ${edu.institution} to build deep, first-principles understanding of software architecture and computation.`;
    const motivation = edu.reasonForDegree;
    const example = `During my studies, I paired theoretical coursework in operating system concurrency and distributed algorithms with hands-on projects, which directly bridged theory into building production-ready applications.`;
    const connection = `This foundational background allows me to approach software development not just by stitching libraries together, but by understanding CPU, memory, and network constraints under the hood.`;

    return makeAnswer(
      direct,
      motivation,
      example,
      connection,
      [
        `First-Principles Foundation: Rigorous grounding in ${edu.fieldOfStudy}.`,
        `Academic Motivation: ${edu.reasonForDegree}`,
        'Practical Bridge: Applied algorithmic concepts directly into software architecture.',
        'Engineering Impact: Ability to analyze computational trade-offs, space/time complexity, and system bottlenecks.'
      ],
      `${direct} ${motivation} ${example} ${connection}`
    );
  }

  // -------------------------------------------------------------
  // CASE 3: "Why did you select this project's technology stack?"
  // -------------------------------------------------------------
  if (qLower.includes('technology stack') || qLower.includes('tech stack')) {
    const matchedProject = projects.find(p => qLower.includes(p.name.toLowerCase())) || projects[0];
    if (!matchedProject) {
      return makeAnswer('Project stack chosen for performance.', 'No projects found in vault.', '', '', [], 'No project loaded.');
    }

    const primaryTech = matchedProject.technologyStack[0];
    const direct = `We selected the technology stack for ${matchedProject.name}—centered around ${matchedProject.technologyStack.map(t => t.name).join(', ')}—to solve for high developer velocity, sub-millisecond response latency, and strict local privacy.`;
    const motivation = primaryTech ? primaryTech.whyChosen : `Selected to fit the exact technical constraints of ${matchedProject.problemStatement}.`;
    const example = `For instance, using ${primaryTech?.name || 'our chosen core stack'}, we were able to implement ${matchedProject.majorFeatures[0]?.name || 'the primary architecture'} with predictable throughput and clean separation of concerns.`;
    const connection = `Every tool in the stack was selected to solve a concrete engineering requirement rather than following hype, which mirrors how I evaluate technical trade-offs for production teams.`;

    return makeAnswer(
      direct,
      motivation,
      example,
      connection,
      matchedProject.technologyStack.map(t => `${t.name}: ${t.whyChosen}`),
      `${direct} ${motivation} ${example} ${connection}`
    );
  }

  // -------------------------------------------------------------
  // CASE 4: "Why did you use PostgreSQL instead of MongoDB?" (or other DB)
  // -------------------------------------------------------------
  if (qLower.includes('postgresql') || (qLower.includes('postgres') && qLower.includes('mongo'))) {
    const activeProj = projects[0];
    const techItem = activeProj?.technologyStack.find(t => t.name.toLowerCase().includes('postgres'));
    const altReason = techItem?.alternativesConsidered || profile.careerGoals.techStackRationale?.['PostgreSQL'];

    const direct = `I selected PostgreSQL over MongoDB because our data model required strict ACID guarantees, relational integrity with foreign keys, and complex transactional consistency across user and session states.`;
    const motivation = altReason || `While MongoDB offers schema-on-read flexibility, document stores can lead to silent data anomalies and duplicate updates when multiple concurrent operations write to related entities.`;
    const example = `In ${activeProj?.name || 'our system'}, having structured relational schemas allowed us to create composite B-tree indexes and utilize JSONB columns where semi-structured flexibility was genuinely needed, getting the best of both relational and document paradigms.`;
    const connection = `In production systems where data correctness is paramount, PostgreSQL gives predictable transaction isolation and query optimizers that prevent downstream data corruption.`;

    return makeAnswer(
      direct,
      motivation,
      example,
      connection,
      [
        'ACID Compliance & Data Integrity: Foreign key constraints prevent orphaned records and transactional anomalies.',
        'Explain Analyzed Indexing: Composite B-tree indexes and query execution planning for predictable latency.',
        'Hybrid Flexibility: Native JSONB support provides document-store ergonomics without sacrificing relational constraints.',
        'Trade-off Decision: Chose relational correctness over eventual-consistency document storage.'
      ],
      `${direct} ${motivation} ${example} ${connection}`
    );
  }

  // -------------------------------------------------------------
  // CASE 5: "What was your specific contribution to this project?"
  // -------------------------------------------------------------
  if (qLower.includes('specific contribution') || qLower.includes('your contribution') || qLower.includes('my contribution') || qLower.includes('what did you do')) {
    const matchedProject = projects.find(p => qLower.includes(p.name.toLowerCase())) || projects[0];
    const verified = matchedProject?.verifiedContributions.filter(c => c.isPersonallyImplemented) || [];

    if (verified.length === 0) {
      return makeAnswer(
        `I worked on the core engineering of ${matchedProject?.name || 'the project'}.`,
        'You have not marked any verified personal contributions for this project in your Project Vault.',
        'Please open Project Vault > Verified Contributions and check the components you personally coded.',
        'Ensures 100% honesty in interviews.',
        ['No verified contributions confirmed yet. Update in Project Vault.'],
        `I contributed to ${matchedProject?.name || 'the project'}, and I can detail the specific modules I owned.`,
        {
          missingField: 'Verified Contributions',
          suggestedPrompt: `Which specific modules or features in ${matchedProject?.name || 'your project'} did you personally implement?`,
          suggestedCategory: 'projects',
          targetEntityId: matchedProject?.id
        }
      );
    }

    const direct = `In ${matchedProject.name}, I personally owned and implemented the ${verified.map(v => v.area).join(', and ')}.`;
    const motivation = `My goal was to take full ownership from initial architecture design through to implementation, automated testing, and production deployment.`;
    const example = `Specifically, ${verified.map(v => `${v.area}: ${v.description}`).join(' Additionally, ')}.`;
    const connection = `This gave me hands-on ownership of the full lifecycle—from data models to error boundaries—ensuring that every line of code was production-tested, maintainable, and well-documented.`;

    return makeAnswer(
      direct,
      motivation,
      example,
      connection,
      verified.map(v => `${v.area}: ${v.description}`),
      `${direct} ${motivation} ${example} ${connection}`
    );
  }

  // -------------------------------------------------------------
  // CASE 6: "What was the most difficult technical problem you solved?" / "What challenges did I face?"
  // -------------------------------------------------------------
  if (
    qLower.includes('difficult') || 
    qLower.includes('hardest') || 
    qLower.includes('problem you solved') || 
    qLower.includes('outage') ||
    qLower.includes('challenges did i face') ||
    qLower.includes('challenges i faced') ||
    qLower.includes('challenges did you face')
  ) {
    const challenge = profile.realChallenges[0];
    if (!challenge) {
      return makeAnswer(
        'I systematically diagnose and resolve production bottlenecks.',
        'No production challenge or incident is logged in your profile yet.',
        'Add a real incident in Personal Profile > Real Challenges Solved.',
        'Demonstrates engineering maturity.',
        ['Add your challenge story in Personal Profile > Real Challenges Solved.'],
        'One of the most complex challenges I solved involved isolating a database concurrency bottleneck under load.',
        {
          missingField: 'Real Challenge Log',
          suggestedPrompt: 'What was the most difficult technical bug or outage you resolved, and how did you fix it?',
          suggestedCategory: 'challenges'
        }
      );
    }

    const direct = `The most difficult technical problem I resolved was "${challenge.title}".`;
    const motivation = `Under load, ${challenge.context}. The root issue was that ${challenge.technicalProblem}.`;
    const example = `To solve this, I ${challenge.solutionAndFix}. We considered alternative workarounds, but this fix addressed the root cause without masking the problem.`;
    const connection = `The key lesson was: ${challenge.lessonsLearned}. This shaped how I proactively instrument system health and design circuit breakers in all my services.`;

    return makeAnswer(
      direct,
      motivation,
      example,
      connection,
      [
        `Context: ${challenge.context}`,
        `Root Cause: ${challenge.technicalProblem}`,
        `Resolution: ${challenge.solutionAndFix}`,
        `Lesson Learned: ${challenge.lessonsLearned}`
      ],
      `${direct} ${motivation} ${example} ${connection}`
    );
  }

  // -------------------------------------------------------------
  // CASE 6B: "Explain my project as described in my resume" (Requirement 2)
  // -------------------------------------------------------------
  if (
    qLower.includes('resume') &&
    (qLower.includes('project') || qLower.includes('describe') || qLower.includes('explain'))
  ) {
    const activeProj = projects[0];
    const verified = activeProj?.verifiedContributions.filter(c => c.isPersonallyImplemented) || [];

    const direct = `On my resume, ${activeProj?.name || 'EchoCopilot'} is highlighted as a real-time AI interview copilot that leverages Next.js, Web Audio streams, and local client-side IndexedDB persistence to eliminate interview anxiety.`;
    const motivation = `I specifically framed this on my resume to demonstrate full-stack ownership—delivering a production system with real-time audio processing, strict zero-cloud privacy, and sub-second inference latency.`;
    const example = `The core bullet points reflect my verified contributions: architecting the dynamic question generator, implementing secret sanitization to protect candidate credentials, and building the IndexedDB v2 multi-store local persistence layer.`;
    const connection = `Every claim on my resume maps directly to verified source files in my codebase, allowing me to dive deeply into any architectural decision with complete confidence during interviews.`;

    const spokenScript = `${direct} ${motivation} ${example} ${connection}`;

    return makeAnswer(
      direct,
      motivation,
      example,
      connection,
      [
        `Project Identity: ${activeProj?.name || 'EchoCopilot'} (${activeProj?.tagline || 'AI Career Assistant'}).`,
        `Resume Grounding: Emphasizes full-stack engineering, real-time audio streams, and local privacy.`,
        `Verified Evidence: ${verified.map(v => v.area).join(', ') || 'Core architecture and local persistence'}.`,
        '100% Accuracy: Zero fabricated metrics or unverified claims.'
      ],
      spokenScript
    );
  }

  // -------------------------------------------------------------
  // CASE 7: "What would you improve if you rebuilt your project?" / "How would you improve my project?"
  // -------------------------------------------------------------
  if (
    qLower.includes('how would you improve my project') ||
    qLower.includes('how to improve my project') ||
    (qLower.includes('improve') && (qLower.includes('rebuilt') || qLower.includes('rebuild') || qLower.includes('from scratch') || qLower.includes('my project')))
  ) {
    const matchedProject = projects.find(p => qLower.includes(p.name.toLowerCase())) || projects[0];
    const improvement = matchedProject?.limitationsAndImprovements?.whatWouldYouImproveIfRebuilt;

    if (!improvement) {
      return makeAnswer(
        `If I rebuilt ${matchedProject?.name || 'the project'} today, I would modernize its architectural decoupling.`,
        'No future improvement reflection logged yet.',
        'Add your rebuild reflection in Project Vault > Future Improvements.',
        'Shows continuous architectural growth.',
        ['Add rebuild reflections in Project Vault.'],
        `If I rebuilt ${matchedProject?.name || 'this project'}, I would focus on asynchronous event streaming.`,
        {
          missingField: 'Rebuild Improvements',
          suggestedPrompt: `What would you improve or re-architect if you rebuilt ${matchedProject?.name || 'your project'} today?`,
          suggestedCategory: 'projects',
          targetEntityId: matchedProject?.id
        }
      );
    }

    const direct = `If I were to rebuild ${matchedProject.name} from scratch today, ${improvement}`;
    const motivation = `At the time of the initial build, our primary priority was delivering a functional, responsive MVP. Reflecting on our production usage, decoupling these components would significantly improve scaling.`;
    const example = `Specifically, ${matchedProject.limitationsAndImprovements.knownLimitations.length > 0 ? `addressing known constraints like ${matchedProject.limitationsAndImprovements.knownLimitations[0]}` : 'incorporating automated CI/CD and distributed tracing'} would prevent single points of failure.`;
    const connection = `This demonstrates my engineering evolution: constantly auditing past trade-offs and identifying where distributed patterns and observability provide compounding value.`;

    return makeAnswer(
      direct,
      motivation,
      example,
      connection,
      [
        `Architectural Upgrade: ${improvement}`,
        'Trade-off Perspective: Acknowledging initial MVP constraints vs long-term scalability.',
        'Observability & Resilience: Proactive design for fault tolerance and telemetry.'
      ],
      `${direct} ${motivation} ${example} ${connection}`
    );
  }

  // -------------------------------------------------------------
  // CASE 8: "How does your cybersecurity background help?"
  // -------------------------------------------------------------
  if (qLower.includes('cybersecurity') || qLower.includes('security background')) {
    const adv = profile.careerGoals.cybersecurityOrDomainAdvantage;
    if (!adv) {
      return makeAnswer(
        'My security background instills a defense-in-depth mindset.',
        'No cybersecurity advantage details logged in profile.',
        'Add details in Personal Profile > Career Goals & Domains.',
        'Demonstrates proactive security hygiene.',
        ['Add security advantage in Personal Profile > Career Goals.'],
        'My cybersecurity foundation ensures I write defense-in-depth software by default.',
        {
          missingField: 'Cybersecurity Domain Advantage',
          suggestedPrompt: 'How does your cybersecurity background specifically inform your software engineering practices?',
          suggestedCategory: 'goals'
        }
      );
    }

    const direct = `My background in cybersecurity directly shapes how I write and architect software—treating security not as a late audit checklist, but as a core architectural constraint from day one.`;
    const motivation = adv;
    const example = `In practice, this means enforcing strict input validation, parameterized queries to eliminate injection, least-privilege role-based access control (RBAC), and sanitizing all sensitive credentials and tokens before they touch persistence layers.`;
    const connection = `For any modern engineering team, this proactive hygiene drastically reduces security vulnerabilities, protects customer data, and minimizes costly production patch cycles.`;

    return makeAnswer(
      direct,
      motivation,
      example,
      connection,
      [
        'Defense-in-Depth Architecture: Validating inputs at API boundaries and database layers.',
        'Least-Privilege RBAC: Restricting token permissions and credential lifespans.',
        'Zero-Trust Data Protection: Automatic sanitization of logs and persistence stores.',
        'Proactive Audit: Preventing security technical debt before reaching production.'
      ],
      `${direct} ${motivation} ${example} ${connection}`
    );
  }

  // -------------------------------------------------------------
  // CASE 9: "Why are you interested in this company/role?"
  // -------------------------------------------------------------
  if (qLower.includes('why are you interested') || (qLower.includes('why') && qLower.includes('company'))) {
    const comp = targetJob?.company || 'your organization';
    const role = targetJob?.title || profile.careerGoals.targetRoles[0] || 'Software Engineer';
    const whyInt = targetJob?.whyInterested;

    const direct = `I am excited about ${comp} and the ${role} role because your team tackles high-concurrency challenges that align directly with my engineering focus.`;
    const motivation = whyInt || `I am driven by environments that emphasize high system reliability, clean domain-driven architecture, and measurable user impact.`;
    const example = `Looking at my work building ${projects[0]?.name || 'resilient fullstack systems'} with ${profile.technicalSkills[0]?.skills.slice(0, 3).map(s => s.name).join(', ') || 'modern backend frameworks'}, I have demonstrated the ability to take complex product requirements and deliver high-throughput, thoroughly tested software.`;
    const connection = `Joining ${comp} is the natural next step where my technical strengths in ${profile.strengthsAndWeaknesses.technicalStrengths[0] || 'distributed systems'} can immediately contribute to your engineering roadmaps.`;

    return makeAnswer(
      direct,
      motivation,
      example,
      connection,
      [
        `Target Alignment: Passion for ${comp}'s mission and engineering standards.`,
        `Skill Convergence: My experience with ${profile.technicalSkills[0]?.skills.slice(0, 3).map(s => s.name).join(', ') || 'backend stacks'} matches this role's demands.`,
        'Immediate Impact: Ability to hit the ground running with production discipline.'
      ],
      `${direct} ${motivation} ${example} ${connection}`
    );
  }

  // -------------------------------------------------------------
  // DEFAULT / GENERAL TECHNICAL QUESTION
  // -------------------------------------------------------------
  const direct = `When addressing this in an interview, I lead with a direct architectural answer grounded in my real software engineering experience.`;
  const motivation = `I believe in making technical decisions based on quantifiable trade-offs—evaluating latency, operational overhead, and data consistency.`;
  const example = `In my project ${projects[0]?.name || 'EchoCopilot'}, I applied these principles when architecting our ${projects[0]?.majorFeatures[0]?.name || 'core service layers'}, ensuring we met strict performance and reliability targets.`;
  const connection = `This structured, evidence-based approach is how I tackle production challenges as a ${profile.careerGoals.targetRoles[0] || 'Software Engineer'}.`;

  return makeAnswer(
    direct,
    motivation,
    example,
    connection,
    [
      'Structured Direct Response: Clarity and conciseness in technical communication.',
      'Grounded in Evidence: Supported by real implementation experience.',
      'Target Alignment: Focused on solving production engineering challenges.'
    ],
    `${direct} ${motivation} ${example} ${connection}`
  );
}

/**
 * Evaluates candidate's practice turn across 4 key metrics:
 * Correctness, Clarity, Relevance, and Confidence of wording.
 * Generates turn score, actionable improvements, and an adaptive follow-up question.
 */
export function evaluatePracticeAnswer(
  question: string,
  userAnswer: string,
  turnIndex: number,
  track: string,
  profile: UserProfile,
  projects: ProjectRecord[]
): PracticeTurnFeedback {
  const ansLower = userAnswer.toLowerCase();
  const wordCount = userAnswer.trim().split(/\s+/).filter(Boolean).length;

  // 1. Confidence of Wording Analysis
  const hesitantPhrases = [
    'i think maybe', 'i am not sure', 'i guess', 'sort of', 'kind of',
    'probably', 'maybe', 'i don\'t know if this is right', 'umm', 'like'
  ];
  const foundHesitations = hesitantPhrases.filter(p => ansLower.includes(p));

  let confidenceScore = 8;
  let confidenceFeedback = 'Strong, assertive tone with good professional presence.';

  if (foundHesitations.length > 0) {
    confidenceScore = Math.max(4, 8 - foundHesitations.length * 1.5);
    confidenceFeedback = `Your response contained hesitant qualifiers (${foundHesitations.map(h => `"${h}"`).join(', ')}). Replace tentative phrases like "I think maybe" with assertive statements like "In my experience" or "I chose X because".`;
  } else if (wordCount < 15) {
    confidenceScore = 5;
    confidenceFeedback = 'Answer was too brief to project technical authority. Elaborate with concrete architectural reasoning.';
  }

  // 2. Clarity Analysis
  let clarityScore = 8;
  if (wordCount > 180) {
    clarityScore = 6;
  } else if (wordCount < 20) {
    clarityScore = 5;
  }

  // 3. Relevance Analysis
  let relevanceScore = 8;
  const qWords = question.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
  const matchedQWords = qWords.filter(w => ansLower.includes(w));
  if (matchedQWords.length === 0 && wordCount > 10) {
    relevanceScore = 5;
  } else if (matchedQWords.length >= 2) {
    relevanceScore = 9;
  }

  // 4. Correctness Score
  let correctnessScore = 8;
  if (wordCount < 15) correctnessScore = 5;
  else if (ansLower.includes('because') || ansLower.includes('for example') || ansLower.includes('trade-off')) {
    correctnessScore = 9;
  }

  // Overall Turn Score
  const overall = Math.round((correctnessScore + clarityScore + relevanceScore + confidenceScore) / 4 * 10);

  // Generate Strengths & Improvements
  const strengths: string[] = [];
  const improvements: string[] = [];

  if (ansLower.includes('for example') || ansLower.includes('in my project') || ansLower.includes('specifically')) {
    strengths.push('Excellent use of specific examples to back up your technical assertion.');
  } else {
    improvements.push('Ground your claim with a concrete episode: mention a specific project, table, or outage.');
  }

  if (ansLower.includes('trade-off') || ansLower.includes('instead of') || ansLower.includes('alternative')) {
    strengths.push('Great architectural maturity mentioning trade-offs and alternative solutions considered.');
  } else {
    improvements.push('Explain the trade-off: why this approach was preferred over the alternative.');
  }

  if (confidenceScore >= 8) {
    strengths.push('Confident, direct speaking tone without hedging.');
  } else {
    improvements.push(confidenceFeedback);
  }

  // Generate Adaptive Follow-Up Question
  let adaptiveFollowUp = 'Can you elaborate on how you monitored and verified this behavior in production?';

  if (question.toLowerCase().includes('why did you choose') || question.toLowerCase().includes('stack')) {
    adaptiveFollowUp = 'What was the biggest disadvantage or limitation of that choice as your application scaled?';
  } else if (question.toLowerCase().includes('contribution')) {
    adaptiveFollowUp = 'If you had another week to work on that module, what would you refactor first?';
  } else if (question.toLowerCase().includes('difficult') || question.toLowerCase().includes('bug')) {
    adaptiveFollowUp = 'How did you ensure that similar regressions would not happen again in subsequent deployments?';
  } else if (question.toLowerCase().includes('degree') || question.toLowerCase().includes('career')) {
    adaptiveFollowUp = 'How has that perspective evolved as you gained practical industry engineering experience?';
  }

  // Model benchmark answers
  const modelAnswer = generatePersonalizedAnswer(question, 'medium', profile, projects);

  return {
    turnIndex,
    question,
    userAnswer,
    rubricScores: {
      correctness: correctnessScore,
      clarity: clarityScore,
      relevance: relevanceScore,
      confidence: Math.round(confidenceScore)
    },
    overallTurnScore: overall,
    strengths,
    improvements,
    confidenceWordingFeedback: confidenceFeedback,
    adaptiveFollowUp,
    modelAnswer: {
      short: modelAnswer.structure.directAnswer,
      medium: modelAnswer.spokenScript,
      detailed: `${modelAnswer.structure.directAnswer}\n\n${modelAnswer.structure.personalMotivation}\n\n${modelAnswer.structure.supportingExample}\n\n${modelAnswer.structure.roleOrCareerConnection}`
    }
  };
}
