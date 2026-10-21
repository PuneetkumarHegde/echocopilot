/**
 * Local Technical-Term Guess Engine for EchoCopilot
 * 
 * Provides ultra-fast (<1ms), 100% offline, deterministic technical term normalization
 * and speech-recognition error correction using:
 * - Multiword n-gram scanning
 * - Phonetic matching (Double Metaphone)
 * - Levenshtein edit distance & normalized string similarity
 * - Contextual domain weighting (Java, OS, JavaScript, SQL, Networking, CS General)
 * - Negative collocation guards (e.g., prevents "throat infection" -> "thread infection")
 * - Anti-hallucination guard detecting unrecognized or nonstandard technical concepts.
 */

export interface TermCorrection {
  original: string;
  corrected: string;
  confidence: number;
  reason: string;
  domain?: string;
}

export interface TermNormalizationResult {
  originalText: string;
  normalizedText: string;
  corrections: TermCorrection[];
  detectedDomains: string[];
  hasUnknownSuspectTerm: boolean;
  suspectTerms: string[];
  suggestedClarification?: string;
  latencyMs: number;
}

export type TechDomain = 'java' | 'os' | 'javascript' | 'sql' | 'networking' | 'cs_general' | 'electronics' | 'mechanical' | 'civil' | 'cybersecurity' | 'mathematics';

interface TechnicalTermDefinition {
  canonical: string;
  domain: TechDomain;
  aliases?: string[];
  coOccursWith?: string[];
  isMultiword?: boolean;
  phoneticCodes?: [string, string];
}

// ---------------------------------------------------------------------------
// 1. Technical Vocabulary (Engineering, Science, CS, Cybersecurity, Math)
// ---------------------------------------------------------------------------

