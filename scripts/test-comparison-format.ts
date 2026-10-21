import { buildQuestionSpecificPrompt, generateOllamaAnswer, generateSmartCopilotAnswer, parseStreamingAnswer } from '../src/lib/aiFallback';
import { classifyUtterance, isQuestionReadyForAnswer, isDualConceptComparison } from '../src/lib/questionClassifier';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  [PASS] ${message}`);
}

async function main() {
  console.log('========================================================================');
  console.log('       EchoCopilot Structured Comparison Answers Test Suite             ');
  console.log('========================================================================\n');

  let passed = 0;

  // ------------------------------------------------------------------------
  // Section 1: Dual-Concept & Comparison Utterance Classification
  // ------------------------------------------------------------------------
  console.log('--- 1. Dual-Concept & Comparison Utterance Classification ---');

  const comparisonQueries = [
    "What is the difference between method overriding and method overloading?",
    "Explain method overriding and method overloading.",
    "What are method overriding and method overloading?",
    "Method overriding vs method overloading",
    "What are processes and threads?",
    "Explain synchronous and asynchronous programming.",
    "What are AC and DC?",
    "AC vs DC",
    "What is the difference between stress and strain?",
    "Compare TCP and UDP."
  ];

  for (const q of comparisonQueries) {
    const res = classifyUtterance(q);
    const ready = isQuestionReadyForAnswer(q);
    assert(res.isQuestion && res.category === 'DIFFERENCE', `"${q}" classified as category: DIFFERENCE`);
    assert(ready.isReady, `"${q}" is ready for answer generation`);
    passed += 2;
  }

  // ------------------------------------------------------------------------
  // Section 2: Single-Concept Questions NOT forced into comparison format
  // ------------------------------------------------------------------------
  console.log('\n--- 2. Single-Concept Definition Questions NOT Forced Into Comparison ---');

  const singleConceptQueries = [
    "What is method overriding?",
    "Explain method overriding.",
    "What are the SOLID principles?",
    "What are microservices?",
    "What is a process in an operating system?",
    "Define Ohm's law."
  ];

  for (const q of singleConceptQueries) {
    const res = classifyUtterance(q);
    assert(res.category !== 'DIFFERENCE', `"${q}" is NOT classified as DIFFERENCE (category: ${res.category})`);
    const dual = isDualConceptComparison(q);
    assert(!dual.isDual, `"${q}" isDualConceptComparison returns false`);
    passed += 2;
  }

  // ------------------------------------------------------------------------
  // Section 3: Incomplete comparison questions blocked
  // ------------------------------------------------------------------------
  console.log('\n--- 3. Incomplete Comparison Questions Gatekeeping ---');

  const incompleteQueries = [
    "What is the difference?",
    "What is the difference between",
    "Compare",
    "Explain difference"
  ];

  for (const q of incompleteQueries) {
    const ready = isQuestionReadyForAnswer(q);
    assert(!ready.isReady, `Incomplete query "${q}" blocked before answer generation`);
    passed++;
  }

  // ------------------------------------------------------------------------
  // Section 4: Prompt Construction for Comparison vs Definition
  // ------------------------------------------------------------------------
  console.log('\n--- 4. Prompt Construction for Comparison vs Definition ---');

  const compPrompt = buildQuestionSpecificPrompt("What is the difference between method overriding and method overloading?");
  assert(compPrompt.category === 'DIFFERENCE', 'Category is DIFFERENCE for comparison question');
  assert(compPrompt.systemPrompt.includes('**[Concept A] — Definition**'), 'Prompt instructs **[Concept A] — Definition**');
  assert(compPrompt.systemPrompt.includes('**[Concept B] — Definition**'), 'Prompt instructs **[Concept B] — Definition**');
  assert(compPrompt.systemPrompt.includes('**Key Differences**'), 'Prompt instructs **Key Differences**');
  assert(compPrompt.systemPrompt.includes('**Interview Summary**'), 'Prompt instructs **Interview Summary**');
  passed += 5;

  const defPrompt = buildQuestionSpecificPrompt("What is method overloading?");
  assert(defPrompt.category === 'DIRECT', 'Category is DIRECT for single definition question');
  assert(defPrompt.systemPrompt.includes('**Definition**'), 'Definition prompt instructs **Definition**');
  assert(defPrompt.systemPrompt.includes('**Key Points**'), 'Definition prompt instructs **Key Points**');
  assert(defPrompt.systemPrompt.includes('**Important Note**'), 'Definition prompt instructs **Important Note**');
  passed += 4;

  // ------------------------------------------------------------------------
  // Section 5: Built-in Smart Fallback Structured Formatting
  // ------------------------------------------------------------------------
  console.log('\n--- 5. Built-in Smart Fallback Structured Formatting ---');

  const overAns = generateSmartCopilotAnswer("What is the difference between method overriding and method overloading?");
  assert(overAns.summary.includes('**Method Overriding — Definition**'), 'Overriding vs overloading includes **Method Overriding — Definition**');
  assert(overAns.summary.includes('**Method Overloading — Definition**'), 'Overriding vs overloading includes **Method Overloading — Definition**');
  assert(overAns.summary.includes('**Key Differences**'), 'Overriding vs overloading includes **Key Differences**');
  assert(overAns.summary.includes('**Interview Summary**'), 'Overriding vs overloading includes **Interview Summary**');
  passed += 4;

  const defAns = generateSmartCopilotAnswer("What is method overloading?");
  assert(defAns.summary.includes('**Definition**'), 'Method overloading includes **Definition**');
  assert(defAns.summary.includes('**Key Points**'), 'Method overloading includes **Key Points**');
  assert(defAns.summary.includes('**Example**'), 'Method overloading includes **Example**');
  assert(defAns.summary.includes('**Important Note**'), 'Method overloading includes **Important Note**');
  passed += 4;

  const procAns = generateSmartCopilotAnswer("What is the difference between a process and a thread?");
  assert(procAns.summary.includes('**Process — Definition**'), 'Process vs thread includes **Process — Definition**');
  assert(procAns.summary.includes('**Thread — Definition**'), 'Process vs thread includes **Thread — Definition**');
  assert(procAns.summary.includes('**Key Differences**'), 'Process vs thread includes **Key Differences**');
  assert(procAns.summary.includes('**Interview Summary**'), 'Process vs thread includes **Interview Summary**');
  passed += 4;

  const sqlAns = generateSmartCopilotAnswer("What is the difference between SQL and NoSQL?");
  assert(sqlAns.summary.includes('**SQL Relational Databases — Definition**'), 'SQL vs NoSQL includes **SQL Relational Databases — Definition**');
  assert(sqlAns.summary.includes('**NoSQL Databases — Definition**'), 'SQL vs NoSQL includes **NoSQL Databases — Definition**');
  assert(sqlAns.summary.includes('**Key Differences**'), 'SQL vs NoSQL includes **Key Differences**');
  assert(sqlAns.summary.includes('**Interview Summary**'), 'SQL vs NoSQL includes **Interview Summary**');
  passed += 4;

  // Dynamic fallback for open-domain dual concepts
  const openDualAns = generateSmartCopilotAnswer("Explain laminar flow and turbulent flow.");
  assert(openDualAns.summary.includes('**Laminar flow — Definition**'), 'Dynamic fallback includes **Laminar flow — Definition**');
  assert(openDualAns.summary.includes('**Turbulent flow — Definition**'), 'Dynamic fallback includes **Turbulent flow — Definition**');
  assert(openDualAns.summary.includes('**Key Differences**'), 'Dynamic fallback includes **Key Differences**');
  assert(openDualAns.summary.includes('**Interview Summary**'), 'Dynamic fallback includes **Interview Summary**');
  passed += 4;

  // ------------------------------------------------------------------------
  // Section 6: parseStreamingAnswer Layered Markdown and Asterisk Preservation
  // ------------------------------------------------------------------------
  console.log('\n--- 6. parseStreamingAnswer Layered Markdown and Asterisk Preservation ---');

  const testCompRaw = `**Method Overriding — Definition**

