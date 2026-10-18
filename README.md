# EchoCopilot: Practical AI Interview Assistant (ParakeetAI-Inspired)

An enterprise-grade, real-time AI interview copilot and preparation studio inspired by [ParakeetAI](https://www.parakeet-ai.com/). Built for candidates and engineers seeking low-latency live assistance, voice-based mock interviews, resume ATS keyword diagnostics, and comprehensive question practice.

---

## 🌟 Key Functional Modules

### 1. Live AI Copilot
- **Three Audio Input Modes:**
  1. **Microphone Audio (Candidate):** Captures the candidate's voice via `navigator.mediaDevices.getUserMedia()`. Transcribed via browser Web Speech STT. Ideal for mock interviews, practice, and spoken questions.
  2. **Device / Meeting Audio (Interviewer):** Captures audio from a user-selected Google Meet / Zoom browser tab via `navigator.mediaDevices.getDisplayMedia({ audio: true })`. Transcribed via streaming backend STT (`/api/transcribe`) using Deepgram Nova-2 or OpenAI Whisper.
  3. **Both (Microphone + Device Audio):** Captures microphone and meeting audio simultaneously while preserving the identity of each source throughout processing (`👤 You (Candidate)` vs `🎧 Meeting (Interviewer)`).
- **Feedback Loop Prevention:**
  - Prevents the recursive loop where reading an AI answer aloud transcribes your own voice and triggers another answer.
  - Dedicated **Answer Trigger Policy** selector:
    - `🎧 Meeting Audio Only (Recommended)`: Only the interviewer's speech triggers AI answers. Your microphone voice is transcribed as "You" but never invokes AI.
    - `🎙️ Microphone Only`: Only your microphone triggers answers (for mock interview practice).
    - `🌐 Both`: Both sources trigger answers.
- **Audio Lifecycle & Track Monitoring:**
  - Complete **Start**, **Pause**, **Resume**, and **Stop** controls.
  - Active audio level visualizers for both Candidate Mic and Meeting Tab audio.
  - Clean switching between audio sources without leaking media tracks or AudioContext instances.
  - Automatic detection and cleanup when tab sharing is stopped via browser notification bar (`track.onended`).
- **Utterance Segmentation & Question Deduplication:**
  - Detects completed question utterances and filters out conversational filler words.
  - 30-second deduplication cache prevents repeated STT events from firing redundant AI answer generations.
- **Pipeline Status States:** Real-time visibility into `Idle`, `Listening`, `Paused`, `Transcribing`, `Generating Answer`, `Answer Ready`, and `Error`.

### 2. AI Voice Mock Interview
- **Job Role & Seniority Customization:** Select target discipline (Frontend, Backend, Full-Stack, System Design, Behavioral) and level (Junior, Mid-Level, Senior, Staff/Lead).
- **Interactive Question Sequencer:** Real questions generated dynamically. Includes optional **Text-to-Speech (TTS)** reading the prompt aloud.
- **Spoken or Typed Answers:** Candidates can speak their answer via microphone (speech-to-text) or type into the response box.
- **Multi-Dimensional Rubric Feedback:** Instant turn-by-turn scoring across **Correctness (1-10)**, **Clarity (1-10)**, **Completeness (1-10)**, and **Communication (1-10)** with constructive suggestions and intelligent follow-up questions.
- **Performance Report:** Final scorecard with overall match score (0-100), executive summary, prioritized action items, and exportable Markdown report.

### 3. Resume & Keyword Match Analyzer
- **Document Text Extraction:** Upload `.txt` or `.pdf` files, or paste raw text.
- **Job Description Target Matching:** Compares candidate competencies against target job requirements.
- **Transparent Match Score:** Computes a transparent heuristic score (0-100%) with an explicit compliance disclaimer: *"Transparent heuristic match score based on keyword density and competency overlap, not an official ATS vendor proprietary score."*
- **Skill Gap Detection:** Identifies matched skills and highlights missing high-value keywords.
- **STAR Bullet Point Rewriter:** Transforms passive resume bullets into metric-driven achievements using action verbs and quantifiable results.
- **Report Export:** Instant download of the full diagnostic report in Markdown.

### 4. Interview Question Bank
- **Extensive Real-World Library:** Curated, production-grade questions covering **Java**, **SQL**, **Data Structures & Algorithms**, **Cybersecurity**, **Behavioral**, and **System Design**.
- **Comprehensive Solution Drawers:** Detailed technical breakdown, executable code snippets, time/space complexity, and common candidate pitfalls.
- **Search & Multi-Tag Filters:** Filter by company (Google, Amazon, Meta, Stripe), category, and difficulty.
- **Local Favorites:** Star questions with instant local persistence.
- **One-Click Practice Transfer:** Click *"Practice in Live Copilot"* on any question to automatically load it into the Live Copilot workspace.
- **Custom Question Creator:** Add and persist original questions locally.

### 5. Session History & Persistence
- **Local IndexedDB Database:** Persistent client-side database (`EchoInterviewCopilotDB`) storing complete transcripts, AI answers, and metadata without cloud transmission.
- **Search & Filter:** Find past sessions by title, date, or transcript keywords.
- **Inline Renaming & Deletion:** Manage past records cleanly.
- **Multi-Format Export:** Export full session transcripts and AI answers as Markdown (`.md`) or Plain Text (`.txt`).

---

## 🛠️ Technology Stack

- **Framework:** Next.js 16+ (App Router, Turbopack, TypeScript)
- **Styling:** Tailwind CSS v4 with custom dark-mode theme, emerald/teal accents, and custom scrollbars
- **Icons:** Lucide React
- **Audio & Speech:** Web Audio API, Web Speech API (`SpeechRecognition`), Screen/Tab Audio MediaStream (`getDisplayMedia`)
- **Persistence:** Browser IndexedDB with automated LocalStorage fallback
- **Server API:** Next.js Route Handlers (`/api/copilot`, `/api/mock`, `/api/resume`, `/api/health`)

---

## 🚀 Setup & Running Locally

### Prerequisites
- Node.js 18.17+ or 20+ (tested and verified on Node v22)
- npm 9+ or 10+
- Google Chrome or Microsoft Edge recommended for native browser speech-to-text.

### 1. Installation
Navigate to the project directory:
```bash
cd parakeet-copilot
npm install
```

### 2. Environment Configuration (Optional)
The application is **100% functional out-of-the-box** using its Smart Built-in Engine and browser Web Speech STT. To connect live external LLMs (Claude 3.5 Sonnet or GPT-4o), create a `.env.local` file:
```bash
cp .env.example .env.local
```
Add your API keys:
```env
# Optional: OpenAI API Key for GPT-4o
OPENAI_API_KEY=sk-...

# Optional: Anthropic API Key for Claude 3.5 Sonnet
ANTHROPIC_API_KEY=sk-ant-...

# Optional: Deepgram API Key for cloud STT
DEEPGRAM_API_KEY=...
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in Google Chrome or Microsoft Edge.

### 4. Build for Production
```bash
npm run build
npm run start
```

---

## 🧪 Testing & Verification Guide

| Module | Verification Step | Expected Result |
| :--- | :--- | :--- |
| **Live Copilot** | Click "Start Live Copilot", allow microphone access, and speak: *"How does Redis handle master-slave replication?"* | Words transcribe in real-time in the left pane; clicking "Get Answer" renders a structured response with trade-offs. |
| **Tab Audio** | Click "Capture Tab Audio", select an open video or meeting tab, and check "Share audio". | Tab audio stream connects without crashing; browser indicator displays active audio track. |
| **Manual Input** | Type *"Implement LRU Cache in TypeScript"* into the Copilot input bar and press Enter. | Instant AI solution card displays with full TypeScript class, `O(1)` complexity, and copy button. |
| **Mock Interview** | Select "Frontend Engineer" -> "Senior", click "Begin Mock Interview", and speak or type an answer. | Turn evaluation displays 4 rubric scores (Correctness, Clarity, Completeness, Communication), follow-up question, and final scorecard upon completion. |
| **Resume Analyzer** | Click "Load Sample Resume" and click "Analyze Resume". | Generates a 0-100% competency match score, highlights missing keywords, and renders 3 STAR bullet rewrites. |
| **Question Bank** | Search "ConcurrentHashMap", expand solution, click star icon, and click "Practice in Live Copilot". | Solution expands with code and complexity; star saves to IndexedDB; transitions to Copilot with question ready. |
| **Session History** | In Copilot, click "Save Session", navigate to "Session History". | Session appears with transcript turns and answers; clicking "Export MD" downloads a clean Markdown file. |

---

## 🔒 Limitations & Explicit Exclusions

As requested by the project requirements, the following features are intentionally excluded:
- **No Marketing / Billing Bloat:** No landing sales funnels, Stripe credit purchasing, or OAuth signups.
- **Zero Cloud Leakage:** All session transcripts and question favorites remain private in client-side IndexedDB.
- **Browser Speech-to-Text Support:** The Web Speech API is supported natively in **Google Chrome**, **Microsoft Edge**, and Chromium browsers. On Firefox/Safari, manual text input is available as a zero-friction fallback.
- **Browser vs. Desktop Audio Capture Limitation:** Web applications capture meeting audio through the W3C DisplayMedia API (`navigator.mediaDevices.getDisplayMedia({ audio: true })`), which allows capturing audio from open browser tabs (Google Meet, Zoom Web, Microsoft Teams web) in Chromium browsers when the user enables "Share tab audio". Capturing system-wide audio from native desktop binaries (such as `Zoom.exe` or `Teams.exe`) without sharing a tab requires a native desktop application with virtual audio loopback drivers (e.g. Windows WASAPI loopback or virtual audio cables).
- **ATS Score Disclaimer:** Resume scores represent algorithmic keyword overlap and competency mapping, not vendor-proprietary scoring from Workday or Taleo.
