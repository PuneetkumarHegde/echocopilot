import { AnswerTriggerPolicy, AudioSourceMode, TranscriptTurn, AudioInputDevice } from './types';

/**
 * Enumerate available microphone/audio input hardware
 */
export async function enumerateAudioInputDevices(): Promise<AudioInputDevice[]> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return [];
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(d => d.kind === 'audioinput');
    return audioInputs.map((d, index) => ({
      deviceId: d.deviceId,
      label: d.label || `Microphone ${index + 1}`,
      groupId: d.groupId
    }));
  } catch (err) {
    console.warn('Failed to enumerate audio devices:', err);
    return [];
  }
}

/**
 * Calculates audio level percentage (0-100) from frequency data array
 */
export function calculateAudioLevel(dataArray: Uint8Array): number {
  if (!dataArray || dataArray.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i];
  }
  const avg = sum / dataArray.length;
  return Math.min(100, Math.round((avg / 128) * 100));
}

/**
 * Normalizes text for comparison and deduplication
 */
export function normalizeQuestionText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether an utterance constitutes a legitimate technical question or prompt
 */
export function isMeaningfulQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 4) return false;

  // Question mark
  if (trimmed.endsWith('?')) return true;

  const lower = trimmed.toLowerCase();

  // Filler utterances to reject (prevents triggering on conversational noises)
  const fillers = [
    'yes', 'yeah', 'yep', 'no', 'okay', 'ok', 'sure', 'right', 'mhm', 'uh', 'um',
    'thanks', 'thank you', 'cool', 'sounds good', 'i see', 'got it', 'hello', 'hi',
    'can you hear me', 'am i audible', 'testing', 'audio check', 'good morning', 'good afternoon',
    'good evening', 'how are you', 'great', 'awesome', 'fine'
  ];
  if (fillers.includes(lower)) return false;

  // Question or prompt keywords
  const questionStarters = [
    'what', 'why', 'how', 'when', 'where', 'explain', 'can you', 'could you', 'tell me',
    'describe', 'define', 'is it', 'are there', 'does', 'do you', 'have you', 'which',
    'difference between', 'difference', 'compare', 'implement', 'design', 'write a', 'write',
    'walk me through', 'solve', 'discuss', 'suppose', 'assume', 'let\'s say', 'what is',
    'what are', 'how do', 'how does', 'how to', 'in your opinion', 'would you', 'give an example'
  ];

  if (questionStarters.some(starter => lower.startsWith(starter) || lower.includes(` ${starter} `))) {
    return true;
  }

  // Technical interview topics that serve as direct problem statements
  const technicalKeywords = [
    'overloading', 'overriding', 'closure', 'event loop', 'deadlock', 'concurrency',
    'b-tree', 'gin index', 'hash map', 'two sum', 'binary search', 'system design',
    'rate limiter', 'microservices', 'cap theorem', 'acid', 'garbage collection',
    'react hooks', 'useeffect', 'dependency injection', 'solid principles', 'rest api',
    'graphql', 'kafka', 'redis', 'lru cache', 'tcp vs udp', 'localhost'
  ];

  return technicalKeywords.some(keyword => lower.includes(keyword));
}

/**
 * Deduplicator to prevent duplicate AI generations from rapid or repeated STT events
 */
export class QuestionDeduplicator {
  private recentQuestions = new Map<string, number>();
  private readonly ttlMs: number;

  constructor(ttlMs: number = 15000) {
    this.ttlMs = ttlMs;
  }

  /**
   * Returns true if question is new, false if duplicate within TTL
   */
  public isNewQuestion(rawText: string): boolean {
    const normalized = normalizeQuestionText(rawText);
    const now = Date.now();

    // Clean up expired items
    for (const [key, timestamp] of this.recentQuestions.entries()) {
      if (now - timestamp > this.ttlMs) {
        this.recentQuestions.delete(key);
      }
    }

    if (this.recentQuestions.has(normalized)) {
      return false; // Duplicate!
    }

    this.recentQuestions.set(normalized, now);
    return true;
  }

  public clear(): void {
    this.recentQuestions.clear();
  }
}

/**
 * Determines whether automatic answer generation is permitted for the given audio mode.
 */
export function isAutoAnswerAllowedForMode(audioMode?: AudioSourceMode): boolean {
  return true; // All modes support automatic answer generation per user specification
}

/**
 * Evaluates whether a transcript turn should trigger an AI answer based on the active audio source mode.
 * 
 * Rules:
 * - MIC mode:
 *   Continuous mic capture. Triggers automatic answer when a meaningful question is spoken into the mic.
 * - DEVICE mode:
 *   Continuous device/interviewer capture. Triggers automatic answer when an interviewer question is detected.
 * - BOTH mode:
 *   Captures mic & device simultaneously as separate sources.
 *   Interviewer questions detected in DEVICE audio (source: 'meeting') AUTOMATICALLY trigger answers!
 *   Candidate responses spoken into MIC (source: 'mic') do NOT trigger automatic answers (prevents feedback loops).
 *   Manual Ask is available as fallback for questions missed by automatic detection.
 * - Manual input:
 *   Always triggers an answer.
 */
export function shouldTriggerAnswer(
  turn: TranscriptTurn,
  audioSourceMode: AudioSourceMode = 'both',
  autoAnswerEnabled: boolean = true
): boolean {
  if (!autoAnswerEnabled) return false;

  // Manual inputs always trigger answers immediately
  if (turn.source === 'manual') return true;

  // 1. MIC Mode:
  // Spoken questions from candidate microphone trigger answers automatically
  if (audioSourceMode === 'mic_only') {
    if (turn.source !== 'mic') return false;
  }

  // 2. DEVICE Mode:
  // Interviewer questions from device/meeting audio trigger answers automatically
  else if (audioSourceMode === 'device_only') {
    if (turn.source !== 'meeting' && turn.speaker !== 'interviewer') return false;
  }

  // 3. BOTH Mode:
  // ONLY interviewer questions from device audio trigger answers automatically!
  // Microphone audio (candidate voice answering aloud) MUST NEVER trigger answers (strictly prevents feedback loops)
  else if (audioSourceMode === 'both') {
    if (turn.source !== 'meeting' && turn.speaker !== 'interviewer') {
      return false;
    }
  }

  // Must be a meaningful question or technical prompt
  return isMeaningfulQuestion(turn.text);
}

/**
 * Friendly error message formatter for Web Audio / MediaDevices DOMExceptions
 */
export function formatAudioErrorMessage(err: unknown): string {
  if (!err) return 'An unknown audio error occurred.';
  const errorObj = err as Error;

  switch (errorObj.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Audio permission was denied. Please click the permissions icon in your browser address bar and allow Microphone / Screen sharing.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No audio input hardware was found. Please ensure your microphone or headset is connected.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Microphone or tab audio is in use by another program. Please close conflicting apps and retry.';
    case 'AbortError':
      return 'Sharing was canceled before completion.';
    case 'OverconstrainedError':
      return 'Your audio device does not support the requested sample rate or channel settings.';
    default:
      return errorObj.message || 'Failed to capture audio stream.';
  }
}
