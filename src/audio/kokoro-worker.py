"""Persistent Kokoro-82M worker (kokoro-onnx, CPU) for Series Forge Studio.

Protocol: one JSON object per line on stdin, one JSON reply per line on stdout.
  request:  {"id": "...", "text": "...", "voice": "ef_dora" | "ef_dora:0.8+af_bella:0.2", "speed": 1.0, "lang": "es", "out": "C:/.../x.wav"}
  reply:    {"id": "...", "ok": true, "sampleRate": 24000, "duration": 2.31} | {"id": "...", "ok": false, "error": "..."}
  special:  {"id": "...", "listVoices": true} -> {"id": "...", "ok": true, "voices": [...]}

"[pausa N]" markers in the text become N seconds of silence. Nothing is downloaded at runtime: the model files
must already exist (tools/kokoro/kokoro-v1.0.onnx and voices-v1.0.bin, see docs/GUIDE.md).
Model: hexgrad/Kokoro-82M (Apache-2.0). Runtime: kokoro-onnx (MIT), onnxruntime (MIT), espeak-ng (GPL-3.0, phonemizer).
"""
import json
import os
import re
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

MODEL_DIR = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "tools", "kokoro")
kokoro = Kokoro(os.path.join(MODEL_DIR, "kokoro-v1.0.onnx"), os.path.join(MODEL_DIR, "voices-v1.0.bin"))
VOICES = set(kokoro.get_voices())
PAUSE = re.compile(r"\[pausa\s+([0-9.]+)\]", re.I)


def style_for(spec: str):
    """'ef_dora' or a weighted blend 'ef_dora:0.8+af_bella:0.2' (weights are normalised)."""
    parts = []
    for chunk in spec.split("+"):
        name, _, w = chunk.strip().partition(":")
        if name not in VOICES:
            raise ValueError(f"voz Kokoro desconocida: {name}")
        parts.append((name, float(w) if w else 1.0))
    if len(parts) == 1:
        return parts[0][0]
    total = sum(w for _, w in parts) or 1.0
    return sum(kokoro.get_voice_style(n) * (w / total) for n, w in parts)


def synth(req):
    voice = style_for(str(req["voice"]))
    speed = max(0.5, min(2.0, float(req.get("speed", 1.0))))
    lang = str(req.get("lang", "es"))
    text = str(req["text"])
    chunks, sr = [], 24000
    pos = 0
    for m in list(PAUSE.finditer(text)) + [None]:
        seg = text[pos:m.start()] if m else text[pos:]
        if seg.strip():
            samples, sr = kokoro.create(seg.strip(), voice=voice, speed=speed, lang=lang)
            chunks.append(np.asarray(samples, dtype=np.float32))
        if m:
            chunks.append(np.zeros(int(float(m.group(1)) * sr), dtype=np.float32))
            pos = m.end()
    if not chunks:
        raise ValueError("texto vacío")
    audio = np.concatenate(chunks)
    out = str(req["out"])
    sf.write(out, audio, sr, subtype="FLOAT")
    return {"sampleRate": sr, "duration": len(audio) / sr}


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stdin.reconfigure(encoding="utf-8")
    print(json.dumps({"ready": True, "voices": sorted(VOICES)}), flush=True)
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        rid = None
        try:
            req = json.loads(line)
            rid = req.get("id")
            if req.get("listVoices"):
                reply = {"voices": sorted(VOICES)}
            else:
                reply = synth(req)
            print(json.dumps({"id": rid, "ok": True, **reply}), flush=True)
        except Exception as e:  # reported back to Node, never fatal for the worker
            print(json.dumps({"id": rid, "ok": False, "error": str(e)[:500]}), flush=True)


if __name__ == "__main__":
    main()
