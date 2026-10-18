/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  AnswerMode, CopilotAnswer, TranscriptTurn, 
  AudioSourceMode, AnswerTriggerPolicy, AudioPipelineStatus,
  AudioInputDevice
} from '@/lib/types';
import { 
  Play, Square, Pause, Sparkles, Copy, Check, 
  X, Minus, Maximize2, Move, ExternalLink, RefreshCw,
  Headphones, Mic, Layers, MessageSquare,
  Volume2, ChevronDown, ChevronUp, Activity, AlertCircle,
  Sliders, LayoutList, PanelRight, Pin, Send, Info, CheckCircle
} from 'lucide-react';

export type { AudioSourceMode };

/**
 * Calculates genuine native OS window opacity from transparency percentage.
 * 0% transparency -> 1.0 (fully opaque)
 * 30% transparency -> 0.78 (subtle glass)
 * 70% transparency -> 0.48 (recommended translucent glass: desktop apps clearly visible)
 * 90% transparency -> 0.33 (high transparency)
 */
export const calcNativeOpacity = (transparencyPercent: number): number => {
  const op = 1.0 - (transparencyPercent / 100) * 0.75;
  return Math.max(0.18, Math.min(1.0, Number(op.toFixed(2))));
};

const dragRegionStyle: React.CSSProperties = { WebkitAppRegion: 'drag' } as any;
const noDragStyle: React.CSSProperties = { WebkitAppRegion: 'no-drag' } as any;

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
  isLoadingAnswer: boolean;
  isTabAudioActive: boolean;
  onCaptureTabAudio: () => void;
  sttStatusNotice?: string | null;
  onDismissNotice?: () => void;
  // Audio Input Device and Sample Verification
  audioInputDevices?: AudioInputDevice[];
  selectedMicDeviceId?: string;
  onSelectMicDevice?: (deviceId: string) => void;
  isMicReceivingAudio?: boolean;
  isTabReceivingAudio?: boolean;
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
  onToggleSpeaker,
  onManualAnswer,
  isLoadingAnswer,
  isTabAudioActive,
  onCaptureTabAudio,
  sttStatusNotice,
  onDismissNotice,
  audioInputDevices = [],
  selectedMicDeviceId,
  onSelectMicDevice,
  isMicReceivingAudio = false,
  isTabReceivingAudio = false,
  errorMessage,
  onDismissError
}) => {
  // -------------------------------------------------------------
  // Layout and Display State
  // -------------------------------------------------------------
  const [layout, setLayout] = useState<'horizontal' | 'column'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('echocopilot_hud_layout');
      if (saved === 'horizontal' || saved === 'column') return saved;
    }
    return 'horizontal'; // Horizontal mode is default per specification
  });

  // Transparency: 0% (opaque), 30% (slight), 70% (recommended default), 90% (high)
  const [transparency, setTransparency] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('echocopilot_transparency');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 0 && val <= 95) return val;
      }
    }
    return 70; // 70% default recommended
  });

  const [isMinimized, setIsMinimized] = useState(false);
  const [isAnswerExpanded, setIsAnswerExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'answers' | 'transcript'>('answers');
  const [showMicPicker, setShowMicPicker] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [bothModeQuestion, setBothModeQuestion] = useState('');
  const [columnQuickPrompt, setColumnQuickPrompt] = useState('');
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const latestAnswer = answers[0] || null;

  // Electron Desktop Overlay Environment
  const isElectron = typeof window !== 'undefined' && Boolean((window as any).electronAPI?.isElectron);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true);

  // Position & Dragging (Native OS Screen & Browser DOM)
  const [position, setPosition] = useState(() => {
    if (typeof window !== 'undefined') {
      return { x: Math.max(20, Math.floor((window.innerWidth - 780) / 2)), y: 30 };
    }
    return { x: 40, y: 30 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const lastScreenPosRef = useRef({ x: 0, y: 0 });

  // Persist Layout & Dynamic Electron Window Resize
  const handleLayoutChange = (newLayout: 'horizontal' | 'column') => {
    setLayout(newLayout);
    if (typeof window !== 'undefined') {
      localStorage.setItem('echocopilot_hud_layout', newLayout);
      if ((window as any).electronAPI?.setWindowSize) {
        if (newLayout === 'horizontal') {
          (window as any).electronAPI.setWindowSize(1040, isAnswerExpanded && latestAnswer ? 580 : 380);
        } else {
          (window as any).electronAPI.setWindowSize(460, 740);
        }
      }
    }
  };

  // Transparency Slider: Synchronizes Native DWM Opacity & LocalStorage
  const handleTransparencyChange = (newVal: number) => {
    const clamped = Math.max(0, Math.min(90, newVal));
    setTransparency(clamped);
    if (typeof window !== 'undefined') {
      localStorage.setItem('echocopilot_transparency', String(clamped));
      if ((window as any).electronAPI?.setOpacity) {
        (window as any).electronAPI.setOpacity(calcNativeOpacity(clamped));
      }
    }
  };

  // Sync native opacity on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.setOpacity) {
      (window as any).electronAPI.setOpacity(calcNativeOpacity(transparency));
    }
  }, []);

  // Sync native window size on layout, answer drawer, and minimize state changes in Electron
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.setWindowSize) {
      if (isMinimized) {
        (window as any).electronAPI.setWindowSize(320, 60);
      } else if (layout === 'horizontal') {
        (window as any).electronAPI.setWindowSize(1040, isAnswerExpanded && latestAnswer ? 580 : 380);
      } else {
        (window as any).electronAPI.setWindowSize(460, 740);
      }
    }
  }, [layout, isAnswerExpanded, Boolean(latestAnswer), isMinimized]);

  // Window Controls for Persistent Desktop Overlay
  const handleTogglePin = () => {
    const nextVal = !isAlwaysOnTop;
    setIsAlwaysOnTop(nextVal);
    if (typeof window !== 'undefined' && (window as any).electronAPI?.setAlwaysOnTop) {
      (window as any).electronAPI.setAlwaysOnTop(nextVal);
    } else {
      handlePopOutAlwaysOnTop();
    }
  };

  const handleMinimizeWindow = () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.minimize) {
      (window as any).electronAPI.minimize();
    } else {
      setIsMinimized(true);
    }
  };

  const handleCloseWindow = () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.close) {
      (window as any).electronAPI.close();
    } else {
      onClose();
    }
  };

  // Drag Handlers: Dual Native IPC delta moving and React DOM positioning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragOffsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
    lastScreenPosRef.current = { x: e.screenX, y: e.screenY };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      if (typeof window !== 'undefined' && (window as any).electronAPI?.moveWindow) {
        const deltaX = e.screenX - lastScreenPosRef.current.x;
        const deltaY = e.screenY - lastScreenPosRef.current.y;
        if (deltaX !== 0 || deltaY !== 0) {
          (window as any).electronAPI.moveWindow(deltaX, deltaY);
          lastScreenPosRef.current = { x: e.screenX, y: e.screenY };
        }
      } else {
        const minX = 10;
        const maxX = Math.max(20, window.innerWidth - (layout === 'horizontal' ? 320 : 220));
        const minY = 10;
        const maxY = Math.max(20, window.innerHeight - 80);

        const nextX = Math.min(Math.max(minX, e.clientX - dragOffsetRef.current.x), maxX);
        const nextY = Math.min(Math.max(minY, e.clientY - dragOffsetRef.current.y), maxY);
        setPosition({ x: nextX, y: nextY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, layout]);

  // Expand latest answer when a new answer arrives
  useEffect(() => {
    if (answers.length > 0) {
      setIsAnswerExpanded(true);
    }
  }, [answers.length]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Manual Ask in BOTH mode: Submits question to local answer engine
  const handleBothModeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = bothModeQuestion.trim();
    if (!query) return;

    try {
      onManualAnswer(query);
      setBothModeQuestion(''); // Clear on successful submission
      setIsAnswerExpanded(true);
    } catch {
      // Preserved on failure per requirement
    }
  };

  const handleColumnSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = columnQuickPrompt.trim();
    if (!query) return;

    try {
      onManualAnswer(query);
      setColumnQuickPrompt('');
      setActiveTab('answers');
    } catch {}
  };

  // Pop-out into always-on-top Document PiP (Chrome 116+) or popup window
  const handlePopOutAlwaysOnTop = async () => {
    if (typeof window !== 'undefined' && 'documentPictureInPicture' in window) {
      try {
        const pip = (window as any).documentPictureInPicture;
        const pipWin = await pip.requestWindow({
          width: layout === 'horizontal' ? 820 : 440,
          height: layout === 'horizontal' ? 440 : 700
        });

        // Copy styles to PiP window
        [...document.styleSheets].forEach(styleSheet => {
          try {
            const cssRules = [...styleSheet.cssRules].map(rule => rule.cssText).join('');
            const style = pipWin.document.createElement('style');
            style.textContent = cssRules;
            pipWin.document.head.appendChild(style);
          } catch {
            const link = pipWin.document.createElement('link');
            link.rel = 'stylesheet';
            link.type = styleSheet.type;
            link.media = styleSheet.media;
            link.href = styleSheet.href;
            pipWin.document.head.appendChild(link);
          }
        });

        pipWin.document.body.className = 'bg-transparent text-zinc-100 p-2 font-sans';

        const iframe = pipWin.document.createElement('iframe');
        iframe.src = '/floating';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.background = 'transparent';
        pipWin.document.body.appendChild(iframe);
        return;
      } catch (pipErr) {
        console.warn('Document PiP failed, falling back to popup:', pipErr);
      }
    }

    // Fallback: standard popup window
    if (typeof window !== 'undefined') {
      window.open(
        '/floating',
        'EchoCopilotHUD',
        `width=${layout === 'horizontal' ? 840 : 450},height=${layout === 'horizontal' ? 450 : 700},menubar=no,toolbar=no,location=no,status=no`
      );
    }
  };

  // -------------------------------------------------------------
  // Real Glassmorphism CSS Styling per Specification
  // -------------------------------------------------------------
  // Smoothly calculate dark translucent glass background opacity:
  // 0% -> 1.0 (opaque)
  // 30% -> 0.70 (slightly transparent)
  // 70% -> 0.35 (recommended default per specification)
  // 90% -> 0.15 (highly transparent)
  const computedOpacity = (
    transparency <= 70
      ? 1.0 - (transparency / 70) * (1.0 - 0.35)
      : 0.35 - ((transparency - 70) / 20) * (0.35 - 0.15)
  ).toFixed(2);

  const containerGlassStyle: React.CSSProperties = {
    background: isElectron
      ? `rgba(10, 14, 23, ${Math.max(0.35, Number(computedOpacity))})`
      : `rgba(12, 15, 22, ${computedOpacity})`,
    backdropFilter: 'blur(20px) saturate(150%)',
    WebkitBackdropFilter: 'blur(20px) saturate(150%)',
    border: '1px solid rgba(255, 255, 255, 0.16)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
    borderRadius: '16px'
  };

  const currentAudioLevel = audioSourceMode === 'mic_only' ? micAudioLevel : tabAudioLevel;

  // Selected microphone label
  const activeMicDevice = audioInputDevices.find(d => d.deviceId === selectedMicDeviceId);
  const activeMicLabel = activeMicDevice?.label || 'Default Microphone';

  // Waveform Bar Component
  const renderWaveform = (level: number, active: boolean) => {
    return (
      <div className="flex items-center gap-[2px] h-3.5 px-1" title={`Live Audio Level: ${level}%`}>
        {[0.4, 0.9, 0.6, 1.0, 0.5].map((scale, i) => {
          const barHeight = active && level > 2
            ? Math.max(3, Math.min(14, Math.round((level / 100) * 14 * scale)))
            : 3;
          return (
            <div
              key={i}
              className={`w-[2.5px] rounded-full transition-all duration-75 ${
                active && level > 2 
                  ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' 
                  : 'bg-zinc-700'
              }`}
              style={{ height: `${barHeight}px` }}
            />
          );
        })}
      </div>
    );
  };

  // Status Badge Component
  const renderStatusBadge = () => {
    switch (pipelineStatus) {
      case 'listening':
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>LISTENING</span>
          </span>
        );
      case 'transcribing':
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-sky-500/15 text-sky-300 border border-sky-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
            <span>TRANSCRIBING</span>
          </span>
        );
      case 'question_detected':
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-violet-500/20 text-violet-300 border border-violet-500/40 animate-pulse">
            <Sparkles className="w-2.5 h-2.5 text-violet-400" />
            <span>QUESTION DETECTED</span>
          </span>
        );
      case 'generating_answer':
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <RefreshCw className="w-2.5 h-2.5 text-amber-400 animate-spin" />
            <span>ANSWERING...</span>
          </span>
        );
      case 'answer_ready':
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <Check className="w-2.5 h-2.5 text-emerald-400" />
            <span>ANSWER READY</span>
          </span>
        );
      case 'paused':
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <span>PAUSED</span>
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <AlertCircle className="w-2.5 h-2.5 text-rose-400" />
            <span>ERROR</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-zinc-800/80 text-zinc-400 border border-zinc-700/60">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
            <span>IDLE</span>
          </span>
        );
    }
  };

  // Hardware Audio Sample Status Badge
  const renderAudioSampleBadge = () => {
    if (!isSessionActive || isPaused) return null;

    if (audioSourceMode === 'mic_only') {
      return (
        <div 
          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-900/80 border border-white/5 text-[9px] font-mono"
          title={`Microphone: ${activeMicLabel} (${isMicReceivingAudio ? 'Receiving real audio samples' : 'Awaiting audio energy'})`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isMicReceivingAudio || micAudioLevel > 2 ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
          <span className="text-zinc-300">MIC:</span>
          <span className={isMicReceivingAudio || micAudioLevel > 2 ? 'text-emerald-400 font-bold' : 'text-zinc-500'}>
            {micAudioLevel}%
          </span>
        </div>
      );
    }

    if (audioSourceMode === 'device_only') {
      return (
        <div 
          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-900/80 border border-white/5 text-[9px] font-mono"
          title={`Device Audio: ${isTabAudioActive ? 'Tab captured' : 'Tab not connected'} (${isTabReceivingAudio ? 'Receiving real audio samples' : 'Awaiting tab audio'})`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isTabReceivingAudio || tabAudioLevel > 2 ? 'bg-sky-400' : 'bg-zinc-600'}`} />
          <span className="text-zinc-300">TAB:</span>
          <span className={isTabReceivingAudio || tabAudioLevel > 2 ? 'text-sky-400 font-bold' : 'text-zinc-500'}>
            {tabAudioLevel}%
          </span>
        </div>
      );
    }

    // BOTH Mode: Display both audio levels
    return (
      <div 
        className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900/80 border border-white/5 text-[9px] font-mono"
        title="Simultaneous streams: Interviewer Device (auto-answers) & Candidate Mic (feedback-free)"
      >
        <span className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${isMicReceivingAudio || micAudioLevel > 2 ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
          <span className="text-zinc-400">MIC:</span>
          <span className={isMicReceivingAudio || micAudioLevel > 2 ? 'text-emerald-400 font-bold' : 'text-zinc-500'}>
            {micAudioLevel}%
          </span>
        </span>
        <span className="text-zinc-700">|</span>
        <span className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${isTabReceivingAudio || tabAudioLevel > 2 ? 'bg-sky-400' : 'bg-zinc-600'}`} />
          <span className="text-zinc-400">TAB:</span>
          <span className={isTabReceivingAudio || tabAudioLevel > 2 ? 'text-sky-400 font-bold' : 'text-zinc-500'}>
            {tabAudioLevel}%
          </span>
        </span>
      </div>
    );
  };

  if (!isOpen) return null;

  // -------------------------------------------------------------
  // MINIMIZED FLOATING PILL
  // -------------------------------------------------------------
  if (isMinimized) {
    return (
      <div
        style={{
          ...(isStandalone ? {} : { left: `${position.x}px`, top: `${position.y}px` }),
          ...containerGlassStyle,
          ...dragRegionStyle
        }}
        className={`${isStandalone ? 'relative' : 'fixed z-50'} flex items-center gap-3 px-3.5 py-2 rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.8)] cursor-move select-none animate-in fade-in duration-150`}
        onMouseDown={handleMouseDown}
      >
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        <span className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>EchoCopilot ({formatTimer(sessionDuration)})</span>
        </span>
        <button
          onClick={() => setIsMinimized(false)}
          style={noDragStyle}
          className="p-1 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 transition-colors"
          title="Restore EchoCopilot HUD"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // =============================================================
  // LAYOUT 1: HORIZONTAL MODE (DEFAULT SPECIFICATION)
  // =============================================================
  if (layout === 'horizontal') {
    return (
      <div
        style={isStandalone ? {} : { left: `${position.x}px`, top: `${position.y}px` }}
        className={`${isStandalone ? 'relative' : 'fixed z-50'} flex flex-col items-center select-none animate-in fade-in zoom-in-95 duration-150 max-w-[96vw]`}
      >
        {/* COMPACT FLOATING BAR WITH TRUE GLASSMORPHISM */}
        <div
          style={containerGlassStyle}
          className="flex items-center gap-1.5 px-3 py-1.5 flex-nowrap w-auto max-w-[1040px]"
        >
          {/* Drag Handle & Branding */}
          <div
            onMouseDown={handleMouseDown}
            style={dragRegionStyle}
            className="flex items-center gap-2 cursor-move pr-1 border-r border-white/10 select-none"
            title="Drag EchoCopilot HUD over other applications"
          >
            <Move className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300" />
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="font-bold text-xs text-zinc-100 tracking-tight">EchoCopilot</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
              {formatTimer(sessionDuration)}
            </span>
          </div>

          {/* Start / Stop & Pause */}
          <div className="flex items-center gap-1" style={noDragStyle}>
            <button
              onClick={onToggleSession}
              style={noDragStyle}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                isSessionActive
                  ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 shadow-sm'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold shadow-sm shadow-emerald-500/30'
              }`}
              title={isSessionActive ? 'Stop session' : 'Start live session'}
            >
              {isSessionActive ? (
                <>
                  <Square className="w-3 h-3 fill-current" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" />
                  <span>Start</span>
                </>
              )}
            </button>

            {isSessionActive && (
              <button
                onClick={onPauseResume}
                style={noDragStyle}
                className={`p-1.5 rounded-lg border transition-all text-xs ${
                  isPaused
                    ? 'bg-amber-500 text-zinc-950 border-amber-400'
                    : 'bg-zinc-800/80 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                }`}
                title={isPaused ? 'Resume' : 'Pause'}
              >
                {isPaused ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3" />}
              </button>
            )}
          </div>

          {/* Listening Status & Audio Waveform */}
          <div className="flex items-center gap-1.5 pl-1 pr-1.5 border-r border-white/10">
            {renderStatusBadge()}
            {renderWaveform(currentAudioLevel, isSessionActive && !isPaused)}
            {renderAudioSampleBadge()}
          </div>

          {/* Microphone Device Picker Dropdown (Part 1 - Enumerate & Select Input Device) */}
          {(audioSourceMode === 'mic_only' || audioSourceMode === 'both') && (
            <div className="relative">
              <button
                onClick={() => setShowMicPicker(prev => !prev)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-900/90 text-[10px] text-zinc-300 border border-white/10 hover:border-emerald-500/40 transition-colors max-w-[130px]"
                title={`Active Mic: ${activeMicLabel}. Click to select audio input device.`}
              >
                <Mic className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                <span className="truncate">{activeMicLabel}</span>
                <ChevronDown className="w-2.5 h-2.5 text-zinc-500 shrink-0" />
              </button>

              {showMicPicker && (
                <div 
                  style={containerGlassStyle}
                  className="absolute left-0 top-full mt-1.5 w-64 p-2 rounded-xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100"
                >
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 px-1 flex items-center justify-between">
                    <span>Select Microphone</span>
                    <button onClick={() => setShowMicPicker(false)} className="text-zinc-500 hover:text-zinc-300">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  {audioInputDevices.length === 0 ? (
                    <div className="text-[11px] text-zinc-400 p-2 text-center">
                      Default System Microphone
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {audioInputDevices.map((dev) => {
                        const isSelected = dev.deviceId === selectedMicDeviceId || (!selectedMicDeviceId && dev.deviceId === 'default');
                        return (
                          <button
                            key={dev.deviceId || Math.random().toString()}
                            onClick={() => {
                              if (onSelectMicDevice) onSelectMicDevice(dev.deviceId);
                              setShowMicPicker(false);
                            }}
                            className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between gap-1 transition-all ${
                              isSelected
                                ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                                : 'text-zinc-300 hover:bg-white/5'
                            }`}
                          >
                            <span className="truncate">{dev.label || `Microphone (${dev.deviceId.slice(0, 8)})`}</span>
                            {isSelected && <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Audio Source Modes in Corner: MIC | DEVICE | BOTH */}
          <div className="flex bg-zinc-900/90 p-0.5 rounded-xl border border-white/10 gap-0.5">
            <button
              onClick={() => onAudioSourceChange('mic_only')}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                audioSourceMode === 'mic_only'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="MIC Mode: Candidate speech (Auto-generates answer for spoken technical questions)"
            >
              <Mic className="w-2.5 h-2.5" />
              <span>MIC</span>
            </button>

            <button
              onClick={() => {
                onAudioSourceChange('device_only');
                if (!isTabAudioActive) onCaptureTabAudio();
              }}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                audioSourceMode === 'device_only'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-400/50 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="DEVICE Mode: Meeting tab audio (Auto-generates answer for interviewer questions)"
            >
              <Headphones className="w-2.5 h-2.5" />
              <span>DEVICE</span>
            </button>

            <button
              onClick={() => {
                onAudioSourceChange('both');
                if (!isTabAudioActive) onCaptureTabAudio();
              }}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                audioSourceMode === 'both'
                  ? 'bg-purple-500/25 text-purple-200 border border-purple-400/50 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="BOTH Mode: Simultaneous capture (Device auto-answers, mic feedback-loop free + manual Ask)"
            >
              <Layers className="w-2.5 h-2.5" />
              <span>BOTH</span>
            </button>
          </div>

          {/* MANUAL QUESTION INPUT & ASK BUTTON (WHEN BOTH IS ACTIVE PER REQUIREMENT 5) */}
          {audioSourceMode === 'both' && (
            <div className="flex items-center gap-1.5 pl-1 animate-in fade-in duration-150">
              <input
                type="text"
                placeholder="Enter interviewer's question..."
                value={bothModeQuestion}
                onChange={(e) => setBothModeQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleBothModeSubmit();
                  }
                }}
                className="w-32 sm:w-40 px-2 py-1 text-xs bg-zinc-900/90 text-zinc-100 placeholder-zinc-500 rounded-lg border border-purple-500/30 focus:outline-none focus:border-purple-400"
              />
              <button
                type="button"
                onClick={() => handleBothModeSubmit()}
                disabled={isLoadingAnswer || !bothModeQuestion.trim()}
                className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-xs font-bold flex items-center gap-1 transition-all shadow-sm shadow-emerald-500/20"
                title="Submit manual question to local engine"
              >
                <Send className="w-2.5 h-2.5" />
                <span>Ask</span>
              </button>
            </div>
          )}

          {/* Transparency Slider Control & Live Percentage */}
          <div 
            style={noDragStyle}
            className="relative flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-zinc-900/80 border border-white/5"
          >
            <Sliders className="w-3 h-3 text-zinc-400" />
            <input
              type="range"
              min="0"
              max="90"
              step="5"
              value={transparency}
              onChange={(e) => handleTransparencyChange(parseInt(e.target.value, 10))}
              className="w-14 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              title={`Adjust Native Glass Transparency: ${transparency}% (Controls OS window transparency over desktop and apps)`}
            />
            <span className="text-[10px] font-mono font-bold text-emerald-400 w-7 text-right">
              {transparency}%
            </span>
          </div>

          {/* Layout Toggle: Horizontal Bar <-> Column Mode */}
          <button
            onClick={() => handleLayoutChange('column')}
            style={noDragStyle}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-emerald-300 hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
            title="Switch to Column Mode (Vertical Floating Panel)"
          >
            <PanelRight className="w-3.5 h-3.5" />
          </button>

          {/* Latest Answer Drawer Toggle */}
          <button
            onClick={() => setIsAnswerExpanded(prev => !prev)}
            style={noDragStyle}
            className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all border ${
              isAnswerExpanded && latestAnswer
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-zinc-800/60 text-zinc-400 border-zinc-700 hover:text-zinc-200'
            }`}
            title="Toggle Latest Answer View"
          >
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>Answer</span>
            {isAnswerExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Pin / Always on top */}
          <button
            onClick={handleTogglePin}
            style={noDragStyle}
            className={`p-1.5 rounded-lg transition-colors border ${
              isAlwaysOnTop
                ? 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-emerald-300 border-transparent hover:bg-white/5'
            }`}
            title={isElectron ? `Always-on-Top: ${isAlwaysOnTop ? 'ON (persists over all apps)' : 'OFF'}` : 'Pin Always-on-Top over Google Meet (Document PiP)'}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>

          {/* Minimize */}
          <button
            onClick={handleMinimizeWindow}
            style={noDragStyle}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors"
            title={isElectron ? "Minimize Window to Taskbar" : "Minimize to Pill"}
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          {/* Close */}
          <button
            onClick={handleCloseWindow}
            style={noDragStyle}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-white/5 transition-colors"
            title="Close Floating HUD"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ERROR MESSAGE NOTIFICATION CARD */}
        {errorMessage && (
          <div
            style={containerGlassStyle}
            className="w-[780px] max-w-[95vw] mt-2 p-2.5 rounded-xl border border-rose-500/40 shadow-lg flex items-start justify-between gap-2 text-xs text-rose-200 bg-rose-950/40 animate-in fade-in duration-150"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
            {onDismissError && (
              <button onClick={onDismissError} className="p-1 text-zinc-400 hover:text-zinc-200">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* STT STATUS NOTICE CARD (e.g. Missing Cloud STT Key Instructions) */}
        {sttStatusNotice && (
          <div
            style={containerGlassStyle}
            className="w-[780px] max-w-[95vw] mt-2 p-2.5 rounded-xl border border-sky-500/40 shadow-lg flex items-start justify-between gap-2 text-xs text-sky-200 bg-sky-950/40 animate-in fade-in duration-150"
          >
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span>{sttStatusNotice}</span>
            </div>
            {onDismissNotice && (
              <button onClick={onDismissNotice} className="p-1 text-zinc-400 hover:text-zinc-200">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* COMPACT EXPANDABLE LATEST-ANSWER PANEL (Beneath the Bar) */}
        {isAnswerExpanded && latestAnswer && (
          <div
            style={containerGlassStyle}
            className="w-[780px] max-w-[95vw] mt-2 p-3.5 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-150"
          >
            {/* Header: Interviewer Question */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-400/30 whitespace-nowrap">
                  🎙️ Question
                </span>
                <h4 className="text-xs font-bold text-sky-100 truncate">
                  {latestAnswer.question}
                </h4>
              </div>
              <span className="text-[10px] font-mono text-zinc-500 whitespace-nowrap">
                {new Date(latestAnswer.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* TL;DR Summary */}
            <div className="text-xs text-emerald-200/95 font-medium leading-relaxed bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-500/30">
              💡 {latestAnswer.summary}
            </div>

            {/* Spoken Conversational Script ("How to Say it Out Loud") */}
            {latestAnswer.spokenScript && (
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-950/40 via-zinc-900 to-indigo-950/30 border border-violet-500/40 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300 flex items-center gap-1">
                    <MessageSquare className="w-3 h-3 text-violet-400" />
                    <span>How to Say it Out Loud</span>
                  </span>
                  <button
                    onClick={() => handleCopy('script_' + latestAnswer.id, latestAnswer.spokenScript!)}
                    className="text-[10px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 py-0.5 px-1.5 rounded hover:bg-white/5 transition-all"
                  >
                    {copiedCodeId === 'script_' + latestAnswer.id ? (
                      <>
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                        <span className="text-emerald-400 font-semibold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-2.5 h-2.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-100 leading-relaxed italic bg-zinc-950/70 p-2 rounded-lg border border-violet-500/20">
                  &ldquo;{latestAnswer.spokenScript}&rdquo;
                </p>
              </div>
            )}

            {/* Technical Details Toggle */}
            {(latestAnswer.bullets?.length > 0 || latestAnswer.codeSnippet) && (
              <div>
                <button
                  onClick={() => setExpandedDetails(prev => ({ ...prev, [latestAnswer.id]: !prev[latestAnswer.id] }))}
                  className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 py-1 px-2 rounded-lg bg-zinc-900/80 border border-zinc-700/60 transition-all"
                >
                  {expandedDetails[latestAnswer.id] ? (
                    <>
                      <ChevronUp className="w-3 h-3 text-zinc-400" />
                      <span>Collapse Technical Code & Details</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3 text-emerald-400" />
                      <span>➕ Expand Code Snippet & Key Technical Points</span>
                    </>
                  )}
                </button>

                {expandedDetails[latestAnswer.id] && (
                  <div className="mt-2 space-y-2 pt-2 border-t border-white/10 animate-in fade-in duration-150">
                    {/* Key Points */}
                    {latestAnswer.bullets?.length > 0 && (
                      <ul className="space-y-1 text-[11px] text-zinc-300 pl-1">
                        {latestAnswer.bullets.map((b, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Code Snippet */}
                    {latestAnswer.codeSnippet && (
                      <div className="rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 text-[10px] font-mono">
                        <div className="flex items-center justify-between px-2.5 py-1 bg-zinc-900 border-b border-zinc-800 text-zinc-400">
                          <span>{latestAnswer.codeSnippet.language}</span>
                          <button
                            onClick={() => handleCopy('code_' + latestAnswer.id, latestAnswer.codeSnippet!.code)}
                            className="hover:text-zinc-200 flex items-center gap-1"
                          >
                            {copiedCodeId === 'code_' + latestAnswer.id ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <pre className="p-2 text-zinc-200 overflow-x-auto max-h-36">
                          <code>{latestAnswer.codeSnippet.code}</code>
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // =============================================================
  // LAYOUT 2: COLUMN MODE (NARROW VERTICAL FLOATING PANEL)
  // =============================================================
  return (
    <div
      style={{
        ...(isStandalone ? {} : { left: `${position.x}px`, top: `${position.y}px` }),
        ...containerGlassStyle
      }}
      className={`${isStandalone ? 'relative' : 'fixed z-50'} w-[430px] max-w-[95vw] overflow-hidden flex flex-col max-h-[88vh] animate-in fade-in zoom-in-95 duration-150 select-none`}
    >
      {/* 1. COLUMN DRAG HEADER */}
      <div
        onMouseDown={handleMouseDown}
        style={dragRegionStyle}
        className="px-3.5 py-2.5 bg-zinc-900/80 border-b border-white/10 flex items-center justify-between cursor-move select-none"
        title="Drag EchoCopilot HUD over other applications"
      >
        <div className="flex items-center gap-2">
          <Move className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300" />
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-zinc-100">Live Floating Copilot</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
            {formatTimer(sessionDuration)}
          </span>
        </div>

        <div className="flex items-center gap-1" style={noDragStyle}>
          {/* Transparency Slider in Column Header */}
          <div className="flex items-center gap-1 bg-zinc-950/80 px-1.5 py-0.5 rounded border border-white/10">
            <input
              type="range"
              min="0"
              max="90"
              step="5"
              value={transparency}
              onChange={(e) => handleTransparencyChange(parseInt(e.target.value, 10))}
              className="w-12 h-1 bg-zinc-700 rounded appearance-none accent-emerald-400 cursor-pointer"
              title={`Adjust Native Glass Transparency: ${transparency}% (Controls OS window transparency)`}
            />
            <span className="text-[9px] font-mono text-emerald-400 font-bold">{transparency}%</span>
          </div>

          {/* Toggle to Horizontal Bar */}
          <button
            onClick={() => handleLayoutChange('horizontal')}
            className="p-1 rounded-lg text-zinc-400 hover:text-emerald-300 hover:bg-white/5 transition-colors"
            title="Switch to Horizontal Bar Mode"
          >
            <LayoutList className="w-3.5 h-3.5" />
          </button>

          {/* Pin / Always on top */}
          <button
            onClick={handleTogglePin}
            className={`p-1 rounded-lg transition-colors border ${
              isAlwaysOnTop
                ? 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-emerald-300 border-transparent hover:bg-white/5'
            }`}
            title={isElectron ? `Always-on-Top: ${isAlwaysOnTop ? 'ON (persists over all apps)' : 'OFF'}` : 'Always on Top (Document PiP)'}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>

          {/* Minimize */}
          <button
            onClick={handleMinimizeWindow}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors"
            title={isElectron ? "Minimize Window to Taskbar" : "Minimize to Pill"}
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          {/* Close */}
          <button
            onClick={handleCloseWindow}
            className="p-1 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-white/5 transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. AUDIO SOURCE MODES: DEVICE | BOTH | MIC */}
      <div className="p-2.5 bg-zinc-900/50 border-b border-white/5 space-y-2">
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
            <Volume2 className="w-3 h-3 text-emerald-400" />
            <span>Audio Source Mode</span>
          </span>
          <span className="text-[10px] text-emerald-400 font-semibold">
            {audioSourceMode === 'device_only' && '🎧 Device (Auto-Answers)'}
            {audioSourceMode === 'mic_only' && '🎙️ Mic (Auto-Answers)'}
            {audioSourceMode === 'both' && '🌐 Both (Device Auto + Manual Ask)'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => {
              onAudioSourceChange('device_only');
              if (!isTabAudioActive) onCaptureTabAudio();
            }}
            className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${
              audioSourceMode === 'device_only'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-400/50 shadow-sm'
                : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 border border-zinc-700/50'
            }`}
          >
            <Headphones className="w-3 h-3 shrink-0" />
            <span>Device</span>
          </button>

          <button
            onClick={() => {
              onAudioSourceChange('both');
              if (!isTabAudioActive) onCaptureTabAudio();
            }}
            className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${
              audioSourceMode === 'both'
                ? 'bg-purple-500/25 text-purple-200 border border-purple-400/50 shadow-sm'
                : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 border border-zinc-700/50'
            }`}
          >
            <Layers className="w-3 h-3 shrink-0" />
            <span>Both</span>
          </button>

          <button
            onClick={() => onAudioSourceChange('mic_only')}
            className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${
              audioSourceMode === 'mic_only'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 shadow-sm'
                : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 border border-zinc-700/50'
            }`}
          >
            <Mic className="w-3 h-3 shrink-0" />
            <span>My Mic</span>
          </button>
        </div>

        {/* Microphone Picker in Column Mode */}
        {(audioSourceMode === 'mic_only' || audioSourceMode === 'both') && audioInputDevices.length > 0 && (
          <div className="flex items-center justify-between text-[10px] bg-zinc-950/70 p-1.5 rounded-lg border border-white/5">
            <span className="text-zinc-400 flex items-center gap-1">
              <Mic className="w-3 h-3 text-emerald-400" />
              <span>Mic Input:</span>
            </span>
            <select
              value={selectedMicDeviceId || 'default'}
              onChange={(e) => onSelectMicDevice && onSelectMicDevice(e.target.value)}
              className="bg-zinc-900 text-zinc-200 text-[10px] rounded px-1.5 py-0.5 border border-zinc-700 focus:outline-none focus:border-emerald-500 max-w-[240px] truncate"
            >
              {audioInputDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microphone (${d.deviceId.slice(0, 6)})`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Action Row: Start/Pause/Stop + Modes + Speaker Switcher */}
        <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/5 flex-wrap">
          <div className="flex items-center gap-1">
            <button
              onClick={onToggleSession}
              className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                isSessionActive
                  ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
              }`}
            >
              {isSessionActive ? (
                <>
                  <Square className="w-2.5 h-2.5 fill-current" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Play className="w-2.5 h-2.5 fill-current" />
                  <span>Start</span>
                </>
              )}
            </button>

            {isSessionActive && (
              <button
                onClick={onPauseResume}
                className="px-2 py-1 rounded-lg text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700"
              >
                {isPaused ? 'Resume' : 'Pause'}
              </button>
            )}
          </div>

          {/* Mode Selector */}
          <div className="flex bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
            {(['coding', 'system_design', 'behavioral'] as AnswerMode[]).map((m) => (
              <button
                key={m}
                onClick={() => onModeChange(m)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-semibold capitalize ${
                  currentMode === m ? 'bg-zinc-800 text-emerald-300' : 'text-zinc-500'
                }`}
              >
                {m === 'system_design' ? 'Sys' : m}
              </button>
            ))}
          </div>

          {/* Speaker Indicator */}
          <button
            onClick={onToggleSpeaker}
            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
              activeSpeaker === 'interviewer'
                ? 'bg-sky-500/15 border-sky-400/40 text-sky-300'
                : 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
            }`}
          >
            {activeSpeaker === 'interviewer' ? 'Interviewer' : 'You'}
          </button>
        </div>

        {/* Status & Waveform */}
        <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px]">
          {renderStatusBadge()}
          <div className="flex items-center gap-1.5">
            {renderWaveform(currentAudioLevel, isSessionActive && !isPaused)}
            {renderAudioSampleBadge()}
          </div>
        </div>

        {/* Column Error Banner */}
        {errorMessage && (
          <div className="p-2 rounded-lg bg-rose-950/60 border border-rose-500/40 text-[11px] text-rose-200 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
            <span className="flex-1">{errorMessage}</span>
            {onDismissError && (
              <button onClick={onDismissError} className="text-zinc-400 hover:text-zinc-200">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Column STT Notice Banner */}
        {sttStatusNotice && (
          <div className="p-2 rounded-lg bg-sky-950/60 border border-sky-500/40 text-[11px] text-sky-200 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
            <span className="flex-1">{sttStatusNotice}</span>
            {onDismissNotice && (
              <button onClick={onDismissNotice} className="text-zinc-400 hover:text-zinc-200">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. TABS: AI ANSWERS vs LIVE DIALOGUE */}
      <div className="flex border-b border-white/10 bg-zinc-900/40 text-xs">
        <button
          onClick={() => setActiveTab('answers')}
          className={`flex-1 py-2 font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
            activeTab === 'answers'
              ? 'border-emerald-400 text-emerald-300 bg-white/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Sparkles className="w-3 h-3 text-emerald-400" />
          <span>AI Answers ({answers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('transcript')}
          className={`flex-1 py-2 font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
            activeTab === 'transcript'
              ? 'border-emerald-400 text-emerald-300 bg-white/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <MessageSquare className="w-3 h-3 text-sky-400" />
          <span>Live Dialogue ({transcript.length})</span>
        </button>
      </div>

      {/* 4. SCROLLABLE TAB CONTENT */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 pr-2 min-h-[220px]">
        {activeTab === 'answers' && (
          <div className="space-y-3">
            {answers.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 text-xs space-y-2">
                <Sparkles className="w-6 h-6 text-zinc-700 mx-auto" />
                <p>No answers generated yet.</p>
                <p className="text-[10px] text-zinc-600">
                  {audioSourceMode === 'both' 
                    ? 'Interviewer questions on device auto-generate answers. You can also use the Ask bar below.'
                    : 'Start session and speak or play meeting audio to auto-generate answers.'}
                </p>
              </div>
            ) : (
              answers.map((ans, idx) => (
                <div
                  key={ans.id}
                  className="p-3 rounded-xl bg-zinc-900/80 border border-white/10 space-y-2.5 text-xs shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/30">
                      🎙️ Question {idx === 0 && '(Latest)'}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {new Date(ans.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <h5 className="font-bold text-sky-100 bg-sky-950/20 p-2 rounded-lg border border-sky-500/20">
                    {ans.question}
                  </h5>

                  <div className="text-xs text-emerald-200 font-medium leading-relaxed bg-emerald-950/25 p-2 rounded-lg border border-emerald-500/30">
                    💡 {ans.summary}
                  </div>

                  {ans.spokenScript && (
                    <div className="p-2 rounded-lg bg-violet-950/30 border border-violet-500/30 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-violet-300">
                        <span>HOW TO SAY IT OUT LOUD</span>
                        <button
                          onClick={() => handleCopy('col_script_' + ans.id, ans.spokenScript!)}
                          className="hover:text-zinc-100 flex items-center gap-1"
                        >
                          {copiedCodeId === 'col_script_' + ans.id ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-[11px] text-zinc-100 italic bg-zinc-950/60 p-2 rounded border border-violet-500/20">
                        &ldquo;{ans.spokenScript}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* Extend Details Toggle */}
                  {(ans.bullets?.length > 0 || ans.codeSnippet) && (
                    <button
                      onClick={() => setExpandedDetails(prev => ({ ...prev, [ans.id]: !prev[ans.id] }))}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
                    >
                      {expandedDetails[ans.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      <span>{expandedDetails[ans.id] ? 'Hide technical details' : 'Show code & key points'}</span>
                    </button>
                  )}

                  {expandedDetails[ans.id] && (
                    <div className="space-y-2 pt-2 border-t border-zinc-800 text-[11px]">
                      {ans.bullets?.length > 0 && (
                        <ul className="space-y-1 text-zinc-300">
                          {ans.bullets.map((b, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 shrink-0" />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {ans.codeSnippet && (
                        <pre className="p-2 rounded bg-zinc-950 text-zinc-200 overflow-x-auto text-[10px] font-mono">
                          <code>{ans.codeSnippet.code}</code>
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'transcript' && (
          <div className="space-y-2">
            {transcript.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 text-xs">
                No dialogue captured yet.
              </div>
            ) : (
              transcript.map(t => {
                const isInterviewer = t.speaker === 'interviewer';
                return (
                  <div
                    key={t.id}
                    className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                      isInterviewer ? 'bg-sky-950/30 border-sky-500/40' : 'bg-emerald-950/20 border-emerald-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className={`font-bold px-2 py-0.5 rounded-full ${
                        isInterviewer ? 'bg-sky-500/20 text-sky-300' : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {isInterviewer ? '🎙️ Interviewer' : '👤 You (Candidate)'}
                      </span>
                      <button
                        onClick={() => onManualAnswer(t.text)}
                        className="px-1.5 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-bold"
                      >
                        ⚡ Answer
                      </button>
                    </div>
                    <p className={isInterviewer ? 'text-sky-100 font-semibold' : 'text-emerald-100'}>
                      {t.text}
                    </p>
                  </div>
                );
              })
            )}
            {interimTranscript && (
              <div className="p-2 rounded border border-dashed border-zinc-700 text-xs italic text-zinc-300">
                Listening... &ldquo;{interimTranscript}&rdquo;
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. BOTTOM BAR: MANUAL ASK (PROMINENT IN BOTH MODE PER REQUIREMENT 5) */}
      <div className="p-2.5 bg-zinc-900 border-t border-white/10 flex items-center gap-1.5">
        <input
          type="text"
          placeholder={audioSourceMode === 'both' ? "Enter interviewer's question..." : "Ask or type question..."}
          value={columnQuickPrompt}
          onChange={(e) => setColumnQuickPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleColumnSubmit();
            }
          }}
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
        />
        <button
          type="button"
          onClick={() => handleColumnSubmit()}
          disabled={isLoadingAnswer || !columnQuickPrompt.trim()}
          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-xs font-bold transition-all shadow-sm"
        >
          Ask
        </button>
      </div>
    </div>
  );
};
