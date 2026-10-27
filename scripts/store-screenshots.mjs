/**
 * Play 스토어 스크린샷 — 웹 미리보기(샘플 값만)를 **1080×2100**(긴 변이 짧은 변의 2배 이하)으로 찍어 `store/phone-*.png`에 둔다.
 *
 *   node scripts/store-screenshots.mjs
 *
 * 실제 사용자 데이터 · 이름 · 이메일이 나오면 안 된다 — 미리보기 화면은 `src/preview/samples.ts`의 지어낸 값만 그린다 (security.md).
 * 웹 미리보기(RN Web)라 상태 표시줄 · 하단 탭이 없는 깔끔한 화면이다. 3D 동물은 WebGL로 실제와 같이 그려진다.
 * 개발 서버가 없으면 띄우고(끝나면 끈다), 있으면 그대로 쓴다.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "store");
const URL = process.env.OFFLO_WEB_URL ?? "http://localhost:8081";

/** [파일 이름, 경로, 기다릴 것(testID) | null] */
const SHOTS = [
  ["01-garden", "/preview/garden?state=fed&streak=9&today=2&week=4", "pet-3d-ready"],
  ["02-result", "/preview/result?state=ready", "result"],
  ["03-home", "/preview/dashboard?state=ready", "dashboard"],
  ["04-analysis", "/preview/analysis?state=ready", "analysis"],
  ["05-coach", "/preview/chat?state=ready", null],
  ["06-goals", "/preview/goals?state=ready", "goals"],
  ["07-badges", "/preview/badges?state=ready", "badges"],
  ["08-community", "/preview/community?state=ready", "community"],
];

async function serverUp() {
  try {
    return (await fetch(URL, { signal: AbortSignal.timeout(3000) })).ok;
  } catch {
    return false;
  }
}

let devServer = null;
if (!(await serverUp())) {
  console.log(`개발 서버를 띄웁니다 (${URL}) …`);
  devServer = spawn("npx", ["expo", "start", "--port", "8081"], { cwd: ROOT, env: { ...process.env, BROWSER: "none", EXPO_NO_TELEMETRY: "1" }, stdio: "ignore", shell: true });
  for (let i = 0; i < 90 && !(await serverUp()); i++) await new Promise((r) => setTimeout(r, 2000));
}
const stopServer = () => {
  if (!devServer) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(devServer.pid), "/T", "/F"], { stdio: "ignore" });
  else devServer.kill("SIGTERM");
};

const cache = join(homedir(), "AppData", "Local", "ms-playwright");
const dir = readdirSync(cache)
  .filter((d) => /^chromium-\d+$/.test(d))
  .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]))[0];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: join(cache, dir, "chrome-win64", "chrome.exe") });
try {
  // 360×700 CSS px × 3 = 1080×2100
  const context = await browser.newContext({ viewport: { width: 360, height: 700 }, deviceScaleFactor: 3, colorScheme: "dark", timezoneId: "Asia/Seoul", locale: "ko-KR" });
  for (const [name, path, waitFor] of SHOTS) {
    const page = await context.newPage();
    await page.goto(`${URL}${path}`, { waitUntil: "networkidle", timeout: 120_000 });
    await page.evaluate(() => document.fonts.ready);
    if (waitFor) await page.getByTestId(waitFor).first().waitFor({ state: waitFor === "pet-3d-ready" ? "attached" : "visible", timeout: 60_000 }).catch(() => console.log(`  ! ${name}: ${waitFor}를 못 기다림`));
    await page.waitForTimeout(name === "01-garden" ? 2500 : 900);
    const file = join(OUT, `phone-${name}.png`);
    await page.screenshot({ path: file });
    console.log(`✓ ${file}`);
    await page.close();
  }
} finally {
  await browser.close();
  stopServer();
}
