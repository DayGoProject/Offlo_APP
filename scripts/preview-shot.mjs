/**
 * 미리보기 화면 스크린샷 — 아트 · 레이아웃을 눈으로 확인할 때 쓴다 (검증 스크립트가 아니다).
 *
 *   node scripts/preview-shot.mjs "/preview/pet-art?type=cat&still=1" cat-sheet
 *   node scripts/preview-shot.mjs "/preview/garden?state=fed" fed --wait 1500 --width 390 --height 844 --full
 *
 * 개발 서버(expo start --web, 8081)가 떠 있어야 한다. 결과는 `.verify/shot-<이름>.png` (gitignore 대상).
 * 옵션: --wait <ms> 로드 뒤 대기 · --width/--height 뷰포트 · --full 전체 높이 · --scale <dpr> · --frames <n> --every <ms> 연속 프레임
 */
import { mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, ".verify");
const URL = process.env.OFFLO_WEB_URL ?? "http://localhost:8081";

const [path, name = "shot", ...rest] = process.argv.slice(2);
if (!path) {
  console.error('사용법: node scripts/preview-shot.mjs "<경로>" <이름> [--wait ms] [--width px] [--height px] [--full] [--frames n --every ms]');
  process.exit(1);
}
const opt = (flag, fallback) => {
  const i = rest.indexOf(flag);
  return i >= 0 ? Number(rest[i + 1]) : fallback;
};

const cache = join(homedir(), "AppData", "Local", "ms-playwright");
const dir = readdirSync(cache)
  .filter((d) => /^chromium-\d+$/.test(d))
  .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]))[0];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: join(cache, dir, "chrome-win64", "chrome.exe") });
const context = await browser.newContext({
  viewport: { width: opt("--width", 390), height: opt("--height", 844) },
  deviceScaleFactor: opt("--scale", 2),
  colorScheme: "dark",
  timezoneId: "Asia/Seoul",
  locale: "ko-KR",
});
const page = await context.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(`${URL}${path}`, { waitUntil: "networkidle", timeout: 120_000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(opt("--wait", 800));

const frames = opt("--frames", 1);
for (let i = 0; i < frames; i++) {
  const file = join(OUT, `shot-${name}${frames > 1 ? `-${i + 1}` : ""}.png`);
  await page.screenshot({ path: file, fullPage: rest.includes("--full") });
  console.log(file);
  if (i < frames - 1) await page.waitForTimeout(opt("--every", 400));
}
if (errors.length) console.log(`콘솔 에러 ${errors.length}건:\n${errors.slice(0, 5).join("\n")}`);
await browser.close();
