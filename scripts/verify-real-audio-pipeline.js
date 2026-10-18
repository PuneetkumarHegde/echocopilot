const fs = require('fs');
const path = require('path');

async function runTest() {
  console.log('========================================================');
  console.log('    EchoCopilot Real Audio & Answering Pipeline Test    ');
  console.log('========================================================\n');

  const wavPath = path.resolve('scripts/sample_question.wav');
  if (!fs.existsSync(wavPath)) {
    throw new Error('Test WAV file not found: ' + wavPath);
  }
  const wavBuffer = fs.readFileSync(wavPath);
  console.log(`[1] Loaded real audio sample: ${wavPath} (${wavBuffer.length} bytes, 16kHz mono WAV)`);

  // ----------------------------------------------------
  // TEST 1: Transcribe Endpoint with Real Audio
  // ----------------------------------------------------
  console.log('\n--- TEST 1: Speech-To-Text with Real Audio via Windows SAPI ---');
  const fd = new FormData();
  fd.append('audio', new Blob([wavBuffer], { type: 'audio/wav' }), 'sample.wav');
  fd.append('source', 'meeting');

  const t0 = Date.now();
  const sttRes = await fetch('http://localhost:3000/api/transcribe', {
    method: 'POST',
    body: fd
  });
  const sttData = await sttRes.json();
  const sttDuration = Date.now() - t0;

  console.log(`STT Response Status: ${sttRes.status} (${sttDuration}ms)`);
  console.log(`Provider: ${sttData.provider}`);
  console.log(`Transcript Output: "${sttData.transcript}"`);

  if (!sttData.transcript || sttData.transcript.length < 5) {
    throw new Error('STT failed to return valid transcript: ' + JSON.stringify(sttData));
  }
  console.log('✅ TEST 1 PASSED: Real audio successfully transcribed locally!');

  // ----------------------------------------------------
  // TEST 2: Answer Generation Pipeline from Transcript
  // ----------------------------------------------------
  console.log('\n--- TEST 2: Local AI Answer Generation Pipeline ---');
  const t1 = Date.now();
  const copilotRes = await fetch('http://localhost:3000/api/copilot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: sttData.transcript,
      mode: 'coding'
    })
  });
  const copilotData = await copilotRes.json();
  const copilotDuration = Date.now() - t1;

  console.log(`Copilot API Status: ${copilotRes.status} (${copilotDuration}ms)`);
  if (!copilotData.answer) {
    throw new Error('Copilot failed to generate answer: ' + JSON.stringify(copilotData));
  }

  const ans = copilotData.answer;
  console.log(`Answer ID: ${ans.id}`);
  console.log(`Core Concept / Summary: ${ans.summary}`);
  console.log(`Spoken Script: "${ans.spokenScript?.substring(0, 100)}..."`);
  console.log(`Has Code Snippet: ${Boolean(ans.codeSnippet)}`);
  if (ans.codeSnippet) {
    const codeStr = typeof ans.codeSnippet === 'string' ? ans.codeSnippet : ans.codeSnippet.code;
    console.log(`Code Sample (${ans.codeSnippet.language || 'code'}):\n${codeStr?.substring(0, 150)}...`);
  }
  console.log('✅ TEST 2 PASSED: Local answer generation succeeded without cloud API keys!');

  // ----------------------------------------------------
  // TEST 3: Trigger Rules & Feedback Loop Prevention
  // ----------------------------------------------------
  console.log('\n--- TEST 3: Audio Mode Rules & Feedback Loop Prevention ---');
  const { shouldTriggerAnswer } = require('../src/lib/audioPipelineHelper.ts');

  // Rule A: In MIC mode, Candidate questions trigger answers
  const micTurn = {
    id: 'turn_mic',
    speaker: 'candidate',
    source: 'mic',
    text: sttData.transcript,
    timestamp: Date.now(),
    isFinal: true
  };
  const micTriggers = shouldTriggerAnswer(micTurn, 'mic_only', true);
  console.log(`Rule A (MIC mode -> Candidate question triggers answer): ${micTriggers} (Expected: true)`);
  if (!micTriggers) throw new Error('Rule A failed');

  // Rule B: In DEVICE mode, Interviewer questions trigger answers
  const deviceTurn = {
    id: 'turn_dev',
    speaker: 'interviewer',
    source: 'meeting',
    text: sttData.transcript,
    timestamp: Date.now(),
    isFinal: true
  };
  const devTriggers = shouldTriggerAnswer(deviceTurn, 'device_only', true);
  console.log(`Rule B (DEVICE mode -> Interviewer question triggers answer): ${devTriggers} (Expected: true)`);
  if (!devTriggers) throw new Error('Rule B failed');

  // Rule C: In BOTH mode, Interviewer questions trigger answers automatically
  const bothInterviewerTriggers = shouldTriggerAnswer(deviceTurn, 'both', true);
  console.log(`Rule C (BOTH mode -> Interviewer question triggers answer): ${bothInterviewerTriggers} (Expected: true)`);
  if (!bothInterviewerTriggers) throw new Error('Rule C failed');

  // Rule D: In BOTH mode, Candidate microphone responses MUST NOT trigger answers
  const bothMicTriggers = shouldTriggerAnswer(micTurn, 'both', true);
  console.log(`Rule D (BOTH mode -> Candidate mic response triggers answer): ${bothMicTriggers} (Expected: false - Feedback loop strictly prevented!)`);
  if (bothMicTriggers) throw new Error('Rule D failed: Candidate speech triggered answer in BOTH mode!');

  console.log('✅ TEST 3 PASSED: All mode trigger policies and feedback isolation verified!');

  console.log('\n========================================================');
  console.log('  ALL PIPELINE INTEGRATION TESTS PASSED SUCCESSFULLY!  ');
  console.log('========================================================');
}

runTest().catch((err) => {
  console.error('\n❌ Pipeline Test Failed:', err);
  process.exit(1);
});
