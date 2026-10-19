# EchoCopilot Free Cloud Deployment Guide

EchoCopilot can be hosted **100% free of charge** with zero credit card required.

---

## Architecture Overview

```
+-----------------------------------------------------------+
|                      Client Layer                         |
|  - Web Cockpit (https://your-app.vercel.app)             |
|  - Floating HUD Popout (https://your-app.vercel.app/floating)|
|  - Transparent Electron Desktop App (Windows)             |
+-----------------------------+-----------------------------+
                              |
                              v
+-----------------------------------------------------------+
|                   Vercel Free Hosting                     |
|  - Next.js 16 (App Router + Turbopack)                    |
|  - Serverless API Routes (/api/copilot, /api/transcribe)  |
|  - Built-in High Precision Interview Knowledge Base       |
+-----------------------------+-----------------------------+
                              |
              +---------------+---------------+
              |                               |
              v                               v
+---------------------------+   +---------------------------+
|   Option A: Free Cloud    |   | Option B: Free Local GPU  |
|   - Groq Llama 3.3 70B    |   |   - Cloudflare Tunnel     |
|   - Groq Whisper STT      |   |   - Laptop RTX 4050 GPU   |
|   (100% Free at groq.com) |   |   (Ollama qwen2.5:3b)     |
+---------------------------+   +---------------------------+
```

---

## 1. Deploying to Vercel (100% Free Forever)

1. **Push your code to GitHub**:
   Your repository is at `https://github.com/PuneetkumarHegde/echocopilot.git` on branch `cloud-deployment`.

2. **Connect to Vercel**:
   * Navigate to [Vercel](https://vercel.com) and sign in with GitHub.
   * Click **"Add New"** &rarr; **"Project"**.
   * Import repository **`PuneetkumarHegde/echocopilot`**.
   * Select branch **`cloud-deployment`**.

3. **Configure Environment Variables** (Optional but Recommended):
   * Add `GROQ_API_KEY`: *(Get a free key from [console.groq.com](https://console.groq.com))*

4. **Click "Deploy"**:
   * Build finishes in ~45 seconds.
   * You will receive a live production URL: `https://echocopilot-xxxx.vercel.app`.

---

## 2. Free AI & Speech Options

### Option 1: Groq Free Tier (Fastest, ~300ms)
* **LLM**: Llama 3.3 70B Versatile
* **Speech**: Whisper Large V3 Turbo
* **Cost**: **$0** (No credit card required). Up to 14,400 requests/day.
* Just add your `GROQ_API_KEY` to Vercel environment variables or enter it in the HUD settings.

### Option 2: Browser Web Speech API (No Keys Required)
* Works automatically in Chrome, Edge, and Brave.
* Transcribes spoken voice continuously in real-time for **$0**.

### Option 3: Remote Local RTX 4050 GPU via Cloudflare Tunnel
If you want your cloud-hosted HUD to use your local laptop's GPU:
1. In PowerShell, run:
   ```powershell
   npx cloudflared tunnel --url http://localhost:11434
   ```
2. Cloudflare will give you a free HTTPS tunnel URL:
   ```
   https://random-assigned-name.trycloudflare.com
   ```
3. Open your hosted HUD, click ⚙️ Settings, and set **Ollama Server URL** to your Cloudflare Tunnel URL.

---

## 3. Connecting Desktop Electron HUD to Cloud

To have your transparent Windows Desktop HUD load from the hosted website:

1. Open `electron/main.js` and set:
   ```javascript
   const startUrl = process.env.ELECTRON_START_URL || 'https://your-app.vercel.app/floating';
   ```
2. Run `start-desktop.bat`. The desktop overlay will now float over your screen while running entirely on your cloud deployment.
