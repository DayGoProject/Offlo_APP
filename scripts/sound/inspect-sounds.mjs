/**
 * 효과음 점검 — 길이 · 최대치 · 평균 음량(RMS) · 클리핑 · 직류 성분 · 앞뒤 무음을 잰다. `--spectrogram <이름>`이면 스펙트로그램 PNG를 `.verify/`에 그린다
 * (피치 곡선과 포먼트의 모양을 눈으로 보려는 것 — 귀여운지는 사람이 들어야 안다).
 *
 *   node scripts/sound/inspect-sounds.mjs
 *   node scripts/sound/inspect-sounds.mjs --spectrogram cat_happy
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PNG } from "pngjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = join(ROOT, "assets", "sounds");

function read(file) {
  const b = readFileSync(file);
  const sr = b.readUInt32LE(24);
  const n = (b.length - 44) / 2;
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = b.readInt16LE(44 + i * 2) / 32768;
  return { sr, s };
}

const spec = process.argv.indexOf("--spectrogram");
if (spec >= 0) {
  const name = process.argv[spec + 1];
  const { sr, s } = read(join(DIR, `${name}.wav`));
  const N = 512, hop = 128, bins = 160; // 0 ~ 7.5kHz
  const frames = Math.floor((s.length - N) / hop);
  const img = new PNG({ width: frames, height: bins });
  const win = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  for (let f = 0; f < frames; f++) {
    for (let k = 0; k < bins; k++) {
      let re = 0, im = 0;
      const w = (2 * Math.PI * k) / N * (N / 2 / bins) * 0.9; // 0~7.5kHz를 bins칸으로
      for (let i = 0; i < N; i++) {
        const x = s[f * hop + i] * win[i];
        re += x * Math.cos(w * i);
        im -= x * Math.sin(w * i);
      }
      const db = 20 * Math.log10(Math.hypot(re, im) / N + 1e-9);
      const v = Math.min(1, Math.max(0, (db + 85) / 55));
      const idx = ((bins - 1 - k) * frames + f) * 4;
      img.data[idx] = Math.round(255 * Math.min(1, v * 1.6));
      img.data[idx + 1] = Math.round(255 * Math.max(0, v * 1.6 - 0.6));
      img.data[idx + 2] = Math.round(255 * Math.max(0, 0.45 - Math.abs(v - 0.3)) * 1.2);
      img.data[idx + 3] = 255;
    }
  }
  mkdirSync(join(ROOT, ".verify"), { recursive: true });
  const out = join(ROOT, ".verify", `spec-${name}.png`);
  writeFileSync(out, PNG.sync.write(img));
  console.log(out, `${frames}x${bins} · 가로 ${(s.length / sr).toFixed(2)}초 · 세로 0~${((sr / 2) * 0.9 / 1000).toFixed(1)}kHz`);
  process.exit(0);
}

let bad = 0;
console.log("이름           길이   최대    RMS   클리핑  DC     앞무음 뒤무음");
for (const f of readdirSync(DIR).filter((x) => x.endsWith(".wav")).sort()) {
  const { sr, s } = read(join(DIR, f));
  let peak = 0, sum = 0, dc = 0, clip = 0;
  for (const v of s) {
    peak = Math.max(peak, Math.abs(v));
    sum += v * v;
    dc += v;
    if (Math.abs(v) > 0.999) clip++;
  }
  const rms = Math.sqrt(sum / s.length);
  const lead = s.findIndex((v) => Math.abs(v) > 0.02) / sr;
  const trail = (s.length - 1 - [...s].reverse().findIndex((v) => Math.abs(v) > 0.02)) / sr;
  const tailSilence = s.length / sr - trail;
  // eat은 고개가 그릇에 닿는 순간(0.5초 뒤)에 첫 바삭이 나오도록 일부러 앞을 비워 둔다
  const ok = peak <= 0.85 && clip === 0 && Math.abs(dc / s.length) < 0.01 && (lead < 0.08 || f === "eat.wav");
  if (!ok) bad++;
  console.log(
    `${(ok ? "✓ " : "✗ ") + f.replace(".wav", "").padEnd(13)} ${(s.length / sr).toFixed(2)}s  ${peak.toFixed(2)}  ${rms.toFixed(3)}  ${String(clip).padStart(4)}   ${(dc / s.length).toFixed(4)}  ${lead.toFixed(2)}s  ${tailSilence.toFixed(2)}s`,
  );
}
process.exit(bad ? 1 : 0);
