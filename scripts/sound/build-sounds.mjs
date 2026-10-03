/**
 * 정원 동물 효과음 합성 — 외부 음원 없이 코드로 만든다 (공개 레포라 라이선스가 확실한 쪽이 이것뿐이다).
 *
 *   node scripts/sound/build-sounds.mjs        → assets/sounds/*.wav (24kHz · 16bit · 모노)
 *   node scripts/sound/inspect-sounds.mjs      → 길이 · 최대치 · 클리핑 · 무음 점검 (+ --spectrogram 이름)
 *
 * 만드는 방식
 *  · 동물 소리 = "포먼트 가산 합성": 피치 곡선(f0)을 따라 배음을 쌓고, 모음의 공명대(포먼트)가 배음 세기를 모양낸다.
 *    야옹(고양이)은 /이/ → /아/ → /오/로 열렸다 닫히는 포먼트 이동, 낑낑(강아지 슬픔)은 흔들리는 높은 /이/, 토끼는 작고 높은 찍 소리
 *  · 먹는 소리 = 대역 필터를 건 잡음 터짐(바삭) + 낮은 툭, 알 두드림 = 떨어지는 사인 + 클릭, 부화 = 잡음 금 + 종소리 아르페지오
 *  · 모든 소리는 같은 최대 음량으로 맞추고(−2dB) 양 끝을 짧게 줄여 클릭 잡음을 막는다
 *
 * 한계: 만든 사람(AI)은 귀로 들을 수 없다 — 스펙트로그램으로 피치 · 포먼트 모양만 확인했다. 귀여운지는 직접 들어 보고 `preview/sound`에서 고른다.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "assets", "sounds");
export const SR = 24000;
const TAU = Math.PI * 2;

/* ── 도구 ─────────────────────────────────────────────── */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (x) => x * x * (3 - 2 * x);
/** 꺾은선 곡선 [[시각, 값], …] — 구간 사이는 부드럽게 보간 */
const curve = (pts) => (t) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) {
      const [t0, v0] = pts[i - 1], [t1, v1] = pts[i];
      return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
    }
  }
  return pts[pts.length - 1][1];
};
const buf = (dur) => new Float32Array(Math.round(dur * SR));
/** 대역 통과 필터 (RBJ 바이쿼드) — 잡음을 소리 색으로 만든다 */
function bandpass(fc, q) {
  const w0 = (TAU * fc) / SR, alpha = Math.sin(w0) / (2 * q), cos = Math.cos(w0);
  const b0 = alpha, b2 = -alpha, a0 = 1 + alpha, a1 = -2 * cos, a2 = 1 - alpha;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => {
    const y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}
function highpass(fc) {
  const rc = 1 / (TAU * fc), dt = 1 / SR, a = rc / (rc + dt);
  let py = 0, px = 0;
  return (x) => { py = a * (py + x - px); px = x; return py; };
}
/** 버퍼 b에 src를 start초부터 더한다 */
function mixInto(b, src, start, gain = 1) {
  const o = Math.round(start * SR);
  for (let i = 0; i < src.length && o + i < b.length; i++) if (o + i >= 0) b[o + i] += src[i] * gain;
}

/* ── 동물 목소리: 포먼트 가산 합성 ────────────────────────── */
function voice({ dur, f0, formants, amp, vibrato = [0, 0], tremolo = [0, 0], breath = 0, rough = 0, tilt = 1.2, seed = 1 }) {
  const out = buf(dur);
  const r = rng(seed);
  const noiseBP = bandpass(2600, 0.9);
  let phase = 0, jit = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    jit += (r() - 0.5) * 0.0008 - jit * 0.002; // 느린 떨림 — 기계처럼 매끈하지 않게
    const f = f0(t) * (1 + vibrato[1] * Math.sin(TAU * vibrato[0] * t) + jit);
    phase += (TAU * f) / SR;
    const K = Math.max(1, Math.min(48, Math.floor((SR * 0.45) / f)));
    const fm = formants.map(([fc, bw, g]) => [fc(t), bw, g]);
    let s = 0;
    for (let k = 1; k <= K; k++) {
      const hf = k * f;
      let g = 0.5 / Math.pow(k, tilt);
      for (const [fc, bw, gain] of fm) g += gain * Math.exp(-0.5 * ((hf - fc) / bw) ** 2);
      s += g * Math.sin(k * phase);
    }
    let a = amp(t) * (1 + tremolo[1] * Math.sin(TAU * tremolo[0] * t));
    if (rough > 0) a *= 1 - rough * (0.5 + 0.5 * Math.sin(TAU * 62 * t)); // 짖을 때의 거친 결 (AM)
    out[i] = s * a + noiseBP((r() - 0.5) * 2) * breath * amp(t);
  }
  return out;
}

