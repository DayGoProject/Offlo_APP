/**
 * Expo Go로 폰에서 열 QR 이미지를 만든다 — 터미널 QR이 안 보일 때 · 화면 단위로 바로 열고 싶을 때.
 *
 *   npx expo start --go                      # 먼저 개발 서버를 Expo Go 모드로 (폰과 PC는 같은 Wi-Fi)
 *   node scripts/expo-go-qr.mjs              # → .verify/expo-go-qr.png (PC의 사설 IPv4를 자동으로 찾는다)
 *   node scripts/expo-go-qr.mjs --host 192.168.0.12 --port 8081
 *
 * **Expo Go에서는 로그인(Google)이 안 된다** (CLAUDE.md) — 로그인 전용 탭은 못 본다. 가드 밖 **미리보기 화면**(`/preview/*`)은 샘플 값이라 그대로 열린다.
 * `exp://<IP>:<포트>/--/<경로>` 형식의 딥링크를 QR로 만들면 Expo Go가 그 화면을 바로 연다.
 * QR 인코더는 Expo CLI가 쓰는 `toqr`(프로젝트에 이미 있다). 이미지 합성은 playwright(크로미움).
 */
import { mkdirSync, readdirSync } from "node:fs";
import { homedir, networkInterfaces } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";
import { PNG } from "pngjs";
import { toQR } from "toqr";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);

function lanIp() {
  for (const list of Object.values(networkInterfaces())) {
    for (const n of list ?? []) {
      if (n.family === "IPv4" && !n.internal && /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(n.address)) return n.address;
    }
  }
  throw new Error("사설 IPv4 주소를 못 찾았다 — --host로 지정하세요");
}
const host = flag("--host", lanIp());
const port = flag("--port", "8081");
const base = `exp://${host}:${port}`;

const TARGETS = [
  {
    title: "쓰다듬기 · 햅틱 (아이폰 확인용)",
    note: "톡 눌러 보기 · 좌우로 쓱쓱 문지르기 · 첫 탭 레벨업 · 둘째 탭 상한 달성 · 셋째부터 부드러운 진동",
    url: `${base}/--/preview/garden?state=fed&today=3&total=9`,
  },
  { title: "정원 3D 미리보기 (출출)", note: "출출한 강아지 · 눌러서 쓰다듬기", url: `${base}/--/preview/garden?state=peckish` },
  { title: "정원 3D 미리보기 (전설)", note: "왕관 · 스카프 · 오라의 고양이", url: `${base}/--/preview/garden?state=legend` },
  { title: "동물 확인 뷰어", note: "고양이 · 강아지 · 토끼 × 성장 단계 × 동작", url: `${base}/--/preview/clay` },
  { title: "앱 처음 화면", note: "로그인 화면까지만 (Expo Go는 Google 로그인 불가)", url: base },
];

/** QR 모듈 행렬 → PNG data URL (모듈 한 칸 = scale px · 조용한 여백 4칸) */
function qrDataUrl(text, scale = 10) {
  const m = toQR(text, 0); // 0 = M 오류정정 (Expo가 쓰는 수준)
  const n = Math.round(Math.sqrt(m.length));
  const quiet = 4;
  const size = (n + quiet * 2) * scale;
  const png = new PNG({ width: size, height: size });
  png.data.fill(255);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!m[y * n + x]) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = (((y + quiet) * scale + dy) * size + (x + quiet) * scale + dx) * 4;
          png.data[i] = png.data[i + 1] = png.data[i + 2] = 0;
        }
      }
    }
  }
  return `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
}

const html = `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:#040508;color:#D8D8D8;font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;padding:28px 28px 20px}
  h1{font-size:20px;font-weight:600;margin:0 0 4px} p.sub{margin:0 0 20px;font-size:13px;opacity:.6}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .card{background:#0B0D11;border:1px solid rgba(216,216,216,.12);border-radius:12px;padding:16px;text-align:center}
  .card img{width:260px;height:260px;border-radius:8px;image-rendering:pixelated}
  .t{font-size:15px;font-weight:600;margin:10px 0 2px;color:#3DDB87} .n{font-size:12px;opacity:.7;margin-bottom:6px}
  .u{font-size:10.5px;opacity:.45;word-break:break-all;font-family:Consolas,monospace}
</style>
<h1>Expo Go로 열기</h1><p class="sub">폰과 PC가 같은 Wi-Fi여야 합니다 · Expo Go 앱의 "Scan QR code"(아이폰은 기본 카메라)로 스캔 · PC 주소 ${host}:${port}</p>
<div class="grid">${TARGETS.map((t) => `<div class="card"><img src="${qrDataUrl(t.url)}"><div class="t">${t.title}</div><div class="n">${t.note}</div><div class="u">${t.url}</div></div>`).join("")}</div>`;

const cache = join(homedir(), "AppData", "Local", "ms-playwright");
const dir = readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]))[0];
mkdirSync(join(ROOT, ".verify"), { recursive: true });
const browser = await chromium.launch({ executablePath: join(cache, dir, "chrome-win64", "chrome.exe") });
const page = await (await browser.newContext({ viewport: { width: 700, height: 900 }, deviceScaleFactor: 2 })).newPage();
await page.setContent(html);
const out = join(ROOT, ".verify", "expo-go-qr.png");
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(out);
TARGETS.forEach((t) => console.log(`  ${t.title}: ${t.url}`));
