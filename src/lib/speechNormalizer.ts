/**
 * Technical Vocabulary Phonetic Normalizer & Speech Utilities
 * Gently corrects common programming term transcription artifacts without mutating natural speech.
 */

const SAFE_TECH_REPLACEMENTS: [RegExp, string][] = [
  // Only unambiguous programming terms
  [/\bc\s*plus\s*plus\b/gi, 'C++'],
  [/\btype\s*script\b/gi, 'TypeScript'],
  [/\bjava\s*script\b/gi, 'JavaScript'],
  [/\bnext\s*j\s*s\b|\bnextjs\b/gi, 'Next.js'],
  [/\breact\s*j\s*s\b|\breactjs\b/gi, 'React'],
  [/\bnode\s*j\s*s\b|\bnodejs\b/gi, 'Node.js'],
  [/\bvue\s*j\s*s\b|\bvuejs\b/gi, 'Vue.js'],
  [/\bspring\s*boot\b/gi, 'Spring Boot'],
  [/\bk\s*8\s*s\b|\bkoobernetes\b/gi, 'Kubernetes'],
  [/\bci\s*slash\s*cd\b|\bc\s*i\s*c\s*d\b/gi, 'CI/CD'],
  [/\bpost\s*gres\b|\bpost\s*gress?\b/gi, 'PostgreSQL'],
  [/\bmongo\s*d\s*b\b|\bmongodb\b/gi, 'MongoDB'],
  [/\bgraphql\b|\bgraph\s*q\s*l\b/gi, 'GraphQL'],
  [/\brabbit\s*m\s*q\b|\brabbitmq\b/gi, 'RabbitMQ'],
  [/\bg\s*r\s*p\s*c\b|\bgrpc\b/gi, 'gRPC'],
  [/\boauth\s*2\b|\bo\s*auth\b/gi, 'OAuth 2.0']
];

import { normalizeTechnicalTerms, TermNormalizationResult } from './technicalTermNormalizer';

export function normalizeTechnicalSpeech(rawText: string, contextTopics?: string[]): string {
  if (!rawText || typeof rawText !== 'string') return '';
  let cleaned = rawText.trim();

  // 1. Apply unambiguous literal acronyms/syntax
  for (const [regex, replacement] of SAFE_TECH_REPLACEMENTS) {
    cleaned = cleaned.replace(regex, replacement);
  }

  // 2. Apply local technical-term guess engine
  const normResult = normalizeTechnicalTerms(cleaned, contextTopics);
  cleaned = normResult.normalizedText;

  // Normalize extra whitespace
  cleaned = cleaned.replace(/\s{2,}/g, ' ');

  // Capitalize first character
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned;
}

/**
 * Determines whether a transcribed utterance is an interview question
 * versus small talk, audio checks, or filler conversational speech.
 */
export function isLikelyQuestion(text: string): boolean {
  const lower = text.trim().toLowerCase();

  // Reject tiny fragments
  if (lower.length < 5) return false;

  // Reject simple conversational greetings, audio checks, and acknowledgement fillers
  const nonQuestionFillers = [
    /^(hello|hi|hey|good morning|good afternoon|good evening)[.?!]?$/i,
    /^(can you hear me|am i audible|are you there|testing audio|mic check)[.?!]?$/i,
    /^(yes|yeah|yep|no|nope|sure|okay|ok|sounds good|got it|cool|awesome|right)[.?!]?$/i,
    /^(thank you|thanks|thanks a lot)[.?!]?$/i,
    /^(let me know|hold on|one second|give me a moment)[.?!]?$/i
  ];

  for (const filler of nonQuestionFillers) {
    if (filler.test(lower)) return false;
  }

  // Check for explicit question mark
  if (lower.includes('?')) return true;

  // Check for technical question starters & action verbs
  const questionStarters = [
    /^(how|what|why|where|when|which|who)\b/i,
    /^(can you|could you|would you)\s+(explain|describe|tell|walk|implement|design|write)/i,
    /^(explain|describe|tell me about|walk me through|implement|design|write|solve)\b/i,
    /\b(difference between|compare and contrast|pros and cons|trade-?offs of)\b/i,
    /\b(how does|how do|how would you|what is the time complexity|what is the space complexity)\b/i,
    /\b(how to handle|how to prevent|how to scale|how to optimize)\b/i
  ];

  for (const starter of questionStarters) {
    if (starter.test(lower)) return true;
  }

  // Check for technical keyword presence in a sentence with > 4 words
  const words = lower.split(/\s+/);
  if (words.length >= 4) {
    const techKeyPattern = /\b(redis|sql|kubernetes|docker|react|typescript|kafka|microservice|database|index|cache|thread|concurrency|lock|api|http|async|promise|algorithm|complexity|scal(e|ing)|architecture|sharding)\b/i;
    if (techKeyPattern.test(lower)) {
      return true;
    }
  }

  return false;
}

/**
 * Ensures a question utterance has proper punctuation.
 */
export function formatQuestionUtterance(text: string): string {
  const normalized = normalizeTechnicalSpeech(text);
  if (!normalized) return '';

  const endsWithPunct = /[.?!]$/.test(normalized);
  if (!endsWithPunct) {
    if (isLikelyQuestion(normalized)) {
      return normalized + '?';
    }
    return normalized + '.';
  }
  return normalized;
}
