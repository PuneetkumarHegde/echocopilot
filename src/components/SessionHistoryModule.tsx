'use client';

import React, { useState, useEffect } from 'react';
import { SessionRecord } from '@/lib/types';
import { getAllSessions, deleteSession, saveSession } from '@/lib/storage';
import { 
  History, Search, Trash2, Edit3, Check, X, Download, 
  Clock, MessageSquare, Sparkles, FileText, Calendar, Code2
} from 'lucide-react';

export const SessionHistoryModule: React.FC = () => {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<SessionRecord | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  useEffect(() => {
    let isMounted = true;
    getAllSessions().then((list) => {
      if (isMounted) setSessions(list);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this interview session?')) {
      await deleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (selectedSession?.id === id) {
        setSelectedSession(null);
      }
    }
  };

  const startRename = (session: SessionRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const handleSaveRename = async (session: SessionRecord, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editTitle.trim()) return;

    const updated = { ...session, title: editTitle.trim() };
    await saveSession(updated);
    setSessions(prev => prev.map(s => s.id === session.id ? updated : s));
    if (selectedSession?.id === session.id) {
      setSelectedSession(updated);
    }
    setEditingId(null);
  };

  // Export as Markdown
  const exportAsMarkdown = (session: SessionRecord) => {
    const content = `# ${session.title}
**Date:** ${new Date(session.createdAt).toLocaleString()}
**Duration:** ${Math.floor(session.durationSeconds / 60)}m ${session.durationSeconds % 60}s
**Mode:** ${session.mode}

---

## 🎙️ Transcript
${session.transcript.length === 0 ? '_No audio turns recorded._' : session.transcript.map(t => `
**[${new Date(t.timestamp).toLocaleTimeString()}] ${t.speaker === 'interviewer' ? 'INTERVIEWER' : 'CANDIDATE'}:**
${t.text}
`).join('\n')}

---

## 💡 AI Copilot Answers Generated (${session.answers.length})
${session.answers.map((a, i) => `
### ${i + 1}. ${a.question} (${a.mode})
**Summary:** ${a.summary}

**Key Points:**
${a.bullets.map(b => `- ${b}`).join('\n')}

${a.codeSnippet ? `
\`\`\`${a.codeSnippet.language}
${a.codeSnippet.code}
\`\`\`
**Explanation:** ${a.codeSnippet.explanation}
${a.codeSnippet.timeComplexity ? `**Time:** ${a.codeSnippet.timeComplexity}` : ''}
${a.codeSnippet.spaceComplexity ? `**Space:** ${a.codeSnippet.spaceComplexity}` : ''}
` : ''}

${a.tradeoffs ? `**Trade-offs:**\n${a.tradeoffs.map(tr => `- ${tr}`).join('\n')}` : ''}

${a.starExample ? `
**STAR Example:**
- **Situation:** ${a.starExample.situation}
- **Task:** ${a.starExample.task}
- **Action:** ${a.starExample.action}
- **Result:** ${a.starExample.result}
` : ''}
`).join('\n\n')}
`;

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_transcript.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export as Plain Text
  const exportAsText = (session: SessionRecord) => {
    const content = `TITLE: ${session.title}
DATE: ${new Date(session.createdAt).toLocaleString()}
DURATION: ${Math.floor(session.durationSeconds / 60)} minutes

==================== TRANSCRIPT ====================
${session.transcript.map(t => `[${new Date(t.timestamp).toLocaleTimeString()}] ${t.speaker.toUpperCase()}: ${t.text}`).join('\n')}

==================== AI COPILOT ANSWERS ====================
${session.answers.map(a => `QUESTION: ${a.question}\nSUMMARY: ${a.summary}\n${a.bullets.join('\n')}\n`).join('\n----------------------------------------\n')}
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered Sessions
  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.transcript.some(t => t.text.toLowerCase().includes(searchQuery.toLowerCase())) ||
    s.answers.some(a => a.question.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 p-6 rounded-2xl border border-zinc-800 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
              <History className="w-6 h-6 text-emerald-400" />
              <span>Interview Session History</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                {sessions.length} Saved
              </span>
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              Review recorded interview transcripts, revisit generated answers, and export complete records in Markdown or TXT.
            </p>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-zinc-400" />
            <input
              type="text"
              placeholder="Search sessions or transcript words..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center gap-2 text-[11px] text-zinc-400">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>
            <strong>Storage Architecture:</strong> Sessions are stored client-side in your browser&apos;s IndexedDB (<code>EchoInterviewCopilotDB</code>), persisting permanently across browser sessions with zero server transmission.
          </span>
        </div>
      </div>

      {/* Main Grid: Session List on Left, Detail Viewer on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sessions List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-12 bg-zinc-900/60 rounded-2xl border border-zinc-800 p-6">
              <History className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-zinc-300">No saved sessions found</p>
              <p className="text-xs text-zinc-500 mt-1">
                Start a call in the <strong>Live AI Copilot</strong> module and click &quot;Save Session&quot; to record it here.
              </p>
            </div>
          ) : (
            filteredSessions.map((session) => {
              const isSelected = selectedSession?.id === session.id;
              const isEditing = editingId === session.id;

              return (
                <div
                  key={session.id}
                  onClick={() => setSelectedSession(session)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-zinc-900 border-emerald-500/50 shadow-lg'
                      : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <form onSubmit={(e) => handleSaveRename(session, e)} className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="bg-zinc-950 border border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-200 focus:outline-none"
                            autoFocus
                          />
                          <button type="submit" className="text-emerald-400 hover:text-emerald-300">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => setEditingId(null)} className="text-zinc-500 hover:text-zinc-300">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      ) : (
                        <h4 className="text-sm font-semibold text-zinc-100 truncate hover:text-emerald-400 transition-colors">
                          {session.title}
                        </h4>
                      )}

                      <div className="flex items-center gap-3 text-[11px] text-zinc-400 mt-1.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-zinc-500" />
                          {new Date(session.createdAt).toLocaleDateString()}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-zinc-500" />
                          {Math.floor(session.durationSeconds / 60)}m {session.durationSeconds % 60}s
                        </span>
                        <span>•</span>
                        <span className="capitalize text-emerald-400 font-medium">
                          {session.mode}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => startRename(session, e)}
                        className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded hover:bg-zinc-800"
                        title="Rename session"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(session.id, e)}
                        className="p-1.5 text-zinc-400 hover:text-rose-400 rounded hover:bg-zinc-800"
                        title="Delete session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Session Detail Viewer (7 cols) */}
        <div className="lg:col-span-7">
          {selectedSession ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6 shadow-xl">
              {/* Header & Export Actions */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800">
                <div>
                  <h3 className="text-lg font-bold text-zinc-100">{selectedSession.title}</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Recorded {new Date(selectedSession.createdAt).toLocaleString()} • {selectedSession.transcript.length} turns • {selectedSession.answers.length} AI hints
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => exportAsMarkdown(selectedSession)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Export MD</span>
                  </button>

                  <button
                    onClick={() => exportAsText(selectedSession)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Export TXT</span>
                  </button>
                </div>
              </div>

              {/* Transcript Section */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Dialogue Transcript
                </h4>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                  {selectedSession.transcript.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic">No spoken audio turns were recorded in this session.</p>
                  ) : (
                    selectedSession.transcript.map(t => (
                      <div key={t.id} className="text-xs space-y-0.5 pb-2 border-b border-zinc-900 last:border-0">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={`font-semibold uppercase ${t.speaker === 'interviewer' ? 'text-emerald-400' : 'text-cyan-400'}`}>
                            {t.speaker === 'interviewer' ? 'Interviewer' : 'You (Candidate)'}
                          </span>
                          <span className="text-zinc-500 font-mono">
                            {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-zinc-300 leading-relaxed">{t.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Generated Answers Section */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  AI Copilot Generated Answers ({selectedSession.answers.length})
                </h4>

                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {selectedSession.answers.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                      No AI answers were generated during this session.
                    </p>
                  ) : (
                    selectedSession.answers.map((ans, idx) => (
                      <div key={ans.id || idx} className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            {ans.mode}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {new Date(ans.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <h5 className="text-xs font-semibold text-zinc-200">{ans.question}</h5>
                        <p className="text-xs text-emerald-300 bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-900/40 leading-relaxed">
                          💡 {ans.summary}
                        </p>

                        {ans.bullets && ans.bullets.length > 0 && (
                          <ul className="space-y-1 pt-1">
                            {ans.bullets.map((b, bIdx) => (
                              <li key={bIdx} className="text-xs text-zinc-300 flex items-start gap-1.5">
                                <span className="text-emerald-400 mt-0.5">•</span>
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                        )}

                        {ans.codeSnippet && (
                          <div className="rounded-lg overflow-hidden border border-zinc-800 mt-2">
                            <div className="px-3 py-1 bg-zinc-900 text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                              <Code2 className="w-3 h-3 text-emerald-400" />
                              {ans.codeSnippet.language}
                            </div>
                            <pre className="p-3 text-[11px] font-mono text-zinc-300 bg-zinc-950 overflow-x-auto">
                              <code>{ans.codeSnippet.code}</code>
                            </pre>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-12 text-center text-zinc-500 flex flex-col items-center justify-center h-full min-h-[350px]">
              <FileText className="w-10 h-10 text-zinc-600 mb-3" />
              <p className="text-sm font-semibold text-zinc-300">Select a session to view details</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                Click any session on the left to read its complete transcript, inspect AI hints, or export files.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
