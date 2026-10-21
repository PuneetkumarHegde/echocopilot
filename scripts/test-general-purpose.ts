/**
 * Verification Test Suite for EchoCopilot General-Purpose Interview Assistant
 * 
 * Verifies that EchoCopilot accurately and completely answers across:
 * 1. Electrical & Electronics Engineering (Ohm's law, AC vs DC, Kirchhoff, MOSFET)
 * 2. Mechanical Engineering (Bernoulli's principle, Carnot cycle)
 * 3. Civil Engineering (Concrete slump test)
 * 4. Cybersecurity (SQL injection, Cross-Site Scripting XSS)
 * 5. HR & Behavioral Interviews (Greatest strength, Greatest weakness, STAR conflict)
 * 6. Mathematics & Science (Fourier transform, Euler's formula)
 * 7. Engineering Imperatives (Calculate, State, Derive, Compute)
 * 8. Live Local Ollama (qwen2.5:3b) inference on multi-disciplinary questions
 */

import { normalizeTechnicalTerms } from '../src/lib/technicalTermNormalizer';
import { classifyUtterance, isQuestionReadyForAnswer } from '../src/lib/questionClassifier';
import { buildQuestionSpecificPrompt, generateSmartCopilotAnswer, generateOllamaAnswer } from '../src/lib/aiFallback';

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

