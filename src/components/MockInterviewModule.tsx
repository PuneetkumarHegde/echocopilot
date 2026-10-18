/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useRef } from 'react';
import { MockQuestion, MockTurnFeedback, MockInterviewReport } from '@/lib/types';
import { 
  Headphones, Play, Mic, MicOff, Volume2, Send, Sparkles, 
  CheckCircle2, ArrowRight, Award, Download, RefreshCw, AlertCircle
} from 'lucide-react';

interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

export const MockInterviewModule: React.FC = () => {
  // Setup State
  const [stage, setStage] = useState<'setup' | 'interview' | 'report'>('setup');
  const [selectedRole, setSelectedRole] = useState('Full-Stack Engineer');
  const [selectedDifficulty, setSelectedDifficulty] = useState('Senior');
  const [isLoading, setIsLoading] = useState(false);

  // In-Interview State
  const [questions, setQuestions] = useState<MockQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState<MockTurnFeedback | null>(null);
  const [completedTurns, setCompletedTurns] = useState<MockTurnFeedback[]>([]);
  const [report, setReport] = useState<MockInterviewReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

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

  // Toggle Speech to Text for spoken answers
  const toggleRecording = () => {
    const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
    const SpeechRec = win?.SpeechRecognition || win?.webkitSpeechRecognition;

    if (!SpeechRec) {
      setErrorMessage('Speech recognition is not supported in this browser. Please type your answer or use Chrome/Edge.');
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsRecording(false);
    } else {
      try {
        const rec = new SpeechRec();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-US';

        rec.onstart = () => {
          setIsRecording(true);
          setErrorMessage(null);
        };

        rec.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = 0; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript + ' ';
            }
          }
          if (finalTranscript) {
            setUserAnswer(prev => prev ? `${prev.trim()} ${finalTranscript.trim()}` : finalTranscript.trim());
          }
        };

        rec.onerror = (e: any) => {
          console.warn('Speech error in mock:', e.error);
          setIsRecording(false);
        };

        rec.onend = () => {
          setIsRecording(false);
        };

        rec.start();
        recognitionRef.current = rec;
      } catch (err: any) {
        setErrorMessage('Failed to start microphone: ' + err.message);
        setIsRecording(false);
      }
    }
  };

  // Start Interview
  const handleStartInterview = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const resp = await fetch('/api/mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_questions',
          role: selectedRole,
          difficulty: selectedDifficulty
        })
      });

      const data = await resp.json();
      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        setCurrentIndex(0);
        setCompletedTurns([]);
        setCurrentFeedback(null);
        setUserAnswer('');
        setStage('interview');

        // Speak the first question aloud
        setTimeout(() => speakQuestion(data.questions[0].question), 300);
      } else {
        throw new Error('No questions returned');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to start mock interview session.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Answer for Feedback
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
          role: selectedRole,
          difficulty: selectedDifficulty,
          question: activeQuestion,
          userAnswer: userAnswer.trim(),
          turnIndex: currentIndex + 1
        })
      });

      const data = await resp.json();
      if (data.feedback) {
        setCurrentFeedback(data.feedback);
        setCompletedTurns(prev => [...prev, data.feedback]);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to evaluate answer.');
    } finally {
      setIsEvaluating(false);
    }
  };

  // Move to Next Question or Final Report
  const handleNextQuestion = () => {
    if (currentIndex + 1 < questions.length) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setUserAnswer('');
      setCurrentFeedback(null);
      setTimeout(() => speakQuestion(questions[nextIdx].question), 300);
    } else {
      handleGenerateFinalReport();
    }
  };

  // Generate Final Report
  const handleGenerateFinalReport = async () => {
    setIsLoading(true);
    try {
      const resp = await fetch('/api/mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'report',
          role: selectedRole,
          difficulty: selectedDifficulty,
          turns: completedTurns
        })
      });

      const data = await resp.json();
      if (data.report) {
        setReport(data.report);
        setStage('report');
      }
    } catch (err: any) {
      setErrorMessage('Failed to generate final report: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Download Report
  const handleDownloadReport = () => {
    if (!report) return;
    const content = `# Mock Interview Performance Report
**Role:** ${report.role} (${report.difficulty})
**Overall Score:** ${report.overallScore}/100
**Date:** ${new Date(report.createdAt).toLocaleString()}

## Category Scores:
- Correctness: ${report.categoryScores.correctness}/10
- Clarity: ${report.categoryScores.clarity}/10
- Completeness: ${report.categoryScores.completeness}/10
- Communication: ${report.categoryScores.communication}/10

## Executive Summary:
${report.summary}

## Key Strengths:
${report.keyStrengths.map(s => `- ${s}`).join('\n')}

## Priority Action Items:
${report.priorityFixes.map(f => `- ${f}`).join('\n')}

## Turn-by-Turn Breakdown:
${report.turns.map(t => `### Question ${t.turnIndex}: ${t.question}
**Candidate Answer:** ${t.userAnswer}
**Scores:** Correctness ${t.scores.correctness}/10, Clarity ${t.scores.clarity}/10, Completeness ${t.scores.completeness}/10, Communication ${t.scores.communication}/10
**Feedback:** ${t.feedback}
`).join('\n\n')}
`;

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mock_interview_report_${selectedRole.toLowerCase().replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 1. SETUP STAGE */}
      {stage === 'setup' && (
        <div className="max-w-2xl mx-auto bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-[1.5px] mx-auto shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
                <Headphones className="w-7 h-7 text-emerald-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-zinc-100">AI Voice Mock Interview</h2>
            <p className="text-sm text-zinc-400 max-w-md mx-auto">
              Practice answering real interview questions with spoken or typed input. Receive instant rubric evaluation and a comprehensive final scorecard.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Target Job Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="Frontend Engineer">Frontend Engineer (React, TypeScript, CSS, Core Web Vitals)</option>
                <option value="Backend Engineer">Backend Engineer (Node, Java, SQL, APIs, Concurrency)</option>
                <option value="Full-Stack Engineer">Full-Stack Engineer (End-to-End, Next.js, Architecture)</option>
                <option value="System Design / Architect">System Design / Staff Architect (Distributed Systems, Scale)</option>
                <option value="Behavioral / Leadership">Behavioral / Leadership (STAR Method, Team Conflicts, Ownership)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Seniority Level</label>
              <div className="grid grid-cols-4 gap-2">
                {['Junior', 'Mid-Level', 'Senior', 'Staff / Lead'].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setSelectedDifficulty(level)}
                    className={`py-2.5 rounded-xl text-xs font-medium border transition-all ${
                      selectedDifficulty === level
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40 font-semibold shadow-sm'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:bg-zinc-800/60'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-center gap-2 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              onClick={handleStartInterview}
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl font-semibold text-sm bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 mt-4"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
              ) : (
                <>
                  <Play className="w-4 h-4 fill-zinc-950" />
                  <span>Begin Mock Interview Session</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 2. IN-INTERVIEW STAGE */}
      {stage === 'interview' && questions.length > 0 && (
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Progress Header */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <span className="text-xs text-zinc-400 font-medium hidden sm:inline">
                {selectedRole} • {selectedDifficulty}
              </span>
            </div>

            <button
              onClick={handleGenerateFinalReport}
              className="text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:bg-zinc-800 px-3 py-1.5 rounded-lg transition-colors"
            >
              End Early & Get Report
            </button>
          </div>

          {/* Interviewer Question Box */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Interviewer Prompt
              </span>
              <button
                onClick={() => speakQuestion(questions[currentIndex].question)}
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-emerald-400 transition-colors"
                title="Listen to interviewer voice"
              >
                <Volume2 className="w-4 h-4" />
                <span>Speak Question</span>
              </button>
            </div>

            <h3 className="text-lg font-semibold text-zinc-100 leading-relaxed">
              {questions[currentIndex].question}
            </h3>
          </div>

          {/* Candidate Answer Box */}
          {!currentFeedback ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Your Answer (Speak or Type)
                </label>
                <button
                  onClick={toggleRecording}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isRecording
                      ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/30'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700/60 border border-zinc-700'
                  }`}
                >
                  {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                  <span>{isRecording ? 'Stop Recording' : 'Speak Answer (Mic)'}</span>
                </button>
              </div>

              <textarea
                rows={5}
                placeholder="Structure your answer clearly. Explain your technical reasoning, constraints, or STAR situation..."
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 leading-relaxed"
              />

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs">
                  {errorMessage}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-zinc-500">
                  {userAnswer.trim().split(/\s+/).filter(Boolean).length} words
                </span>
                <button
                  onClick={handleSubmitAnswer}
                  disabled={isEvaluating || !userAnswer.trim()}
                  className="px-5 py-2.5 rounded-xl font-semibold text-xs bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition-all disabled:opacity-50 shadow-md shadow-emerald-500/20 flex items-center gap-2"
                >
                  {isEvaluating ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Answer for Evaluation</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Turn Feedback Card */
            <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Turn Evaluation & Rubric Scores
                </span>
                <span className="text-xs text-zinc-400">Turn {currentFeedback.turnIndex}</span>
              </div>

              {/* Rubric Score Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Correctness', score: currentFeedback.scores.correctness, color: 'text-emerald-400' },
                  { label: 'Clarity', score: currentFeedback.scores.clarity, color: 'text-cyan-400' },
                  { label: 'Completeness', score: currentFeedback.scores.completeness, color: 'text-teal-400' },
                  { label: 'Communication', score: currentFeedback.scores.communication, color: 'text-amber-400' }
                ].map((item) => (
                  <div key={item.label} className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-center">
                    <p className="text-[11px] font-medium text-zinc-400">{item.label}</p>
                    <p className={`text-xl font-bold font-mono mt-1 ${item.color}`}>
                      {item.score}<span className="text-xs text-zinc-500">/10</span>
                    </p>
                  </div>
                ))}
              </div>

              {/* Qualitative Feedback */}
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 leading-relaxed">
                <p className="font-semibold text-zinc-200 mb-1">Feedback Summary:</p>
                <p>{currentFeedback.feedback}</p>
              </div>

              {/* Strengths & Improvements */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-emerald-950/20 border border-emerald-900/40 p-3.5 rounded-xl space-y-1.5">
                  <p className="text-xs font-semibold text-emerald-400">Key Strengths</p>
                  <ul className="space-y-1">
                    {currentFeedback.strengths.map((s, idx) => (
                      <li key={idx} className="text-xs text-zinc-300">• {s}</li>
                    ))}
                  </ul>
                </div>
                <div className="bg-amber-950/20 border border-amber-900/40 p-3.5 rounded-xl space-y-1.5">
                  <p className="text-xs font-semibold text-amber-400">Areas to Improve</p>
                  <ul className="space-y-1">
                    {currentFeedback.improvements.map((imp, idx) => (
                      <li key={idx} className="text-xs text-zinc-300">• {imp}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Follow-up question if present */}
              {currentFeedback.suggestedFollowUp && (
                <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-800/40 text-xs space-y-1">
                  <p className="font-semibold text-cyan-400">Interviewer Follow-up Question:</p>
                  <p className="text-zinc-200 italic">&quot;{currentFeedback.suggestedFollowUp}&quot;</p>
                </div>
              )}

              {/* Next Action */}
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleNextQuestion}
                  className="px-6 py-2.5 rounded-xl font-semibold text-xs bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <span>{currentIndex + 1 < questions.length ? 'Next Question' : 'View Final Report'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. REPORT STAGE */}
      {stage === 'report' && report && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-8 space-y-6 shadow-2xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Award className="w-6 h-6 text-emerald-400" />
                  <h2 className="text-2xl font-bold text-zinc-100">Performance Report</h2>
                </div>
                <p className="text-xs text-zinc-400">
                  Target: <strong className="text-zinc-200">{report.role}</strong> ({report.difficulty})
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownloadReport}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Download MD</span>
                </button>

                <button
                  onClick={() => setStage('setup')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition-all shadow-md"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>New Mock</span>
                </button>
              </div>
            </div>

            {/* Score Showcase */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              <div className="sm:col-span-2 bg-zinc-950 p-6 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center text-center">
                <span className="text-xs uppercase tracking-wider font-semibold text-zinc-400">Overall Match Score</span>
                <span className="text-5xl font-black font-mono text-emerald-400 mt-2">
                  {report.overallScore}<span className="text-xl text-zinc-600">/100</span>
                </span>
                <span className="text-xs font-medium text-emerald-300 mt-2 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                  {report.overallScore >= 80 ? 'Interview Ready' : 'Competitive Match'}
                </span>
              </div>

              <div className="sm:col-span-3 grid grid-cols-2 gap-3">
                {[
                  { label: 'Correctness', score: report.categoryScores.correctness, color: 'text-emerald-400' },
                  { label: 'Clarity', score: report.categoryScores.clarity, color: 'text-cyan-400' },
                  { label: 'Completeness', score: report.categoryScores.completeness, color: 'text-teal-400' },
                  { label: 'Communication', score: report.categoryScores.communication, color: 'text-amber-400' }
                ].map((item) => (
                  <div key={item.label} className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
                    <p className="text-xs text-zinc-400 font-medium">{item.label}</p>
                    <p className={`text-2xl font-bold font-mono mt-1 ${item.color}`}>
                      {item.score}<span className="text-xs text-zinc-600">/10</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Executive Summary */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 leading-relaxed">
              <p className="font-semibold text-zinc-200 mb-1">Executive Summary:</p>
              <p>{report.summary}</p>
            </div>

            {/* Strengths & Priority Fixes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-emerald-950/20 border border-emerald-900/40 p-4 rounded-xl space-y-2">
                <p className="text-xs font-semibold text-emerald-400">Key Strengths Demonstrated</p>
                <ul className="space-y-1.5">
                  {report.keyStrengths.map((s, idx) => (
                    <li key={idx} className="text-xs text-zinc-300">• {s}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-amber-950/20 border border-amber-900/40 p-4 rounded-xl space-y-2">
                <p className="text-xs font-semibold text-amber-400">High-Priority Improvements</p>
                <ul className="space-y-1.5">
                  {report.priorityFixes.map((f, idx) => (
                    <li key={idx} className="text-xs text-zinc-300">• {f}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
