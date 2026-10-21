/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  AnswerMode, CopilotAnswer, TranscriptTurn, SessionRecord, 
  AudioSourceMode, AnswerTriggerPolicy, AudioPipelineStatus,
  AudioInputDevice
} from '@/lib/types';
import { saveSession } from '@/lib/storage';
import { 
  isMeaningfulQuestion, QuestionDeduplicator, shouldTriggerAnswer, 
  isAutoAnswerAllowedForMode, formatAudioErrorMessage,
  enumerateAudioInputDevices, calculateAudioLevel
} from '@/lib/audioPipelineHelper';
import { 
  classifyUtterance, 
  mergeSpeechFragments, 
  ConversationContextTracker, 
  isNewIndependentQuestion,
  isQuestionReadyForAnswer,
  hasValidComparisonSubjects,
  cleanPrematurePunctuation,
  formatCompleteQuestion,
  QuestionCategory,
  ClassificationResult
} from '@/lib/questionClassifier';
import { normalizeTechnicalSpeech } from '@/lib/speechNormalizer';
import { normalizeTechnicalTerms, TermNormalizationResult } from '@/lib/technicalTermNormalizer';
import { startPcmStreamRecorder, PcmStreamRecorder } from '@/lib/wavRecorder';
import { parseStreamingAnswer } from '@/lib/aiFallback';
import { FloatingCopilotOverlay } from './FloatingCopilotOverlay';
import { 
  Mic, MicOff, Play, Square, Pause, Sparkles, Clock, 
  Copy, Check, AlertCircle, RefreshCw, Save, Code2, ShieldAlert,
  Laptop, MessageSquare, HelpCircle, Zap, Volume2, Info,
  Headphones, Layers, ShieldCheck, Activity, ArrowRight, ExternalLink
} from 'lucide-react';

interface CopilotModuleProps {
  initialPrompt?: string;
  initialMode?: AnswerMode;
  onClearInitialPrompt?: () => void;
  floatingOnly?: boolean;
}

interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

