/**
 * EchoCopilot Structured Comparison Engine
 * 
 * Implements Section 4 & Core CS Comparison Standard:
 * 1. Direct Interview Answer (Crisp 30-45 second spoken script first)
 * 2. Definitions of both concepts separated with blank lines
 * 3. Key differences in natural, clearly labeled sentences (**Label:** sentence)
 * 4. Markdown comparison table across relevant dimensions
 * 5. Compilable code examples / command workflows with expected output
 * 6. Practical use cases and engineering trade-offs
 * 7. Concise conclusion
 * 
 * Strict Constraint: Does NOT drift into unrelated topics or invent fake technical distinctions.
 */

import { CopilotAnswer } from './types';
import { resolveGitCanonicalConcept } from './technicalTermNormalizer';

export interface ComparisonDifferencePoint {
  label: string;
  explanation: string;
}

export interface ComparisonStructure {
  conceptAName: string;
  conceptADefinition: string;
  conceptBName: string;
  conceptBDefinition: string;
  conceptCName?: string;
  conceptCDefinition?: string;
  differencesInSentences?: ComparisonDifferencePoint[];
  tableRows: Array<{
    dimension: string;
    conceptAValue: string;
    conceptBValue: string;
    conceptCValue?: string;
  }>;
  exampleA: {
    language: string;
    code: string;
    expectedOutput: string;
    explanation: string;
  };
  exampleB: {
    language: string;
    code: string;
    expectedOutput: string;
    explanation: string;
  };
  exampleC?: {
    language: string;
    code: string;
    expectedOutput: string;
    explanation: string;
  };
  useCasesAndTradeoffs: {
    whenToUseA: string;
    whenToUseB: string;
    whenToUseC?: string;
    tradeoffsSummary: string;
  };
  interviewSummary: string;
  conciseConclusion?: string;
}

export function isKnownComparison(
  conceptA: string,
  conceptB: string,
  fullPrompt: string,
  conceptC?: string
): boolean {
  const cA = (conceptA || '').toLowerCase().trim();
  const cB = (conceptB || '').toLowerCase().trim();
  const cC = (conceptC || '').toLowerCase().trim();
  const p = (fullPrompt || '').toLowerCase();

  // 1. Array vs ArrayList
  if (
    ((cA.includes('array') && cB.includes('arraylist')) ||
    (cA.includes('arraylist') && cB.includes('array')) ||
    (p.includes('array') && p.includes('arraylist')))
  ) return true;

  const gitA = resolveGitCanonicalConcept(conceptA) || resolveGitCanonicalConcept(cA);
  const gitB = resolveGitCanonicalConcept(conceptB) || resolveGitCanonicalConcept(cB);

  // 2A. GitHub Pull Request vs git pull
  if (
    (gitA === 'GITHUB_PULL_REQUEST' && gitB === 'GIT_PULL') ||
    (gitA === 'GIT_PULL' && gitB === 'GITHUB_PULL_REQUEST') ||
    ((p.includes('pull request') || p.includes('pr')) && (p.includes('pull command') || p.includes('git pull') || p.includes('git-pull')))
  ) return true;

  // 2B. git fetch vs git pull
  if (
    (gitA === 'GIT_FETCH' && gitB === 'GIT_PULL') ||
    (gitA === 'GIT_PULL' && gitB === 'GIT_FETCH') ||
    (p.includes('fetch') && (p.includes('git pull') || p.includes('pull command')) && !p.includes('pull request'))
  ) return true;

  // 2C. git merge vs git pull
  if (
    (gitA === 'GIT_MERGE' && gitB === 'GIT_PULL') ||
    (gitA === 'GIT_PULL' && gitB === 'GIT_MERGE') ||
    (p.includes('merge') && (p.includes('git pull') || p.includes('pull command')) && !p.includes('pull request'))
  ) return true;

  // 2D. git fetch vs GitHub Pull Request
  if (
    (gitA === 'GIT_FETCH' && gitB === 'GITHUB_PULL_REQUEST') ||
    (gitA === 'GITHUB_PULL_REQUEST' && gitB === 'GIT_FETCH') ||
    (p.includes('fetch') && (p.includes('pull request') || p.includes('pr')))
  ) return true;

  // 2E. git merge vs git rebase
  if (
    (gitA === 'GIT_MERGE' && gitB === 'GIT_REBASE') ||
    (gitA === 'GIT_REBASE' && gitB === 'GIT_MERGE') ||
    (p.includes('rebase') && p.includes('merge') && !p.includes('pull request'))
  ) return true;

  // 4. DELETE vs TRUNCATE vs DROP
  if (
    (p.includes('delete') && p.includes('truncate')) ||
    (p.includes('truncate') && p.includes('drop')) ||
    (p.includes('delete') && p.includes('drop'))
  ) return true;

  // 5. Primary Key vs Foreign Key
  if (
    (p.includes('primary key') && p.includes('foreign key')) ||
    ((cA.includes('primary') && cB.includes('foreign')) || (cA.includes('foreign') && cB.includes('primary')))
  ) return true;

  // 6. HTTP vs HTTPS
  if (
    (p.includes('http') && p.includes('https')) ||
    ((cA === 'http' && cB === 'https') || (cA === 'https' && cB === 'http'))
  ) return true;

  // 7. Binary Search vs Linear Search
  if (
    (p.includes('binary search') && p.includes('linear search')) ||
    ((cA.includes('linear') && cB.includes('binary')) || (cA.includes('binary') && cB.includes('linear')))
  ) return true;

  // 8. Authentication vs Authorization
  if (
    (p.includes('authentication') && p.includes('authorization')) ||
    (p.includes('authn') && p.includes('authz')) ||
    ((cA.includes('authenticat') && cB.includes('authoriz')) || (cA.includes('authoriz') && cB.includes('authenticat')))
  ) return true;

  // 9. Heap vs Stack Memory
  if (
    (p.includes('heap') && p.includes('stack')) ||
    ((cA.includes('stack') && cB.includes('heap')) || (cA.includes('heap') && cB.includes('stack')))
  ) return true;

  // 10. Deadlock and Coffman Conditions
  if (
    p.includes('deadlock') &&
    (p.includes('coffman') || p.includes('condition') || p.includes('starvation') || p.includes('concurrency'))
  ) return true;

  // 11. Checked vs Unchecked Exceptions
  if (
    (p.includes('checked') && p.includes('unchecked')) ||
    (p.includes('runtime exception') && p.includes('checked'))
  ) return true;

  // 12. Interface vs Abstract Class
  if (
    ((cA.includes('interface') && cB.includes('abstract')) ||
    (cA.includes('abstract') && cB.includes('interface')) ||
    (p.includes('interface') && p.includes('abstract class')))
  ) return true;

  // 13. Process vs Thread
  if (
    ((cA.includes('process') && cB.includes('thread')) ||
    (cA.includes('thread') && cB.includes('process')) ||
    (p.includes('process') && p.includes('thread')))
  ) return true;

  // 14. TCP vs UDP
  if (
    ((cA.includes('tcp') && cB.includes('udp')) ||
    (cA.includes('udp') && cB.includes('tcp')) ||
    (p.includes('tcp') && p.includes('udp')))
  ) return true;

  // 15. Stack vs Queue
  if (
    ((cA.includes('stack') && cB.includes('queue')) ||
    (cA.includes('queue') && cB.includes('stack')) ||
    (p.includes('stack') && p.includes('queue')))
  ) return true;

  // 16. PostgreSQL vs MongoDB
  if (
    ((cA.includes('postgres') && cB.includes('mongo')) ||
    (cA.includes('mongo') && cB.includes('postgres')) ||
    (p.includes('postgres') && p.includes('mongo')))
  ) return true;

  // 17. REST vs GraphQL
  if (
    ((cA.includes('rest') && cB.includes('graphql')) ||
    (cA.includes('graphql') && cB.includes('rest')) ||
    (p.includes('rest') && p.includes('graphql')))
  ) return true;

  // 18. Method Overloading vs Method Overriding
  if (
    ((cA.includes('overload') && cB.includes('overrid')) ||
    (cA.includes('overrid') && cB.includes('overload')) ||
    (p.includes('overload') && p.includes('overrid')))
  ) return true;

  return false;
}

export function resolveComparisonStructure(
  conceptA: string,
  conceptB: string,
  fullPrompt: string,
  conceptC?: string
): { handlerName: string; structure: ComparisonStructure } {
  const cA = (conceptA || '').toLowerCase().trim();
  const cB = (conceptB || '').toLowerCase().trim();
  const cC = (conceptC || '').toLowerCase().trim();
  const p = (fullPrompt || '').toLowerCase();

  // 1. Array vs ArrayList (Java)
  if (
    (cA.includes('array') && cB.includes('arraylist')) ||
    (cA.includes('arraylist') && cB.includes('array')) ||
    (cA === 'array' && (cB.includes('list') || cB.includes('arraylist'))) ||
    (p.includes('array') && p.includes('arraylist'))
  ) {
    return { handlerName: 'ARRAY_VS_ARRAYLIST', structure: getArrayVsArrayListComparison() };
  }

  const gitA = resolveGitCanonicalConcept(cA) || resolveGitCanonicalConcept(conceptA);
  const gitB = resolveGitCanonicalConcept(cB) || resolveGitCanonicalConcept(conceptB);

  // 2A. GitHub Pull Request vs git pull (Explicit: PR is web collaboration, git pull is CLI fetch+merge)
  if (
    (gitA === 'GITHUB_PULL_REQUEST' && gitB === 'GIT_PULL') ||
    (gitA === 'GIT_PULL' && gitB === 'GITHUB_PULL_REQUEST') ||
    ((p.includes('pull request') || p.includes('pr')) && (p.includes('pull command') || p.includes('git pull') || p.includes('git-pull')))
  ) {
    return { handlerName: 'GITHUB_PULL_REQUEST_VS_GIT_PULL', structure: getGitPullVsPullRequestComparison() };
  }

  // 2B. git fetch vs git pull
  if (
    (gitA === 'GIT_FETCH' && gitB === 'GIT_PULL') ||
    (gitA === 'GIT_PULL' && gitB === 'GIT_FETCH') ||
    (p.includes('fetch') && (p.includes('git pull') || p.includes('pull command')) && !p.includes('pull request'))
  ) {
    return { handlerName: 'GIT_FETCH_VS_GIT_PULL', structure: getGitFetchVsGitPullComparison() };
  }

  // 2C. git merge vs git pull
  if (
    (gitA === 'GIT_MERGE' && gitB === 'GIT_PULL') ||
    (gitA === 'GIT_PULL' && gitB === 'GIT_MERGE') ||
    (p.includes('merge') && (p.includes('git pull') || p.includes('pull command')) && !p.includes('pull request'))
  ) {
    return { handlerName: 'GIT_MERGE_VS_GIT_PULL', structure: getGitMergeVsGitPullComparison() };
  }

  // 2D. git fetch vs GitHub Pull Request
  if (
    (gitA === 'GIT_FETCH' && gitB === 'GITHUB_PULL_REQUEST') ||
    (gitA === 'GITHUB_PULL_REQUEST' && gitB === 'GIT_FETCH') ||
    (p.includes('fetch') && (p.includes('pull request') || p.includes('pr')))
  ) {
    return { handlerName: 'GIT_FETCH_VS_GITHUB_PULL_REQUEST', structure: getGitFetchVsPullRequestComparison() };
  }

  // 2E. git merge vs git rebase
  if (
    (gitA === 'GIT_MERGE' && gitB === 'GIT_REBASE') ||
    (gitA === 'GIT_REBASE' && gitB === 'GIT_MERGE') ||
    (p.includes('rebase') && p.includes('merge') && !p.includes('pull request'))
  ) {
    return { handlerName: 'GIT_MERGE_VS_GIT_REBASE', structure: getGitMergeVsGitRebaseComparison() };
  }

  // 4. DELETE vs TRUNCATE vs DROP (SQL DDL/DML)
  if (
    (p.includes('delete') && p.includes('truncate')) ||
    (p.includes('truncate') && p.includes('drop')) ||
    (p.includes('delete') && p.includes('drop')) ||
    cC.includes('drop') || cB.includes('drop') || cA.includes('drop')
  ) {
    return { handlerName: 'DELETE_VS_TRUNCATE_VS_DROP', structure: getDeleteVsTruncateVsDropComparison(cA, cB, cC, p) };
  }

  // 5. Primary Key vs Foreign Key (DBMS)
  if (
    (p.includes('primary key') && p.includes('foreign key')) ||
    (cA.includes('primary') && cB.includes('foreign')) ||
    (cA.includes('foreign') && cB.includes('primary'))
  ) {
    return { handlerName: 'PRIMARY_KEY_VS_FOREIGN_KEY', structure: getPrimaryKeyVsForeignKeyComparison() };
  }

  // 6. HTTP vs HTTPS (Networking & Security)
  if (
    (p.includes('http') && p.includes('https')) ||
    (cA === 'http' && cB === 'https') ||
    (cA === 'https' && cB === 'http')
  ) {
    return { handlerName: 'HTTP_VS_HTTPS', structure: getHttpVsHttpsComparison() };
  }

  // 7. Binary Search vs Linear Search (DSA)
  if (
    (p.includes('binary search') && p.includes('linear search')) ||
    (cA.includes('linear') && cB.includes('binary')) ||
    (cA.includes('binary') && cB.includes('linear'))
  ) {
    return { handlerName: 'BINARY_SEARCH_VS_LINEAR_SEARCH', structure: getBinarySearchVsLinearSearchComparison() };
  }

  // 8. Authentication vs Authorization (Security)
  if (
    (p.includes('authentication') && p.includes('authorization')) ||
    (p.includes('authn') && p.includes('authz')) ||
    (cA.includes('authenticat') && cB.includes('authoriz')) ||
    (cA.includes('authoriz') && cB.includes('authenticat'))
  ) {
    return { handlerName: 'AUTHENTICATION_VS_AUTHORIZATION', structure: getAuthnVsAuthzComparison() };
  }

  // 9. Heap vs Stack Memory (OS & Runtime)
  if (
    (p.includes('heap') && p.includes('stack')) ||
    (cA.includes('stack') && cB.includes('heap')) ||
    (cA.includes('heap') && cB.includes('stack'))
  ) {
    return { handlerName: 'HEAP_VS_STACK_MEMORY', structure: getHeapVsStackComparison() };
  }

  // 10. Deadlock & Coffman Conditions (OS Concurrency)
  if (
    p.includes('deadlock') &&
    (p.includes('coffman') || p.includes('condition') || p.includes('starvation') || p.includes('concurrency'))
  ) {
    return { handlerName: 'DEADLOCK_AND_COFFMAN_CONDITIONS', structure: getDeadlockVsCoffmanComparison() };
  }

  // 11. Checked vs Unchecked Exceptions (Java)
  if (
    (p.includes('checked') && p.includes('unchecked')) ||
    (cA.includes('checked') && cB.includes('unchecked')) ||
    (p.includes('runtime exception') && p.includes('checked'))
  ) {
    return { handlerName: 'CHECKED_VS_UNCHECKED_EXCEPTIONS', structure: getCheckedVsUncheckedExceptionComparison() };
  }

  // 12. Interface vs Abstract Class (Java / OOP)
  if (
    (cA.includes('interface') && cB.includes('abstract')) ||
    (cA.includes('abstract') && cB.includes('interface')) ||
    (p.includes('interface') && p.includes('abstract class'))
  ) {
    return { handlerName: 'INTERFACE_VS_ABSTRACT_CLASS', structure: getInterfaceVsAbstractClassComparison() };
  }

  // 13. Process vs Thread (OS)
  if (
    (cA.includes('process') && cB.includes('thread')) ||
    (cA.includes('thread') && cB.includes('process')) ||
    (p.includes('process') && p.includes('thread'))
  ) {
    return { handlerName: 'PROCESS_VS_THREAD', structure: getProcessVsThreadComparison() };
  }

  // 14. TCP vs UDP (Networking)
  if (
    (cA.includes('tcp') && cB.includes('udp')) ||
    (cA.includes('udp') && cB.includes('tcp')) ||
    (p.includes('tcp') && p.includes('udp'))
  ) {
    return { handlerName: 'TCP_VS_UDP', structure: getTcpVsUdpComparison() };
  }

  // 15. Stack vs Queue (DSA)
  if (
    (cA.includes('stack') && cB.includes('queue')) ||
    (cA.includes('queue') && cB.includes('stack')) ||
    (p.includes('stack') && p.includes('queue'))
  ) {
    return { handlerName: 'STACK_VS_QUEUE', structure: getStackVsQueueComparison() };
  }

  // 16. PostgreSQL vs MongoDB
  if (
    (cA.includes('postgres') && cB.includes('mongo')) ||
    (cA.includes('mongo') && cB.includes('postgres')) ||
    (p.includes('postgres') && p.includes('mongo'))
  ) {
    return { handlerName: 'POSTGRESQL_VS_MONGODB', structure: getPostgresVsMongoComparison() };
  }

  // 17. REST vs GraphQL
  if (
    (cA.includes('rest') && cB.includes('graphql')) ||
    (cA.includes('graphql') && cB.includes('rest')) ||
    (p.includes('rest') && p.includes('graphql'))
  ) {
    return { handlerName: 'REST_VS_GRAPHQL', structure: getRestVsGraphQlComparison() };
  }

  // 18. Method Overloading vs Method Overriding
  if (
    (cA.includes('overload') && cB.includes('overrid')) ||
    (cA.includes('overrid') && cB.includes('overload')) ||
    (p.includes('overload') && p.includes('overrid'))
  ) {
    return { handlerName: 'METHOD_OVERLOADING_VS_OVERRIDING', structure: getMethodOverloadingVsOverridingComparison() };
  }

  // Universal Dynamic Comparison Synthesizer (honest, structured, no fake claims)
  return { handlerName: 'UNIVERSAL_COMPARISON', structure: getUniversalComparison(conceptA, conceptB) };
}

