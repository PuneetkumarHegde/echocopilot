/**
 * Lightweight NLP Question Classifier and Conversation Context Engine for EchoCopilot.
 * 
 * Accurately identifies genuine technical interview questions, rejects statements,
 * greetings, and topic transitions (e.g. "Now let's discuss JavaScript"),
 * merges fragmented speech utterances, resolves contextual follow-ups ("Why?", "What about the alternative?"),
 * and detects when a new question supersedes an in-flight answer generation.
 */

export type UtteranceIntent = 
  | 'GENUINE_QUESTION'
  | 'TOPIC_TRANSITION'
  | 'ACKNOWLEDGEMENT'
  | 'GREETING_OR_BANTER'
  | 'STATEMENT'
  | 'INCOMPLETE_FRAGMENT';

export type QuestionCategory = 
  | 'DIRECT'       // Concise direct answer (2-3 sentences)
  | 'DIFFERENCE'   // Compare X vs Y (both concepts + main difference + example + summary)
  | 'HOW_WHY'      // Mechanism/rationale + practical example
  | 'FOLLOW_UP'    // Context-dependent question ("Why?", "What about the alternative?")
  | 'GENERAL';

export interface ClassificationResult {
  isQuestion: boolean;
  intent: UtteranceIntent;
  category: QuestionCategory;
  cleanText: string;
  confidence: number;
  reason: string;
  isFollowUp: boolean;
  parentTopicHint?: string;
}

export interface QuestionReadinessResult {
  isReady: boolean;
  reason: string;
  isFollowUpCandidate: boolean;
  needsMoreSpeech: boolean;
  missingElements?: string[];
}

export interface ConversationTurnSummary {
  id?: string;
  question: string;
  summary: string;
  timestamp: number;
  category?: QuestionCategory;
  keywords?: string[];
}

// -------------------------------------------------------------
// 1. Regular Expression Rule Sets (Lightweight & Zero-Latency)
// -------------------------------------------------------------

// Explicit Topic Transitions that MUST NOT trigger Ollama
const TOPIC_TRANSITION_REGEX = /^(now\s+)?(let's|lets|let\s+us|moving\s+on(\s+to)?|next\s+(topic|question|section|area|point)|we\s+(will|can|should|could)|i'd\s+like\s+to|i\s+want\s+to|shall\s+we)\s+(discuss|talk\s+about|move\s+to|move\s+on\s+to|look\s+at|cover|switch\s+to|dive\s+into|explore|touch\s+upon|focus\s+on)\b/i;

const TOPIC_TRANSITION_PHRASES = [
  "now let's discuss", "let's discuss", "let's talk about", "moving on to", "move on to",
  "next let's talk about", "let's switch to", "let's move to", "next topic", "next question",
  "moving to the next question", "shall we discuss", "i want to discuss", "let's look at",
  "let's touch on", "coming to", "on the topic of", "moving to"
];

// Acknowledgements & Backchanneling conversational noises (single and compound like "Okay, got it.")
const ACKNOWLEDGEMENT_BASE = "(ok|okay|right|cool|got\\s+it|fair\\s+enough|makes\\s+sense|understood|perfect|awesome|great|nice|good|very\\s+good|excellent|fine|i\\s+see|alright|sure|yep|yeah|no\\s+problem|thanks|thank\\s+you|that's\\s+fine|that\\s+makes\\s+sense|sounds\\s+good|that's\\s+a\\s+good\\s+explanation|good\\s+answer)";
const ACKNOWLEDGEMENT_REGEX = new RegExp(`^${ACKNOWLEDGEMENT_BASE}([\\s,]+${ACKNOWLEDGEMENT_BASE})*[.!]?$`, 'i');

// Greetings & Audio Check Banter (including compounds like "Hello, can you hear me?")
const GREETING_REGEX = /^(hello|hi|hey|good\s+(morning|afternoon|evening)|how\s+are\s+you|can\s+you\s+hear\s+me|am\s+i\s+audible|testing(\s+1\s+2\s+3)?|mic\s+check|audio\s+check|nice\s+to\s+meet\s+you|welcome\s+to\s+the\s+interview)($|[,\s]+(can\s+you\s+hear\s+me|am\s+i\s+audible|everyone|there|sir|team|\w+)[.?!]?$)/i;