const TECHNICAL_VOCABULARY: TechnicalTermDefinition[] = [
  // Multiword Java / OOP Terms
  { canonical: 'checked exception', domain: 'java', aliases: ['checker exception', 'check exception', 'checking exception'], coOccursWith: ['java', 'exception', 'compiler', 'throws', 'try', 'catch', 'unchecked exception'], isMultiword: true },
  { canonical: 'unchecked exception', domain: 'java', aliases: ['unchecker exception', 'uncheck exception', 'unchecking exception'], coOccursWith: ['java', 'runtimeexception', 'runtime', 'exception', 'checked exception'], isMultiword: true },
  { canonical: 'runtime exception', domain: 'java', aliases: ['run time exception'], coOccursWith: ['java', 'unchecked exception', 'exception'], isMultiword: true },
  { canonical: 'compile time exception', domain: 'java', aliases: ['compile-time exception'], coOccursWith: ['java', 'checked exception'], isMultiword: true },
  { canonical: 'method overloading', domain: 'java', aliases: ['method over loading', 'method overloaded'], coOccursWith: ['java', 'signature', 'compile time', 'polymorphism', 'method overriding'], isMultiword: true },
  { canonical: 'method overriding', domain: 'java', aliases: ['method over riding', 'method overridden'], coOccursWith: ['java', 'runtime', 'inheritance', 'polymorphism', 'method overloading', 'override'], isMultiword: true },
  { canonical: 'garbage collection', domain: 'java', aliases: ['garbage collector', 'gc'], coOccursWith: ['memory', 'heap', 'jvm', 'pause'], isMultiword: true },
  { canonical: 'dependency injection', domain: 'java', aliases: ['di'], coOccursWith: ['spring', 'ioc', 'inversion of control'], isMultiword: true },
  { canonical: 'inversion of control', domain: 'java', aliases: ['ioc'], coOccursWith: ['spring', 'dependency injection'], isMultiword: true },
  { canonical: 'abstract class', domain: 'java', isMultiword: true },
  { canonical: 'concurrent hashmap', domain: 'java', aliases: ['concurrent hash map'], isMultiword: true },
  { canonical: 'null pointer exception', domain: 'java', aliases: ['nullpointerexception', 'npe'], isMultiword: true },

  // Multiword JavaScript / Web Terms
  { canonical: 'event loop', domain: 'javascript', aliases: ['event lookup', 'event look'], coOccursWith: ['javascript', 'call stack', 'callback', 'microtask', 'macrotask', 'node.js', 'single thread'], isMultiword: true },
  { canonical: 'call stack', domain: 'javascript', aliases: ['called stack', 'call stick'], coOccursWith: ['javascript', 'stack overflow', 'execution context'], isMultiword: true },
  { canonical: 'virtual dom', domain: 'javascript', aliases: ['virtual doom', 'virtual domain'], coOccursWith: ['react', 'render', 'reconciliation', 'diffing'], isMultiword: true },
  { canonical: 'async await', domain: 'javascript', aliases: ['async weight'], coOccursWith: ['promise', 'javascript', 'asynchronous'], isMultiword: true },
  { canonical: 'arrow function', domain: 'javascript', isMultiword: true },
  { canonical: 'strict mode', domain: 'javascript', isMultiword: true },

  // Multiword SQL / Database Terms
  { canonical: 'b-tree', domain: 'sql', aliases: ['b tree', 'bee tree', 'be tree'], coOccursWith: ['index', 'indexing', 'database', 'sql', 'search'], isMultiword: true },
  { canonical: 'lsm tree', domain: 'sql', aliases: ['l s m tree', 'log structured merge tree'], coOccursWith: ['database', 'nosql', 'compaction'], isMultiword: true },
  { canonical: 'primary key', domain: 'sql', isMultiword: true },
  { canonical: 'foreign key', domain: 'sql', isMultiword: true },
  { canonical: 'acid properties', domain: 'sql', aliases: ['acid property', 'asset properties'], coOccursWith: ['transaction', 'atomicity', 'consistency', 'isolation', 'durability'], isMultiword: true },
  { canonical: 'connection pool', domain: 'sql', aliases: ['connection pooling'], coOccursWith: ['database', 'sql', 'datasource'], isMultiword: true },
  { canonical: 'composite index', domain: 'sql', isMultiword: true },
  { canonical: 'isolation level', domain: 'sql', isMultiword: true },

  // Multiword Operating Systems / Concurrency Terms
  { canonical: 'race condition', domain: 'os', aliases: ['ray condition', 'raise condition'], coOccursWith: ['thread', 'concurrency', 'mutex', 'lock', 'critical section'], isMultiword: true },
  { canonical: 'context switch', domain: 'os', aliases: ['contact switch', 'context switching'], coOccursWith: ['cpu', 'thread', 'process', 'kernel'], isMultiword: true },
  { canonical: 'virtual memory', domain: 'os', coOccursWith: ['paging', 'mmu', 'page fault', 'ram'], isMultiword: true },
  { canonical: 'inter-process communication', domain: 'os', aliases: ['ipc'], coOccursWith: ['process', 'pipe', 'shared memory', 'socket'], isMultiword: true },

  // Multiword Networking Terms
  { canonical: 'three-way handshake', domain: 'networking', aliases: ['3-way handshake', 'tcp handshake'], coOccursWith: ['tcp', 'syn', 'ack', 'connection'], isMultiword: true },
  { canonical: 'load balancer', domain: 'networking', aliases: ['load balance'], coOccursWith: ['reverse proxy', 'nginx', 'traffic', 'server'], isMultiword: true },
  { canonical: 'reverse proxy', domain: 'networking', coOccursWith: ['load balancer', 'nginx', 'caching'], isMultiword: true },
  { canonical: 'rest api', domain: 'networking', aliases: ['restful api'], coOccursWith: ['http', 'get', 'post', 'endpoint'], isMultiword: true },

  // Multiword CS Concepts
  { canonical: 'compile time', domain: 'cs_general', aliases: ['compile-time'], coOccursWith: ['runtime', 'compiler', 'static'], isMultiword: true },
  { canonical: 'runtime', domain: 'cs_general', aliases: ['run time', 'run-time'], coOccursWith: ['compile time', 'execution', 'dynamic'], isMultiword: false },
  { canonical: 'binary search', domain: 'cs_general', isMultiword: true },
  { canonical: 'dynamic programming', domain: 'cs_general', aliases: ['dp', 'memoization'], isMultiword: true },
  { canonical: 'time complexity', domain: 'cs_general', isMultiword: true },
  { canonical: 'space complexity', domain: 'cs_general', isMultiword: true },
  { canonical: 'circuit breaker', domain: 'cs_general', isMultiword: true },
  { canonical: 'rate limiter', domain: 'cs_general', isMultiword: true },
  { canonical: 'solid principles', domain: 'cs_general', aliases: ['solid principle'], isMultiword: true },

  // Multiword Electronics & Electrical
  { canonical: "ohm's law", domain: 'electronics', aliases: ['ohms law'], coOccursWith: ['voltage', 'current', 'resistance'], isMultiword: true },
  { canonical: "kirchhoff's law", domain: 'electronics', aliases: ['kirchhoffs law', 'kirchhoff law', 'kcl', 'kvl'], coOccursWith: ['current', 'voltage', 'circuit'], isMultiword: true },
  { canonical: 'alternating current', domain: 'electronics', aliases: ['ac current', 'ac'], coOccursWith: ['direct current', 'frequency', 'voltage'], isMultiword: true },
  { canonical: 'direct current', domain: 'electronics', aliases: ['dc current', 'dc'], coOccursWith: ['alternating current', 'voltage'], isMultiword: true },
  { canonical: 'operational amplifier', domain: 'electronics', aliases: ['op amp', 'op-amp'], isMultiword: true },

  // Multiword Mechanical & Civil Engineering
  { canonical: "bernoulli's equation", domain: 'mechanical', aliases: ['bernoullis equation', 'bernoulli equation', 'bernoulli principle'], coOccursWith: ['fluid', 'pressure', 'velocity'], isMultiword: true },
  { canonical: 'carnot cycle', domain: 'mechanical', aliases: ['carnot engine'], coOccursWith: ['efficiency', 'heat', 'thermodynamics'], isMultiword: true },
  { canonical: 'stress and strain', domain: 'mechanical', aliases: ['stress strain'], coOccursWith: ['deformation', 'modulus', 'elasticity'], isMultiword: true },
  { canonical: 'concrete slump test', domain: 'civil', aliases: ['slump test'], coOccursWith: ['concrete', 'workability'], isMultiword: true },

  // Multiword Cybersecurity
  { canonical: 'sql injection', domain: 'cybersecurity', aliases: ['sqli'], coOccursWith: ['database', 'security', 'vulnerability'], isMultiword: true },
  { canonical: 'cross-site scripting', domain: 'cybersecurity', aliases: ['xss'], coOccursWith: ['security', 'vulnerability', 'browser'], isMultiword: true },
  { canonical: 'buffer overflow', domain: 'cybersecurity', coOccursWith: ['memory', 'stack', 'security'], isMultiword: true },

  // Multiword Mathematics
  { canonical: 'fourier transform', domain: 'mathematics', aliases: ['fft'], coOccursWith: ['frequency', 'signal'], isMultiword: true },
  { canonical: 'laplace transform', domain: 'mathematics', coOccursWith: ['s-domain', 'differential equation'], isMultiword: true },
  { canonical: "euler's formula", domain: 'mathematics', aliases: ['eulers formula'], isMultiword: true },

  // Single-word Terms
  { canonical: 'thread', domain: 'os', aliases: ['threads', 'throat', 'threat', 'tread'], coOccursWith: ['process', 'processes', 'concurrency', 'multithreading', 'lock', 'mutex', 'semaphore', 'cpu', 'deadlock', 'operating system', 'os'] },
  { canonical: 'process', domain: 'os', aliases: ['processes'], coOccursWith: ['thread', 'threads', 'memory', 'cpu', 'operating system', 'os', 'ipc', 'deadlock'] },
  { canonical: 'compiler', domain: 'cs_general', aliases: ['compilers', 'compile'], coOccursWith: ['interpreter', 'interpreters', 'bytecode', 'machine code', 'source code', 'ast', 'parsing', 'transpiler', 'runtime', 'jit', 'compile time'] },
  { canonical: 'interpreter', domain: 'cs_general', aliases: ['interpreters', 'interpret'], coOccursWith: ['compiler', 'compilers', 'bytecode', 'virtual machine', 'runtime', 'jit', 'line by line', 'execution'] },
  { canonical: 'deadlock', domain: 'os', coOccursWith: ['thread', 'process', 'lock', 'mutex', 'resource'] },
  { canonical: 'mutex', domain: 'os', aliases: ['mewtex'], coOccursWith: ['lock', 'semaphore', 'thread', 'critical section'] },
  { canonical: 'semaphore', domain: 'os', aliases: ['semaphor'], coOccursWith: ['mutex', 'thread', 'process', 'signal'] },
  { canonical: 'inheritance', domain: 'java', coOccursWith: ['polymorphism', 'encapsulation', 'class', 'oop', 'java'] },
  { canonical: 'polymorphism', domain: 'java', coOccursWith: ['inheritance', 'overloading', 'overriding', 'interface', 'oop', 'java'] },
  { canonical: 'encapsulation', domain: 'java', coOccursWith: ['inheritance', 'polymorphism', 'oop', 'java'] },
  { canonical: 'abstraction', domain: 'java', coOccursWith: ['interface', 'abstract class', 'oop'] },
  { canonical: 'closure', domain: 'javascript', aliases: ['closer'], coOccursWith: ['scope', 'lexical', 'function', 'javascript'] },
  { canonical: 'hoisting', domain: 'javascript', aliases: ['hosting'], coOccursWith: ['var', 'let', 'declaration', 'javascript'] },
  { canonical: 'promise', domain: 'javascript', coOccursWith: ['async', 'await', 'then', 'resolve', 'reject', 'javascript'] },
  { canonical: 'prototype', domain: 'javascript', coOccursWith: ['prototypal', 'inheritance', 'javascript', '__proto__'] },
  { canonical: 'indexing', domain: 'sql', aliases: ['indexes'], coOccursWith: ['b-tree', 'database', 'sql', 'table', 'query'] },
  { canonical: 'sharding', domain: 'sql', coOccursWith: ['partitioning', 'horizontal scaling', 'database', 'sql'] },
  { canonical: 'replication', domain: 'sql', coOccursWith: ['master', 'slave', 'replica', 'failover', 'database'] },
  { canonical: 'transaction', domain: 'sql', coOccursWith: ['acid', 'commit', 'rollback', 'isolation'] },
  { canonical: 'concurrency', domain: 'os', coOccursWith: ['parallelism', 'thread', 'process', 'race condition'] },
  { canonical: 'parallelism', domain: 'os', coOccursWith: ['concurrency', 'multicore', 'cpu'] },
  { canonical: 'recursion', domain: 'cs_general', coOccursWith: ['base case', 'call stack', 'algorithm'] },
  { canonical: 'mosfet', domain: 'electronics', aliases: ['mossfet'], coOccursWith: ['transistor', 'gate', 'drain', 'source'] },
  { canonical: 'diode', domain: 'electronics', coOccursWith: ['rectifier', 'anode', 'cathode', 'pn junction'] },
  { canonical: 'transistor', domain: 'electronics', coOccursWith: ['bjt', 'base', 'collector', 'emitter'] }
];

