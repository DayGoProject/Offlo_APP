/**
 * Expo Go로 폰에서 열 QR 이미지를 만든다 — 터미널 QR이 안 보일 때 · 화면 단위로 바로 열고 싶을 때.
 *
 *   npx expo start --go                      # 먼저 개발 서버를 Expo Go 모드로 (폰과 PC는 같은 Wi-Fi)
 *   node scripts/expo-go-qr.mjs              # → .verify/expo-go-qr.png (PC의 사설 IPv4를 자동으로 찾는다)
 *   node scripts/expo-go-qr.mjs --host 192.168.0.12 --port 8081
 *   node scripts/expo-go-qr.mjs --list       # "미리보기 목록" QR 하나만 크게 → .verify/expo-go-qr-list.png
 *   node scripts/expo-go-qr.mjs --web --list # Expo Go 없이 폰 브라우저로 여는 QR (Expo Go SDK 버전이 안 맞을 때) → .verify/expo-go-qr-web-list.png
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
const onlyList = args.includes("--list"); // 미리보기 목록 QR 하나만 크게
const base = `exp://${host}:${port}`;

const TARGETS = [
  {
    title: "미리보기 목록 (모든 화면)",
    note: "로그인 없이 열리는 화면 전부 — 대시보드 · 분석 · 정원 · 커뮤니티 · 설정 … 목록에서 골라 눌러 보세요 (샘플 값)",
    url: `${base}/--/preview`,
  },
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

// --web: Expo Go 없이 **폰 브라우저**로 여는 주소 (Expo Go가 SDK 58 전용으로 바뀌어 SDK 57 프로젝트가 안 열릴 때 — 개발 서버가 웹 화면도 같은 포트로 내보낸다)
// 3D 동물 · 가짜 서버 미리보기는 그대로 동작하고, 햅틱(진동) · 네이티브 모듈이 필요한 것은 안 된다
const web = args.includes("--web");
if (web) {
  TARGETS.splice(0, TARGETS.length,
    { title: "웹으로 보기 · 미리보기 목록", note: "폰 브라우저(Safari · Chrome)로 열려요 — 로그인 없이 모든 화면을 샘플 값으로", url: `http://${host}:${port}/preview` },
    { title: "정원 3D (배부름)", note: "3D 고양이 · 눌러서 쓰다듬기 (진동은 없음)", url: `http://${host}:${port}/preview/garden?state=fed&today=3&total=9` },
    { title: "대시보드 (홈 탭)", note: "샘플 값", url: `http://${host}:${port}/preview/dashboard?state=ready` },
    { title: "커뮤니티", note: "피드 · 글쓰기 · 신고 · 차단 (가짜 서버)", url: `http://${host}:${port}/preview/community?state=ready&notice=0` },
  );
}

// --apk: 같은 Wi-Fi에서 폰이 APK를 내려받는 주소 (`scripts/serve-apk.mjs`가 .verify/apk-share/ 를 8099 포트로 내보낸다)
const apk = args.includes("--apk");
if (apk) {
  TARGETS.splice(0, TARGETS.length, { title: "Offlo APK 내려받기", note: "폰 기본 카메라로 스캔 → 다운로드 → 설치 (알 수 없는 앱 설치 허용 필요)", url: `http://${host}:8099/offlo.apk` });
}

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
  .grid.one{grid-template-columns:1fr} .grid.one .card img{width:420px;height:420px}
  .t{font-size:15px;font-weight:600;margin:10px 0 2px;color:#3DDB87} .n{font-size:12px;opacity:.7;margin-bottom:6px}
  .u{font-size:10.5px;opacity:.45;word-break:break-all;font-family:Consolas,monospace}
</style>
<h1>${apk ? "APK 내려받기" : web ? "폰 브라우저로 열기" : "Expo Go로 열기"}</h1><p class="sub">폰과 PC가 같은 Wi-Fi여야 합니다 · ${web ? "폰 기본 카메라로 스캔하면 브라우저가 열려요" : 'Expo Go 앱의 "Scan QR code"(아이폰은 기본 카메라)로 스캔'} · PC 주소 ${host}:${port}</p>
<div class="grid${onlyList || apk ? " one" : ""}">${(onlyList ? TARGETS.slice(0, 1) : TARGETS).map((t) => `<div class="card"><img src="${qrDataUrl(t.url)}"><div class="t">${t.title}</div><div class="n">${t.note}</div><div class="u">${t.url}</div></div>`).join("")}</div>`;

const cache = join(homedir(), "AppData", "Local", "ms-playwright");
const dir = readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]))[0];
mkdirSync(join(ROOT, ".verify"), { recursive: true });
const browser = await chromium.launch({ executablePath: join(cache, dir, "chrome-win64", "chrome.exe") });
const page = await (await browser.newContext({ viewport: { width: 700, height: 900 }, deviceScaleFactor: 2 })).newPage();
await page.setContent(html);
const out = join(ROOT, ".verify", apk ? "apk-qr.png" : `expo-go-qr${web ? "-web" : ""}${onlyList ? "-list" : ""}.png`);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(out);
TARGETS.forEach((t) => console.log(`  ${t.title}: ${t.url}`));
