/**
 * M2 검증 ① — RN Web + Playwright (에이전트 자동 실행용)
 *
 *   node scripts/verify-M2-web.mjs
 *
 * 확인 항목
 *   0. 공유 코드가 웹 레포와 동일한가 (매 검증의 첫 줄)
 *   1. 비로그인으로 / 에 들어가면 로그인 화면으로 막힌다 (라우트 가드)
 *   2. 로그인 화면 — 브랜드 색 · Google 버튼 · 터치 타깃 44pt 이상 · 가로 넘침 없음
 *   3. 가드 밖 /foundation 은 로그인 없이 열린다 (M1 회귀 경로)
 *   4. (app)/ 아래 다른 로그인 전용 경로(/history · /more)도 막힌다 — 폴더 단위 가드 (M4)
 *      M2의 "테마 오버라이드 영속화" 항목은 M4에서 라이트 테마를 없애며 뺐다
 *   5. 콘솔 에러 · 미처리 rejection 0
 *
 * 실제 Google 로그인은 자동화하지 않는다 — 계정 선택은 사람이 한다.
 * 로그인 유지 · 미가입자 차단은 ② 안드로이드 dev build(verify-M2-android.mjs)에서 본다.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

import { chromium } from "playwright-core";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, ".verify");
const URL = process.env.OFFLO_WEB_URL ?? "http://localhost:8081";
const BRAND_RGB = "rgb(61, 219, 135)";
const MIN_TOUCH = 44;

const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};

/** Playwright가 받아둔 크로미움을 재사용한다 (별도 다운로드 없이) */
function findChromium() {
  const cache = join(homedir(), "AppData", "Local", "ms-playwright");
  const dir = readdirSync(cache)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]))[0];
  if (!dir) throw new Error(`크로미움 캐시를 찾지 못했습니다: ${cache}`);
  return join(cache, dir, "chrome-win64", "chrome.exe");
}

async function serverUp() {
  try {
    const res = await fetch(URL, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (await serverUp()) return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

/* ── 0. 공유 코드 드리프트 ─────────────────────────────────── */
const sync = spawnSync(process.execPath, [join(ROOT, "scripts", "sync-shared.mjs")], {
  stdio: "inherit",
});
if (sync.status !== 0) {
  console.error("\n공유 코드가 웹과 갈라져 있습니다. 먼저 맞추고 다시 실행하세요.");
  process.exit(1);
}

/* ── 개발 서버 ─────────────────────────────────────────────── */
let devServer = null;
if (await serverUp()) {
  console.log(`\n이미 떠 있는 개발 서버를 씁니다: ${URL}`);
} else {
  console.log(`\n개발 서버를 띄웁니다 (${URL}) …`);
  devServer = spawn("npx", ["expo", "start", "--port", "8081"], {
    cwd: ROOT,
    // CI=1은 Metro 워처를 꺼서 수정분이 반영되지 않는다 — 여기선 켜 둔다.
    env: { ...process.env, BROWSER: "none", EXPO_NO_TELEMETRY: "1" },
    stdio: "ignore",
    shell: true,
  });
  if (!(await waitForServer(180_000))) {
    console.error("✗ 개발 서버가 3분 안에 뜨지 않았습니다.");
    stopServer();
    process.exit(1);
  }
}

function stopServer() {
  if (!devServer) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(devServer.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    devServer.kill("SIGTERM");
  }
}

/* ── 브라우저 검증 ─────────────────────────────────────────── */
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ executablePath: findChromium() });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 }, // iPhone 14/15 논리 해상도
  deviceScaleFactor: 3,
  colorScheme: "dark",
});

const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

try {
  /* 1. 라우트 가드 — 비로그인으로 홈 진입 */
  await page.goto(`${URL}/`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.getByTestId("login-screen").waitFor({ state: "visible", timeout: 60_000 });
  const path = new globalThis.URL(page.url()).pathname;
  check(path === "/login", "비로그인 → 로그인 화면으로 막힘", path);
  check((await page.getByTestId("dashboard").count()) === 0, "홈(대시보드)이 그려지지 않음");

  /* 2. 로그인 화면 */
  const markColor = await page
    .getByText("Offlo", { exact: true })
    .first()
    .evaluate((el) => getComputedStyle(el).color);
  check(markColor === BRAND_RGB, "브랜드 색 적용", markColor);

  const button = page.getByTestId("google-login-button");
  const label = await button.innerText();
  check(label.includes("Google로 계속하기"), "Google 버튼 문구", label.trim());
  const box = await button.boundingBox();
  check(Boolean(box && box.height >= MIN_TOUCH), `터치 타깃 ${MIN_TOUCH}pt 이상`, `${box?.height ?? 0}px`);

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  check(overflow.scrollWidth <= overflow.innerWidth, "가로 넘침 없음", `${overflow.scrollWidth} / ${overflow.innerWidth}`);
  await page.screenshot({ path: join(OUT_DIR, "M2-login.png") });

  /* 3. 가드 밖 경로 */
  await page.goto(`${URL}/foundation`, { waitUntil: "networkidle", timeout: 60_000 });
  const screen = page.getByTestId("screen");
  await screen.waitFor({ state: "visible", timeout: 30_000 });
  check(true, "/foundation 은 로그인 없이 열림");

  /* 4. 폴더 단위 가드 — (app)/ 아래 다른 경로도 막힌다 */
  for (const protectedPath of ["/history", "/more"]) {
    await page.goto(`${URL}${protectedPath}`, { waitUntil: "networkidle", timeout: 60_000 });
    await page.getByTestId("login-screen").waitFor({ state: "visible", timeout: 30_000 });
    const landed = new globalThis.URL(page.url()).pathname;
    check(landed === "/login", `비로그인 ${protectedPath} → 로그인 화면으로 막힘`, landed);
  }

  /* 5. 콘솔 */
  check(consoleErrors.length === 0, "콘솔 에러 0", consoleErrors.join(" | ").slice(0, 300));
} catch (err) {
  check(false, "검증 중 예외", String(err).split("\n")[0]);
  await page.screenshot({ path: join(OUT_DIR, "M2-web-failure.png") }).catch(() => {});
} finally {
  await browser.close();
  stopServer();
}

console.log(`\n스크린샷: ${OUT_DIR}`);
if (failures.length) {
  console.error(`\nM2 웹 검증 실패 ${failures.length}건: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nM2 웹 검증을 통과했습니다.");
