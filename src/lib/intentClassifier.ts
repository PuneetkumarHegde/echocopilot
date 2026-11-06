/**
 * EchoCopilot Intent Detection and Context-Selection Engine
 * 
 * Classifies candidate and user prompts into 14 distinct question intents
 * and strictly isolates context so that general technical questions,
 * comparison questions, and personal/project questions never contaminate each other.
 */

import { UserProfile, ProjectRecord, TargetJobDescription } from './profileTypes';
import { ConversationTurnSummary, detectFollowUpReference, extractConceptFromQuestion } from './questionClassifier';

export type QuestionIntent =
  | 'GENERAL_TECHNICAL'        // Technical concepts, mechanisms, principles (Java, Python, OS, etc.)
  | 'CONCEPT_EXPLANATION'      // Deep-dive definition & explanation of a single concept (e.g. "What is an ArrayList?")
  | 'COMPARISON'               // Difference between X and Y, X vs Y, compare X and Y
  | 'CODING_REQUEST'           // "Write code to...", "Implement a function..."
  | 'DEBUGGING'                // "Fix this error", "Why is this throwing NullPointerException..."
  | 'DSA_PROBLEM'              // Data structures, algorithms, complexity (e.g. Binary Search, LRU Cache)
  | 'PROJECT_SPECIFIC'         // "Explain my project", "Why did you choose PostgreSQL in this project?"
  | 'PERSONAL_CAREER'          // "Tell me about yourself", "What was my internship achievement?"
  | 'RESUME_BASED'             // "Explain my experience from my resume"
  | 'HR_BEHAVIORAL'            // "Tell me about a time you had a conflict", "Why should we hire you?"
  | 'JOB_DESCRIPTION'          // "How do my skills match this job description?"
  | 'MOCK_INTERVIEW'           // Practice session active evaluation turn
  | 'FOLLOW_UP'                // Immediate follow-up: "Why?", "Give an example", "How so?"
  | 'GENERAL_NONTECHNICAL';    // General questions outside IT/CS

export interface IntentClassificationResult {
  intent: QuestionIntent;
  confidence: number;
  reason: string;
  extractedConcepts?: {
    conceptA?: string;
    conceptB?: string;
    conceptC?: string;
  };
  isProjectAware: boolean;
  isProfileAware: boolean;
  targetSubject?: string;
}

export interface IsolatedContext {
  intent: QuestionIntent;
  prompt: string;
  relevantProfile?: UserProfile | null;
  relevantProject?: ProjectRecord | null;
  relevantResumeText?: string | null;
  relevantJobDescription?: TargetJobDescription | null;
  immediateParentTurn?: ConversationTurnSummary | null;
  contextNotice: string;
}

// -----------------------------------------------------------------
// 1. Intent Detection Rules
// -----------------------------------------------------------------

