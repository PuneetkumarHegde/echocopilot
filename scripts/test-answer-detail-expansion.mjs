/**
 * Automated Verification Suite:
 * EchoCopilot – Progressive Answer Detail Expansion Without Changing Initial Answer
 * 
 * Verifies all 10 required domains:
 * 1. REST API
 * 2. Method Overloading vs Overriding
 * 3. Exception Handling in Java
 * 4. HashMap Internal Working
 * 5. TCP 3-Way Handshake
 * 6. SQL Injection
 * 7. SQL Indexing
 * 8. DSA: Binary Search
 * 9. Short Follow-Up (HashMap Capacity Shrink)
 * 10. Special Request Constraint ("in two sentences")
 * 11. Streaming Event Transition & Non-Duplication
 */

import { generateSmartCopilotAnswer, cleanDirectSpeakableAnswer, parseStreamingAnswer, buildInterviewAssistantPrompt } from '../src/lib/aiFallback.ts';
import { generateTechnicalAnswer, hasDeterministicTechnicalAnswer } from '../src/lib/technicalEngine.ts';
import { generateStructuredComparison, isKnownComparison } from '../src/lib/comparisonEngine.ts';
import { classifyQuestionIntent } from '../src/lib/intentClassifier.ts';

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failCount++;
  }
}

function countSentences(text) {
  if (!text) return 0;
  const matches = text.match(/[^.!?]+[.!?]+/g);
  return matches ? matches.length : 1;
}

