import sys
import time
from faster_whisper import WhisperModel

print("Loading Whisper base.en on CPU (int8)...")
t0 = time.time()
model = WhisperModel("base.en", device="cpu", compute_type="int8", cpu_threads=4)
print(f"Loaded model in {time.time() - t0:.2f}s")

# Test on a synthesized speech wav
t0 = time.time()
segments, info = model.transcribe("debug_last_chunk.wav", beam_size=1)
text = " ".join([s.text for s in segments]).strip()
elapsed = time.time() - t0
print(f"Inference time: {elapsed:.3f}s")
print(f"Detected language: {info.language} ({info.language_probability:.2f})")
print(f"Transcript: '{text}'")
