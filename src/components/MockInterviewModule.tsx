/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MockQuestion, MockInterviewReport } from '@/lib/types';
import { 
  UserProfile, 
  ProjectRecord, 
  TargetJobDescription, 
  InterviewPracticeTrack,
  PracticeTurnFeedback 
} from '@/lib/profileTypes';
import { 
  getUserProfile, 
  getAllProjects, 
  getAllJobDescriptions, 
  getActiveContext, 
  savePracticeTurn, 
  INITIAL_USER_PROFILE, 
  INITIAL_PROJECTS 
} from '@/lib/storage';
import { 
  Headphones, Play, Mic, MicOff, Volume2, Send, Sparkles, 
  CheckCircle2, ArrowRight, Award, Download, RefreshCw, AlertCircle,
  Eye, EyeOff, ShieldCheck, HelpCircle, CheckSquare, MessageSquareCode, Layers
} from 'lucide-react';

interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

export const MockInterviewModule: React.FC = () => {
  // Context state from storage
  const [userProfile, setUserProfile] = useState<UserProfile>(INITIAL_USER_PROFILE);
  const [projects, setProjects] = useState<ProjectRecord[]>(INITIAL_PROJECTS);
  const [jobDescriptions, setJobDescriptions] = useState<TargetJobDescription[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<InterviewPracticeTrack>('technical');
  const [selectedRole, setSelectedRole] = useState('Full-Stack Engineer');
  const [selectedDifficulty, setSelectedDifficulty] = useState('Senior');
  const [customJdText, setCustomJdText] = useState('');

  // Practice state
  const [stage, setStage] = useState<'setup' | 'interview' | 'report'>('setup');
  const [questions, setQuestions] = useState<MockQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  const [micAudioLevel, setMicAudioLevel] = useState(0);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);

  // Turn Feedback & History
  const [currentFeedback, setCurrentFeedback] = useState<PracticeTurnFeedback | null>(null);
  const [completedTurns, setCompletedTurns] = useState<PracticeTurnFeedback[]>([]);
  const [report, setReport] = useState<MockInterviewReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const speechReceivedRef = useRef(false);

  // Load profile and active context on mount
  useEffect(() => {
    async function loadData() {
      const p = await getUserProfile();
      setUserProfile(p);
      const prs = await getAllProjects();
      setProjects(prs);
      const jds = await getAllJobDescriptions();
      setJobDescriptions(jds);
      const ctx = await getActiveContext();
      if (ctx.practiceTrack) setSelectedTrack(ctx.practiceTrack);
    }
    loadData();

    return () => {
      // Clean up audio references on unmount
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch {}
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Text to Speech for Interviewer
  const speakQuestion = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopRecordingCleanly = async () => {
    setIsRecording(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
    setMicAudioLevel(0);

    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }

    // Stop mic stream tracks
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
  };

  // Toggle Speech to Text (Dual Engine: Web Speech + MediaRecorder /api/transcribe fallback)
  const toggleRecording = async () => {
    if (isRecording) {
      await stopRecordingCleanly();
      return;
    }

    setErrorMessage(null);
    speechReceivedRef.current = false;
    audioChunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
    } catch (err: any) {
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      const msg = isDenied
        ? 'Microphone permission blocked. Please click the lock or camera icon in your browser address bar to allow microphone access, or enable Microphone in Windows Settings > Privacy & security.'
        : `Could not access microphone: ${err.message || 'Device error'}`;
      setErrorMessage(msg);
      return;
    }

    // Real-time Audio Visualizer Meter
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        if (!micStreamRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = Math.min(100, Math.round((sum / dataArray.length) * 1.5));
        setMicAudioLevel(avg);
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();
    } catch {}

    // Setup MediaRecorder
    try {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        // If Web Speech didn't transcribe text, use the recorded audio chunk with /api/transcribe
        if (!speechReceivedRef.current && audioChunksRef.current.length > 0) {
          setIsTranscribingAudio(true);
          try {
            const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
            const formData = new FormData();
            formData.append('audio', audioBlob, 'candidate_speech.webm');
            formData.append('source', 'mic');

            const resp = await fetch('/api/transcribe', {
              method: 'POST',
              body: formData
            });

            if (resp.ok) {
              const data = await resp.json();
              if (data.transcript && data.transcript.trim()) {
                const text = data.transcript.trim();
                setUserAnswer(prev => prev ? `${prev.trim()} ${text}` : text);
              }
            }
          } catch (tErr) {
            console.warn('Transcription error:', tErr);
          } finally {
            setIsTranscribingAudio(false);
          }
        }
      };

      recorder.start(500);
      setIsRecording(true);
    } catch (recErr) {
      console.warn('MediaRecorder error:', recErr);
    }

    // Attempt browser Web Speech API for real-time live typing
    const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
    const SpeechRec = win?.SpeechRecognition || win?.webkitSpeechRecognition;

    if (SpeechRec) {
      try {
        const rec = new SpeechRec();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-US';

        rec.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = 0; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript + ' ';
            }
          }
          if (finalTranscript.trim()) {
            speechReceivedRef.current = true;
            setUserAnswer(prev => prev ? `${prev.trim()} ${finalTranscript.trim()}` : finalTranscript.trim());
          }
        };

        rec.onerror = (e: any) => {
          console.warn('SpeechRec error in practice:', e.error);
          // MediaRecorder fallback continues recording
        };

        rec.start();
        recognitionRef.current = rec;
      } catch (eErr) {
        console.warn('SpeechRec startup error:', eErr);
      }
    }
  };

  // Start Practice
  const handleStartPractice = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const resp = await fetch('/api/mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_questions',
          track: selectedTrack,
          role: selectedRole,
          difficulty: selectedDifficulty,
          profile: userProfile,
          projects,
          targetJob: jobDescriptions[0] || (customJdText ? { title: 'Target Role', company: 'Target Company', rawText: customJdText } : undefined),
          resumeText: userProfile.summary
        })
      });

      const data = await resp.json();
      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        setCurrentIndex(0);
        setCompletedTurns([]);
        setCurrentFeedback(null);
        setUserAnswer('');
        setShowModelAnswer(false);
        setStage('interview');

        setTimeout(() => speakQuestion(data.questions[0].question), 400);
      } else {
        throw new Error('No interview questions returned.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to start interview practice.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit candidate answer (Answer-First Mode)
  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim()) return;

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }

    setIsEvaluating(true);
    setErrorMessage(null);

    const activeQuestion = questions[currentIndex].question;

    try {
      const resp = await fetch('/api/mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'evaluate',
          track: selectedTrack,
          role: selectedRole,
          difficulty: selectedDifficulty,
          question: activeQuestion,
          userAnswer: userAnswer.trim(),
          turnIndex: currentIndex + 1,
          profile: userProfile,
          projects
        })
      });

      const data = await resp.json();
      if (data.feedback) {
        setCurrentFeedback(data.feedback);
        setCompletedTurns(prev => [...prev, data.feedback]);
        await savePracticeTurn(data.feedback);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to evaluate your answer.');
    } finally {
      setIsEvaluating(false);
    }
  };

  // Move to Next Question or Final Scorecard
  const handleNextQuestion = () => {
    if (currentIndex + 1 < questions.length) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setUserAnswer('');
      setCurrentFeedback(null);
      setShowModelAnswer(false);
      setTimeout(() => speakQuestion(questions[nextIdx].question), 300);
    } else {
      handleGenerateFinalReport();
    }
  };

  // Generate Final Scorecard Report
  const handleGenerateFinalReport = async () => {
    setIsLoading(true);
    try {
      const resp = await fetch('/api/mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'report',
          role: `${selectedTrack.toUpperCase()} - ${selectedRole}`,
          difficulty: selectedDifficulty,
          turns: completedTurns.map(t => ({
            turnIndex: t.turnIndex,
            question: t.question,
            userAnswer: t.userAnswer,
            scores: {
              correctness: t.rubricScores.correctness,
              clarity: t.rubricScores.clarity,
              completeness: t.rubricScores.relevance,
              communication: t.rubricScores.confidence
            },
            feedback: t.confidenceWordingFeedback,
            strengths: t.strengths,
            improvements: t.improvements,
            suggestedFollowUp: t.adaptiveFollowUp
          }))
        })
      });

      const data = await resp.json();
      if (data.report) {
        setReport(data.report);
        setStage('report');
      }
    } catch (err: any) {
      setErrorMessage('Failed to generate final scorecard: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Download Markdown Report
  const handleDownloadReport = () => {
    if (!report) return;
    const content = `# Interview Practice Performance Scorecard
**Track:** ${selectedTrack.toUpperCase()}
**Target Role:** ${report.role} (${report.difficulty})
**Candidate:** ${userProfile.name || 'Candidate'}
**Overall Score:** ${report.overallScore}/100
**Date:** ${new Date(report.createdAt).toLocaleString()}

## Multi-Metric Rubric Breakdown:
- **Correctness:** ${report.categoryScores.correctness}/10
- **Clarity:** ${report.categoryScores.clarity}/10
- **Relevance:** ${report.categoryScores.completeness}/10
- **Confidence of Wording:** ${report.categoryScores.communication}/10

## Executive Summary:
${report.summary}

## Key Strengths:
${report.keyStrengths.map(s => `- ${s}`).join('\n')}

## Prioritized Improvements:
${report.priorityFixes.map(f => `- ${f}`).join('\n')}

## Turn-by-Turn Breakdown:
${completedTurns.map(t => `### Turn ${t.turnIndex}: ${t.question}
**Candidate Answer:** ${t.userAnswer}
**Scores:** Correctness: ${t.rubricScores.correctness}/10 | Clarity: ${t.rubricScores.clarity}/10 | Relevance: ${t.rubricScores.relevance}/10 | Confidence: ${t.rubricScores.confidence}/10
**Confidence Feedback:** ${t.confidenceWordingFeedback}
**Adaptive Follow-Up:** ${t.adaptiveFollowUp}
**Benchmark Model Answer:** ${t.modelAnswer?.medium || ''}
`).join('\n\n')}
`;

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview_practice_scorecard_${selectedTrack}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tracks: Array<{ id: InterviewPracticeTrack; label: string; desc: string }> = [
    { id: 'technical', label: 'Technical Interview', desc: 'Tech choice rationale (Why Java?), DB trade-offs (Postgres vs Mongo), concurrency, and algorithms.' },
    { id: 'project_deep_dive', label: 'Project Deep-Dive', desc: 'Architecture defense, verified personal contributions, hardest bugs, and rebuild improvements.' },
    { id: 'hr', label: 'HR & Behavioral', desc: 'Culture fit, degree choice, career goals, conflict resolution, and domain advantages.' },
    { id: 'resume', label: 'Resume-Based Drill', desc: 'Deep-dive questions challenging specific achievements, metrics, and internship claims.' },
    { id: 'job_description', label: 'Job-Description Tailored', desc: 'Simulated round tailored directly to a target job description.' }
  ];

  return (
    <div className="space-y-6">
      {/* 1. SETUP STAGE */}
      {stage === 'setup' && (
        <div className="max-w-3xl mx-auto bg-zinc-900/90 border border-zinc-800 rounded-3xl p-8 space-y-6 shadow-2xl backdrop-blur-md">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-400 p-[1.5px] mx-auto shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
                <Headphones className="w-7 h-7 text-emerald-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-zinc-100">Personalized Interview Practice Studio</h2>
            <p className="text-xs text-zinc-400 max-w-lg mx-auto">
              Simulates realistic interview rounds with speech-to-text input, answer-first evaluation, 4-metric scoring (Correctness, Clarity, Relevance, Confidence), and adaptive follow-up questions.
            </p>
          </div>

          {/* Active Context Banner */}
          <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-zinc-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Active Context: <strong>{userProfile.name}</strong> ({userProfile.title})</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-zinc-400">
              <span>{projects.length} Project(s) in Vault</span>
              <span>•</span>
              <span>{userProfile.realChallenges.length} Challenge(s)</span>
            </div>
          </div>

          {/* Practice Track Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Select Interview Track
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {tracks.map(t => {
                const isSelected = selectedTrack === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTrack(t.id)}
                    className={`p-3 rounded-xl text-left border transition-all ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500/40 shadow-sm'
                        : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className="font-semibold text-xs text-zinc-200 mb-1 flex items-center justify-between">
                      <span>{t.label}</span>
                      {isSelected && <span className="w-2 h-2 rounded-full bg-emerald-400"></span>}
                    </div>
                    <p className="text-[10px] text-zinc-400 line-clamp-2 leading-relaxed">{t.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Role & Seniority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Target Discipline</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="Full-Stack Engineer">Full-Stack Engineer (Next.js, Node, Java, Distributed Systems)</option>
                <option value="Backend Engineer">Backend Engineer (Java, Spring Boot, PostgreSQL, Microservices)</option>
                <option value="Frontend Engineer">Frontend Engineer (React, TypeScript, CSS, Core Web Vitals)</option>
                <option value="System Design / Architect">System Design / Architect (Distributed Systems, Scale)</option>
                <option value="Cybersecurity Software Engineer">Cybersecurity Software Engineer (Secure Architecture, AppSec)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Seniority Level</label>
              <div className="grid grid-cols-4 gap-1.5">
                {['Junior', 'Mid-Level', 'Senior', 'Staff / Lead'].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setSelectedDifficulty(level)}
                    className={`py-2 rounded-xl text-xs font-medium border transition-all ${
                      selectedDifficulty === level
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40 font-semibold'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:bg-zinc-800/60'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Optional Job Description text */}
          {selectedTrack === 'job_description' && (
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                Paste Target Job Description (Optional)
              </label>
              <textarea
                rows={3}
                value={customJdText}
                onChange={e => setCustomJdText(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                placeholder="Paste requirements, tech stack, and responsibilities to tailor questions specifically to this job..."
              />
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-center gap-2 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={handleStartPractice}
              disabled={isLoading}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-zinc-950 font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Preparing Personalized Interview...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-zinc-950" />
                  <span>Begin Personalized Practice Session</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 2. INTERVIEW STAGE (ANSWER-FIRST MODE) */}
      {stage === 'interview' && questions.length > 0 && (
        <div className="max-w-4xl mx-auto space-y-5">
          {/* Progress Header */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <span className="text-xs text-zinc-400 hidden sm:inline">
                Track: <strong className="text-zinc-200">{selectedTrack.toUpperCase()}</strong>
              </span>
            </div>

            <button
              onClick={() => speakQuestion(questions[currentIndex].question)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700"
              title="Repeat question audio"
            >
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Read Question Aloud</span>
            </button>
          </div>

          {/* Question Card */}
          <div className="p-6 rounded-3xl bg-zinc-900/90 border border-zinc-800 shadow-xl space-y-3">
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
              {questions[currentIndex].category || 'Interview Question'}
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-zinc-100 leading-snug">
              &quot;{questions[currentIndex].question}&quot;
            </h2>
            {questions[currentIndex].context && (
              <p className="text-xs text-zinc-500 italic">
                Context: {questions[currentIndex].context}
              </p>
            )}
          </div>

          {/* Candidate Response Workspace (Answer First) */}
          <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                <span>Your Spoken or Typed Response</span>
                <span className="text-[10px] text-emerald-400 font-mono">(Answer First Mode)</span>
              </label>

              <div className="flex items-center gap-3">
                {isRecording && (
                  <div className="flex items-center gap-2 p-1.5 px-3 rounded-xl bg-zinc-950 border border-emerald-500/30 text-xs animate-fadeIn">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    <span className="text-[11px] text-zinc-300 hidden sm:inline">Listening:</span>
                    <div className="bg-zinc-800 h-2 w-16 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-400 h-full transition-all duration-75"
                        style={{ width: `${Math.max(10, micAudioLevel)}%` }}
                      />
                    </div>
                  </div>
                )}

                {isTranscribingAudio && (
                  <div className="flex items-center gap-1.5 text-xs text-teal-400 animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Transcribing audio...</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                    isRecording
                      ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                      : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                  }`}
                >
                  {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  <span>{isRecording ? 'Stop Recording' : 'Speak Answer (Mic)'}</span>
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-center gap-2 text-rose-300 text-xs animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <textarea
              rows={5}
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Speak aloud using the microphone or type your response here. Follow the 4-part structure: Direct answer -> Personal motivation -> Real project example -> Connection to career goal..."
              className="w-full px-4 py-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500 leading-relaxed"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowModelAnswer(!showModelAnswer)}
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-emerald-400 transition-colors"
              >
                {showModelAnswer ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showModelAnswer ? 'Hide Suggested Benchmark' : 'Show Suggested Benchmark Answer'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSubmitAnswer}
                  disabled={!userAnswer.trim() || isEvaluating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold text-xs shadow-md transition-all disabled:opacity-40"
                >
                  {isEvaluating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Evaluating Turn...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Evaluate My Answer</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Optional Model Benchmark Answer Accordion */}
            {showModelAnswer && (
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2 animate-fadeIn">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Suggested Benchmark Answer (Based on Your Actual Profile)</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Direct Answer: Lead with clear conviction. Support with your verified project contributions from {projects[0]?.name || 'EchoCopilot'}.
                </p>
              </div>
            )}
          </div>

          {/* Turn Evaluation Feedback */}
          {currentFeedback && (
            <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl space-y-5 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="font-bold text-sm text-zinc-100">Turn {currentFeedback.turnIndex} Evaluation</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-zinc-400">Overall Turn Score: </span>
                  <span className="text-sm font-bold text-emerald-400">{currentFeedback.overallTurnScore}/100</span>
                </div>
              </div>

              {/* 4-Metric Rubric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
                  <span className="block text-[10px] text-zinc-400 uppercase font-semibold">Correctness</span>
                  <span className="text-base font-bold text-emerald-400">{currentFeedback.rubricScores.correctness}/10</span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
                  <span className="block text-[10px] text-zinc-400 uppercase font-semibold">Clarity</span>
                  <span className="text-base font-bold text-teal-400">{currentFeedback.rubricScores.clarity}/10</span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
                  <span className="block text-[10px] text-zinc-400 uppercase font-semibold">Relevance</span>
                  <span className="text-base font-bold text-cyan-400">{currentFeedback.rubricScores.relevance}/10</span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
                  <span className="block text-[10px] text-zinc-400 uppercase font-semibold">Confidence</span>
                  <span className="text-base font-bold text-amber-400">{currentFeedback.rubricScores.confidence}/10</span>
                </div>
              </div>

              {/* Confidence Analysis */}
              <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-300">
                <span className="font-semibold block mb-0.5">Confidence of Wording Analysis:</span>
                <span>{currentFeedback.confidenceWordingFeedback}</span>
              </div>

              {/* Strengths & Improvements */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5">
                  <span className="font-semibold text-emerald-400">Strengths:</span>
                  {currentFeedback.strengths.map((s, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-zinc-300">
                      <span className="text-emerald-400">•</span>
                      <span>{s}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <span className="font-semibold text-rose-400">Prioritized Improvements:</span>
                  {currentFeedback.improvements.map((imp, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-zinc-300">
                      <span className="text-rose-400">•</span>
                      <span>{imp}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Adaptive Follow-up Question */}
              {currentFeedback.adaptiveFollowUp && (
                <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1.5">
                  <span className="text-[11px] font-semibold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquareCode className="w-3.5 h-3.5" />
                    <span>Adaptive Follow-Up Question:</span>
                  </span>
                  <p className="text-xs text-zinc-200 font-medium italic">
                    &quot;{currentFeedback.adaptiveFollowUp}&quot;
                  </p>
                </div>
              )}

              {/* Next Question or Finish Action */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleNextQuestion}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold text-xs border border-zinc-700 shadow-sm"
                >
                  <span>{currentIndex + 1 < questions.length ? 'Next Question' : 'View Final Performance Scorecard'}</span>
                  <ArrowRight className="w-4 h-4 text-emerald-400" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. REPORT STAGE */}
      {stage === 'report' && report && (
        <div className="max-w-3xl mx-auto bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
            <div>
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                Practice Session Scorecard
              </span>
              <h2 className="text-2xl font-bold text-zinc-100">{report.role}</h2>
              <p className="text-xs text-zinc-400">Completed on {new Date(report.createdAt).toLocaleDateString()}</p>
            </div>

            <div className="text-center sm:text-right">
              <span className="text-3xl font-extrabold text-emerald-400">{report.overallScore}</span>
              <span className="text-xs text-zinc-400 block font-mono">/ 100 Overall Score</span>
            </div>
          </div>

          {/* Rubric Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 text-center">
              <span className="block text-[10px] text-zinc-400 uppercase font-semibold">Correctness</span>
              <span className="text-lg font-bold text-emerald-400">{report.categoryScores.correctness}/10</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 text-center">
              <span className="block text-[10px] text-zinc-400 uppercase font-semibold">Clarity</span>
              <span className="text-lg font-bold text-teal-400">{report.categoryScores.clarity}/10</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 text-center">
              <span className="block text-[10px] text-zinc-400 uppercase font-semibold">Relevance</span>
              <span className="text-lg font-bold text-cyan-400">{report.categoryScores.completeness}/10</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 text-center">
              <span className="block text-[10px] text-zinc-400 uppercase font-semibold">Confidence</span>
              <span className="text-lg font-bold text-amber-400">{report.categoryScores.communication}/10</span>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">Executive Performance Summary</h4>
            <p className="text-xs text-zinc-300 leading-relaxed p-4 rounded-2xl bg-zinc-950 border border-zinc-800">
              {report.summary}
            </p>
          </div>

          {/* Action Items */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">Prioritized Action Items</h4>
            <div className="space-y-2">
              {report.priorityFixes.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300">
                  <span className="text-rose-400 font-bold shrink-0">{idx + 1}.</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-800 flex-wrap gap-3">
            <button
              onClick={() => {
                setStage('setup');
                setCurrentIndex(0);
                setCompletedTurns([]);
                setReport(null);
              }}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium"
            >
              Start New Practice Session
            </button>

            <button
              onClick={handleDownloadReport}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold text-xs shadow-md transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download Performance Scorecard (.md)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
