"""Generate simple game SFX WAV files under public/audio/ (replaceable)."""
import math
import struct
import wave
from pathlib import Path

OUT = Path(r"E:\XiaomiMiMoProjects\2026-09-28\new-chat-2\voidbreakers\public\audio")
OUT.mkdir(parents=True, exist_ok=True)
SR = 22050


def write_wav(name: str, samples: list[float]) -> None:
    path = OUT / name
    with wave.open(str(path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = b"".join(
            struct.pack("<h", max(-32767, min(32767, int(s * 32767)))) for s in samples
        )
        w.writeframes(frames)
    print("wrote", path.name, len(samples))


def env(i: int, n: int, a: float = 0.01, r: float = 0.6) -> float:
    t = i / max(1, n)
    if t < a:
        return t / a
    return max(0.0, (1 - t) ** 2 * (1 - r) + r * max(0.0, 1 - t * 3))


def tone(freq0: float, freq1: float, dur: float, vol: float = 0.5, wave_type: str = "sine") -> list[float]:
    n = int(SR * dur)
    out = []
    for i in range(n):
        t = i / SR
        f = freq0 + (freq1 - freq0) * (i / max(1, n))
        phase = 2 * math.pi * f * t
        if wave_type == "square":
            s = 1.0 if math.sin(phase) >= 0 else -1.0
        elif wave_type == "saw":
            s = 2 * ((f * t) % 1.0) - 1.0
        elif wave_type == "tri":
            s = 2 * abs(2 * ((f * t) % 1.0) - 1) - 1
        else:
            s = math.sin(phase)
        out.append(s * vol * env(i, n))
    return out


def noise(dur: float, vol: float = 0.4, lp: float = 0.3) -> list[float]:
    n = int(SR * dur)
    out = []
    prev = 0.0
    seed = 1
    for i in range(n):
        seed = (seed * 16807) % 2147483647
        raw = (seed / 2147483647) * 2 - 1
        prev = prev * (1 - lp) + raw * lp
        out.append(prev * vol * env(i, n, 0.005, 0.85))
    return out


def mix(*parts: list[float]) -> list[float]:
    n = max(len(p) for p in parts)
    out = [0.0] * n
    for p in parts:
        for i, s in enumerate(p):
            out[i] += s
    return out


def write(name: str, samples: list[float]) -> None:
    # normalize
    peak = max(0.001, max(abs(s) for s in samples))
    scale = 0.9 / peak
    write_wav(name, [s * scale for s in samples])


# weapons
write("shoot_scatter.wav", mix(tone(520, 180, 0.07, 0.45, "square"), noise(0.05, 0.2, 0.5)))
write("shoot_lance.wav", mix(tone(1200, 2400, 0.12, 0.35, "sine"), tone(400, 800, 0.1, 0.2, "tri")))
write("shoot_homing.wav", mix(tone(220, 480, 0.18, 0.4, "tri"), noise(0.12, 0.15, 0.2)))
write("shoot_blackhole.wav", mix(tone(90, 40, 0.35, 0.55, "sine"), noise(0.3, 0.2, 0.15), tone(55, 30, 0.4, 0.25, "tri")))
write("shoot_missile.wav", mix(tone(300, 120, 0.16, 0.45, "saw"), noise(0.14, 0.25, 0.35)))
write("shoot_reflect.wav", mix(tone(1400, 900, 0.08, 0.35, "sine"), tone(2100, 1400, 0.06, 0.2, "sine")))

# impacts
write("hit.wav", mix(tone(180, 60, 0.08, 0.4, "tri"), noise(0.06, 0.3, 0.55)))
write("hit_soft.wav", tone(400, 200, 0.05, 0.25, "sine"))
write("explode.wav", mix(noise(0.35, 0.55, 0.25), tone(120, 40, 0.3, 0.45, "tri"), tone(70, 28, 0.4, 0.3, "sine")))
write("explode_big.wav", mix(noise(0.55, 0.65, 0.2), tone(90, 30, 0.5, 0.55, "tri")))

# secondaries
write("orbit.wav", mix(tone(600, 900, 0.12, 0.28, "sine"), tone(900, 600, 0.1, 0.18, "tri")))
write("secondary_missile.wav", mix(tone(260, 520, 0.2, 0.4, "saw"), noise(0.15, 0.2, 0.3)))
write("nova.wav", mix(tone(180, 40, 0.35, 0.5, "sine"), noise(0.25, 0.3, 0.2)))
write("turret.wav", tone(700, 350, 0.06, 0.35, "square"))

# ui / player
write("pickup.wav", mix(tone(660, 990, 0.1, 0.35, "sine"), tone(990, 1320, 0.12, 0.28, "sine")))
write("hurt.wav", mix(tone(160, 70, 0.18, 0.45, "saw"), noise(0.1, 0.2, 0.4)))
write("dash.wav", mix(tone(320, 720, 0.12, 0.35, "tri"), noise(0.08, 0.15, 0.3)))
write("wave.wav", mix(tone(392, 523, 0.16, 0.35, "sine"), tone(523, 659, 0.18, 0.3, "sine")))
write("gameover.wav", mix(tone(220, 80, 0.35, 0.45, "saw"), tone(160, 55, 0.45, 0.35, "tri")))
write("shield_break.wav", mix(tone(900, 200, 0.25, 0.4, "sine"), noise(0.2, 0.25, 0.3)))

print("done", OUT)