Method overriding occurs when a subclass provides its own implementation of an inherited instance method while keeping the same method signature. It supports runtime polymorphism in Java.

**Method Overloading — Definition**

Method overloading means defining methods with the same name but different parameter lists, usually in the same class.

**Key Differences**
- **Purpose:** Overriding specializes inherited behavior; overloading provides different ways to perform an operation.
- **Parameters:** Overriding uses a compatible method signature; overloading requires different parameter lists.
- **Polymorphism:** Overriding supports runtime polymorphism; overloading is commonly associated with compile-time polymorphism.

**Example**
\`\`\`java
class Animal { void sound() {} }
class Dog extends Animal { @Override void sound() {} }
\`\`\`

**Interview Summary**
Overriding changes inherited method behavior, while overloading defines multiple versions of a method with different parameters.`;

  const parsedComp = parseStreamingAnswer(testCompRaw, "What is the difference between method overriding and method overloading?");
  assert(parsedComp.summary.includes('**Method Overriding — Definition**'), 'parseStreamingAnswer preserves **Method Overriding — Definition**');
  assert(parsedComp.summary.includes('**Method Overloading — Definition**'), 'parseStreamingAnswer preserves **Method Overloading — Definition**');
  assert(parsedComp.summary.includes('**Key Differences**'), 'parseStreamingAnswer preserves **Key Differences**');
  assert(parsedComp.summary.includes('**Interview Summary**'), 'parseStreamingAnswer preserves **Interview Summary**');
  assert(Boolean(parsedComp.spokenScript?.includes('Overriding changes inherited method behavior')), 'parseStreamingAnswer extracts interview summary soundbite');
  assert(!parsedComp.isIncomplete, 'Answer cleanly terminated (isIncomplete: false)');
  passed += 6;

  const testDefRaw = `**Definition**

Method overloading in Java means defining multiple methods with the same name but different parameter lists, such as different numbers or types of parameters.

**Key Points**
- It is an example of compile-time polymorphism.
- Overloaded methods must differ in their parameter lists; changing only the return type is not sufficient.
- The compiler selects the appropriate overload based on the arguments and applicable method-resolution rules.

**Example**
\`\`\`java
class Calculator {
    int add(int a, int b) { return a + b; }
    int add(int a, int b, int c) { return a + b + c; }
}
\`\`\`

**Important Note**
Overloading is determined by the method signature's parameter list, not by the return type alone.`;

  const parsedDef = parseStreamingAnswer(testDefRaw, "What is method overloading?");
  assert(parsedDef.summary.includes('**Definition**'), 'parseStreamingAnswer preserves **Definition**');
  assert(parsedDef.summary.includes('**Key Points**'), 'parseStreamingAnswer preserves **Key Points**');
  assert(parsedDef.summary.includes('**Important Note**'), 'parseStreamingAnswer preserves **Important Note**');
  assert(Boolean(parsedDef.spokenScript?.includes('Method overloading in Java means')), 'parseStreamingAnswer extracts spoken opening definition');
  assert(Boolean(parsedDef.codeSnippet?.code.includes('int add(int a, int b)')), 'parseStreamingAnswer extracts codeSnippet');
  passed += 6;

  // ------------------------------------------------------------------------
  // Section 7: Live Local Ollama Verification (qwen2.5:3b)
  // ------------------------------------------------------------------------
  console.log('\n--- 7. Live Local Ollama Verification (qwen2.5:3b) ---');

  console.log('Testing live Ollama on comparison: "What is the difference between method overriding and method overloading?"...');
  const liveComparison = await generateOllamaAnswer("What is the difference between method overriding and method overloading?");
  if (liveComparison) {
    console.log('Live Ollama Summary:\n' + liveComparison.summary.substring(0, 300) + '...\n');
    assert(liveComparison.summary.includes('Definition') || liveComparison.summary.includes('Method Overriding'), 'Ollama generated Concept Definition');
    assert(liveComparison.summary.includes('Key Differences') || liveComparison.summary.includes('Differences'), 'Ollama generated Key Differences');
    passed += 2;
  } else {
    console.warn('Ollama not reachable for live test, skipping section 7');
  }

  console.log('Testing live Ollama on definition-only: "What is method overloading?"...');
  const liveDefinition = await generateOllamaAnswer("What is method overloading?");
  if (liveDefinition) {
    console.log('Live Ollama Definition Summary:\n' + liveDefinition.summary.substring(0, 250) + '...\n');
    assert(liveDefinition.summary.includes('**Definition**') || liveDefinition.summary.includes('Definition'), 'Ollama generated Definition section');
    assert(liveDefinition.summary.includes('**Key Points**') || liveDefinition.summary.includes('Key Points'), 'Ollama generated Key Points section');
    passed += 2;
  }

  console.log('\n========================================================================');
  console.log(`Results: ${passed} PASSED, 0 FAILED`);
  console.log('========================================================================\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
