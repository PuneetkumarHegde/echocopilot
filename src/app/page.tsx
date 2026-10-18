'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { CopilotModule } from '@/components/CopilotModule';
import { MockInterviewModule } from '@/components/MockInterviewModule';
import { ResumeAnalyzerModule } from '@/components/ResumeAnalyzerModule';
import { QuestionBankModule } from '@/components/QuestionBankModule';
import { SessionHistoryModule } from '@/components/SessionHistoryModule';
import { ModuleType, AnswerMode, ApiHealthStatus } from '@/lib/types';
import { ShieldCheck } from 'lucide-react';

export default function Home() {
  const [activeModule, setActiveModule] = useState<ModuleType>('copilot');
  const [activeProvider, setActiveProvider] = useState<string>('Smart Built-in Engine');
  const [copilotInitialPrompt, setCopilotInitialPrompt] = useState<string>('');
  const [copilotInitialMode, setCopilotInitialMode] = useState<AnswerMode>('coding');

  useEffect(() => {
    async function checkHealth() {
      try {
        const resp = await fetch('/api/health');
        if (resp.ok) {
          const data: ApiHealthStatus = await resp.json();
          setActiveProvider(data.activeProvider);
        }
      } catch (e) {
        console.warn('Health check fallback:', e);
      }
    }
    checkHealth();
  }, []);

  const handlePracticeInCopilot = (question: string, mode: AnswerMode) => {
    setCopilotInitialPrompt(question);
    setCopilotInitialMode(mode);
    setActiveModule('copilot');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Sticky App Header */}
      <Header
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        activeProvider={activeProvider}
        isCopilotActive={activeModule === 'copilot'}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeModule === 'copilot' && (
          <CopilotModule
            initialPrompt={copilotInitialPrompt}
            initialMode={copilotInitialMode}
            onClearInitialPrompt={() => setCopilotInitialPrompt('')}
          />
        )}

        {activeModule === 'mock' && <MockInterviewModule />}

        {activeModule === 'resume' && <ResumeAnalyzerModule />}

        {activeModule === 'questions' && (
          <QuestionBankModule
            onPracticeInCopilot={handlePracticeInCopilot}
            setActiveModule={setActiveModule}
          />
        )}

        {activeModule === 'history' && <SessionHistoryModule />}
      </main>

      {/* App Footer */}
      <footer className="w-full border-t border-zinc-900 bg-zinc-950/60 py-6 px-4 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-400">EchoCopilot</span>
            <span>•</span>
            <span>Practical ParakeetAI-Inspired Real-Time Interview Assistant</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1 text-emerald-500/80">
              <ShieldCheck className="w-3.5 h-3.5" />
              Client-Side IndexedDB Storage
            </span>
            <span>Zero-Config Fallback Engine Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