// Incomplete sentence endings that indicate speaker hasn't finished
export const INCOMPLETE_TRAILING_WORDS = new Set([
  'between', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'from',
  'is', 'are', 'was', 'were', 'does', 'do', 'can', 'could', 'if', 'when', 'while',
  'the', 'a', 'an', 'that', 'which', 'because', 'so', 'then', 'as', 'than', 'like',
  'vs', 'versus', 'into', 'about'
]);

// Difference / Comparison keywords
const DIFFERENCE_REGEX = /\b(difference\s+between|compare|vs|versus|differ\s+from|pros\s+and\s+cons|distinguish\s+between|trade-?offs?\s+between)\b/i;

// How / Why mechanism keywords
const HOW_WHY_REGEX = /\b(how\s+does|how\s+do|how\s+to|how\s+would|why\s+does|why\s+is|why\s+do|why\s+should|explain\s+how|walk\s+me\s+through\s+how|what\s+is\s+the\s+mechanism)\b/i;

// Short contextual follow-up expressions
const FOLLOW_UP_REGEX = /^(why\??|why\s+is\s+that\??|why\s+so\??|how\s+so\??|what\s+about\s+(the\s+)?alternative\??|what\s+about\s+[a-z0-9_-]+\??|what\s+about\s+(its|their|the)\s+(advantages?|benefits?|drawbacks?|downsides?|limitations?|trade-?offs?)\??|what\s+if\s+.*\??|can\s+you\s+elaborate\??|could\s+you\s+elaborate\??|is\s+there\s+an\s+alternative\??|any\s+(trade-?offs?|downsides?|drawbacks?|limitations?)\??|and\s+then\??|what\s+happens\s+next\??)$/i;

// Interrogative starters indicating genuine questions
const QUESTION_STARTERS_REGEX = /^(what|why|how|when|where|which|who|whom|whose|explain|describe|define|implement|design|write\s+a|write\s+code|compare|differentiate|walk\s+me\s+through|solve|tell\s+me\s+about|can\s+you|could\s+you|would\s+you|is\s+it|are\s+there|does|do\s+you|have\s+you|should\s+we|will\s+this|give\s+an\s+example|calculate|compute|derive|evaluate|state|find|analyze|discuss|outline|summarize|determine|estimate|demonstrate|illustrate|clarify|provide)\b/i;

// Core Technical & Engineering Interview Keywords
const TECHNICAL_TOPICS = [
  // CS, Programming & Systems
  'javascript', 'typescript', 'python', 'java', 'c++', 'golang', 'rust', 'sql',
  'nosql', 'react', 'next.js', 'node.js', 'vue', 'angular', 'redux', 'hook',
  'closure', 'event loop', 'promise', 'async', 'await', 'prototype', 'hoisting',
  'var', 'let', 'const', 'process', 'thread', 'deadlock', 'concurrency', 'mutex',
  'semaphore', 'b-tree', 'lsm tree', 'indexing', 'hash map', 'hash table',
  'binary search', 'two sum', 'dynamic programming', 'recursion', 'bfs', 'dfs',
  'system design', 'rate limiter', 'microservices', 'load balancer', 'cache',
  'redis', 'kafka', 'database', 'acid', 'cap theorem', 'sharding', 'replication',
  'garbage collection', 'memory leak', 'solid principles', 'rest api', 'graphql',
  'docker', 'kubernetes', 'jwt', 'oauth', 'tcp', 'udp', 'http', 'https', 'dns',
  'cpu', 'gpu', 'ram', 'jvm', 'v8', 'compiler', 'interpreter', 'exception',
  // Electrical & Electronics
  'ohm', 'kirchhoff', 'voltage', 'current', 'resistance', 'impedance', 'diode',
  'transistor', 'mosfet', 'op-amp', 'transformer', 'ac', 'dc', 'capacitance',
  'inductance', 'semiconductor', 'logic gate', 'microcontroller',
  // Mechanical & Civil
  'thermodynamics', 'carnot', 'bernoulli', 'fluid dynamics', 'heat transfer',
  'stress', 'strain', 'young\'s modulus', 'beam', 'shear', 'torsion', 'concrete',
  'slump test', 'foundation', 'truss', 'reynolds number', 'viscosity',
  // Cybersecurity
  'sql injection', 'xss', 'csrf', 'cross-site', 'firewall', 'encryption', 'cryptography',
  'rsa', 'aes', 'public key', 'private key', 'buffer overflow', 'penetration testing',
  'zero day', 'malware', 'trojan', 'phishing', 'cia triad',
  // Mathematics & Science
  'calculus', 'derivative', 'integral', 'fourier', 'laplace', 'eigenvalue', 'eigenvector',
  'matrix', 'probability', 'statistics', 'normal distribution', 'bayes'
];