// Precompute canonical vocabulary index and phonetic keys for sub-millisecond execution
const CANONICAL_TERMS_SET = new Set<string>();
for (const term of TECHNICAL_VOCABULARY) {
  CANONICAL_TERMS_SET.add(term.canonical.toLowerCase());
  CANONICAL_TERMS_SET.add(term.canonical.toLowerCase() + 's');
  CANONICAL_TERMS_SET.add(term.canonical.toLowerCase() + 'es');
  term.phoneticCodes = doubleMetaphone(term.canonical);
}

const MULTIWORD_TERMS = TECHNICAL_VOCABULARY.filter(t => t.isMultiword);
const SINGLE_WORD_TERMS = TECHNICAL_VOCABULARY.filter(t => !t.isMultiword);

// Domain keywords used to detect subject context
const DOMAIN_KEYWORDS: Record<TechDomain, string[]> = {
  java: ['java', 'jvm', 'jre', 'jdk', 'exception', 'exceptions', 'throw', 'throws', 'catch', 'try', 'spring', 'runtimeexception', 'nullpointerexception', 'byte code', 'bytecode', 'class', 'interface', 'overload', 'override', 'garbage collection'],
  os: ['os', 'operating system', 'operating systems', 'process', 'processes', 'thread', 'threads', 'concurrency', 'multithreading', 'multiprocessing', 'cpu', 'memory', 'mutex', 'semaphore', 'deadlock', 'scheduling', 'kernel', 'context switch', 'paging', 'virtual memory', 'ipc'],
  javascript: ['javascript', 'js', 'typescript', 'ts', 'node', 'nodejs', 'react', 'frontend', 'browser', 'dom', 'v8', 'event loop', 'closure', 'prototype', 'npm', 'promise', 'async', 'await', 'hoisting'],
  sql: ['sql', 'database', 'databases', 'rdbms', 'table', 'tables', 'postgres', 'postgresql', 'mysql', 'query', 'indexing', 'index', 'b-tree', 'transaction', 'acid', 'relational', 'nosql', 'sharding', 'foreign key', 'primary key'],
  networking: ['network', 'networking', 'tcp', 'udp', 'ip', 'http', 'https', 'dns', 'packet', 'socket', 'handshake', 'osi', 'latency', 'bandwidth', 'router', 'gateway', 'load balancer', 'proxy'],
  cs_general: ['algorithm', 'data structure', 'complexity', 'big-o', 'solid', 'design pattern', 'system design', 'recursion', 'dynamic programming', 'compile time', 'runtime', 'oop'],
  electronics: ['electronics', 'electrical', 'voltage', 'current', 'resistance', 'ohm', 'kirchhoff', 'ac', 'dc', 'mosfet', 'transistor', 'diode', 'op-amp', 'circuit', 'capacitance', 'inductance'],
  mechanical: ['mechanical', 'thermodynamics', 'carnot', 'bernoulli', 'fluid', 'stress', 'strain', 'pressure', 'heat', 'engine', 'viscosity'],
  civil: ['civil', 'concrete', 'slump', 'foundation', 'soil', 'beam', 'truss', 'structural', 'surveying'],
  cybersecurity: ['cybersecurity', 'security', 'xss', 'sql injection', 'injection', 'buffer overflow', 'firewall', 'malware', 'encryption', 'cryptography', 'vulnerability', 'exploit'],
  mathematics: ['mathematics', 'math', 'calculus', 'fourier', 'laplace', 'euler', 'derivative', 'integral', 'matrix', 'eigenvalue', 'probability']
};

