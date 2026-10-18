/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  AnswerMode, CopilotAnswer, TranscriptTurn, 
  AudioSourceMode, AnswerTriggerPolicy, AudioPipelineStatus,
  AudioInputDevice
} from '@/lib/types';
import { 
  isMeaningfulQuestion, QuestionDeduplicator, shouldTriggerAnswer, 
  formatAudioErrorMessage, enumerateAudioInputDevices
} from '@/lib/audioPipelineHelper';
import { startPcmStreamRecorder, PcmStreamRecorder } from '@/lib/wavRecorder';
import { FloatingCopilotOverlay } from '@/components/FloatingCopilotOverlay';

interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

export default function FloatingPage() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [currentMode, setCurrentMode] = useState<AnswerMode>('coding');
  const [audioSourceMode, setAudioSourceMode] = useState<AudioSourceMode>('device_only');
  const [autoAnswer, setAutoAnswer] = useState(true);
  const [answerTriggerPolicy, setAnswerTriggerPolicy] = useState<AnswerTriggerPolicy>('meeting_only');
  const [pipelineStatus, setPipelineStatus] = useState<AudioPipelineStatus>('idle');

  // Audio Device and Hardware Verification State
  const [audioInputDevices, setAudioInputDevices] = useState<AudioInputDevice[]>([]);
  const [selectedMicDeviceId, setSelectedMicDeviceId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('echocopilot_mic_device_id') || '';
    }
    return '';
  });
  const [isMicReceivingAudio, setIsMicReceivingAudio] = useState(false);
  const [isTabReceivingAudio, setIsTabReceivingAudio] = useState(false);
  const [micAudioLevel, setMicAudioLevel] = useState(0);
  const [tabAudioLevel, setTabAudioLevel] = useState(0);
  const [isTabAudioActive, setIsTabAudioActive] = useState(false);

  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [activeSpeaker, setActiveSpeaker] = useState<'interviewer' | 'candidate'>('interviewer');
  const [answers, setAnswers] = useState<CopilotAnswer[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('echocopilot_latest_answer');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.id) return [parsed];
        }
      } catch {}
    }
    return [];
  });
  const [isLoadingAnswer, setIsLoadingAnswer] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sttStatusNotice, setSttStatusNotice] = useState<string | null>(null);

  // References
  const recognitionRef = useRef<any>(null);
  const tabMediaStreamRef = useRef<MediaStream | null>(null);
  const micMediaStreamRef = useRef<MediaStream | null>(null);
  const micRecorderRef = useRef<PcmStreamRecorder | null>(null);
  const tabRecorderRef = useRef<PcmStreamRecorder | null>(null);
  const deduplicatorRef = useRef(new QuestionDeduplicator(15000));

  const isSessionActiveRef = useRef(false);
  const isPausedRef = useRef(false);
  const activeSpeakerRef = useRef(activeSpeaker);
  const audioSourceModeRef = useRef<AudioSourceMode>('device_only');
  const autoAnswerRef = useRef(true);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const speechDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastInterimRef = useRef<string>('');

  useEffect(() => { isSessionActiveRef.current = isSessionActive; }, [isSessionActive]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { activeSpeakerRef.current = activeSpeaker; }, [activeSpeaker]);
  useEffect(() => { audioSourceModeRef.current = audioSourceMode; }, [audioSourceMode]);
  useEffect(() => { autoAnswerRef.current = autoAnswer; }, [autoAnswer]);

  // Check if running inside Electron desktop overlay
  const [isElectron, setIsElectron] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.isElectron) {
      setIsElectron(true);
      document.documentElement.classList.add('electron-window');
      document.body.classList.add('electron-window');
      document.body.style.backgroundColor = 'transparent';
      document.documentElement.style.backgroundColor = 'transparent';
    }
  }, []);

  // Enumerate input audio devices on mount
  useEffect(() => {
    const refreshDevices = async () => {
      const devices = await enumerateAudioInputDevices();
      setAudioInputDevices(devices);
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

  // Session duration timer (respects Pause)
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

  // Clean up streams on unmount
  useEffect(() => {
    return () => {
      stopAllAudioStreams();
    };
  }, []);

  // Cross-Window Synchronization (Main Window <-> Standalone Popout)
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

    // Load initial answer from localStorage if available
    try {
      const savedLatest = localStorage.getItem('echocopilot_latest_answer');
      if (savedLatest) {
        const parsed = JSON.parse(savedLatest);
        if (parsed && parsed.id) {
          setAnswers(prev => prev.length === 0 ? [parsed] : prev);
        }
      }
    } catch {}

    return () => {
      bc.close();
    };
  }, []);

  // -------------------------------------------------------------
  // Stream Stopping and Cleanup
  // -------------------------------------------------------------
  const stopAllAudioStreams = () => {
    if (micRecorderRef.current) {
      micRecorderRef.current.stop();
      micRecorderRef.current = null;
    }
    if (tabRecorderRef.current) {
      tabRecorderRef.current.stop();
      tabRecorderRef.current = null;
    }
    if (micMediaStreamRef.current) {
      micMediaStreamRef.current.getTracks().forEach(t => t.stop());
      micMediaStreamRef.current = null;
    }
    if (tabMediaStreamRef.current) {
      tabMediaStreamRef.current.getTracks().forEach(t => t.stop());
      tabMediaStreamRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }

    setIsTabAudioActive(false);
    setIsMicReceivingAudio(false);
    setIsTabReceivingAudio(false);
    setMicAudioLevel(0);
    setTabAudioLevel(0);
  };

  // -------------------------------------------------------------
  // Speech-to-Text Audio Chunk Handler (WAV to Local SAPI / Cloud)
  // -------------------------------------------------------------
  const handleAudioChunk = async (blob: Blob, source: 'mic' | 'meeting') => {
    if (isPausedRef.current) return;
    setPipelineStatus('transcribing');

    try {
      const formData = new FormData();
      formData.append('audio', blob, `${source}_slice.wav`);
      formData.append('source', source);

      const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
      const data = await res.json();

      if (res.ok && data.transcript) {
        const cleanTranscript = data.transcript.trim();
        if (cleanTranscript.length > 1) {
          const speakerHint = source === 'meeting' ? 'interviewer' : 'candidate';
          commitTurnAndAnswer(cleanTranscript, source, speakerHint);
        }
      } else if (data.error && data.error !== 'MISSING_STT_KEY') {
        console.warn('Transcription message:', data.message || data.error);
      }
    } catch (err: unknown) {
      console.warn('Audio transcription failed:', err);
    } finally {
      if (isSessionActiveRef.current && !isPausedRef.current) {
        setPipelineStatus('listening');
      }
    }
  };

  // -------------------------------------------------------------
  // Web Speech API Initialization (Optional live preview in Chrome)
  // -------------------------------------------------------------
  const initSpeechRecognition = () => {
    const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
    const SpeechRec = win?.SpeechRecognition || win?.webkitSpeechRecognition;

    if (!SpeechRec || isElectron) {
      return null;
    }

    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = () => {
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

        const trimmed = interim.trim();
        setInterimTranscript(trimmed);
        lastInterimRef.current = trimmed;
      };

      rec.onerror = (e: any) => {
        if (e.error === 'no-speech') return;
      };

      rec.onend = () => {
        if (isSessionActiveRef.current && !isPausedRef.current) {
          try { rec.start(); } catch {}
        }
      };

      return rec;
    } catch {
      return null;
    }
  };

  // -------------------------------------------------------------
  // Answer Generator using Local Smart Copilot Engine
  // -------------------------------------------------------------
  const handleGenerateAnswer = async (queryText: string) => {
    const q = queryText.trim();
    if (!q) return;

    setIsLoadingAnswer(true);
    setPipelineStatus('generating_answer');

    try {
      const resp = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: q,
          mode: currentMode
        })
      });

      const data = await resp.json();
      if (data.answer) {
        setAnswers(prev => [data.answer, ...prev]);
        setPipelineStatus('answer_ready');

        // Broadcast to main cockpit & localStorage
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
    } catch (err) {
      console.error('Answer generation failed:', err);
      setPipelineStatus('error');
      setErrorMessage('Answer generation encountered an error. Please try asking again.');
    } finally {
      setIsLoadingAnswer(false);
    }
  };

  // -------------------------------------------------------------
  // Turn Committer & Feedback-Free Answering Pipeline
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

    let speaker: 'interviewer' | 'candidate' = speakerHint;
    if (source === 'meeting') speaker = 'interviewer';
    else if (source === 'mic') speaker = 'candidate';

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
    lastInterimRef.current = '';

    // Automatic answer evaluation across all audio modes:
    // - MIC: Candidate questions trigger answers automatically.
    // - DEVICE: Interviewer questions trigger answers automatically.
    // - BOTH: Interviewer questions trigger answers; Candidate mic speech NEVER triggers answers (strictly prevents feedback loops).
    // - MANUAL: Always triggers answers.
    const triggerAllowed = autoAnswerRef.current && shouldTriggerAnswer(
      turn,
      audioSourceModeRef.current,
      true
    );

    const isNew = deduplicatorRef.current.isNewQuestion(trimmed);

    if (triggerAllowed && isNew) {
      turn.triggeredAnswer = true;
      setPipelineStatus('question_detected');
      handleGenerateAnswer(trimmed);
    }

    // Broadcast turn to main cockpit
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('echocopilot_channel');
        bc.postMessage({ type: 'NEW_TURN', turn });
        bc.close();
      }
    } catch {}
  };

  // -------------------------------------------------------------
  // Microphone Hardware Capture
  // -------------------------------------------------------------
  const startMicCapture = async (): Promise<boolean> => {
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

      micRecorderRef.current = startPcmStreamRecorder({
        stream: micStream,
        source: 'mic',
        onAudioChunk: handleAudioChunk,
        onAudioLevel: (lvl) => setMicAudioLevel(lvl),
        onReceivingAudio: (rec) => setIsMicReceivingAudio(rec),
        onError: (err) => console.warn('Mic recorder error:', err)
      });

      // Optional: in Chrome browser, start WebSpeech for live interim preview
      if (!isElectron && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        const rec = initSpeechRecognition();
        if (rec) {
          recognitionRef.current = rec;
          try { rec.start(); } catch {}
        }
      }

      return true;
    } catch (err: unknown) {
      setErrorMessage('Microphone access failed: ' + formatAudioErrorMessage(err));
      return false;
    }
  };

  // -------------------------------------------------------------
  // Meeting / Tab / Screen Audio Capture
  // -------------------------------------------------------------
  const startTabCapture = async (): Promise<boolean> => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        setErrorMessage('Meeting/tab audio capture is not supported in this browser. Please use Chrome or Edge.');
        return false;
      }

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
        stream.getTracks().forEach(t => t.stop());
        setErrorMessage('No audio track selected! Make sure to select "Chrome Tab" and check "Also share tab audio" in the screen sharing prompt.');
        return false;
      }

      tabMediaStreamRef.current = stream;
      setIsTabAudioActive(true);
      setErrorMessage(null);

      stream.getVideoTracks()[0].onended = () => {
        setIsTabAudioActive(false);
        setTabAudioLevel(0);
        if (tabRecorderRef.current) {
          tabRecorderRef.current.stop();
          tabRecorderRef.current = null;
        }
        tabMediaStreamRef.current = null;
      };

      audioTracks[0].onended = () => {
        setIsTabAudioActive(false);
        setTabAudioLevel(0);
        if (tabRecorderRef.current) {
          tabRecorderRef.current.stop();
          tabRecorderRef.current = null;
        }
      };

      tabRecorderRef.current = startPcmStreamRecorder({
        stream,
        source: 'meeting',
        onAudioChunk: handleAudioChunk,
        onAudioLevel: (lvl) => setTabAudioLevel(lvl),
        onReceivingAudio: (rec) => setIsTabReceivingAudio(rec),
        onError: (err) => console.warn('Tab recorder error:', err)
      });

      return true;
    } catch (err: unknown) {
      const msg = formatAudioErrorMessage(err);
      if ((err as Error).name !== 'NotAllowedError') {
        setErrorMessage('Failed to capture meeting audio: ' + msg);
      }
      return false;
    }
  };

  const handleCaptureTabAudio = async () => {
    if (isTabAudioActive) {
      if (tabRecorderRef.current) {
        tabRecorderRef.current.stop();
        tabRecorderRef.current = null;
      }
      if (tabMediaStreamRef.current) {
        tabMediaStreamRef.current.getTracks().forEach(t => t.stop());
        tabMediaStreamRef.current = null;
      }
      setIsTabAudioActive(false);
      setTabAudioLevel(0);
      return;
    }

    await startTabCapture();
  };

  const handleSelectMicDevice = async (deviceId: string) => {
    setSelectedMicDeviceId(deviceId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('echocopilot_mic_device_id', deviceId);
    }
    if (isSessionActive && (audioSourceMode === 'mic_only' || audioSourceMode === 'both')) {
      if (micRecorderRef.current) {
        micRecorderRef.current.stop();
        micRecorderRef.current = null;
      }
      if (micMediaStreamRef.current) {
        micMediaStreamRef.current.getTracks().forEach(t => t.stop());
        micMediaStreamRef.current = null;
      }
      await startMicCapture();
    }
  };

  // -------------------------------------------------------------
  // Session Toggle (Start / Stop)
  // -------------------------------------------------------------
  const handleToggleSession = async () => {
    if (isSessionActive) {
      setIsSessionActive(false);
      setIsPaused(false);
      setPipelineStatus('idle');
      stopAllAudioStreams();
    } else {
      setIsSessionActive(true);
      setIsPaused(false);
      setSessionDuration(0);
      setErrorMessage(null);
      setPipelineStatus('listening');

      if (audioSourceMode === 'mic_only') {
        await startMicCapture();
      } else if (audioSourceMode === 'device_only') {
        await startTabCapture();
      } else if (audioSourceMode === 'both') {
        await startMicCapture();
        await startTabCapture();
      }
    }
  };

  const handlePauseResume = () => {
    if (!isSessionActive) return;
    if (isPaused) {
      setIsPaused(false);
      setPipelineStatus('listening');
      if (micRecorderRef.current) micRecorderRef.current.resume();
      if (tabRecorderRef.current) tabRecorderRef.current.resume();
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch {}
      }
    } else {
      setIsPaused(true);
      setPipelineStatus('paused');
      if (micRecorderRef.current) micRecorderRef.current.pause();
      if (tabRecorderRef.current) tabRecorderRef.current.pause();
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      setMicAudioLevel(0);
      setTabAudioLevel(0);
    }
  };

  const handleAudioModeChange = async (mode: AudioSourceMode) => {
    setAudioSourceMode(mode);
    setAutoAnswer(true);

    if (isSessionActive) {
      if (mode === 'mic_only') {
        if (tabRecorderRef.current) {
          tabRecorderRef.current.stop();
          tabRecorderRef.current = null;
        }
        if (tabMediaStreamRef.current) {
          tabMediaStreamRef.current.getTracks().forEach(t => t.stop());
          tabMediaStreamRef.current = null;
        }
        setIsTabAudioActive(false);
        setTabAudioLevel(0);
        if (!micRecorderRef.current) {
          await startMicCapture();
        }
      } else if (mode === 'device_only') {
        if (micRecorderRef.current) {
          micRecorderRef.current.stop();
          micRecorderRef.current = null;
        }
        if (micMediaStreamRef.current) {
          micMediaStreamRef.current.getTracks().forEach(t => t.stop());
          micMediaStreamRef.current = null;
        }
        setIsMicReceivingAudio(false);
        setMicAudioLevel(0);
        if (!tabRecorderRef.current) {
          await startTabCapture();
        }
      } else if (mode === 'both') {
        if (!micRecorderRef.current) {
          await startMicCapture();
        }
        if (!tabRecorderRef.current) {
          await startTabCapture();
        }
      }
    }
  };

  return (
    <div className={`min-h-screen text-zinc-100 flex flex-col items-center justify-start font-sans relative ${
      isElectron 
        ? 'bg-transparent p-0 overflow-hidden' 
        : 'bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-2 sm:p-4 overflow-hidden'
    }`}>
      {/* Decorative ambient glowing circles only in standard browser view */}
      {!isElectron && (
        <>
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 right-1/3 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        </>
      )}

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
        onAudioSourceChange={handleAudioModeChange}
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
}