/**
 * Detects dual-concept comparison questions such as:
 * - "What is the difference between X and Y?"
 * - "Explain X and Y"
 * - "What are X and Y"
 * - "X vs Y"
 * Does NOT match single-concept definition questions like "Explain X" or "What are microservices".
 */
export function isDualConceptComparison(text: string): { isDual: boolean; subject1?: string; subject2?: string } {
  const clean = text.trim().replace(/[?!.,;:]+$/, '').trim();
  const lower = clean.toLowerCase();

  // Pattern 1: Explicit comparison patterns (difference between X and Y, compare X and Y, X vs Y)
  const diffBetweenMatch = lower.match(/\b(?:difference|differences)\s+between\s+(.+?)\s+\b(?:and|or|vs|versus)\b\s+(.+)$/i);
  if (diffBetweenMatch) {
    return { isDual: true, subject1: diffBetweenMatch[1].trim(), subject2: diffBetweenMatch[2].trim() };
  }

  const vsMatch = lower.match(/^(.+?)\s+\b(?:vs|versus)\b\s+(.+)$/i);
  if (vsMatch) {
    return { isDual: true, subject1: vsMatch[1].trim(), subject2: vsMatch[2].trim() };
  }

  const compareMatch = lower.match(/\bcompare\s+(.+?)\s+\b(?:and|with|to|vs)\b\s+(.+)$/i);
  if (compareMatch) {
    return { isDual: true, subject1: compareMatch[1].trim(), subject2: compareMatch[2].trim() };
  }

  // Pattern 2: "Explain X and Y", "Describe X and Y", "What are X and Y", "What is X and Y"
  const dualMatch = lower.match(/^(?:explain|describe|what\s+are|what\s+is)\s+(.+?)\s+\band\b\s+(.+)$/i);
  if (dualMatch) {
    const s1 = dualMatch[1].trim();
    const s2 = dualMatch[2].trim();
    const stopWords = new Set(['you', 'me', 'it', 'them', 'this', 'that', 'these', 'those', 'here', 'there', 'why', 'how']);
    if (!stopWords.has(s1) && !stopWords.has(s2) && s1.length >= 2 && s2.length >= 2) {
      if (!/\b(?:pros?|cons?|advantages?|disadvantages?|strengths?|weaknesses?|differences?)\b/i.test(s1)) {
        return { isDual: true, subject1: s1, subject2: s2 };
      }
    }
  }

  return { isDual: false };
}

/**
 * Validates whether an utterance asking for a comparison actually specifies the subjects to compare.
 * Prevents premature triggering and hallucination for queries like "What is the difference?"
 */
export function hasValidComparisonSubjects(text: string): boolean {
  const clean = text.trim().replace(/[?!.,;:]+$/, '').trim();
  const lower = clean.toLowerCase();

  if (isDualConceptComparison(clean).isDual) {
    return true;
  }

  const isComparisonQuery = /\b(difference|differences|compare|differ|distinguish|trade-?off|trade-?offs|vs|versus)\b/i.test(lower);
  if (!isComparisonQuery) {
    return true; // Not a comparison query, so comparison subjects are not expected
  }

  // 1. Check for "between"
  const betweenMatch = lower.match(/\bbetween\s+(.+)$/i);
  if (betweenMatch) {
    const afterBetween = betweenMatch[1].trim();
    if (!afterBetween) return false;

    // Must have "and" or "or" or "vs" or "versus" separating two subjects
    const parts = afterBetween.split(/\b(and|or|vs|versus)\b/i)
      .map(p => p.trim())
      .filter(p => !['and', 'or', 'vs', 'versus'].includes(p) && p.length > 0);
    
    if (parts.length >= 2) {
      return parts[0].length >= 2 && parts[1].length >= 2;
    }

    // Or explicit plural comparative subjects (e.g. "between the two architectures", "between processes and threads")
    if (afterBetween.startsWith('the two ') || afterBetween.startsWith('both approaches') || afterBetween.startsWith('both technologies')) {
      return true;
    }
    if (afterBetween.split(' ').length >= 2 && /(s|es)$/i.test(afterBetween) && !/^(them|these|those)$/i.test(afterBetween)) {
      return true;
    }

    return false;
  }

  // 2. Check for "X vs Y" or "X versus Y"
  const vsMatch = lower.match(/^(.+?)\s+\b(vs|versus)\b\s+(.+)$/i);
  if (vsMatch) {
    const left = vsMatch[1].trim();
    const right = vsMatch[3].trim();
    return left.length >= 2 && right.length >= 2;
  }

  // 3. Check for "compare X (and|with|to) Y"
  const compareMatch = lower.match(/\bcompare\s+(.+?)\s+\b(and|with|to)\s+(.+)$/i);
  if (compareMatch) {
    const left = compareMatch[1].trim();
    const right = compareMatch[3].trim();
    return left.length >= 2 && right.length >= 2;
  }

  // 4. Check for "how does X differ from Y" or "X differs from Y"
  const differMatch = lower.match(/\b(.+?)\s+differ(?:s)?\s+from\s+(.+)$/i);
  if (differMatch) {
    const left = differMatch[1].trim();
    const right = differMatch[2].trim();
    return left.length >= 2 && right.length >= 2;
  }

  // 5. Check for "trade-offs of / between X"
  const tradeoffMatch = lower.match(/\btrade-?offs?\s+(of|in|for)\s+(.+)$/i);
  if (tradeoffMatch) {
    return tradeoffMatch[2].trim().length >= 3;
  }

  // Comparison keywords present but missing comparison subjects
  return false;
}