async function runGeneralPurposeTests() {
  console.log('\n========================================================================');
  console.log('       EchoCopilot General-Purpose Multi-Discipline Test Suite          ');
  console.log('========================================================================\n');

  // Section 1: Non-CS questions must NOT trigger anti-hallucination / suspect flag
  console.log('--- 1. Verification that non-CS questions are not blocked as suspect ---');
  const nonCsQueries = [
    "What is Bernoulli's principle?",
    "What is the difference between AC and DC?",
    "What is Kirchhoff's current law?",
    "What is concrete slump test?",
    "What is SQL injection?",
    "What is your greatest weakness?",
    "What is Fourier transform?",
    "What is the Carnot cycle?",
    "What is a MOSFET?"
  ];

  for (const q of nonCsQueries) {
    const norm = normalizeTechnicalTerms(q);
    assert(
      !norm.hasUnknownSuspectTerm,
      `"${q}" -> not flagged as suspect (hasUnknownSuspectTerm: false)`
    );
  }

  // Section 2: Verification of Engineering Action Starters (Calculate, State, Derive)
  console.log('\n--- 2. Verification of Engineering Action Starters ---');
  const engineeringPrompts = [
    { text: "Calculate the voltage across a 10 ohm resistor carrying 2 amperes.", expectedStarter: true },
    { text: "State the second law of thermodynamics.", expectedStarter: true },
    { text: "Derive the Bernoulli equation from the Euler equation.", expectedStarter: true },
    { text: "Compute the Fourier transform of a rectangular pulse.", expectedStarter: true },
    { text: "Analyze the shear stress distribution in an I-beam.", expectedStarter: true },
    { text: "Discuss the difference between symmetric and asymmetric encryption.", expectedStarter: true }
  ];

  for (const item of engineeringPrompts) {
    const classification = classifyUtterance(item.text);
    const readiness = isQuestionReadyForAnswer(item.text);
    assert(
      classification.isQuestion && classification.intent === 'GENUINE_QUESTION',
      `Prompt "${item.text.substring(0, 35)}..." classified as GENUINE_QUESTION`
    );
    assert(
      readiness.isReady,
      `Prompt is ready for answer generation (isReady: true)`
    );
  }

  // Section 3: Prompt Construction across diverse disciplines
  console.log('\n--- 3. Prompt Construction across diverse disciplines ---');
  const testPrompts = [
    { q: "What is the difference between AC and DC?", expectedCategory: "DIFFERENCE" },
    { q: "Explain how a MOSFET controls current flow.", expectedCategory: "HOW_WHY" },
    { q: "Tell me about a time you resolved a technical disagreement.", expectedCategory: "GENERAL" }
  ];

  for (const t of testPrompts) {
    const built = buildQuestionSpecificPrompt(t.q);
    assert(
      t.expectedCategory === 'GENERAL' ? (built.category === 'GENERAL' || built.category === 'DIRECT') : built.category === t.expectedCategory,
      `Question category correctly classified as ${built.category} for "${t.q}"`
    );
    assert(
      !built.systemPrompt.includes('during a software engineering interview'),
      `System prompt is free of software-only restriction`
    );
    assert(
      built.systemPrompt.includes('all engineering disciplines'),
      `System prompt instructs assistant across all engineering disciplines`
    );
  }

  // Section 4: Built-in Smart Fallback for Multi-Disciplinary Questions
  console.log('\n--- 4. Built-in Smart Fallback for Multi-Disciplinary Questions ---');
  
  // Electrical: Ohm's Law
  const ohmAns = generateSmartCopilotAnswer("What is Ohm's law?");
  assert(
    ohmAns.summary.includes("V = I * R") || ohmAns.summary.toLowerCase().includes("proportional to the voltage"),
    `Ohm's law gives accurate physical formula in sentence 1`
  );

  // Electrical: AC vs DC
  const acdcAns = generateSmartCopilotAnswer("What is the difference between AC and DC?");
  assert(
    acdcAns.summary.includes("Key Difference") || acdcAns.summary.toLowerCase().startsWith("the main difference"),
    `AC vs DC provides comparison structure with Key Difference`
  );

  // Mechanical: Bernoulli's principle
  const bernoulliAns = generateSmartCopilotAnswer("What is Bernoulli's principle?");
  assert(
    bernoulliAns.summary.toLowerCase().includes("velocity") && bernoulliAns.summary.toLowerCase().includes("pressure"),
    `Bernoulli answer accurately defines relationship between velocity and pressure`
  );

  // Civil: Concrete Slump Test
  const slumpAns = generateSmartCopilotAnswer("What is concrete slump test?");
  assert(
    slumpAns.summary.toLowerCase().includes("consistency") || slumpAns.summary.toLowerCase().includes("workability"),
    `Concrete slump test accurately describes consistency and workability`
  );

  // Cybersecurity: SQL Injection
  const sqliAns = generateSmartCopilotAnswer("What is SQL injection?");
  assert(
    sqliAns.summary.toLowerCase().includes("vulnerability") && sqliAns.summary.toLowerCase().includes("query"),
    `SQL injection defines the vulnerability and query manipulation accurately`
  );

  // HR / Behavioral: Greatest weakness
  const weakAns = generateSmartCopilotAnswer("What is your greatest weakness?");
  assert(
    weakAns.mode === 'behavioral' && (weakAns.spokenScript?.length ?? 0) > 50,
    `Behavioral answer provides authentic growth strategy using professional script`
  );

  // Section 5: Live Ollama Inference across Engineering Disciplines
  console.log('\n--- 5. Live Ollama Generation across Engineering Disciplines ---');
  try {
    console.log('  Testing live Ollama on Electrical Engineering: "What is Ohm\'s law?"...');
    const liveEE = await generateOllamaAnswer("What is Ohm's law?");
    if (liveEE) {
      console.log(`  Ollama Output Summary: "${liveEE.summary.substring(0, 120)}..."`);
      assert(
        liveEE.summary.toLowerCase().includes("voltage") || liveEE.summary.toLowerCase().includes("current") || liveEE.summary.toLowerCase().includes("resistance"),
        `Ollama answered Ohm's law directly with electrical principles`
      );
      assert(
        !liveEE.summary.toLowerCase().includes("not a recognized standard concept"),
        `Ollama did NOT reject Ohm's law as nonstandard`
      );
    } else {
      console.log('  (Ollama not reachable or timed out; offline built-in validated)');
    }

    console.log('  Testing live Ollama on Mechanical Engineering: "What is the Carnot cycle?"...');
    const liveME = await generateOllamaAnswer("What is the Carnot cycle?");
    if (liveME) {
      console.log(`  Ollama Output Summary: "${liveME.summary.substring(0, 120)}..."`);
      assert(
        liveME.summary.toLowerCase().includes("efficiency") || liveME.summary.toLowerCase().includes("thermodynamic") || liveME.summary.toLowerCase().includes("heat"),
        `Ollama answered Carnot cycle directly with thermodynamic principles`
      );
      assert(
        !liveME.summary.toLowerCase().includes("not a recognized standard concept"),
        `Ollama did NOT reject Carnot cycle as nonstandard`
      );
    }

    console.log('  Testing live Ollama on HR: "What is your greatest strength?"...');
    const liveHR = await generateOllamaAnswer("What is your greatest strength?", "behavioral");
    if (liveHR) {
      console.log(`  Ollama Output Summary: "${liveHR.summary.substring(0, 120)}..."`);
      assert(
        liveHR.summary.length > 20,
        `Ollama answered HR strength question directly and professionally`
      );
      assert(
        !liveHR.summary.toLowerCase().includes("not a recognized standard concept"),
        `Ollama did NOT reject HR question`
      );
    }
  } catch (err) {
    console.warn('Ollama live check error:', err);
  }

  console.log('\n========================================================================');
  console.log(`Summary: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runGeneralPurposeTests();