// Negative collocation dictionary: phrases where a word is clearly NON-TECHNICAL and must NOT be replaced
const NEGATIVE_COLLOCATIONS: Record<string, RegExp[]> = {
  throat: [
    /\bthroat\s+(infection|cancer|spray|coat|culture|swab|pain|irritation|lozenge|ache)\b/i,
    /\b(sore|strep|scratchy|swollen|dry|clear|clearing|deep|cut)\s+throat\b/i,
    /\blump\s+in\s+(the\s+|my\s+|a\s+)?throat\b/i
  ]
};

const NEGATIVE_CONTEXT_WORDS: Record<string, string[]> = {
  throat: ['infection', 'infected', 'doctor', 'hospital', 'cough', 'coughing', 'sore', 'tonsil', 'pharynx', 'pain', 'swallow', 'swallowing', 'medical', 'virus', 'bacterial', 'fever', 'medicine', 'sick', 'illness']
};

// ---------------------------------------------------------------------------
// 2. Pure TypeScript Double Metaphone Algorithm
// ---------------------------------------------------------------------------

/**
 * Computes primary and secondary Double Metaphone phonetic codes for a word.
 * Returns [primary, secondary] codes (up to 4-5 chars).
 */
export function doubleMetaphone(rawWord: string): [string, string] {
  if (!rawWord) return ['', ''];
  const word = rawWord.trim().toUpperCase();
  if (word.length === 0) return ['', ''];

  let primary = '';
  let secondary = '';
  let current = 0;
  const length = word.length;

  const charAt = (pos: number) => (pos >= 0 && pos < length ? word[pos] : '');
  const substr = (pos: number, len: number) => word.substring(pos, pos + len);
  const isVowel = (pos: number) => ['A', 'E', 'I', 'O', 'U', 'Y'].includes(charAt(pos));

  // If starts with vowel, encode initial vowel as 'A'
  if (isVowel(0)) {
    primary += 'A';
    secondary += 'A';
    current++;
  }

  while (current < length && primary.length < 5) {
    const ch = charAt(current);

    switch (ch) {
      case 'B':
        primary += 'P';
        secondary += 'P';
        current += (charAt(current + 1) === 'B') ? 2 : 1;
        break;

      case 'C':
        if (substr(current, 2) === 'CH') {
          primary += 'X';
          secondary += 'K';
          current += 2;
        } else if (substr(current, 2) === 'CK') {
          primary += 'K';
          secondary += 'K';
          current += 2;
        } else if (['E', 'I', 'Y'].includes(charAt(current + 1))) {
          primary += 'S';
          secondary += 'S';
          current += 2;
        } else {
          primary += 'K';
          secondary += 'K';
          current += (charAt(current + 1) === 'C') ? 2 : 1;
        }
        break;

      case 'D':
        if (substr(current, 2) === 'DG' && ['E', 'I', 'Y'].includes(charAt(current + 2))) {
          primary += 'J';
          secondary += 'J';
          current += 3;
        } else {
          primary += 'T';
          secondary += 'T';
          current += (charAt(current + 1) === 'D') ? 2 : 1;
        }
        break;

      case 'F':
      case 'V':
        primary += 'F';
        secondary += 'F';
        current += (charAt(current + 1) === ch) ? 2 : 1;
        break;

      case 'G':
        if (substr(current, 2) === 'GH') {
          if (current > 0 && !isVowel(current - 1)) {
            current += 2;
          } else {
            primary += 'F';
            secondary += 'K';
            current += 2;
          }
        } else if (['E', 'I', 'Y'].includes(charAt(current + 1))) {
          primary += 'J';
          secondary += 'K';
          current += 2;
        } else {
          primary += 'K';
          secondary += 'K';
          current += (charAt(current + 1) === 'G') ? 2 : 1;
        }
        break;

      case 'H':
        if ((current === 0 || isVowel(current - 1)) && isVowel(current + 1)) {
          primary += 'H';
          secondary += 'H';
          current += 2;
        } else {
          current++;
        }
        break;

      case 'J':
        primary += 'J';
        secondary += 'J';
        current += (charAt(current + 1) === 'J') ? 2 : 1;
        break;

      case 'K':
        primary += 'K';
        secondary += 'K';
        current += (charAt(current + 1) === 'K') ? 2 : 1;
        break;

      case 'L':
        primary += 'L';
        secondary += 'L';
        current += (charAt(current + 1) === 'L') ? 2 : 1;
        break;

      case 'M':
        primary += 'M';
        secondary += 'M';
        current += (charAt(current + 1) === 'M') ? 2 : 1;
        break;

      case 'N':
        primary += 'N';
        secondary += 'N';
        current += (charAt(current + 1) === 'N') ? 2 : 1;
        break;

      case 'P':
        if (charAt(current + 1) === 'H') {
          primary += 'F';
          secondary += 'F';
          current += 2;
        } else {
          primary += 'P';
          secondary += 'P';
          current += (charAt(current + 1) === 'P') ? 2 : 1;
        }
        break;

      case 'Q':
        primary += 'K';
        secondary += 'K';
        current += (charAt(current + 1) === 'Q') ? 2 : 1;
        break;

      case 'R':
        primary += 'R';
        secondary += 'R';
        current += (charAt(current + 1) === 'R') ? 2 : 1;
        break;

      case 'S':
        if (substr(current, 2) === 'SH') {
          primary += 'X';
          secondary += 'X';
          current += 2;
        } else {
          primary += 'S';
          secondary += 'S';
          current += (charAt(current + 1) === 'S') ? 2 : 1;
        }
        break;

      case 'T':
        if (substr(current, 2) === 'TH') {
          // 'TH' maps to '0' (theta) primary, 'T' secondary
          primary += '0';
          secondary += 'T';
          current += 2;
        } else if (substr(current, 4) === 'TION' || substr(current, 3) === 'TIA') {
          primary += 'X';
          secondary += 'X';
          current += 3;
        } else {
          primary += 'T';
          secondary += 'T';
          current += (charAt(current + 1) === 'T') ? 2 : 1;
        }
        break;

      case 'W':
      case 'Y':
        if (isVowel(current + 1)) {
          primary += ch;
          secondary += ch;
          current += 2;
        } else {
          current++;
        }
        break;

      case 'X':
        primary += 'KS';
        secondary += 'KS';
        current += (charAt(current + 1) === 'X') ? 2 : 1;
        break;

      case 'Z':
        primary += 'S';
        secondary += 'S';
        current += (charAt(current + 1) === 'Z') ? 2 : 1;
        break;

      default:
        current++;
        break;
    }
  }

  return [primary, secondary];
}