/* ── 타악 · 종 ────────────────────────────────────────── */
function crunch(seed, tone = 1) {
  const r = rng(seed);
  const out = buf(0.14);
  const bp = bandpass((1700 + r() * 1500) * tone, 1.3);
  const bp2 = bandpass((4200 + r() * 1500) * tone, 1.8);
  const second = 0.012 + r() * 0.01; // 바삭 — 아주 짧은 간격의 두 번 깨짐
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const e1 = t < 0.002 ? t / 0.002 : Math.exp(-(t - 0.002) / 0.022);
    const t2 = t - second;
    const e2 = t2 < 0 ? 0 : (t2 < 0.002 ? t2 / 0.002 : Math.exp(-(t2 - 0.002) / 0.03)) * 0.7;
    const n = r() * 2 - 1;
    out[i] = bp(n) * e1 * 2.2 + bp2(n) * e2 * 1.3 + Math.sin(TAU * (130 - 60 * t * 6) * t) * Math.exp(-t / 0.018) * 0.55;
  }
  return out;
}
function bell(freq, dur, gain = 1) {
  const out = buf(dur);
  const partials = [[1, 1, 0.55], [2.76, 0.45, 0.3], [5.4, 0.2, 0.15], [0.5, 0.25, 0.7]];
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let s = 0;
    for (const [m, g, tau] of partials) s += g * Math.sin(TAU * freq * m * t) * Math.exp(-t / tau);
    out[i] = s * (t < 0.004 ? t / 0.004 : 1) * gain;
  }
  return out;
}
function knock(seed, f = 260) {
  const r = rng(seed);
  const out = buf(0.16);
  const bp = bandpass(1400, 1.5);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const fr = f * (0.62 + 0.38 * Math.exp(-t / 0.03));
    out[i] = Math.sin(TAU * fr * t) * Math.exp(-t / 0.04) * 0.9 + bp(r() * 2 - 1) * Math.exp(-t / 0.004) * 1.4;
  }
  return out;
}
function crackle(seed, dur) {
  const r = rng(seed);
  const out = buf(dur);
  const hp = highpass(1800);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const burst = r() < 0.012 ? 1 : 0; // 불규칙한 잔금 소리
    out[i] = hp((r() * 2 - 1) * 0.12 + burst * (r() * 2 - 1) * 1.6) * Math.exp(-t / (dur * 0.5));
  }
  return out;
}

