import sys
import os

if len(sys.argv) < 2:
    sys.exit(0)

wav_path = sys.argv[1]
if not os.path.exists(wav_path):
    sys.exit(0)

try:
    from faster_whisper import WhisperModel
    model = WhisperModel("base.en", device="cpu", compute_type="int8", cpu_threads=4)
    segments, info = model.transcribe(wav_path, beam_size=1)
    text = " ".join([s.text for s in segments]).strip()
    print(text)
except Exception as e:
    sys.stderr.write(str(e) + "\n")
    sys.exit(1)