export function classifyQuestionIntent(
  rawPrompt: string,
  contextHistory?: ConversationTurnSummary[]
): IntentClassificationResult {
  const q = rawPrompt.trim();
  const qLower = q.toLowerCase();

  // 1. Conversation-Aware Follow-up Check
  if (contextHistory && contextHistory.length > 0) {
    const followUp = detectFollowUpReference(q, contextHistory[0]);
    if (followUp.isFollowUp) {
      const isComparison = /\b(difference\s+between|compare\b|vs\b|versus\b|differentiate\s+between|distinguish\s+between|trade-?offs?\s+between|differ\s+from|differs\s+from|different\s+from|different\s+to|difference\s+with)\b/i.test(qLower);
      if (isComparison) {
        const concepts = extractComparisonConcepts(qLower, contextHistory);
        const subject = concepts.conceptC
          ? `${concepts.conceptA} vs ${concepts.conceptB} vs ${concepts.conceptC}`
          : (concepts.conceptA && concepts.conceptB ? `${concepts.conceptA} vs ${concepts.conceptB}` : `${followUp.parentConcept} Comparison`);

        return {
          intent: 'COMPARISON',
          confidence: 0.95,
          reason: `Comparison follow-up anchored to "${followUp.parentConcept}": ${subject}`,
          extractedConcepts: concepts,
          isProjectAware: false,
          isProfileAware: false,
          targetSubject: subject
        };
      }

      const isCode = /\b(write\s+code|implement|code\s+example|code\s+snippet|show\s+code)\b/i.test(qLower);
      if (isCode) {
        return {
          intent: 'CODING_REQUEST',
          confidence: 0.95,
          reason: `Code implementation follow-up to "${followUp.parentConcept}"`,
          isProjectAware: false,
          isProfileAware: false,
          targetSubject: `${followUp.parentConcept} Implementation`
        };
      }

      return {
        intent: 'FOLLOW_UP',
        confidence: 0.95,
        reason: followUp.reason,
        isProjectAware: false,
        isProfileAware: false,
        targetSubject: followUp.resolvedPrompt || followUp.parentConcept
      };
    }
  }

  // 1B. Traditional Short Follow-up Patterns
  const isFollowUpPattern = /^(why|why\s+is\s+that|why\s+so|how\s+so|give\s+an\s+example|can\s+you\s+elaborate|what\s+about\s+(the\s+)?alternative|and\s+then|what\s+happens\s+next|show\s+an\s+example)[.?!]?$/i.test(qLower);
  if (isFollowUpPattern && contextHistory && contextHistory.length > 0) {
    const parent = contextHistory[0];
    const ageMs = Date.now() - parent.timestamp;
    if (ageMs <= 180000) {
      return {
        intent: 'FOLLOW_UP',
        confidence: 0.95,
        reason: `Immediate contextual follow-up to prior question: "${parent.question}"`,
        isProjectAware: false,
        isProfileAware: false,
        targetSubject: parent.question
      };
    }
  }

  // 2. Comparison / Difference Question Check
  // Matches "difference between X and Y", "compare X and Y", "X vs Y", "X versus Y", "differentiate X and Y", "X differ from Y", etc.
  const isComparisonQuery = 
    /\b(difference\s+between|compare\b|vs\b|versus\b|differentiate\s+between|distinguish\s+between|trade-?offs?\s+between|differ\s+from|differs\s+from|different\s+from|contrast\s+.*\s+(with|and)|which\s+is\s+better|which\s+one\s+to\s+use)\b/i.test(qLower);

  if (isComparisonQuery) {
    const concepts = extractComparisonConcepts(qLower, contextHistory);
    const subject = concepts.conceptC
      ? `${concepts.conceptA} vs ${concepts.conceptB} vs ${concepts.conceptC}`
      : (concepts.conceptA && concepts.conceptB ? `${concepts.conceptA} vs ${concepts.conceptB}` : 'Comparison');

    return {
      intent: 'COMPARISON',
      confidence: 0.95,
      reason: 'Question requests a direct comparison between two or more concepts.',
      extractedConcepts: concepts,
      isProjectAware: false,
      isProfileAware: false,
      targetSubject: subject
    };
  }

  // 3. Project-Specific Question Check
  // Explicitly references "my project", "this project", "our project", or project-level technical decisions
  const isExplicitProject = 
    /\b(explain\s+(my|this|the|your)\s+(current\s+)?project|tell\s+me\s+about\s+(my|this|the|your)\s+(current\s+)?project|walk\s+me\s+through\s+(my|this|the|your)\s+(current\s+)?project)\b/i.test(qLower) ||
    /\b(tell\s+me\s+about\s+(your|my)\s+project|explain\s+(your|my)\s+project|about\s+my\s+current\s+project)\b/i.test(qLower) ||
    /\b(in\s+(my|this|the|our)\s+project|for\s+(my|this|the|our)\s+project|of\s+(my|this|the|our)\s+project)\b/i.test(qLower) ||
    /\b(why\s+did\s+i\s+use\s+this\s+technology|why\s+did\s+you\s+select\s+this\s+project('s)?\s+technology\s+stack)\b/i.test(qLower) ||
    /\b(explain\s+(the\s+)?(frontend|backend|database|apis?|architecture)\s+(of|in)\s+(my|this|the|our)\s+project)\b/i.test(qLower) ||
    /\b(explain\s+my\s+project\s+(architecture|as\s+described\s+in\s+my\s+resume))\b/i.test(qLower) ||
    /\b(how\s+does\s+.*\s+work\s+in\s+(my|this|the|our)\s+project)\b/i.test(qLower) ||
    /\b(how\s+would\s+you\s+improve\s+(my|this|the)\s+project|how\s+to\s+improve\s+(my|this|the)\s+project)\b/i.test(qLower) ||
    /\b(what\s+challenges\s+did\s+i\s+face|challenges\s+(i\s+faced|faced\s+in\s+my\s+project))\b/i.test(qLower) ||
    /\b(what\s+was\s+my\s+(specific\s+)?contribution|my\s+contribution\s+to\s+(this|my|the)\s+project)\b/i.test(qLower) ||
    /\b(why\s+does\s+this\s+project\s+use|why\s+did\s+you\s+use\s+.*in\s+this\s+project|rebuilt\s+(your|my)\s+project|rebuild\s+(this|my)\s+project)\b/i.test(qLower);

  if (isExplicitProject) {
    return {
      intent: 'PROJECT_SPECIFIC',
      confidence: 0.95,
      reason: 'Question directly asks about the candidate\'s project architecture, choices, or contributions.',
      isProjectAware: true,
      isProfileAware: false,
      targetSubject: 'Project Vault'
    };
  }

  // 4. Personal Career & Profile Question Check
  const isPersonalIntroduction = 
    /\b(tell\s+me\s+about\s+yourself|introduce\s+yourself|who\s+are\s+you|walk\s+me\s+through\s+your\s+(background|profile|resume))\b/i.test(qLower);
  
  const isPersonalCareerQuestion = 
    isPersonalIntroduction ||
    /\b(what\s+are\s+your\s+technical\s+skills|what\s+are\s+your\s+strengths|what\s+is\s+your\s+greatest\s+(strength|weakness)|why\s+should\s+we\s+hire\s+you|why\s+do\s+you\s+want\s+this\s+role|what\s+are\s+your\s+career\s+goals)\b/i.test(qLower) ||
    /\b(my\s+internship|during\s+my\s+internship|biggest\s+achievement\s+during\s+my\s+internship|my\s+biggest\s+achievement)\b/i.test(qLower) ||
    /\b(why\s+did\s+you\s+choose\s+your\s+degree|why\s+did\s+you\s+choose\s+your\s+specialization|why\s+computer\s+science)\b/i.test(qLower) ||
    /\b(why\s+did\s+you\s+choose\s+java\b|how\s+does\s+java\s+support\s+your\s+career\s+goals|why\s+did\s+you\s+choose\s+[a-z0-9#+]+\b)/i.test(qLower) ||
    /\b(cybersecurity\s+background\s+help|domain\s+background\s+help)\b/i.test(qLower);

  if (isPersonalCareerQuestion) {
    return {
      intent: 'PERSONAL_CAREER',
      confidence: 0.95,
      reason: 'Question queries personal motivation, career trajectory, education, or verified accomplishments.',
      isProjectAware: false,
      isProfileAware: true,
      targetSubject: 'Candidate Profile'
    };
  }

  // 5. Resume-based Question Check
  if (/\b(on\s+my\s+resume|from\s+my\s+resume|in\s+my\s+resume|explain\s+a\s+project\s+from\s+my\s+resume)\b/i.test(qLower)) {
    return {
      intent: 'RESUME_BASED',
      confidence: 0.90,
      reason: 'Question explicitly references candidate resume context.',
      isProjectAware: false,
      isProfileAware: true,
      targetSubject: 'Resume Context'
    };
  }

  // 6. Job Description Question Check
  if (/\b(this\s+job\s+description|the\s+jd\b|fit\s+for\s+this\s+role|match\s+this\s+role|match\s+this\s+company)\b/i.test(qLower)) {
    return {
      intent: 'JOB_DESCRIPTION',
      confidence: 0.90,
      reason: 'Question asks about alignment with a specific target job description.',
      isProjectAware: false,
      isProfileAware: true,
      targetSubject: 'Target Job Description'
    };
  }

  // 7. Debugging & Error Troubleshooting Check
  const isDebuggingQuery = 
    /\b(fix\s+this\s+error|debug\s+this|why\s+is\s+this\s+throwing|nullpointerexception|typeerror|indexoutofboundsexception|syntaxerror|stack\s+trace|segmentation\s+fault|memory\s+leak)\b/i.test(qLower);

  if (isDebuggingQuery) {
    return {
      intent: 'DEBUGGING',
      confidence: 0.90,
      reason: 'Query requests troubleshooting an error, bug, or exception.',
      isProjectAware: false,
      isProfileAware: false,
      targetSubject: 'Code Troubleshooting'
    };
  }

  // 8. Data Structures & Algorithms (DSA) Check
  const isDsaQuery = 
    /\b(binary\s+search|time\s+complexity|space\s+complexity|big\s+o|two\s+sum|linked\s+list|lru\s+cache|dijkstra|quicksort|merge\s+sort|depth\s+first\s+search|breadth\s+first\s+search|dynamic\s+programming|recursion|hashing|binary\s+tree|trie|heap|priority\s+queue)\b/i.test(qLower) ||
    /\b(arrays?|strings?|trees?|graphs?|stacks?|queues?)\b/i.test(qLower) && /\b(algorithm|complexity|traverse|search|sort|implement)\b/i.test(qLower);

  if (isDsaQuery) {
    return {
      intent: 'DSA_PROBLEM',
      confidence: 0.92,
      reason: 'Algorithmic problem or data structure complexity analysis.',
      isProjectAware: false,
      isProfileAware: false,
      targetSubject: 'DSA & Complexity Analysis'
    };
  }

  // 9. Coding / Implementation Request Check
  const isCodingRequest = 
    /\b(write\s+code|implement\s+a\b|write\s+a\s+function|write\s+a\s+class|code\s+example|code\s+snippet|how\s+to\s+code)\b/i.test(qLower);

  if (isCodingRequest) {
    return {
      intent: 'CODING_REQUEST',
      confidence: 0.90,
      reason: 'Candidate asked for code implementation.',
      isProjectAware: false,
      isProfileAware: false,
      targetSubject: 'Implementation'
    };
  }

  // 10. HR & Behavioral Interview Question Check
  const isHrBehavioral = 
    /\b(tell\s+me\s+about\s+a\s+time|conflict\s+with|disagreement|greatest\s+failure|how\s+do\s+you\s+handle\s+stress|leadership\s+example|describe\s+a\s+situation)\b/i.test(qLower);

  if (isHrBehavioral) {
    return {
      intent: 'HR_BEHAVIORAL',
      confidence: 0.88,
      reason: 'Behavioral or situational interview question.',
      isProjectAware: false,
      isProfileAware: true,
      targetSubject: 'STAR Behavioral Story'
    };
  }

  // 11. Concept Explanation & General Technical Question Check (e.g. "What is an ArrayList in Java?", "What is polymorphism?")
  const isConceptExplanation = 
    /\b(what\s+is\s+an?\s+[a-z0-9_]+|explain\s+[a-z0-9_]+|how\s+does\s+[a-z0-9_]+\s+work|define\s+[a-z0-9_]+)\b/i.test(qLower);

  if (isConceptExplanation) {
    return {
      intent: 'CONCEPT_EXPLANATION',
      confidence: 0.90,
      reason: 'Direct technical definition and mechanism inquiry for a single topic.',
      isProjectAware: false,
      isProfileAware: false,
      targetSubject: 'Technical Concept'
    };
  }

  // 12. Default to General Technical
  return {
    intent: 'GENERAL_TECHNICAL',
    confidence: 0.85,
    reason: 'General technical engineering question.',
    isProjectAware: false,
    isProfileAware: false,
    targetSubject: 'General Software Engineering'
  };
}

// -----------------------------------------------------------------
// 2. Helper: Extract comparison concepts from query
// -----------------------------------------------------------------

export function extractComparisonConcepts(
  query: string,
  contextHistory?: ConversationTurnSummary[]
): { conceptA?: string; conceptB?: string; conceptC?: string } {
  const q = query.toLowerCase();

  const resolveAnaphoraConcept = (name: string): string => {
    const cleaned = cleanConceptName(name);
    if (!cleaned || /^(it|its|this|that|the\s+former|the\s+latter)$/i.test(cleaned)) {
      if (contextHistory && contextHistory.length > 0) {
        return contextHistory[0].concept || extractConceptFromQuestion(contextHistory[0].question) || cleaned;
      }
    }
    return cleaned;
  };

  const normalizeContextualPair = (cA: string, cB: string): { conceptA: string; conceptB: string } => {
    let a = resolveAnaphoraConcept(cA);
    let b = resolveAnaphoraConcept(cB);

    // Phonetic / speech STT recovery: if discussing stemming and comparing with "limitation", it is lemmatization
    if (a.toLowerCase().includes('stem') && b.toLowerCase() === 'limitation') {
      b = 'lemmatization';
    } else if (b.toLowerCase().includes('stem') && a.toLowerCase() === 'limitation') {
      a = 'lemmatization';
    }

    return { conceptA: a, conceptB: b };
  };

  // Pattern 0: 3-way comparisons (e.g. "DELETE vs TRUNCATE vs DROP" or "difference between DELETE, TRUNCATE, and DROP")
  const threeWayVs = q.match(/(.+?)\s+(?:vs\.?|versus)\s+(.+?)\s+(?:vs\.?|versus)\s+(.+?)(?:\s+in\s+.*|\?|$)/i);
  if (threeWayVs && threeWayVs[1] && threeWayVs[2] && threeWayVs[3]) {
    return {
      conceptA: cleanConceptName(threeWayVs[1]),
      conceptB: cleanConceptName(threeWayVs[2]),
      conceptC: cleanConceptName(threeWayVs[3])
    };
  }

  const threeWayDiff = q.match(/difference\s+between\s+(.+?)\s*,\s*(?:and\s+)?(.+?)[,\s]+and\s+(.+?)(?:\s+in\s+.*|\?|$)/i);
  if (threeWayDiff && threeWayDiff[1] && threeWayDiff[2] && threeWayDiff[3]) {
    return {
      conceptA: cleanConceptName(threeWayDiff[1]),
      conceptB: cleanConceptName(threeWayDiff[2]),
      conceptC: cleanConceptName(threeWayDiff[3])
    };
  }

  // Pattern 1: "difference between X and Y"
  const diffMatch = q.match(/difference\s+between\s+(.+?)\s+and\s+(.+?)(?:\s+in\s+.*|\?|$)/i);
  if (diffMatch && diffMatch[1] && diffMatch[2]) {
    const pair = normalizeContextualPair(diffMatch[1], diffMatch[2]);
    return {
      conceptA: pair.conceptA,
      conceptB: pair.conceptB
    };
  }

  // Pattern 2: "compare X and/with/to Y"
  const compMatch = q.match(/compare\s+(.+?)\s+(?:and|with|to)\s+(.+?)(?:\s+in\s+.*|\?|$)/i);
  if (compMatch && compMatch[1] && compMatch[2]) {
    const pair = normalizeContextualPair(compMatch[1], compMatch[2]);
    return {
      conceptA: pair.conceptA,
      conceptB: pair.conceptB
    };
  }

  // Pattern 3: "X vs Y" or "X versus Y"
  const vsMatch = q.match(/(.+?)\s+(?:vs\.?|versus)\s+(.+?)(?:\s+in\s+.*|\?|$)/i);
  if (vsMatch && vsMatch[1] && vsMatch[2]) {
    const pair = normalizeContextualPair(vsMatch[1], vsMatch[2]);
    return {
      conceptA: pair.conceptA,
      conceptB: pair.conceptB
    };
  }

  // Pattern 4: "differentiate between X and Y"
  const diffBetMatch = q.match(/differentiate\s+between\s+(.+?)\s+and\s+(.+?)(?:\s+in\s+.*|\?|$)/i);
  if (diffBetMatch && diffBetMatch[1] && diffBetMatch[2]) {
    const pair = normalizeContextualPair(diffBetMatch[1], diffBetMatch[2]);
    return {
      conceptA: pair.conceptA,
      conceptB: pair.conceptB
    };
  }

  // Pattern 5: "how does X differ from Y", "how is X different from Y", "X differs from Y", "how it differs from Y"
  const differMatch = q.match(/(?:how\s+(?:does|is)\s+)?(.+?)\s+(?:differ(?:s)?\s+from|different\s+(?:from|to|than)|difference\s+(?:from|with))\s+(.+?)(?:\s+in\s+.*|\?|$)/i);
  if (differMatch && differMatch[1] && differMatch[2]) {
    const pair = normalizeContextualPair(differMatch[1], differMatch[2]);
    return {
      conceptA: pair.conceptA,
      conceptB: pair.conceptB
    };
  }

  // Pattern 6: "contrast X with Y"
  const contrastMatch = q.match(/contrast\s+(.+?)\s+(?:with|and)\s+(.+?)(?:\s+in\s+.*|\?|$)/i);
  if (contrastMatch && contrastMatch[1] && contrastMatch[2]) {
    const pair = normalizeContextualPair(contrastMatch[1], contrastMatch[2]);
    return {
      conceptA: pair.conceptA,
      conceptB: pair.conceptB
    };
  }

  return {};
}

function cleanConceptName(concept: string): string {
  return concept
    .replace(/^(an?|the)\s+/i, '')
    .replace(/^(what\s+is\s+(the\s+)?difference\s+between\s+)/i, '')
    .replace(/^(could\s+you\s+(also\s+)?explain\s+(?:its\s+)?limitations\s+and\s+how\s+|how\s+does\s+|how\s+is\s+|how\s+)/i, '')
    .replace(/\s+(?:in|on|using|with)\s+(?:github|gitlab|git|java|python|javascript|c\+\+|sql|postgres|database|os)$/i, '')
    .replace(/[?.!,;:]+$/g, '')
    .trim();
}

// -----------------------------------------------------------------
// 3. Strict Context Isolation Selector
// -----------------------------------------------------------------

export function selectContextForIntent(
  intent: QuestionIntent,
  prompt: string,
  profile?: UserProfile | null,
  projects?: ProjectRecord[] | null,
  targetJob?: TargetJobDescription | null,
  resumeText?: string | null,
  contextHistory?: ConversationTurnSummary[] | null
): IsolatedContext {
  switch (intent) {
    // A. General Technical & Comparison Questions: ZERO Profile, ZERO Project, ZERO Stale Context
    case 'GENERAL_TECHNICAL':
    case 'CONCEPT_EXPLANATION':
    case 'COMPARISON':
    case 'CODING_REQUEST':
    case 'DSA_PROBLEM':
    case 'DEBUGGING':
    case 'GENERAL_NONTECHNICAL':
      return {
        intent,
        prompt,
        relevantProfile: null,
        relevantProject: null,
        relevantResumeText: null,
        relevantJobDescription: null,
        immediateParentTurn: null,
        contextNotice: 'Context Isolated: Strictly answering from general software engineering and computer science principles without project or profile contamination.'
      };

    // B. Project Questions: Strictly Selected Project Record
    case 'PROJECT_SPECIFIC': {
      // Find matching project from user query, or fallback to first project (EchoCopilot)
      const qLower = prompt.toLowerCase();
      const matchedProj = (projects || []).find(p => qLower.includes(p.name.toLowerCase())) || (projects && projects[0]) || null;

      return {
        intent,
        prompt,
        relevantProfile: null,
        relevantProject: matchedProj,
        relevantResumeText: null,
        relevantJobDescription: null,
        immediateParentTurn: null,
        contextNotice: matchedProj
          ? `Project Context Bound: Using verified records for "${matchedProj.name}".`
          : 'Project Context Notice: No specific project found in Project Vault.'
      };
    }

    // C. Personal Career Questions: Strictly Candidate Profile
    case 'PERSONAL_CAREER':
    case 'HR_BEHAVIORAL':
      return {
        intent,
        prompt,
        relevantProfile: profile || null,
        relevantProject: null,
        relevantResumeText: null,
        relevantJobDescription: targetJob || null,
        immediateParentTurn: null,
        contextNotice: 'Personal Context Bound: Using verified candidate profile records.'
      };

    // D. Resume Questions
    case 'RESUME_BASED':
      return {
        intent,
        prompt,
        relevantProfile: profile || null,
        relevantProject: null,
        relevantResumeText: resumeText || null,
        relevantJobDescription: null,
        immediateParentTurn: null,
        contextNotice: 'Resume Context Bound: Using candidate resume text.'
      };

    // E. Job Description Questions
    case 'JOB_DESCRIPTION':
      return {
        intent,
        prompt,
        relevantProfile: profile || null,
        relevantProject: null,
        relevantResumeText: null,
        relevantJobDescription: targetJob || null,
        immediateParentTurn: null,
        contextNotice: 'Job Description Bound: Using targeted job description.'
      };

    // F. Contextual Follow-up: Immediate Preceding Question Only
    case 'FOLLOW_UP':
      return {
        intent,
        prompt,
        relevantProfile: null,
        relevantProject: null,
        relevantResumeText: null,
        relevantJobDescription: null,
        immediateParentTurn: contextHistory && contextHistory.length > 0 ? contextHistory[0] : null,
        contextNotice: 'Immediate Turn Context: Bound to the immediate prior interview question.'
      };

    default:
      return {
        intent,
        prompt,
        relevantProfile: null,
        relevantProject: null,
        relevantResumeText: null,
        relevantJobDescription: null,
        immediateParentTurn: null,
        contextNotice: 'Default Clean Context.'
      };
  }
}
