/**
 * Regression Test Suite for Local Technical-Term Guess Engine
 * 
 * Verifies:
 * 1. "What is the difference between throat and process?" -> In OS context, likely "thread and process".
 * 2. "What is checker exception in Java?" -> "What is checked exception in Java?"
 * 3. "What is unchecker exception?" -> "What is unchecked exception?"
 * 4. "What is the difference between checked and unchecked exceptions?" -> Preserve the correct terms unchanged.
 * 5. "What is the difference between a thread and a process?" -> No unnecessary correction.
 * 6. "What is the difference between a throat infection and a process?" -> Do not blindly change "throat" to "thread".
 * 7. An unknown technical term with no reliable match -> Do not fabricate a definition.
 * 8. Performance profiling: added normalization latency < 2ms.
 */

import { normalizeTechnicalTerms } from '../src/lib/technicalTermNormalizer';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('EchoCopilot Technical-Term Guess Engine Regression Suite');
  console.log('======================================================\n');

  // Test 1: "What is the difference between throat and process?" -> "thread and process"
  console.log('[Test 1] "What is the difference between throat and process?"');
  const t1 = normalizeTechnicalTerms("What is the difference between throat and process?", ["operating systems interview"]);
  console.log(`  Raw:        "${t1.originalText}"`);
  console.log(`  Normalized: "${t1.normalizedText}"`);
  console.log(`  Corrections:`, t1.corrections);
  console.log(`  Latency:     ${t1.latencyMs}ms`);
  assert(
    t1.normalizedText.toLowerCase().includes("thread and process"),
    `Normalized "throat and process" -> "thread and process"`
  );
  assert(
    t1.corrections.some(c => c.original.toLowerCase() === "throat" && c.corrected.toLowerCase() === "thread" && c.confidence >= 0.75),
    `Correction confidence >= 0.75 (${t1.corrections[0]?.confidence})`
  );

  // Test 2: "What is checker exception in Java?" -> "What is checked exception in Java?"
  console.log('\n[Test 2] "What is checker exception in Java?"');
  const t2 = normalizeTechnicalTerms("What is checker exception in Java?");
  console.log(`  Raw:        "${t2.originalText}"`);
  console.log(`  Normalized: "${t2.normalizedText}"`);
  console.log(`  Corrections:`, t2.corrections);
  assert(
    t2.normalizedText.toLowerCase().includes("checked exception"),
    `Normalized "checker exception" -> "checked exception"`
  );

  // Test 3: "What is unchecker exception?" -> "What is unchecked exception?"
  console.log('\n[Test 3] "What is unchecker exception?"');
  const t3 = normalizeTechnicalTerms("What is unchecker exception?");
  console.log(`  Raw:        "${t3.originalText}"`);
  console.log(`  Normalized: "${t3.normalizedText}"`);
  console.log(`  Corrections:`, t3.corrections);
  assert(
    t3.normalizedText.toLowerCase().includes("unchecked exception"),
    `Normalized "unchecker exception" -> "unchecked exception"`
  );

  // Test 4: "What is the difference between checked and unchecked exceptions?" -> Preserve unchanged
  console.log('\n[Test 4] "What is the difference between checked and unchecked exceptions?"');
  const t4 = normalizeTechnicalTerms("What is the difference between checked and unchecked exceptions?");
  console.log(`  Raw:        "${t4.originalText}"`);
  console.log(`  Normalized: "${t4.normalizedText}"`);
  console.log(`  Corrections:`, t4.corrections);
  assert(
    t4.corrections.length === 0,
    `Valid technical terms preserved without erroneous correction`
  );
  assert(
    t4.normalizedText.toLowerCase().includes("checked and unchecked exceptions"),
    `Original technical phrase intact`
  );

  // Test 5: "What is the difference between a thread and a process?" -> No unnecessary correction
  console.log('\n[Test 5] "What is the difference between a thread and a process?"');
  const t5 = normalizeTechnicalTerms("What is the difference between a thread and a process?");
  console.log(`  Raw:        "${t5.originalText}"`);
  console.log(`  Normalized: "${t5.normalizedText}"`);
  console.log(`  Corrections:`, t5.corrections);
  assert(
    t5.corrections.length === 0,
    `Valid "thread and a process" preserved without correction`
  );
  assert(
    t5.normalizedText.toLowerCase().includes("thread and a process"),
    `"thread and a process" preserved accurately`
  );

  // Test 6: "What is the difference between a throat infection and a process?" -> Do not change "throat" to "thread"
  console.log('\n[Test 6] "What is the difference between a throat infection and a process?"');
  const t6 = normalizeTechnicalTerms("What is the difference between a throat infection and a process?");
  console.log(`  Raw:        "${t6.originalText}"`);
  console.log(`  Normalized: "${t6.normalizedText}"`);
  console.log(`  Corrections:`, t6.corrections);
  assert(
    !t6.normalizedText.toLowerCase().includes("thread infection"),
    `Collocation guard prevents "thread infection"`
  );
  assert(
    t6.normalizedText.toLowerCase().includes("throat infection"),
    `Preserved natural medical collocation "throat infection"`
  );

  // Test 7: An unknown technical term with no reliable match -> Do not fabricate a definition
  console.log('\n[Test 7] Unknown technical term with no reliable match');
  const t7 = normalizeTechnicalTerms("What is a flurbenoid in Java?");
  console.log(`  Raw:        "${t7.originalText}"`);
  console.log(`  Normalized: "${t7.normalizedText}"`);
  console.log(`  Suspect:    ${t7.hasUnknownSuspectTerm} (${t7.suspectTerms.join(', ')})`);
  console.log(`  Clarify:    "${t7.suggestedClarification}"`);
  assert(
    t7.hasUnknownSuspectTerm === true,
    `Unfamiliar nonstandard term "flurbenoid" flagged as suspect`
  );
  assert(
    Boolean(t7.suggestedClarification && t7.suggestedClarification.includes("flurbenoid")),
    `Generated clarification suggestion for unknown term instead of fabricating`
  );

  // Latency Profiling
  console.log('\n[Test 8] Normalization Latency Benchmark (100 iterations)');
  const startBench = performance.now();
  for (let i = 0; i < 100; i++) {
    normalizeTechnicalTerms("What is the difference between throat and process?");
    normalizeTechnicalTerms("What is checker exception in Java?");
    normalizeTechnicalTerms("What is unchecker exception?");
  }
  const totalBenchMs = performance.now() - startBench;
  const avgLatencyMs = totalBenchMs / 300;
  console.log(`  300 normalizations completed in ${totalBenchMs.toFixed(2)}ms`);
  console.log(`  Average Latency per query: ${avgLatencyMs.toFixed(3)}ms`);
  assert(
    avgLatencyMs < 2.0,
    `Added normalization latency is negligible (< 2.0ms, measured ${avgLatencyMs.toFixed(3)}ms)`
  );

  console.log(`\n========================================`);
  console.log(`Summary: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