/* ── 소리 정의 ────────────────────────────────────────── */
const C = (pts) => curve(pts);
const sounds = {
  /** 고양이 — 기분 좋은 "미야옹": /이/ → /아/ → /오/ */
  cat_happy: () => voice({
    dur: 0.66, seed: 11,
    f0: C([[0, 430], [0.06, 560], [0.17, 830], [0.32, 790], [0.5, 640], [0.66, 520]]),
    formants: [
      [C([[0, 350], [0.13, 800], [0.32, 820], [0.52, 520]]), 180, 3.2],
      [C([[0, 2400], [0.13, 1500], [0.32, 1380], [0.55, 950]]), 260, 2.2],
      [C([[0, 3200], [0.66, 2800]]), 400, 0.7],
    ],
    amp: C([[0, 0], [0.03, 0.9], [0.2, 1], [0.46, 0.78], [0.62, 0.15], [0.66, 0]]),
    vibrato: [6, 0.014], breath: 0.05, tilt: 1.4,
  }),
  /** 고양이 — 시무룩한 "야아…": 느리게 내려앉는다 */
  cat_sad: () => voice({
    dur: 0.95, seed: 12,
    f0: C([[0, 600], [0.16, 730], [0.42, 640], [0.72, 470], [0.95, 380]]),
    formants: [
      [C([[0, 760], [0.9, 520]]), 200, 3.0],
      [C([[0, 1300], [0.9, 900]]), 240, 2.0],
      [C([[0, 2600], [0.9, 2300]]), 400, 0.6],
    ],
    amp: C([[0, 0], [0.07, 0.8], [0.4, 0.9], [0.8, 0.5], [0.95, 0]]),
    vibrato: [5.5, 0.035], tremolo: [5.5, 0.1], breath: 0.07, tilt: 1.5,
  }),
  /** 강아지 — 신나는 "왈왈" 두 번 */
  dog_happy: () => {
    const yip = (seed, hi) => voice({
      dur: 0.19, seed,
      f0: C([[0, 480 * hi], [0.03, 560 * hi], [0.19, 330 * hi]]),
      formants: [
        [C([[0, 600], [0.19, 520]]), 170, 3.4],
        [C([[0, 1150], [0.19, 1000]]), 230, 2.4],
        [C([[0, 2600], [0.19, 2300]]), 380, 0.9],
      ],
      amp: C([[0, 0], [0.012, 1], [0.1, 0.8], [0.19, 0]]),
      rough: 0.22, breath: 0.1, tilt: 1.0,
    });
    const out = buf(0.5);
    mixInto(out, yip(21, 1), 0);
    mixInto(out, yip(22, 1.08), 0.25, 0.95);
    return out;
  },
  /** 강아지 — 낑낑: 흔들리는 높은 /이/ */
  dog_sad: () => voice({
    dur: 0.9, seed: 23,
    f0: C([[0, 520], [0.12, 760], [0.3, 990], [0.52, 860], [0.9, 560]]),
    formants: [
      [C([[0, 380], [0.9, 450]]), 150, 3.0],
      [C([[0, 2300], [0.9, 1900]]), 280, 2.6],
      [C([[0, 3300], [0.9, 3000]]), 400, 0.8],
    ],
    amp: C([[0, 0], [0.05, 0.85], [0.5, 0.9], [0.82, 0.4], [0.9, 0]]),
    vibrato: [7, 0.05], tremolo: [7, 0.16], breath: 0.09, tilt: 1.3,
  }),
  /** 토끼 — 작고 높은 "찍찍" */
  rabbit_happy: () => {
    const sq = (seed, hi, dur) => voice({
      dur, seed,
      f0: C([[0, 1500 * hi], [0.05, 2300 * hi], [dur, 1900 * hi]]),
      formants: [
        [C([[0, 1000], [dur, 1200]]), 300, 3.0],
        [C([[0, 3000], [dur, 3300]]), 500, 1.6],
      ],
      amp: C([[0, 0], [0.012, 1], [dur * 0.6, 0.7], [dur, 0]]),
      breath: 0.04, tilt: 1.6,
    });
    const out = buf(0.46);
    mixInto(out, sq(31, 1, 0.2), 0);
    mixInto(out, sq(32, 1.1, 0.14), 0.25, 0.85);
    return out;
  },
  /** 토끼 — 힘없는 한숨(푸우…) + 가는 낑 */
  rabbit_sad: () => {
    const out = buf(0.7);
    const r = rng(33);
    const bp = bandpass(1900, 0.8);
    for (let i = 0; i < out.length; i++) {
      const t = i / SR;
      out[i] = bp(r() * 2 - 1) * 0.9 * C([[0, 0], [0.12, 0.5], [0.3, 1], [0.7, 0]])(t);
    }
    mixInto(out, voice({
      dur: 0.5, seed: 34, f0: C([[0, 1350], [0.5, 950]]),
      formants: [[() => 1100, 280, 3.0], [() => 2900, 500, 1.2]],
      amp: C([[0, 0], [0.08, 0.5], [0.35, 0.45], [0.5, 0]]), vibrato: [6, 0.03], tilt: 1.7,
    }), 0.1, 0.6);
    return out;
  },
  /** 먹는 소리 — 바삭 다섯 번 + 꿀꺽. 리그의 오물오물(주기 0.48초)에 맞춰 놓는다 */
  eat: () => {
    const out = buf(3.4);
    const rr = rng(44);
    for (let n = 0; n < 5; n++) mixInto(out, crunch(50 + n, 0.92 + rr() * 0.18), 0.55 + n * 0.483 + (rr() - 0.5) * 0.03, 0.9 - n * 0.03);
    // 꿀꺽 — 내려가는 낮은 사인
    const gulp = buf(0.16);
    for (let i = 0; i < gulp.length; i++) {
      const t = i / SR;
      gulp[i] = Math.sin(TAU * (300 - 1100 * t * t * 6) * t) * Math.exp(-t / 0.06) * 0.7;
    }
    mixInto(out, gulp, 3.05, 0.9);
    return out;
  },
  /** 알을 두드리는 톡톡 */
  egg_knock: () => {
    const out = buf(0.4);
    mixInto(out, knock(61, 270), 0);
    mixInto(out, knock(62, 240), 0.19, 0.85);
    return out;
  },
  /** 부화 — 껍질이 갈라지는 잔금 소리 → 종소리 아르페지오 */
  hatch: () => {
    const out = buf(2.2);
    mixInto(out, crackle(71, 0.35), 0, 0.9);
    mixInto(out, knock(72, 200), 0.38, 0.8);
    mixInto(out, crackle(73, 0.3), 0.5, 1);
    [784, 988, 1175, 1568].forEach((f, i) => mixInto(out, bell(f, 1.3, 0.85 - i * 0.05), 0.85 + i * 0.11));
    return out;
  },
  /** 단계 상승 종소리 */
  chime: () => {
    const out = buf(1.5);
    [784, 988, 1175, 1568].forEach((f, i) => mixInto(out, bell(f, 1.1, 0.85), i * 0.1));
    return out;
  },
};

