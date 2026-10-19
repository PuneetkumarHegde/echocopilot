/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  AnswerMode, CopilotAnswer, TranscriptTurn, 
  AudioSourceMode, AnswerTriggerPolicy, AudioPipelineStatus,
  AudioInputDevice
} from '@/lib/types';
import { 
  Mic, Headphones, Settings, Minus, X, 
  Play, Pause, Copy, Check, RotateCcw, Send, 
  Key, Cpu, Eye, EyeOff, Sliders, Globe, Code, 
  AlertCircle, CheckCircle2, MessageSquare
} from 'lucide-react';
import { normalizeTechnicalSpeech } from '@/lib/speechNormalizer';

export type { AudioSourceMode };

export interface FloatingCopilotOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  isStandalone?: boolean;
  isSessionActive: boolean;
  isPaused: boolean;
  onToggleSession: () => void;
  onPauseResume: () => void;
  sessionDuration: number;
  currentMode: AnswerMode;
  onModeChange: (mode: AnswerMode) => void;
  audioSourceMode: AudioSourceMode;
  onAudioSourceChange: (mode: AudioSourceMode) => void;
  answerTriggerPolicy?: AnswerTriggerPolicy;
  onAnswerTriggerPolicyChange?: (policy: AnswerTriggerPolicy) => void;
  pipelineStatus: AudioPipelineStatus;
  micAudioLevel: number;
  tabAudioLevel: number;
  transcript: TranscriptTurn[];
  interimTranscript: string;
  answers: CopilotAnswer[];
  activeSpeaker: 'interviewer' | 'candidate';
  onToggleSpeaker: () => void;
  onManualAnswer: (prompt: string) => void;
  onClearTranscript?: () => void;
  isLoadingAnswer: boolean;
  isTabAudioActive: boolean;
  onCaptureTabAudio: () => void;
  sttStatusNotice?: string | null;
  onDismissNotice?: () => void;
  audioInputDevices?: AudioInputDevice[];
  selectedMicDeviceId?: string;
  onSelectMicDevice?: (deviceId: string) => void;
  isMicReceivingAudio?: boolean;
  isTabReceivingAudio?: boolean;
  speechLang?: string;
  onSpeechLangChange?: (lang: string) => void;
  errorMessage?: string | null;
  onDismissError?: () => void;
}