export const CopilotModule: React.FC<CopilotModuleProps> = ({
  initialPrompt = '',
  initialMode = 'coding',
  onClearInitialPrompt,
  floatingOnly = false
}) => {
  // -------------------------------------------------------------
  // 1. Session & Mode State
  // -------------------------------------------------------------
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [currentMode, setCurrentMode] = useState<AnswerMode>(initialMode);
  const [sessionTitle, setSessionTitle] = useState('Live Technical Interview');
  const [autoAnswer, setAutoAnswer] = useState(true);
  const [showMeetGuide, setShowMeetGuide] = useState(false);
  const [isFloatingOpen, setIsFloatingOpen] = useState(floatingOnly || false);
  const [autoOpenFloating, setAutoOpenFloating] = useState(true);

  // -------------------------------------------------------------
  // 2. Audio Source & Feedback Loop Prevention State
  // -------------------------------------------------------------
  const [audioSourceMode, setAudioSourceMode] = useState<AudioSourceMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('echocopilot_audio_mode') as AudioSourceMode;
      if (saved === 'mic_only' || saved === 'device_only' || saved === 'both') {
        return saved;
      }
    }
    return 'mic_only';
  });
  const [answerTriggerPolicy, setAnswerTriggerPolicy] = useState<AnswerTriggerPolicy>('meeting_only');
  const [pipelineStatus, setPipelineStatus] = useState<AudioPipelineStatus>('idle');

  // Audio Stream Hardware Status & Device Selection
  const [audioInputDevices, setAudioInputDevices] = useState<AudioInputDevice[]>([]);
  const [selectedMicDeviceId, setSelectedMicDeviceId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('echocopilot_mic_device_id') || '';
    }
    return '';
  });
  const [isMicReceivingAudio, setIsMicReceivingAudio] = useState(false);
  const [isTabReceivingAudio, setIsTabReceivingAudio] = useState(false);
  const [isMicListening, setIsMicListening] = useState(false);
  const [isTabAudioActive, setIsTabAudioActive] = useState(false);
  const [micPermissionState, setMicPermissionState] = useState<'granted' | 'denied' | 'prompt' | 'unsupported'>('prompt');
  const [micAudioLevel, setMicAudioLevel] = useState(0);
  const [tabAudioLevel, setTabAudioLevel] = useState(0);
  const [isTabTranscribing, setIsTabTranscribing] = useState(false);

  // -------------------------------------------------------------
  // 3. Transcript & AI Answer State
  // -------------------------------------------------------------
  const [interimTranscript, setInterimTranscript] = useState('');
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [activeSpeaker, setActiveSpeaker] = useState<'interviewer' | 'candidate'>('interviewer');
  const [answers, setAnswers] = useState<CopilotAnswer[]>([]);
  const [isLoadingAnswer, setIsLoadingAnswer] = useState(false);
  const [streamingAnswerText, setStreamingAnswerText] = useState<string>('');
  const [firstTokenLatency, setFirstTokenLatency] = useState<number | null>(null);
  const [manualInput, setManualInput] = useState(initialPrompt);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [setupNotice, setSetupNotice] = useState<string | null>(null);
  const [sttStatusNotice, setSttStatusNotice] = useState<string | null>(null);
  const [speechLang, setSpeechLang] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('echocopilot_speech_lang');
      if (saved) return saved;
      const browserLang = navigator.language || '';
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        if (browserLang.startsWith('en-IN') || tz.includes('Calcutta') || tz.includes('Kolkata') || tz.includes('Asia/Colombo')) {
          return 'en-IN';
        }
      } catch {}
      return browserLang.startsWith('en') ? browserLang : 'en-US';
    }
    return 'en-US';
  });

  // -------------------------------------------------------------
  // 4. References & Lifecycle Cleaners
  // -------------------------------------------------------------
  const recognitionRef = useRef<any>(null);
  const tabMediaStreamRef = useRef<MediaStream | null>(null);
  const micMediaStreamRef = useRef<MediaStream | null>(null);
  const micAudioContextRef = useRef<AudioContext | null>(null);
  const tabAudioContextRef = useRef<AudioContext | null>(null);
  const micAnimFrameRef = useRef<number | null>(null);
  const tabAnimFrameRef = useRef<number | null>(null);
  const tabMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const deduplicatorRef = useRef(new QuestionDeduplicator(4000));

  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptBottomRef = useRef<HTMLDivElement | null>(null);
  const autoAnswerRef = useRef(true);
  const isSessionActiveRef = useRef(false);
  const isPausedRef = useRef(false);
  const activeSpeakerRef = useRef(activeSpeaker);
  const audioSourceModeRef = useRef<AudioSourceMode>(audioSourceMode);
  const answerTriggerPolicyRef = useRef<AnswerTriggerPolicy>('meeting_only');
  const speechDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastInterimRef = useRef<string>('');
  const accumulatedSpeechRef = useRef<string>('');
  const micPcmRecorderRef = useRef<PcmStreamRecorder | null>(null);
  const tabPcmRecorderRef = useRef<PcmStreamRecorder | null>(null);
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const inFlightQueryRef = useRef<string | null>(null);
  const activeRequestIdRef = useRef<number>(0);
  const pendingSpeechBufferRef = useRef<string>('');
  const pendingRawBufferRef = useRef<string>('');
  const transcriptRef = useRef<TranscriptTurn[]>([]);
  const speechFragmentTimerRef = useRef<NodeJS.Timeout | null>(null);
  const contextTrackerRef = useRef<ConversationContextTracker>(new ConversationContextTracker(5));

  // Synchronize Refs
  const speechLangRef = useRef(speechLang);
  useEffect(() => { speechLangRef.current = speechLang; }, [speechLang]);
  useEffect(() => { audioSourceModeRef.current = audioSourceMode; }, [audioSourceMode]);
  useEffect(() => { answerTriggerPolicyRef.current = answerTriggerPolicy; }, [answerTriggerPolicy]);
  useEffect(() => { autoAnswerRef.current = autoAnswer; }, [autoAnswer]);
  useEffect(() => { isSessionActiveRef.current = isSessionActive; }, [isSessionActive]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { activeSpeakerRef.current = activeSpeaker; }, [activeSpeaker]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  // Handle external initial prompt from Question Bank
  useEffect(() => {
    if (initialPrompt) {
      const timer = setTimeout(() => {
        setManualInput(initialPrompt);
        if (initialMode) setCurrentMode(initialMode);
        if (onClearInitialPrompt) onClearInitialPrompt();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [initialPrompt, initialMode, onClearInitialPrompt]);

  // Session duration timer (Respects Pause)
  useEffect(() => {
    if (isSessionActive && !isPaused) {
      timerIntervalRef.current = setInterval(() => {
        setSessionDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isSessionActive, isPaused]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptBottomRef.current) {
      transcriptBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript, interimTranscript]);

  // Clean up all streams and audio contexts on unmount
  useEffect(() => {
    return () => {
      stopAllAudioStreams();
    };
  }, []);

  // Cross-Window Synchronization (Main Cockpit <-> Floating HUD / Popout)
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const bc = new BroadcastChannel('echocopilot_channel');
    bc.onmessage = (event) => {
      const data = event.data;
      if (!data) return;
      if (data.type === 'STATUS_NOTICE') {
        setSttStatusNotice(data.message || null);
      } else if (data.type === 'NEW_ANSWER' && data.answer) {
        if (data.requestId && data.requestId < activeRequestIdRef.current) return;
        setAnswers(prev => {
          if (prev.some(a => a.id === data.answer.id)) return prev;
          return [data.answer, ...prev];
        });
        setStreamingAnswerText('');
        setFirstTokenLatency(null);
        setIsLoadingAnswer(false);
        setPipelineStatus('answer_ready');
      } else if (data.type === 'NEW_TURN' && data.turn) {
        setTranscript(prev => {
          if (prev.some(t => t.id === data.turn.id)) return prev;
          return [...prev, data.turn];
        });
        setInterimTranscript('');
      } else if (data.type === 'INTERIM_SPEECH') {
        setInterimTranscript(data.text || '');
      } else if (data.type === 'STREAM_START') {
        if (data.requestId && data.requestId < activeRequestIdRef.current) return;
        if (data.requestId) activeRequestIdRef.current = data.requestId;
        setSttStatusNotice(null);
        setIsLoadingAnswer(true);
        setStreamingAnswerText('');
        setFirstTokenLatency(null);
        setPipelineStatus('generating_answer');
      } else if (data.type === 'STREAM_FIRST_TOKEN') {
        if (data.requestId && data.requestId < activeRequestIdRef.current) return;
        setFirstTokenLatency(data.timeToFirstTokenMs);
      } else if (data.type === 'STREAM_CHUNK') {
        if (data.requestId && data.requestId < activeRequestIdRef.current) return;
        setStreamingAnswerText(data.accumulated || '');
      } else if (data.type === 'STREAM_DONE') {
        if (data.requestId && data.requestId < activeRequestIdRef.current) return;
        setIsLoadingAnswer(false);
        setStreamingAnswerText('');
        setFirstTokenLatency(null);
        setPipelineStatus('answer_ready');
      } else if (data.type === 'STREAM_ABORT') {
        if (data.requestId && data.requestId < activeRequestIdRef.current) return;
        setIsLoadingAnswer(false);
        setStreamingAnswerText('');
        setFirstTokenLatency(null);
        setPipelineStatus('idle');
      }
    };
    return () => {
      bc.close();
    };
  }, []);

  // Auto-start live listening session when mounted in floating mode
  useEffect(() => {
    if (floatingOnly && !isSessionActiveRef.current) {
      const autoTimer = setTimeout(() => {
        if (!isSessionActiveRef.current) {
          handleToggleSession();
        }
      }, 500);
      return () => clearTimeout(autoTimer);
    }
  }, [floatingOnly]);

  // Pre-warm local Ollama model in background on GPU to eliminate cold-start delay
  useEffect(() => {
    try {
      const ollamaUrl = (typeof window !== 'undefined' && localStorage.getItem('echocopilot_ollama_url')) || 'http://localhost:11434';
      const model = (typeof window !== 'undefined' && localStorage.getItem('echocopilot_ai_model')) || 'qwen2.5:3b';
      fetch(`${ollamaUrl.replace(/\/$/, '')}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: '',
          options: { num_gpu: 99 },
          keep_alive: '60m'
        })
      }).catch(() => {});
    } catch {}
  }, []);

  // Enumerate input audio devices (Part 1 - Enumerate & Select Input Device)
  useEffect(() => {
    const refreshDevices = async () => {
      const devices = await enumerateAudioInputDevices();
      console.log('[CopilotModule] Enumerated audio input devices:', devices);
      setAudioInputDevices(devices);
      // Auto-select first device if none selected
      if (!selectedMicDeviceId && devices.length > 0) {
        console.log('[CopilotModule] Auto-selected default microphone device:', devices[0]);
        setSelectedMicDeviceId(devices[0].deviceId);
      }
    };
    refreshDevices();

    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
      };
    }
  }, [selectedMicDeviceId]);

  const handleSelectMicDevice = async (deviceId: string) => {
    console.log(`[CopilotModule] handleSelectMicDevice called with deviceId="${deviceId}"`);
    setSelectedMicDeviceId(deviceId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('echocopilot_mic_device_id', deviceId);
    }
    // If live session is actively capturing microphone, seamlessly switch streams
    if (isSessionActive && (audioSourceMode === 'mic_only' || audioSourceMode === 'both')) {
      try {
        if (micMediaStreamRef.current) {
          micMediaStreamRef.current.getTracks().forEach(t => t.stop());
        }
        const audioConstraints: MediaTrackConstraints = deviceId && deviceId !== 'default'
          ? { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
        let newStream: MediaStream;
        try {
          newStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
        } catch {
          newStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        micMediaStreamRef.current = newStream;
        startMicAudioMeter(newStream);
      } catch (err) {
        setErrorMessage('Failed to switch microphone hardware: ' + formatAudioErrorMessage(err));
      }
    }
  };

  // -------------------------------------------------------------
  // 5. Audio Meter & Real Sample Verification
  // -------------------------------------------------------------
  const startMicAudioMeter = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      micAudioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        if (!isPausedRef.current) {
          if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
          }
          analyser.getByteFrequencyData(dataArray);
          const level = calculateAudioLevel(dataArray);
          setMicAudioLevel(level);
          if (level > 2) {
            setIsMicReceivingAudio(true);
          }
        } else {
          setMicAudioLevel(0);
        }
        micAnimFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();
    } catch {
      // Audio meter optional, non-blocking
    }
  };

  const startTabAudioMeter = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      tabAudioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        if (!isPausedRef.current) {
          analyser.getByteFrequencyData(dataArray);
          const level = calculateAudioLevel(dataArray);
          setTabAudioLevel(level);
          if (level > 2) {
            setIsTabReceivingAudio(true);
          }
        } else {
          setTabAudioLevel(0);
        }
        tabAnimFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();
    } catch {
      // Audio meter optional, non-blocking
    }
  };

  const stopAllAudioStreams = () => {
    console.log('[CopilotModule] stopAllAudioStreams called: stopping tracks, recorders, contexts');
    // 1. Cancel animation frames
    if (micAnimFrameRef.current) {
      cancelAnimationFrame(micAnimFrameRef.current);
      micAnimFrameRef.current = null;
    }
    if (tabAnimFrameRef.current) {
      cancelAnimationFrame(tabAnimFrameRef.current);
      tabAnimFrameRef.current = null;
    }

    // 2. Close Audio Contexts
    if (micAudioContextRef.current) {
      micAudioContextRef.current.close().catch(() => {});
      micAudioContextRef.current = null;
    }
    if (tabAudioContextRef.current) {
      tabAudioContextRef.current.close().catch(() => {});
      tabAudioContextRef.current = null;
    }

    // 3. Stop Media Streams
    if (micMediaStreamRef.current) {
      micMediaStreamRef.current.getTracks().forEach(t => t.stop());
      micMediaStreamRef.current = null;
    }
    if (tabMediaStreamRef.current) {
      tabMediaStreamRef.current.getTracks().forEach(t => t.stop());
      tabMediaStreamRef.current = null;
    }

    // 4. Stop PCM Stream Recorders
    if (micPcmRecorderRef.current) {
      try { micPcmRecorderRef.current.stop(); } catch {}
      micPcmRecorderRef.current = null;
    }
    if (tabPcmRecorderRef.current) {
      try { tabPcmRecorderRef.current.stop(); } catch {}
      tabPcmRecorderRef.current = null;
    }

    // 5. Stop MediaRecorder
    if (tabMediaRecorderRef.current && tabMediaRecorderRef.current.state !== 'inactive') {
      try { tabMediaRecorderRef.current.stop(); } catch {}
      tabMediaRecorderRef.current = null;
    }

    // 6. Stop Speech Recognition
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }

    // 7. Clear pending fragment timers and cancel in-flight AI answers
    if (speechFragmentTimerRef.current) {
      clearTimeout(speechFragmentTimerRef.current);
      speechFragmentTimerRef.current = null;
    }
    pendingSpeechBufferRef.current = '';
    if (activeAbortControllerRef.current) {
      try { activeAbortControllerRef.current.abort(); } catch {}
      activeAbortControllerRef.current = null;
    }
    inFlightQueryRef.current = null;
    setStreamingAnswerText('');
    setFirstTokenLatency(null);

    setIsMicListening(false);
    setIsTabAudioActive(false);
    setIsMicReceivingAudio(false);
    setIsTabReceivingAudio(false);
    setMicAudioLevel(0);
    setTabAudioLevel(0);
  };

  // -------------------------------------------------------------
  // 6. Speech-to-Text: Microphone (Web Speech API) - Live Transition
  // -------------------------------------------------------------
  const handleSpeechLangChange = (newLang: string) => {
    setSpeechLang(newLang);
    speechLangRef.current = newLang;
    if (typeof window !== 'undefined') {
      localStorage.setItem('echocopilot_speech_lang', newLang);
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.lang = newLang;
        recognitionRef.current.stop();
        setTimeout(() => {
          if (isSessionActiveRef.current && !isPausedRef.current && recognitionRef.current) {
            try { recognitionRef.current.start(); } catch {}
          }
        }, 150);
      } catch {}
    }
  };

  const initSpeechRecognition = () => {
    const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
    const SpeechRec = win?.SpeechRecognition || win?.webkitSpeechRecognition;

    if (!SpeechRec) {
      setMicPermissionState('unsupported');
      return null;
    }

    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = speechLangRef.current || 'en-IN';

      rec.onstart = () => {
        setIsMicListening(true);
        setMicPermissionState('granted');
        setErrorMessage(null);
        setPipelineStatus('listening');
      };

      rec.onresult = (event: any) => {
        if (isPausedRef.current) return;

        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            const finalSpeech = item[0].transcript.trim();
            if (finalSpeech && finalSpeech.length >= 2) {
              const cleanFinal = normalizeTechnicalSpeech(finalSpeech);
              // Immediately commit finalized turn with zero pause delay!
              commitTurnAndAnswer(cleanFinal, 'mic', activeSpeakerRef.current || 'interviewer');
              setInterimTranscript('');
              lastInterimRef.current = '';
              accumulatedSpeechRef.current = '';

              // Clear interim on broadcast channel
              try {
                if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
                  const bc = new BroadcastChannel('echocopilot_channel');
                  bc.postMessage({ type: 'INTERIM_SPEECH', text: '' });
                  bc.close();
                }
              } catch {}
            }
          } else {
            interim += item[0].transcript;
          }
        }

        const cleanInterim = interim.trim();
        if (cleanInterim) {
          const liveInterim = normalizeTechnicalSpeech(cleanInterim);
          setInterimTranscript(liveInterim);
          lastInterimRef.current = liveInterim;

          // Broadcast real-time live interim words to floating HUD immediately
          try {
            if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
              const bc = new BroadcastChannel('echocopilot_channel');
              bc.postMessage({ 
                type: 'INTERIM_SPEECH', 
                text: liveInterim, 
                speaker: activeSpeakerRef.current || 'interviewer' 
              });
              bc.close();
            }
          } catch {}
        }
      };

      rec.onerror = (event: any) => {
        if (event.error === 'no-speech') return;
        console.warn('Speech recognition event error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setMicPermissionState('denied');
          setIsMicListening(false);
          setErrorMessage('Microphone access was denied. Please allow microphone permissions in your browser address bar.');
        } else if (event.error === 'network' || event.error === 'aborted') {
          console.log(`[CopilotModule] Browser Web Speech error (${event.error}) -> activating PCM stream recorder fallback`);
          if (micMediaStreamRef.current && !micPcmRecorderRef.current) {
            startMicPcmRecorder(micMediaStreamRef.current);
          }
        }
      };

      rec.onend = () => {
        // If there was uncommitted interim speech when the cycle ended, finalize it cleanly
        if (lastInterimRef.current && lastInterimRef.current.trim().length >= 3) {
          const leftover = normalizeTechnicalSpeech(lastInterimRef.current.trim());
          lastInterimRef.current = '';
          setInterimTranscript('');
          commitTurnAndAnswer(leftover, 'mic', activeSpeakerRef.current || 'interviewer');
          try {
            if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
              const bc = new BroadcastChannel('echocopilot_channel');
              bc.postMessage({ type: 'INTERIM_SPEECH', text: '' });
              bc.close();
            }
          } catch {}
        }

        if (isSessionActiveRef.current && !isPausedRef.current) {
          // Restart with short timeout to prevent Chrome/Edge InvalidStateError
          setTimeout(() => {
            if (isSessionActiveRef.current && !isPausedRef.current && recognitionRef.current) {
              try { recognitionRef.current.start(); } catch {}
            }
          }, 150);
        } else {
          setIsMicListening(false);
        }
      };

      return rec;
    } catch (err) {
      console.error('Failed to create SpeechRecognition:', err);
      setMicPermissionState('unsupported');
      return null;
    }
  };

  const startMicPcmRecorder = (micStream: MediaStream) => {
    if (micPcmRecorderRef.current) {
      try { micPcmRecorderRef.current.stop(); } catch {}
      micPcmRecorderRef.current = null;
    }
    console.log('[CopilotModule] Initializing Continuous PCM Stream Recorder for Microphone');
    micPcmRecorderRef.current = startPcmStreamRecorder({
      stream: micStream,
      source: 'mic',
      onAudioLevel: (level) => {
        setMicAudioLevel(level);
        if (level > 2) setIsMicReceivingAudio(true);
      },
      onAudioChunk: async (blob, source) => {
        console.log(`[CopilotModule] Microphone PCM speech chunk ready (${blob.size} bytes) -> sending to /api/transcribe`);
        setInterimTranscript('🎙️ Transcribing speech...');
        await sendAudioChunkToTranscribe(blob, source);
      },
      onError: (err) => console.warn('[CopilotModule] Mic PCM recorder error:', err)
    });
  };

  const sendAudioChunkToTranscribe = async (audioBlob: Blob, source: 'mic' | 'meeting') => {
    if (isPausedRef.current) return;

    try {
      setPipelineStatus('transcribing');
      let apiKey = '';
      let provider = '';
      if (typeof window !== 'undefined') {
        apiKey = localStorage.getItem('echocopilot_api_key') || '';
        provider = localStorage.getItem('echocopilot_ai_provider') || '';
      }

      const formData = new FormData();
      formData.append('audio', audioBlob, `${source}_chunk.wav`);
      formData.append('source', source);
      if (apiKey) formData.append('apiKey', apiKey);
      if (provider) formData.append('provider', provider);

      console.log(`[CopilotModule] Posting ${source} audio chunk to /api/transcribe: ${audioBlob.size} bytes`);
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        console.warn('[CopilotModule] /api/transcribe HTTP error:', res.status, res.statusText);
        setErrorMessage(`Transcription server error (${res.status}). Check server logs.`);
        setInterimTranscript('');
        return;
      }

      const data = await res.json();
      console.log('[CopilotModule] /api/transcribe response:', {
        transcript: data.transcript,
        provider: data.provider,
        reason: data.reason,
        metrics: data.metrics,
        error: data.error
      });

      if (data && data.transcript) {
        const clean = normalizeTechnicalSpeech(data.transcript.trim());
        if (clean.length >= 2) {
          console.log(`[CopilotModule] Delivering transcript to UI turn: "${clean}" (source: ${source})`);
          const speaker = source === 'meeting' ? 'interviewer' : (audioSourceModeRef.current === 'mic_only' ? 'interviewer' : 'candidate');
          commitTurnAndAnswer(clean, source, speaker);
        } else {
          setInterimTranscript('');
        }
      } else {
        // Handle empty or error cases so they are visible rather than silently swallowed
        if (data.error) {
          console.warn('[CopilotModule] Transcription returned error:', data.error, data.message);
          setErrorMessage(`Transcription: ${data.message || data.error}`);
          setInterimTranscript('');
        } else if (data.metrics && !data.metrics.isAudible) {
          console.log(`[CopilotModule] Inaudible audio chunk: peak=${data.metrics.maxPeak}, rms=${data.metrics.rms}`);
          setInterimTranscript('⚠️ Low audio signal — please speak closer to microphone');
          setTimeout(() => {
            setInterimTranscript(prev => prev.startsWith('⚠️') ? '' : prev);
          }, 3000);
        } else if (data.reason === 'NO_SPEECH_RECOGNIZED') {
          console.log('[CopilotModule] Whisper STT returned no speech for chunk');
          setInterimTranscript('ℹ️ Speech detected but words not clear — please repeat');
          setTimeout(() => {
            setInterimTranscript(prev => prev.startsWith('ℹ️') ? '' : prev);
          }, 3000);
        } else {
          setInterimTranscript('');
        }
      }
    } catch (err) {
      console.warn('[CopilotModule] sendAudioChunkToTranscribe error:', err);
      setErrorMessage('Audio transcription error: ' + (err instanceof Error ? err.message : String(err)));
      setInterimTranscript('');
    } finally {
      if (isSessionActiveRef.current && !isPausedRef.current) {
        setPipelineStatus('listening');
      }
    }
  };

  const startMicCapture = async () => {
    try {
      const audioConstraints: MediaTrackConstraints = selectedMicDeviceId && selectedMicDeviceId !== 'default'
        ? { deviceId: { exact: selectedMicDeviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
      console.log('[CopilotModule] Requesting microphone stream. selectedMicDeviceId:', selectedMicDeviceId, 'constraints:', audioConstraints);
      let micStream: MediaStream;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      } catch (firstErr) {
        console.warn('[CopilotModule] Failed with exact constraints, falling back to audio: true', firstErr);
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      micMediaStreamRef.current = micStream;
      const tracks = micStream.getAudioTracks().map(t => ({
        id: t.id,
        label: t.label,
        enabled: t.enabled,
        muted: t.muted,
        readyState: t.readyState
      }));
      console.log('[CopilotModule] Microphone stream successfully acquired. Tracks:', tracks);
      startMicAudioMeter(micStream);

      const isElectron = typeof window !== 'undefined' && (
        Boolean((window as any).electronAPI?.isElectron) || 
        /electron/i.test(navigator.userAgent)
      );

      if (isElectron) {
        // Inside Electron: Web Speech API has no Google cloud keys; use high-accuracy local PCM WAV stream recorder
        console.log('[CopilotModule] Running in Electron environment -> using PCM stream recorder');
        startMicPcmRecorder(micStream);
      } else {
        // In Chrome/Edge browser: Use real-time Web Speech API
        if (!recognitionRef.current) {
          const rec = initSpeechRecognition();
          if (rec) {
            recognitionRef.current = rec;
            try { rec.start(); } catch {}
          }
        }
        if (!recognitionRef.current) {
          startMicPcmRecorder(micStream);
        }
      }

      setIsMicListening(true);
      setMicPermissionState('granted');
      setErrorMessage(null);
    } catch (err) {
      console.warn('Microphone open error:', err);
      setErrorMessage('Could not open microphone: ' + formatAudioErrorMessage(err));
    }
  };

  // -------------------------------------------------------------
  // 7. Speech-to-Text: Meeting / Tab Audio (DisplayMedia + /api/transcribe)
  // -------------------------------------------------------------
  const handleCaptureTabAudio = async () => {
    if (isTabAudioActive) {
      // Cleanly stop existing tab capture
      if (tabMediaStreamRef.current) {
        tabMediaStreamRef.current.getTracks().forEach(t => t.stop());
        tabMediaStreamRef.current = null;
      }
      if (tabMediaRecorderRef.current && tabMediaRecorderRef.current.state !== 'inactive') {
        try { tabMediaRecorderRef.current.stop(); } catch {}
        tabMediaRecorderRef.current = null;
      }
      setIsTabAudioActive(false);
      setTabAudioLevel(0);
      return;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        setErrorMessage('Tab audio capture is not supported in this browser. Please use Chrome or Edge.');
        return;
      }

      // Request tab sharing with audio enabled
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        // Stop the useless video track immediately
        stream.getTracks().forEach(t => t.stop());
        setErrorMessage('No audio track selected! You MUST check "Also share tab audio" in the Chrome tab sharing dialog.');
        return;
      }

      tabMediaStreamRef.current = stream;
      setIsTabAudioActive(true);
      setErrorMessage(null);
      startTabAudioMeter(stream);

      // Start continuous PCM WAV stream recorder for meeting audio
      if (tabPcmRecorderRef.current) {
        try { tabPcmRecorderRef.current.stop(); } catch {}
        tabPcmRecorderRef.current = null;
      }
      tabPcmRecorderRef.current = startPcmStreamRecorder({
        stream,
        source: 'meeting',
        onAudioLevel: (level) => {
          setTabAudioLevel(level);
          if (level > 2) setIsTabReceivingAudio(true);
        },
        onAudioChunk: async (blob, source) => {
          console.log(`[CopilotModule] Meeting Tab PCM speech chunk (${blob.size} bytes) -> transcribing`);
          await sendAudioChunkToTranscribe(blob, source);
        },
        onError: (err) => console.warn('[CopilotModule] Tab PCM recorder error:', err)
      });

      // Listen for user stopping share via native browser notification bar
      stream.getVideoTracks()[0].onended = () => {
        setIsTabAudioActive(false);
        setTabAudioLevel(0);
        if (tabPcmRecorderRef.current) {
          try { tabPcmRecorderRef.current.stop(); } catch {}
          tabPcmRecorderRef.current = null;
        }
        if (tabMediaRecorderRef.current && tabMediaRecorderRef.current.state !== 'inactive') {
          try { tabMediaRecorderRef.current.stop(); } catch {}
          tabMediaRecorderRef.current = null;
        }
        tabMediaStreamRef.current = null;
      };

      audioTracks[0].onended = () => {
        setIsTabAudioActive(false);
        setTabAudioLevel(0);
        if (tabPcmRecorderRef.current) {
          try { tabPcmRecorderRef.current.stop(); } catch {}
          tabPcmRecorderRef.current = null;
        }
      };

      // PCM Stream recorder handles 16kHz WAV streaming offline cleanly.
      // MediaRecorder is only used as a fallback if PCM recorder is not available.
      if (!tabPcmRecorderRef.current) {
        setupTabMediaRecorder(stream);
      }

    } catch (err: unknown) {
      const msg = formatAudioErrorMessage(err);
      if ((err as Error).name !== 'NotAllowedError') {
        setErrorMessage('Failed to capture meeting audio: ' + msg);
      }
    }
  };

  const setupTabMediaRecorder = (stream: MediaStream) => {
    try {
      const options: MediaRecorderOptions = {};
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options.mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options.mimeType = 'audio/webm';
      }

      const recorder = new MediaRecorder(stream, options);
      tabMediaRecorderRef.current = recorder;

      recorder.ondataavailable = async (e: BlobEvent) => {
        if (!e.data || e.data.size < 4000 || isPausedRef.current) return;

        // Post audio slice to server-side transcription endpoint
        try {
          setIsTabTranscribing(true);
          setPipelineStatus('transcribing');

          const formData = new FormData();
          formData.append('audio', e.data, 'tab_slice.webm');
          formData.append('source', 'meeting');

          const res = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData
          });

          const data = await res.json();
          if (res.ok && data.transcript) {
            const cleanTranscript = data.transcript.trim();
            if (cleanTranscript.length > 2) {
              commitTurnAndAnswer(cleanTranscript, 'meeting', 'interviewer');
            }
          } else if (data.error === 'MISSING_STT_KEY') {
            setSttStatusNotice(
              'Notice: Meeting tab audio streaming requires a cloud speech key (DEEPGRAM_API_KEY or OPENAI_API_KEY) in .env.local. Microphone audio uses built-in browser Web Speech.'
            );
          }
        } catch (postErr) {
          console.warn('Tab audio slice post error:', postErr);
        } finally {
          setIsTabTranscribing(false);
          if (isSessionActiveRef.current && !isPausedRef.current) {
            setPipelineStatus('listening');
          }
        }
      };

      // Record in 3.5 second streaming slices
      recorder.start(3500);

    } catch (recorderErr) {
      console.warn('MediaRecorder setup error for meeting tab:', recorderErr);
    }
  };

  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // 8. Unified Utterance Committer & Speech Fragment Merger
  // -------------------------------------------------------------
  const commitTurnAndAnswer = (
    speechText: string,
    source: 'mic' | 'meeting' | 'manual',
    speakerHint: 'interviewer' | 'candidate'
  ) => {
    const trimmed = speechText.trim();
    if (!trimmed || trimmed.length < 2) return;

    if (speechDebounceTimerRef.current) {
      clearTimeout(speechDebounceTimerRef.current);
      speechDebounceTimerRef.current = null;
    }

    // Determine logical speaker identity
    let speaker: 'interviewer' | 'candidate' = activeSpeakerRef.current || speakerHint;
    if (source === 'meeting') {
      speaker = 'interviewer'; // Audio from meeting tab is the interviewer!
    } else if (source === 'mic') {
      speaker = audioSourceModeRef.current === 'mic_only' ? 'interviewer' : (activeSpeakerRef.current || 'interviewer');
    }

    // Check if there is pending speech fragment buffered, or if incoming speech extends the previous incomplete turn
    let baseSpeech = pendingSpeechBufferRef.current;
    let baseRaw = pendingRawBufferRef.current || baseSpeech;
    let extendingTurnId: string | null = null;

    if (!baseSpeech && source !== 'manual' && transcriptRef.current.length > 0) {
      const last = transcriptRef.current[transcriptRef.current.length - 1];
      if (last && last.speaker === speaker && (Date.now() - last.timestamp) < 15000) {
        // Can extend if last turn did not trigger an answer, or was not a complete ready question
        const lastReadiness = isQuestionReadyForAnswer(last.text);
        if (!last.triggeredAnswer || !lastReadiness.isReady) {
          const lowerTrimmed = trimmed.toLowerCase();
          const candidateMerge = mergeSpeechFragments(last.text, trimmed);
          const candidateReady = isQuestionReadyForAnswer(candidateMerge).isReady;

          const isContinuation = (
            lowerTrimmed.startsWith('between') ||
            lowerTrimmed.startsWith('and') ||
            lowerTrimmed.startsWith('or') ||
            lowerTrimmed.startsWith('to') ||
            lowerTrimmed.startsWith('with') ||
            lowerTrimmed.startsWith('vs') ||
            lowerTrimmed.startsWith('versus') ||
            lowerTrimmed.startsWith('for') ||
            (/\b(difference|differences|differ|distinguish)\b/i.test(last.text) && hasValidComparisonSubjects(`between ${trimmed}`)) ||
            candidateReady
          );

          if (isContinuation) {
            baseSpeech = last.text;
            baseRaw = last.rawText || last.text;
            extendingTurnId = last.id;
          }
        }
      }
    }

    const rawCandidate = baseSpeech
      ? mergeSpeechFragments(baseSpeech, trimmed)
      : trimmed;
    const mergedRaw = baseRaw
      ? `${cleanPrematurePunctuation(baseRaw)} ${trimmed}`.trim()
      : trimmed;

    // Run local technical-term guess engine first before classification and answer generation
    const normResult = normalizeTechnicalTerms(
      rawCandidate,
      contextTrackerRef.current.getRecentHistory().map(h => h.question)
    );
    const candidateText = normResult.normalizedText;

    // Lightweight NLP utterance classification using conversation context on normalized text
    const history = contextTrackerRef.current.getRecentHistory();
    const classification = classifyUtterance(candidateText, history);
    const readiness = isQuestionReadyForAnswer(candidateText, history);

    // Incomplete fragment or uncompleted question needing more speech (Requirement 1 & 2)
    if (source !== 'manual' && (!readiness.isReady && readiness.needsMoreSpeech)) {
      console.log(`[CopilotModule] Incomplete question/fragment detected: "${rawCandidate}" (${readiness.reason}) -> buffering for continuation`);
      pendingSpeechBufferRef.current = candidateText;
      pendingRawBufferRef.current = mergedRaw;
      setInterimTranscript(candidateText);
      setSttStatusNotice('Listening for the rest of the question…');
      setPipelineStatus('listening');

      // Broadcast interim to floating HUD
      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel('echocopilot_channel');
          bc.postMessage({ type: 'STATUS_NOTICE', message: 'Listening for the rest of the question…' });
          bc.postMessage({ type: 'INTERIM_SPEECH', text: candidateText, speaker });
          bc.close();
        }
      } catch {}

      // Start buffer timeout: if user pauses for 2500ms, finalize turn without calling Ollama or guessing subjects
      if (speechFragmentTimerRef.current) {
        clearTimeout(speechFragmentTimerRef.current);
      }
      speechFragmentTimerRef.current = setTimeout(() => {
        const buffered = pendingSpeechBufferRef.current;
        const bufferedRaw = pendingRawBufferRef.current || buffered;
        pendingSpeechBufferRef.current = '';
        pendingRawBufferRef.current = '';
        setSttStatusNotice(null);
        try {
          if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            const bc = new BroadcastChannel('echocopilot_channel');
            bc.postMessage({ type: 'STATUS_NOTICE', message: null });
            bc.close();
          }
        } catch {}

        if (buffered && buffered.length >= 2) {
          finalizeUtteranceAndAnswer(buffered, bufferedRaw, source, speaker, extendingTurnId, classification, normResult, false /* allowTrigger */);
        }
      }, 2500);

      return;
    }

    // Utterance is complete or ready: clear buffer and finalize
    if (speechFragmentTimerRef.current) {
      clearTimeout(speechFragmentTimerRef.current);
      speechFragmentTimerRef.current = null;
    }
    pendingSpeechBufferRef.current = '';
    pendingRawBufferRef.current = '';
    setSttStatusNotice(null);
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('echocopilot_channel');
        bc.postMessage({ type: 'STATUS_NOTICE', message: null });
        bc.close();
      }
    } catch {}

    finalizeUtteranceAndAnswer(candidateText, mergedRaw, source, speaker, extendingTurnId, classification, normResult, true /* allowTrigger */);
  };

  const finalizeUtteranceAndAnswer = (
    finalSpeech: string,
    rawSpeech: string,
    source: 'mic' | 'meeting' | 'manual',
    speaker: 'interviewer' | 'candidate',
    extendingTurnId?: string | null,
    preClassification?: ClassificationResult,
    preNormResult?: TermNormalizationResult,
    allowTrigger: boolean = true
  ) => {
    const rawCandidate = rawSpeech.trim();
    if (!rawCandidate || rawCandidate.length < 2) return;

    const normResult = preNormResult || normalizeTechnicalTerms(
      finalSpeech,
      contextTrackerRef.current.getRecentHistory().map(h => h.question)
    );
    const text = normResult.normalizedText;
    const classification = preClassification || classifyUtterance(text, contextTrackerRef.current.getRecentHistory());

    // Create transcript turn with preserved original transcript for diagnostics
    const turn: TranscriptTurn = {
      id: extendingTurnId || ('turn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
      speaker,
      source,
      text,
      rawText: rawCandidate,
      corrections: normResult.corrections.length > 0 ? normResult.corrections : undefined,
      timestamp: Date.now(),
      isFinal: true,
      triggeredAnswer: false
    };
    console.log(`[CopilotModule] Turn processed: "${text}" (Raw: "${rawCandidate}", Extending: ${extendingTurnId || 'none'}, Intent: ${classification.intent}, Category: ${classification.category})`);

    setTranscript(prev => {
      let updated: TranscriptTurn[];
      if (extendingTurnId) {
        const idx = prev.findIndex(t => t.id === extendingTurnId);
        if (idx !== -1) {
          updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            text,
            rawText: rawCandidate,
            corrections: normResult.corrections.length > 0 ? normResult.corrections : updated[idx].corrections,
            timestamp: Date.now(),
            triggeredAnswer: allowTrigger
          };
          transcriptRef.current = updated;
          return updated;
        }
      }

      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        if (last) {
          const lastLower = last.text.toLowerCase().trim();
          const newLower = text.toLowerCase();
          if (lastLower === newLower) {
            return prev;
          }
          if (Date.now() - last.timestamp < 10000 && (newLower.startsWith(lastLower) || newLower.includes(lastLower)) && last.speaker === speaker) {
            updated = [...prev];
            updated[updated.length - 1] = { ...last, text, rawText: rawCandidate, timestamp: Date.now() };
            transcriptRef.current = updated;
            return updated;
          }
        }
      }
      updated = [...prev, turn];
      transcriptRef.current = updated;
      return updated;
    });

    setInterimTranscript('');
    setManualInput(text);
    lastInterimRef.current = '';

    // Broadcast turn to any open floating window
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('echocopilot_channel');
        bc.postMessage({ type: 'NEW_TURN', turn });
        bc.close();
      }
    } catch {}

    // Check readiness gate before deciding to trigger answer (Requirement 2)
    const history = contextTrackerRef.current.getRecentHistory();
    const readiness = isQuestionReadyForAnswer(text, history);

    if (!allowTrigger || !readiness.isReady) {
      console.log(`[CopilotModule] Turn recorded without triggering answer: "${text}" (Ready: ${readiness.isReady}, Reason: ${readiness.reason})`);
      return;
    }

    // Check if this is a non-question (TOPIC_TRANSITION, ACKNOWLEDGEMENT, GREETING, STATEMENT)
    if (!classification.isQuestion && source !== 'manual') {
      console.log(`[CopilotModule] Non-question bypassed: "${text}" (Intent: ${classification.intent}, Reason: ${classification.reason}) -> Ollama not called`);
      return;
    }

    // AUTOMATIC ANSWER EVALUATION ACROSS ALL MODES:
    const triggerAllowed = autoAnswerRef.current && shouldTriggerAnswer(
      turn,
      audioSourceModeRef.current,
      true,
      history
    );

    // DEDUPLICATION GUARD: Prevent duplicate triggers from rapid repeated speech events
    const isNew = deduplicatorRef.current.isNewQuestion(text);

    if (triggerAllowed && isNew) {
      turn.triggeredAnswer = true;
      setPipelineStatus('question_detected');
      handleGenerateAnswer(text, classification.category);
    }
  };

  // -------------------------------------------------------------
  // 9. AI Copilot Answer Generator with SSE Streaming & New Question Cancellation
  // -------------------------------------------------------------
  const handleGenerateAnswer = async (promptText?: string, explicitCategory?: QuestionCategory) => {
    const rawQuery = (promptText || manualInput).trim();
    if (!rawQuery) return;

    // Gatekeeper: block incomplete questions from Ollama generation (Requirement 3)
    const history = contextTrackerRef.current.getRecentHistory();
    const readiness = isQuestionReadyForAnswer(rawQuery, history);
    if (!readiness.isReady && readiness.needsMoreSpeech) {
      console.log(`[CopilotModule] Blocked incomplete query from Ollama generation: "${rawQuery}" (${readiness.reason})`);
      setSttStatusNotice('Listening for the rest of the question…');
      return;
    }

    // Monotonically increasing request ID to track and reject stale responses (Requirement 5)
    const currentRequestId = ++activeRequestIdRef.current;

    // Requirement 5: Recognize when interviewer moves to a new independent question.
    // Cancel in-flight generation, clear outdated active answer, and prioritize new question.
    if (inFlightQueryRef.current && activeAbortControllerRef.current) {
      if (inFlightQueryRef.current.toLowerCase() === rawQuery.toLowerCase()) {
        console.log(`[CopilotModule] Query already actively generating for "${rawQuery}". Skipping duplicate fetch.`);
        return;
      }

      const { shouldCancel, reason } = isNewIndependentQuestion(rawQuery, inFlightQueryRef.current);
      if (shouldCancel) {
        console.log(`[CopilotModule] Canceling in-flight answer for "${inFlightQueryRef.current}": ${reason}. Starting new question: "${rawQuery}"`);
        try {
          activeAbortControllerRef.current.abort();
        } catch {}
        activeAbortControllerRef.current = null;
        setStreamingAnswerText('');
        setFirstTokenLatency(null);

        // Broadcast abort event so overlay clears immediately
        try {
          if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            const bc = new BroadcastChannel('echocopilot_channel');
            bc.postMessage({ type: 'STREAM_ABORT', requestId: currentRequestId, supersededBy: rawQuery });
            bc.close();
          }
        } catch {}
      }
    }

    // If manual query (not from speech committer), add turn to transcript feed
    if (promptText) {
      setTranscript(prev => {
        const last = prev[prev.length - 1];
        if (last && last.text.toLowerCase().trim() === rawQuery.toLowerCase()) {
          return prev;
        }
        const manualTurn: TranscriptTurn = {
          id: 'turn_manual_' + Date.now(),
          speaker: 'interviewer',
          source: 'manual',
          text: rawQuery,
          timestamp: Date.now(),
          isFinal: true,
          triggeredAnswer: true
        };
        return [...prev, manualTurn];
      });
    }

    // Requirement 4: Resolve context & follow-ups ("Why?", "What about the alternative?")
    const { enrichedPrompt, isFollowUp, category } = 
      contextTrackerRef.current.resolveContextualPrompt(rawQuery);

    const finalCategory = explicitCategory || category;

    // Setup AbortController for this question
    const abortController = new AbortController();
    activeAbortControllerRef.current = abortController;
    inFlightQueryRef.current = rawQuery;

    setIsLoadingAnswer(true);
    setStreamingAnswerText('');
    setFirstTokenLatency(null);
    setErrorMessage(null);
    setPipelineStatus('generating_answer');

    // Broadcast stream start event with request ID
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('echocopilot_channel');
        bc.postMessage({ 
          type: 'STREAM_START', 
          requestId: currentRequestId,
          question: rawQuery, 
          category: finalCategory, 
          isFollowUp 
        });
        bc.close();
      }
    } catch {}

    try {
      let provider = 'ollama';
      let apiKey = '';
      let model = 'qwen2.5:3b';
      let ollamaUrl = 'http://localhost:11434';
      if (typeof window !== 'undefined') {
        provider = localStorage.getItem('echocopilot_ai_provider') || 'ollama';
        apiKey = localStorage.getItem('echocopilot_api_key') || '';
        model = localStorage.getItem('echocopilot_ai_model') || 'qwen2.5:3b';
        ollamaUrl = localStorage.getItem('echocopilot_ollama_url') || 'http://localhost:11434';
      }

      console.log(`[CopilotModule] Calling /api/copilot for: "${rawQuery}" (Req #${currentRequestId}, Category: ${finalCategory}, Follow-up: ${isFollowUp})`);

      const resp = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: enrichedPrompt,
          mode: currentMode,
          provider,
          apiKey,
          model,
          ollamaUrl,
          stream: true,
          category: finalCategory,
          contextHistory: history.map(h => ({ question: h.question, summary: h.summary }))
        }),
        signal: abortController.signal
      });

      if (!resp.ok && !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${resp.status} from copilot API`);
      }

      // Check if response is an SSE stream (Requirement 6: Fast streaming answers)
      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream') && resp.body) {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedText = '';
        let finalAnswerReceived: CopilotAnswer | null = null;

        while (true) {
          if (activeRequestIdRef.current !== currentRequestId) {
            console.log(`[CopilotModule] Canceling reader loop for superseded request #${currentRequestId} (active is #${activeRequestIdRef.current})`);
            try { reader.cancel(); } catch {}
            break;
          }

          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const messages = buffer.split('\n\n');
          buffer = messages.pop() || '';

          for (const message of messages) {
            const lines = message.split('\n');
            let eventType = '';
            let dataStr = '';

            for (const line of lines) {
              if (line.startsWith('event:')) {
                eventType = line.substring(6).trim();
              } else if (line.startsWith('data:')) {
                dataStr = line.substring(5).trim();
              }
            }

            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);

              if (eventType === 'first_token') {
                const ttft = data.timeToFirstTokenMs || 0;
                console.log(`[CopilotModule] First token latency (Req #${currentRequestId}): ${ttft}ms`);
                if (activeRequestIdRef.current === currentRequestId) {
                  setFirstTokenLatency(ttft);
                  try {
                    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
                      const bc = new BroadcastChannel('echocopilot_channel');
                      bc.postMessage({ type: 'STREAM_FIRST_TOKEN', requestId: currentRequestId, timeToFirstTokenMs: ttft });
                      bc.close();
                    }
                  } catch {}
                }
              } else if (eventType === 'chunk') {
                accumulatedText += data.text || '';
                if (activeRequestIdRef.current === currentRequestId) {
                  setStreamingAnswerText(accumulatedText);
                  try {
                    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
                      const bc = new BroadcastChannel('echocopilot_channel');
                      bc.postMessage({ type: 'STREAM_CHUNK', requestId: currentRequestId, text: data.text, accumulated: accumulatedText });
                      bc.close();
                    }
                  } catch {}
                }
              } else if (eventType === 'done') {
                if (data.answer) {
                  finalAnswerReceived = data.answer;
                }
              }
            } catch {}
          }
        }

        // Flush any trailing buffer data
        buffer += decoder.decode();
        if (buffer.trim() && activeRequestIdRef.current === currentRequestId) {
          const messages = buffer.split('\n\n');
          for (const message of messages) {
            const lines = message.split('\n');
            let eventType = '';
            let dataStr = '';

            for (const line of lines) {
              if (line.startsWith('event:')) {
                eventType = line.substring(6).trim();
              } else if (line.startsWith('data:')) {
                dataStr = line.substring(5).trim();
              }
            }

            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);
              if (eventType === 'chunk') {
                accumulatedText += data.text || '';
                setStreamingAnswerText(accumulatedText);
              } else if (eventType === 'done' && data.answer) {
                finalAnswerReceived = data.answer;
              }
            } catch {}
          }
        }

        if (activeRequestIdRef.current !== currentRequestId) {
          console.log(`[CopilotModule] Discarding completed stream for superseded request #${currentRequestId}`);
          return;
        }

        // Stream completed: if done event was somehow missing, synthesize answer from accumulated text
        if (!finalAnswerReceived && accumulatedText.trim()) {
          console.log('[CopilotModule] Stream completed without explicit done event; synthesizing answer from accumulated text');
          finalAnswerReceived = parseStreamingAnswer(accumulatedText, rawQuery, currentMode);
        }

        // If final answer is ready, verify request ID before saving and rendering (Requirement 5)
        if (finalAnswerReceived && activeRequestIdRef.current === currentRequestId) {
          const cleanAnswer = { ...finalAnswerReceived, question: rawQuery };
          setAnswers(prev => [cleanAnswer, ...prev]);
          contextTrackerRef.current.recordTurn(rawQuery, cleanAnswer.summary, finalCategory);
          setPipelineStatus('answer_ready');

          try {
            if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
              const bc = new BroadcastChannel('echocopilot_channel');
              bc.postMessage({ type: 'STREAM_DONE', requestId: currentRequestId, answer: cleanAnswer });
              bc.postMessage({ type: 'NEW_ANSWER', requestId: currentRequestId, answer: cleanAnswer });
              bc.close();
            }
            if (typeof window !== 'undefined') {
              localStorage.setItem('echocopilot_latest_answer', JSON.stringify(cleanAnswer));
            }
          } catch {}
        }
      } else {
        // Fallback for non-streaming response
        const data = await resp.json();
        if (data.answer && activeRequestIdRef.current === currentRequestId) {
          const cleanAnswer = { ...data.answer, question: rawQuery };
          setAnswers(prev => [cleanAnswer, ...prev]);
          contextTrackerRef.current.recordTurn(rawQuery, cleanAnswer.summary, finalCategory);
          setPipelineStatus('answer_ready');
          if (data.setupNotice) setSetupNotice(data.setupNotice);

          try {
            if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
              const bc = new BroadcastChannel('echocopilot_channel');
              bc.postMessage({ type: 'NEW_ANSWER', requestId: currentRequestId, answer: cleanAnswer });
              bc.close();
            }
            if (typeof window !== 'undefined') {
              localStorage.setItem('echocopilot_latest_answer', JSON.stringify(cleanAnswer));
            }
          } catch {}
        }
      }
    } catch (err: unknown) {
      if (activeRequestIdRef.current !== currentRequestId) return;
      if ((err as Error).name === 'AbortError') {
        console.log(`[CopilotModule] In-flight answer generation aborted for "${rawQuery}" (superseded by new question)`);
        return;
      }
      setErrorMessage((err as Error).message || 'Connection error while generating AI response.');
      setPipelineStatus('error');
    } finally {
      if (activeRequestIdRef.current === currentRequestId) {
        if (inFlightQueryRef.current === rawQuery) {
          inFlightQueryRef.current = null;
        }
        activeAbortControllerRef.current = null;
        setIsLoadingAnswer(false);
        setStreamingAnswerText('');
      }
    }
  };

  // -------------------------------------------------------------
  // 10. Session Lifecycle Controls (Start, Pause, Resume, Stop)
  // -------------------------------------------------------------
  const handleToggleSession = async () => {
    if (isSessionActive) {
      // STOP SESSION
      setIsSessionActive(false);
      setIsPaused(false);
      setPipelineStatus('idle');
      stopAllAudioStreams();
    } else {
      // START SESSION
      setIsSessionActive(true);
      setIsPaused(false);
      setSessionDuration(0);
      setErrorMessage(null);
      setPipelineStatus('listening');

      // Keep Ollama hot on GPU
      try {
        const ollamaUrl = (typeof window !== 'undefined' && localStorage.getItem('echocopilot_ollama_url')) || 'http://localhost:11434';
        const model = (typeof window !== 'undefined' && localStorage.getItem('echocopilot_ai_model')) || 'qwen2.5:3b';
        fetch(`${ollamaUrl.replace(/\/$/, '')}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt: '',
            options: { num_gpu: 99 },
            keep_alive: '60m'
          })
        }).catch(() => {});
      } catch {}

      if (autoOpenFloating) {
        setIsFloatingOpen(true);
      }

      // Initialize based on selected Audio Source Mode
      if (audioSourceMode === 'mic_only') {
        // 1. Microphone Only (Candidate Speech)
        await startMicCapture();

      } else if (audioSourceMode === 'device_only') {
        // 2. Device Audio Only (Interviewer Meeting Speech)
        if (!isTabAudioActive) {
          await handleCaptureTabAudio();
        }

      } else if (audioSourceMode === 'both') {
        // 3. Both Microphone + Device Audio simultaneously
        await startMicCapture();
        if (!isTabAudioActive) {
          await handleCaptureTabAudio();
        }
      }
    }
  };

  const handlePauseResume = () => {
    if (!isSessionActive) return;

    if (isPaused) {
      // RESUME
      setIsPaused(false);
      setPipelineStatus('listening');

      // Resume PCM stream recorders
      if (micPcmRecorderRef.current) {
        try { micPcmRecorderRef.current.resume(); } catch {}
      }
      if (tabPcmRecorderRef.current) {
        try { tabPcmRecorderRef.current.resume(); } catch {}
      }

      // Resume speech recognition
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch {}
      }
      // Resume MediaRecorder
      if (tabMediaRecorderRef.current && tabMediaRecorderRef.current.state === 'paused') {
        tabMediaRecorderRef.current.resume();
      }
    } else {
      // PAUSE
      setIsPaused(true);
      setPipelineStatus('paused');

      // Pause PCM stream recorders
      if (micPcmRecorderRef.current) {
        try { micPcmRecorderRef.current.pause(); } catch {}
      }
      if (tabPcmRecorderRef.current) {
        try { tabPcmRecorderRef.current.pause(); } catch {}
      }

      // Pause speech recognition
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      // Pause MediaRecorder
      if (tabMediaRecorderRef.current && tabMediaRecorderRef.current.state === 'recording') {
        tabMediaRecorderRef.current.pause();
      }
      setMicAudioLevel(0);
      setTabAudioLevel(0);
    }
  };

  // Source Mode Switching without Leaking Streams
  const handleAudioSourceModeChange = async (newMode: AudioSourceMode) => {
    setAudioSourceMode(newMode);

    // Auto-answering is enabled across all modes
    setAutoAnswer(true);

    if (!isSessionActiveRef.current) {
      setIsSessionActive(true);
      setIsPaused(false);
      setSessionDuration(0);
      setErrorMessage(null);
      setPipelineStatus('listening');
    }

    if (newMode === 'mic_only') {
      // Stop meeting tab audio
      if (tabMediaStreamRef.current) {
        tabMediaStreamRef.current.getTracks().forEach(t => t.stop());
        tabMediaStreamRef.current = null;
        setIsTabAudioActive(false);
        setTabAudioLevel(0);
      }
      if (tabPcmRecorderRef.current) {
        try { tabPcmRecorderRef.current.stop(); } catch {}
        tabPcmRecorderRef.current = null;
      }
      if (tabMediaRecorderRef.current && tabMediaRecorderRef.current.state !== 'inactive') {
        try { tabMediaRecorderRef.current.stop(); } catch {}
        tabMediaRecorderRef.current = null;
      }
      // Ensure mic is active
      if (!micMediaStreamRef.current || (!recognitionRef.current && !micPcmRecorderRef.current)) {
        await startMicCapture();
      }

    } else if (newMode === 'device_only') {
      // Stop mic
      if (micMediaStreamRef.current) {
        micMediaStreamRef.current.getTracks().forEach(t => t.stop());
        micMediaStreamRef.current = null;
        setMicAudioLevel(0);
      }
      if (micPcmRecorderRef.current) {
        try { micPcmRecorderRef.current.stop(); } catch {}
        micPcmRecorderRef.current = null;
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
        recognitionRef.current = null;
      }
      setIsMicListening(false);
      // Ensure tab audio is active
      if (!isTabAudioActive) {
        await handleCaptureTabAudio();
      }

    } else if (newMode === 'both') {
      // Ensure both are active
      if (!micMediaStreamRef.current || !micPcmRecorderRef.current) {
        await startMicCapture();
      }
      if (!isTabAudioActive) {
        await handleCaptureTabAudio();
      }
    }
  };

  // -------------------------------------------------------------
  // 11. Save Session to IndexedDB
  // -------------------------------------------------------------
  const handleSaveSession = async () => {
    if (transcript.length === 0 && answers.length === 0) {
      setErrorMessage('Nothing to save yet. Start a session, speak, or generate answers first.');
      return;
    }

    const record: SessionRecord = {
      id: 'session_' + Date.now(),
      title: sessionTitle || `Interview Session ${new Date().toLocaleDateString()}`,
      createdAt: Date.now(),
      durationSeconds: sessionDuration,
      mode: currentMode,
      transcript,
      answers,
      notes: `Captured ${transcript.length} speech turns across audio mode ${audioSourceMode}.`
    };

    try {
      await saveSession(record);
      setSaveStatus('Session saved successfully to local IndexedDB!');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch {
      setErrorMessage('Failed to save session to local storage.');
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopy = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  // Quick Simulation Test
  const handleSimulateQuestion = (sampleText: string) => {
    commitTurnAndAnswer(sampleText, 'manual', 'interviewer');
    setShowMeetGuide(false);
  };

  if (floatingOnly) {
    return (
      <div 
        id="floating-copilot-root"
        className="w-full h-screen max-h-screen text-zinc-100 flex flex-col items-stretch justify-start font-sans relative bg-transparent p-0 overflow-hidden"
      >
        <FloatingCopilotOverlay
          isOpen={true}
          onClose={() => {
            if (typeof window !== 'undefined') {
              if ((window as any).electronAPI?.close) {
                (window as any).electronAPI.close();
              } else {
                window.close();
              }
            }
          }}
          isStandalone={true}
          isSessionActive={isSessionActive}
          isPaused={isPaused}
          onToggleSession={handleToggleSession}
          onPauseResume={handlePauseResume}
          sessionDuration={sessionDuration}
          currentMode={currentMode}
          onModeChange={setCurrentMode}
          audioSourceMode={audioSourceMode}
          onAudioSourceChange={handleAudioSourceModeChange}
          answerTriggerPolicy={answerTriggerPolicy}
          onAnswerTriggerPolicyChange={setAnswerTriggerPolicy}
          pipelineStatus={pipelineStatus}
          micAudioLevel={micAudioLevel}
          tabAudioLevel={tabAudioLevel}
          transcript={transcript}
          interimTranscript={interimTranscript}
          answers={answers}
          activeSpeaker={activeSpeaker}
          onToggleSpeaker={() => setActiveSpeaker(prev => prev === 'interviewer' ? 'candidate' : 'interviewer')}
          onManualAnswer={handleGenerateAnswer}
          onClearTranscript={() => setTranscript([])}
          isLoadingAnswer={isLoadingAnswer}
          streamingText={streamingAnswerText}
          firstTokenLatency={firstTokenLatency}
          isTabAudioActive={isTabAudioActive}
          onCaptureTabAudio={handleCaptureTabAudio}
          sttStatusNotice={sttStatusNotice}
          onDismissNotice={() => setSttStatusNotice(null)}
          audioInputDevices={audioInputDevices}
          selectedMicDeviceId={selectedMicDeviceId}
          onSelectMicDevice={handleSelectMicDevice}
          speechLang={speechLang}
          onSpeechLangChange={handleSpeechLangChange}
          isMicReceivingAudio={isMicReceivingAudio}
          isTabReceivingAudio={isTabReceivingAudio}
          errorMessage={errorMessage}
          onDismissError={() => setErrorMessage(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------- */}
      {/* 1. MASTER CONTROL & HUD BAR                                 */}
      {/* ----------------------------------------------------------- */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 p-5 rounded-2xl border border-zinc-800 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          
          {/* Main Controls: Start / Pause / Resume / Stop */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Start / Stop Button */}
            <button
              onClick={handleToggleSession}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md ${
                isSessionActive
                  ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-emerald-500/20'
              }`}
            >
              {isSessionActive ? (
                <>
                  <Square className="w-4 h-4 fill-white" />
                  <span>Stop Session</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-zinc-950" />
                  <span>Start Live Copilot</span>
                </>
              )}
            </button>

            {/* Pause / Resume Button (When Session is Active) */}
            {isSessionActive && (
              <button
                onClick={handlePauseResume}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-xs border transition-all ${
                  isPaused
                    ? 'bg-amber-500 text-zinc-950 font-bold border-amber-400 hover:bg-amber-400'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                }`}
                title={isPaused ? 'Resume live audio listening' : 'Temporarily pause audio capture'}
              >
                {isPaused ? (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Resume</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause</span>
                  </>
                )}
              </button>
            )}

            {/* Session Timer */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 font-mono text-sm">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>{formatTimer(sessionDuration)}</span>
            </div>

            {/* Editable Session Title */}
            <input
              type="text"
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              className="bg-zinc-950/70 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 w-44 truncate"
              placeholder="Session Title"
              title="Custom Session Title"
            />
          </div>

          {/* Secondary Actions: Floating Window, Auto-Answer, Guide */}
          <div className="flex items-center gap-2 w-full lg:w-auto justify-end flex-wrap">
            {/* FLOATING GLASS HUD BUTTON */}
            <button
              onClick={() => setIsFloatingOpen(!isFloatingOpen)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                isFloatingOpen
                  ? 'bg-violet-500/20 text-violet-300 border-violet-400/50 shadow-md shadow-violet-500/20'
                  : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700/60'
              }`}
              title="Toggle Glassmorphic Floating HUD Window"
            >
              <Layers className="w-3.5 h-3.5 text-violet-400" />
              <span>{isFloatingOpen ? 'Floating HUD Active' : 'Open Floating HUD'}</span>
            </button>

            {/* Auto Answer Toggle */}
            <button
              onClick={() => setAutoAnswer(!autoAnswer)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                autoAnswer
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}
              title="Automatically generate answers when questions are detected"
            >
              <Zap className={`w-3.5 h-3.5 ${autoAnswer ? 'text-emerald-400 fill-emerald-400' : ''}`} />
              <span>{autoAnswer ? 'Auto-Answer ON' : 'Auto-Answer OFF'}</span>
            </button>

            {/* Google Meet Guide */}
            <button
              onClick={() => setShowMeetGuide(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-all"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Meeting Audio Setup</span>
            </button>

            {/* Save Session */}
            <button
              onClick={handleSaveSession}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700/60 transition-all"
            >
              <Save className="w-3.5 h-3.5 text-emerald-400" />
              <span>Save Session</span>
            </button>
          </div>
        </div>

        {/* ----------------------------------------------------------- */}
        {/* 2. THREE AUDIO INPUT MODES & LIVE SOURCE STATUS            */}
        {/* ----------------------------------------------------------- */}
        <div className="pt-3 border-t border-zinc-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 flex-wrap">
          
          {/* Audio Source Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Audio Input Mode:</span>
            </span>

            <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 gap-1 flex-wrap">
              {/* 1. Device Audio Only */}
              <button
                onClick={() => handleAudioSourceModeChange('device_only')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  audioSourceMode === 'device_only'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-400/50 shadow-sm shadow-sky-500/20'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Capture audio from Google Meet / Zoom tab only (Auto-generates answers)"
              >
                <Headphones className="w-3.5 h-3.5" />
                <span>Device Audio (Auto)</span>
              </button>

              {/* 2. Device + My Audio (Both) */}
              <button
                onClick={() => handleAudioSourceModeChange('both')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  audioSourceMode === 'both'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-400/50 shadow-sm shadow-purple-500/20'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Capture Google Meet tab audio AND candidate mic (Interviewer questions auto-answered, candidate mic feedback-loop free)"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Both: Device + Mic (Auto + Fallback)</span>
              </button>

              {/* 3. My Audio Only */}
              <button
                onClick={() => handleAudioSourceModeChange('mic_only')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  audioSourceMode === 'mic_only'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 shadow-sm shadow-emerald-500/20'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Capture candidate microphone only (Auto-generates answers)"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Microphone Only (Auto)</span>
              </button>
            </div>

            {/* Mode Behavior Badge */}
            <div className="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border bg-emerald-950/40 border-emerald-500/40 text-emerald-300">
              {audioSourceMode === 'both' ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>BOTH Mode: <strong>Device Questions Auto-Answered</strong> • Mic feedback-loop free • Manual Ask ready</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{audioSourceMode === 'device_only' ? 'DEVICE Mode' : 'MIC Mode'}: <strong>Automatic AI Answer Generation Active</strong></span>
                </>
              )}
            </div>
          </div>

          {/* Live Audio Source Status Indicators & Levels */}
          <div className="flex items-center gap-3 text-xs flex-wrap">
            {/* Candidate Mic Indicator */}
            {(audioSourceMode === 'mic_only' || audioSourceMode === 'both') && (
              <div 
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
                  isMicListening 
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
                    : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                }`}
                title="Microphone input status and live level"
              >
                <Mic className="w-3 h-3 text-emerald-400" />
                <span>Mic: {isMicListening ? 'Active' : 'Idle'}</span>
                <div className="w-10 h-1.5 bg-zinc-800 rounded-full overflow-hidden ml-1">
                  <div 
                    className="h-full bg-emerald-400 transition-all duration-75"
                    style={{ width: `${micAudioLevel}%` }}
                  />
                </div>
              </div>
            )}

            {/* Meeting Tab Audio Indicator */}
            {(audioSourceMode === 'device_only' || audioSourceMode === 'both') && (
              <div 
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
                  isTabAudioActive 
                    ? 'bg-sky-950/40 border-sky-500/40 text-sky-300' 
                    : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                }`}
                title="Meeting tab audio status and live level"
              >
                <Headphones className="w-3 h-3 text-sky-400" />
                <span>Meeting Tab: {isTabAudioActive ? (isTabTranscribing ? 'Transcribing...' : 'Active') : 'Not Shared'}</span>
                {isTabAudioActive ? (
                  <div className="w-10 h-1.5 bg-zinc-800 rounded-full overflow-hidden ml-1">
                    <div 
                      className="h-full bg-sky-400 transition-all duration-75"
                      style={{ width: `${tabAudioLevel}%` }}
                    />
                  </div>
                ) : (
                  <button
                    onClick={handleCaptureTabAudio}
                    className="ml-1 text-[10px] text-sky-400 underline hover:text-sky-300"
                  >
                    Share Tab
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ----------------------------------------------------------- */}
        {/* 3. FEEDBACK LOOP PREVENTION SETTING (Crucial Requirement)    */}
        {/* ----------------------------------------------------------- */}
        <div className="pt-3 border-t border-zinc-800/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs bg-zinc-950/40 p-2.5 rounded-xl border border-white/5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold text-zinc-200">Answer Trigger Policy: </span>
              <span className="text-zinc-400">Controls which voice stream triggers AI answers</span>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
            <button
              onClick={() => setAnswerTriggerPolicy('meeting_only')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                answerTriggerPolicy === 'meeting_only'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Prevents feedback loops: Reading an answer aloud will NOT trigger another AI answer!"
            >
              🎧 Meeting Audio Only (Recommended)
            </button>
            <button
              onClick={() => setAnswerTriggerPolicy('mic_only')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                answerTriggerPolicy === 'mic_only'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Only your microphone triggers answers (for mock interviews)"
            >
              🎙️ Mic Only
            </button>
            <button
              onClick={() => setAnswerTriggerPolicy('both')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                answerTriggerPolicy === 'both'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Both sources trigger answers"
            >
              🌐 Both
            </button>
          </div>
        </div>

        {/* ----------------------------------------------------------- */}
        {/* 4. PIPELINE STATE BANNER                                    */}
        {/* ----------------------------------------------------------- */}
        <div className="flex items-center justify-between text-xs px-3 py-1.5 rounded-xl bg-zinc-950/80 border border-zinc-800">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-zinc-400 font-mono text-[11px]">Pipeline Status:</span>
            <span className="font-semibold text-zinc-200">
              {pipelineStatus === 'idle' && '⚪ Idle (Click Start Live Copilot)'}
              {pipelineStatus === 'listening' && (
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Listening for questions...
                </span>
              )}
              {pipelineStatus === 'paused' && <span className="text-amber-400">⏸️ Paused</span>}
              {pipelineStatus === 'transcribing' && <span className="text-sky-300">⏳ Transcribing meeting audio...</span>}
              {pipelineStatus === 'generating_answer' && (
                <span className="text-violet-300 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin text-violet-400" />
                  Generating interview answer...
                </span>
              )}
              {pipelineStatus === 'answer_ready' && <span className="text-emerald-300">💡 Copilot Answer Ready</span>}
              {pipelineStatus === 'error' && <span className="text-rose-400">⚠️ Audio Pipeline Error</span>}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500">
              Auto-Answer: {autoAnswer ? 'ON' : 'OFF'}
            </span>
            <span>•</span>
            <span className="text-[10px] text-zinc-500">
              Deduplication: Active (30s)
            </span>
          </div>
        </div>

        {/* Alerts & Errors */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-center gap-2.5 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {sttStatusNotice && (
          <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/50 flex items-center justify-between text-amber-200 text-xs">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0 text-amber-400" />
              <span>{sttStatusNotice}</span>
            </div>
            <button onClick={() => setSttStatusNotice(null)} className="text-amber-400 hover:text-amber-100 font-bold ml-2">Dismiss</button>
          </div>
        )}

        {saveStatus && (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-center gap-2.5 text-emerald-300 text-xs">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{saveStatus}</span>
          </div>
        )}

        {setupNotice && (
          <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40 flex items-center gap-2.5 text-cyan-300 text-xs">
            <Sparkles className="w-4 h-4 shrink-0 text-cyan-400" />
            <span>{setupNotice}</span>
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------- */}
      {/* 5. MAIN CONTENT: 2-COLUMN COCKPIT (Dialogue & Answers)       */}
      {/* ----------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: LIVE DIALOGUE & TRANSCRIPT (5 cols) */}
        <div className="lg:col-span-5 bg-zinc-900/60 rounded-2xl border border-zinc-800 p-4 flex flex-col h-[650px] shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-sm text-zinc-100">Live Dialogue & Transcript</h3>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
              {transcript.length} turns
            </span>
          </div>

          {/* Transcript Scroll Area */}
          <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
            {transcript.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 space-y-3">
                <Mic className="w-8 h-8 text-zinc-700" />
                <p className="text-xs">
                  {isSessionActive 
                    ? 'Listening for speech from selected audio source...'
                    : 'Click "Start Live Copilot" to begin capturing live interview dialogue.'}
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center pt-2">
                  <button
                    onClick={() => handleSimulateQuestion('what is JavaScript')}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700"
                  >
                    Test: What is JavaScript
                  </button>
                  <button
                    onClick={() => handleSimulateQuestion('what is method overloading in Java')}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700"
                  >
                    Test: Java Overloading
                  </button>
                </div>
              </div>
            ) : (
              transcript.map((turn) => {
                const isInterviewer = turn.speaker === 'interviewer';
                return (
                  <div
                    key={turn.id}
                    className={`p-3 rounded-xl border text-xs space-y-1.5 transition-all ${
                      isInterviewer
                        ? 'bg-sky-950/25 border-sky-500/30' // INTERVIEWER IN SKY BLUE
                        : 'bg-emerald-950/20 border-emerald-500/30' // CANDIDATE IN EMERALD GREEN
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span
                        className={`font-bold px-2 py-0.5 rounded-full ${
                          isInterviewer
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-400/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                        }`}
                      >
                        {isInterviewer 
                          ? (turn.source === 'meeting' ? '🎧 Meeting Audio (Interviewer)' : '🎙️ Interviewer Question') 
                          : '👤 You (Candidate)'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500 font-mono">
                          {new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        {(isInterviewer || audioSourceMode === 'both') && (
                          <button
                            onClick={() => handleGenerateAnswer(turn.text)}
                            className="px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-semibold text-[10px] border border-sky-500/30 flex items-center gap-1 transition-all"
                            title="Generate Copilot Answer manually"
                          >
                            ⚡ Answer
                          </button>
                        )}
                      </div>
                    </div>
                    <p className={`leading-relaxed ${isInterviewer ? 'text-sky-100 font-semibold' : 'text-emerald-100'}`}>
                      {turn.text}
                    </p>
                    {turn.corrections && turn.corrections.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] text-amber-300 font-mono">
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                          🎯 Term normalized: {turn.corrections.map(c => `"${c.original}" → "${c.corrected}" (${Math.round(c.confidence * 100)}%)`).join(', ')}
                        </span>
                        {turn.rawText && turn.rawText !== turn.text && (
                          <span className="text-zinc-500 text-[9px]" title={`Raw: ${turn.rawText}`}>
                            (raw: "{turn.rawText}")
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Live Streaming Dialogue Turn (Smooth real-time word transition) */}
            {interimTranscript && (
              <div
                className={`p-3 rounded-xl border text-xs space-y-1.5 transition-all shadow-sm ${
                  activeSpeaker === 'interviewer'
                    ? 'bg-sky-950/40 border-sky-400/60 ring-1 ring-sky-500/30'
                    : 'bg-emerald-950/40 border-emerald-400/60 ring-1 ring-emerald-500/30'
                }`}
              >
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-bold px-2 py-0.5 rounded-full ${
                        activeSpeaker === 'interviewer'
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-400/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                      }`}
                    >
                      {activeSpeaker === 'interviewer' ? '🎙️ Interviewer Speaking...' : '👤 You Speaking...'}
                    </span>
                    <span className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                      <span>LIVE</span>
                    </span>
                  </div>
                  <span className="text-zinc-400 font-mono text-[9px]">Live Transition</span>
                </div>
                <p className={`leading-relaxed text-sm font-medium flex items-center flex-wrap gap-1 ${
                  activeSpeaker === 'interviewer' ? 'text-sky-100' : 'text-emerald-100'
                }`}>
                  <span>{interimTranscript}</span>
                  <span className="inline-block w-1.5 h-4 bg-cyan-400 animate-pulse ml-0.5 rounded-sm" />
                </p>
              </div>
            )}

            {sttStatusNotice && (
              <div className="p-2.5 rounded-xl border border-cyan-500/30 bg-cyan-950/40 text-xs flex items-center justify-between text-cyan-300 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span className="font-medium">{sttStatusNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSttStatusNotice(null)}
                  className="text-cyan-400 hover:text-white p-0.5 text-xs"
                >
                  ✕
                </button>
              </div>
            )}
            <div ref={transcriptBottomRef} />
          </div>

          {/* Quick Question Input & Clear */}
          <div className="pt-2 border-t border-zinc-800 flex items-center gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerateAnswer()}
              placeholder="Ask, type, or paste question..."
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={() => handleGenerateAnswer()}
              disabled={isLoadingAnswer || !manualInput.trim()}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold text-xs"
            >
              Ask
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: AI COPILOT ANSWERS & SPOKEN SCRIPTS (7 cols) */}
        <div className="lg:col-span-7 bg-zinc-900/60 rounded-2xl border border-zinc-800 p-4 flex flex-col h-[650px] shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-sm text-zinc-100">Copilot Answers & Spoken Scripts</h3>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
              {answers.length} answers
            </span>
          </div>

          {/* Answers Scroll Area */}
          <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
            {isLoadingAnswer && (
              <div className="p-4 rounded-xl bg-zinc-950 border border-emerald-500/40 flex items-center gap-3 text-xs text-emerald-300 animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                <span>Generating interview answer & natural spoken script...</span>
              </div>
            )}

            {answers.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 space-y-3">
                <Sparkles className="w-8 h-8 text-zinc-700" />
                <p className="text-xs">
                  When your interviewer speaks or asks a question, humanized answers and spoken scripts will appear here immediately.
                </p>
              </div>
            ) : (
              answers.map((ans) => (
                <div key={ans.id} className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3 shadow-md">
                  
                  {/* Question Header */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      {ans.mode} Copilot
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {new Date(ans.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Question Highlight */}
                  <h4 className="text-xs font-bold text-sky-200 bg-sky-950/30 p-2.5 rounded-lg border border-sky-500/20">
                    🎙️ {ans.question}
                  </h4>

                  {/* Summary */}
                  <div className="text-xs text-emerald-200 font-medium leading-relaxed bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-800/30">
                    💡 {ans.summary}
                  </div>

                  {/* Humanized Spoken Script */}
                  {ans.spokenScript && (
                    <div className="p-3 rounded-xl bg-gradient-to-br from-violet-950/40 via-zinc-900 to-indigo-950/30 border border-violet-500/40 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-violet-300">
                        <span>How to Say it Out Loud (Interview Script)</span>
                        <button
                          onClick={() => handleCopy('script_' + ans.id, ans.spokenScript!)}
                          className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
                        >
                          {copiedCodeId === 'script_' + ans.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-zinc-200 leading-relaxed italic bg-zinc-950/70 p-2 rounded border border-violet-500/20">
                        &ldquo;{ans.spokenScript}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* Key Points */}
                  {ans.bullets && ans.bullets.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Key Points to Say</p>
                      <ul className="space-y-1 text-xs text-zinc-300">
                        {ans.bullets.map((b, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0"></span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Code Snippet if present */}
                  {ans.codeSnippet && (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden text-[11px] font-mono">
                      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-zinc-400">
                        <span>{ans.codeSnippet.language}</span>
                        <button
                          onClick={() => handleCopy('code_' + ans.id, ans.codeSnippet!.code)}
                          className="hover:text-zinc-200 flex items-center gap-1"
                        >
                          {copiedCodeId === 'code_' + ans.id ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <pre className="p-3 text-zinc-200 overflow-x-auto">
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

      {/* ----------------------------------------------------------- */}
      {/* 6. GOOGLE MEET AUDIO SETUP MODAL                            */}
      {/* ----------------------------------------------------------- */}
      {showMeetGuide && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
                <Laptop className="w-4 h-4 text-emerald-400" />
                <span>Audio Source & Google Meet Setup Guide</span>
              </h3>
              <button onClick={() => setShowMeetGuide(false)} className="text-zinc-400 hover:text-zinc-200 text-sm">✕</button>
            </div>

            <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                <p className="font-bold text-emerald-300">How to capture interviewer audio from Google Meet / Zoom:</p>
                <ol className="list-decimal list-inside space-y-1 text-zinc-400">
                  <li>Select <strong className="text-zinc-200">Device Audio</strong> or <strong className="text-zinc-200">Both</strong> in the Audio Input Mode selector.</li>
                  <li>In the browser dialog that appears, click the <strong className="text-zinc-200">&ldquo;Chrome Tab&rdquo;</strong> tab.</li>
                  <li>Click on your active <strong className="text-zinc-200">Google Meet</strong> or <strong className="text-zinc-200">Zoom</strong> tab.</li>
                  <li>Ensure the checkbox <strong className="text-emerald-400">&ldquo;Also share tab audio&rdquo;</strong> in the bottom-left is <strong className="text-emerald-300">CHECKED</strong>.</li>
                </ol>
              </div>

              <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-800/40 text-sky-200 space-y-1">
                <p className="font-semibold text-sky-300">🛡️ Feedback Loop Prevention:</p>
                <p className="text-[11px] text-sky-200/80">
                  With &ldquo;Meeting Audio Only&rdquo; trigger policy, your microphone voice is transcribed as &ldquo;You&rdquo;, but only the interviewer&apos;s audio triggers AI answers. Reading an answer aloud will never create a recursive loop!
                </p>
              </div>

              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/40 text-amber-200/90 text-[11px] space-y-1">
                <p className="font-semibold text-amber-300">⚠️ Operating System & Browser Limitations:</p>
                <p>
                  Browser audio capture operates via the W3C DisplayMedia API in Chromium browsers (Chrome, Edge). Capturing system-wide audio from native desktop apps (like native desktop Zoom.exe or Teams.exe) without sharing a tab requires a native desktop application with virtual audio loopback drivers.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowMeetGuide(false)}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs"
              >
                Got It, Let&apos;s Go
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* 7. FLOATING GLASS HUD OVERLAY                               */}
      {/* ----------------------------------------------------------- */}
      <FloatingCopilotOverlay
        isOpen={isFloatingOpen}
        onClose={() => setIsFloatingOpen(false)}
        isSessionActive={isSessionActive}
        isPaused={isPaused}
        onToggleSession={handleToggleSession}
        onPauseResume={handlePauseResume}
        sessionDuration={sessionDuration}
        currentMode={currentMode}
        onModeChange={setCurrentMode}
        audioSourceMode={audioSourceMode}
        onAudioSourceChange={handleAudioSourceModeChange}
        answerTriggerPolicy={answerTriggerPolicy}
        onAnswerTriggerPolicyChange={setAnswerTriggerPolicy}
        pipelineStatus={pipelineStatus}
        micAudioLevel={micAudioLevel}
        tabAudioLevel={tabAudioLevel}
        transcript={transcript}
        interimTranscript={interimTranscript}
        answers={answers}
        activeSpeaker={activeSpeaker}
        onToggleSpeaker={() => setActiveSpeaker(prev => prev === 'interviewer' ? 'candidate' : 'interviewer')}
        onManualAnswer={handleGenerateAnswer}
        isLoadingAnswer={isLoadingAnswer}
        streamingText={streamingAnswerText}
        firstTokenLatency={firstTokenLatency}
        isTabAudioActive={isTabAudioActive}
        onCaptureTabAudio={handleCaptureTabAudio}
        sttStatusNotice={sttStatusNotice}
        onDismissNotice={() => setSttStatusNotice(null)}
        audioInputDevices={audioInputDevices}
        selectedMicDeviceId={selectedMicDeviceId}
        onSelectMicDevice={handleSelectMicDevice}
        speechLang={speechLang}
        onSpeechLangChange={handleSpeechLangChange}
        isMicReceivingAudio={isMicReceivingAudio}
        isTabReceivingAudio={isTabReceivingAudio}
        errorMessage={errorMessage}
        onDismissError={() => setErrorMessage(null)}
      />
    </div>
  );
};