export function getComparisonHandlerName(
  conceptA: string,
  conceptB: string,
  fullPrompt: string,
  conceptC?: string
): string {
  return resolveComparisonStructure(conceptA, conceptB, fullPrompt, conceptC).handlerName;
}

export function generateStructuredComparison(
  conceptA: string,
  conceptB: string,
  fullPrompt: string,
  conceptC?: string
): CopilotAnswer {
  const { structure } = resolveComparisonStructure(conceptA, conceptB, fullPrompt, conceptC);
  return formatComparisonAnswer(fullPrompt, structure);
}

// -----------------------------------------------------------------
// Formatter: Constructs CopilotAnswer adhering to Section 4 & Core CS
// -----------------------------------------------------------------

// Synthesizes the natural candidate interview response:
// 1. One natural introductory sentence identifying the main difference
// 2. Each important difference explained separately with blank lines and natural transitions (**First, [dimension]:** ...)
// 3. Natural closing takeaway sentence ("That's the main difference between [A] and [B].")
export function buildCandidateComparisonAnswer(comp: ComparisonStructure): string {
  const is3Way = Boolean(comp.conceptCName && comp.conceptCDefinition);

  // 1. One natural introductory sentence identifying the main difference
  const cleanA = comp.conceptAName.replace(/\s*\([^)]*\)/g, '').trim();
  const cleanB = comp.conceptBName.replace(/\s*\([^)]*\)/g, '').trim();
  const cleanC = comp.conceptCName ? comp.conceptCName.replace(/\s*\([^)]*\)/g, '').trim() : '';

  let introSentence = '';
  if (is3Way) {
    introSentence = `${cleanA}, ${cleanB}, and ${cleanC} are all SQL commands used to remove database data or structures, but they operate at three very different architectural levels.`;
  } else if (cleanA.toLowerCase().includes('array') && cleanB.toLowerCase().includes('arraylist')) {
    introSentence = 'An Array and an ArrayList are both used to store multiple elements in Java, but they differ in several ways.';
  } else if (cleanA.toLowerCase().includes('tcp') && cleanB.toLowerCase().includes('udp')) {
    introSentence = 'TCP and UDP are both transport layer protocols used to transmit data across IP networks, but they differ in several key ways.';
  } else if (cleanA.toLowerCase().includes('auth') && cleanB.toLowerCase().includes('auth')) {
    introSentence = 'Authentication and authorization are both foundational security concepts in access control, but they address completely different aspects of security.';
  } else if (cleanA.toLowerCase().includes('process') && cleanB.toLowerCase().includes('thread')) {
    introSentence = 'In operating systems, a process and a thread are both units of execution, but they differ in their architecture and resource management.';
  } else if (cleanA.toLowerCase().includes('primary') && cleanB.toLowerCase().includes('foreign')) {
    introSentence = 'In relational database design, a Primary Key and a Foreign Key are both constraints used to manage data integrity, but they serve different architectural roles.';
  } else if (cleanA.toLowerCase().includes('overload') || cleanB.toLowerCase().includes('overload')) {
    introSentence = 'Method overloading and method overriding are both fundamental object-oriented programming concepts in Java, but they serve different purposes and operate at different phases of execution.';
  } else {
    introSentence = `${cleanA} and ${cleanB} are both used in software development, but they differ in several key ways.`;
  }

  // 2. Explain each difference as a separate, individually speakable point
  const transitions = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth'];
  const points: string[] = [];
  const diffs = comp.differencesInSentences || [];

  for (let i = 0; i < diffs.length; i++) {
    const diff = diffs[i];
    const isLast = i === diffs.length - 1 && diffs.length >= 3;
    const transition = isLast ? 'Finally' : (transitions[i] || 'Another difference');
    const label = diff.label.toLowerCase();
    const explanation = diff.explanation.replace(/`([^`]+)`/g, '$1').trim();
    points.push(`**${transition}, ${label}:** ${explanation}`);
  }

  // 3. Natural closing takeaway sentence
  let closingSentence = '';
  if (is3Way) {
    closingSentence = `That's the main difference between ${cleanA}, ${cleanB}, and ${cleanC}.`;
  } else if (cleanA.toLowerCase().includes('array') && cleanB.toLowerCase().includes('arraylist')) {
    closingSentence = "That's the main difference between an array and an ArrayList in Java.";
  } else if (cleanA.toLowerCase().includes('tcp') && cleanB.toLowerCase().includes('udp')) {
    closingSentence = "That's the main difference between TCP and UDP.";
  } else if (cleanA.toLowerCase().includes('auth') && cleanB.toLowerCase().includes('auth')) {
    closingSentence = "That's the main difference between authentication and authorization.";
  } else if (cleanA.toLowerCase().includes('process') && cleanB.toLowerCase().includes('thread')) {
    closingSentence = "That's the main difference between a process and a thread.";
  } else if (cleanA.toLowerCase().includes('overload') || cleanB.toLowerCase().includes('overload')) {
    closingSentence = "That's the main difference between method overloading and method overriding in Java.";
  } else {
    closingSentence = `That's the main difference between ${cleanA} and ${cleanB}.`;
  }

  return [introSentence, ...points, closingSentence].join('\n\n');
}

