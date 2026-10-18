import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as Blob | null;
    const source = (formData.get('source') as string) || 'meeting';

    if (!audioFile) {
      return NextResponse.json(
        { error: 'NO_AUDIO_FILE', message: 'No audio file provided in request.' },
        { status: 400 }
      );
    }

    const groqKey = process.env.GROQ_API_KEY;
    const deepgramKey = process.env.DEEPGRAM_API_KEY;
    const openAiKey = process.env.OPENAI_API_KEY;

    // 1. Try Groq Whisper (Ultra-fast ~150ms inference, free tier available)
    if (groqKey) {
      try {
        const groqFormData = new FormData();
        groqFormData.append('file', audioFile, 'meeting_audio.webm');
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
          return NextResponse.json({
            transcript,
            provider: 'groq-whisper',
            source
          });
        } else {
          const errText = await resp.text();
          console.warn('Groq Whisper error:', errText);
        }
      } catch (groqErr) {
        console.warn('Groq Whisper request failed:', groqErr);
      }
    }

    // 2. Try Deepgram Nova-2 if configured
    if (deepgramKey) {
      try {
        const audioBuffer = await audioFile.arrayBuffer();
        const resp = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true', {
          method: 'POST',
          headers: {
            'Authorization': `Token ${deepgramKey}`,
            'Content-Type': audioFile.type || 'audio/webm'
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
              source
            });
          }
          return NextResponse.json({ transcript: '', provider: 'deepgram', source });
        } else {
          const errText = await resp.text();
          console.warn('Deepgram API error:', errText);
        }
      } catch (deepgramErr) {
        console.warn('Deepgram request failed:', deepgramErr);
      }
    }

    // 3. Try OpenAI Whisper if configured
    if (openAiKey) {
      try {
        const whisperFormData = new FormData();
        whisperFormData.append('file', audioFile, 'meeting_audio.webm');
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
          return NextResponse.json({
            transcript,
            provider: 'whisper',
            source
          });
        } else {
          const errText = await resp.text();
          console.warn('OpenAI Whisper error:', errText);
        }
      } catch (whisperErr) {
        console.warn('Whisper request failed:', whisperErr);
      }
    }

    // 4. Local Windows Speech Recognition fallback (100% offline, zero cloud keys needed)
    try {
      const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
      const isWav = audioBuffer.length >= 12 && 
        audioBuffer.toString('utf8', 0, 4) === 'RIFF' && 
        audioBuffer.toString('utf8', 8, 12) === 'WAVE';

      if (isWav) {
        const tempPath = path.join(os.tmpdir(), `echocopilot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.wav`);
        await fs.promises.writeFile(tempPath, audioBuffer);
        const scriptPath = path.join(process.cwd(), 'scripts', 'transcribe-wav.ps1');

        try {
          const { stdout } = await execFileAsync('powershell.exe', [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy', 'Bypass',
            '-File', scriptPath,
            '-WavPath', tempPath
          ], { timeout: 10000 });

          const transcript = (stdout || '').trim();
          return NextResponse.json({
            transcript,
            provider: 'windows-sapi',
            source
          });
        } catch (sapiErr: unknown) {
          console.warn('Local SAPI recognition error:', sapiErr);
          return NextResponse.json({
            transcript: '',
            provider: 'windows-sapi',
            source
          });
        } finally {
          try {
            await fs.promises.unlink(tempPath);
          } catch {}
        }
      } else {
        return NextResponse.json(
          {
            error: 'MISSING_STT_KEY',
            message: 'WebM audio requires a cloud STT key (GROQ_API_KEY, DEEPGRAM_API_KEY, or OPENAI_API_KEY). Use PCM WAV for local offline transcription.',
            source
          },
          { status: 422 }
        );
      }
    } catch (localErr: unknown) {
      console.warn('Local transcription error:', localErr);
      return NextResponse.json({
        error: 'LOCAL_STT_FAILED',
        message: localErr instanceof Error ? localErr.message : 'Local transcription failed',
        source
      }, { status: 500 });
    }

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown transcription error';
    return NextResponse.json({ error: 'SERVER_ERROR', message }, { status: 500 });
  }
}
