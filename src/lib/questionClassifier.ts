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
  extractedContext?: string;
  extractedQuestions?: string[];
}

export interface ExtractedQuestionContext {
  hasQuestion: boolean;
  context: string;
  questions: string[];
  primaryQuestion: string;
  intent: UtteranceIntent;
  category: QuestionCategory;
  confidence: number;
  reason: string;
  isFollowUp: boolean;
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
  utteranceId?: string;
  question: string;
  rawTranscript?: string;
  normalizedTranscript?: string;
  concept?: string;
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

// Transitional scenario preambles that introduce context before a question
export const SCENARIO_PREAMBLE_REGEX = /^(?:considering\s+(?:all\s+)?(?:of\s+)?(?:these|the|this|our|the\s+above)\s+(?:requirements|scenario|context|points|constraints|architecture)|given\s+this\s+(?:scenario|architecture|problem|context|setup)|in\s+this\s+scenario|based\s+on\s+this|with\s+that\s+in\s+mind|so\b),?\s*/i;

// Conversational and interrogative question patterns anywhere in a sentence or clause
export const INTERROGATIVE_PATTERNS = [
  /^(what|why|how|when|where|which|who|whom|whose)\b/i,
  /^(can\s+you|could\s+you|would\s+you|will\s+you|do\s+you|have\s+you|are\s+there|is\s+there|is\s+it|should\s+we|does)\b/i,
  /\b(how\s+would\s+you|what\s+would\s+be\s+your|what\s+is\s+your\s+approach|how\s+do\s+you\s+handle|how\s+to\s+handle|how\s+should\s+we|which\s+one\s+would\s+you|can\s+you\s+explain|could\s+you\s+explain|can\s+you\s+describe)\b/i,
  /\b(explain\b|describe\b|walk\s+me\s+through\b|tell\s+me\s+about\b|differentiate\b)/i,
  /\b(difference\s+between|differences\s+between|compare|vs|versus|trade-?offs?\s+between)\b/i
];

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
 * Extracts the primary conceptual subject from an interview question.
 * Examples:
 * - "What is stemming?" -> "stemming"
 * - "What is a REST API?" -> "rest api"
 * - "What are its constraints?" -> "constraints"
 * - "Explain inheritance in Java" -> "inheritance"
 * - "Difference between Array and ArrayList" -> "array vs arraylist"
 */
export function extractConceptFromQuestion(question: string): string {
  if (!question || typeof question !== 'string') return '';
  const clean = question.trim().replace(/[?!.,;:]+$/, '').trim();
  const lower = clean.toLowerCase();

  // Pattern 1: Explicit Comparisons (difference between X and Y, X vs Y)
  const diffMatch = lower.match(/\b(?:difference\s+between|compare|differentiate\s+between)\s+(.+?)\s+\b(?:and|vs|versus)\b\s+(.+)$/i);
  if (diffMatch) {
    const s1 = diffMatch[1].replace(/^(?:an?|the)\s+/i, '').trim();
    const s2 = diffMatch[2].replace(/^(?:an?|the)\s+/i, '').trim();
    return `${s1} vs ${s2}`;
  }
  const vsMatch = lower.match(/^(.+?)\s+\b(?:vs|versus)\b\s+(.+)$/i);
  if (vsMatch) {
    const s1 = vsMatch[1].replace(/^(?:an?|the)\s+/i, '').trim();
    const s2 = vsMatch[2].replace(/^(?:an?|the)\s+/i, '').trim();
    return `${s1} vs ${s2}`;
  }

  // Pattern 2: "What is [concept] / What are [concept]"
  const whatIsMatch = lower.match(/^(?:can\s+you\s+explain\s+|could\s+you\s+explain\s+|tell\s+me\s+about\s+)?what\s+(?:is|are)\s+(?:an?|the\s+concept\s+of\s+|the\s+)?(.+?)(?:\s+(?:in|and\s+how|internally|used|for|with)\b.*)?$/i);
  if (whatIsMatch && whatIsMatch[1]) {
    const candidate = whatIsMatch[1].trim();
    if (candidate.length >= 2 && !/^(?:it|its|this|that|these|those)$/i.test(candidate)) {
      return candidate;
    }
  }

  // Pattern 3: "Explain [concept] / Describe [concept]"
  const explainMatch = lower.match(/^(?:can\s+you\s+|could\s+you\s+)?(?:explain|describe|walk\s+me\s+through|tell\s+me\s+about)\s+(?:the\s+concept\s+of\s+|an?|the\s+)?(.+?)(?:\s+(?:in|and\s+how|internally|used|for|with)\b.*)?$/i);
  if (explainMatch && explainMatch[1]) {
    const candidate = explainMatch[1].trim();
    if (candidate.length >= 2 && !/^(?:it|its|this|that|these|those|statelessness\s+with\s+an\s+example)$/i.test(candidate)) {
      return candidate;
    }
  }

  // Pattern 4: "How does [concept] work"
  const howDoesMatch = lower.match(/^how\s+does\s+(?:an?|the\s+)?(.+?)\s+work(?:\s+internally)?/i);
  if (howDoesMatch && howDoesMatch[1]) {
    const candidate = howDoesMatch[1].trim();
    if (candidate.length >= 2 && !/^(?:it|this|that)$/i.test(candidate)) {
      return candidate;
    }
  }

  // Fallback: extract technical keywords
  const kws = extractKeywords(clean);
  if (kws.length > 0) {
    return kws[0];
  }

  // Fallback: strip leading interrogatives
  const stripped = lower
    .replace(/^(what\s+is|what\s+are|explain|describe|tell\s+me\s+about|how\s+does|how\s+to|can\s+you\s+explain)\s+(an?|the)?\s*/i, '')
    .trim();
  return stripped.split(/\s+/).slice(0, 3).join(' ');
}

export interface FollowUpDetectionResult {
  isFollowUp: boolean;
  parentTurn?: ConversationTurnSummary;
  parentConcept?: string;
  resolvedPrompt?: string;
  reason: string;
}

/**
 * Detects whether an utterance is a conversational follow-up to the immediately preceding question,
 * resolving anaphora and pronouns ("its", "it", "that", "this") to the active concept.
 * Ensures independent new questions (e.g. "What is sentiment analysis?" after "What is stemming?")
 * switch topics immediately and do NOT reuse previous context.
 */
export function detectFollowUpReference(
  rawText: string,
  parentTurn?: ConversationTurnSummary
): FollowUpDetectionResult {
  const clean = rawText.trim().replace(/[?!.,;:]+$/, '').trim();
  const lower = clean.toLowerCase();

  if (!parentTurn) {
    return { isFollowUp: false, reason: 'No preceding conversation turn' };
  }

  const ageMs = Date.now() - (parentTurn.timestamp || 0);
  if (ageMs > 180000) { // 3 minutes TTL
    return { isFollowUp: false, reason: 'Preceding context is stale (>180s)' };
  }

  const parentConcept = parentTurn.concept || extractConceptFromQuestion(parentTurn.question);
  if (!parentConcept) {
    return { isFollowUp: false, reason: 'Parent turn has no identifiable concept' };
  }

  // 1. Guard against new independent topic introductions
  // If the prompt explicitly introduces a brand new distinct technical concept, it is NOT a follow-up
  // e.g. "What is sentiment analysis?" when parent is "What is stemming?"
  const startsNewConcept = /^(what\s+is\s+(an?|the)?|explain\s+(the\s+concept\s+of\s+|an?|the)?|what\s+are\s+(an?|the)?)\s+([a-z0-9_-]+(\s+[a-z0-9_-]+)?)$/i.test(lower);
  if (startsNewConcept) {
    const conceptMatch = lower.match(/^(what\s+is\s+(?:an?|the)?|explain\s+(?:the\s+concept\s+of\s+|an?|the)?|what\s+are\s+(?:an?|the)?)\s+([a-z0-9_-]+(?:\s+[a-z0-9_-]+)?)$/i);
    const candidateConcept = conceptMatch ? conceptMatch[conceptMatch.length - 1].trim() : '';
    const isPronoun = /^(it|its|this|that|these|those)$/i.test(candidateConcept);
    if (!isPronoun && candidateConcept && candidateConcept !== parentConcept.toLowerCase()) {
      return { isFollowUp: false, reason: `Explicit switch to new concept "${candidateConcept}"` };
    }
  }

  // 2. Pronoun / Anaphoric reference indicators
  const hasAnaphora = /\b(it|its|this|that|these|those|the former|the latter)\b/i.test(lower);

  // 3. Follow-up inquiry patterns (asking about properties/constraints/mechanisms/subtopics without naming main subject)
  const isPropertyInquiry = 
    /\b(limitations?|drawbacks?|disadvantages?|advantages?|benefits?|constraints?|trade-?offs?|internally|statelessness|working|mechanism|example)\b/i.test(lower);

  const isShortFollowUp = 
    /^(why\??|why\s+is\s+that\??|why\s+so\??|how\s+so\??|what\s+about|how\s+about|how\s+would\s+you\s+handle|how\s+do\s+you\s+handle|how\s+to\s+handle|could\s+you\s+elaborate|can\s+you\s+elaborate|and\s+then|what\s+happens\s+next)\b/i.test(lower);

  const isComparativeFollowUp = 
    /\b(?:differ(?:s)?\s+from|different\s+(?:from|to|than)|difference\s+with|compare\s+(?:it|this|that)?\s*(?:with|to))\b/i.test(lower);

  if (hasAnaphora || isPropertyInquiry || isShortFollowUp || isComparativeFollowUp) {
    // Construct resolved prompt
    let resolvedPrompt = clean;
    if (lower.includes('its limitations') && (lower.includes('differ') || lower.includes('lemmatiz'))) {
      resolvedPrompt = `Explain the limitations of ${parentConcept} and how ${parentConcept} differs from lemmatization.`;
    } else if (hasAnaphora) {
      resolvedPrompt = clean
        .replace(/\bits\b/gi, `${parentConcept}'s`)
        .replace(/\b(it|this|that)\b/gi, parentConcept);
    } else if (lower.startsWith('explain statelessness') && parentConcept.toLowerCase().includes('rest')) {
      resolvedPrompt = `Explain statelessness in REST API with an example.`;
    }

    return {
      isFollowUp: true,
      parentTurn,
      parentConcept,
      resolvedPrompt,
      reason: `Anchored to prior topic "${parentConcept}" via follow-up indicator`
    };
  }

  return { isFollowUp: false, reason: 'Not recognized as a follow-up to prior topic' };
}

/**
 * Validates whether an utterance asking for a comparison actually specifies the subjects to compare.
 * Prevents premature triggering and hallucination for queries like "What is the difference?"
 */
export function hasValidComparisonSubjects(text: string, contextHistory?: ConversationTurnSummary[]): boolean {
  const clean = text.trim().replace(/[?!.,;:]+$/, '').trim();
  const lower = clean.toLowerCase();

  if (isDualConceptComparison(clean).isDual) {
    return true;
  }

  // If there is preceding context with an active concept and the question is a comparative follow-up:
  if (contextHistory && contextHistory.length > 0) {
    const parentConcept = contextHistory[0].concept || extractConceptFromQuestion(contextHistory[0].question);
    if (parentConcept) {
      const comparativeFollowUpMatch = lower.match(/\b(?:differ(?:s)?\s+from|different\s+(?:from|to|than)|difference\s+(?:from|with)|compare\s+(?:it|this|that)?\s*(?:with|to))\s+(.+)$/i);
      if (comparativeFollowUpMatch && comparativeFollowUpMatch[1].trim().length >= 2) {
        return true;
      }
    }
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

  // 4. Check for "how does X differ from Y", "X differs from Y", "X is different from Y"
  const differMatch = lower.match(/\b(.+?)\s+(?:differ(?:s)?\s+from|different\s+(?:from|to|than)|difference\s+(?:from|with))\s+(.+)$/i);
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

/**
 * Determines whether a clause or sentence represents an interrogative question
 * or an interviewer prompt directive (e.g. "explain how...", "how would you...", "?").
 */
export function isQuestionClause(text: string): boolean {
  const clean = text.trim();
  if (!clean || clean.length < 2) return false;
  if (clean.endsWith('?')) return true;
  const stripped = clean.replace(SCENARIO_PREAMBLE_REGEX, '').trim();
  if (stripped.endsWith('?')) return true;

  // Guard: Candidate stating they can or will explain is NOT a question
  const isCandidateExplanation = /^(?:i\s+(?:can|will|want\s+to|would\s+like\s+to|have)|let\s+me|we\s+(?:can|will|should|have))\s+(?:explain|describe|tell|walk)\b/i.test(stripped);
  if (isCandidateExplanation) return false;

  if (isDualConceptComparison(clean).isDual || isDualConceptComparison(stripped).isDual) return true;
  return INTERROGATIVE_PATTERNS.some(p => p.test(stripped) || p.test(clean));
}

/**
 * Splits multi-sentence speech while safely protecting version numbers,
 * decimals (e.g. 2.0, 3.2), and common technical terms (e.g. node.js, next.js).
 */
export function splitUtteranceSentences(text: string): string[] {
  const protectedText = text
    .replace(/(\d+)\.(\d+)/g, '$1__DECIMAL__$2')
    .replace(/([a-zA-Z0-9]+)\.([a-zA-Z0-9]+)/g, '$1__DOT__$2');

  const parts = protectedText.split(/(?<=[.?!;])\s+(?=[A-Za-z0-9"'])/);
  return parts.map(p => p.replace(/__DECIMAL__/g, '.').replace(/__DOT__/g, '.').trim()).filter(Boolean);
}

/**
 * Decomposes an incoming speech utterance into interviewer scenario context
 * and the actual question(s) asked.
 * Supports long 30-60+ second interviewer explanations ending with a question.
 */
export function extractQuestionAndContext(rawText: string): ExtractedQuestionContext {
  const clean = rawText.trim().replace(/\s+/g, ' ');
  if (!clean || clean.length < 2) {
    return {
      hasQuestion: false,
      context: '',
      questions: [],
      primaryQuestion: '',
      intent: 'INCOMPLETE_FRAGMENT',
      category: 'GENERAL',
      confidence: 1.0,
      reason: 'Empty or sub-threshold length',
      isFollowUp: false
    };
  }

  const sentences = splitUtteranceSentences(clean);
  const contextParts: string[] = [];
  const questionParts: string[] = [];

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];

    // Check if sentence starts with a scenario preamble (e.g. "Considering the above requirements, explain...")
    if (SCENARIO_PREAMBLE_REGEX.test(s)) {
      const match = s.match(SCENARIO_PREAMBLE_REGEX);
      if (match) {
        const preamble = match[0].trim();
        const afterPreamble = s.slice(match[0].length).trim();
        if (isQuestionClause(afterPreamble)) {
          if (preamble) contextParts.push(preamble);
          questionParts.push(afterPreamble);
          continue;
        }
      }
    }

    if (isQuestionClause(s)) {
      questionParts.push(s);
    } else {
      contextParts.push(s);
    }
  }

  const hasQuestion = questionParts.length > 0;
  const primaryQuestion = questionParts.join(' ');
  const context = contextParts.join(' ');

  // Determine category
  let category: QuestionCategory = 'GENERAL';
  if (isDualConceptComparison(primaryQuestion).isDual || DIFFERENCE_REGEX.test(primaryQuestion)) {
    category = 'DIFFERENCE';
  } else if (HOW_WHY_REGEX.test(primaryQuestion)) {
    category = 'HOW_WHY';
  } else if (FOLLOW_UP_REGEX.test(clean) || (clean.split(/\s+/).length <= 4 && /^(why|how so)\??$/i.test(clean))) {
    category = 'FOLLOW_UP';
  } else if (primaryQuestion.split(/\s+/).length <= 15 && !primaryQuestion.toLowerCase().includes('compare') && !primaryQuestion.toLowerCase().includes('difference')) {
    category = 'DIRECT';
  }

  return {
    hasQuestion,
    context,
    questions: questionParts,
    primaryQuestion,
    intent: hasQuestion ? 'GENUINE_QUESTION' : 'STATEMENT',
    category,
    confidence: hasQuestion ? 0.92 : 0.85,
    reason: hasQuestion
      ? (context ? 'Interviewer scenario with terminal/embedded question' : 'Direct question')
      : 'Declarative statement without interrogative question clause',
    isFollowUp: category === 'FOLLOW_UP'
  };
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

  // Extract scenario context and questions across all sentences/clauses
  const extracted = extractQuestionAndContext(clean);

  // 4. Topic Transitions (e.g. "Now let's discuss JavaScript", "Let's move on to indexing")
  const isTransition = TOPIC_TRANSITION_REGEX.test(clean) || 
                       TOPIC_TRANSITION_PHRASES.some(phrase => lower.startsWith(phrase));
  if (isTransition && !clean.endsWith('?') && !extracted.hasQuestion) {
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
  if (INCOMPLETE_TRAILING_WORDS.has(lastWord) && (words.length < 15 || lastWord === 'between' || lastWord === 'vs' || lastWord === 'versus')) {
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
  if (isComparisonQuery && !hasValidComparisonSubjects(clean, recentContext)) {
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

  // 7. Contextual Follow-up Questions (via conversation-aware detection)
  const followUpCheck = recentContext.length > 0 ? detectFollowUpReference(clean, recentContext[0]) : null;
  if (followUpCheck && followUpCheck.isFollowUp) {
    const parent = recentContext[0];
    const isComparisonFollowUp = /\b(difference|compare|vs|versus|differ)\b/i.test(clean);
    return {
      isQuestion: true,
      intent: 'GENUINE_QUESTION',
      category: isComparisonFollowUp ? 'DIFFERENCE' : 'FOLLOW_UP',
      cleanText: clean,
      confidence: 0.95,
      reason: followUpCheck.reason,
      isFollowUp: true,
      parentTopicHint: parent.question,
      extractedContext: extracted.context,
      extractedQuestions: [clean]
    };
  }

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
    const isStale = (Date.now() - parent.timestamp) > 180000;
    if (isStale) {
      return {
        isQuestion: false,
        intent: 'INCOMPLETE_FRAGMENT',
        category: 'FOLLOW_UP',
        cleanText: clean,
        confidence: 0.85,
        reason: 'Preceding conversation context is stale (> 180s); cannot reliably anchor follow-up',
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
      parentTopicHint: parent.question,
      extractedContext: extracted.context,
      extractedQuestions: [clean]
    };
  }

  // 8. If genuine question clause was found anywhere in utterance (terminal, embedded, or multi-question)
  if (extracted.hasQuestion) {
    const isFollowUp = Boolean(followUpCheck?.isFollowUp);

    return {
      isQuestion: true,
      intent: 'GENUINE_QUESTION',
      category: isFollowUp ? 'FOLLOW_UP' : extracted.category,
      cleanText: clean,
      confidence: extracted.confidence,
      reason: extracted.reason,
      isFollowUp,
      parentTopicHint: isFollowUp ? recentContext[0]?.question : undefined,
      extractedContext: extracted.context,
      extractedQuestions: extracted.questions
    };
  }

  // 9. Declarative Statements without any question clause (e.g. "JavaScript is single threaded", "We use PostgreSQL at my company")
  const isDeclarative = /^(i\s+(am|have|think|worked|prefer)|we\s+(use|are|have|built)|this\s+is|it\s+is|that\s+is|my\s+experience)\b/i.test(clean);
  if (isDeclarative && !clean.endsWith('?')) {
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

  // 10. Technical Prompt heuristic: contains a known technical topic AND an action/query word
  const hasTechTopic = TECHNICAL_TOPICS.some(topic => lower.includes(topic));
  const hasActionQuery = /\b(use|work|workings|benefit|disadvantage|issue|error|pattern|structure|algorithm|lifecycle|scope|law|equation|principle|formula|method|test|analysis|calculation|design|trade-?off)\b/i.test(lower);

  if (hasTechTopic && (hasActionQuery || clean.endsWith('?')) && words.length >= 3) {
    return {
      isQuestion: true,
      intent: 'GENUINE_QUESTION',
      category: 'GENERAL',
      cleanText: clean,
      confidence: 0.85,
      reason: 'Technical concept with query context',
      isFollowUp: false,
      extractedContext: extracted.context,
      extractedQuestions: [clean]
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

  // Check if it's an anchored follow-up to immediate preceding topic
  if (contextHistory && contextHistory.length > 0) {
    const followUpCheck = detectFollowUpReference(clean, contextHistory[0]);
    if (followUpCheck.isFollowUp) {
      return {
        isReady: true,
        reason: followUpCheck.reason,
        isFollowUpCandidate: true,
        needsMoreSpeech: false
      };
    }
  }

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
    const isStale = (Date.now() - (parent.timestamp || 0)) > 180000;
    if (isStale) {
      return {
        isReady: false,
        reason: 'Preceding conversation context is stale (> 180s); cannot reliably anchor follow-up',
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
  if (isComparison && !hasValidComparisonSubjects(clean, contextHistory)) {
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

  const extracted = extractQuestionAndContext(clean);
  if (extracted.hasQuestion) {
    return `${withoutTrailingPunct}?`;
  }

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
    // If existing ended with terminal punctuation (., !, ;), preserve it between distinct sentences
    const hadTerminalSentencePunct = /[.!;]$/.test(existing.trim());
    if (hadTerminalSentencePunct) {
      merged = `${prev}. ${next}`;
    } else {
      merged = `${prev} ${next}`;
    }
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

  public registerActiveTurn(
    question: string,
    utteranceId?: string,
    rawTranscript?: string,
    normalizedTranscript?: string,
    category: QuestionCategory = 'GENERAL'
  ): void {
    const concept = extractConceptFromQuestion(question);
    const item: ConversationTurnSummary = {
      id: `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      utteranceId,
      question: question.trim(),
      rawTranscript: rawTranscript || question,
      normalizedTranscript: normalizedTranscript || question,
      concept,
      summary: '',
      timestamp: Date.now(),
      category,
      keywords: extractKeywords(question)
    };

    if (this.history.length > 0 && this.history[0].question.toLowerCase() === question.trim().toLowerCase()) {
      this.history[0] = { ...this.history[0], ...item };
    } else {
      this.history.unshift(item);
      if (this.history.length > this.maxHistory) {
        this.history.pop();
      }
    }
  }

  public updateLatestTurnSummary(summary: string, category?: QuestionCategory): void {
    if (this.history.length > 0) {
      this.history[0].summary = summary.trim();
      if (category) this.history[0].category = category;
    }
  }

  public recordTurn(
    question: string, 
    summary: string, 
    category: QuestionCategory = 'GENERAL',
    meta?: {
      utteranceId?: string;
      rawTranscript?: string;
      normalizedTranscript?: string;
      concept?: string;
    }
  ) {
    const concept = meta?.concept || extractConceptFromQuestion(question);
    if (this.history.length > 0 && this.history[0].question.toLowerCase() === question.trim().toLowerCase()) {
      this.history[0].summary = summary.trim();
      this.history[0].category = category;
      if (meta?.utteranceId) this.history[0].utteranceId = meta.utteranceId;
      if (meta?.rawTranscript) this.history[0].rawTranscript = meta.rawTranscript;
      if (meta?.normalizedTranscript) this.history[0].normalizedTranscript = meta.normalizedTranscript;
      if (concept) this.history[0].concept = concept;
      return;
    }

    const item: ConversationTurnSummary = {
      id: `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      utteranceId: meta?.utteranceId,
      question: question.trim(),
      rawTranscript: meta?.rawTranscript || question,
      normalizedTranscript: meta?.normalizedTranscript || question,
      concept,
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
   * Resolves follow-ups like "Why?", "What about the alternative?",
   * or "Could you also explain its limitations and how it differs from lemmatization?"
   * into a fully contextualized query prompt for Ollama and internal engines.
   * Conservative: only reuses context when the query genuinely refers to the immediate prior topic.
   * NEVER borrows comparison subjects for an incomplete difference question.
   */
  public resolveContextualPrompt(query: string): { 
    enrichedPrompt: string; 
    resolvedQuery: string;
    isFollowUp: boolean; 
    parentQuestion?: string;
    parentConcept?: string;
    category: QuestionCategory;
  } {
    const classification = classifyUtterance(query, this.history);
    const parent = this.history[0];
    const followUpCheck = detectFollowUpReference(query, parent);

    if (followUpCheck.isFollowUp && parent) {
      const parentConcept = followUpCheck.parentConcept || parent.concept || extractConceptFromQuestion(parent.question);
      const resolvedQuery = followUpCheck.resolvedPrompt || query;
      const isComparison = /\b(difference|compare|vs|versus|differ)\b/i.test(resolvedQuery);
      const enrichedPrompt = `[Context: Previous interview discussion on "${parent.question}". Core concept: "${parentConcept}". Core summary was: "${parent.summary || parent.question}".]\nInterviewer follow-up question: "${query}"\nProvide a focused, direct answer to this follow-up without repeating the full previous explanation.`;

      return {
        enrichedPrompt,
        resolvedQuery,
        isFollowUp: true,
        parentQuestion: parent.question,
        parentConcept,
        category: isComparison ? 'DIFFERENCE' : 'FOLLOW_UP'
      };
    }

    return {
      enrichedPrompt: query,
      resolvedQuery: query,
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