/**
 * Extracts key technical terms for context matching
 */
export function extractKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  return TECHNICAL_TOPICS.filter(kw => lower.includes(kw));
}

// -------------------------------------------------------------
// 2. Utterance Classification Engine
// -------------------------------------------------------------

export function classifyUtterance(rawText: string, recentContext: ConversationTurnSummary[] = []): ClassificationResult {
  const clean = rawText.trim().replace(/\s+/g, ' ');
  const lower = clean.toLowerCase();
  const words = lower.split(' ').filter(Boolean);

  // 1. Empty or too brief to be meaningful
  if (words.length === 0 || clean.length < 2) {
    return {
      isQuestion: false,
      intent: 'INCOMPLETE_FRAGMENT',
      category: 'GENERAL',
      cleanText: clean,
      confidence: 1.0,
      reason: 'Empty or sub-threshold length',
      isFollowUp: false
    };
  }

  // 2. Greetings & Audio Check Banter (Reject immediately)
  if (GREETING_REGEX.test(clean)) {
    return {
      isQuestion: false,
      intent: 'GREETING_OR_BANTER',
      category: 'GENERAL',
      cleanText: clean,
      confidence: 0.98,
      reason: 'Greeting or microphone check',
      isFollowUp: false
    };
  }

  // 3. Acknowledgements / Reactions / Backchanneling (Reject immediately)
  if (ACKNOWLEDGEMENT_REGEX.test(clean)) {
    return {
      isQuestion: false,
      intent: 'ACKNOWLEDGEMENT',
      category: 'GENERAL',
      cleanText: clean,
      confidence: 0.98,
      reason: 'Conversational acknowledgement or reaction',
      isFollowUp: false
    };
  }

  // 4. Topic Transitions (e.g. "Now let's discuss JavaScript", "Let's move on to indexing") (Reject immediately)
  const isTransition = TOPIC_TRANSITION_REGEX.test(clean) || 
                       TOPIC_TRANSITION_PHRASES.some(phrase => lower.startsWith(phrase));
  if (isTransition && !clean.endsWith('?')) {
    return {
      isQuestion: false,
      intent: 'TOPIC_TRANSITION',
      category: 'GENERAL',
      cleanText: clean,
      confidence: 0.95,
      reason: 'Topic transition statement (e.g. "Now let\'s discuss...")',
      isFollowUp: false
    };
  }

  // 5. Incomplete Speech Fragments (Speaker paused mid-sentence on prepositions/conjunctions)
  const lastWord = words[words.length - 1].replace(/[.,!?;:]/g, '');
  if (INCOMPLETE_TRAILING_WORDS.has(lastWord) && words.length < 15) {
    return {
      isQuestion: false,
      intent: 'INCOMPLETE_FRAGMENT',
      category: 'GENERAL',
      cleanText: clean,
      confidence: 0.95,
      reason: `Trailing connector "${lastWord}" indicates incomplete utterance`,
      isFollowUp: false
    };
  }

  // 6. Incomplete Comparison Questions (e.g. "What is the difference?", "What is the difference between?")
  const isComparisonQuery = /\b(difference|differences|compare|differ|distinguish|trade-?off|trade-?offs)\b/i.test(lower);
  if (isComparisonQuery && !hasValidComparisonSubjects(clean)) {
    return {
      isQuestion: false,
      intent: 'INCOMPLETE_FRAGMENT',
      category: 'DIFFERENCE',
      cleanText: clean,
      confidence: 0.95,
      reason: 'Incomplete comparison question: missing comparison subjects (e.g., "between X and Y")',
      isFollowUp: false
    };
  }

  // 7. Contextual Follow-up Questions (e.g. "Why?", "What about the alternative?", "How so?")
  if (FOLLOW_UP_REGEX.test(clean) || (words.length <= 4 && (lower.startsWith('why') || lower.startsWith('how so') || lower.includes('alternative')))) {
    if (recentContext.length === 0) {
      return {
        isQuestion: false,
        intent: 'INCOMPLETE_FRAGMENT',
        category: 'FOLLOW_UP',
        cleanText: clean,
        confidence: 0.90,
        reason: 'Follow-up question lacks preceding conversational context',
        isFollowUp: false
      };
    }

    const parent = recentContext[0];
    const isStale = (Date.now() - parent.timestamp) > 120000;
    if (isStale) {
      return {
        isQuestion: false,
        intent: 'INCOMPLETE_FRAGMENT',
        category: 'FOLLOW_UP',
        cleanText: clean,
        confidence: 0.85,
        reason: 'Preceding conversation context is stale (> 120s); cannot reliably anchor follow-up',
        isFollowUp: false
      };
    }

    return {
      isQuestion: true,
      intent: 'GENUINE_QUESTION',
      category: 'FOLLOW_UP',
      cleanText: clean,
      confidence: 0.95,
      reason: 'Contextual follow-up question',
      isFollowUp: true,
      parentTopicHint: parent.question
    };
  }

  // 8. Difference / Comparison Questions (verified to have comparison subjects)
  const dualInfo = isDualConceptComparison(clean);
  if ((DIFFERENCE_REGEX.test(clean) || dualInfo.isDual) && hasValidComparisonSubjects(clean)) {
    return {
      isQuestion: true,
      intent: 'GENUINE_QUESTION',
      category: 'DIFFERENCE',
      cleanText: clean,
      confidence: 0.95,
      reason: dualInfo.isDual ? 'Dual-concept comparison question' : 'Comparative technical question with valid comparison subjects',
      isFollowUp: false
    };
  }

  // 9. How / Why Mechanism Questions
  if (HOW_WHY_REGEX.test(clean)) {
    return {
      isQuestion: true,
      intent: 'GENUINE_QUESTION',
      category: 'HOW_WHY',
      cleanText: clean,
      confidence: 0.92,
      reason: 'Mechanism or causal explanation question (How/Why)',
      isFollowUp: false
    };
  }

  // 10. Direct Questions (starts with interrogative or prompt keyword)
  const hasTerminalQuestion = clean.endsWith('?');
  if (QUESTION_STARTERS_REGEX.test(clean) || hasTerminalQuestion) {
    // If it has terminal question mark or clear starter, it is a genuine question
    const isDirect = words.length <= 15 && !lower.includes('compare') && !lower.includes('difference');
    return {
      isQuestion: true,
      intent: 'GENUINE_QUESTION',
      category: isDirect ? 'DIRECT' : 'GENERAL',
      cleanText: clean,
      confidence: 0.90,
      reason: 'Interrogative starter or explicit question mark',
      isFollowUp: false
    };
  }

  // 11. Declarative Statements (e.g. "JavaScript is single threaded", "We use PostgreSQL at my company")
  const isDeclarative = /^(i\s+(am|have|think|worked|prefer)|we\s+(use|are|have|built)|this\s+is|it\s+is|that\s+is|my\s+experience)\b/i.test(clean);
  if (isDeclarative && !hasTerminalQuestion) {
    return {
      isQuestion: false,
      intent: 'STATEMENT',
      category: 'GENERAL',
      cleanText: clean,
      confidence: 0.92,
      reason: 'Declarative candidate/interviewer statement',
      isFollowUp: false
    };
  }

  // 12. Technical Prompt heuristic: contains a known technical topic AND an action/query word
  const hasTechTopic = TECHNICAL_TOPICS.some(topic => lower.includes(topic));
  const hasActionQuery = /\b(use|work|workings|benefit|disadvantage|issue|error|pattern|structure|algorithm|lifecycle|scope|law|equation|principle|formula|method|test|analysis|calculation|design|trade-?off)\b/i.test(lower);

  if (hasTechTopic && (hasActionQuery || hasTerminalQuestion) && words.length >= 3) {
    return {
      isQuestion: true,
      intent: 'GENUINE_QUESTION',
      category: 'GENERAL',
      cleanText: clean,
      confidence: 0.85,
      reason: 'Technical concept with query context',
      isFollowUp: false
    };
  }

  // Default: Non-question statement
  return {
    isQuestion: false,
    intent: 'STATEMENT',
    category: 'GENERAL',
    cleanText: clean,
    confidence: 0.80,
    reason: 'Lacks interrogative structure and question mark',
    isFollowUp: false
  };
}

