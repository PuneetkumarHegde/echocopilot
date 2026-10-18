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
}

interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

export const CopilotModule: React.FC<CopilotModuleProps> = ({
  initialPrompt = '',
  initialMode = 'coding',
  onClearInitialPrompt
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
  const [isFloatingOpen, setIsFloatingOpen] = useState(false);
  const [autoOpenFloating, setAutoOpenFloating] = useState(true);

  // -------------------------------------------------------------
  // 2. Audio Source & Feedback Loop Prevention State
  // -------------------------------------------------------------
  const [audioSourceMode, setAudioSourceMode] = useState<AudioSourceMode>('device_only');
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
  const [manualInput, setManualInput] = useState(initialPrompt);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [setupNotice, setSetupNotice] = useState<string | null>(null);
  const [sttStatusNotice, setSttStatusNotice] = useState<string | null>(null);

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
  const deduplicatorRef = useRef(new QuestionDeduplicator(15000));

  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptBottomRef = useRef<HTMLDivElement | null>(null);
  const autoAnswerRef = useRef(true);
  const isSessionActiveRef = useRef(false);
  const isPausedRef = useRef(false);
  const activeSpeakerRef = useRef(activeSpeaker);
  const audioSourceModeRef = useRef<AudioSourceMode>('device_only');
  const answerTriggerPolicyRef = useRef<AnswerTriggerPolicy>('meeting_only');
  const speechDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastInterimRef = useRef<string>('');

  // Synchronize Refs
  useEffect(() => { audioSourceModeRef.current = audioSourceMode; }, [audioSourceMode]);
  useEffect(() => { answerTriggerPolicyRef.current = answerTriggerPolicy; }, [answerTriggerPolicy]);
  useEffect(() => { autoAnswerRef.current = autoAnswer; }, [autoAnswer]);
  useEffect(() => { isSessionActiveRef.current = isSessionActive; }, [isSessionActive]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { activeSpeakerRef.current = activeSpeaker; }, [activeSpeaker]);

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
      if (data.type === 'NEW_ANSWER' && data.answer) {
        setAnswers(prev => {
          if (prev.some(a => a.id === data.answer.id)) return prev;
          return [data.answer, ...prev];
        });
        setPipelineStatus('answer_ready');
      } else if (data.type === 'NEW_TURN' && data.turn) {
        setTranscript(prev => {
          if (prev.some(t => t.id === data.turn.id)) return prev;
          return [...prev, data.turn];
        });
      }
    };
    return () => {
      bc.close();
    };
  }, []);

  // Enumerate input audio devices (Part 1 - Enumerate & Select Input Device)
  useEffect(() => {
    const refreshDevices = async () => {
      const devices = await enumerateAudioInputDevices();
      setAudioInputDevices(devices);
      // Auto-select first device if none selected
      if (!selectedMicDeviceId && devices.length > 0) {
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
      micAudioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        if (!isPausedRef.current) {
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

    // 4. Stop MediaRecorder
    if (tabMediaRecorderRef.current && tabMediaRecorderRef.current.state !== 'inactive') {
      try { tabMediaRecorderRef.current.stop(); } catch {}
      tabMediaRecorderRef.current = null;
    }

    // 5. Stop Speech Recognition
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }

    setIsMicListening(false);
    setIsTabAudioActive(false);
    setIsMicReceivingAudio(false);
    setIsTabReceivingAudio(false);
    setMicAudioLevel(0);
    setTabAudioLevel(0);
  };

  // -------------------------------------------------------------
  // 6. Speech-to-Text: Microphone (Web Speech API)
  // -------------------------------------------------------------
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
      rec.lang = 'en-US';

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
            if (finalSpeech) {
              commitTurnAndAnswer(finalSpeech, 'mic', 'candidate');
              return;
            }
          } else {
            interim += item[0].transcript;
          }
        }

        const trimmedInterim = interim.trim();
        setInterimTranscript(trimmedInterim);
        lastInterimRef.current = trimmedInterim;

        if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);

        // Auto-commit paused speech after 1.2s silence
        if (trimmedInterim.length > 3) {
          speechDebounceTimerRef.current = setTimeout(() => {
            if (lastInterimRef.current && !isPausedRef.current) {
              commitTurnAndAnswer(lastInterimRef.current, 'mic', 'candidate');
            }
          }, 1200);
        }
      };

      rec.onerror = (event: any) => {
        if (event.error === 'no-speech') return;
        console.warn('Speech recognition event error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setMicPermissionState('denied');
          setIsMicListening(false);
          setErrorMessage('Microphone access was denied. Please allow microphone permissions in your browser address bar.');
        } else if (event.error === 'network') {
          setErrorMessage('Speech recognition network error. Please check your internet connection.');
        }
      };

      rec.onend = () => {
        if (isSessionActiveRef.current && !isPausedRef.current) {
          try { rec.start(); } catch {}
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

      // Listen for user stopping share via native browser notification bar
      stream.getVideoTracks()[0].onended = () => {
        setIsTabAudioActive(false);
        setTabAudioLevel(0);
        if (tabMediaRecorderRef.current && tabMediaRecorderRef.current.state !== 'inactive') {
          try { tabMediaRecorderRef.current.stop(); } catch {}
          tabMediaRecorderRef.current = null;
        }
        tabMediaStreamRef.current = null;
      };

      audioTracks[0].onended = () => {
        setIsTabAudioActive(false);
        setTabAudioLevel(0);
      };

      // Set up MediaRecorder to stream audio slices to /api/transcribe
      setupTabMediaRecorder(stream);

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
  // 8. Unified Utterance Committer & Feedback-Loop-Free Answer Dispatch
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
    let speaker: 'interviewer' | 'candidate' = speakerHint;
    if (source === 'meeting') {
      speaker = 'interviewer'; // Audio from meeting tab is the interviewer!
    } else if (source === 'mic') {
      speaker = 'candidate';   // Audio from microphone is the candidate!
    }

    // Create transcript turn
    const turn: TranscriptTurn = {
      id: 'turn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      speaker,
      source,
      text: trimmed,
      timestamp: Date.now(),
      isFinal: true
    };

    setTranscript(prev => [...prev, turn]);
    setInterimTranscript('');
    setManualInput(trimmed);
    lastInterimRef.current = '';

    // AUTOMATIC ANSWER EVALUATION ACROSS ALL MODES:
    // - In MIC mode: Spoken questions from candidate microphone trigger answers.
    // - In DEVICE mode: Interviewer questions from device trigger answers.
    // - In BOTH mode: Interviewer questions from device trigger answers automatically.
    //                 Candidate mic responses NEVER trigger answers (feedback-loop free).
    // - Manual inputs always trigger answers immediately.
    const triggerAllowed = autoAnswerRef.current && shouldTriggerAnswer(
      turn,
      audioSourceModeRef.current,
      true
    );
    
    // DEDUPLICATION GUARD:
    // Prevent duplicate triggers from rapid repeated speech events
    const isNew = deduplicatorRef.current.isNewQuestion(trimmed);

    if (triggerAllowed && isNew) {
      turn.triggeredAnswer = true;
      setPipelineStatus('question_detected');
      handleGenerateAnswer(trimmed);
    }

    // Broadcast turn to any open floating window
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('echocopilot_channel');
        bc.postMessage({ type: 'NEW_TURN', turn });
        bc.close();
      }
    } catch {}
  };

  // -------------------------------------------------------------
  // 9. AI Copilot Answer Generator
  // -------------------------------------------------------------
  const handleGenerateAnswer = async (promptText?: string) => {
    const query = (promptText || manualInput).trim();
    if (!query) return;

    setIsLoadingAnswer(true);
    setErrorMessage(null);
    setPipelineStatus('generating_answer');

    try {
      const resp = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query,
          mode: currentMode
        })
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || 'Failed to fetch copilot answer');
      }

      if (data.answer) {
        setAnswers(prev => [data.answer, ...prev]);
        setPipelineStatus('answer_ready');
        if (data.setupNotice) {
          setSetupNotice(data.setupNotice);
        }

        // Broadcast to floating HUD / popout windows
        try {
          if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            const bc = new BroadcastChannel('echocopilot_channel');
            bc.postMessage({ type: 'NEW_ANSWER', answer: data.answer });
            bc.close();
          }
          if (typeof window !== 'undefined') {
            localStorage.setItem('echocopilot_latest_answer', JSON.stringify(data.answer));
          }
        } catch {}
      }
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Connection error while generating AI response.');
      setPipelineStatus('error');
    } finally {
      setIsLoadingAnswer(false);
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

      if (autoOpenFloating) {
        setIsFloatingOpen(true);
      }

      // Initialize based on selected Audio Source Mode
      if (audioSourceMode === 'mic_only') {
        // 1. Microphone Only (Candidate Speech)
        try {
          const audioConstraints: MediaTrackConstraints = selectedMicDeviceId && selectedMicDeviceId !== 'default'
            ? { deviceId: { exact: selectedMicDeviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
          let micStream: MediaStream;
          try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
          } catch {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          }
          micMediaStreamRef.current = micStream;
          startMicAudioMeter(micStream);
        } catch (err) {
          setErrorMessage('Could not open microphone: ' + formatAudioErrorMessage(err));
        }

        const rec = initSpeechRecognition();
        if (rec) {
          recognitionRef.current = rec;
          try { rec.start(); } catch {}
        }

      } else if (audioSourceMode === 'device_only') {
        // 2. Device Audio Only (Interviewer Meeting Speech)
        if (!isTabAudioActive) {
          await handleCaptureTabAudio();
        }

      } else if (audioSourceMode === 'both') {
        // 3. Both Microphone + Device Audio simultaneously
        try {
          const audioConstraints: MediaTrackConstraints = selectedMicDeviceId && selectedMicDeviceId !== 'default'
            ? { deviceId: { exact: selectedMicDeviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
          let micStream: MediaStream;
          try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
          } catch {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          }
          micMediaStreamRef.current = micStream;
          startMicAudioMeter(micStream);
        } catch (err) {
          console.warn('Microphone error in Both mode:', err);
          setErrorMessage('Microphone capture error in Both mode: ' + formatAudioErrorMessage(err));
        }

        const rec = initSpeechRecognition();
        if (rec) {
          recognitionRef.current = rec;
          try { rec.start(); } catch {}
        }

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

    // Auto-answering is enabled across all modes:
    // In MIC mode: Spoken questions from candidate mic trigger answers
    // In DEVICE mode: Interviewer questions from device audio trigger answers
    // In BOTH mode: Interviewer questions from device trigger answers; candidate mic speech does NOT trigger answers
    setAutoAnswer(true);

    if (!isSessionActive) return;

    if (newMode === 'mic_only') {
      // Stop meeting tab audio
      if (tabMediaStreamRef.current) {
        tabMediaStreamRef.current.getTracks().forEach(t => t.stop());
        tabMediaStreamRef.current = null;
        setIsTabAudioActive(false);
        setTabAudioLevel(0);
      }
      if (tabMediaRecorderRef.current && tabMediaRecorderRef.current.state !== 'inactive') {
        try { tabMediaRecorderRef.current.stop(); } catch {}
        tabMediaRecorderRef.current = null;
      }
      // Ensure mic is active
      if (!micMediaStreamRef.current) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micMediaStreamRef.current = micStream;
          startMicAudioMeter(micStream);
        } catch {}
      }
      if (!recognitionRef.current) {
        const rec = initSpeechRecognition();
        if (rec) {
          recognitionRef.current = rec;
          try { rec.start(); } catch {}
        }
      }

    } else if (newMode === 'device_only') {
      // Stop mic
      if (micMediaStreamRef.current) {
        micMediaStreamRef.current.getTracks().forEach(t => t.stop());
        micMediaStreamRef.current = null;
        setMicAudioLevel(0);
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
      if (!micMediaStreamRef.current) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micMediaStreamRef.current = micStream;
          startMicAudioMeter(micStream);
        } catch {}
      }
      if (!recognitionRef.current) {
        const rec = initSpeechRecognition();
        if (rec) {
          recognitionRef.current = rec;
          try { rec.start(); } catch {}
        }
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
                  </div>
                );
              })
            )}

            {/* Interim live speech preview */}
            {interimTranscript && (
              <div className="p-2.5 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/40 text-xs italic text-zinc-400 animate-pulse">
                Listening... &ldquo;{interimTranscript}&rdquo;
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
        isTabAudioActive={isTabAudioActive}
        onCaptureTabAudio={handleCaptureTabAudio}
        sttStatusNotice={sttStatusNotice}
        onDismissNotice={() => setSttStatusNotice(null)}
        audioInputDevices={audioInputDevices}
        selectedMicDeviceId={selectedMicDeviceId}
        onSelectMicDevice={handleSelectMicDevice}
        isMicReceivingAudio={isMicReceivingAudio}
        isTabReceivingAudio={isTabReceivingAudio}
        errorMessage={errorMessage}
        onDismissError={() => setErrorMessage(null)}
      />
    </div>
  );
};
