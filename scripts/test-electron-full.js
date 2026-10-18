const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 960,
    height: 720,
    show: false,
    backgroundColor: '#0a0e17',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../electron/preload.js')
    }
  });

  await win.loadURL('http://localhost:3000/floating');

  // Inject sample answer and transcript into localStorage and state
  await win.webContents.executeJavaScript(`
    const testAnswer = {
      id: 'ans_verified_' + Date.now(),
      question: 'How do you find the longest substring without repeating characters in Python?',
      summary: 'Use the sliding window algorithm with two pointers and a dictionary tracking character last-seen indices to achieve optimal O(N) time and O(min(m, n)) space complexity.',
      bulletPoints: [
        'Initialize left pointer at 0 and track maximum length',
        'Store latest index of each visited character in a hash map',
        'If duplicate encountered within window, jump left pointer to lastIndex + 1',
        'Return overall maximum window length'
      ],
      spokenScript: 'To solve this efficiently, I use a sliding window approach with two pointers and a dictionary. As the right pointer scans through the string, we record each character\\'s index. If we see a character that exists in our current window, we move the left pointer past its previous occurrence.',
      codeSnippet: {
        language: 'python',
        code: 'def lengthOfLongestSubstring(s: str) -> int:\\n    char_index_map = {}\\n    left = 0\\n    max_length = 0\\n    for right, char in enumerate(s):\\n        if char in char_index_map and char_index_map[char] >= left:\\n            left = char_index_map[char] + 1\\n        char_index_map[char] = right\\n        max_length = max(max_length, right - left + 1)\\n    return max_length'
      },
      mode: 'coding',
      timestamp: Date.now()
    };

    localStorage.setItem('echocopilot_latest_answer', JSON.stringify(testAnswer));
  `);

  // Reload page so it picks up the latest answer on mount
  await win.loadURL('http://localhost:3000/floating');
  await new Promise(r => setTimeout(r, 2000));

  // Take full screenshot
  const image = await win.capturePage();
  fs.writeFileSync('scripts/electron_answer_open.png', image.toPNG());
  console.log('[SAVED FULL ANSWER SCREENSHOT]: scripts/electron_answer_open.png');

  win.close();
  app.quit();
});