/**
 * Gatekeeper function that decides whether an utterance is complete and ready for AI answer generation.
 * Returns false for incomplete prompts like "What is the difference?", "What is the difference between",
 * or unanchored follow-ups like "Why?" without previous context.
 */
export function isQuestionReadyForAnswer(
  text: string, 
  contextHistory: ConversationTurnSummary[] = []
): QuestionReadinessResult {
  const clean = text.trim().replace(/\s+/g, ' ');
  const lower = clean.toLowerCase();
  const words = lower.split(' ').filter(Boolean);

  // Standalone follow-up token check (e.g. "Why?", "How so?")
  const isShortFollowUp = /^(?:why|how so)\??$/i.test(clean);
  if (isShortFollowUp) {
    if (!contextHistory || contextHistory.length === 0) {
      return {
        isReady: false,
        reason: 'Follow-up question lacks preceding conversational context',
        isFollowUpCandidate: false,
        needsMoreSpeech: true
      };
    }
    const parent = contextHistory[0];
    const isStale = (Date.now() - (parent.timestamp || 0)) > 120000;
    if (isStale) {
      return {
        isReady: false,
        reason: 'Preceding conversation context is stale (> 120s); cannot reliably anchor follow-up',
        isFollowUpCandidate: false,
        needsMoreSpeech: true
      };
    }
    return {
      isReady: true,
      reason: 'Anchored follow-up to immediate preceding topic',
      isFollowUpCandidate: true,
      needsMoreSpeech: false
    };
  }

  if (words.length < 2 || clean.length < 3) {
    return {
      isReady: false,
      reason: 'Utterance is too short to form a complete question',
      isFollowUpCandidate: false,
      needsMoreSpeech: true
    };
  }

  // Trailing incomplete connector words (e.g. "between", "and", "or", "of", "to", "with")
  const trailingConnectorMatch = lower.replace(/[?!.,;:]+$/, '').trim().match(/\b(between|and|or|of|to|with|for|about|vs|versus|than|like|differ|differs)\b$/i);
  if (trailingConnectorMatch) {
    return {
      isReady: false,
      reason: `Utterance ends prematurely on incomplete connector "${trailingConnectorMatch[1]}"`,
      isFollowUpCandidate: false,
      needsMoreSpeech: true
    };
  }

  // Strict comparison validation
  const isComparison = /\b(difference|differences|compare|differ|distinguish|trade-?off|trade-?offs|vs|versus)\b/i.test(lower);
  if (isComparison && !hasValidComparisonSubjects(clean)) {
    return {
      isReady: false,
      reason: 'Incomplete comparison question: missing comparison subjects (e.g. "between X and Y")',
      isFollowUpCandidate: false,
      needsMoreSpeech: true
    };
  }

  // Vague referents requiring immediate preceding context: "Explain it", "Why is that?", "What about it?"
  const isVagueReferent = /^(?:explain|tell me about|what is|how does|why is|why does|elaborate on)\s+(?:it|this|that|them)\??$/i.test(clean) ||
                          /^(?:why|why is that|why so|how come)\??$/i.test(clean);
  if (isVagueReferent) {
    if (!contextHistory || contextHistory.length === 0) {
      return {
        isReady: false,
        reason: 'Referent is unclear: no preceding conversation context to anchor this follow-up',
        isFollowUpCandidate: false,
        needsMoreSpeech: true
      };
    }
    const parent = contextHistory[0];
    const isStale = (Date.now() - (parent.timestamp || 0)) > 120000;
    if (isStale) {
      return {
        isReady: false,
        reason: 'Preceding conversation context is stale (> 120s); cannot reliably anchor follow-up',
        isFollowUpCandidate: false,
        needsMoreSpeech: true
      };
    }
  }

  // Check classification
  const classification = classifyUtterance(clean, contextHistory);
  if (!classification.isQuestion) {
    return {
      isReady: false,
      reason: classification.reason,
      isFollowUpCandidate: false,
      needsMoreSpeech: classification.intent === 'INCOMPLETE_FRAGMENT'
    };
  }

  return {
    isReady: true,
    reason: classification.reason,
    isFollowUpCandidate: classification.isFollowUp,
    needsMoreSpeech: false
  };
}

