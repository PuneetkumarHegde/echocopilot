'use client';

import React, { useState, useEffect } from 'react';
import { QuestionItem, ModuleType } from '@/lib/types';
import { INITIAL_QUESTIONS } from '@/lib/questionsData';
import { getFavoriteQuestionIds, toggleFavoriteQuestion, getCustomQuestions, saveCustomQuestion } from '@/lib/storage';
import { Search, Filter, Star, Plus, Check, Copy, ExternalLink, Code2, AlertTriangle, Clock, Layers } from 'lucide-react';

interface QuestionBankModuleProps {
  onPracticeInCopilot: (question: string, mode: 'coding' | 'system_design' | 'behavioral' | 'general') => void;
  setActiveModule: (module: ModuleType) => void;
}

export const QuestionBankModule: React.FC<QuestionBankModuleProps> = ({
  onPracticeInCopilot,
  setActiveModule
}) => {
  const [questions, setQuestions] = useState<QuestionItem[]>(INITIAL_QUESTIONS);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [expandedId, setExpandedId] = useState<string | null>(INITIAL_QUESTIONS[0].id);
  const [filterFavoritesOnly, setFilterFavoritesOnly] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // New Question Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<QuestionItem['category']>('Java');
  const [newDifficulty, setNewDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [newCompany, setNewCompany] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswerSummary, setNewAnswerSummary] = useState('');
  const [newKeyPoints, setNewKeyPoints] = useState('');

  // Load custom questions and favorites from IndexedDB
  useEffect(() => {
    async function loadData() {
      const favs = await getFavoriteQuestionIds();
      setFavoriteIds(favs);

      const customs = await getCustomQuestions();
      if (customs.length > 0) {
        setQuestions([...customs, ...INITIAL_QUESTIONS]);
      }
    }
    loadData();
  }, []);

  const handleToggleFavorite = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const isNowFav = await toggleFavoriteQuestion(id);
    setFavoriteIds(prev => isNowFav ? [...prev, id] : prev.filter(fId => fId !== id));
  };

  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newQuestion.trim()) return;

    const customItem: QuestionItem = {
      id: 'custom_' + Date.now(),
      title: newTitle,
      category: newCategory,
      difficulty: newDifficulty,
      companies: newCompany ? [newCompany] : ['General'],
      roles: ['Software Engineer'],
      question: newQuestion,
      answerSummary: newAnswerSummary || 'Direct solution and engineering principles.',
      keyPoints: newKeyPoints ? newKeyPoints.split('\n').filter(p => p.trim()) : ['Key implementation detail'],
      isCustom: true
    };

    await saveCustomQuestion(customItem);
    setQuestions(prev => [customItem, ...prev]);
    setIsModalOpen(false);
    setExpandedId(customItem.id);

    // Reset form
    setNewTitle('');
    setNewQuestion('');
    setNewAnswerSummary('');
    setNewKeyPoints('');
  };

  const categories = ['All', 'Java', 'SQL', 'Data Structures & Algorithms', 'Cybersecurity', 'Behavioral', 'System Design'];
  const difficulties = ['All', 'Easy', 'Medium', 'Hard'];

  // Filter questions
  const filteredQuestions = questions.filter(q => {
    const matchesSearch = 
      q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.companies.some(c => c.toLowerCase().includes(searchQuery.toLowerCase())) ||
      q.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'All' || q.category === selectedCategory;
    const matchesDifficulty = selectedDifficulty === 'All' || q.difficulty === selectedDifficulty;
    const matchesFavorites = !filterFavoritesOnly || favoriteIds.includes(q.id);

    return matchesSearch && matchesCategory && matchesDifficulty && matchesFavorites;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Bar */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 p-6 rounded-2xl border border-zinc-800 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
              <span>Interview Question Bank</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                {filteredQuestions.length} Questions
              </span>
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              Curated, high-frequency interview questions with comprehensive solutions, code, complexity, and common pitfalls.
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch md:self-auto">
            <button
              onClick={() => setFilterFavoritesOnly(!filterFavoritesOnly)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                filterFavoritesOnly 
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/40 shadow-sm' 
                  : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700/60'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${filterFavoritesOnly ? 'fill-amber-400 text-amber-400' : ''}`} />
              <span>Favorites ({favoriteIds.length})</span>
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition-all shadow-md shadow-emerald-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Question</span>
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by keyword, company (Google, Amazon), topic, or concept..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 transition-colors"
            />
          </div>

          <div className="md:col-span-4 flex items-center gap-2">
            <Filter className="w-4 h-4 text-zinc-500 shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/60"
            >
              {categories.map(c => (
                <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/60"
            >
              {difficulties.map(d => (
                <option key={d} value={d}>{d === 'All' ? 'All Difficulties' : d}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Questions Accordion List */}
      <div className="space-y-3">
        {filteredQuestions.length === 0 ? (
          <div className="text-center py-16 bg-zinc-900/40 rounded-2xl border border-zinc-800/80">
            <Layers className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-300 font-semibold">No questions match your search criteria</p>
            <p className="text-xs text-zinc-500 mt-1">Try resetting your filters or search terms.</p>
          </div>
        ) : (
          filteredQuestions.map((q) => {
            const isExpanded = expandedId === q.id;
            const isFav = favoriteIds.includes(q.id);

            return (
              <div
                key={q.id}
                className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isExpanded
                    ? 'bg-zinc-900 border-zinc-700/80 shadow-lg'
                    : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700/60'
                }`}
              >
                {/* Accordion Header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : q.id)}
                  className="p-4 sm:p-5 flex items-start justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {q.category}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          q.difficulty === 'Easy'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : q.difficulty === 'Medium'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {q.difficulty}
                      </span>
                      {q.companies.map((c) => (
                        <span key={c} className="text-[10px] text-zinc-400 bg-zinc-950/80 px-2 py-0.5 rounded-md border border-zinc-800">
                          {c}
                        </span>
                      ))}
                      {q.isCustom && (
                        <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-md border border-cyan-500/30 font-mono">
                          Custom
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-semibold text-zinc-100 hover:text-emerald-400 transition-colors">
                      {q.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleToggleFavorite(e, q.id)}
                      title={isFav ? 'Remove from favorites' : 'Save to favorites'}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-800/80 transition-colors"
                    >
                      <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400 text-amber-400' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Expanded Content Drawer */}
                {isExpanded && (
                  <div className="px-4 pb-5 sm:px-5 space-y-4 border-t border-zinc-800/80 pt-4 bg-zinc-950/40">
                    {/* The Full Question Prompt */}
                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/80">
                      <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500 mb-1">Interviewer Prompt</p>
                      <p className="text-sm text-zinc-200 leading-relaxed font-medium">{q.question}</p>
                    </div>

                    {/* Answer Summary */}
                    <div>
                      <p className="text-xs uppercase tracking-wider font-semibold text-emerald-400 mb-1">Answer Summary</p>
                      <p className="text-sm text-zinc-300 leading-relaxed">{q.answerSummary}</p>
                    </div>

                    {/* Key Technical Points */}
                    {q.keyPoints && q.keyPoints.length > 0 && (
                      <div>
                        <p className="text-xs uppercase tracking-wider font-semibold text-zinc-400 mb-2">Key Discussion Points</p>
                        <ul className="space-y-1.5">
                          {q.keyPoints.map((point, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-xs text-zinc-300 leading-relaxed">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0"></span>
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Code Snippet if Available */}
                    {q.codeSnippet && (
                      <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950">
                        <div className="flex items-center justify-between px-3.5 py-2 bg-zinc-900 border-b border-zinc-800">
                          <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5">
                            <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                            {q.codeSnippet.language}
                          </span>
                          <button
                            onClick={() => handleCopyCode(q.id, q.codeSnippet!.code)}
                            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
                          >
                            {copiedCodeId === q.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy Code</span>
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="p-4 text-xs font-mono text-zinc-300 overflow-x-auto leading-relaxed bg-zinc-950">
                          <code>{q.codeSnippet.code}</code>
                        </pre>
                      </div>
                    )}

                    {/* Complexity Metrics */}
                    {q.complexity && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800">
                        <div className="flex items-start gap-2">
                          <Clock className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[11px] font-semibold text-zinc-400">Time Complexity</p>
                            <p className="text-xs text-zinc-200 font-mono mt-0.5">{q.complexity.time}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Layers className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[11px] font-semibold text-zinc-400">Space Complexity</p>
                            <p className="text-xs text-zinc-200 font-mono mt-0.5">{q.complexity.space}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Common Pitfalls */}
                    {q.pitfalls && q.pitfalls.length > 0 && (
                      <div className="bg-rose-950/20 border border-rose-900/40 p-3 rounded-xl">
                        <div className="flex items-center gap-1.5 text-rose-400 text-xs font-semibold mb-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Common Candidate Pitfalls</span>
                        </div>
                        <ul className="space-y-1">
                          {q.pitfalls.map((pitfall, idx) => (
                            <li key={idx} className="text-xs text-zinc-300">
                              • {pitfall}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-800/60">
                      <button
                        onClick={() => {
                          const mode = q.category === 'Behavioral' 
                            ? 'behavioral' 
                            : q.category === 'System Design' 
                            ? 'system_design' 
                            : 'coding';
                          onPracticeInCopilot(q.question, mode);
                          setActiveModule('copilot');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Practice in Live Copilot</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Custom Question Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-lg font-bold text-zinc-100">Add Custom Interview Question</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateQuestion} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Question Title / Headline</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Invert a Binary Tree or Postgres WAL Logs"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as QuestionItem['category'])}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200"
                  >
                    <option value="Java">Java</option>
                    <option value="SQL">SQL</option>
                    <option value="Data Structures & Algorithms">Data Structures & Algorithms</option>
                    <option value="Cybersecurity">Cybersecurity</option>
                    <option value="Behavioral">Behavioral</option>
                    <option value="System Design">System Design</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Difficulty</label>
                  <select
                    value={newDifficulty}
                    onChange={(e) => setNewDifficulty(e.target.value as 'Easy' | 'Medium' | 'Hard')}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Company Tags (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Google, Stripe"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Full Interviewer Question / Prompt</label>
                <textarea
                  required
                  rows={2}
                  placeholder="What is the exact question asked by the interviewer?"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Answer Summary</label>
                <textarea
                  rows={2}
                  placeholder="Concise, 1-2 sentence core solution"
                  value={newAnswerSummary}
                  onChange={(e) => setNewAnswerSummary(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Key Points (One per line)</label>
                <textarea
                  rows={2}
                  placeholder="Point 1&#10;Point 2&#10;Point 3"
                  value={newKeyPoints}
                  onChange={(e) => setNewKeyPoints(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition-colors"
                >
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