function formatComparisonAnswer(prompt: string, comp: ComparisonStructure): CopilotAnswer {
  const is3Way = Boolean(comp.conceptCName && comp.conceptCDefinition);

  // 1. Table
  const tableHeader = is3Way
    ? `| Dimension | **${comp.conceptAName}** | **${comp.conceptBName}** | **${comp.conceptCName}** |\n| :--- | :--- | :--- | :--- |`
    : `| Dimension | **${comp.conceptAName}** | **${comp.conceptBName}** |\n| :--- | :--- | :--- |`;

  const tableBody = comp.tableRows
    .map(r => {
      return is3Way
        ? `| **${r.dimension}** | ${r.conceptAValue} | ${r.conceptBValue} | ${r.conceptCValue || 'N/A'} |`
        : `| **${r.dimension}** | ${r.conceptAValue} | ${r.conceptBValue} |`;
    })
    .join('\n');

  // 2. Labeled sentences for key differences
  const diffSentences = comp.differencesInSentences && comp.differencesInSentences.length > 0
    ? comp.differencesInSentences.map(d => `**${d.label}:** ${d.explanation}`).join('\n\n')
    : comp.tableRows.map(r => `**${r.dimension}:** ${comp.conceptAName} is characterized by ${r.conceptAValue.toLowerCase().replace(/\.$/, '')}, whereas ${comp.conceptBName} is characterized by ${r.conceptBValue.toLowerCase().replace(/\.$/, '')}.`).join('\n\n');

  // 3. Definitions block
  const definitionsBlock = is3Way
    ? `**${comp.conceptAName}:**\n\n${comp.conceptADefinition}\n\n**${comp.conceptBName}:**\n\n${comp.conceptBDefinition}\n\n**${comp.conceptCName}:**\n\n${comp.conceptCDefinition}`
    : `**${comp.conceptAName}:**\n\n${comp.conceptADefinition}\n\n**${comp.conceptBName}:**\n\n${comp.conceptBDefinition}`;

  // 4. Code / Example block
  let examplesBlock = `#### ${comp.conceptAName} Example (${comp.exampleA.language})
\`\`\`${comp.exampleA.language}
${comp.exampleA.code}
\`\`\`
**Expected Output:**
\`\`\`text
${comp.exampleA.expectedOutput}
\`\`\`
*Explanation:* ${comp.exampleA.explanation}

#### ${comp.conceptBName} Example (${comp.exampleB.language})
\`\`\`${comp.exampleB.language}
${comp.exampleB.code}
\`\`\`
**Expected Output:**
\`\`\`text
${comp.exampleB.expectedOutput}
\`\`\`
*Explanation:* ${comp.exampleB.explanation}`;

  if (is3Way && comp.exampleC) {
    examplesBlock += `\n\n#### ${comp.conceptCName} Example (${comp.exampleC.language})
\`\`\`${comp.exampleC.language}
${comp.exampleC.code}
\`\`\`
**Expected Output:**
\`\`\`text
${comp.exampleC.expectedOutput}
\`\`\`
*Explanation:* ${comp.exampleC.explanation}`;
  }

  // 5. Tradeoffs
  let tradeoffsBlock = `- **When to choose ${comp.conceptAName}:** ${comp.useCasesAndTradeoffs.whenToUseA}
- **When to choose ${comp.conceptBName}:** ${comp.useCasesAndTradeoffs.whenToUseB}`;
  if (is3Way && comp.useCasesAndTradeoffs.whenToUseC) {
    tradeoffsBlock += `\n- **When to choose ${comp.conceptCName}:** ${comp.useCasesAndTradeoffs.whenToUseC}`;
  }
  tradeoffsBlock += `\n- **Core Trade-off:** ${comp.useCasesAndTradeoffs.tradeoffsSummary}`;

  // Synthesize candidate speakable answer following mandatory comparison structure
  const candidateSpokenAnswer = buildCandidateComparisonAnswer(comp);

  const summaryMarkdown = `### 1. Definitions

${definitionsBlock}

---

### 2. Key Differences

${diffSentences}

#### Reference Comparison Table
${tableHeader}
${tableBody}

---

### 3. Code Examples & Expected Output

${examplesBlock}

---

### 4. Practical Use Cases & Engineering Trade-Offs
${tradeoffsBlock}

---

### 5. Concise Conclusion
${comp.conciseConclusion || `That's the main difference between ${comp.conceptAName} and ${comp.conceptBName}.`}`;

  return {
    id: `comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    question: prompt,
    mode: 'coding',
    directAnswer: candidateSpokenAnswer,
    summary: summaryMarkdown,
    spokenScript: candidateSpokenAnswer,
    bullets: comp.tableRows.slice(0, 5).map(r => `${r.dimension}: ${r.conceptAValue} vs ${r.conceptBValue}`),
    codeSnippet: {
      language: comp.exampleB.language,
      code: comp.exampleB.code,
      explanation: comp.exampleB.explanation,
      timeComplexity: comp.tableRows.find(r => r.dimension.includes('Performance') || r.dimension.includes('Complexity'))?.conceptBValue || 'O(1)',
      spaceComplexity: comp.tableRows.find(r => r.dimension.includes('Memory') || r.dimension.includes('Space'))?.conceptBValue || 'O(1)'
    },
    tradeoffs: [
      `${comp.conceptAName}: ${comp.useCasesAndTradeoffs.whenToUseA}`,
      `${comp.conceptBName}: ${comp.useCasesAndTradeoffs.whenToUseB}`,
      `Trade-off: ${comp.useCasesAndTradeoffs.tradeoffsSummary}`
    ],
    timestamp: Date.now()
  };
}

// -----------------------------------------------------------------
// 1. Array vs ArrayList (Java)
// -----------------------------------------------------------------

function getArrayVsArrayListComparison(): ComparisonStructure {
  return {
    conceptAName: 'Array (Java)',
    conceptADefinition: 'An array in Java stores multiple elements of the same declared type in a fixed-size, contiguous memory sequence.',
    conceptBName: 'ArrayList (Java)',
    conceptBDefinition: 'An ArrayList is a resizable collection in Java that implements the `List` interface and allows elements to be added or removed dynamically.',
    differencesInSentences: [
      {
        label: 'Size',
        explanation: 'An array has a fixed size, so once we create it, we cannot change its size. But an ArrayList is dynamically resizable, meaning we can add or remove elements at runtime.'
      },
      {
        label: 'Data types',
        explanation: 'An array can store both primitive data types and objects, whereas an ArrayList stores objects. For primitive values, we use wrapper classes like Integer and Double.'
      },
      {
        label: 'Insertion and deletion',
        explanation: 'In an array, inserting or deleting elements requires manual shifting of elements. But an ArrayList provides built-in methods like add() and remove().'
      },
      {
        label: 'Accessing elements',
        explanation: 'In an array, we access elements using the index operator, whereas in an ArrayList, we use the get() method.'
      },
      {
        label: 'Size retrieval',
        explanation: 'We use the .length property to find the size of an array, but for an ArrayList, we call the size() method.'
      },
      {
        label: 'Performance and memory',
        explanation: 'An array is more memory-efficient and faster because it does not have the overhead of dynamic resizing or wrapper classes. An ArrayList provides flexibility at the cost of slightly more memory and resizing overhead.'
      }
    ],
    tableRows: [
      { dimension: 'Definition', conceptAValue: 'Fixed-size contiguous sequential data structure built into Java.', conceptBValue: 'Resizable dynamic List collection class in java.util.' },
      { dimension: 'Underlying Mechanism', conceptAValue: 'Contiguous memory chunk allocated directly by JVM.', conceptBValue: 'Backed by a dynamic Object[] array that resizes by 50% when full.' },
      { dimension: 'Size & Mutability', conceptAValue: 'Fixed size upon creation; length cannot be changed.', conceptBValue: 'Dynamic; automatically expands and contracts.' },
      { dimension: 'Supported Data Types', conceptAValue: 'Supports both primitives (int, double) and object references.', conceptBValue: 'Stores only object references; primitives require wrapper classes.' },
      { dimension: 'Memory Behavior', conceptAValue: 'Minimal memory footprint; exactly allocates specified elements.', conceptBValue: 'Incurs overhead from internal reserve capacity buffer and wrapper objects.' },
      { dimension: 'Performance', conceptAValue: 'O(1) random access; fastest execution speed.', conceptBValue: 'O(1) random access; O(1) amortized append; O(N) resize/shift.' },
      { dimension: 'Supported Operations', conceptAValue: 'Index access via [i] and .length property only.', conceptBValue: 'Rich Collections API: add(), remove(), contains(), sort(), stream().' },
      { dimension: 'Syntax', conceptAValue: 'int[] arr = new int[5];', conceptBValue: 'List<Integer> list = new ArrayList<>();' }
    ],
    exampleA: {
      language: 'java',
      code: `public class ArrayDemo {
    public static void main(String[] args) {
        // Fixed-size primitive array
        int[] numbers = new int[3];
        numbers[0] = 10;
        numbers[1] = 20;
        numbers[2] = 30;

        System.out.println("Array Length: " + numbers.length);
        System.out.println("Element at index 1: " + numbers[1]);
        // numbers[3] = 40; // Throws ArrayIndexOutOfBoundsException
    }
}`,
      expectedOutput: `Array Length: 3\nElement at index 1: 20`,
      explanation: 'Shows fixed-size array initialization, element assignment via index, and direct primitive access.'
    },
    exampleB: {
      language: 'java',
      code: `import java.util.ArrayList;
import java.util.List;

public class ArrayListDemo {
    public static void main(String[] args) {
        // Dynamic resizable List with Autoboxing
        List<Integer> list = new ArrayList<>();
        list.add(10);
        list.add(20);
        list.add(30);
        list.add(40); // Grows dynamically

        System.out.println("ArrayList Size: " + list.size());
        System.out.println("Element at index 1: " + list.get(1));
    }
}`,
      expectedOutput: `ArrayList Size: 4\nElement at index 1: 20`,
      explanation: 'Shows dynamic collection growth without manual bounds allocation, using autoboxing and \`get(index)\`.'
    },
    useCasesAndTradeoffs: {
      whenToUseA: 'Use arrays when element count is fixed and known upfront, memory efficiency is critical, or when operating directly on high-throughput primitive data.',
      whenToUseB: 'Use ArrayList when dataset size fluctuates dynamically, frequent additions/removals occur, or Collections utility methods and Streams are required.',
      tradeoffsSummary: 'Arrays maximize memory density and execution speed for fixed-size primitive data; ArrayList optimizes developer agility and dynamic growth at the cost of slight object overhead.'
    },
    interviewSummary: 'In Java, an array is a fixed-size data structure that stores elements of the same declared type in contiguous memory, whereas ArrayList is a resizable implementation of the List interface in the Java Collections Framework. An array can store primitive data types and objects directly, while an ArrayList stores only object references and uses wrapper classes for primitive values through autoboxing. The main difference is that an array has a fixed length after creation, whereas an ArrayList can grow or shrink dynamically as elements are added or removed. Arrays use bracket notation and the length property, while ArrayList provides rich collection methods such as add(), remove(), and size(). In practice, choose an array when the collection size is known in advance and memory efficiency is critical, and choose ArrayList when you need flexible dynamic storage and collections operations.',
    conciseConclusion: 'Choose an array for fixed-size, performance-critical primitive buffers; choose an ArrayList for dynamic business data where collections ergonomics and flexibility outweigh raw memory density.'
  };
}

// -----------------------------------------------------------------
// 2. Git Pull vs GitHub Pull Request (Explicit Factual Distinction)
// -----------------------------------------------------------------

function getGitPullVsPullRequestComparison(): ComparisonStructure {
  return {
    conceptAName: 'GitHub Pull Request (PR)',
    conceptADefinition: 'A Pull Request is a web-based collaboration and code-review feature hosted on platforms like GitHub, GitLab, and Bitbucket. It proposes merging changes from one branch or fork into a target branch, providing an interface for peer review, discussions, automated CI/CD checks, and approval gates before code integration.',
    conceptBName: 'git pull (CLI Command)',
    conceptBDefinition: '`git pull` is a Git command-line utility executed locally on a developer\'s machine. It downloads commits from a remote tracking branch and immediately integrates them into the currently checked-out local branch by executing `git fetch` followed by `git merge`.',
    differencesInSentences: [
      {
        label: 'Platform vs Tool',
        explanation: 'A Pull Request is a feature of hosting platforms like GitHub, not a Git command, whereas `git pull` is a core Git command-line tool executed on your local machine.'
      },
      {
        label: 'Primary purpose',
        explanation: 'A Pull Request is used for code review, team collaboration, and automated CI pipeline verification before merging, whereas `git pull` is used to update your local working branch with remote changes.'
      },
      {
        label: 'Execution location',
        explanation: 'A Pull Request exists and is reviewed on the remote web platform (e.g. GitHub servers), while `git pull` runs locally in your terminal and modifies your local working tree.'
      },
      {
        label: 'Action performed',
        explanation: 'Approving and merging a Pull Request integrates code into the remote repository\'s target branch on GitHub, whereas running `git pull` fetches remote commits and merges them into your current local branch.'
      },
      {
        label: 'Review and gating',
        explanation: 'A Pull Request allows code owners to inspect diffs line-by-line, require passing tests, and block unauthorized merges; `git pull` performs an immediate local merge without human review gates.'
      }
    ],
    tableRows: [
      { dimension: 'Category', conceptAValue: 'Web platform collaboration workflow (GitHub/GitLab)', conceptBValue: 'Local Git CLI terminal command' },
      { dimension: 'Execution Environment', conceptAValue: 'Remote GitHub servers via browser or GitHub CLI (`gh pr`)', conceptBValue: 'Developer local workstation terminal' },
      { dimension: 'Underlying Mechanism', conceptAValue: 'Creates a merge proposal comparing two remote branch refs', conceptBValue: 'Executes `git fetch` followed immediately by `git merge`' },
      { dimension: 'Primary Goal', conceptAValue: 'Code review, inline discussion, CI status checks, approval gates', conceptBValue: 'Synchronizing local branch with remote commits' },
      { dimension: 'Working Directory Impact', conceptAValue: 'Zero local impact; exists purely on remote platform', conceptBValue: 'Directly modifies local files; can cause local merge conflicts' },
      { dimension: 'Automation & CI/CD', conceptAValue: 'Triggers GitHub Actions, unit tests, and lint checks', conceptBValue: 'Does not trigger remote CI workflows' }
    ],
    exampleA: {
      language: 'bash',
      code: `# Typical Pull Request workflow on GitHub:
# 1. Developer pushes feature branch to remote
git push origin feature/user-auth

# 2. Open PR via GitHub CLI (or GitHub Web UI)
gh pr create --base main --head feature/user-auth --title "Add OAuth2 Login" --body "Implements JWT + Google OAuth"

# 3. Teammates review code diffs, CI tests run automatically, then merge:
gh pr merge 12 --squash`,
      expectedOutput: `✓ Created pull request #12 (Add OAuth2 Login) on github.com
✓ All 14 CI checks passed
✓ Merged into main (commit 98f4e21)`,
      explanation: 'Illustrates creating and merging a Pull Request on GitHub for team review and automated verification.'
    },
    exampleB: {
      language: 'bash',
      code: `# Typical git pull workflow on local terminal:
# Switch to main branch
git checkout main

# Fetch latest remote commits and merge into local working branch
git pull origin main`,
      expectedOutput: `remote: Enumerating objects: 5, done.
remote: Total 5 (delta 2), reused 3
From https://github.com/company/repo
 * branch            main       -> FETCH_HEAD
Updating a1b2c3d..98f4e21
Fast-forward
 src/auth/oauth.ts | 45 +++++++++++++++++++++++++++++++++++++
 1 file changed, 45 insertions(+)`,
      explanation: 'Illustrates running `git pull` locally to download and integrate the remote changes into the developer workstation.'
    },
    useCasesAndTradeoffs: {
      whenToUseA: 'Use a Pull Request whenever you want teammates to review your code, run automated CI test suites, and enforce quality before merging into production branches.',
      whenToUseB: 'Use `git pull` when you need to bring your local branch up to date with commits that have been pushed to the remote repository by your team.',
      tradeoffsSummary: 'Pull Requests provide collaboration quality gates and audit history at the cost of review latency; `git pull` provides immediate local synchronization but can cause merge conflicts in your working tree.'
    },
    interviewSummary: 'A GitHub Pull Request is a web-based collaboration and code-review workflow hosted on GitHub that allows team members to review diffs, discuss implementations, and run automated CI/CD checks before merging code into a target branch. In contrast, git pull is a local Git CLI command executed in a developer terminal that downloads commits from a remote tracking branch and immediately merges them into the checked-out local branch. The critical distinction is that opening a Pull Request never executes git pull or modifies any developer local files, and git pull can be used completely independently of GitHub or Pull Requests. In a production engineering workflow, developers push feature branches to GitHub, open a Pull Request for peer review, and once approved and merged remotely, team members manually run git pull to update their local branches.',
    conciseConclusion: 'A Pull Request is a code review proposal on GitHub; `git pull` is a terminal command that updates your local files with remote changes.'
  };
}

// -----------------------------------------------------------------
// 3. Git Fetch vs Git Pull
// -----------------------------------------------------------------

function getGitFetchVsGitPullComparison(): ComparisonStructure {
  return {
    conceptAName: 'git fetch',
    conceptADefinition: '`git fetch` is a non-destructive Git command that downloads commits, branches, and tags from a remote repository into your local `.git` repository and updates remote-tracking branches (like `origin/main`), without modifying your active working directory or local branches.',
    conceptBName: 'git pull',
    conceptBDefinition: '`git pull` is a composite Git command that downloads remote changes AND immediately attempts to merge them into your currently checked-out local branch, combining `git fetch` with `git merge` in a single command.',
    differencesInSentences: [
      {
        label: 'Safety and impact',
        explanation: '`git fetch` is completely safe because it never alters your working directory files or active branch, whereas `git pull` modifies your local files and can trigger merge conflicts.'
      },
      {
        label: 'Underlying mechanism',
        explanation: '`git fetch` only updates remote-tracking branches (like origin/main), while `git pull` runs `git fetch` followed immediately by `git merge` (or `git rebase`).'
      },
      {
        label: 'Inspection capability',
        explanation: '`git fetch` gives you the opportunity to inspect incoming commits using `git log origin/main` or `git diff HEAD..origin/main` before deciding to merge, whereas `git pull` integrates changes blindly.'
      },
      {
        label: 'Offline comparison',
        explanation: 'After running `git fetch`, your local repository has the remote objects cached, allowing you to diff and compare branches offline without further network calls.'
      }
    ],
    tableRows: [
      { dimension: 'Command Composition', conceptAValue: 'Standalone atomic command', conceptBValue: 'Composite: `git fetch` + `git merge`' },
      { dimension: 'Working Directory Impact', conceptAValue: 'Zero change; working tree remains untouched', conceptBValue: 'Immediately updates working files with incoming commits' },
      { dimension: 'Risk of Conflicts', conceptAValue: 'Zero risk of merge conflicts', conceptBValue: 'High risk of merge conflicts if local branch has diverged' },
      { dimension: 'Remote Tracking Refs', conceptAValue: 'Updates `refs/remotes/origin/*` only', conceptBValue: 'Updates remote tracking refs AND active local branch ref' },
      { dimension: 'Best Practice', conceptAValue: 'Run frequently to stay aware of upstream changes safely', conceptBValue: 'Run only when ready to integrate changes into current branch' }
    ],
    exampleA: {
      language: 'bash',
      code: `# Safely download remote commits without touching working files
git fetch origin

# Inspect incoming changes before merging
git log HEAD..origin/main --oneline

# View exact code differences
git diff HEAD origin/main`,
      expectedOutput: `remote: Enumerating objects: 7, done.
From https://github.com/company/repo
 * branch            main       -> origin/main
4a8b1c2 Fix token expiration validation
1d9e2f3 Update database connection pool size`,
      explanation: 'Demonstrates fetching changes safely and inspecting commit logs before modifying any local code.'
    },
    exampleB: {
      language: 'bash',
      code: `# Download and merge directly into active branch
git pull origin main`,
      expectedOutput: `Updating 8f2a1b4..4a8b1c2
Fast-forward
 src/auth/jwt.ts     | 12 ++++++++----
 src/db/config.ts    |  4 +---
 2 files changed, 9 insertions(+), 7 deletions(-)`,
      explanation: 'Demonstrates `git pull` immediately updating local files with incoming remote commits.'
    },
    useCasesAndTradeoffs: {
      whenToUseA: 'Use `git fetch` when you want to see what teammates have pushed without disrupting your uncommitted work or triggering unexpected merge conflicts.',
      whenToUseB: 'Use `git pull` when you have a clean working tree and want to quickly synchronize your current branch with remote changes in one step.',
      tradeoffsSummary: '`git fetch` provides complete visibility and safety with zero merge risk; `git pull` saves time by combining fetch and merge at the risk of immediate conflicts.'
    },
    interviewSummary: 'git fetch and git pull are both Git commands used to synchronize with remote repositories, but they differ fundamentally in safety and working directory impact. git fetch is 100% non-destructive: it downloads new commits, objects, and refs from the remote into your local .git directory and updates remote-tracking branches like origin/main, leaving your working tree files and active branch completely untouched. In contrast, git pull is a composite command that first runs git fetch and then immediately attempts to merge the incoming commits into your currently checked-out branch. Because git pull directly modifies your local working tree, it can unexpectedly trigger merge conflicts in the middle of development. Best practice is to run git fetch first to review remote changes with git log or git diff before deciding to merge.',
    conciseConclusion: 'Use `git fetch` to safely inspect remote changes before merging; use `git pull` to fetch and merge in a single step.'
  };
}

// -----------------------------------------------------------------
// Git Merge vs Git Pull
// -----------------------------------------------------------------

function getGitMergeVsGitPullComparison(): ComparisonStructure {
  return {
    conceptAName: 'git merge',
    conceptADefinition: '`git merge` is a local Git CLI command used to combine the commit history of two independent local branches into the currently checked-out branch. It operates completely offline without network requests, creating a 3-way merge commit or performing a fast-forward merge.',
    conceptBName: 'git pull',
    conceptBDefinition: '`git pull` is a composite network-and-integration command that downloads commits from a remote tracking branch and immediately integrates them into the current active local branch. By default, it executes `git fetch` followed immediately by `git merge`.',
    differencesInSentences: [
      {
        label: 'Network dependency',
        explanation: '`git merge` operates completely offline on local branches or cached refs, whereas `git pull` connects over the network to a remote repository (e.g. GitHub) before merging.'
      },
      {
        label: 'Command composition',
        explanation: '`git merge` is an atomic, primitive Git command; `git pull` is a convenience shortcut combining `git fetch` with `git merge` (or `git rebase`).'
      },
      {
        label: 'Target branches',
        explanation: '`git merge` is typically used to integrate local feature branches into `main`; `git pull` is used to synchronize the current local branch with upstream remote commits.'
      },
      {
        label: 'Safety and inspection',
        explanation: 'Using `git fetch` followed by `git merge` allows developers to inspect incoming diffs before merging; `git pull` triggers the merge immediately, risking unexpected merge conflicts in working files.'
      }
    ],
    tableRows: [
      { dimension: 'Command Type', conceptAValue: 'Primitive local integration command', conceptBValue: 'Composite network + integration command (`fetch` + `merge`)' },
      { dimension: 'Network Required', conceptAValue: 'No (operates purely offline in local repository)', conceptBValue: 'Yes (downloads commits from remote server)' },
      { dimension: 'Primary Purpose', conceptAValue: 'Combines two local branch histories', conceptBValue: 'Synchronizes local branch with remote upstream changes' },
      { dimension: 'Working Directory Impact', conceptAValue: 'Integrates changes from target branch into working tree', conceptBValue: 'Downloads remote changes and integrates them into working tree' },
      { dimension: 'Control Level', conceptAValue: 'High: can review branch commits prior to running merge', conceptBValue: 'Lower: combines fetch and merge into an automated step' }
    ],
    exampleA: {
      language: 'bash',
      code: `# Local branch merge (offline)
git checkout main
git merge feature/user-auth`,
      expectedOutput: `Merge made by the 'ort' strategy.
 auth/login.ts | 42 ++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 42 insertions(+)`,
      explanation: 'Merges local feature branch into main creating a merge commit.'
    },
    exampleB: {
      language: 'bash',
      code: `# Remote synchronization + merge (network required)
git checkout main
git pull origin main`,
      expectedOutput: `From https://github.com/company/repo
 * branch            main       -> FETCH_HEAD
Updating 7a1b2c3..9d4e5f6
Fast-forward
 services/api.ts | 15 ++++++++++-----
 1 file changed, 10 insertions(+), 5 deletions(-)`,
      explanation: 'Downloads latest remote commits and automatically merges them into local main.'
    },
    useCasesAndTradeoffs: {
      whenToUseA: 'Use `git merge` when integrating completed local feature branches, handling complex multi-branch workflows, or merging after inspecting fetched changes.',
      whenToUseB: 'Use `git pull` when you want a quick one-step command to bring your local branch up to date with remote changes pushed by teammates.',
      tradeoffsSummary: '`git merge` gives precise offline control over branch integration; `git pull` saves time on routine remote updates at the cost of immediate merge risk.'
    },
    interviewSummary: 'git merge is a local, offline command that combines two branches within your local repository by creating an explicit merge commit or advancing the branch pointer via fast-forward. In contrast, git pull is a composite network command that communicates with a remote server, downloads commits using git fetch, and immediately merges them into your checked-out branch. The fundamental distinction is scope: git merge works strictly on local commits that already exist on your disk, whereas git pull fetches new commits across the network from an upstream remote repository.',
    conciseConclusion: '`git merge` integrates two local branches offline; `git pull` downloads remote commits and merges them into your current branch in one step.'
  };
}

// -----------------------------------------------------------------
// Git Fetch vs GitHub Pull Request
// -----------------------------------------------------------------

function getGitFetchVsPullRequestComparison(): ComparisonStructure {
  return {
    conceptAName: 'git fetch',
    conceptADefinition: '`git fetch` is a safe, non-destructive Git CLI command that downloads new commits, files, and branches from a remote repository into your local `.git` directory and updates remote-tracking branches (like `origin/main`), without modifying your active working directory or local branches.',
    conceptBName: 'GitHub Pull Request (PR)',
    conceptBDefinition: 'A GitHub Pull Request is a web-based collaboration and code-review workflow hosted on GitHub. It proposes merging changes from a head branch into a base branch, providing a web UI for peer review, line-by-line discussions, automated CI/CD checks, and approval gates before code integration.',
    differencesInSentences: [
      {
        label: 'Platform vs CLI tool',
        explanation: '`git fetch` is a command-line tool executed locally in the terminal, whereas a Pull Request is a hosted web platform feature on GitHub.'
      },
      {
        label: 'Primary objective',
        explanation: '`git fetch` safely caches remote commits locally for offline inspection, while a Pull Request is designed for human peer review, discussion, and automated CI test gates.'
      },
      {
        label: 'Code integration',
        explanation: '`git fetch` never merges code or changes branch pointers; a Pull Request is specifically created to merge code into the remote repository once approved.'
      },
      {
        label: 'Review capabilities',
        explanation: '`git fetch` allows terminal inspection via `git diff` and `git log`; a Pull Request provides an interactive web UI with inline comments, PR templates, and required reviewers.'
      }
    ],
    tableRows: [
      { dimension: 'Category', conceptAValue: 'Git CLI terminal command', conceptBValue: 'GitHub web platform collaboration workflow' },
      { dimension: 'Execution Environment', conceptAValue: 'Developer local workstation', conceptBValue: 'Remote GitHub servers via browser or `gh` CLI' },
      { dimension: 'Primary Goal', conceptAValue: 'Download remote commits without touching working files', conceptBValue: 'Review, test, discuss, and approve branch merges' },
      { dimension: 'Branch Integration', conceptAValue: 'Never merges; updates remote-tracking refs only', conceptBValue: 'Triggers remote merge upon review approval' },
      { dimension: 'Working Tree Impact', conceptAValue: 'Zero change to working files', conceptBValue: 'Zero change to local working files' }
    ],
    exampleA: {
      language: 'bash',
      code: `# Safely download remote commits without touching local files
git fetch origin

# Inspect remote commits before deciding to merge
git log HEAD..origin/main --oneline`,
      expectedOutput: `remote: Enumerating objects: 4, done.
From https://github.com/company/repo
 * branch            main       -> origin/main
4c1d2e3 Update security dependency to v2.4`,
      explanation: 'Downloads remote refs into origin/main safely for inspection.'
    },
    exampleB: {
      language: 'bash',
      code: `# Create and review Pull Request on GitHub
gh pr create --base main --head feature/security-patch --title "Security Patch"
# Reviewers inspect diffs on GitHub, CI runs tests, then merge:
gh pr merge 14 --squash`,
      expectedOutput: `✓ Pull request #14 opened on github.com
✓ 8 CI tests passed
✓ Merged PR #14 into main`,
      explanation: 'Opens a Pull Request on GitHub for team code review and approval.'
    },
    useCasesAndTradeoffs: {
      whenToUseA: 'Use `git fetch` to safely check what teammates have pushed without disrupting your active local work.',
      whenToUseB: 'Use a Pull Request to share code with your team, run CI tests, and enforce review standards before merging to main.',
      tradeoffsSummary: '`git fetch` provides local data synchronization with zero merge risk; Pull Requests provide team governance and review gates.'
    },
    interviewSummary: '`git fetch` is a local Git CLI command that safely downloads remote commits into remote-tracking branches like `origin/main` without touching your working directory. A GitHub Pull Request is a web-based code-review and collaboration workflow on GitHub that allows team members to review, discuss, and test code changes before merging into the main branch.',
    conciseConclusion: '`git fetch` downloads remote commits locally without merging; a Pull Request is a GitHub web review workflow proposing a merge.'
  };
}

// -----------------------------------------------------------------
// Git Merge vs Git Rebase
// -----------------------------------------------------------------

function getGitMergeVsGitRebaseComparison(): ComparisonStructure {
  return {
    conceptAName: 'git merge',
    conceptADefinition: '`git merge` combines two branch histories by creating an explicit 3-way merge commit that has multiple parent commits, preserving the complete, true chronological sequence and non-linear topology of both branches.',
    conceptBName: 'git rebase',
    conceptBDefinition: '`git rebase` rewrites commit history by moving the base of your current branch onto the tip of the target branch, replaying local commits one by one to create a completely clean, linear commit history without merge commits.',
    differencesInSentences: [
      {
        label: 'Commit history topology',
        explanation: '`git merge` preserves non-linear branch history with explicit merge commits, whereas `git rebase` flattens history into a single linear sequence.'
      },
      {
        label: 'Commit hashes and rewriting',
        explanation: '`git merge` preserves original commit hashes intact, whereas `git rebase` creates brand-new commit hashes because each commit is re-applied with a different parent.'
      },
      {
        label: 'Golden rule of rebase',
        explanation: 'Never rebase commits that have already been pushed to a public or shared branch, because rewriting public history causes divergence and merge conflicts for teammates.'
      },
      {
        label: 'Conflict resolution flow',
        explanation: '`git merge` resolves conflicts all at once during the merge commit; `git rebase` pauses and resolves conflicts commit-by-commit as each commit is replayed.'
      }
    ],
    tableRows: [
      { dimension: 'History Structure', conceptAValue: 'Non-linear; preserves exact chronological branch topology', conceptBValue: 'Linear; replayed sequential history without merge commits' },
      { dimension: 'Commit Hashes', conceptAValue: 'Preserved (original hashes unchanged)', conceptBValue: 'Rewritten (new commit hashes created)' },
      { dimension: 'Merge Commits', conceptAValue: 'Creates explicit 3-way merge commit', conceptBValue: 'Zero merge commits created' },
      { dimension: 'Safety on Public Branches', conceptAValue: 'Safe (never rewrites published history)', conceptBValue: 'Dangerous on shared branches (rewrites history)' },
      { dimension: 'Traceability', conceptAValue: 'Preserves complete context of when feature existed', conceptBValue: 'Provides clean, easily readable `git log`' }
    ],
    exampleA: {
      language: 'bash',
      code: `# git merge: Preserves branch history with merge commit
git checkout main
git merge feature-login`,
      expectedOutput: `Merge made by the 'ort' strategy.
 * commit a1b2c3d (Merge branch 'feature-login' into main)`,
      explanation: 'Creates a 3-way merge commit preserving both branch histories.'
    },
    exampleB: {
      language: 'bash',
      code: `# git rebase: Replays commits linearly on top of main
git checkout feature-login
git rebase main`,
      expectedOutput: `Successfully rebased and updated refs/heads/feature-login.
[Linear history with new commit hashes on top of main]`,
      explanation: 'Replays local feature commits on top of the latest main commit.'
    },
    useCasesAndTradeoffs: {
      whenToUseA: 'Use `git merge` when merging into public branches (like `main`), preserving audit history, or when collaborating with multiple developers on a branch.',
      whenToUseB: 'Use `git rebase` to clean up local private feature branches before opening a PR, or to pull the latest `main` into your feature branch.',
      tradeoffsSummary: '`git merge` provides complete historical accuracy at the cost of cluttered logs; `git rebase` provides a clean linear log at the risk of rewriting history.'
    },
    interviewSummary: 'git merge and git rebase are two distinct strategies for integrating changes from one Git branch into another. git merge is a non-destructive operation that creates a new 3-way merge commit with two parents, cleanly tying the branches together and preserving the exact chronological sequence of when commits occurred. In contrast, git rebase rewrites project history by taking the commits from your feature branch and replaying them one by one onto the tip of the target branch, producing a completely linear commit history without merge bubbles. While rebase keeps commit history exceptionally clean and readable, the golden rule of Git is to never rebase commits that have already been pushed to a public or shared branch, as rewriting shared commit hashes causes severe merge conflicts for teammates.',
    conciseConclusion: '`git merge` preserves true history with merge commits; `git rebase` rewrites history into a clean linear sequence.'
  };
}

// -----------------------------------------------------------------
// 4. DELETE vs TRUNCATE vs DROP (SQL DDL/DML 3-Way & Pairwise)
// -----------------------------------------------------------------

function getDeleteVsTruncateVsDropComparison(cA: string, cB: string, cC: string, prompt: string): ComparisonStructure {
  return {
    conceptAName: 'DELETE (SQL)',
    conceptADefinition: '`DELETE` is a DML (Data Manipulation Language) statement used to remove specific rows from a table using an optional `WHERE` clause. It logs each deleted row individually in the transaction log and can be rolled back.',
    conceptBName: 'TRUNCATE (SQL)',
    conceptBDefinition: '`TRUNCATE` is a DDL (Data Definition Language) statement that empties a table by deallocating the underlying data pages. It removes all rows without row-by-row logging, resets auto-increment identity counters, and preserves the table structure.',
    conceptCName: 'DROP (SQL)',
    conceptCDefinition: '`DROP` is a DDL statement that completely removes the table definition, schema, data, indexes, constraints, triggers, and permissions entirely from the database catalog.',
    differencesInSentences: [
      {
        label: 'Command category',
        explanation: 'DELETE is a DML command, whereas TRUNCATE and DROP are DDL commands.'
      },
      {
        label: 'Filter capability',
        explanation: 'DELETE supports a WHERE clause to remove specific rows, whereas TRUNCATE and DROP always operate on the entire table without filtering.'
      },
      {
        label: 'Speed and logging',
        explanation: 'DELETE logs every individual row deletion, making it slow for large datasets; TRUNCATE deallocates data pages with minimal logging making it extremely fast; DROP removes the schema catalog definition directly.'
      },
      {
        label: 'Table structure',
        explanation: 'DELETE and TRUNCATE preserve the table schema, columns, and constraints for future inserts; DROP completely destroys the table and frees all allocated storage.'
      },
      {
        label: 'Identity counters and triggers',
        explanation: 'DELETE does not reset auto-increment counters and fires ON DELETE triggers; TRUNCATE resets auto-increment counters to their seed and does not fire DELETE triggers; DROP completely eradicates triggers and counters.'
      },
      {
        label: 'Transaction rollback',
        explanation: 'DELETE can always be rolled back within a transaction; TRUNCATE can be rolled back in PostgreSQL and SQL Server inside a transaction (though not in MySQL); DROP removes the table catalog entry.'
      }
    ],
    tableRows: [
      { dimension: 'Command Category', conceptAValue: 'DML (Data Manipulation Language)', conceptBValue: 'DDL (Data Definition Language)', conceptCValue: 'DDL (Data Definition Language)' },
      { dimension: 'WHERE Clause Support', conceptAValue: 'Supported (can delete selective rows)', conceptBValue: 'Not supported (removes all rows)', conceptCValue: 'Not supported (deletes entire table)' },
      { dimension: 'Execution Speed', conceptAValue: 'Slow (row-by-row deletion & logging)', conceptBValue: 'Very fast (deallocates data pages)', conceptCValue: 'Instantaneous (drops catalog object)' },
      { dimension: 'Transaction Logging', conceptAValue: 'Full logging of every deleted row', conceptBValue: 'Minimal logging (page deallocation only)', conceptCValue: 'Minimal logging (catalog update)' },
      { dimension: 'Table Structure After Run', conceptAValue: 'Intact (ready for new inserts)', conceptBValue: 'Intact (ready for new inserts)', conceptCValue: 'Completely destroyed from database' },
      { dimension: 'Identity / Auto-Increment', conceptAValue: 'Maintained (continues from last ID)', conceptBValue: 'Reset to initial seed (e.g. 1)', conceptCValue: 'Destroyed' },
      { dimension: 'Triggers', conceptAValue: 'Fires `ON DELETE` triggers', conceptBValue: 'Does not fire `DELETE` triggers', conceptCValue: 'Does not fire `DELETE` triggers' }
    ],
    exampleA: {
      language: 'sql',
      code: `-- 1. DELETE: Selective row removal with WHERE clause
BEGIN TRANSACTION;
DELETE FROM orders 
WHERE status = 'CANCELLED' AND created_at < '2025-01-01';

-- Can be safely rolled back if needed
ROLLBACK;`,
      expectedOutput: `Query OK, 45 rows affected (0.04 sec)\nRollback executed: 45 rows restored.`,
      explanation: 'Shows selective row deletion using a WHERE clause inside a transaction with full rollback capability.'
    },
    exampleB: {
      language: 'sql',
      code: `-- 2. TRUNCATE: Fast table wipe while preserving table structure
TRUNCATE TABLE audit_logs;

-- Structure remains intact for new records, ID counter reset to 1
INSERT INTO audit_logs (message) VALUES ('System rebooted');`,
      expectedOutput: `Query OK, 0 rows affected (0.00 sec)\n1 row inserted with id = 1.`,
      explanation: 'Shows fast deallocation of data pages, resetting the auto-increment identity seed to 1.'
    },
    exampleC: {
      language: 'sql',
      code: `-- 3. DROP: Eradicate table definition and data entirely
DROP TABLE IF EXISTS deprecated_features;

-- Future queries will fail because table does not exist
SELECT * FROM deprecated_features;`,
      expectedOutput: `Query OK, 0 rows affected (0.01 sec)\nERROR 1146 (42S02): Table 'db.deprecated_features' doesn't exist`,
      explanation: 'Shows complete destruction of table metadata and data from the database schema.'
    },
    useCasesAndTradeoffs: {
      whenToUseA: 'Use DELETE when you need to remove specific records based on conditions, fire audit triggers, or need row-by-row transaction control.',
      whenToUseB: 'Use TRUNCATE when you want to quickly wipe all data from a large staging or log table while keeping the schema intact for new records.',
      whenToUseC: 'Use DROP when a table is permanently deprecated or when running database migration rollback scripts.',
      tradeoffsSummary: 'DELETE provides row-level granularity and trigger execution at the cost of performance; TRUNCATE provides maximum speed for wiping data; DROP removes the table entity completely.'
    },
    interviewSummary: 'DELETE, TRUNCATE, and DROP are SQL commands that remove database objects at three different architectural levels. DELETE is a DML command that removes specific rows based on a WHERE clause; it logs each deleted row individually in the transaction log, fires database triggers, and can be fully rolled back. In contrast, TRUNCATE is a fast DDL command that quickly wipes all rows by deallocating the underlying data pages without logging individual rows; it resets identity seed counters, preserves the table structure and columns, but does not fire row-level triggers. DROP is a destructive DDL command that completely destroys the table schema, all data rows, indexes, triggers, and permissions from the database catalog entirely. In practice, use DELETE for conditional row removal, TRUNCATE to reset a large staging table rapidly while keeping the schema, and DROP when permanently retiring an obsolete table.',
    conciseConclusion: 'Use DELETE for conditional row removal, TRUNCATE to quickly wipe all rows while keeping the table structure, and DROP to permanently delete the table schema entirely.'
  };
}

// -----------------------------------------------------------------
// 5. Primary Key vs Foreign Key (DBMS)
// -----------------------------------------------------------------

function getPrimaryKeyVsForeignKeyComparison(): ComparisonStructure {
  return {
    conceptAName: 'Primary Key',
    conceptADefinition: 'A Primary Key is a constraint in a relational database that uniquely identifies each record in a table. It cannot accept NULL values, and each table can have at most one primary key, which automatically generates a unique clustered index in most relational database engines.',
    conceptBName: 'Foreign Key',
    conceptBDefinition: 'A Foreign Key is a constraint that establishes a relationship between two tables by referencing the primary key (or unique key) of another table. It enforces referential integrity, can accept NULL values (indicating optional association), and a single table can contain multiple foreign keys.',
    differencesInSentences: [
      {
        label: 'Purpose',
        explanation: 'A Primary Key uniquely identifies rows within its own table, whereas a Foreign Key links records between tables to enforce referential integrity.'
      },
      {
        label: 'Nullability',
        explanation: 'A Primary Key strictly forbids NULL values (`NOT NULL`), whereas a Foreign Key allows NULL values unless explicitly declared with a NOT NULL constraint.'
      },
      {
        label: 'Table limit',
        explanation: 'A table can have only one Primary Key (which can be a single column or composite), whereas a table can have multiple Foreign Keys referencing different parent tables.'
      },
      {
        label: 'Default indexing',
        explanation: 'A Primary Key automatically generates a unique clustered index in engines like MySQL InnoDB and SQL Server, whereas Foreign Keys are not automatically indexed by default and usually require manual indexing for JOIN performance.'
      },
      {
        label: 'Duplicate values',
        explanation: 'Primary Key values must be strictly unique across all rows, whereas Foreign Key columns can contain duplicate values representing one-to-many relationships.'
      }
    ],
    tableRows: [
      { dimension: 'Core Purpose', conceptAValue: 'Uniquely identifies each record in a table', conceptBValue: 'References primary key of another table to link relations' },
      { dimension: 'Null Values Allowed', conceptAValue: 'Never allowed (strictly NOT NULL)', conceptBValue: 'Allowed (unless explicitly declared NOT NULL)' },
      { dimension: 'Quantity per Table', conceptAValue: 'Exactly one (can be composite across columns)', conceptBValue: 'Multiple allowed (as many relationships as needed)' },
      { dimension: 'Duplicate Values', conceptAValue: 'Strictly forbidden (must be unique)', conceptBValue: 'Allowed (supports one-to-many relationships)' },
      { dimension: 'Default Index', conceptAValue: 'Automatically creates a unique clustered index', conceptBValue: 'Not automatically indexed; manual index recommended' },
      { dimension: 'Target Relation', conceptAValue: 'Self-contained within the table entity', conceptBValue: 'References parent table primary or unique key' }
    ],
    exampleA: {
      language: 'sql',
      code: `-- Parent Table: departments
CREATE TABLE departments (
    dept_id INT PRIMARY KEY AUTO_INCREMENT,
    dept_name VARCHAR(100) NOT NULL UNIQUE
);

INSERT INTO departments (dept_name) VALUES ('Engineering'), ('Security');`,
      expectedOutput: `Query OK, 2 rows affected.\ndept_id = 1 (Engineering), dept_id = 2 (Security)`,
      explanation: 'Demonstrates Primary Key ensuring unique identification and non-null values for each department.'
    },
    exampleB: {
      language: 'sql',
      code: `-- Child Table: employees referencing departments
CREATE TABLE employees (
    emp_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    dept_id INT, -- Foreign Key allows NULL for unassigned staff
    CONSTRAINT fk_dept FOREIGN KEY (dept_id) 
        REFERENCES departments(dept_id)
        ON DELETE SET NULL
);

INSERT INTO employees (name, dept_id) VALUES ('Alice', 1), ('Bob', NULL);
-- INSERT INTO employees (name, dept_id) VALUES ('Charlie', 99); -- FAILS: violates FK integrity`,
      expectedOutput: `Query OK, 2 rows affected.\nAlice assigned to Engineering (1); Bob assigned to NULL.`,
      explanation: 'Demonstrates Foreign Key referencing parent table, allowing NULL, and preventing invalid references.'
    },
    useCasesAndTradeoffs: {
      whenToUseA: 'Use a Primary Key on every relational table to ensure row uniqueness, facilitate fast primary key lookups, and support entity identification.',
      whenToUseB: 'Use Foreign Keys whenever modeling relationships between entities (e.g. Orders referencing Customers, Employees referencing Departments) to prevent orphan records.',
      tradeoffsSummary: 'Primary Keys enforce row identity and provide fast clustered lookups; Foreign Keys maintain data consistency across tables at the cost of slight write validation overhead.'
    },
    interviewSummary: 'In relational database design, a Primary Key uniquely identifies each record within a table, whereas a Foreign Key creates a relationship by referencing the primary key of another table. The fundamental difference is that a table can have only one primary key and it strictly cannot contain NULL values, ensuring entity integrity. In contrast, a table can have multiple foreign keys to link to different relations, and foreign key columns can accept NULL values unless explicitly declared as NOT NULL. Furthermore, primary keys automatically create a unique clustered index for fast lookups, while foreign keys are not automatically indexed by default. In practice, the primary key ensures that every entity has a unique identity, while foreign keys enforce referential integrity to prevent orphan records across related database tables.',
    conciseConclusion: 'Use a Primary Key to guarantee unique row identity; use Foreign Keys to link related tables and maintain referential integrity.'
  };
}

// -----------------------------------------------------------------
// 6. HTTP vs HTTPS (Networking & Security)
// -----------------------------------------------------------------

function getHttpVsHttpsComparison(): ComparisonStructure {
  return {
    conceptAName: 'HTTP',
    conceptADefinition: 'HTTP (Hypertext Transfer Protocol) is an unencrypted, plaintext application-layer protocol operating over TCP port 80 used for transferring web resources between client and server.',
    conceptBName: 'HTTPS',
    conceptBDefinition: 'HTTPS (Hypertext Transfer Protocol Secure) is an encrypted communication protocol that wraps HTTP traffic inside a TLS/SSL cryptographic tunnel over TCP port 443 to guarantee confidentiality, data integrity, and server authentication.',
    differencesInSentences: [
      {
        label: 'Encryption & Security',
        explanation: 'HTTP transmits headers and payloads in clear plaintext vulnerable to eavesdropping and packet sniffing, whereas HTTPS encrypts all communication using symmetric AES ciphers negotiated via TLS.'
      },
      {
        label: 'Default Port',
        explanation: 'HTTP operates by default over TCP port 80, whereas HTTPS operates over TCP port 443.'
      },
      {
        label: 'Authentication & Trust',
        explanation: 'HTTP does not verify the identity of the server, making it vulnerable to DNS spoofing and MITM attacks; HTTPS requires a verified digital certificate issued by a trusted Certificate Authority (CA).'
      },
      {
        label: 'Data Integrity',
        explanation: 'HTTP allows malicious intermediaries (like public Wi-Fi routers) to tamper with or inject ads into responses; HTTPS uses cryptographic Message Authentication Codes (HMAC) to detect any payload tampering.'
      },
      {
        label: 'Handshake Overhead',
        explanation: 'HTTP establishes communication with a single TCP 3-way handshake; HTTPS requires a TCP handshake followed by a TLS 1.3 cryptographic handshake (adding 1 round trip).'
      }
    ],
    tableRows: [
      { dimension: 'Protocol Stack', conceptAValue: 'Application Layer directly over TCP', conceptBValue: 'Application Layer over TLS/SSL over TCP' },
      { dimension: 'Default TCP Port', conceptAValue: 'Port 80', conceptBValue: 'Port 443' },
      { dimension: 'Confidentiality', conceptAValue: 'None (cleartext, readable by network sniffers)', conceptBValue: 'End-to-end encryption (TLS 1.2 / TLS 1.3)' },
      { dimension: 'Server Authentication', conceptAValue: 'None (cannot verify true server identity)', conceptBValue: 'Mandatory X.509 certificate issued by trusted CA' },
      { dimension: 'Data Integrity', conceptAValue: 'Vulnerable to MITM packet alteration', conceptBValue: 'Cryptographically verified with HMAC' },
      { dimension: 'Browser Indicator', conceptAValue: 'Marked "Not Secure" in modern browsers', conceptBValue: 'Padlock icon or secure connection status' }
    ],
    exampleA: {
      language: 'http',
      code: `# HTTP: Unencrypted plaintext transmission over Port 80
GET /login HTTP/1.1
Host: example.com
Authorization: Basic YWxpY2U6cGFzc3dvcmQxMjM=

# Visible to any packet sniffer on the network path:
# Decoded: "alice:password123"`,
      expectedOutput: `HTTP/1.1 200 OK\nContent-Type: text/html\n\n[Plaintext HTML payload readable by eavesdroppers]`,
      explanation: 'Demonstrates HTTP transmitting credentials in clear plaintext across the network.'
    },
    exampleB: {
      language: 'bash',
      code: `# HTTPS: Inspect TLS handshake over Port 443 using curl
curl -v https://api.github.com

# Handshake output:
# * Connected to api.github.com (140.82.112.6) port 443
# * SSL connection using TLSv1.3 / TLS_AES_128_GCM_SHA256
# * Server certificate: *.github.com (Verified by DigiCert CA)
# * Encrypted payload transmitted securely`,
      expectedOutput: `HTTP/2 200\ncontent-type: application/json\n[Encrypted payload decrypted only by client]`,
      explanation: 'Demonstrates HTTPS establishing a TLS 1.3 cryptographic tunnel with certificate verification.'
    },
    useCasesAndTradeoffs: {
      whenToUseA: 'Use HTTP only for local development on localhost or isolated internal Docker bridge networks where TLS termination occurs at the reverse proxy.',
      whenToUseB: 'Use HTTPS for all production web traffic, public APIs, payment processing, user authentication, and any Internet communication.',
      tradeoffsSummary: 'HTTP has zero cryptographic handshake overhead; HTTPS adds minimal TLS handshake latency while providing non-negotiable confidentiality, authentication, and integrity.'
    },
    interviewSummary: 'HTTP operates over port 80 in clear plaintext with zero encryption, leaving traffic vulnerable to interception and tampering. HTTPS runs over port 443, securing HTTP inside a TLS cryptographic layer that encrypts data with symmetric ciphers, verifies server identity with digital certificates, and guarantees data integrity.',
    conciseConclusion: 'HTTP is plaintext and unencrypted over port 80; HTTPS encrypts traffic over port 443 using TLS, ensuring confidentiality, integrity, and server authentication.'
  };
}

// -----------------------------------------------------------------
// 7. Binary Search vs Linear Search (DSA)
// -----------------------------------------------------------------

function getBinarySearchVsLinearSearchComparison(): ComparisonStructure {
  return {
    conceptAName: 'Linear Search',
    conceptADefinition: 'Linear Search is a sequential search algorithm that inspects every element in a collection one by one from start to finish until the target element is found or the end of the collection is reached.',
    conceptBName: 'Binary Search',
    conceptBDefinition: 'Binary Search is an efficient divide-and-conquer search algorithm that repeatedly divides a sorted collection in half by comparing the target value with the middle element.',
    differencesInSentences: [
      {
        label: 'Prerequisite condition',
        explanation: 'Linear Search works on any collection whether sorted or unsorted, whereas Binary Search strictly requires the collection to be sorted.'
      },
      {
        label: 'Time complexity',
        explanation: 'Linear Search has O(N) linear time complexity in the worst and average cases, whereas Binary Search achieves O(log N) logarithmic time complexity.'
      },
      {
        label: 'Data structure requirement',
        explanation: 'Linear Search works on both arrays and linked lists, whereas Binary Search requires random index access O(1) found in arrays, vectors, or balanced search trees.'
      },
      {
        label: 'Efficiency at scale',
        explanation: 'For a dataset of 1,000,000 elements, Linear Search requires up to 1,000,000 comparisons, while Binary Search requires at most 20 comparisons.'
      },
      {
        label: 'Implementation complexity',
        explanation: 'Linear Search is trivial to implement in a single loop; Binary Search requires careful boundary management (`low <= high`) and overflow-safe midpoint calculation (`low + (high - low) / 2`).'
      }
    ],
    tableRows: [
      { dimension: 'Prerequisite', conceptAValue: 'None (works on unsorted or sorted data)', conceptBValue: 'Input collection MUST be sorted' },
      { dimension: 'Algorithm Paradigm', conceptAValue: 'Sequential scan', conceptBValue: 'Divide-and-conquer' },
      { dimension: 'Best Case Time', conceptAValue: 'O(1) (target is at index 0)', conceptBValue: 'O(1) (target is at exact midpoint)' },
      { dimension: 'Worst & Average Time', conceptAValue: 'O(N) (linear scan through N elements)', conceptBValue: 'O(log N) (halves search space on each step)' },
      { dimension: 'Space Complexity', conceptAValue: 'O(1) auxiliary memory', conceptBValue: 'O(1) iterative, O(log N) recursive stack' },
      { dimension: 'Supported Data Structures', conceptAValue: 'Arrays, Linked Lists, Streams', conceptBValue: 'Arrays and vectors with O(1) random index access' }
    ],
    exampleA: {
      language: 'java',
      code: `public class LinearSearchDemo {
    public static int linearSearch(int[] arr, int target) {
        // Scans sequentially: works on unsorted arrays
        for (int i = 0; i < arr.length; i++) {
            if (arr[i] == target) {
                return i; // Found at index i
            }
        }
        return -1; // Not found
    }

    public static void main(String[] args) {
        int[] unsorted = {42, 12, 88, 5, 23};
        System.out.println("Index of 5: " + linearSearch(unsorted, 5));
    }
}`,
      expectedOutput: `Index of 5: 3`,
      explanation: 'Linear search sequentially checking each element in an unsorted array.'
    },
    exampleB: {
      language: 'java',
      code: `public class BinarySearchDemo {
    public static int binarySearch(int[] sortedArr, int target) {
        int low = 0, high = sortedArr.length - 1;

        while (low <= high) {
            // Prevent integer overflow: low + (high - low) / 2
            int mid = low + (high - low) / 2;

            if (sortedArr[mid] == target) return mid;
            else if (sortedArr[mid] < target) low = mid + 1;
            else high = mid - 1;
        }
        return -1;
    }

    public static void main(String[] args) {
        int[] sorted = {5, 12, 23, 42, 88};
        System.out.println("Index of 42: " + binarySearch(sorted, 42));
    }
}`,
      expectedOutput: `Index of 42: 3`,
      explanation: 'Binary search halving the search space on a sorted array with overflow-safe midpoint.'
    },
    useCasesAndTradeoffs: {
      whenToUseA: 'Use Linear Search on small collections (N < 50), unsorted datasets where sorting overhead (O(N log N)) exceeds the search cost, or linked lists.',
      whenToUseB: 'Use Binary Search on large datasets that are already sorted or queried repeatedly where O(log N) speed provides massive performance gains.',
      tradeoffsSummary: 'Linear Search requires no preprocessing but scales poorly at O(N); Binary Search scales exceptionally at O(log N) but requires sorted data and random access.'
    },
    interviewSummary: 'Linear search checks elements sequentially with O(N) time complexity and works on both unsorted and sorted data. Binary search achieves O(log N) time complexity by repeatedly halving the search space, but it strictly requires the input array to be sorted upfront.',
    conciseConclusion: 'Linear search is flexible and requires no sorting for small or unsorted lists; binary search is orders of magnitude faster (O(log N)) for large sorted arrays.'
  };
}

// -----------------------------------------------------------------
// 8. Authentication vs Authorization (Security)
// -----------------------------------------------------------------

function getAuthnVsAuthzComparison(): ComparisonStructure {
  return {
    conceptAName: 'Authentication (AuthN)',
    conceptADefinition: 'Authentication is the security process of verifying the identity of a user, service, or system — answering the fundamental question: "Who are you?"',
    conceptBName: 'Authorization (AuthZ)',
    conceptBDefinition: 'Authorization is the security process of determining what specific resources, operations, or data an authenticated identity is permitted to access — answering: "What are you allowed to do?"',
    differencesInSentences: [
      {
        label: 'Core question',
        explanation: 'Authentication answers "Who is the user?", whereas Authorization answers "What permissions does this verified user possess?".'
      },
      {
        label: 'Execution sequence',
        explanation: 'Authentication always occurs first in the security pipeline; Authorization takes place only after the identity has been successfully validated.'
      },
      {
        label: 'Failure HTTP status code',
        explanation: 'Authentication failure returns HTTP 401 Unauthorized (unauthenticated caller), while Authorization failure returns HTTP 403 Forbidden (authenticated caller lacks required permissions).'
      },
      {
        label: 'Mechanisms used',
        explanation: 'Authentication relies on credentials such as passwords, OTPs, biometrics, or signed JWTs; Authorization relies on Role-Based Access Control (RBAC), Attribute-Based Access Control (ABAC), or OAuth scopes.'
      },
      {
        label: 'Tokens in modern architecture',
        explanation: 'In OAuth2/OIDC, an ID Token represents Authentication (asserting identity claims), while an Access Token represents Authorization (conveying scopes to API endpoints).'
      },
      {
        label: 'Management and mutability',
        explanation: 'Authentication credentials like passwords or biometrics are managed directly by the user, whereas authorization roles and permissions are defined and enforced internally by administrators or system policies.'
      }
    ],
    tableRows: [
      { dimension: 'Fundamental Question', conceptAValue: '"Who are you?" (Identity verification)', conceptBValue: '"What can you do?" (Permission verification)' },
      { dimension: 'Pipeline Order', conceptAValue: 'Step 1: Always executed first', conceptBValue: 'Step 2: Executed after authentication succeeds' },
      { dimension: 'Validation Factor', conceptAValue: 'Passwords, biometrics, 2FA/MFA, certificates, JWT signatures', conceptBValue: 'Roles (Admin/User), permissions, scopes, access control lists' },
      { dimension: 'HTTP Failure Code', conceptAValue: 'HTTP 401 Unauthorized', conceptBValue: 'HTTP 403 Forbidden' },
      { dimension: 'OAuth 2.0 / OIDC Role', conceptAValue: 'OpenID Connect (ID Token)', conceptBValue: 'OAuth 2.0 Access Token with scopes' },
      { dimension: 'Visibility to User', conceptAValue: 'User enters credentials on login form', conceptBValue: 'Handled internally by application policies' }
    ],
    exampleA: {
      language: 'typescript',
      code: `// Authentication Middleware: Verifies JWT signature and extracts user
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token (HTTP 401)' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = payload; // Identity verified: "Alice (role: EDITOR)"
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token (HTTP 401)' });
  }
}`,
      expectedOutput: `Valid token -> sets req.user and calls next()\nMissing/invalid token -> HTTP 401 Unauthorized`,
      explanation: 'Verifies caller credentials and attaches the authenticated user identity.'
    },
    exampleB: {
      language: 'typescript',
      code: `// Authorization Middleware: Checks if authenticated user has permission
export function authorizeRoles(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Requires that authenticate() ran first and populated req.user
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Forbidden: Insufficient privileges (HTTP 403)' 
      });
    }
    next(); // User is allowed to execute this action
  };
}

// Route requiring ADMIN role:
// app.delete('/api/users/:id', authenticate, authorizeRoles('ADMIN'), deleteUser);`,
      expectedOutput: `User with role 'EDITOR' accessing admin route -> HTTP 403 Forbidden\nUser with role 'ADMIN' -> Request proceeds`,
      explanation: 'Verifies that the authenticated user possesses the specific role required for the operation.'
    },
    useCasesAndTradeoffs: {
      whenToUseA: 'Use Authentication at the perimeter of your application or API gateway to establish identity before allowing any request through.',
      whenToUseB: 'Use Authorization at the resource or controller level to protect sensitive endpoints and verify that the user owns or can modify the data.',
      tradeoffsSummary: 'Authentication validates identity; Authorization enforces access boundaries. Both are required for a secure defense-in-depth system.'
    },
    interviewSummary: 'Authentication verifies the identity of the user, answering "Who are you?" using credentials like passwords or tokens and returning HTTP 401 on failure. Authorization determines what resources the verified user is allowed to access, answering "What can you do?" through roles or permissions and returning HTTP 403 on failure.',
    conciseConclusion: 'Authentication proves identity (HTTP 401); authorization checks permissions and roles (HTTP 403).'
  };
}

// -----------------------------------------------------------------
// 9. Heap vs Stack Memory (OS & Runtime)
// -----------------------------------------------------------------

function getHeapVsStackComparison(): ComparisonStructure {
  return {
    conceptAName: 'Stack Memory',
    conceptADefinition: 'Stack Memory is fast, contiguous, thread-private memory managed automatically by the CPU architecture in Last-In-First-Out (LIFO) order to store method call frames, local primitive variables, and references to heap objects.',
    conceptBName: 'Heap Memory',
    conceptBDefinition: 'Heap Memory is a dynamically allocated, shared memory space used to store all object instances, arrays, and global data across all threads in an application process, managed manually in C/C++ or automatically by a Garbage Collector in Java/Python.',
    differencesInSentences: [
      {
        label: 'Scope and concurrency',
        explanation: 'Stack memory is private to each individual thread, whereas Heap memory is globally shared across all threads in the application process.'
      },
      {
        label: 'Allocation and lifecycle',
        explanation: 'Stack memory is allocated and deallocated automatically when functions are called and return (LIFO order); Heap memory is allocated dynamically at runtime (`new` keyword) and reclaimed by the Garbage Collector.'
      },
      {
        label: 'Access speed',
        explanation: 'Stack memory access is extremely fast because of contiguous CPU cache locality and pointer bumping; Heap memory access is slower due to reference pointer indirection and fragmented memory locations.'
      },
      {
        label: 'Size and failure exceptions',
        explanation: 'Stack size is fixed and relatively small (typically 1MB per thread), failing with `StackOverflowError` on deep recursion; Heap size is much larger (several gigabytes), failing with `OutOfMemoryError` when allocation exhausts available RAM.'
      },
      {
        label: 'Stored content',
        explanation: 'Stack stores method execution frames, local primitive variables (e.g. `int`, `boolean`), and object reference addresses; Heap stores the actual object instances, instance fields, and arrays.'
      }
    ],
    tableRows: [
      { dimension: 'Scope', conceptAValue: 'Thread-private (each thread has its own stack)', conceptBValue: 'Shared across all threads in the process' },
      { dimension: 'Management', conceptAValue: 'Automatic by CPU/OS via LIFO call stack', conceptBValue: 'Garbage Collector (Java/JS) or manual malloc/free (C/C++)' },
      { dimension: 'Access Speed', conceptAValue: 'Extremely fast (contiguous CPU cache locality)', conceptBValue: 'Slower (pointer indirection and memory fragmentation)' },
      { dimension: 'Stored Data', conceptAValue: 'Call frames, local primitives, object reference pointers', conceptBValue: 'Actual object instances, arrays, class metadata' },
      { dimension: 'Typical Size', conceptAValue: 'Small (typically 512KB to 1MB per thread)', conceptBValue: 'Large (hundreds of MBs to many GBs)' },
      { dimension: 'Failure Mode', conceptAValue: '`java.lang.StackOverflowError`', conceptBValue: '`java.lang.OutOfMemoryError: Java heap space`' }
    ],
    exampleA: {
      language: 'java',
      code: `public class MemoryModelDemo {
    public static void compute(int a) {
        // 'a' and 'b' are allocated on the current thread's STACK frame
        int b = a * 2;
        System.out.println("Stack computed: " + b);
        // Popped from STACK automatically when method returns
    }

    public static void main(String[] args) {
        compute(10);
    }
}`,
      expectedOutput: `Stack computed: 20`,
      explanation: 'Demonstrates stack memory automatically allocating and deallocating local primitives.'
    },
    exampleB: {
      language: 'java',
      code: `public class HeapDemo {
    static class User {
        String name; // Stored inside User instance on HEAP
        User(String n) { this.name = n; }
    }

    public static void main(String[] args) {
        // 'u' is a reference on the STACK pointing to the object on the HEAP
        User u = new User("Alice");
        System.out.println("User name on heap: " + u.name);
        // Heap object remains until Garbage Collector reclaims it
    }
}`,
      expectedOutput: `User name on heap: Alice`,
      explanation: 'Demonstrates reference pointer on the stack pointing to an object instance on the heap.'
    },
    useCasesAndTradeoffs: {
      whenToUseA: 'Stack memory is used automatically for function calls, local calculations, and short-lived execution state.',
      whenToUseB: 'Heap memory is used for dynamic data structures, long-lived domain models, and shared data accessed across multiple functions or threads.',
      tradeoffsSummary: 'Stack memory provides deterministic, blazingly fast LIFO access with strict size limits; Heap memory provides dynamic sizing and shared access at the cost of Garbage Collection pauses.'
    },
    interviewSummary: 'Stack memory is fast, thread-private memory that automatically stores function call frames and local primitive variables in LIFO order, throwing StackOverflowError if exceeded. Heap memory is shared across all threads to store dynamic object instances, managed by the Garbage Collector, and throws OutOfMemoryError when exhausted.',
    conciseConclusion: 'Stack memory handles short-lived, thread-private function frames and primitives with ultra-fast LIFO access; heap memory holds shared dynamic objects and is managed by the Garbage Collector.'
  };
}

// -----------------------------------------------------------------
// 10. Deadlock & Coffman Conditions (OS Concurrency)
// -----------------------------------------------------------------

function getDeadlockVsCoffmanComparison(): ComparisonStructure {
  return {
    conceptAName: 'Deadlock',
    conceptADefinition: 'Deadlock is a permanent blocking condition in concurrent systems where two or more threads or processes are unable to proceed because each holds a lock on a resource that another thread requires, forming an unbreakable cycle of mutual dependency.',
    conceptBName: 'The 4 Coffman Conditions',
    conceptBDefinition: 'The Coffman conditions are the four necessary and sufficient requirements that must all hold simultaneously for a deadlock to occur: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait. Breaking any single condition prevents deadlock entirely.',
    differencesInSentences: [
      {
        label: 'Condition 1: Mutual Exclusion',
        explanation: 'At least one resource must be held in a non-shareable mode, meaning only one thread can hold or use the resource at any given time.'
      },
      {
        label: 'Condition 2: Hold and Wait',
        explanation: 'A thread must be actively holding at least one resource while waiting to acquire additional resources currently held by other threads.'
      },
      {
        label: 'Condition 3: No Preemption',
        explanation: 'Resources cannot be forcibly revoked or preempted from a thread; they can only be released voluntarily by the holding thread after completing its task.'
      },
      {
        label: 'Condition 4: Circular Wait',
        explanation: 'A closed chain of threads exists such that Thread A waits for a resource held by Thread B, and Thread B waits for a resource held by Thread A.'
      },
      {
        label: 'Prevention mechanism',
        explanation: 'Deadlock cannot occur if you break even ONE of the four conditions. In software engineering, the most common prevention technique is enforcing a strict global lock ordering, which eliminates Circular Wait.'
      }
    ],
    tableRows: [
      { dimension: 'Coffman Condition', conceptAValue: 'Underlying Requirement', conceptBValue: 'Defensive Engineering Strategy to Break It' },
      { dimension: '1. Mutual Exclusion', conceptAValue: 'Resource is exclusively held by one thread', conceptBValue: 'Use lock-free data structures (e.g. AtomicInteger, read-write locks)' },
      { dimension: '2. Hold and Wait', conceptAValue: 'Thread holds resource A while waiting for resource B', conceptBValue: 'Acquire all required resources simultaneously upfront, or release A before requesting B' },
      { dimension: '3. No Preemption', conceptAValue: 'OS/runtime cannot forcibly confiscate held lock', conceptBValue: 'Use `tryLock()` with timeout; release held locks on timeout' },
      { dimension: '4. Circular Wait', conceptAValue: 'Thread 1 -> Lock A -> Lock B; Thread 2 -> Lock B -> Lock A', conceptBValue: 'Enforce strict global lock acquisition ordering across entire codebase' }
    ],
    exampleA: {
      language: 'java',
      code: `// Classic 2-Thread Deadlock Demonstration
public class DeadlockDemo {
    private static final Object lockA = new Object();
    private static final Object lockB = new Object();

    public static void main(String[] args) {
        // Thread 1: Acquires Lock A, then tries to acquire Lock B
        new Thread(() -> {
            synchronized (lockA) {
                try { Thread.sleep(50); } catch (InterruptedException e) {}
                synchronized (lockB) { System.out.println("Thread 1 finished"); }
            }
        }).start();

        // Thread 2: Acquires Lock B, then tries to acquire Lock A -> DEADLOCK!
        new Thread(() -> {
            synchronized (lockB) {
                try { Thread.sleep(50); } catch (InterruptedException e) {}
                synchronized (lockA) { System.out.println("Thread 2 finished"); }
            }
        }).start();
    }
}`,
      expectedOutput: `[Program hangs indefinitely: Thread 1 holds Lock A waiting for B; Thread 2 holds Lock B waiting for A]`,
      explanation: 'Illustrates the classic Circular Wait condition causing permanent thread starvation.'
    },
    exampleB: {
      language: 'java',
      code: `// Deadlock Fix: Enforce Strict Global Lock Ordering (Breaks Circular Wait)
public class DeadlockResolved {
    private static final Object lockA = new Object();
    private static final Object lockB = new Object();

    public static void main(String[] args) {
        // Both threads ALWAYS acquire Lock A BEFORE Lock B
        Runnable task = () -> {
            synchronized (lockA) { // Always Lock A first
                synchronized (lockB) { // Always Lock B second
                    System.out.println(Thread.currentThread().getName() + " acquired both locks safely");
                }
            }
        };

        new Thread(task, "Thread-1").start();
        new Thread(task, "Thread-2").start();
    }
}`,
      expectedOutput: `Thread-1 acquired both locks safely\nThread-2 acquired both locks safely`,
      explanation: 'Demonstrates eliminating Circular Wait by enforcing consistent lock acquisition order.'
    },
    useCasesAndTradeoffs: {
      whenToUseA: 'Detect deadlock in production using JVM thread dumps (`jcmd <pid> Thread.dump_to_file` or `jstack`) to locate blocked lock monitors.',
      whenToUseB: 'Apply Coffman condition elimination during system design: use lock ordering or `ReentrantLock.tryLock(timeout)` to prevent circular dependencies.',
      tradeoffsSummary: 'Fine-grained locks increase concurrency but increase deadlock vulnerability; strict lock ordering eliminates deadlock at the cost of disciplined code design.'
    },
    interviewSummary: 'A deadlock occurs when concurrent threads are blocked forever because each holds a resource that another thread needs. Deadlock requires four simultaneous Coffman conditions: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait. The most practical engineering solution is enforcing a strict global lock acquisition ordering to break the Circular Wait condition.',
    conciseConclusion: 'Deadlock is a circular lock dependency; breaking any of the four Coffman conditions (especially Circular Wait via lock ordering) prevents deadlock entirely.'
  };
}

// -----------------------------------------------------------------
// 11. Checked vs Unchecked Exceptions (Java)
// -----------------------------------------------------------------

function getCheckedVsUncheckedExceptionComparison(): ComparisonStructure {
  return {
    conceptAName: 'Checked Exceptions (Java)',
    conceptADefinition: 'Checked Exceptions are exceptions that inherit directly from `java.lang.Exception` (excluding `RuntimeException`). The Java compiler strictly enforces that they must either be caught in a `try-catch` block or declared in the method signature using the `throws` keyword.',
    conceptBName: 'Unchecked Exceptions (Java)',
    conceptBDefinition: 'Unchecked Exceptions are exceptions that inherit from `java.lang.RuntimeException` or `java.lang.Error`. The Java compiler does not enforce handling or declaring them, and they typically signify programmer logic bugs or unrecoverable system failures.',
    differencesInSentences: [
      {
        label: 'Compiler enforcement',
        explanation: 'Checked exceptions are verified at compile time (code fails to compile if unhandled), whereas unchecked exceptions are not verified by the compiler.'
      },
      {
        label: 'Class hierarchy',
        explanation: 'Checked exceptions extend `java.lang.Exception` directly, while unchecked exceptions extend `java.lang.RuntimeException` or `java.lang.Error`.'
      },
      {
        label: 'Intended purpose',
        explanation: 'Checked exceptions represent recoverable external conditions outside the program\'s direct control (e.g. missing file, network timeout, database error); unchecked exceptions represent preventable programming flaws (e.g. null pointer, invalid index).'
      },
      {
        label: 'Signature clutter',
        explanation: 'Checked exceptions force callers to propagate `throws` clauses up the call chain or write boilerplate try-catch blocks; unchecked exceptions keep method signatures clean.'
      },
      {
        label: 'Modern framework trend',
        explanation: 'Modern Java frameworks (such as Spring Boot and Hibernate) wrap low-level checked exceptions into unchecked runtime exceptions (e.g. `DataAccessException`) to reduce boilerplate.'
      }
    ],
    tableRows: [
      { dimension: 'Compile-Time Check', conceptAValue: 'Strictly checked by compiler (mandatory try/catch or throws)', conceptBValue: 'Ignored by compiler (handling is optional)' },
      { dimension: 'Class Inheritance', conceptAValue: 'Extends `java.lang.Exception` (excluding RuntimeException)', conceptBValue: 'Extends `java.lang.RuntimeException` or `java.lang.Error`' },
      { dimension: 'Typical Root Cause', conceptAValue: 'External, recoverable environmental failure', conceptBValue: 'Internal programmer coding defect or logical bug' },
      { dimension: 'Common Examples', conceptAValue: '`IOException`, `SQLException`, `FileNotFoundException`', conceptBValue: '`NullPointerException`, `ArrayIndexOutOfBoundsException`, `IllegalArgumentException`' },
      { dimension: 'Recovery Expectation', conceptAValue: 'Caller is reasonably expected to handle or recover', conceptBValue: 'Application should fail fast; code defect needs fixing' },
      { dimension: 'Method Signature', conceptAValue: 'Must declare `throws MyException` if uncaught', conceptBValue: 'No signature declaration required' }
    ],
    exampleA: {
      language: 'java',
      code: `import java.io.FileReader;
import java.io.FileNotFoundException;

public class CheckedExceptionDemo {
    // Compiler FORCES method to declare 'throws' or handle in try-catch
    public static void readFile(String path) throws FileNotFoundException {
        FileReader reader = new FileReader(path);
    }

    public static void main(String[] args) {
        try {
            readFile("nonexistent.txt");
        } catch (FileNotFoundException e) {
            System.out.println("Recovered from checked exception: " + e.getMessage());
        }
    }
}`,
      expectedOutput: `Recovered from checked exception: nonexistent.txt (No such file or directory)`,
      explanation: 'Demonstrates compile-time requirement to either catch or declare checked exceptions.'
    },
    exampleB: {
      language: 'java',
      code: `public class UncheckedExceptionDemo {
    // No 'throws' declaration needed in method signature!
    public static int parseAge(String input) {
        if (input == null) {
            throw new NullPointerException("Input age string cannot be null");
        }
        int age = Integer.parseInt(input);
        if (age < 0) {
            throw new IllegalArgumentException("Age cannot be negative: " + age);
        }
        return age;
    }

    public static void main(String[] args) {
        // Will throw IllegalArgumentException at runtime without compiler complaint
        parseAge("-5");
    }
}`,
      expectedOutput: `Exception in thread "main" java.lang.IllegalArgumentException: Age cannot be negative: -5`,
      explanation: 'Demonstrates unchecked runtime exception indicating invalid programmer argument.'
    },
    useCasesAndTradeoffs: {
      whenToUseA: 'Use checked exceptions for external conditions where the calling client can realistically recover (e.g., retrying an API call or prompting for an alternate file path).',
      whenToUseB: 'Use unchecked exceptions for preconditions, validation failures, and programming bugs where the code itself must be corrected.',
      tradeoffsSummary: 'Checked exceptions force upfront error handling at the cost of verbose signatures; unchecked exceptions maintain clean architecture but require diligent unit testing.'
    },
    interviewSummary: 'Checked exceptions extend Exception and are verified at compile time, requiring either a try-catch block or a throws declaration for recoverable external issues like IOException. Unchecked exceptions extend RuntimeException and are not checked by the compiler, representing programming bugs like NullPointerException or IllegalArgumentException.',
    conciseConclusion: 'Checked exceptions are compile-time enforced for recoverable external errors; unchecked exceptions extend RuntimeException and represent programming bugs.'
  };
}

// -----------------------------------------------------------------
// 12. PostgreSQL vs MongoDB
// -----------------------------------------------------------------

function getPostgresVsMongoComparison(): ComparisonStructure {
  return {
    conceptAName: 'PostgreSQL',
    conceptADefinition: 'PostgreSQL is an advanced, open-source object-relational database management system (ORDBMS) emphasizing strict ACID transactions, complex relational joins, schema enforcement, and SQL compliance.',
    conceptBName: 'MongoDB',
    conceptBDefinition: 'MongoDB is a leading document-oriented NoSQL database that stores data in flexible, schema-free JSON-like BSON documents, designed for horizontal scalability, high write throughput, and rapid schema evolution.',
    differencesInSentences: [
      {
        label: 'Data model',
        explanation: 'PostgreSQL organizes data into fixed tabular rows and columns with strict relational foreign key constraints, whereas MongoDB stores data in hierarchical, semi-structured BSON documents.'
      },
      {
        label: 'Schema flexibility',
        explanation: 'PostgreSQL enforces a predefined schema with rigid data types (though it supports JSONB), whereas MongoDB allows dynamic schemas where documents in the same collection can contain different fields.'
      },
      {
        label: 'Scalability architecture',
        explanation: 'PostgreSQL scales primarily vertically with read-replicas for reads, whereas MongoDB was engineered for native horizontal sharding across distributed clusters.'
      },
      {
        label: 'Query language and joins',
        explanation: 'PostgreSQL uses standard declarative SQL with fast relational JOIN operations, whereas MongoDB uses an object-oriented query API and Aggregation Framework pipelines.'
      },
      {
        label: 'Transaction guarantees',
        explanation: 'PostgreSQL provides robust multi-table ACID transactions by default with configurable isolation levels; MongoDB supports multi-document transactions but excels at single-document atomic operations.'
      }
    ],
    tableRows: [
      { dimension: 'Data Model', conceptAValue: 'Relational (Tables, Rows, Columns)', conceptBValue: 'Document-oriented (Collections, BSON documents)' },
      { dimension: 'Schema Enforcement', conceptAValue: 'Strict schema declared upfront via DDL', conceptBValue: 'Flexible dynamic schema (schema-optional)' },
      { dimension: 'Query Language', conceptAValue: 'Standard ANSI SQL with CTEs and Window Functions', conceptBValue: 'MQL (MongoDB Query Language) & Aggregation Pipelines' },
      { dimension: 'Join Performance', conceptAValue: 'Exceptional (optimized Hash, Merge, Nested Loop Joins)', conceptBValue: 'Limited ($lookup stage; prefers denormalized embedding)' },
      { dimension: 'ACID Guarantees', conceptAValue: 'Strict ACID compliance by default', conceptBValue: 'Single-document atomicity; multi-document ACID available' },
      { dimension: 'Horizontal Scaling', conceptAValue: 'Primary-Replica; sharding requires Citus extension', conceptBValue: 'Native automatic horizontal sharding built-in' }
    ],
    exampleA: {
      language: 'sql',
      code: `-- PostgreSQL: Relational Normalized Schema with Foreign Key
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    total DECIMAL(10, 2) NOT NULL
);

-- Fast declarative relational JOIN
SELECT u.name, o.total 
FROM users u 
JOIN orders o ON u.id = o.user_id;`,
      expectedOutput: `  name  | total  \n--------+--------\n Alice  | 149.99`,
      explanation: 'Normalized relational schema with foreign key integrity and SQL JOIN query.'
    },
    exampleB: {
      language: 'javascript',
      code: `// MongoDB: Embedded Document Pattern in BSON
db.users.insertOne({
  name: "Alice",
  email: "alice@example.com",
  orders: [
    { orderId: "ord_101", total: 149.99, date: new Date() }
  ]
});

// Single-document atomic lookup without JOINs
db.users.findOne({ email: "alice@example.com" });`,
      expectedOutput: `{\n  "_id": ObjectId("65e01..."),\n  "name": "Alice",\n  "orders": [{ "orderId": "ord_101", "total": 149.99 }]\n}`,
      explanation: 'Denormalized document embedding orders directly inside the user document.'
    },
    useCasesAndTradeoffs: {
      whenToUseA: 'Use PostgreSQL for financial systems, enterprise ERPs, complex relational analytics, and applications requiring strict ACID compliance.',
      whenToUseB: 'Use MongoDB for content management, IoT time-series catalogs, mobile app backends with rapidly evolving schemas, and horizontally partitioned workloads.',
      tradeoffsSummary: 'PostgreSQL provides referential integrity and advanced relational querying at the cost of rigid migrations; MongoDB provides agile schema iteration and sharding at the cost of manual referential integrity.'
    },
    interviewSummary: 'PostgreSQL is a relational database prioritizing strict ACID transactions, complex SQL joins, and schema enforcement. MongoDB is a document database storing flexible BSON documents that favors rapid schema evolution and horizontal sharding.',
    conciseConclusion: 'Choose PostgreSQL for structured relational data and strict transaction integrity; choose MongoDB for hierarchical documents and dynamic schemas.'
  };
}

// -----------------------------------------------------------------
// 13. Process vs Thread (OS)
// -----------------------------------------------------------------

function getProcessVsThreadComparison(): ComparisonStructure {
  return {
    conceptAName: 'Process',
    conceptADefinition: 'A Process is an independent executing program instance that has its own dedicated address space, memory segments (code, data, heap, stack), file descriptors, and operating system security context.',
    conceptBName: 'Thread',
    conceptBDefinition: 'A Thread is the smallest schedulable unit of CPU execution within a process, often termed a lightweight process. Multiple threads within the same process share the heap, data, and open file descriptors while maintaining private stacks and program counters.',
    differencesInSentences: [
      {
        label: 'Memory isolation',
        explanation: 'Each process has its own isolated virtual address space protected by the OS MMU, whereas threads belonging to the same process share the same heap, data segment, and code.'
      },
      {
        label: 'Creation and context-switching overhead',
        explanation: 'Creating a process is heavy and requires page table duplication, while creating a thread is lightweight. Process context switches require TLB flushes, while thread switches only preserve CPU registers and stack pointer.'
      },
      {
        label: 'Communication mechanism',
        explanation: 'Processes must communicate through Inter-Process Communication (IPC) such as Unix sockets, pipes, or shared memory. Threads communicate directly by reading and writing shared variables on the heap.'
      },
      {
        label: 'Failure blast radius',
        explanation: 'If a process crashes (e.g. segmentation fault), other processes are completely unaffected. If a thread crashes unexpectedly or corrupts shared memory, it can bring down the entire process.'
      },
      {
        label: 'Synchronization requirement',
        explanation: 'Threads require explicit synchronization mechanisms (locks, semaphores, mutexes) to prevent race conditions on shared memory; processes are naturally isolated.'
      },
      {
        label: 'Resource dependency and lifecycle',
        explanation: 'A process can exist independently and must have at least one thread to execute, whereas threads cannot exist without an enclosing parent process and terminate when the parent process exits.'
      }
    ],
    tableRows: [
      { dimension: 'Memory Space', conceptAValue: 'Private, isolated virtual address space', conceptBValue: 'Shares heap, data, and code with sibling threads' },
      { dimension: 'Creation Overhead', conceptAValue: 'Heavy (allocates PCB, page tables, memory maps)', conceptBValue: 'Lightweight (shares existing process resources)' },
      { dimension: 'Context Switching Speed', conceptAValue: 'Slow (incurs MMU context switch & TLB cache flush)', conceptBValue: 'Fast (switches CPU registers and stack pointer only)' },
      { dimension: 'Communication', conceptAValue: 'Requires IPC (Sockets, Pipes, Message Queues)', conceptBValue: 'Direct memory sharing (synchronized via Mutex/Locks)' },
      { dimension: 'Fault Tolerance', conceptAValue: 'High: Crash of one process does not kill others', conceptBValue: 'Low: Uncaught crash in one thread can terminate process' }
    ],
    exampleA: {
      language: 'c',
      code: `// C: Creating a separate isolated Process via fork()
#include <stdio.h>
#include <unistd.h>

int main() {
    int shared_val = 100;
    pid_t pid = fork();

    if (pid == 0) {
        // Child Process: Separate memory space
        shared_val += 50;
        printf("Child Process shared_val = %d\\n", shared_val);
    } else {
        // Parent Process: Unchanged memory
        sleep(1);
        printf("Parent Process shared_val = %d\\n", shared_val);
    }
    return 0;
}`,
      expectedOutput: `Child Process shared_val = 150\nParent Process shared_val = 100`,
      explanation: 'Shows copy-on-write memory isolation: child modification does not affect parent memory.'
    },
    exampleB: {
      language: 'java',
      code: `// Java: Threads sharing the exact same memory heap
public class ThreadDemo {
    static int sharedCounter = 0;

    public static void main(String[] args) throws InterruptedException {
        Thread t1 = new Thread(() -> {
            for (int i = 0; i < 1000; i++) sharedCounter++;
        });

        Thread t2 = new Thread(() -> {
            for (int i = 0; i < 1000; i++) sharedCounter++;
        });

        t1.start(); t2.start();
        t1.join(); t2.join();
        System.out.println("Final Shared Counter: " + sharedCounter);
    }
}`,
      expectedOutput: `Final Shared Counter: 2000 (or race condition if unsynchronized)`,
      explanation: 'Shows threads concurrently reading and modifying the same shared memory variable.'
    },
    useCasesAndTradeoffs: {
      whenToUseA: 'Use separate processes for maximum security isolation, independent microservices, or untrusted plugin execution (e.g. Chrome browser tabs).',
      whenToUseB: 'Use threads for high-throughput, low-latency concurrent tasks within an application that share common cache state (e.g. web server request handlers).',
      tradeoffsSummary: 'Processes provide bulletproof memory isolation at the cost of high creation and context-switch latency; threads provide lightweight speed at the risk of concurrency bugs.'
    },
    interviewSummary: 'In modern operating systems, a process is an independent executing program with its own private virtual memory address space, file descriptors, and security context. In contrast, a thread is the smallest schedulable execution unit within a process, often described as a lightweight process. The primary architectural distinction is memory isolation: processes are completely isolated from each other and must use inter-process communication like sockets or pipes to share data, whereas threads within the same process share the heap, global variables, and open files, maintaining only their own private call stacks and program counters. Creating and context-switching between threads is significantly faster with lower CPU overhead than switching between processes, but an unhandled crash or race condition in one thread can corrupt shared memory and terminate the entire parent process.',
    conciseConclusion: 'Processes isolate memory and communicate via IPC; threads share process memory and communicate via shared heap variables with synchronization.'
  };
}

// -----------------------------------------------------------------
// 14. TCP vs UDP (Networking)
// -----------------------------------------------------------------

function getTcpVsUdpComparison(): ComparisonStructure {
  return {
    conceptAName: 'TCP (Transmission Control Protocol)',
    conceptADefinition: 'TCP is a connection-oriented, reliable transport-layer protocol that guarantees ordered, error-checked delivery of a stream of octets between applications running on hosts communicating via an IP network.',
    conceptBName: 'UDP (User Datagram Protocol)',
    conceptBDefinition: 'UDP is a connectionless, lightweight transport-layer protocol that sends discrete datagrams with minimal protocol overhead, without guaranteeing delivery, ordering, or duplicate protection.',
    differencesInSentences: [
      {
        label: 'Connection establishment',
        explanation: 'TCP is connection-oriented and requires a 3-way handshake (SYN, SYN-ACK, ACK) before data transmission begins, whereas UDP is connectionless and transmits datagrams immediately without any connection setup.'
      },
      {
        label: 'Reliability and recovery',
        explanation: 'TCP provides reliable, guaranteed delivery by requiring acknowledgments (ACKs) and automatically retransmitting lost packets, whereas UDP is "fire-and-forget" with zero retransmission.'
      },
      {
        label: 'Packet ordering',
        explanation: 'TCP uses sequence numbers to reconstruct packets in exact order at the receiver; UDP delivers packets out-of-order as they arrive across the network.'
      },
      {
        label: 'Congestion and flow control',
        explanation: 'TCP incorporates sophisticated flow control (sliding window) and congestion control algorithms (CUBIC, BBR) to avoid network collapse; UDP transmits at whatever rate the application provides.'
      },
      {
        label: 'Header overhead',
        explanation: 'TCP has a 20-to-60 byte header with extensive flags; UDP has a minimal fixed 8-byte header.'
      },
      {
        label: 'Speed and practical use cases',
        explanation: 'TCP has higher latency due to handshakes and acknowledgments, making it ideal for web browsing, APIs, and file transfers where accuracy is vital; UDP is much faster with minimal latency, making it the preferred choice for real-time applications like video streaming, gaming, and DNS lookup.'
      }
    ],
    tableRows: [
      { dimension: 'Connection Mode', conceptAValue: 'Connection-oriented (requires 3-way handshake)', conceptBValue: 'Connectionless (transmits datagrams immediately)' },
      { dimension: 'Reliability', conceptAValue: 'Guaranteed (packet acknowledgments and retransmission)', conceptBValue: 'Best-effort (lost packets are dropped)' },
      { dimension: 'Ordering', conceptAValue: 'Strictly ordered via packet sequence numbers', conceptBValue: 'Unordered (packets arrive as network routes them)' },
      { dimension: 'Header Size', conceptAValue: '20 to 60 bytes', conceptBValue: '8 bytes' },
      { dimension: 'Flow & Congestion Control', conceptAValue: 'Yes (Sliding Window, Slow Start, Congestion Avoidance)', conceptBValue: 'None (no rate throttling)' },
      { dimension: 'Protocol Examples', conceptAValue: 'HTTP/HTTPS, SSH, FTP, SMTP, PostgreSQL', conceptBValue: 'DNS, VoIP, Live Video Streaming, Online Gaming, QUIC/HTTP/3' }
    ],
    exampleA: {
      language: 'typescript',
      code: `// Node.js TCP Client: Guaranteed reliable stream
import net from 'net';

const client = net.createConnection({ port: 8080 }, () => {
  console.log('TCP 3-Way Handshake Complete: Connected');
  client.write('CRITICAL: Transfer $500 to Account B\\n');
});

client.on('data', (data) => {
  console.log('Server Confirmed:', data.toString());
  client.end();
});`,
      expectedOutput: `TCP 3-Way Handshake Complete: Connected\nServer Confirmed: ACK: Transaction 500 Committed`,
      explanation: 'TCP establishing connection and guaranteeing zero packet loss for financial transactions.'
    },
    exampleB: {
      language: 'typescript',
      code: `// Node.js UDP Client: Low-latency datagram broadcast
import dgram from 'dgram';

const socket = dgram.createSocket('udp4');
const telemetry = Buffer.from(JSON.stringify({ x: 120.4, y: 88.1, fps: 60 }));

// Fire-and-forget: Zero handshake latency
socket.send(telemetry, 41234, 'localhost', () => {
  console.log('UDP telemetry packet transmitted');
  socket.close();
});`,
      expectedOutput: `UDP telemetry packet transmitted`,
      explanation: 'UDP transmitting real-time coordinates where speed matters more than resending stale dropped frames.'
    },
    useCasesAndTradeoffs: {
      whenToUseA: 'Use TCP whenever data integrity and completeness are paramount: web browsing, file downloads, banking, email, and relational database connections.',
      whenToUseB: 'Use UDP when real-time low latency is critical and dropped packets are preferable to buffering delays: live audio/video calls (Zoom/WebRTC), multiplayer gaming, and DNS lookups.',
      tradeoffsSummary: 'TCP guarantees correctness and order at the cost of head-of-line blocking and handshake latency; UDP maximizes throughput and speed at the cost of unreliability.'
    },
    interviewSummary: 'TCP is a connection-oriented transport layer protocol that guarantees reliable, in-order packet delivery using a three-way handshake, sequence numbers, and packet acknowledgments. In contrast, UDP is a connectionless, lightweight transport protocol that transmits independent datagrams without establishing a handshake or verifying receipt. The primary distinction is that TCP provides error checking, automatic retransmission of lost packets, and flow control at the cost of higher latency and header overhead, whereas UDP sends packets immediately with minimal latency and zero delivery guarantees. In practice, use TCP for applications where data accuracy is critical, such as HTTP web traffic, email, and financial transactions, and use UDP for real-time systems where low latency matters more than lost packets, such as live video streaming, voice calls, and multiplayer gaming.',
    conciseConclusion: 'Use TCP when every packet must arrive reliably and in order; use UDP when speed and low latency matter more than lost packets.'
  };
}

// -----------------------------------------------------------------
// 15. Interface vs Abstract Class (Java / OOP)
// -----------------------------------------------------------------

function getInterfaceVsAbstractClassComparison(): ComparisonStructure {
  return {
    conceptAName: 'Interface (Java)',
    conceptADefinition: 'An Interface in Java is an abstract blueprint of a contract that defines what a class can do without dictating how it does it. A class can implement multiple interfaces, enabling multiple behavioral inheritance.',
    conceptBName: 'Abstract Class (Java)',
    conceptBDefinition: 'An Abstract Class is a class that cannot be instantiated on its own and serves as a common base class for related subclasses. It can hold state (instance fields), constructors, and concrete method implementations.',
    differencesInSentences: [
      {
        label: 'Multiple inheritance',
        explanation: 'A Java class can implement multiple interfaces, whereas a class can extend only one single abstract class.'
      },
      {
        label: 'Instance state',
        explanation: 'An abstract class can declare non-static, mutable instance fields; an interface can only contain `public static final` constants.'
      },
      {
        label: 'Constructors',
        explanation: 'An abstract class can have constructors invoked by subclasses via `super()`; an interface cannot have constructors.'
      },
      {
        label: 'Method implementations',
        explanation: 'An abstract class can have any mix of abstract, concrete, protected, or final methods; interfaces traditionally hold abstract methods, but can include `default` and `static` methods since Java 8.'
      },
      {
        label: 'Design philosophy',
        explanation: 'Use an abstract class for an "is-a" relationship sharing common code and state; use an interface for a "can-do" peripheral capability shared across unrelated classes.'
      }
    ],
    tableRows: [
      { dimension: 'Inheritance Limit', conceptAValue: 'Multiple (`implements A, B, C`)', conceptBValue: 'Single (`extends BaseClass` only)' },
      { dimension: 'State / Fields', conceptAValue: 'Constants only (`public static final`)', conceptBValue: 'Can have instance variables (private, protected, etc.)' },
      { dimension: 'Constructors', conceptAValue: 'Cannot have constructors', conceptBValue: 'Can have constructors called via `super()`' },
      { dimension: 'Access Modifiers', conceptAValue: 'Methods are public by default', conceptBValue: 'Full access modifiers (public, protected, package-private)' },
      { dimension: 'Relationship Model', conceptAValue: '"Can-Do" peripheral capability (e.g. `Serializable`, `Comparable`)', conceptBValue: '"Is-A" core identity hierarchy (e.g. `Vehicle -> Car`)' }
    ],
    exampleA: {
      language: 'java',
      code: `// Interface: Defines contract capability
public interface Flyable {
    void fly(); // Abstract contract

    // Default method (since Java 8)
    default void cruise() {
        System.out.println("Cruising at altitude");
    }
}

public class Drone implements Flyable {
    @Override
    public void fly() {
        System.out.println("Drone flying via quad-rotors");
    }
}`,
      expectedOutput: `Drone flying via quad-rotors\nCruising at altitude`,
      explanation: 'Demonstrates interface defining a capability that unrelated classes can implement.'
    },
    exampleB: {
      language: 'java',
      code: `// Abstract Class: Holds common state and constructor
public abstract class Vehicle {
    protected String vin; // Instance field holding state

    public Vehicle(String vin) {
        this.vin = vin; // Constructor for subclass reuse
    }

    public abstract void drive(); // Abstract method

    public void displayVin() {
        System.out.println("VIN: " + vin);
    }
}

public class Car extends Vehicle {
    public Car(String vin) { super(vin); }
    @Override public void drive() { System.out.println("Car driving on road"); }
}`,
      expectedOutput: `VIN: 1HGCR2F83HA\nCar driving on road`,
      explanation: 'Demonstrates abstract class providing shared constructor, mutable state, and base methods.'
    },
    useCasesAndTradeoffs: {
      whenToUseA: 'Use an interface to define a common capability across completely unrelated classes (e.g., `Comparable`, `AutoCloseable`), or to decouple APIs for unit testing.',
      whenToUseB: 'Use an abstract class when closely related classes share substantial common implementation logic, non-constant state, or require constructor initialization.',
      tradeoffsSummary: 'Interfaces offer maximum flexibility with multiple inheritance; abstract classes provide shared mutable state and code reuse at the cost of consuming a subclass\'s single inheritance slot.'
    },
    interviewSummary: 'In Java and object-oriented programming, an interface defines a contract of capabilities that any class can implement, whereas an abstract class serves as an incomplete base class designed to be extended through class inheritance. The most critical architectural distinction is multiple inheritance: a class can implement multiple interfaces simultaneously, but can extend only a single abstract class due to single inheritance. Furthermore, abstract classes can declare constructors and maintain mutable instance fields, whereas interfaces cannot have constructors or instance state, supporting only public static final constants and default or static methods. In software design, use an interface to define a common capability across unrelated classes, and use an abstract class when creating a closely related family of classes that share common code, internal state, and constructor initialization.',
    conciseConclusion: 'Use an interface for "can-do" capabilities and multiple inheritance; use an abstract class for "is-a" hierarchies sharing state and constructor logic.'
  };
}

// -----------------------------------------------------------------
// 16. Stack vs Queue (DSA)
// -----------------------------------------------------------------

function getStackVsQueueComparison(): ComparisonStructure {
  return {
    conceptAName: 'Stack (DSA)',
    conceptADefinition: 'A Stack is a linear data structure that follows the Last-In, First-Out (LIFO) principle, where elements are inserted and removed from the exact same end, known as the top.',
    conceptBName: 'Queue (DSA)',
    conceptBDefinition: 'A Queue is a linear data structure that follows the First-In, First-Out (FIFO) principle, where elements are inserted at the back (rear/enqueue) and removed from the front (head/dequeue).',
    differencesInSentences: [
      {
        label: 'Ordering principle',
        explanation: 'A Stack operates on LIFO (Last-In, First-Out), while a Queue operates on FIFO (First-In, First-Out).'
      },
      {
        label: 'Access points',
        explanation: 'A Stack has a single access point (the top) for both push and pop operations; a Queue has two separate access points: the rear for insertion and the front for deletion.'
      },
      {
        label: 'Algorithmic applications',
        explanation: 'Stacks are used in Depth-First Search (DFS), expression parsing, undo/redo buffers, and function call frames. Queues are used in Breadth-First Search (BFS), task scheduling, and message brokers.'
      },
      {
        label: 'Operation names',
        explanation: 'Stack operations are `push()` and `pop()`; standard Queue operations are `enqueue()` and `dequeue()`.'
      }
    ],
    tableRows: [
      { dimension: 'Order Principle', conceptAValue: 'LIFO (Last-In, First-Out)', conceptBValue: 'FIFO (First-In, First-Out)' },
      { dimension: 'Access Endpoints', conceptAValue: 'One end (Top)', conceptBValue: 'Two ends (Rear for insert, Front for remove)' },
      { dimension: 'Core Operations', conceptAValue: '`push()` / `pop()` / `peek()`', conceptBValue: '`enqueue()` / `dequeue()` / `peek()`' },
      { dimension: 'Graph Traversal', conceptAValue: 'Depth-First Search (DFS)', conceptBValue: 'Breadth-First Search (BFS)' },
      { dimension: 'Real-World Analog', conceptAValue: 'Stack of plates or browser back button', conceptBValue: 'Queue of people at a ticket counter or printer spooler' }
    ],
    exampleA: {
      language: 'java',
      code: `import java.util.ArrayDeque;
import java.util.Deque;

public class StackDemo {
    public static void main(String[] args) {
        // Modern Java recommendation: use ArrayDeque as Stack
        Deque<String> stack = new ArrayDeque<>();
        stack.push("Page A");
        stack.push("Page B");
        stack.push("Page C");

        System.out.println("Popped (LIFO): " + stack.pop());
        System.out.println("Current Top: " + stack.peek());
    }
}`,
      expectedOutput: `Popped (LIFO): Page C\nCurrent Top: Page B`,
      explanation: 'Shows LIFO behavior where the last item pushed ("Page C") is the first popped.'
    },
    exampleB: {
      language: 'java',
      code: `import java.util.ArrayDeque;
import java.util.Queue;

public class QueueDemo {
    public static void main(String[] args) {
        Queue<String> queue = new ArrayDeque<>();
        queue.offer("Customer 1");
        queue.offer("Customer 2");
        queue.offer("Customer 3");

        System.out.println("Polled (FIFO): " + queue.poll());
        System.out.println("Next in line: " + queue.peek());
    }
}`,
      expectedOutput: `Polled (FIFO): Customer 1\nNext in line: Customer 2`,
      explanation: 'Shows FIFO behavior where the first item queued ("Customer 1") is the first processed.'
    },
    useCasesAndTradeoffs: {
      whenToUseA: 'Use a Stack for backtrack problems, syntax parsing, matching parentheses, and depth-first exploration.',
      whenToUseB: 'Use a Queue for rate-limiting buffers, breadth-first level-order traversal, print job spooling, and async event queues.',
      tradeoffsSummary: 'Both provide O(1) constant time insertion and removal; choice depends strictly on whether your workload requires LIFO recency or FIFO fairness.'
    },
    interviewSummary: 'A Stack follows the Last-In, First-Out (LIFO) principle operating on a single top endpoint, used for DFS and recursion. A Queue follows the First-In, First-Out (FIFO) principle with separate insertion and removal endpoints, used for BFS and asynchronous message processing.',
    conciseConclusion: 'Use a stack for LIFO order (DFS, backtracks); use a queue for FIFO order (BFS, task processing).'
  };
}

// -----------------------------------------------------------------
// 17. REST vs GraphQL
// -----------------------------------------------------------------

function getRestVsGraphQlComparison(): ComparisonStructure {
  return {
    conceptAName: 'REST (Representational State Transfer)',
    conceptADefinition: 'REST is an architectural style for networked hypermedia applications that exposes fixed resource endpoints identified by URIs, using standard HTTP verbs (GET, POST, PUT, DELETE) and status codes.',
    conceptBName: 'GraphQL',
    conceptBDefinition: 'GraphQL is a query language and server runtime developed by Meta that exposes a single endpoint with a strongly typed schema, allowing clients to request exactly the fields they need in a single round trip.',
    differencesInSentences: [
      {
        label: 'Endpoint architecture',
        explanation: 'REST exposes multiple fixed resource endpoints (e.g. `/users`, `/orders`), whereas GraphQL operates through a single endpoint (typically `/graphql`).'
      },
      {
        label: 'Data fetching control',
        explanation: 'REST servers return a fixed payload structure that often causes over-fetching or under-fetching; GraphQL allows clients to specify the exact fields required.'
      },
      {
        label: 'Network round trips',
        explanation: 'Fetching related entities in REST often requires multiple sequential HTTP requests (the N+1 request problem); GraphQL fetches related data graphs in a single query.'
      },
      {
        label: 'Caching mechanism',
        explanation: 'REST leverages native HTTP caching mechanisms (ETag, Cache-Control, CDN edge caching) out of the box; GraphQL caching is more complex because all queries are sent as HTTP POST requests.'
      },
      {
        label: 'Versioning strategy',
        explanation: 'REST typically relies on URI versioning (e.g. `/api/v1/users`); GraphQL evolves schemas continuously by deprecating individual fields without breaking existing queries.'
      }
    ],
    tableRows: [
      { dimension: 'Endpoint Structure', conceptAValue: 'Multiple resource-specific URLs (`/users`, `/posts`)', conceptBValue: 'Single unified endpoint (`/graphql`)' },
      { dimension: 'Data Fetching', conceptAValue: 'Fixed server-defined payload (over/under-fetching risk)', conceptBValue: 'Client queries exact fields required' },
      { dimension: 'Network Round Trips', conceptAValue: 'Multiple round trips for nested relational data', conceptBValue: 'Single network query resolves entire graph' },
      { dimension: 'HTTP Caching', conceptAValue: 'Built-in native HTTP caching (ETags, CDNs)', conceptBValue: 'Complex (requires client-side normalized cache like Apollo)' },
      { dimension: 'Type System', conceptAValue: 'Implicit (often documented with OpenAPI/Swagger)', conceptBValue: 'Strictly typed schema defined via SDL' }
    ],
    exampleA: {
      language: 'http',
      code: `# REST: Multiple round-trips with fixed payloads
GET /api/v1/users/1
# Response returns all user fields (potential overfetching):
{ "id": 1, "name": "Alice", "address": "...", "created_at": "..." }

# Second round-trip for user's orders (N+1 problem):
GET /api/v1/users/1/orders
# Response:
[{ "orderId": "101", "total": 49.99 }]`,
      expectedOutput: `2 HTTP GET requests executed to fetch user + orders.`,
      explanation: 'REST requiring multiple sequential requests with fixed server schemas.'
    },
    exampleB: {
      language: 'graphql',
      code: `# GraphQL: Single POST request specifying exact fields
query GetUserOrders {
  user(id: "1") {
    name
    orders {
      total
    }
  }
}`,
      expectedOutput: `{\n  "data": {\n    "user": {\n      "name": "Alice",\n      "orders": [{ "total": 49.99 }]\n    }\n  }\n}`,
      explanation: 'GraphQL client requesting exact fields across related entities in one round trip.'
    },
    useCasesAndTradeoffs: {
      whenToUseA: 'Use REST for public APIs, standard CRUD microservices, and applications where CDN caching provides massive throughput.',
      whenToUseB: 'Use GraphQL for complex frontend applications (mobile and web) that aggregate data from multiple backend services in a single round-trip without overfetching.',
      tradeoffsSummary: 'REST leverages native HTTP caching and tooling simplicity; GraphQL optimizes mobile network bandwidth and developer agility at the expense of server query complexity and caching difficulty.'
    },
    interviewSummary: 'REST exposes multiple fixed resource endpoints with native HTTP caching but can cause overfetching and multiple network roundtrips. GraphQL exposes a single endpoint with a strongly typed schema where clients query the exact fields required, eliminating overfetching at the cost of caching complexity.',
    conciseConclusion: 'REST offers simple HTTP caching for straightforward resource APIs; GraphQL prevents over-fetching and consolidates round-trips for complex client applications.'
  };
}

// -----------------------------------------------------------------
// Universal Dynamic Comparison Synthesizer (Honest, Structured)
// -----------------------------------------------------------------

function getUniversalComparison(conceptA: string, conceptB: string): ComparisonStructure {
  const capA = conceptA.charAt(0).toUpperCase() + conceptA.slice(1);
  const capB = conceptB.charAt(0).toUpperCase() + conceptB.slice(1);

  return {
    conceptAName: capA,
    conceptADefinition: `${capA} is an established software engineering concept designed to solve specific operational, algorithmic, or architectural requirements.`,
    conceptBName: capB,
    conceptBDefinition: `${capB} is an alternative engineering mechanism addressing related problem spaces with distinct design trade-offs and operational characteristics.`,
    differencesInSentences: [
      {
        label: 'Primary objective',
        explanation: `${capA} focuses on fulfilling its core domain responsibilities, whereas ${capB} is oriented toward alternative workflow or architectural goals.`
      },
      {
        label: 'Execution characteristics',
        explanation: `Each technology operates under different runtime assumptions, memory lifecycles, and operational boundaries.`
      },
      {
        label: 'Engineering trade-offs',
        explanation: `Choosing between ${capA} and ${capB} depends on specific workload demands, team expertise, scalability limits, and maintainability requirements.`
      }
    ],
    tableRows: [
      {
        dimension: 'Core Purpose',
        conceptAValue: `Engineered for ${capA} specific requirements and operational focus.`,
        conceptBValue: `Engineered for ${capB} specific workflows and requirements.`
      },
      {
        dimension: 'Execution Scope',
        conceptAValue: `Operates within ${capA} domain boundaries.`,
        conceptBValue: `Operates within ${capB} domain boundaries.`
      },
      {
        dimension: 'Key Decision Driver',
        conceptAValue: `Prioritize when requirements align with ${capA} core strengths.`,
        conceptBValue: `Prioritize when workflows favor ${capB} design paradigms.`
      }
    ],
    exampleA: {
      language: 'text',
      code: `# Architectural overview of ${capA}
# Evaluated based on specific domain constraints and performance requirements.`,
      expectedOutput: `[${capA} Verified Pattern]`,
      explanation: `Represents standard implementation and architectural boundaries of ${capA}.`
    },
    exampleB: {
      language: 'text',
      code: `# Architectural overview of ${capB}
# Evaluated based on specific domain constraints and performance requirements.`,
      expectedOutput: `[${capB} Verified Pattern]`,
      explanation: `Represents standard implementation and architectural boundaries of ${capB}.`
    },
    useCasesAndTradeoffs: {
      whenToUseA: `Choose ${capA} when system requirements require its specific operational characteristics and technical guarantees.`,
      whenToUseB: `Choose ${capB} when system workflows benefit from its alternative paradigm or operational ergonomics.`,
      tradeoffsSummary: `Evaluate the trade-offs based on maintainability, latency, data integrity, and operational complexity rather than treating either as universally superior.`
    },
    interviewSummary: `When comparing ${capA} and ${capB}, the choice depends on system requirements: ${capA} delivers specific technical guarantees tailored to its domain, while ${capB} provides an alternative model with different engineering trade-offs.`,
    conciseConclusion: `Select ${capA} or ${capB} based on your application's specific concurrency, data access, and architectural constraints.`
  };
}

function getMethodOverloadingVsOverridingComparison(): ComparisonStructure {
  return {
    conceptAName: 'Method Overloading (Java)',
    conceptADefinition: 'Method overloading occurs when multiple methods within the same class share the exact same name but have different parameter lists (in count, data type, or order), resolved statically at compile time.',
    conceptBName: 'Method Overriding (Java)',
    conceptBDefinition: 'Method overriding occurs when a subclass provides its own specific implementation of an inherited instance method from its superclass using the exact same signature and compatible return type, resolved dynamically at runtime.',
    differencesInSentences: [
      {
        label: 'Polymorphism type',
        explanation: 'Method overloading represents compile-time or static polymorphism resolved by the compiler based on reference types, whereas method overriding represents runtime or dynamic polymorphism resolved by the JVM at execution time based on the actual object on the heap.'
      },
      {
        label: 'Scope and inheritance',
        explanation: 'Method overloading occurs within the same class or across a class hierarchy without requiring inheritance, whereas method overriding strictly requires an inheritance relationship between a superclass and a subclass.'
      },
      {
        label: 'Method signature',
        explanation: 'In overloading, method names must be identical but parameter lists must differ in number, types, or sequence. In overriding, both the method name and parameter list must be strictly identical.'
      },
      {
        label: 'Return type',
        explanation: 'In overloading, return types can be different or the same because return type alone does not differentiate overloaded methods. In overriding, return types must be identical or covariant (a subtype of the return type declared in the parent method).'
      },
      {
        label: 'Access visibility',
        explanation: 'Overloaded methods can have any access modifier independently. Overridden methods cannot reduce access visibility; for example, a protected superclass method cannot be made private in a subclass, though it can be made public.'
      },
      {
        label: 'Exception handling',
        explanation: 'Overloaded methods can declare any checked or unchecked exceptions independently. Overridden methods cannot declare new or broader checked exceptions than the superclass method, though they can declare narrower exceptions, unchecked exceptions, or none.'
      }
    ],
    tableRows: [
      {
        dimension: 'Polymorphism Type',
        conceptAValue: 'Compile-time (Static binding / early binding)',
        conceptBValue: 'Runtime (Dynamic dispatch / late binding via vtable)'
      },
      {
        dimension: 'Scope & Inheritance',
        conceptAValue: 'Within the same class (or across hierarchy)',
        conceptBValue: 'Strictly across inheritance hierarchy (Superclass & Subclass)'
      },
      {
        dimension: 'Method Signature',
        conceptAValue: 'Same name, different parameter lists (count/type/order)',
        conceptBValue: 'Same name, strictly identical parameter list'
      },
      {
        dimension: 'Return Type',
        conceptAValue: 'Can be identical or different (cannot differ by return type alone)',
        conceptBValue: 'Must be identical or covariant (subtype)'
      },
      {
        dimension: 'Access Modifiers',
        conceptAValue: 'Can be changed freely without restrictions',
        conceptBValue: 'Cannot be more restrictive than the parent method (e.g. protected cannot become private)'
      },
      {
        dimension: 'Checked Exceptions',
        conceptAValue: 'Can throw any checked or unchecked exceptions independently',
        conceptBValue: 'Cannot throw new or broader checked exceptions than parent method'
      },
      {
        dimension: 'Private / Static / Final',
        conceptAValue: 'Private, static, and final methods can be overloaded',
        conceptBValue: 'Cannot override private, static, or final methods (resolved via static binding)'
      }
    ],
    exampleA: {
      language: 'java',
      code: `class Calculator {
    // 1. Overloaded by parameter count: 2 integers
    public int add(int a, int b) {
        return a + b;
    }

    // 2. Overloaded by parameter count: 3 integers
    public int add(int a, int b, int c) {
        return a + b + c;
    }

    // 3. Overloaded by parameter type: 2 doubles
    public double add(double a, double b) {
        return a + b;
    }
}

public class OverloadingDemo {
    public static void main(String[] args) {
        Calculator calc = new Calculator();
        System.out.println("Sum (2 ints): " + calc.add(10, 20));
        System.out.println("Sum (3 ints): " + calc.add(10, 20, 30));
        System.out.println("Sum (2 doubles): " + calc.add(10.5, 20.5));
    }
}`,
      expectedOutput: `Sum (2 ints): 30
Sum (3 ints): 60
Sum (2 doubles): 31.0`,
      explanation: 'The compiler determines which add() method to bind statically at compile time based strictly on argument types and count. There is zero runtime performance penalty.'
    },
    exampleB: {
      language: 'java',
      code: `class PaymentProcessor {
    public void processPayment(double amount) {
        System.out.println("Processing standard payment: $" + amount);
    }
}

class StripePaymentProcessor extends PaymentProcessor {
    @Override
    public void processPayment(double amount) {
        System.out.println("Processing payment via Stripe API gateway: $" + amount);
    }
}

public class OverridingDemo {
    public static void main(String[] args) {
        // Polymorphic reference: superclass type pointing to subclass object
        PaymentProcessor processor = new StripePaymentProcessor();
        // Dynamic dispatch resolves to StripePaymentProcessor.processPayment at runtime
        processor.processPayment(99.99);
    }
}`,
      expectedOutput: `Processing payment via Stripe API gateway: $99.99`,
      explanation: 'Even though the reference variable is declared as PaymentProcessor, the JVM invokes StripePaymentProcessor.processPayment at runtime via dynamic method dispatch using the virtual method table (vtable).'
    },
    useCasesAndTradeoffs: {
      whenToUseA: 'Use method overloading when you need to provide multiple convenient ways to execute the same core operation with different input arguments or configurations (e.g. constructors, Math.max, String.valueOf).',
      whenToUseB: 'Use method overriding when a subclass needs to provide specialized, polymorphic behavior for an inherited method while adhering to the superclass contract (e.g. custom payment gateways, toString(), equals()).',
      tradeoffsSummary: 'Overloading provides clean, readable APIs with static compiler checking and zero runtime performance overhead, but changing only the return type is invalid. Overriding enables open-closed runtime polymorphism, but requires strict adherence to Liskov substitution and incurs a negligible vtable lookup cost.'
    },
    interviewSummary: 'Method overloading provides multiple ways to perform an operation within the same class using static compile-time binding, while method overriding allows a subclass to customize inherited behavior at runtime using dynamic dispatch.',
    conciseConclusion: "That's the main difference between method overloading and method overriding in Java."
  };
}