// -------------------------------------------------------------
// 3. Speech Fragment Merger (Requirement 3)
// -------------------------------------------------------------

/**
 * Restores or ensures terminal question mark for interrogative or comparative sentences.
 */
export function formatCompleteQuestion(text: string): string {
  const clean = text.trim();
  if (!clean) return '';
  const withoutTrailingPunct = clean.replace(/[?.,!;:]+$/, '').trim();
  const lower = withoutTrailingPunct.toLowerCase();

  const isInterrogative = /^(what|why|how|when|where|which|who|whom|whose|explain|describe|define|implement|compare|differentiate|can you|could you|would you|is|are|does|do|have|should|will|calculate|compute|derive|evaluate|state|find|analyze|discuss|outline|summarize)\b/i.test(lower);
  const isComparison = /\b(difference\s+between|differences\s+between|compare|vs|versus|differ\s+from)\b/i.test(lower);

  if (isInterrogative || isComparison) {
    return `${withoutTrailingPunct}?`;
  }
  return clean;
}

/**
 * Strips premature terminal punctuation from an incomplete fragment.
 */
export function cleanPrematurePunctuation(text: string): string {
  return text.trim().replace(/[?.,!;:]+$/, '').trim();
}

/**
 * Merges partial/consecutive speech fragments into a clean, coherent question.
 * Eliminates overlapping duplicate words, bridges comparison starters with "between",
 * and strips premature trailing punctuation while restoring appropriate question marks.
 */
