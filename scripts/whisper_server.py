import sys
import os
import json
import time
import io
from http.server import HTTPServer, BaseHTTPRequestHandler
from faster_whisper import WhisperModel

PORT = 5001
HOST = "127.0.0.1"

print(f"[Whisper Server] Initializing Faster-Whisper base.en on CPU (int8)...")
t0 = time.time()
model = WhisperModel("base.en", device="cpu", compute_type="int8", cpu_threads=4)
print(f"[Whisper Server] Model loaded in {time.time() - t0:.2f}s. Ready for real-time transcription.")

class WhisperHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Clean server logging
        sys.stdout.write(f"[Whisper Server] {args[0]} - {args[1]} {args[2]}\n")

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "model": "base.en"}).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/transcribe":
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length == 0:
                self.send_response(400)
                self.end_headers()
                return

            audio_data = self.rfile.read(content_length)
            t_start = time.time()
            try:
                # Transcribe from memory buffer
                audio_file = io.BytesIO(audio_data)
                segments, info = model.transcribe(audio_file, beam_size=1)
                text = " ".join([s.text for s in segments]).strip()
                elapsed = time.time() - t_start

                response = {
                    "transcript": text,
                    "language": info.language,
                    "confidence": info.language_probability,
                    "durationSec": round(info.duration, 2),
                    "inferenceSec": round(elapsed, 3)
                }
                print(f"[Whisper Server] Transcribed in {elapsed:.3f}s: '{text}'")

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(response).encode("utf-8"))

            except Exception as e:
                print(f"[Whisper Server] Transcription error: {e}")
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

def run():
    server = HTTPServer((HOST, PORT), WhisperHandler)
    print(f"[Whisper Server] Listening on http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Whisper Server] Shutting down...")
        server.server_close()

if __name__ == "__main__":
    run()
