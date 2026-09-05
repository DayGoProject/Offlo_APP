/**
 * M1 검증 ① — RN Web + Playwright (에이전트 자동 실행용)
 *
 *   node scripts/verify-M1-web.mjs
 *
 * 확인 항목
 *   0. 공유 코드가 웹 레포와 동일한가 (매 검증의 첫 줄 — .claude/rules/mobile.md)
 *   1. 아이폰 뷰포트(390×844)에서 화면이 뜨는가
 *   2. 브랜드 색(#3DDB87)과 스포카 한 산스 네오가 실제로 적용됐는가
 *   3. 가로 넘침이 없는가
 *   4. 테마 오버라이드(다크 ↔ 라이트)가 동작하는가
 *   5. 콘솔 에러 · 미처리 rejection이 0인가
 *
 * iOS 시뮬레이터를 쓸 수 없는 환경이라(Windows) 이 층이 가장 빠른 회귀 그물이다.
 * 네이티브 고유 항목(햅틱·권한·알림)은 ② 안드로이드 에뮬레이터, ③ 아이폰 Expo Go에서 본다.
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
const DARK_BG = "rgb(10, 10, 15)";
const LIGHT_BG = "rgb(244, 246, 244)";

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
  await page.goto(URL, { waitUntil: "networkidle", timeout: 120_000 });

  const mark = page.getByText("Offlo", { exact: true }).first();
  await mark.waitFor({ state: "visible", timeout: 60_000 });
  check(true, "화면 렌더 (390×844)");

  /* 2. 색·폰트가 실제 계산된 스타일에 반영됐는가 */
  const markStyle = await mark.evaluate((el) => {
    const s = getComputedStyle(el);
    return { color: s.color, fontFamily: s.fontFamily };
  });
  check(markStyle.color === BRAND_RGB, "브랜드 색 적용", markStyle.color);
  check(
    markStyle.fontFamily.includes("SpoqaHanSansNeo-Bold"),
    "폰트 패밀리 지정",
    markStyle.fontFamily,
  );

  const fontLoaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return ["Regular", "Medium", "Bold"].every((w) =>
      document.fonts.check(`16px "SpoqaHanSansNeo-${w}"`),
    );
  });
  check(fontLoaded, "스포카 한 산스 네오 3종 로드");

  /* 3. 가로 넘침 */
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  check(
    overflow.scrollWidth <= overflow.innerWidth,
    "가로 넘침 없음",
    `${overflow.scrollWidth} / ${overflow.innerWidth}`,
  );

  /* 4. 테마 — 다크 기본 → 라이트 오버라이드 */
  const screenBg = () =>
    page.evaluate(
      () => getComputedStyle(document.querySelector('[data-testid="screen"]')).backgroundColor,
    );

  const darkBg = await screenBg();
  check(darkBg === DARK_BG, "기본 스킴 = 다크", darkBg);
  await page.screenshot({ path: join(OUT_DIR, "M1-dark.png") });

  await page.getByText("라이트", { exact: true }).click();
  await page.waitForFunction(
    (light) =>
      getComputedStyle(document.querySelector('[data-testid="screen"]')).backgroundColor === light,
    LIGHT_BG,
    { timeout: 10_000 },
  );
  check(true, "테마 오버라이드 (다크 → 라이트)");
  await page.screenshot({ path: join(OUT_DIR, "M1-light.png") });

  /* 5. 콘솔 */
  check(consoleErrors.length === 0, "콘솔 에러 0", consoleErrors.join(" | ").slice(0, 300));
} catch (err) {
  check(false, "검증 중 예외", String(err).split("\n")[0]);
  await page.screenshot({ path: join(OUT_DIR, "M1-failure.png") }).catch(() => {});
} finally {
  await browser.close();
  stopServer();
}

console.log(`\n스크린샷: ${OUT_DIR}`);
if (failures.length) {
  console.error(`\nM1 검증 실패 ${failures.length}건: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nM1 웹 검증을 통과했습니다.");
