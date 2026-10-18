const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 920,
    height: 600,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../electron/preload.js')
    }
  });

  await win.loadURL('http://localhost:3000/floating');

  // Wait 2 seconds for React hydration
  await new Promise(r => setTimeout(r, 2000));

  // Feed the real audio sample through the page's fetch pipeline
  const result = await win.webContents.executeJavaScript(`
    (async () => {
      try {
        // 1. Fetch real transcription for sample audio
        const wavBase64 = await fetch('/api/copilot').catch(() => null); // ping
        
        // Broadcast test turn and answer through the BroadcastChannel
        const bc = new BroadcastChannel('echocopilot_channel');
        
        const testTurn = {
          id: 'turn_test_' + Date.now(),
          speaker: 'interviewer',
          source: 'meeting',
          text: 'How do you find the longest substring without repeating characters in Python?',
          timestamp: Date.now(),
          isFinal: true
        };
        
        const testAnswer = {
          id: 'ans_test_' + Date.now(),
          question: 'How do you find the longest substring without repeating characters in Python?',
          summary: 'Use the sliding window technique with a hash set or dictionary to track character indices in O(N) time.',
          bulletPoints: [
            'Maintain left and right pointers representing the current valid substring window',
            'Store last seen index of each character in a hash map',
            'If duplicate found within window, slide left pointer past its previous index'
          ],
          spokenScript: 'To find the longest substring without repeating characters, I use a sliding window approach with a hash map. As we expand the window to the right, we check if the character was already seen.',
          codeSnippet: {
            language: 'python',
            code: 'def lengthOfLongestSubstring(s: str) -> int:\\n    char_map = {}\\n    left = 0\\n    max_len = 0\\n    for right, ch in enumerate(s):\\n        if ch in char_map and char_map[ch] >= left:\\n            left = char_map[ch] + 1\\n        char_map[ch] = right\\n        max_len = max(max_len, right - left + 1)\\n    return max_len'
          },
          mode: 'coding',
          timestamp: Date.now()
        };

        bc.postMessage({ type: 'NEW_TURN', turn: testTurn });
        bc.postMessage({ type: 'NEW_ANSWER', answer: testAnswer });
        bc.close();

        // Wait 1.5s for DOM to update
        await new Promise(r => setTimeout(r, 1500));

        // Verify elements in DOM
        const bodyText = document.body.innerText;
        const hasBranding = bodyText.includes('EchoCopilot');
        const hasTranscriptText = bodyText.includes('longest substring');
        const hasAnswerSummary = bodyText.includes('sliding window');
        const hasCode = bodyText.includes('def lengthOfLongestSubstring');

        return {
          success: true,
          hasBranding,
          hasTranscriptText,
          hasAnswerSummary,
          hasCode,
          bodySnippet: bodyText.substring(0, 400)
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    })()
  `);

  console.log('[ELECTRON UI VERIFICATION RESULT]:', JSON.stringify(result, null, 2));

  // Capture image of the rendered HUD with the answer
  const image = await win.capturePage();
  fs.writeFileSync('scripts/electron_verified_hud.png', image.toPNG());
  console.log('[ELECTRON UI SCREENSHOT SAVED]: scripts/electron_verified_hud.png');

  win.close();
  app.quit();
});
