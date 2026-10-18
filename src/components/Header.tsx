'use client';

import React from 'react';
import { ModuleType } from '@/lib/types';
import { Mic, Headphones, FileText, Database, History, Sparkles, Cpu } from 'lucide-react';

interface HeaderProps {
  activeModule: ModuleType;
  setActiveModule: (module: ModuleType) => void;
  activeProvider?: string;
  isCopilotActive?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeModule,
  setActiveModule,
  activeProvider = 'Smart Built-in Engine',
  isCopilotActive = false
}) => {
  const navItems: { id: ModuleType; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'copilot', label: 'Live AI Copilot', icon: <Mic className="w-4 h-4" />, badge: isCopilotActive ? 'LIVE' : undefined },
    { id: 'mock', label: 'Mock Interview', icon: <Headphones className="w-4 h-4" /> },
    { id: 'resume', label: 'Resume Analyzer', icon: <FileText className="w-4 h-4" /> },
    { id: 'questions', label: 'Question Bank', icon: <Database className="w-4 h-4" /> },
    { id: 'history', label: 'Session History', icon: <History className="w-4 h-4" /> }
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveModule('copilot')}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-400 p-[1.5px] shadow-lg shadow-emerald-500/20">
            <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-zinc-100 tracking-tight">EchoCopilot</span>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                AI Assistant
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-medium hidden sm:block">Real-Time Interview & Meeting Copilot</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 shadow-inner overflow-x-auto max-w-full">
          {navItems.map((item) => {
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveModule(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap ${
                  isActive
                    ? 'bg-zinc-800 text-emerald-400 shadow-sm border border-zinc-700/60'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Provider Status Pill */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/60 border border-zinc-800/90 text-xs text-zinc-400">
          <Cpu className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-zinc-300 font-mono text-[11px] truncate max-w-[170px]" title={activeProvider}>
            {activeProvider}
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
        </div>
      </div>
    </header>
  );
};