/* ── 정리 · WAV ───────────────────────────────────────── */
/** 소리별 음량 — peak: 최대치 목표(기본 −2dB), drive: 소프트 클립으로 평균 음량을 끌어올림(터지는 소리가 묻히지 않게) */
const LEVELS = {
  cat_happy: { peak: 0.62 }, cat_sad: { peak: 0.62 }, // 고양이는 고음이라 같은 최대치에서 더 크게 들린다
  eat: { drive: 2.4, peak: 0.78 },
  hatch: { peak: 0.7 }, chime: { peak: 0.62 },
};
function finish(data, { peak: target = 0.79, drive = 0 } = {}) {
  if (drive > 0) {
    const d = Math.tanh(drive);
    data = data.map((v) => Math.tanh(v * drive) / d);
  }
  let peak = 0;
  for (const v of data) peak = Math.max(peak, Math.abs(v));
  const gain = peak > 0 ? target / peak : 1;
  const fade = Math.round(0.006 * SR);
  const out = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    let v = data[i] * gain;
    if (i < fade) v *= i / fade;
    if (data.length - 1 - i < fade) v *= (data.length - 1 - i) / fade;
    out[i] = Math.round(clamp(v, -1, 1) * 32767);
  }
  return out;
}
function wav(samples) {
  const bytes = samples.length * 2;
  const b = Buffer.alloc(44 + bytes);
  b.write("RIFF", 0); b.writeUInt32LE(36 + bytes, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(bytes, 40);
  Buffer.from(samples.buffer).copy(b, 44);
  return b;
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("build-sounds.mjs")) {
  mkdirSync(OUT, { recursive: true });
  let total = 0;
  for (const [name, make] of Object.entries(sounds)) {
    const file = wav(finish(make(), LEVELS[name]));
    writeFileSync(join(OUT, `${name}.wav`), file);
    total += file.length;
    console.log(`${name.padEnd(13)} ${(file.length / 1024).toFixed(0).padStart(4)} KB  ${((file.length - 44) / 2 / SR).toFixed(2)}s`);
  }
  console.log(`합계 ${(total / 1024).toFixed(0)} KB → ${OUT}`);
}
