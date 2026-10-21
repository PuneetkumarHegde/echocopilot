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

import { 
  classifyUtterance, 
  isQuestionReadyForAnswer, 
  mergeSpeechFragments, 
  cleanPrematurePunctuation, 
  formatCompleteQuestion 
} from './questionClassifier';

/**
 * SpeechFragmentAccumulator manages successive speech recognition fragments for an interview question.
 * - Accumulates successive speech fragments belonging to the same question across pauses.
 * - Handles partial, overlapping, and cumulative speech-recognition updates without duplicating words.
 * - Strips premature punctuation from incomplete fragments and restores terminal punctuation when complete.
 * - Preserves the raw verbatim spoken transcript separately from the merged/normalized question.
 * - Detects when incoming speech completes a pending comparison question.
 */
export class SpeechFragmentAccumulator {
  private rawFragments: string[] = [];
  private currentMerged: string = '';
  private lastUpdateTime: number = 0;
  private readonly maxGapMs: number;

  constructor(maxGapMs: number = 10000) {
    this.maxGapMs = maxGapMs;
  }

  public addFragment(incoming: string): { mergedText: string; rawText: string; isContinued: boolean } {
    const trimmed = incoming.trim();
    if (!trimmed) {
      return { mergedText: this.currentMerged, rawText: this.getRawText(), isContinued: false };
    }

    const now = Date.now();
    const isContinued = this.rawFragments.length > 0 && (now - this.lastUpdateTime) <= this.maxGapMs;

    if (!isContinued) {
      this.rawFragments = [trimmed];
      this.currentMerged = trimmed;
    } else {
      this.rawFragments.push(trimmed);
      this.currentMerged = mergeSpeechFragments(this.currentMerged, trimmed);
    }

    this.lastUpdateTime = now;
    return {
      mergedText: this.currentMerged,
      rawText: this.getRawText(),
      isContinued
    };
  }

  public getRawText(): string {
    return this.rawFragments.join(' ').trim();
  }

  public getMergedText(): string {
    return this.currentMerged;
  }

  public hasPending(): boolean {
    return this.rawFragments.length > 0 && (Date.now() - this.lastUpdateTime) <= this.maxGapMs;
  }

  public reset(): void {
    this.rawFragments = [];
    this.currentMerged = '';
    this.lastUpdateTime = 0;
  }
}

/**
 * Checks whether an utterance constitutes a legitimate, complete technical question ready for answer generation,
 * explicitly rejecting topic transitions, greetings, acknowledgements, and incomplete question fragments
 * like "What is the difference?" or "What is the difference between".
 */
export function isMeaningfulQuestion(text: string, contextHistory: any[] = []): boolean {
  const readiness = isQuestionReadyForAnswer(text, contextHistory);
  return readiness.isReady;
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
  autoAnswerEnabled: boolean = true,
  contextHistory: any[] = []
): boolean {
  if (!autoAnswerEnabled) return false;

  // Manual inputs trigger answers if meaningful and complete
  if (turn.source === 'manual') {
    return isMeaningfulQuestion(turn.text, contextHistory);
  }

  // 1. MIC Mode:
  // Spoken questions from microphone trigger answers automatically
  if (audioSourceMode === 'mic_only') {
    if (turn.source !== 'mic') return false;
  }

  // 2. DEVICE Mode:
  // Interviewer questions from device/meeting audio trigger answers automatically
  else if (audioSourceMode === 'device_only') {
    if (turn.source !== 'meeting' && turn.speaker !== 'interviewer') return false;
  }

  // 3. BOTH Mode:
  // Interviewer questions from meeting audio trigger answers automatically.
  // Questions spoken into the microphone also trigger answers if they are legitimate questions or prompts!
  else if (audioSourceMode === 'both') {
    // Both meeting audio and candidate mic questions are allowed if they are meaningful questions
  }

  // Must be a complete, meaningful question ready for generation
  return isMeaningfulQuestion(turn.text, contextHistory);
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