// ---------------------------------------------------------------------------
// 3. String & Phonetic Similarity Metrics
// ---------------------------------------------------------------------------

export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    const c1 = s1.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      if (c1 === s2.charCodeAt(j - 1)) {
        curr[j] = prev[j - 1];
      } else {
        curr[j] = 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
      }
    }
    const temp = prev;
    prev = curr;
    curr = temp;
  }

  return prev[n];
}

export function stringSimilarity(s1: string, s2: string): number {
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(s1.toLowerCase(), s2.toLowerCase());
  return Math.max(0, 1 - dist / maxLen);
}

export function phoneticSimilarity(wordA: string, wordB: string, precomputedB?: [string, string]): number {
  const [pA, sA] = doubleMetaphone(wordA);
  const [pB, sB] = precomputedB || doubleMetaphone(wordB);

  // Exact code match
  if (pA === pB || pA === sB || sA === pB || (sA && sB && sA === sB)) {
    return 1.0;
  }

  // Fast edit distance on phonetic keys
  const distP = levenshteinDistance(pA, pB);
  const maxLen = Math.max(pA.length, pB.length);
  if (maxLen > 0 && distP <= 1) {
    return 0.85;
  }
  if (maxLen > 0 && distP <= 2 && maxLen >= 4) {
    return 0.60;
  }

  return 0.0;
}