export function mergeSpeechFragments(existing: string, incoming: string): string {
  const prev = cleanPrematurePunctuation(existing);
  const next = incoming.trim();

  if (!prev) return formatCompleteQuestion(next);
  if (!next) return formatCompleteQuestion(prev);

  const lowerPrev = prev.toLowerCase();
  const lowerNext = next.toLowerCase();

  // 1. Cumulative STT result where incoming supersedes existing
  if (lowerNext.startsWith(lowerPrev)) {
    return formatCompleteQuestion(next);
  }
  // 2. STT result where existing already contains incoming
  const cleanNextLower = lowerNext.replace(/[?.,!;:]+$/, '').trim();
  if (lowerPrev.endsWith(cleanNextLower)) {
    return formatCompleteQuestion(prev);
  }

  const prevWords = prev.split(/\s+/);
  const nextWords = next.split(/\s+/);

  // 3. Check for word overlaps between the end of prev and start of next (up to 6 words)
  const maxOverlap = Math.min(prevWords.length, nextWords.length, 6);
  let overlapCount = 0;

  for (let k = maxOverlap; k >= 1; k--) {
    const prevSlice = prevWords.slice(prevWords.length - k).map(w => w.toLowerCase().replace(/[^\w]/g, ''));
    const nextSlice = nextWords.slice(0, k).map(w => w.toLowerCase().replace(/[^\w]/g, ''));

    if (prevSlice.join(' ') === nextSlice.join(' ')) {
      overlapCount = k;
      break;
    }
  }

  if (overlapCount > 0) {
    const joined = [...prevWords, ...nextWords.slice(overlapCount)].join(' ');
    return formatCompleteQuestion(joined);
  }

  // 4. Difference connector bridging:
  // If prev ends with comparison indicator ("difference", "differences", "differ")
  // and incoming does not start with a connector ("between", "in", "of", "among", "with", "from", "to"),
  // automatically bridge with " between ".
  const isDiffStarter = /\b(what\s+is\s+the|what's\s+the|whats\s+the|what\s+are\s+the|tell\s+me\s+the|explain\s+the)?\s*(difference|differences|distinction|differ)\b$/i.test(prev);
  const startsWithConnector = /^(between|of|in|among|with|from|to|for|vs|versus)\b/i.test(next);

  let merged: string;
  if (isDiffStarter && !startsWithConnector) {
    merged = `${prev} between ${next}`;
  } else {
    merged = `${prev} ${next}`;
  }

  return formatCompleteQuestion(merged);
}

// -------------------------------------------------------------
// 4. Conversation Context Tracker (Requirement 4)
// -------------------------------------------------------------

export class ConversationContextTracker {
  private history: ConversationTurnSummary[] = [];
  private maxHistory: number;

  constructor(maxHistory = 5) {
    this.maxHistory = maxHistory;
  }

  public recordTurn(question: string, summary: string, category: QuestionCategory = 'GENERAL') {
    const item: ConversationTurnSummary = {
      id: `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      question: question.trim(),
      summary: summary.trim(),
      timestamp: Date.now(),
      category,
      keywords: extractKeywords(question)
    };
    this.history.unshift(item);
    if (this.history.length > this.maxHistory) {
      this.history.pop();
    }
  }

  public getRecentHistory(): ConversationTurnSummary[] {
    return [...this.history];
  }

  public getLatestTopic(): ConversationTurnSummary | undefined {
    return this.history[0];
  }

  /**
   * Resolves follow-ups like "Why?" or "What about the alternative?"
   * into a fully contextualized query prompt for Ollama.
   * Conservative: only reuses context when the query genuinely refers to the immediate prior topic.
   * NEVER borrows comparison subjects for an incomplete difference question.
   */
  public resolveContextualPrompt(query: string): { 
    enrichedPrompt: string; 
    isFollowUp: boolean; 
    parentQuestion?: string;
    category: QuestionCategory;
  } {
    const readiness = isQuestionReadyForAnswer(query, this.history);
    const classification = classifyUtterance(query, this.history);
    
    // Only resolve as follow-up if readiness explicitly confirmed isFollowUpCandidate
    // AND the preceding topic is fresh (<= 120s)
    if (readiness.isFollowUpCandidate && this.history.length > 0) {
      const parent = this.history[0];
      const ageMs = Date.now() - parent.timestamp;
      
      const isComparison = /\b(difference|compare|vs|versus)\b/i.test(query);
      if (ageMs <= 120000 && (!isComparison || hasValidComparisonSubjects(query))) {
        const enrichedPrompt = `[Context: Previous interview discussion on "${parent.question}". Core summary was: "${parent.summary}".]\nInterviewer follow-up question: "${query}"\nProvide a focused, direct answer to this follow-up without repeating the full previous explanation.`;

        return {
          enrichedPrompt,
          isFollowUp: true,
          parentQuestion: parent.question,
          category: 'FOLLOW_UP'
        };
      }
    }

    return {
      enrichedPrompt: query,
      isFollowUp: false,
      category: classification.category
    };
  }

  public clear(): void {
    this.history = [];
  }
}

// -------------------------------------------------------------
// 5. New Question Superseding & Cancellation (Requirement 5)
// -------------------------------------------------------------

/**
 * Determines whether a newly arrived question is an independent new question
 * that should cancel and supersede an in-flight answer generation.
 */
export function isNewIndependentQuestion(
  newQuery: string, 
  inFlightQuery?: string
): { isNew: boolean; shouldCancel: boolean; reason: string } {
  if (!inFlightQuery) {
    return { isNew: true, shouldCancel: false, reason: 'No active generation in flight' };
  }

  const cleanNew = newQuery.trim();
  const cleanInFlight = inFlightQuery.trim();

  // If identical, do not cancel (it's the same question)
  if (cleanNew.toLowerCase() === cleanInFlight.toLowerCase()) {
    return { isNew: false, shouldCancel: false, reason: 'Identical to in-flight query' };
  }

  // If new query is an extension of the in-flight query (e.g. "What is Redis" -> "What is Redis and how does it work?"),
  // supersede with the more complete query
  if (cleanNew.toLowerCase().startsWith(cleanInFlight.toLowerCase())) {
    return { isNew: true, shouldCancel: true, reason: 'Expanded query supersedes in-flight partial query' };
  }

  // Check if it's a completely different topic
  const newKeywords = extractKeywords(cleanNew);
  const inFlightKeywords = extractKeywords(cleanInFlight);
  const sharesKeywords = newKeywords.some(k => inFlightKeywords.includes(k));

  if (!sharesKeywords && cleanNew.length >= 8) {
    return { isNew: true, shouldCancel: true, reason: 'Different technical topic arrives' };
  }

  // Any distinct question arriving during generation supersedes the older generation
  return { isNew: true, shouldCancel: true, reason: 'New independent question takes priority' };
}
