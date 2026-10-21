import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { normalizeTechnicalTerms } from '@/lib/technicalTermNormalizer';

const execFileAsync = promisify(execFile);

function analyzeWavBuffer(buf: Buffer) {
  if (buf.length < 44) return { valid: false, reason: 'Buffer too small', durationSec: 0, maxPeak: 0, rms: 0, isAudible: false };
  try {
    const channels = buf.readUInt16LE(22);
    const sampleRate = buf.readUInt32LE(24);
    const bitsPerSample = buf.readUInt16LE(34);
    const numSamples = Math.floor((buf.length - 44) / (bitsPerSample === 16 ? 2 : 1));
    const durationSec = sampleRate > 0 && channels > 0 ? (numSamples / (sampleRate * channels)) : 0;

    let maxPeak = 0;
    let sumSquares = 0;
    if (bitsPerSample === 16) {
      for (let i = 44; i < buf.length - 1; i += 2) {
        const sample = buf.readInt16LE(i) / 32768.0;
        const abs = Math.abs(sample);
        if (abs > maxPeak) maxPeak = abs;
        sumSquares += sample * sample;
      }
    }
    const rms = numSamples > 0 ? Math.sqrt(sumSquares / numSamples) : 0;
    // Real audible speech typically has a peak >= 0.015 and rms >= 0.001
    const isAudible = maxPeak >= 0.015 && rms >= 0.001;

    return {
      valid: true,
      channels,
      sampleRate,
      bitsPerSample,
      durationSec: Number(durationSec.toFixed(2)),
      samplesCount: numSamples,
      maxPeak: Number(maxPeak.toFixed(4)),
      rms: Number(rms.toFixed(5)),
      isAudible
    };
  } catch (err) {
    return { valid: false, reason: String(err), durationSec: 0, maxPeak: 0, rms: 0, isAudible: false };
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as Blob | null;
    const source = (formData.get('source') as string) || 'mic';
    const clientKey = (formData.get('apiKey') as string | null)?.trim();

    if (!audioFile) {
      return NextResponse.json(
        { error: 'NO_AUDIO_FILE', message: 'No audio file provided in request.' },
        { status: 400 }
      );
    }

    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    const isWav = audioBuffer.length >= 12 && 
      audioBuffer.toString('utf8', 0, 4) === 'RIFF' && 
      audioBuffer.toString('utf8', 8, 12) === 'WAVE';

    const metrics = isWav ? analyzeWavBuffer(audioBuffer) : null;
    console.log(`[Transcribe API] Incoming audio: source=${source}, size=${audioBuffer.length} bytes, isWav=${isWav}` +
      (metrics ? `, duration=${metrics.durationSec}s, peak=${metrics.maxPeak}, rms=${metrics.rms}, isAudible=${metrics.isAudible}` : ''));

    // Save latest chunk to temporary debug file for inspection
    try {
      if (isWav) {
        const debugWavPath = path.join(os.tmpdir(), 'debug_last_chunk.wav');
        await fs.promises.writeFile(debugWavPath, audioBuffer);
      }
      const logLine = `[${new Date().toISOString()}] source=${source} size=${audioBuffer.length} ` +
        (metrics ? `dur=${metrics.durationSec}s peak=${metrics.maxPeak} rms=${metrics.rms} audible=${metrics.isAudible}` : 'non-wav') + '\n';
      await fs.promises.appendFile(path.join(os.tmpdir(), 'transcribe_debug.log'), logLine);
    } catch {}

    const groqKey = (clientKey && clientKey.startsWith('gsk_')) ? clientKey : process.env.GROQ_API_KEY;
    const openAiKey = (clientKey && clientKey.startsWith('sk-')) ? clientKey : process.env.OPENAI_API_KEY;
    const deepgramKey = process.env.DEEPGRAM_API_KEY;

    const audioBlob = new Blob([audioBuffer], { type: isWav ? 'audio/wav' : 'audio/webm' });
    const audioFileName = isWav ? 'speech.wav' : 'speech.webm';

    // 1. Try Groq Whisper (Ultra-fast ~150ms inference, highest accuracy)
    if (groqKey) {
      try {
        const groqFormData = new FormData();
        groqFormData.append('file', audioBlob, audioFileName);
        groqFormData.append('model', 'whisper-large-v3-turbo');
        groqFormData.append('language', 'en');

        const resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`
          },
          body: groqFormData
        });

        if (resp.ok) {
          const data = await resp.json();
          const transcript = data.text?.trim() || '';
          if (transcript) {
            return NextResponse.json({
              transcript,
              provider: 'groq-whisper',
              source,
              metrics
            });
          }
        } else {
          const errText = await resp.text();
          console.warn('[Transcribe API] Groq Whisper error:', errText);
        }
      } catch (groqErr) {
        console.warn('[Transcribe API] Groq Whisper request failed:', groqErr);
      }
    }

    // 2. Try OpenAI Whisper if configured
    if (openAiKey) {
      try {
        const whisperFormData = new FormData();
        whisperFormData.append('file', audioBlob, audioFileName);
        whisperFormData.append('model', 'whisper-1');
        whisperFormData.append('language', 'en');

        const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAiKey}`
          },
          body: whisperFormData
        });

        if (resp.ok) {
          const data = await resp.json();
          const transcript = data.text?.trim() || '';
          if (transcript) {
            return NextResponse.json({
              transcript,
              provider: 'openai-whisper',
              source,
              metrics
            });
          }
        } else {
          const errText = await resp.text();
          console.warn('[Transcribe API] OpenAI Whisper error:', errText);
        }
      } catch (whisperErr) {
        console.warn('[Transcribe API] Whisper request failed:', whisperErr);
      }
    }

    // 3. Try Deepgram Nova-2 if configured
    if (deepgramKey) {
      try {
        const resp = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true', {
          method: 'POST',
          headers: {
            'Authorization': `Token ${deepgramKey}`,
            'Content-Type': isWav ? 'audio/wav' : 'audio/webm'
          },
          body: audioBuffer
        });

        if (resp.ok) {
          const data = await resp.json();
          const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim();
          if (transcript) {
            return NextResponse.json({
              transcript,
              confidence: data.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0.9,
              provider: 'deepgram',
              source,
              metrics
            });
          }
        }
      } catch (deepgramErr) {
        console.warn('[Transcribe API] Deepgram request failed:', deepgramErr);
      }
    }

    // 4. Local Faster-Whisper (100% Offline & Private, Neural Accuracy, sub-500ms latency)
    if (isWav) {
      // 4A. Local Faster-Whisper Daemon on http://127.0.0.1:5001/transcribe
      try {
        const whisperRes = await fetch('http://127.0.0.1:5001/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'audio/wav' },
          body: audioBuffer,
          signal: AbortSignal.timeout(3500)
        });
        if (whisperRes.ok) {
          const whisperData = await whisperRes.json();
          const transcript = (whisperData.transcript || '').trim();
          console.log(`[Transcribe API] Local Faster-Whisper daemon transcript (${whisperData.inferenceSec}s): "${transcript}"`);
          return NextResponse.json({
            transcript,
            provider: 'local-whisper',
            source,
            metrics,
            reason: transcript ? 'SUCCESS' : (metrics && !metrics.isAudible ? 'AUDIO_SILENT' : 'NO_SPEECH_RECOGNIZED'),
            debug: {
              inferenceSec: whisperData.inferenceSec
            }
          });
        }
      } catch {
        // Daemon not running or timed out, proceed to CLI or SAPI
      }

      // 4B. Local Faster-Whisper CLI fallback
      const tempPath = path.join(os.tmpdir(), `echocopilot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.wav`);
      const startTime = Date.now();
      try {
        await fs.promises.writeFile(tempPath, audioBuffer);

        const cliScriptPath = path.join(process.cwd(), 'scripts', 'transcribe.py');
        if (fs.existsSync(cliScriptPath)) {
          try {
            const { stdout } = await execFileAsync('py', ['-3.12', cliScriptPath, tempPath], { timeout: 6000 });
            const transcript = (stdout || '').trim();
            if (transcript.length >= 2) {
              const elapsedMs = Date.now() - startTime;
              console.log(`[Transcribe API] Local Faster-Whisper CLI transcript in ${elapsedMs}ms: "${transcript}"`);
              return NextResponse.json({
                transcript,
                provider: 'local-whisper-cli',
                source,
                metrics,
                reason: 'SUCCESS',
                debug: { elapsedMs }
              });
            }
          } catch {}
        }

        // 4C. Windows Native SAPI fallback (Windows only)
        if (process.platform === 'win32') {
          const scriptPath = path.join(process.cwd(), 'scripts', 'transcribe-wav.ps1');

          console.log(`[Transcribe API] Spawning SAPI transcription: script=${scriptPath}, tempWav=${tempPath} (${audioBuffer.length} bytes)`);

          const { stdout, stderr } = await execFileAsync('powershell.exe', [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy', 'Bypass',
            '-File', scriptPath,
            '-WavPath', tempPath
          ], { timeout: 8000 });

          const elapsedMs = Date.now() - startTime;
          const rawTranscript = (stdout || '').trim();
          const errOutput = (stderr || '').trim();
          console.log(`[Transcribe API] SAPI finished in ${elapsedMs}ms. Transcript: "${rawTranscript}"` + (errOutput ? `, Stderr: "${errOutput}"` : ''));

          const transcript = rawTranscript.length >= 2 ? rawTranscript : '';
          const reason = transcript 
            ? 'SUCCESS' 
            : (metrics && !metrics.isAudible ? 'AUDIO_SILENT' : 'NO_SPEECH_RECOGNIZED');

          // Log completion to debug log
          try {
            const resultLog = `[${new Date().toISOString()}] SAPI result in ${elapsedMs}ms: "${transcript}" reason=${reason}\n`;
            await fs.promises.appendFile(path.join(os.tmpdir(), 'transcribe_debug.log'), resultLog);
          } catch {}

          const normResult = normalizeTechnicalTerms(transcript);

          return NextResponse.json({
            transcript: normResult.normalizedText,
            rawTranscript: transcript,
            corrections: normResult.corrections,
            provider: 'windows-sapi',
            source,
            metrics,
            reason,
            debug: {
              sapiElapsedMs: elapsedMs,
              stderr: errOutput || undefined,
              normalizationLatencyMs: normResult.latencyMs
            }
          });
        }
      } catch (sapiErr: unknown) {
        const elapsedMs = Date.now() - startTime;
        console.warn(`[Transcribe API] Local SAPI recognition error after ${elapsedMs}ms:`, sapiErr);
        try {
          const errLog = `[${new Date().toISOString()}] SAPI ERROR after ${elapsedMs}ms: ${String(sapiErr)}\n`;
          await fs.promises.appendFile(path.join(os.tmpdir(), 'transcribe_debug.log'), errLog);
        } catch {}
        return NextResponse.json({
          transcript: '',
          provider: 'windows-sapi',
          source,
          metrics,
          error: 'SAPI_EXEC_ERROR',
          reason: 'EXECUTION_FAILED',
          message: sapiErr instanceof Error ? sapiErr.message : String(sapiErr)
        });
      } finally {
        try {
          await fs.promises.unlink(tempPath);
        } catch {}
      }
    }

    // If WebM and no cloud keys
    return NextResponse.json(
      {
        transcript: '',
        error: 'MISSING_STT_KEY',
        message: 'WebM audio requires a cloud STT key (GROQ_API_KEY or OPENAI_API_KEY). PCM WAV is used for local offline transcription.',
        source
      },
      { status: 200 }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown transcription error';
    return NextResponse.json({ error: 'SERVER_ERROR', message }, { status: 500 });
  }
}