// ---------------------------------------------------------------------------
// 4. Domain & Context Detection
// ---------------------------------------------------------------------------

export function detectContextDomains(query: string, contextHistory: string[] = []): TechDomain[] {
  const combined = [query, ...contextHistory].join(' ').toLowerCase();
  const detected: TechDomain[] = [];

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    const hasMatch = keywords.some(kw => {
      const regex = new RegExp(`\\b${kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      return regex.test(combined);
    });
    if (hasMatch) {
      detected.push(domain as TechDomain);
    }
  }

  return detected;
}

// ---------------------------------------------------------------------------
// 5. Normalization Engine with Confidence Scoring
// ---------------------------------------------------------------------------

/**
 * Normalizes speech recognition mistakes in technical interview questions.
 * Handles both multiword phrases ("checker exception" -> "checked exception")
 * and isolated terms ("throat" -> "thread" in OS context).
 */
export function normalizeTechnicalTerms(
  rawText: string,
  contextHistory: string[] | Array<{ question: string; summary?: string }> = []
): TermNormalizationResult {
  const startTime = performance.now();
  if (!rawText || typeof rawText !== 'string') {
    return {
      originalText: '',
      normalizedText: '',
      corrections: [],
      detectedDomains: [],
      hasUnknownSuspectTerm: false,
      suspectTerms: [],
      latencyMs: 0
    };
  }

  const raw = rawText.trim();
  const historyStrings: string[] = contextHistory.map(h => 
    typeof h === 'string' ? h : `${h.question} ${h.summary || ''}`
  );

  const detectedDomains = detectContextDomains(raw, historyStrings);
  const corrections: TermCorrection[] = [];
  let normalized = raw;

  // -------------------------------------------------------------------------
  // Phase 1A: Canonical OOP Method Overloading & Overriding Normalization
  // -------------------------------------------------------------------------
  const oopOverloadPairRegex = /\b(?<!method\s+)overloading\s+(and|vs|versus|or)\s+(?<!method\s+)overriding\b/gi;
  if (oopOverloadPairRegex.test(normalized)) {
    const matched = normalized.match(oopOverloadPairRegex);
    if (matched) {
      corrections.push({
        original: matched[0],
        corrected: matched[0].replace(/overloading/i, 'method overloading').replace(/overriding/i, 'method overriding'),
        confidence: 0.98,
        reason: 'Canonical OOP comparison normalization (overloading and overriding -> method overloading and method overriding)',
        domain: 'java'
      });
      normalized = normalized.replace(oopOverloadPairRegex, (match, sep) => `method overloading ${sep} method overriding`);
    }
  }

  const oopOverridePairRegex = /\b(?<!method\s+)overriding\s+(and|vs|versus|or)\s+(?<!method\s+)overloading\b/gi;
  if (oopOverridePairRegex.test(normalized)) {
    const matched = normalized.match(oopOverridePairRegex);
    if (matched) {
      corrections.push({
        original: matched[0],
        corrected: matched[0].replace(/overriding/i, 'method overriding').replace(/overloading/i, 'method overloading'),
        confidence: 0.98,
        reason: 'Canonical OOP comparison normalization (overriding and overloading -> method overriding and method overloading)',
        domain: 'java'
      });
      normalized = normalized.replace(oopOverridePairRegex, (match, sep) => `method overriding ${sep} method overloading`);
    }
  }

  // -------------------------------------------------------------------------
  // Phase 1: Multiword Phrase Normalization (High Priority)
  // -------------------------------------------------------------------------
  const lowerNormalizedText = normalized.toLowerCase();

  for (const term of MULTIWORD_TERMS) {
    const canonical = term.canonical;
    const targetWords = canonical.split(' ');

    // 1A. Direct alias match
    if (term.aliases) {
      for (const alias of term.aliases) {
        if (!lowerNormalizedText.includes(alias.toLowerCase())) continue;
        const aliasRegex = new RegExp(`\\b${alias.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi');
        if (aliasRegex.test(normalized)) {
          // Check negative collocation
          if (hasNegativeCollocation(alias, normalized)) continue;

          // Compute confidence
          const confidence = 0.95;
          corrections.push({
            original: alias,
            corrected: canonical,
            confidence,
            reason: `Recognized multiword acoustic variant of "${canonical}"`,
            domain: term.domain
          });
          normalized = normalized.replace(aliasRegex, canonical);
        }
      }
    }

    // 1B. Fuzzy 2-word or 3-word phrase matching
    if (targetWords.length >= 2) {
      // Fast pre-filter: text must contain at least one word from the canonical target
      if (!targetWords.some(tw => lowerNormalizedText.includes(tw))) {
        continue;
      }

      const n = targetWords.length;
      const tokens = normalized.split(/\s+/);

      for (let i = 0; i <= tokens.length - n; i++) {
        const windowWords = tokens.slice(i, i + n);
        const windowStr = windowWords.join(' ').replace(/[.,!?;:]/g, '');
        const lowerWindow = windowStr.toLowerCase();

        // If already identical to canonical or valid plural, do nothing
        if (lowerWindow === canonical || lowerWindow === canonical + 's' || lowerWindow === canonical + 'es') {
          continue;
        }

        // Check if one of the words is an anchor word (e.g. "exception" in "checker exception")
        let anchorMatches = 0;
        let nonAnchorSim = 0;
        let nonAnchorPhonetic = 0;

        for (let j = 0; j < n; j++) {
          const wTarget = targetWords[j].toLowerCase();
          const wWindow = windowWords[j].toLowerCase().replace(/[.,!?;:]/g, '');

          // Also check plural form of individual word
          if (wTarget === wWindow || wTarget + 's' === wWindow || wTarget + 'es' === wWindow) {
            anchorMatches++;
          } else {
            const strSim = stringSimilarity(wTarget, wWindow);
            const phonSim = phoneticSimilarity(wWindow, wTarget);
            nonAnchorSim = Math.max(nonAnchorSim, strSim);
            nonAnchorPhonetic = Math.max(nonAnchorPhonetic, phonSim);
          }
        }

        // If at least 1 anchor word matches and non-anchor word has strong phonetic/string resemblance
        // e.g. "checker exception" vs "checked exception" (anchor="exception", "checker" vs "checked" lev=1, phon=0.85)
        if (anchorMatches >= 1 && (nonAnchorSim >= 0.75 || nonAnchorPhonetic >= 0.85)) {
          // Negative collocation guard
          if (hasNegativeCollocation(lowerWindow, normalized)) continue;

          // Contextual relevance boost
          const domainMatches = detectedDomains.includes(term.domain);
          const domainBoost = domainMatches ? 0.10 : 0.05;
          const confidence = Math.min(0.98, (0.5 * nonAnchorSim + 0.4 * nonAnchorPhonetic + domainBoost));

          if (confidence >= 0.75) {
            corrections.push({
              original: windowStr,
              corrected: canonical,
              confidence: parseFloat(confidence.toFixed(2)),
              reason: `Multiword phrase correction with anchor match on "${canonical}"`,
              domain: term.domain
            });

            // Replace in text preserving boundary punctuation
            const escaped = windowStr.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
            normalized = normalized.replace(new RegExp(`\\b${escaped}\\b`, 'i'), canonical);
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Phase 2: Single-Word Acoustic/Phonetic Normalization (Context-Guarded)
  // -------------------------------------------------------------------------
  const words = normalized.split(/\s+/);
  const singleWordTerms = SINGLE_WORD_TERMS;

  for (let idx = 0; idx < words.length; idx++) {
    const rawWord = words[idx];
    const cleanWord = rawWord.replace(/[.,!?;:()]/g, '').toLowerCase();
    if (cleanWord.length < 3) continue;

    // Check negative collocations (e.g. "throat infection")
    if (hasNegativeCollocation(cleanWord, normalized)) {
      continue;
    }

    // If word is already a recognized canonical technical term (or its plural), do not alter it
    if (CANONICAL_TERMS_SET.has(cleanWord)) {
      continue;
    }

    // Check candidate technical terms
    for (const term of singleWordTerms) {
      const canonical = term.canonical.toLowerCase();
      if (cleanWord === canonical) continue;

      // Check explicit alias or phonetic match
      const isExplicitAlias = term.aliases?.some(a => a.toLowerCase() === cleanWord);
      let phonSim = 0;
      let strSim = 0;

      if (isExplicitAlias) {
        phonSim = 1.0;
        strSim = stringSimilarity(cleanWord, canonical);
      } else {
        // Fast pre-filter: length difference <= 3
        if (Math.abs(cleanWord.length - canonical.length) <= 3) {
          phonSim = phoneticSimilarity(cleanWord, canonical, term.phoneticCodes);
          strSim = stringSimilarity(cleanWord, canonical);
        }
      }

      if (isExplicitAlias || phonSim >= 0.85 || (strSim >= 0.70 && phonSim >= 0.60)) {
        // Calculate contextual relevance
        let contextRelevance = 0;
        const lowerNormalized = normalized.toLowerCase();

        // 1. Does the query or history contain co-occurring terms (e.g. "process" for "thread")?
        if (term.coOccursWith) {
          for (const co of term.coOccursWith) {
            const regex = new RegExp(`\\b${co}\\b`, 'i');
            if (regex.test(lowerNormalized) || historyStrings.some(h => regex.test(h.toLowerCase()))) {
              contextRelevance += 0.35;
              break;
            }
          }
        }

        // 2. Does the query domain match?
        if (detectedDomains.includes(term.domain)) {
          contextRelevance += 0.20;
        }

        // 3. Difference question structure boost (e.g. "difference between X and Y")
        const isDifference = /\b(difference\s+between|compare|vs|versus)\b/i.test(normalized);
        if (isDifference && contextRelevance > 0) {
          contextRelevance += 0.15;
        }

        // Base confidence from phonetic and string similarity
        const baseSim = isExplicitAlias ? 0.90 : (0.55 * phonSim + 0.45 * strSim);
        const totalConfidence = Math.min(0.96, baseSim * 0.6 + contextRelevance);

        // REQUIREMENT 2: Apply correction automatically ONLY when confidence is sufficiently high
        // and context clearly supports it
        if (totalConfidence >= 0.75 && contextRelevance >= 0.30) {
          corrections.push({
            original: rawWord.replace(/[.,!?;:()]/g, ''),
            corrected: canonical,
            confidence: parseFloat(totalConfidence.toFixed(2)),
            reason: `Contextually grounded phonetic correction (${term.domain} context)`,
            domain: term.domain
          });

          // Replace in normalized string preserving punctuation
          const punctuationMatch = rawWord.match(/[.,!?;:()]+$/);
          const punct = punctuationMatch ? punctuationMatch[0] : '';
          const escaped = rawWord.replace(/[.,!?;:()]/g, '').replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
          normalized = normalized.replace(new RegExp(`\\b${escaped}\\b`, 'i'), canonical + punct);
          break;
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Phase 3: Hallucination & Unknown Nonstandard Term Guard (Requirement 4 & 7)
  // Protects bounded languages/runtimes from fabricated concepts (e.g. "flurbenoid in Java").
  // Never blocks open-domain engineering, science, mathematics, cybersecurity, or HR questions.
  // -------------------------------------------------------------------------
  const suspectTerms: string[] = [];
  let hasUnknownSuspectTerm = false;
  let suggestedClarification: string | undefined;

  // Check if query explicitly scopes the question to a specific language/runtime domain
  // e.g., "in Java", "in Python", "in React", "in JavaScript", "in C++", "in Go", "in Rust"
  const domainScopeMatch = normalized.match(/\bin\s+([a-zA-Z0-9#+.]+)(?:\?|\.|$)/i);
  const scopedLanguage = domainScopeMatch ? domainScopeMatch[1].toLowerCase() : null;

  const KNOWN_SCOPED_DOMAINS = new Set([
    'java', 'python', 'javascript', 'typescript', 'c++', 'cpp', 'golang', 'go', 'rust',
    'c#', 'csharp', 'ruby', 'php', 'swift', 'kotlin', 'scala', 'sql', 'react', 'angular',
    'vue', 'node', 'nodejs'
  ]);

  if (scopedLanguage && KNOWN_SCOPED_DOMAINS.has(scopedLanguage)) {
    // Interrogative definition query: e.g. "What is [a/an/the]? <TERM> in <TECH>?"
    const interrogativeMatch = normalized.match(/^(what\s+is\s+(a\s+|an\s+|the\s+)?|explain\s+(the\s+)?|define\s+(the\s+)?|how\s+does\s+(the\s+)?)([a-z0-9_ -]+?)\s+in\s+([a-zA-Z0-9#+.]+)(?:\?|\.|$)/i);

    if (interrogativeMatch) {
      const candidateTerm = interrogativeMatch[6]?.trim().toLowerCase();
      if (candidateTerm && candidateTerm.length >= 3) {
        const singular = candidateTerm.replace(/e?s$/, '');
        const isKnown = CANONICAL_TERMS_SET.has(candidateTerm) || 
                        CANONICAL_TERMS_SET.has(singular) ||
                        TECHNICAL_VOCABULARY.some(t => t.canonical.toLowerCase() === candidateTerm || t.canonical.toLowerCase() === singular);
        const isCommonSafeWord = ['difference', 'example', 'feature', 'concept', 'method', 'class', 'function', 'object', 'code', 'error', 'interface', 'variable', 'annotation', 'keyword', 'library', 'package', 'module', 'stream', 'thread', 'loop', 'exception'].includes(candidateTerm);

        if (!isKnown && !isCommonSafeWord) {
          const bestMatch = findClosestTechnicalTerm(candidateTerm);
          if (bestMatch.similarity < 0.70) {
            hasUnknownSuspectTerm = true;
            suspectTerms.push(candidateTerm);
          }
        }
      }
    }
  }

  if (hasUnknownSuspectTerm && suspectTerms.length > 0) {
    const domainLabel = scopedLanguage || (detectedDomains.length > 0 ? detectedDomains[0] : 'this domain');
    suggestedClarification = `The term "${suspectTerms[0]}" is not a recognized standard concept in ${domainLabel}. Could you please clarify what you mean or provide more context?`;
  }

  // Capitalize first letter of normalized text
  if (normalized.length > 0) {
    normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  const latencyMs = parseFloat((performance.now() - startTime).toFixed(2));

  return {
    originalText: raw,
    normalizedText: normalized,
    corrections,
    detectedDomains,
    hasUnknownSuspectTerm,
    suspectTerms,
    suggestedClarification,
    latencyMs
  };
}

/**
 * Checks if a word or phrase has a negative collocation (medical, non-technical, etc.)
 */
function hasNegativeCollocation(word: string, fullText: string): boolean {
  const lower = fullText.toLowerCase();
  const clean = word.toLowerCase();

  // 1. Direct phrase regexes
  const regexes = NEGATIVE_COLLOCATIONS[clean];
  if (regexes) {
    for (const r of regexes) {
      if (r.test(lower)) return true;
    }
  }

  // 2. Neighbor context words
  const contextWords = NEGATIVE_CONTEXT_WORDS[clean];
  if (contextWords) {
    for (const cw of contextWords) {
      const reg = new RegExp(`\\b${cw}\\b`, 'i');
      if (reg.test(lower)) return true;
    }
  }

  return false;
}

/**
 * Finds the closest technical term for suspect validation
 */
function findClosestTechnicalTerm(term: string): { term: string; similarity: number } {
  let bestTerm = '';
  let maxSim = 0;

  for (const t of TECHNICAL_VOCABULARY) {
    const sim = Math.max(
      stringSimilarity(term, t.canonical),
      phoneticSimilarity(term, t.canonical, t.phoneticCodes)
    );
    if (sim > maxSim) {
      maxSim = sim;
      bestTerm = t.canonical;
    }
  }

  return { term: bestTerm, similarity: maxSim };
}