export const FloatingCopilotOverlay: React.FC<FloatingCopilotOverlayProps> = ({
  isOpen,
  onClose,
  isStandalone = false,
  isSessionActive,
  isPaused,
  onToggleSession,
  onPauseResume,
  sessionDuration,
  currentMode,
  onModeChange,
  audioSourceMode,
  onAudioSourceChange,
  pipelineStatus,
  micAudioLevel,
  tabAudioLevel,
  transcript,
  interimTranscript,
  answers,
  activeSpeaker,
  onManualAnswer,
  onClearTranscript,
  isLoadingAnswer,
  isTabAudioActive,
  onCaptureTabAudio,
  audioInputDevices = [],
  selectedMicDeviceId,
  onSelectMicDevice,
  speechLang: propSpeechLang,
  onSpeechLangChange,
  errorMessage,
  onDismissError
}) => {
  // -------------------------------------------------------------
  // 1. Initial State: Start as collapsed circular icon on startup (Option 1)
  // -------------------------------------------------------------
  const [isMinimized, setIsMinimized] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [copiedAnswer, setCopiedAnswer] = useState<boolean>(false);
  const [manualInput, setManualInput] = useState<string>('');
  const [isManualInputOpen, setIsManualInputOpen] = useState<boolean>(false);

  // -------------------------------------------------------------
  // 2. Settings State (Persisted in localStorage, Ollama is primary local model)
  // -------------------------------------------------------------
  const [aiProvider, setAiProvider] = useState<'ollama' | 'builtin' | 'groq' | 'openai'>('ollama');
  const [apiKey, setApiKey] = useState<string>('');
  const [aiModel, setAiModel] = useState<string>('qwen2.5:3b');
  const [ollamaUrl, setOllamaUrl] = useState<string>('http://localhost:11434');
  const [autoAnswer, setAutoAnswer] = useState<boolean>(true);
  const [speechLang, setSpeechLang] = useState<string>(() => propSpeechLang || 'en-IN');
  const [transparency, setTransparency] = useState<number>(75);
  const [fontSize, setFontSize] = useState<'normal' | 'large'>('normal');

  useEffect(() => {
    if (propSpeechLang) setSpeechLang(propSpeechLang);
  }, [propSpeechLang]);

  const handleSpeechLangSelect = (newLang: string) => {
    setSpeechLang(newLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('echocopilot_speech_lang', newLang);
    }
    if (onSpeechLangChange) {
      onSpeechLangChange(newLang);
    }
  };

  // Load saved settings
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedProvider = localStorage.getItem('echocopilot_ai_provider') as any;
      if (savedProvider) setAiProvider(savedProvider);

      const savedKey = localStorage.getItem('echocopilot_api_key');
      if (savedKey) setApiKey(savedKey);

      const savedModel = localStorage.getItem('echocopilot_ai_model');
      if (savedModel) setAiModel(savedModel);

      const savedOllama = localStorage.getItem('echocopilot_ollama_url');
      if (savedOllama) setOllamaUrl(savedOllama);

      const savedAuto = localStorage.getItem('echocopilot_auto_answer');
      if (savedAuto !== null) setAutoAnswer(savedAuto === 'true');

      const savedLang = localStorage.getItem('echocopilot_speech_lang');
      if (savedLang) setSpeechLang(savedLang);

      const savedTrans = localStorage.getItem('echocopilot_transparency');
      if (savedTrans) {
        const val = parseInt(savedTrans, 10);
        if (!isNaN(val)) setTransparency(val);
      }

      const savedFont = localStorage.getItem('echocopilot_font_size') as any;
      if (savedFont) setFontSize(savedFont);
    }
  }, []);

  const saveSettings = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('echocopilot_ai_provider', aiProvider);
      localStorage.setItem('echocopilot_api_key', apiKey.trim());
      localStorage.setItem('echocopilot_ai_model', aiModel.trim());
      localStorage.setItem('echocopilot_ollama_url', ollamaUrl.trim());
      localStorage.setItem('echocopilot_auto_answer', String(autoAnswer));
      localStorage.setItem('echocopilot_speech_lang', speechLang);
      localStorage.setItem('echocopilot_transparency', String(transparency));
      localStorage.setItem('echocopilot_font_size', fontSize);
    }
    setShowSettings(false);
  };

  // -------------------------------------------------------------
  // 3. Native Window Expand / Collapse & Pointer Dragging
  // -------------------------------------------------------------
  const [position, setPosition] = useState({ x: 30, y: 30 });
  const [isDragging, setIsDragging] = useState(false);
  const dragDistanceRef = useRef(0);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const lastScreenPosRef = useRef({ x: 0, y: 0 });
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // Dedicated pointer handling for the collapsed round sign (unconditional hook declarations)
  const collapsedDragStartRef = useRef<{ screenX: number; screenY: number }>({ screenX: 0, screenY: 0 });
  const isCollapsedPointerDownRef = useRef(false);
  const isCollapsedMovedRef = useRef(false);
  const lastExpandTimeRef = useRef(0);

  const handleExpandHUD = () => {
    const now = Date.now();
    if (now - lastExpandTimeRef.current < 350) return;
    lastExpandTimeRef.current = now;
    console.log('[Overlay] handleExpandHUD invoked');
    setIsMinimized(false);
    if (typeof window !== 'undefined') {
      if ((window as any).electronAPI?.expandHUD) {
        console.log('[Overlay] calling electronAPI.expandHUD');
        (window as any).electronAPI.expandHUD(940, 460);
      } else if ((window as any).electronAPI?.setWindowSize) {
        (window as any).electronAPI.setWindowSize(940, 460);
      }
    }
  };

  const handleCollapseHUD = () => {
    console.log('[Overlay] handleCollapseHUD invoked');
    setIsMinimized(true);
    setShowSettings(false);
    if (typeof window !== 'undefined') {
      if ((window as any).electronAPI?.collapseHUD) {
        console.log('[Overlay] calling electronAPI.collapseHUD');
        (window as any).electronAPI.collapseHUD(72, 72);
      } else if ((window as any).electronAPI?.setWindowSize) {
        (window as any).electronAPI.setWindowSize(72, 72);
      }
    }
  };

  // Expose global methods for testing and external trigger
  if (typeof window !== 'undefined') {
    (window as any).__echocopilot_hydrated = true;
    (window as any).__expandEchoCopilotHUD = handleExpandHUD;
    (window as any).__collapseEchoCopilotHUD = handleCollapseHUD;
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__echocopilot_hydrated = true;
      (window as any).__expandEchoCopilotHUD = handleExpandHUD;
      (window as any).__collapseEchoCopilotHUD = handleCollapseHUD;
    }
  }, [handleExpandHUD, handleCollapseHUD]);

  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);
  const isUserScrolledUpRef = useRef<boolean>(false);
  const answerContainerRef = useRef<HTMLDivElement | null>(null);

  const handleTranscriptScroll = () => {
    const el = transcriptContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // If user is more than 50px away from bottom, they intentionally scrolled up!
    isUserScrolledUpRef.current = distanceToBottom > 50;
  };

  useEffect(() => {
    // Only auto-scroll to bottom if user is already near the bottom
    if (!isUserScrolledUpRef.current && transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript.length]);

  const handleCloseWindow = () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.close) {
      (window as any).electronAPI.close();
    } else {
      onClose();
    }
  };

  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handleCopyFullAnswer = (answer: CopilotAnswer) => {
    const text = [
      `## ${answer.question}`,
      `**Summary:** ${answer.summary}`,
      answer.spokenScript ? `**Spoken Script:**\n> "${answer.spokenScript}"` : '',
      `**Key Points:**\n${(answer.bullets || []).map(b => `- ${typeof b === 'string' ? b : JSON.stringify(b)}`).join('\n')}`,
      answer.codeSnippet ? `\`\`\`${answer.codeSnippet.language}\n${answer.codeSnippet.code}\n\`\`\`` : '',
      answer.tradeoffs && answer.tradeoffs.length > 0 ? `**Trade-offs:**\n${answer.tradeoffs.map(t => `- ${typeof t === 'string' ? t : JSON.stringify(t)}`).join('\n')}` : ''
    ].filter(Boolean).join('\n\n');

    navigator.clipboard.writeText(text);
    setCopiedAnswer(true);
    setTimeout(() => setCopiedAnswer(false), 2000);
  };

  const handleQuickSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = manualInput.trim();
    if (!query) return;
    onManualAnswer(query);
    setManualInput('');
    setIsManualInputOpen(false);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const latestAnswer = answers[0] || null;

  useEffect(() => {
    if (latestAnswer && answerContainerRef.current) {
      answerContainerRef.current.scrollTop = 0;
    }
  }, [latestAnswer?.id]);
  const currentAudioLevel = audioSourceMode === 'mic_only' ? micAudioLevel : tabAudioLevel;

  // -------------------------------------------------------------
  // 4. Exact Visual Design: Nearly Clear & Transparent
  // No solid blue fill, no heavy glow, no box shadows around panels
  // -------------------------------------------------------------
  const bgOpacity = Math.max(0.06, (100 - transparency) / 100 * 0.40);
  const containerGlassStyle: React.CSSProperties = {
    background: `rgba(8, 12, 18, ${bgOpacity.toFixed(2)})`,
    backdropFilter: 'blur(5px)',
    WebkitBackdropFilter: 'blur(5px)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
    borderRadius: '12px',
    height: '100%',
    maxHeight: '100%'
  };

  const textShadowStyle: React.CSSProperties = {
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.90), 0 0 1px rgba(0, 0, 0, 0.95)'
  };


  const handleCollapsedPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    isCollapsedPointerDownRef.current = true;
    isCollapsedMovedRef.current = false;
    collapsedDragStartRef.current = { screenX: e.screenX, screenY: e.screenY };
    lastScreenPosRef.current = { x: e.screenX, y: e.screenY };
  };

  const handleCollapsedPointerMove = (e: React.PointerEvent) => {
    if (!isCollapsedPointerDownRef.current) return;
    const deltaX = e.screenX - lastScreenPosRef.current.x;
    const deltaY = e.screenY - lastScreenPosRef.current.y;
    const totalDist = Math.abs(e.screenX - collapsedDragStartRef.current.screenX) + Math.abs(e.screenY - collapsedDragStartRef.current.screenY);

    if (totalDist > 6) {
      isCollapsedMovedRef.current = true;
    }

    if (isCollapsedMovedRef.current && (deltaX !== 0 || deltaY !== 0)) {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.moveWindow) {
        (window as any).electronAPI.moveWindow(deltaX, deltaY);
      }
      lastScreenPosRef.current = { x: e.screenX, y: e.screenY };
    }
  };

  const handleCollapsedPointerUp = (e: React.PointerEvent) => {
    if (!isCollapsedPointerDownRef.current) return;
    isCollapsedPointerDownRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    if (!isCollapsedMovedRef.current) {
      handleExpandHUD();
    }
  };

  const isHeaderPointerDownRef = useRef(false);

  const handleHeaderPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    isHeaderPointerDownRef.current = true;
    lastScreenPosRef.current = { x: e.screenX, y: e.screenY };
  };

  const handleHeaderPointerMove = (e: React.PointerEvent) => {
    if (!isHeaderPointerDownRef.current) return;
    const deltaX = e.screenX - lastScreenPosRef.current.x;
    const deltaY = e.screenY - lastScreenPosRef.current.y;
    if (deltaX !== 0 || deltaY !== 0) {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.moveWindow) {
        (window as any).electronAPI.moveWindow(deltaX, deltaY);
      }
      lastScreenPosRef.current = { x: e.screenX, y: e.screenY };
    }
  };

  const handleHeaderPointerUp = (e: React.PointerEvent) => {
    if (!isHeaderPointerDownRef.current) return;
    isHeaderPointerDownRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  if (!isOpen) return null;

  // =============================================================
  // 1. COLLAPSED VIEW: CIRCULAR AUDIO-WAVEFORM SYMBOL WITH THIN CYAN OUTLINE
  // =============================================================
  if (isMinimized) {
    return (
      <div
        id="echocopilot-collapsed-root"
        style={{ WebkitAppRegion: 'no-drag' } as any}
        className="w-[72px] h-[72px] flex items-center justify-center bg-transparent select-none p-1 cursor-pointer"
        onClick={(e) => {
          if (!isCollapsedMovedRef.current) {
            handleExpandHUD();
          }
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isCollapsedMovedRef.current) {
              handleExpandHUD();
            }
          }}
          onPointerDown={handleCollapsedPointerDown}
          onPointerMove={handleCollapsedPointerMove}
          onPointerUp={handleCollapsedPointerUp}
          className="relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-150 group hover:scale-105 active:scale-95 focus:outline-none cursor-pointer"
          style={{
            WebkitAppRegion: 'no-drag',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(8, 12, 18, 0.95))',
            border: '2px solid rgba(6, 182, 212, 1)',
            boxShadow: '0 0 20px rgba(6, 182, 212, 0.8), 0 4px 16px rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)'
          } as any}
          title="EchoCopilot • Click to Expand HUD (Drag anywhere)"
        >
          {/* Subtle audio waveform icon with thin cyan lines */}
          <div className="flex items-center justify-center gap-[3px] h-6 pointer-events-none">
            <span className={`w-[2.5px] rounded-full bg-cyan-400 transition-all ${isSessionActive && !isPaused ? 'h-3 animate-pulse' : 'h-2'}`} />
            <span className={`w-[2.5px] rounded-full bg-cyan-300 transition-all ${isSessionActive && !isPaused ? 'h-5 animate-pulse delay-75' : 'h-3.5'}`} />
            <span className={`w-[2.5px] rounded-full bg-cyan-400 transition-all ${isSessionActive && !isPaused ? 'h-6 animate-pulse delay-150' : 'h-5'}`} />
            <span className={`w-[2.5px] rounded-full bg-cyan-300 transition-all ${isSessionActive && !isPaused ? 'h-4 animate-pulse delay-75' : 'h-3'}`} />
            <span className={`w-[2.5px] rounded-full bg-cyan-400 transition-all ${isSessionActive && !isPaused ? 'h-2.5 animate-pulse' : 'h-1.5'}`} />
          </div>

          {/* Audio Activity Status Indicator */}
          <span
            className={`absolute top-0 right-0 w-3 h-3 rounded-full border border-black/80 flex items-center justify-center ${
              isSessionActive && !isPaused
                ? currentAudioLevel > 2 ? 'bg-cyan-400 shadow-[0_0_6px_#06b6d4]' : 'bg-emerald-400'
                : 'bg-zinc-600'
            }`}
          />
        </button>
      </div>
    );
  }

  // =============================================================
  // 2. EXPANDED VIEW: COMPACT HORIZONTAL HUD (NO BOXES AROUND CONTENT)
  // Transparent, nearly clear surface showing desktop wallpaper
  // =============================================================
  return (
    <div
      id="echocopilot-main-overlay"
      style={isStandalone ? { height: '100vh', maxHeight: '100vh' } : { left: `${position.x}px`, top: `${position.y}px` }}
      className={`${isStandalone ? 'relative w-full h-screen max-h-screen' : 'fixed z-50 w-[940px] max-w-[98vw] h-[460px]'} flex flex-col select-none animate-in fade-in zoom-in-95 duration-100 min-h-0`}
    >
      <div 
        style={containerGlassStyle}
        className="w-full h-full max-h-full flex flex-col overflow-hidden text-zinc-100 shadow-2xl relative min-h-0"
      >
        {/* -------------------------------------------------------------
         * TOP TOOLBAR (Drag Handle, Honest Status, Controls, Gear, Minimize)
         * ------------------------------------------------------------- */}
        <div 
          style={{ WebkitAppRegion: 'no-drag' } as any}
          className="h-10 border-b border-white/10 px-3 flex items-center justify-between shrink-0 bg-transparent relative select-none"
        >
          {/* Left: Icon & Honest Status (Draggable handle with pointer support) */}
          <div 
            style={{ WebkitAppRegion: 'drag' } as any}
            onPointerDown={handleHeaderPointerDown}
            onPointerMove={handleHeaderPointerMove}
            onPointerUp={handleHeaderPointerUp}
            className="flex items-center gap-2.5 cursor-move pr-2 py-1 select-none"
            title="Drag window"
          >
            <div className="flex items-center gap-1.5 pointer-events-none">
              {/* Circular audio waveform mini-icon */}
              <div className="w-5 h-5 rounded-full border border-cyan-400/80 flex items-center justify-center bg-cyan-500/10">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              </div>
              <span className="font-bold text-xs tracking-wide text-zinc-100" style={textShadowStyle}>
                Echo<span className="text-cyan-400">Copilot</span>
              </span>
            </div>

            {/* Honest Status Dot & Label */}
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-300 pointer-events-none" style={textShadowStyle}>
              {pipelineStatus === 'listening' ? (
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Listening</span>
                </span>
              ) : pipelineStatus === 'transcribing' ? (
                <span className="flex items-center gap-1 text-cyan-400">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span>Transcribing</span>
                </span>
              ) : pipelineStatus === 'generating_answer' ? (
                <span className="flex items-center gap-1 text-amber-300">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-spin" />
                  <span>Answering</span>
                </span>
              ) : pipelineStatus === 'answer_ready' ? (
                <span className="flex items-center gap-1 text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Ready</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-zinc-400">
                  <span className="w-2 h-2 rounded-full bg-zinc-500" />
                  <span>Idle</span>
                </span>
              )}
            </div>

            {/* Session Timer */}
            {isSessionActive && (
              <span className="text-[10px] font-mono text-zinc-300 px-1.5 py-0.5 rounded border border-white/10 pointer-events-none" style={textShadowStyle}>
                {formatTimer(sessionDuration)}
              </span>
            )}
          </div>

          {/* Draggable spacer between left and center */}
          <div 
            style={{ WebkitAppRegion: 'drag' } as any} 
            onPointerDown={handleHeaderPointerDown}
            onPointerMove={handleHeaderPointerMove}
            onPointerUp={handleHeaderPointerUp}
            className="flex-1 h-full cursor-move min-w-[8px]" 
            title="Drag window"
          />

          {/* Center: Audio Source & Controls (strictly NO-DRAG, pointer-events-auto) */}
          <div 
            style={{ WebkitAppRegion: 'no-drag', pointerEvents: 'auto' } as any}
            className="flex items-center gap-2 z-10"
          >
            {/* Audio Source Dropdown */}
            <select
              value={audioSourceMode}
              onChange={(e) => onAudioSourceChange(e.target.value as any)}
              style={{ WebkitAppRegion: 'no-drag', pointerEvents: 'auto' } as any}
              className="bg-zinc-900/90 border border-white/20 rounded px-2 py-0.5 text-[11px] text-zinc-200 focus:outline-none cursor-pointer hover:border-cyan-400/50"
              title="Select audio source"
            >
              <option value="mic_only" className="bg-zinc-900 text-zinc-100">🎙️ MIC Only</option>
              <option value="device_only" className="bg-zinc-900 text-zinc-100">🎧 DEVICE Only</option>
              <option value="both" className="bg-zinc-900 text-zinc-100">🌐 BOTH (Mic + Device)</option>
            </select>

            {/* Speech Accent Language Selector: en-IN | en-US | en-GB */}
            <select
              value={speechLang || 'en-IN'}
              onChange={(e) => handleSpeechLangSelect(e.target.value)}
              style={{ WebkitAppRegion: 'no-drag', pointerEvents: 'auto' } as any}
              className="bg-zinc-900/90 border border-white/20 rounded px-1.5 py-0.5 text-[11px] text-zinc-200 focus:outline-none cursor-pointer hover:border-cyan-400/50"
              title="Speech Accent (Select India for Indian accent precision)"
            >
              <option value="en-IN" className="bg-zinc-900 text-zinc-100">🇮🇳 EN-IN (India)</option>
              <option value="en-US" className="bg-zinc-900 text-zinc-100">🇺🇸 EN-US (US)</option>
              <option value="en-GB" className="bg-zinc-900 text-zinc-100">🇬🇧 EN-GB (UK)</option>
            </select>

            {/* Live Audio Mic Waveform Visualizer */}
            <div 
              style={{ WebkitAppRegion: 'no-drag' } as any}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-all ${
                currentAudioLevel > 5
                  ? 'bg-cyan-950/40 border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.25)]'
                  : 'bg-zinc-900/60 border-white/10'
              }`}
              title={isSessionActive && !isPaused ? `Live Mic Level: ${Math.round(currentAudioLevel)}%` : 'Microphone Idle'}
            >
              <Mic className={`w-3 h-3 transition-colors ${currentAudioLevel > 5 ? 'text-cyan-400 animate-pulse' : isSessionActive && !isPaused ? 'text-emerald-400' : 'text-zinc-500'}`} />
              <div className="flex items-center gap-[2px] h-3.5">
                {[0.4, 0.7, 1.1, 0.8, 1.3, 0.6, 1.0, 0.5].map((factor, idx) => {
                  const isActive = isSessionActive && !isPaused;
                  const rawH = isActive && currentAudioLevel > 4 
                    ? Math.max(3, Math.min(14, Math.round(currentAudioLevel * factor * 0.28))) 
                    : 3;
                  return (
                    <span
                      key={idx}
                      className={`w-[2px] rounded-full transition-all duration-75 ${
                        currentAudioLevel > 5
                          ? 'bg-cyan-400 shadow-[0_0_4px_#06b6d4]'
                          : isActive ? 'bg-emerald-500/60' : 'bg-zinc-700'
                      }`}
                      style={{ height: `${rawH}px` }}
                    />
                  );
                })}
              </div>
              <span className="text-[10px] font-mono text-zinc-300 min-w-[20px]">
                {currentAudioLevel > 4 ? `${Math.round(currentAudioLevel)}%` : '0%'}
              </span>
            </div>

            {/* Start / Stop Button */}
            <button
              type="button"
              onClick={onToggleSession}
              style={{ WebkitAppRegion: 'no-drag', pointerEvents: 'auto' } as any}
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold transition-all border cursor-pointer ${
                isSessionActive
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30 font-bold'
              }`}
            >
              {isSessionActive ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-sm bg-rose-400" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" />
                  <span>Start</span>
                </>
              )}
            </button>

            {/* Manual Ask Toggle Button */}
            <button
              type="button"
              onClick={() => setIsManualInputOpen(!isManualInputOpen)}
              style={{ WebkitAppRegion: 'no-drag', pointerEvents: 'auto' } as any}
              className={`px-2 py-0.5 rounded text-[11px] border transition-colors cursor-pointer ${
                isManualInputOpen
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-zinc-900/40 text-zinc-300 border-white/10 hover:text-zinc-100'
              }`}
              title="Type or edit a question manually"
            >
              Ask
            </button>
          </div>

          {/* Draggable spacer between center and right */}
          <div 
            style={{ WebkitAppRegion: 'drag' } as any} 
            onPointerDown={handleHeaderPointerDown}
            onPointerMove={handleHeaderPointerMove}
            onPointerUp={handleHeaderPointerUp}
            className="flex-1 h-full cursor-move min-w-[8px]" 
            title="Drag window"
          />

          {/* Right: Settings Gear, Minimize to Icon, Close */}
          <div 
            style={{ WebkitAppRegion: 'no-drag', pointerEvents: 'auto' } as any}
            className="flex items-center gap-1 z-10"
          >
            {/* ⚙️ GEAR ICON FOR SETTINGS */}
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              style={{ WebkitAppRegion: 'no-drag', pointerEvents: 'auto' } as any}
              className={`p-1 rounded border transition-colors cursor-pointer ${
                showSettings 
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' 
                  : 'bg-zinc-900/40 border-white/10 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60'
              }`}
              title="Application Settings"
            >
              <Settings className={`w-3.5 h-3.5 ${showSettings ? 'rotate-90 transition-transform' : ''}`} />
            </button>

            {/* Minimize to Icon Button */}
            <button
              type="button"
              onClick={handleCollapseHUD}
              style={{ WebkitAppRegion: 'no-drag', pointerEvents: 'auto' } as any}
              className="p-1 rounded bg-zinc-900/40 hover:bg-zinc-800/60 border border-white/10 text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer"
              title="Minimize to Icon (Preserves session & content)"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={handleCloseWindow}
              style={{ WebkitAppRegion: 'no-drag', pointerEvents: 'auto' } as any}
              className="p-1 rounded bg-zinc-900/40 hover:bg-rose-500/30 hover:border-rose-500/40 border border-white/10 text-zinc-300 hover:text-rose-300 transition-colors cursor-pointer"
              title="Exit application"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Optional Manual Ask Bar */}
        {isManualInputOpen && (
          <form 
            onSubmit={handleQuickSubmit}
            className="h-9 px-3 border-b border-white/10 flex items-center gap-2 bg-zinc-950/40 shrink-0"
          >
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Ask any technical interview question..."
              className="flex-1 bg-zinc-900/60 border border-white/10 rounded px-2.5 py-1 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-400"
              autoFocus
            />
            <button
              type="submit"
              disabled={!manualInput.trim() || isLoadingAnswer}
              className="px-3 py-1 rounded bg-cyan-500/30 hover:bg-cyan-500/40 border border-cyan-500/50 text-cyan-200 font-semibold text-xs flex items-center gap-1 disabled:opacity-40"
            >
              <span>Submit</span>
              <Send className="w-3 h-3" />
            </button>
          </form>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div className="bg-rose-500/20 border-b border-rose-500/30 px-3 py-1.5 flex items-center justify-between text-xs text-rose-300 shrink-0">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
            {onDismissError && (
              <button type="button" onClick={onDismissError} className="hover:text-white p-0.5">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------
         * MAIN 2-COLUMN SURFACE: LIVE TRANSCRIPT & LIVE AI ANSWER
         * Directly on the transparent surface — No boxes or cards around content
         * Thin vertical divider between the two columns
         * ------------------------------------------------------------- */}
        <div className="flex-1 min-h-0 flex overflow-hidden relative">
          {/* =========================================================
           * LEFT COLUMN: LIVE TRANSCRIPT
           * ========================================================= */}
          <div className="w-[45%] min-h-0 border-r border-white/10 flex flex-col p-3 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/5 text-[11px] font-semibold text-zinc-300 shrink-0" style={textShadowStyle}>
              <span className="text-zinc-200 uppercase tracking-wider text-[10px]">Live Transcript</span>
              {onClearTranscript && transcript.length > 0 && (
                <button
                  type="button"
                  onClick={onClearTranscript}
                  className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1 text-[10px] cursor-pointer"
                  title="Clear transcript history"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {/* Real-Time Live Mic Waveform & Activity Strip */}
            <div className="flex items-center justify-between px-2 py-1 rounded bg-zinc-950/40 border border-white/5 mb-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <Mic className={`w-3 h-3 ${currentAudioLevel > 2 ? 'text-cyan-400 animate-pulse' : isSessionActive && !isPaused ? 'text-emerald-400' : 'text-zinc-500'}`} />
                <span className="text-[10px] text-zinc-300 font-medium">
                  {currentAudioLevel > 5 ? 'Voice Detected' : isSessionActive && !isPaused ? 'Listening for speech...' : 'Mic Idle'}
                </span>
              </div>
              <div className="flex items-center gap-[2px] h-3.5">
                {[0.4, 0.6, 0.9, 1.2, 0.7, 1.1, 1.4, 0.8, 1.2, 0.5, 0.9, 0.4].map((scale, i) => {
                  const isActive = isSessionActive && !isPaused;
                  const h = isActive && currentAudioLevel > 4
                    ? Math.max(3, Math.min(14, Math.round(currentAudioLevel * scale * 0.28)))
                    : 2.5;
                  return (
                    <span
                      key={i}
                      className={`w-[2px] rounded-full transition-all duration-75 ${
                        currentAudioLevel > 5
                          ? 'bg-cyan-400 shadow-[0_0_3px_#06b6d4]'
                          : isActive ? 'bg-emerald-500/50' : 'bg-zinc-700'
                      }`}
                      style={{ height: `${h}px` }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Transcript Stream (No nested cards or individual boxes) */}
            <div 
              ref={transcriptContainerRef}
              onScroll={handleTranscriptScroll}
              className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 font-sans select-text"
            >
              {transcript.length === 0 && !interimTranscript && (
                <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400 text-xs py-8" style={textShadowStyle}>
                  <p className="font-medium text-zinc-300">Speech-to-text is ready</p>
                  <p className="text-[11px] text-zinc-400 mt-1 max-w-[220px]">
                    {isSessionActive 
                      ? 'Listening... Spoken words will appear directly here.' 
                      : 'Click "Start" above to begin live listening.'}
                  </p>
                </div>
              )}

              {/* Natural speech flow directly on transparent surface */}
              {transcript.map((turn) => {
                const isInterviewer = turn.speaker === 'interviewer';
                return (
                  <div key={turn.id} className="flex flex-col gap-0.5 py-0.5 animate-in fade-in duration-100">
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className={`font-bold ${isInterviewer ? 'text-cyan-400' : 'text-emerald-400'}`} style={textShadowStyle}>
                        {isInterviewer ? 'Interviewer' : 'You'}
                      </span>
                      <span className="text-zinc-400 font-mono text-[9px]" style={textShadowStyle}>
                        {new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <p className={`text-zinc-100 leading-relaxed ${fontSize === 'large' ? 'text-sm' : 'text-xs'}`} style={textShadowStyle}>
                      {turn.text}
                    </p>
                  </div>
                );
              })}

              {/* Real-time Live Streaming Transition Turn */}
              {interimTranscript && (
                <div className="flex flex-col gap-0.5 py-1 animate-in fade-in duration-75">
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="font-bold text-cyan-400" style={textShadowStyle}>
                      {activeSpeaker === 'interviewer' ? 'Interviewer' : 'You'}
                    </span>
                    <span className="flex items-center gap-1 text-cyan-400 font-mono text-[9px] bg-cyan-500/15 px-1.5 py-0.2 rounded border border-cyan-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                      <span>LIVE</span>
                    </span>
                  </div>
                  <p className={`text-cyan-200 font-medium leading-relaxed flex items-center gap-1 ${fontSize === 'large' ? 'text-sm' : 'text-xs'}`} style={textShadowStyle}>
                    <span>{interimTranscript}</span>
                    <span className="inline-block w-1.5 h-3.5 bg-cyan-400 animate-pulse ml-0.5 rounded-sm" />
                  </p>
                </div>
              )}

              <div ref={transcriptEndRef} />
            </div>
          </div>

          {/* =========================================================
           * RIGHT COLUMN: LIVE AI ANSWER
           * Directly on the transparent surface — No boxes or cards around content
           * ========================================================= */}
          <div className="w-[55%] min-h-0 flex flex-col p-3 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/5 text-[11px] font-semibold text-zinc-300 shrink-0" style={textShadowStyle}>
              <div className="flex items-center gap-2">
                <span className="text-zinc-200 uppercase tracking-wider text-[10px]">Live AI Answer</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono">
                  {aiProvider === 'ollama' ? `🦙 ${aiModel}` : aiProvider === 'groq' ? '⚡ Groq Llama 3.3' : '🛡️ Smart Engine'}
                </span>
              </div>

              {latestAnswer && (
                <button
                  type="button"
                  onClick={() => handleCopyFullAnswer(latestAnswer)}
                  className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1 text-[10px] cursor-pointer"
                  title="Copy full structured answer"
                >
                  {copiedAnswer ? (
                    <>
                      <Check className="w-2.5 h-2.5 text-cyan-400" />
                      <span className="text-cyan-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-2.5 h-2.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Answer Content Body (Direct on transparent surface) */}
            <div 
              ref={answerContainerRef}
              className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1 font-sans select-text"
            >
              {/* Generating Shimmer */}
              {isLoadingAnswer && (
                <div className="py-4 text-cyan-300 text-xs flex items-center gap-2 animate-pulse" style={textShadowStyle}>
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>Synthesizing answer using {aiModel}...</span>
                </div>
              )}

              {/* No Answer Yet State */}
              {answers.length === 0 && !isLoadingAnswer && (
                <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400 text-xs py-8" style={textShadowStyle}>
                  <p className="font-medium text-zinc-300">Awaiting interview question</p>
                  <p className="text-[11px] text-zinc-400 mt-1 max-w-[260px]">
                    Questions spoken by the interviewer or candidate will generate live answers here.
                  </p>
                </div>
              )}

              {/* Structured Answers Feed (Scroll down to review full conversation history) */}
              {answers.length > 0 && answers.map((answer, index) => (
                <div key={answer.id || index} className={`space-y-2.5 ${index > 0 ? 'pt-3 mt-3 border-t border-white/10' : ''}`}>
                  {/* Question Title & Timestamp */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold text-cyan-300/90 leading-tight" style={textShadowStyle}>
                      Q: {answer.question}
                    </div>
                    {answer.timestamp && (
                      <span className="text-zinc-400 font-mono text-[9px] shrink-0" style={textShadowStyle}>
                        {new Date(answer.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    )}
                  </div>

                  {/* 1. Summary */}
                  <div className={`text-zinc-100 font-medium leading-relaxed ${fontSize === 'large' ? 'text-sm' : 'text-xs'}`} style={textShadowStyle}>
                    {answer.summary}
                  </div>

                  {/* 2. Spoken Script ("What to say out loud") */}
                  {answer.spokenScript && (
                    <div className="pl-2 border-l-2 border-cyan-400/60 my-1">
                      <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-0.5" style={textShadowStyle}>
                        What to say out loud
                      </div>
                      <p className={`text-cyan-100 leading-relaxed italic ${fontSize === 'large' ? 'text-sm' : 'text-xs'}`} style={textShadowStyle}>
                        &ldquo;{answer.spokenScript}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* 3. Core Technical Points */}
                  {answer.bullets && answer.bullets.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider" style={textShadowStyle}>
                        Key Points & Mechanisms
                      </div>
                      <ul className="space-y-1">
                        {answer.bullets.map((bullet, idx) => (
                          <li key={idx} className={`flex items-start gap-1.5 text-zinc-200 leading-relaxed ${fontSize === 'large' ? 'text-sm' : 'text-xs'}`} style={textShadowStyle}>
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                            <span>{typeof bullet === 'string' ? bullet : JSON.stringify(bullet)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 4. Code Solution & Complexity */}
                  {answer.codeSnippet && answer.codeSnippet.code && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider" style={textShadowStyle}>
                        <span>Code Solution ({answer.codeSnippet.language})</span>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(answer.id, answer.codeSnippet!.code)}
                          className="text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 cursor-pointer"
                        >
                          {copiedCodeId === answer.id ? <span>Copied</span> : <span>Copy</span>}
                        </button>
                      </div>

                      <pre className="p-2 rounded bg-zinc-950/70 font-mono text-[11px] text-cyan-200 overflow-x-auto leading-relaxed border border-white/10">
                        <code>{answer.codeSnippet.code}</code>
                      </pre>

                      {(answer.codeSnippet.timeComplexity || answer.codeSnippet.spaceComplexity) && (
                        <div className="flex items-center gap-3 text-[10px] text-zinc-300 font-mono" style={textShadowStyle}>
                          {answer.codeSnippet.timeComplexity && (
                            <span>Time: <strong className="text-cyan-300">{answer.codeSnippet.timeComplexity}</strong></span>
                          )}
                          {answer.codeSnippet.spaceComplexity && (
                            <span>Space: <strong className="text-emerald-300">{answer.codeSnippet.spaceComplexity}</strong></span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 5. Architectural Trade-offs */}
                  {answer.tradeoffs && answer.tradeoffs.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="text-[10px] font-bold text-amber-300 uppercase tracking-wider" style={textShadowStyle}>
                        Trade-offs
                      </div>
                      <ul className="space-y-0.5">
                        {answer.tradeoffs.map((item, i) => (
                          <li key={i} className={`flex items-start gap-1.5 text-zinc-300 leading-relaxed ${fontSize === 'large' ? 'text-sm' : 'text-xs'}`} style={textShadowStyle}>
                            <span className="text-amber-400">⚖</span>
                            <span>{typeof item === 'string' ? item : JSON.stringify(item)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* =========================================================
           * ⚙️ COMPACT SETTINGS DRAWER
           * ========================================================= */}
          {showSettings && (
            <div className="absolute inset-0 z-30 bg-zinc-950/90 backdrop-blur-md flex flex-col p-4 overflow-y-auto animate-in fade-in duration-100">
              <div className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-100">
                  <Settings className="w-3.5 h-3.5 text-cyan-400" />
                  <span>EchoCopilot Settings</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="py-3 space-y-3.5 text-xs">
                {/* AI Engine Selection */}
                <div className="space-y-1">
                  <label className="font-semibold text-zinc-200">AI Answer Model</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'ollama', name: '🦙 Local Ollama', desc: '100% offline & private' },
                      { id: 'builtin', name: '🛡️ Smart Built-in', desc: 'Instant offline fallback' },
                      { id: 'groq', name: '⚡ Groq (Llama 3.3)', desc: 'Ultra-fast cloud ~300ms' },
                      { id: 'openai', name: '🧠 OpenAI', desc: 'GPT-4o cloud model' }
                    ].map((provider) => (
                      <button
                        key={provider.id}
                        type="button"
                        onClick={() => setAiProvider(provider.id as any)}
                        className={`p-2 rounded border text-left transition-all ${
                          aiProvider === provider.id
                            ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                            : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <div className="font-bold text-xs">{provider.name}</div>
                        <div className="text-[10px] text-zinc-400">{provider.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ollama Model Selection */}
                {aiProvider === 'ollama' && (
                  <div className="space-y-1">
                    <label className="font-semibold text-zinc-200">Installed Ollama Model</label>
                    <div className="flex gap-2">
                      <select
                        value={aiModel}
                        onChange={(e) => setAiModel(e.target.value)}
                        className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1 text-xs text-zinc-200 flex-1 font-mono focus:outline-none"
                      >
                        <option value="qwen2.5:3b">qwen2.5:3b (Fast Local)</option>
                        <option value="llama3.2:1b">llama3.2:1b (Meta LLaMA)</option>
                      </select>
                      <input
                        type="text"
                        value={ollamaUrl}
                        onChange={(e) => setOllamaUrl(e.target.value)}
                        placeholder="http://localhost:11434"
                        className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1 text-xs text-zinc-200 w-44 font-mono focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* API Key (only if user chooses Groq/OpenAI) */}
                {(aiProvider === 'groq' || aiProvider === 'openai') && (
                  <div className="space-y-1">
                    <label className="font-semibold text-zinc-200">
                      {aiProvider === 'groq' ? 'Groq API Key' : 'OpenAI API Key'}
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={aiProvider === 'groq' ? 'gsk_...' : 'sk-...'}
                        className="w-full bg-zinc-900 border border-white/10 rounded px-2.5 py-1 text-xs text-zinc-200 font-mono pr-8 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2 top-1.5 text-zinc-400 hover:text-zinc-200"
                      >
                        {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Audio & Recognition Settings */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="font-semibold text-zinc-200 block mb-1">Audio Source Mode</label>
                    <select
                      value={audioSourceMode}
                      onChange={(e) => onAudioSourceChange(e.target.value as any)}
                      className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none"
                    >
                      <option value="mic_only">🎙️ Microphone Only</option>
                      <option value="device_only">🎧 Meeting Tab Audio</option>
                      <option value="both">🌐 Both (Mic + Device)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-zinc-200 block mb-1">Text Font Size</label>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setFontSize('normal')}
                        className={`flex-1 py-1 rounded text-xs border ${
                          fontSize === 'normal' ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-zinc-900 border-white/5 text-zinc-400'
                        }`}
                      >
                        Normal
                      </button>
                      <button
                        type="button"
                        onClick={() => setFontSize('large')}
                        className={`flex-1 py-1 rounded text-xs border ${
                          fontSize === 'large' ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-zinc-900 border-white/5 text-zinc-400'
                        }`}
                      >
                        Large
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-2 border-t border-white/10 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={saveSettings}
                  className="px-3.5 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-xs transition-colors"
                >
                  Save Settings
                </button>
              </div>
            </div>
          )}
        </div>

        {/* -------------------------------------------------------------
         * BOTTOM TOOLBAR (Compact Transparency Slider 0-90%)
         * Minimal footprint — No large footer reserved
         * ------------------------------------------------------------- */}
        <div className="h-7 border-t border-white/10 px-3 flex items-center justify-between text-[11px] text-zinc-400 shrink-0 bg-transparent">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span className="text-[10px] text-zinc-400" style={textShadowStyle}>EchoCopilot Floating HUD</span>
          </div>

          {/* Compact Transparency Slider 0-90% */}
          <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
            <span className="text-[10px] text-zinc-400" style={textShadowStyle}>Transparency:</span>
            <input
              type="range"
              min="0"
              max="90"
              value={transparency}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setTransparency(val);
                if (typeof window !== 'undefined') {
                  localStorage.setItem('echocopilot_transparency', String(val));
                }
              }}
              className="w-24 h-1 accent-cyan-400 cursor-pointer"
            />
            <span className="text-[10px] font-mono text-cyan-300 w-7 text-right" style={textShadowStyle}>{transparency}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