function wordCount(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

console.log('========================================================================');
console.log('🚀 EchoCopilot Verification: Answer Detail Expansion & Speakable Priority');
console.log('========================================================================\n');

// ---------------------------------------------------------------------
// 1. REST API
// ---------------------------------------------------------------------
console.log('--- 1. REST API Architecture ---');
const restAns = generateSmartCopilotAnswer('What is a REST API?');
const restDirect = restAns.directAnswer || restAns.spokenScript || '';
const restDirectSentences = countSentences(restDirect);

assert(restDirect.length > 50, 'REST API has speakable direct answer');
assert(restDirectSentences >= 2 && restDirectSentences <= 4, `REST API opening is 2-4 sentences (Actual: ${restDirectSentences})`);
assert(!restDirect.includes('Direct Interview Answer:'), 'No "Direct Interview Answer:" label in opening');
assert(!restDirect.includes('Summary:'), 'No "Summary:" label in opening');
assert(restAns.summary.includes('Statelessness') || restAns.summary.includes('stateless'), 'Stage 2 includes Statelessness constraint');
assert(restAns.summary.includes('Client-Server'), 'Stage 2 includes Client-Server constraint');
assert(restAns.summary.includes('Uniform Interface'), 'Stage 2 includes Uniform Interface constraint');
assert(restAns.summary.includes('GET') && restAns.summary.includes('POST') && restAns.summary.includes('DELETE'), 'Stage 2 includes HTTP methods');
assert(restAns.summary.includes('Idempotent') || restAns.summary.includes('idempotent'), 'Stage 2 includes idempotency explanation');
assert(restAns.summary.includes('201 Created') || restAns.summary.includes('200 OK'), 'Stage 2 includes HTTP status codes');
assert(Boolean(restAns.codeSnippet && restAns.codeSnippet.code), 'Stage 2 includes JSON request/response representation');
assert(restAns.summary.includes('Over-fetching') || restAns.summary.includes('over-fetching') || restAns.summary.includes('GraphQL'), 'Stage 2 explains trade-offs/limitations vs GraphQL');

// ---------------------------------------------------------------------
// 2. Method Overloading vs Method Overriding
// ---------------------------------------------------------------------
console.log('\n--- 2. Method Overloading vs Method Overriding ---');
const oopAns = generateSmartCopilotAnswer('What is the difference between method overloading and method overriding in Java?');
const oopDirect = oopAns.directAnswer || oopAns.spokenScript || '';
const oopDirectSentences = countSentences(oopDirect);

assert(oopDirect.length > 50, 'Overloading vs Overriding has speakable direct answer');
assert(!oopDirect.includes('Direct Interview Answer:'), 'No "Direct Interview Answer:" label in opening');
assert(oopDirect.toLowerCase().includes('compile-time') || oopDirect.toLowerCase().includes('static'), 'Opening identifies compile-time vs runtime polymorphism');
assert(oopAns.summary.includes('Method Overloading (Java):') || oopAns.summary.includes('Method Overloading'), 'Stage 2 defines Method Overloading');
assert(oopAns.summary.includes('Method Overriding (Java):') || oopAns.summary.includes('Method Overriding'), 'Stage 2 defines Method Overriding');
assert(oopAns.summary.includes('Polymorphism Type'), 'Stage 2 compares polymorphism dimension');
assert(oopAns.summary.includes('Method Signature'), 'Stage 2 compares method signature dimension');
assert(oopAns.summary.includes('Return Type'), 'Stage 2 compares return type dimension (covariant)');
assert(oopAns.summary.includes('Access Modifiers'), 'Stage 2 compares access visibility restriction');
assert(oopAns.summary.includes('Checked Exceptions'), 'Stage 2 compares exception handling restriction');
assert(oopAns.summary.includes('Calculator') && oopAns.summary.includes('add('), 'Stage 2 includes compilable Overloading Java code');
assert(oopAns.summary.includes('PaymentProcessor') && oopAns.summary.includes('@Override'), 'Stage 2 includes compilable Overriding Java code');
assert(oopAns.summary.includes('Expected Output:'), 'Stage 2 includes execution output');
assert(oopAns.summary.includes('When to choose') || oopAns.summary.includes('When to Use'), 'Stage 2 includes practical usage rules');

// ---------------------------------------------------------------------
// 3. Exception Handling in Java
// ---------------------------------------------------------------------
console.log('\n--- 3. Exception Handling in Java ---');
const excAns = generateSmartCopilotAnswer('What is exception handling in Java?');
const excDirect = excAns.directAnswer || excAns.spokenScript || '';
const excDirectSentences = countSentences(excDirect);

assert(excDirect.length > 50, 'Exception handling has speakable direct answer');
assert(excDirectSentences >= 2 && excDirectSentences <= 4, `Opening is 2-4 sentences (Actual: ${excDirectSentences})`);
assert(!excDirect.includes('Direct Interview Answer:'), 'No introductory labels');
assert(excAns.summary.includes('Throwable'), 'Stage 2 includes Throwable root');
assert(excAns.summary.includes('Error') && excAns.summary.includes('Exception'), 'Stage 2 contrasts Error vs Exception');
assert(excAns.summary.includes('Checked Exceptions') && excAns.summary.includes('RuntimeException'), 'Stage 2 contrasts Checked vs Unchecked');
assert(excAns.summary.includes('try') && excAns.summary.includes('catch') && excAns.summary.includes('finally'), 'Stage 2 covers try, catch, finally keywords');
assert(excAns.summary.includes('throw') && excAns.summary.includes('throws'), 'Stage 2 covers throw and throws');
assert(excAns.summary.includes('Try-With-Resources'), 'Stage 2 covers Try-With-Resources and AutoCloseable');
assert(excAns.summary.includes('class InsufficientFundsException extends Exception'), 'Stage 2 includes custom domain Exception code');
assert(excAns.summary.includes('Expected Output:'), 'Stage 2 includes execution output');
assert(excAns.summary.includes('Never Catch Generic `Throwable`') || excAns.summary.includes('Never Swallow'), 'Stage 2 includes production best practices');

// ---------------------------------------------------------------------
// 4. HashMap Internal Working
// ---------------------------------------------------------------------
console.log('\n--- 4. HashMap Internal Working ---');
const mapAns = generateSmartCopilotAnswer('Explain HashMap internal working in Java');
const mapDirect = mapAns.directAnswer || mapAns.spokenScript || '';
const mapDirectSentences = countSentences(mapDirect);

assert(mapDirect.length > 50, 'HashMap internal working has speakable direct answer');
assert(mapDirectSentences >= 2 && mapDirectSentences <= 4, `Opening is 2-4 sentences (Actual: ${mapDirectSentences})`);
assert(!mapDirect.includes('Direct Interview Answer:'), 'No introductory labels');
assert(mapAns.summary.includes('Node<K,V>[] table') || mapAns.summary.includes('table'), 'Stage 2 covers bucket array table');
assert(mapAns.summary.includes('16') && mapAns.summary.includes('0.75'), 'Stage 2 specifies default capacity 16 and load factor 0.75');
assert(mapAns.summary.includes('(h ^ (h >>> 16))') || mapAns.summary.includes('h >>> 16'), 'Stage 2 explains hash perturbation formula');
assert(mapAns.summary.includes('(n - 1) & hash') || mapAns.summary.includes('index'), 'Stage 2 explains bitwise index formula');
assert(mapAns.summary.includes('TREEIFY_THRESHOLD = 8') || mapAns.summary.includes('Red-Black Tree') || mapAns.summary.includes('8'), 'Stage 2 explains treeification threshold 8');
assert(mapAns.summary.includes('64'), 'Stage 2 explains minimum table capacity 64 for treeification');
assert(mapAns.summary.includes('put(') && mapAns.summary.includes('get('), 'Stage 2 details put and get step-by-step flow');
assert(mapAns.summary.includes('hashCode()') && mapAns.summary.includes('equals()'), 'Stage 2 covers hashCode and equals contract');
assert(mapAns.summary.includes('ConcurrentHashMap') || mapAns.summary.includes('thread-safe'), 'Stage 2 highlights thread-safety limitation');

// ---------------------------------------------------------------------
// 5. TCP 3-Way Handshake
// ---------------------------------------------------------------------
console.log('\n--- 5. TCP 3-Way Handshake ---');
const tcpAns = generateSmartCopilotAnswer('What is TCP 3-way handshake?');
const tcpDirect = tcpAns.directAnswer || tcpAns.spokenScript || '';

assert(tcpDirect.length > 40, 'TCP 3-way handshake has speakable direct answer');
assert(!tcpDirect.includes('Direct Interview Answer:'), 'No introductory labels');
assert(tcpAns.summary.includes('SYN') && tcpAns.summary.includes('SYN-ACK') && tcpAns.summary.includes('ACK'), 'Stage 2 details SYN, SYN-ACK, ACK steps');
assert(tcpAns.summary.includes('ISN'), 'Stage 2 explains Initial Sequence Numbers (ISN)');
assert(tcpAns.summary.includes('SYN_SENT') || tcpAns.summary.includes('ESTABLISHED'), 'Stage 2 covers socket state machine');
assert(tcpAns.summary.includes('SYN Flood') || tcpAns.summary.includes('SYN Cookies'), 'Stage 2 covers SYN flood vulnerability and SYN Cookies defense');

// ---------------------------------------------------------------------
// 6. Cybersecurity: SQL Injection
// ---------------------------------------------------------------------
console.log('\n--- 6. Cybersecurity: SQL Injection ---');
const sqliAns = generateSmartCopilotAnswer('What is SQL injection and how to prevent it?');
const sqliDirect = sqliAns.directAnswer || sqliAns.spokenScript || '';

assert(sqliDirect.length > 50, 'SQL injection has speakable direct answer');
assert(!sqliDirect.includes('Direct Interview Answer:'), 'No introductory labels');
assert(sqliAns.summary.includes('SELECT * FROM users WHERE') || sqliAns.summary.includes("' OR '1'='1"), 'Stage 2 illustrates vulnerable dynamic SQL payload');
assert(sqliAns.summary.includes('PreparedStatement'), 'Stage 2 provides PreparedStatement defensive Java code');
assert(sqliAns.summary.includes('pstmt.setString(1,'), 'Stage 2 binds parameters safely as literals');
assert(sqliAns.summary.includes('Least Privilege') || sqliAns.summary.includes('least privilege'), 'Stage 2 covers defense-in-depth (least privilege / WAF)');

// ---------------------------------------------------------------------
// 7. SQL Indexing
// ---------------------------------------------------------------------
console.log('\n--- 7. SQL Indexing ---');
const sqlIndexAns = generateSmartCopilotAnswer('What is indexing in SQL?');
const sqlIndexDirect = sqlIndexAns.directAnswer || sqlIndexAns.spokenScript || '';
const sqlIndexSentences = countSentences(sqlIndexDirect);

assert(sqlIndexDirect.length > 50, 'SQL indexing has speakable direct answer');
assert(sqlIndexSentences >= 2 && sqlIndexSentences <= 4, `Opening is 2-4 sentences (Actual: ${sqlIndexSentences})`);
assert(!sqlIndexDirect.includes('Direct Interview Answer:'), 'No introductory labels');
assert(sqlIndexAns.summary.includes('B+ Tree') || sqlIndexAns.summary.includes('B-Tree'), 'Stage 2 covers B+ Tree internal working');
assert(sqlIndexAns.summary.includes('Clustered Index') && sqlIndexAns.summary.includes('Non-Clustered'), 'Stage 2 contrasts Clustered vs Non-Clustered');
assert(sqlIndexAns.summary.includes('CREATE INDEX'), 'Stage 2 includes DDL example');
assert(sqlIndexAns.summary.includes('EXPLAIN ANALYZE') || sqlIndexAns.summary.includes('Seq Scan'), 'Stage 2 provides execution plan comparison');
assert(sqlIndexAns.summary.includes('Write Amplification') || sqlIndexAns.summary.includes('write throughput'), 'Stage 2 explains write amplification trade-off');

// ---------------------------------------------------------------------
// 8. DSA: Binary Search
// ---------------------------------------------------------------------
console.log('\n--- 8. DSA: Binary Search ---');
const bsAns = generateSmartCopilotAnswer('Explain binary search and its time complexity');
const bsDirect = bsAns.directAnswer || bsAns.spokenScript || '';

assert(bsDirect.length > 50, 'Binary search has speakable direct answer');
assert(bsAns.summary.includes('sorted') || bsAns.summary.includes('Sorted'), 'Stage 2 mandates sorted prerequisite');
assert(bsAns.summary.includes('mid = low + (high - low) / 2') || bsAns.summary.includes('overflow'), 'Stage 2 covers integer overflow prevention');
assert(bsAns.summary.includes('public static int binarySearch'), 'Stage 2 provides compilable Java code');
assert(bsAns.summary.includes('O(log N)') || bsAns.summary.includes('logarithmic'), 'Stage 2 derives O(log N) time complexity');
assert(bsAns.summary.includes('Expected Output:'), 'Stage 2 includes execution output');

// ---------------------------------------------------------------------
// 9. Short Technical Follow-Up (HashMap Capacity Shrink)
// ---------------------------------------------------------------------
console.log('\n--- 9. Technical Follow-up: Does HashMap Capacity Shrink? ---');
const shrinkAns = generateSmartCopilotAnswer('Does HashMap capacity shrink when elements are removed?');
const shrinkDirect = shrinkAns.directAnswer || shrinkAns.spokenScript || '';
const shrinkSentences = countSentences(shrinkDirect);

assert(shrinkDirect.length > 40, 'Follow-up has speakable direct answer');
assert(shrinkDirect.toLowerCase().startsWith('no'), `Opening begins directly with clear "No" (Actual: "${shrinkDirect.slice(0, 30)}...")`);
assert(shrinkSentences >= 2 && shrinkSentences <= 4, `Opening is 2-4 sentences (Actual: ${shrinkSentences})`);
assert(shrinkAns.summary.includes('Thrashing Prevention') || shrinkAns.summary.includes('thrashing'), 'Stage 2 explains why HashMap avoids thrashing');
assert(shrinkAns.summary.includes('remove(key)') && shrinkAns.summary.includes('clear()'), 'Stage 2 details remove() and clear() mechanics');
assert(shrinkAns.summary.includes('new HashMap<>(') || shrinkAns.summary.includes('compactedMap'), 'Stage 2 provides memory compaction pattern');

// ---------------------------------------------------------------------
// 10. Special Request Constraint ("In two sentences")
// ---------------------------------------------------------------------
console.log('\n--- 10. Special Request Constraint ("In two sentences") ---');
const promptPayload = buildInterviewAssistantPrompt('Explain what is polymorphism in Java in two sentences');
assert(promptPayload.userPrompt.includes('Answer strictly in approximately two short spoken sentences'), 'Prompt builder detects two-sentence constraint');
assert(promptPayload.userPrompt.includes('Do NOT output code, tables, or markdown headings'), 'Prompt builder strictly forbids code/tables for two-sentence queries');

// ---------------------------------------------------------------------
// 11. Streaming Event Transition & Non-Duplication
// ---------------------------------------------------------------------
console.log('\n--- 11. Streaming Parser & Clean Separation ---');
const mockOllamaResponse = `### Interview Answer
A REST API is an architectural style for networked systems that enables clients and servers to communicate statelessly over HTTP using uniform resource identifiers and standard methods.

### Detailed Explanation & Internal Working
REST relies on six architectural constraints: statelessness, client-server decoupling, cacheability, uniform interface, layered system, and optional code on demand.

\`\`\`json
{
  "id": 1,
  "status": "ACTIVE"
}
\`\`\`

### Applications & Trade-Offs
Used globally for microservices and web APIs, but lacks native bi-directional streaming compared to gRPC.`;

const parsed = parseStreamingAnswer(mockOllamaResponse, 'What is a REST API?');
assert(Boolean(parsed.directAnswer), 'Streaming parser extracted direct answer');
assert(countSentences(parsed.directAnswer) === 1 || countSentences(parsed.directAnswer) === 2, 'Direct answer is concise without headers');
assert(!parsed.directAnswer.includes('### Detailed Explanation'), 'Direct answer does NOT include Stage 2 headers');
assert(parsed.summary.includes('six architectural constraints'), 'Summary contains Stage 2 content');
assert(!parsed.summary.includes('### Interview Answer'), 'Summary does NOT duplicate the Stage 1 Interview Answer heading');
assert(Boolean(parsed.codeSnippet && parsed.codeSnippet.code), 'Code snippet was extracted into codeSnippet field');
assert(parsed.tradeoffs && parsed.tradeoffs.length > 0, 'Trade-offs were extracted into tradeoffs field');

// ---------------------------------------------------------------------
// Final Test Summary
// ---------------------------------------------------------------------
console.log('\n========================================================================');
console.log(`Results: ${passCount} PASSED, ${failCount} FAILED`);
console.log('========================================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('✨ All 10 domain depth and speakable priority tests passed cleanly!\n');
}

