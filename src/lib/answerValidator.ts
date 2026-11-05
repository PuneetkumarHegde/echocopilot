/**
 * EchoCopilot Technical Answer Validator
 * 
 * Verifies technical correctness, question relevance, concept alignment,
 * absence of hallucinated filler, and interview spoken script readiness.
 */

import { CopilotAnswer } from './types';
import { QuestionIntent } from './intentClassifier';

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0 to 100
  issues: string[];
  repairedAnswer: CopilotAnswer;
}

const FORBIDDEN_FILLER_PHRASES = [
  'workload patterns and structural guarantees',
  'applypattern()',
  'apply',
  'in this interview',
  'as an ai model',
  'as a large language model',
  'sure, here is',
  'let me explain',
  'certainly!',
  'below is the comparison',
  'here is what you need to know'
];

export function validateTechnicalAnswer(
  prompt: string,
  answer: CopilotAnswer,
  intent?: QuestionIntent,
  extractedConcepts?: { conceptA?: string; conceptB?: string; conceptC?: string }
): ValidationResult {
  const issues: string[] = [];
  let score = 100;

  let summary = answer.summary || '';
  let spokenScript = answer.spokenScript || '';

  // 1. Sanitize literal escaped newlines and raw JSON artefacts
  if (summary.includes('\\n') && !summary.includes('\n')) {
    summary = summary.replace(/\\n/g, '\n');
    issues.push('Unescaped literal \\n into true newlines');
    score -= 5;
  }

  if (summary.startsWith('{') && summary.includes('"summary"')) {
    try {
      const parsed = JSON.parse(summary);
      if (parsed.summary) summary = parsed.summary;
      if (parsed.spokenScript) spokenScript = parsed.spokenScript;
      issues.push('Extracted nested JSON payload from summary string');
      score -= 10;
    } catch {}
  }

  // Remove ```json wrappers if any leaked
  if (summary.startsWith('```json') || summary.startsWith('```')) {
    summary = summary.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
    issues.push('Stripped leaking markdown codefence from top-level summary');
    score -= 5;
  }

  // 2. Question Relevance & Concept Alignment
  const qLower = prompt.toLowerCase();
  const summaryLower = summary.toLowerCase();

  if (intent === 'COMPARISON') {
    const cA = (extractedConcepts?.conceptA || '').toLowerCase();
    const cB = (extractedConcepts?.conceptB || '').toLowerCase();
    const cC = (extractedConcepts?.conceptC || '').toLowerCase();

    if (cA && !summaryLower.includes(cA)) {
      issues.push(`Concept A "${cA}" not clearly mentioned in summary.`);
      score -= 20;
    }
    if (cB && !summaryLower.includes(cB)) {
      issues.push(`Concept B "${cB}" not clearly mentioned in summary.`);
      score -= 20;
    }
    if (cC && !summaryLower.includes(cC)) {
      issues.push(`Concept C "${cC}" not clearly mentioned in 3-way summary.`);
      score -= 15;
    }

    // Git Pull vs Pull Request specific check: ensure no false confusion
    if (
      (qLower.includes('pull request') || qLower.includes('pr')) &&
      qLower.includes('git pull')
    ) {
      if (!summaryLower.includes('github') && !summaryLower.includes('platform') && !summaryLower.includes('review')) {
        issues.push('Git Pull vs Pull Request must explicitly mention code review / platform hosting.');
        score -= 25;
      }
    }
  }

  // 3. Check for Hallucinated Generic Filler
  for (const phrase of FORBIDDEN_FILLER_PHRASES) {
    if (summaryLower.includes(phrase)) {
      issues.push(`Detected generic filler phrase: "${phrase}".`);
      score -= 15;
      // Clean up filler if present
      summary = summary.replace(new RegExp(phrase, 'gi'), '');
    }
  }

  // 4. Validate Spoken Script Readiness
  if (!spokenScript || spokenScript.trim().length < 15) {
    // Generate clean spoken script from first section of summary
    const firstLines = summary
      .replace(/^###[^\n]*\n+/gim, '')
      .replace(/\*\*Direct Interview Answer\*\*:?\s*/gi, '')
      .split('\n\n')[0]
      ?.replace(/[*#`_]/g, '')
      .trim();

    spokenScript = firstLines || 'In summary, this concept provides distinct architectural tradeoffs for software systems.';
    issues.push('Generated missing spoken script from leading summary sentences.');
    score -= 10;
  } else {
    // Strip markdown formatting from spokenScript (headers, bullets, bold tags)
    spokenScript = spokenScript
      .replace(/^###\s*[0-9.]*\s*/gim, '')
      .replace(/^[-*]\s+/gim, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .trim();
  }

  // 5. Build Repaired Answer
  const repairedAnswer: CopilotAnswer = {
    ...answer,
    summary: summary.trim(),
    spokenScript: spokenScript.trim()
  };

  return {
    isValid: score >= 60,
    score: Math.max(0, score),
    issues,
    repairedAnswer
  };
}

// -----------------------------------------------------------------
// Factual Claims & Anti-Hallucination Evaluator
// -----------------------------------------------------------------

export interface FactualClaimCheck {
  description: string;
  matched: boolean;
}

export interface FactualEvaluationResult {
  isFactuallyAccurate: boolean;
  completenessScore: number; // 0 to 1
  includedFacts: FactualClaimCheck[];
  rejectedClaimsDetected: string[];
  repairedText: string;
}

/**
 * Evaluates correctness and completeness of technical claims separately.
 * Catches common small-model hallucinations (e.g. ArrayList auto-shrinking or linked-list claims).
 */
export function validateFactualClaims(question: string, text: string): FactualEvaluationResult {
  const q = question.toLowerCase();
  const t = text.toLowerCase();
  let repaired = text;
  const rejectedClaims: string[] = [];

  const isArrayVsArrayList = (q.includes('array') && q.includes('arraylist')) || 
    (t.includes('array') && t.includes('arraylist'));

  const includedFacts: FactualClaimCheck[] = [];

  if (isArrayVsArrayList) {
    // 1. Evaluate Required Facts (Completeness)
    const factChecks: Array<{ desc: string; pattern: RegExp }> = [
      { desc: 'Arrays have fixed length after creation', pattern: /\bfixed[\s-]*(length|size)\b|\bcannot\s+(change|resize|grow)\b|\bimmutable\s+size\b/i },
      { desc: 'ArrayList supports a variable number of elements', pattern: /\b(dynamic|variable|resizable)[\s-]*(size|array|collection)?\b|\bgrows?\s+dynamically\b|\badd\s+or\s+remove\b/i },
      { desc: 'Arrays can contain primitives or object references', pattern: /\bprimitives?\b|\bprimitive\s+types?\b/i },
      { desc: 'ArrayList uses reference types / wrapper classes', pattern: /\b(wrapper\s+classes?|reference\s+types?|objects?|integer)\b/i },
      { desc: 'Array access uses arr[index]; ArrayList uses get(index)', pattern: /\[\s*(i|index)?\s*\]|\bget\s*\(/i },
      { desc: 'Array length uses .length; ArrayList uses .size()', pattern: /\.length\b|\.size\s*\(\b|\blength\b.*\bsize\b/i },
      { desc: 'ArrayList backed by a resizable array, not a linked list', pattern: /\b(resizable|dynamic|backing|internal)\s+array\b|\bobject\[\]\b/i },
      { desc: 'Both support constant-time indexed access', pattern: /\bo\(1\)|\bconstant[\s-]time|\brandom\s+access\b/i }
    ];

    for (const fc of factChecks) {
      includedFacts.push({
        description: fc.desc,
        matched: fc.pattern.test(text)
      });
    }

    // 2. Evaluate Rejected Claims (Correctness)
    // A. Claiming ArrayList is implemented as a linked list
    if (/\b(implemented\s+as\s+a\s+linked\s*list|backed\s+by\s+a\s+linked\s*list|uses\s+a\s+linked\s*list\s+under)\b/i.test(text)) {
      rejectedClaims.push('ArrayList is implemented as a linked list');
      repaired = repaired.replace(
        /\b(implemented\s+as\s+a\s+linked\s*list|backed\s+by\s+a\s+linked\s*list|uses\s+a\s+linked\s*list\s+under\s+the\s+hood)\b/gi,
        'backed by a resizable Object array'
      );
    }

    // B. Claiming ArrayList<Integer> freely accepts unrelated element types
    if (/\barraylist\s*<integer>\s*freely\s*accepts?\b|\baccepts?\s+unrelated\s+element\s+types?\b/i.test(text)) {
      rejectedClaims.push('ArrayList<Integer> freely accepts unrelated element types');
      repaired = repaired.replace(/\barraylist\s*<integer>\s*freely\s*accepts?[^.]*\./gi, 'ArrayList enforces type safety through Java Generics.');
    }

    // C. Claiming an array's length must be known at compile time
    if (/\b(must\s+be\s+known\s+at\s+compile[\s-]*time|declared\s+at\s+compile[\s-]*time\s+only)\b/i.test(text)) {
      rejectedClaims.push("An array's length must be known at compile time");
      repaired = repaired.replace(/\bmust\s+be\s+known\s+at\s+compile[\s-]*time\b/gi, 'is fixed once allocated at runtime');
    }

    // D. Claiming removing elements automatically shrinks ArrayList capacity
    if (/\b(automatically\s+shrinks?|shrinks?\s+automatically|shrinks?\s+when\s+elements?\s+are\s+removed|shrink\s+dynamically\s+when\s+elements?\s+are\s+removed)\b/i.test(text)) {
      rejectedClaims.push('Removing elements automatically shrinks ArrayList capacity');
      repaired = repaired.replace(
        /\b(automatically\s+shrinks?|shrinks?\s+automatically|shrinks?\s+when\s+elements?\s+are\s+removed|grow\s+and\s+shrink\s+dynamically)\b/gi,
        'grows dynamically as elements are added, though capacity does not automatically shrink on removal unless trimToSize() is called'
      );
    }

    // E. Claiming ArrayList insertion or removal is always O(1)
    if (/\b(insert(ing|ion)?|remov(ing|al)?)\s+(is|are)\s+always\s+o\(1\)\b/i.test(text)) {
      rejectedClaims.push('ArrayList insertion or removal is always O(1)');
      repaired = repaired.replace(/\b(insert(ing|ion)?|remov(ing|al)?)\s+(is|are)\s+always\s+o\(1\)\b/gi, 'insertion at the end is amortized O(1), but arbitrary insertions or removals require O(N) shifting');
    }

    // F. Claiming ArrayList inherently avoids memory fragmentation
    if (/\b(avoids?|preventing?|eliminates?)\s+memory\s+fragmentation\b/i.test(text)) {
      rejectedClaims.push('ArrayList inherently avoids memory fragmentation');
      repaired = repaired.replace(/\b(avoids?|preventing?|eliminates?)\s+memory\s+fragmentation\b/gi, 'uses dynamic heap allocation');
    }

    // G. Claiming accessing elements in ArrayList is slower due to dynamic resizing
    if (/accessing\s+elements\s+in\s+(an\s+)?arraylist\s+is\s+(typically\s+|generally\s+)?slower[^.]*resiz/i.test(text)) {
      rejectedClaims.push('Claiming element access in ArrayList is slower due to resizing');
      repaired = repaired.replace(/accessing\s+elements\s+in\s+(an\s+)?arraylist\s+is\s+(typically\s+|generally\s+)?slower[^.]*resiz[^.]*\./gi, 'Both array and ArrayList provide O(1) constant-time element access by index.');
    }
  }

  const matchedCount = includedFacts.filter(f => f.matched).length;
  const completenessScore = includedFacts.length > 0 ? matchedCount / includedFacts.length : 1.0;
  const isFactuallyAccurate = rejectedClaims.length === 0;

  return {
    isFactuallyAccurate,
    completenessScore,
    includedFacts,
    rejectedClaimsDetected: rejectedClaims,
    repairedText: repaired
  };
}

