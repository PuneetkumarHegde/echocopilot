# EchoCopilot: Personalized AI Career & Real-Time Interview Assistant

An enterprise-grade, real-time AI interview copilot and personalized career studio inspired by [ParakeetAI](https://www.parakeet-ai.com/). Built for candidates and engineers seeking low-latency live assistance, voice-based mock interviews, project-aware preparation, authentic personalized answer synthesis, resume keyword diagnostics, and transparent local persistence.

---

## 🌟 Key Functional Modules

### 1. Personal Profile and Career Context
- **Comprehensive Career Modeling:** Manage academic background, technical skills, career goals, target roles, work experience, hackathons, certifications, strengths/growth areas, and real production outages solved.
- **Incomplete-Friendly & Authentic:** Never assumes or fabricates missing information. Supports leaving fields blank, and explicitly prompts to fill missing details when generating interview answers.
- **Import / Export Backup:** One-click JSON backup export and import with instant local IndexedDB persistence.

### 2. Project Vault & Secret-Shielded Codebase Analyzer
- **In-Depth Project Ingestion:** Stores problem statements, target users, architecture overviews, technology choices, database schemas, API design patterns, and known limitations.
- **Verified Personal Contributions:** Explicit verification checklist ensuring candidates confirm which modules they personally designed and coded vs. team code.
- **🛡️ Secret & Credential Shield:** Automatically rejects `.env`, `.env.*`, `*.pem`, `*.key`, `id_rsa`, and `credentials.json`. Detects and redacts OpenAI, Anthropic, AWS keys, JWT tokens, and database passwords before indexing.
- **Future Improvements Reflection:** Captures architectural reflections (*"What would you improve if you rebuilt your project from scratch today?"*).

### 3. Automatic Personalized Question Generation
- Dynamic synthesis cross-referencing profile, active projects, resume, and target job descriptions.
- Automatically generates questions across 6 core categories:
  - **Technology Choice Rationale:** *"Why did you choose Java?"*, *"Why did you use PostgreSQL instead of MongoDB?"*
  - **Career & Specialization Alignment:** *"Why did you choose your degree?", "How does your cybersecurity background help in software development?"*
  - **Verified Project Contributions:** *"What was your specific personal contribution to EchoCopilot?"*
  - **System Architecture & Trade-offs:** *"What architectural trade-offs did you consider when designing the system?"*
  - **Toughest Technical Challenges:** *"What was the most difficult technical problem you solved?"*
  - **Rebuild & Improvement Foresight:** *"What would you improve if you rebuilt your project from scratch today?"*

### 4. Authentic 4-Part Answer Generation & Anti-Hallucination Guard
- **Strict 4-Part Natural Structure:**
  1. **Direct Answer:** Crisp, confident response speakable in 5–15 seconds.
  2. **Personal Motivation:** Grounded in your real profile reasons.
  3. **Supporting Real-World Example:** Concrete episode from your verified projects or challenge logs.
  4. **Connection to Target Role / Goals:** Direct tie-in to target job responsibilities.
- **Configurable Answer Lengths:** Short (30s elevator pitch), Medium (spoken conversational), or Detailed (deep architectural narrative).
- **Anti-Hallucination Guardrail:** Never invents achievements or technical motivations. If required context is missing, returns an interactive prompt to answer and save directly to your profile.

### 5. Interview Practice Studio (5 Practice Tracks)
- **5 Dedicated Tracks:**
  1. `Technical Interview Practice`: Language choice rationale, DB trade-offs, concurrency, algorithms.
  2. `Project Deep-Dive Interviews`: Architecture defense, verified contributions, hardest bugs, rebuild reflections.
  3. `HR & Behavioral Practice`: Culture fit, degree choice, career ambitions, domain advantages.
  4. `Resume-Based Exploration`: Drill-down on resume bullet claims and metrics.
  5. `Job-Description Tailored`: Simulated round targeting exact requirements in a target job listing.
- **Answer-First Mode:** Candidate answers first (voice or typed); benchmark suggested answer is hidden until candidate submits or requests to reveal it.
- **4-Metric Rubric Scoring:** Turn-by-turn evaluation across **Correctness (1-10)**, **Clarity (1-10)**, **Relevance (1-10)**, and **Confidence of Wording (1-10)**.
- **Adaptive Follow-Up Questions:** Generates dynamic follow-ups based directly on the candidate's previous response.

### 6. Live AI Copilot
- **Three Audio Input Modes:** Microphone Audio (Candidate), Meeting Audio (Interviewer tab via `getDisplayMedia`), or Both simultaneously with speaker separation.
- **Feedback Loop Prevention:** Prevents reading AI answers aloud from triggering self-transcription loops.
- **Active Context Injection:** Live Copilot answers are enriched by your active personal profile and verified projects.

### 7. Session History & Local IndexedDB Persistence
- **Client-Side IndexedDB (v2):** Dedicated stores for `userProfile`, `projects`, `jobDescriptions`, `sessions`, `favorites`, `customQuestions`, and `practiceHistory`.
- **Zero Cloud Leakage:** All candidate profiles, project architectures, and session transcripts stay 100% private in browser storage.

---

## 🛠️ Technology Stack

- **Framework:** Next.js 16+ (App Router, Turbopack, TypeScript)
- **Styling:** Tailwind CSS v4 with custom dark-mode theme, emerald/teal accents
- **Icons:** Lucide React
- **Audio & Speech:** Web Audio API, Web Speech API (`SpeechRecognition`), Screen/Tab Audio MediaStream (`getDisplayMedia`)
- **Persistence:** Browser IndexedDB v2 with automated LocalStorage fallback
- **Server API:** Next.js Route Handlers (`/api/copilot`, `/api/personalized-answer`, `/api/personalized-questions`, `/api/mock`, `/api/resume`, `/api/health`)

---

## 🚀 Setup & Running Locally

### 1. Installation
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in Google Chrome or Microsoft Edge.

### 3. Run Automated Verification Test Suite
```bash
npm test
```
Runs the full 43-assertion verification suite validating secret sanitization, codebase analysis, question generation, 4-part answer synthesis, anti-hallucination guardrails, and practice rubric scoring.

### 4. Build for Production
```bash
npm run build
npm run start
```

---

## 🧪 Testing & Verification Guide

| Module | Verification Step | Expected Result |
| :--- | :--- | :--- |
| **Personal Profile** | Open "Career Profile", add or edit Education, Skills, Career Goals, or Real Challenges; click "Save Profile". | Saves instantly to local IndexedDB; persists on page reload. |
| **Project Vault** | Open "Project Vault", click "Import / Analyze Code", upload source files. | Analyzes architecture, identifies tech stack, detects/redacts secrets, and populates verified contributions checklist. |
| **Question Generator** | Open "Practice Studio", select "Technical" or "Project Deep-Dive", click "Begin Practice". | Generates personalized questions: *"Why did you choose Java?"*, *"Why PostgreSQL over MongoDB?"*, *"What was your specific contribution to EchoCopilot?"*. |
| **Answer-First Mode** | Speak or type an answer in Practice Studio without revealing the model answer; click "Evaluate My Answer". | Evaluates 4 scores (Correctness, Clarity, Relevance, Confidence), flags hesitant wording, and generates an adaptive follow-up question. |
| **Anti-Hallucination** | Ask a question regarding a missing profile field in Copilot or API. | Returns targeted follow-up prompt rather than fabricating an answer. |
| **Automated Suite** | Run `npm test` in the terminal. | Runs 43 automated assertions with 100% pass rate. |

---

## 🔒 Limitations & Explicit Exclusions

- **Zero Cloud Leakage:** All session transcripts, career profiles, and project vaults remain private in client-side IndexedDB.
- **Browser Speech-to-Text Support:** The Web Speech API is supported natively in **Google Chrome**, **Microsoft Edge**, and Chromium browsers. On Firefox/Safari, manual text input is available as a zero-friction fallback.
- **No Marketing Bloat:** Free of landing page sales funnels, Stripe credit purchasing, or forced account creation.
