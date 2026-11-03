/**
 * UIUX 실험 A안("몰입형 스테이지") 검증 — 웹 미리보기 + Playwright (에이전트 자동 실행용)
 *
 *   node scripts/verify-A-stage-web.mjs     (개발 서버가 없으면 띄운다)
 *
 * 로그인 · 실서버는 못 넘으므로 가드 밖 미리보기 둘을 본다:
 *   /preview/stage — 실제 앱과 **같은 탭 구성 코드**(StageTabsLayout)를 자리 표시 화면과 함께: 탭 전환 · 가운데 + → 시트 → 분석 탭 `?start=pick`
 *   /preview/home  — 홈 히어로(HomeStage) + 탭바 + 시트를 샘플 값으로: 상태별 문구 · 버튼 · 미션 미니 바 · 터치 영역 · 작은 폰에서 겹침
 * 진짜 안드로이드 기기에서의 내비게이션 · 3D · 로그인 뒤 화면은 APK로 눈으로 본다.
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

const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};

function findChromium() {
  const cache = join(homedir(), "AppData", "Local", "ms-playwright");
  const dir = readdirSync(cache)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]))[0];
  if (!dir) throw new Error(`크로미움 캐시를 찾지 못했습니다: ${cache}`);
  return join(cache, dir, "chrome-win64", "chrome.exe");
}
const serverUp = async () => {
  try {
    return (await fetch(URL, { signal: AbortSignal.timeout(3000) })).ok;
  } catch {
    return false;
  }
};

let devServer = null;
if (await serverUp()) {
  console.log(`\n이미 떠 있는 개발 서버를 씁니다: ${URL}`);
} else {
  console.log(`\n개발 서버를 띄웁니다 (${URL}) …`);
  devServer = spawn("npx", ["expo", "start", "--port", "8081"], { cwd: ROOT, env: { ...process.env, BROWSER: "none", EXPO_NO_TELEMETRY: "1" }, stdio: "ignore", shell: true });
  for (let i = 0; i < 90 && !(await serverUp()); i++) await new Promise((r) => setTimeout(r, 2000));
}
const stopServer = () => {
  if (!devServer) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(devServer.pid), "/T", "/F"], { stdio: "ignore" });
  else devServer.kill("SIGTERM");
};

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ executablePath: findChromium() });

async function open(path, rootTestId, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: "dark", locale: "ko-KR", timezoneId: "Asia/Seoul" });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && !m.location().url?.endsWith("/favicon.ico") && errors.push(m.text().slice(0, 200)));
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
  await page.goto(`${URL}${path}`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.getByTestId(rootTestId).first().waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(600);
  return { page, errors, context };
}
const text = (page, id) => page.getByTestId(id).first().innerText().then((t) => t.replace(/\s+/g, " ").trim());
const calls = (page) => page.evaluate(() => [...(globalThis.__offloHomeCalls ?? [])]);
const selected = (page, id) => page.getByTestId(id).getAttribute("aria-selected");

try {
  /* ── 탭 내비게이션 (실제 앱과 같은 구성 코드) ───────────────── */
  {
    const { page, errors, context } = await open("/preview/stage", "stage-index");
    check((await selected(page, "tab-home")) === "true" && (await selected(page, "tab-analysis")) === "false", "처음엔 홈 탭이 선택돼 있다");
    check((await page.getByTestId("tab-upload").count()) === 1 && (await page.locator('[data-testid^="tab-"]').count()) === 5, "탭 4개 + 가운데 + 버튼(tab-upload) — '더보기' 탭은 없다");

    for (const [tab, screen] of [["analysis", "stage-analysis"], ["garden", "stage-garden"], ["community", "stage-community"], ["home", "stage-index"]]) {
      await page.getByTestId(`tab-${tab}`).click();
      await page.getByTestId(screen).waitFor({ state: "visible", timeout: 5000 });
      check((await selected(page, `tab-${tab}`)) === "true", `${tab} 탭 — 누르면 그 화면이 뜨고 선택 표시가 옮겨 간다`);
    }

    // 가운데 + → 시트
    const fab = await page.getByTestId("tab-upload").boundingBox();
    check(fab.width >= 56 && fab.height >= 56, "가운데 + 버튼은 터치 영역이 56pt 이상이다", `${Math.round(fab.width)}×${Math.round(fab.height)}`);
    await page.getByTestId("tab-upload").click();
    await page.getByTestId("upload-sheet").waitFor({ state: "visible", timeout: 5000 });
    check((await text(page, "upload-sheet")).includes("스크린타임 올리기") && (await page.getByTestId("upload-daily").count()) === 1 && (await page.getByTestId("upload-weekly").count()) === 1, "+ 를 누르면 시트가 뜨고 일간 · 주간 두 갈래가 있다");
    await page.screenshot({ path: join(OUT_DIR, "A-stage-sheet.png") });
    await page.getByTestId("upload-sheet-close").click();
    await page.getByTestId("upload-sheet").waitFor({ state: "detached", timeout: 5000 });
    check(true, "\"닫기\"로 시트가 닫힌다");

    await page.getByTestId("tab-upload").click();
    await page.getByTestId("upload-daily").click();
    await page.getByTestId("stage-analysis").waitFor({ state: "visible", timeout: 5000 });
    await page.getByTestId("upload-sheet").waitFor({ state: "detached", timeout: 5000 }); // 시트는 내려가는 애니메이션이 끝나야 사라진다
    check((await page.getByTestId("upload-sheet").count()) === 0 && (await text(page, "stage-start-analysis")) === "start=pick", "\"오늘 일간 분석\" → 시트가 닫히고 분석 탭이 `?start=pick`과 함께 열린다 (사진 고르기를 바로 열 신호)", await text(page, "stage-start-analysis"));
    check((await selected(page, "tab-analysis")) === "true", "분석 탭이 선택된다");

    await page.getByTestId("tab-home").click();
    await page.getByTestId("tab-upload").click();
    await page.getByTestId("upload-weekly").click();
    await page.getByTestId("stage-analysis").waitFor({ state: "visible", timeout: 5000 });
    check((await text(page, "stage-start-analysis")) === "start=-", "\"이번 주 주간 분석\" → 분석 탭 (사진 고르기 신호 없음 — 앞의 신호도 남지 않는다)", await text(page, "stage-start-analysis"));
    check(errors.length === 0, "탭 내비게이션 · 콘솔 에러 0", errors.join(" | ").slice(0, 200));
    await context.close();
  }

  /* ── 홈 히어로 ───────────────────────────────────────────── */
  {
    const { page, errors, context } = await open("/preview/home?state=fed&still=1", "home");
    check((await text(page, "home-title")) === "오늘 밥을 배부르게 먹었어요", "배부름 — 제목은 동물 상태 문구");
    check((await text(page, "home-sub")).startsWith("오늘 ") && /\d+시간 \d+분 · 디톡스 점수 \d+점/.test(await text(page, "home-sub")), "오늘 분석했으면 한 줄이 오늘의 숫자(시간 · 점수)", await text(page, "home-sub"));
    check((await text(page, "home-cta")) === "오늘 결과 보기", "분석을 마쳤으면 버튼은 \"오늘 결과 보기\"");
    check((await text(page, "mini-mission-sub")) === "오늘 미션을 모두 끝냈어요" && (await text(page, "mission-mini-bar")).includes("2/2"), "미션 미니 바 — 오늘 미션 2/2를 끝냈다고 알린다");
    await page.getByTestId("home-cta").click();
    await page.getByTestId("mission-mini-bar").click();
    await page.getByTestId("home-profile").click();
    await page.getByTestId("notification-bell").click();
    const c = await calls(page);
    check(c.some((x) => x.startsWith("today ")) && c.includes("garden") && c.includes("profile") && c.includes("notifications"), "버튼 · 미니 바 · 프로필 · 종이 각자의 곳으로 보낸다", c.join(" | "));
    check((await text(page, "notification-bell-badge")) === "3", "알림 종에 안 읽은 알림 수(3)가 붙는다");
    check((await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) === false, "가로 넘침 없음");
    await page.screenshot({ path: join(OUT_DIR, "A-stage-home-fed.png") });
    check(errors.length === 0, "홈(배부름) · 콘솔 에러 0", errors.join(" | ").slice(0, 200));
    await context.close();
  }
  {
    const { page, context } = await open("/preview/home?state=peckish&still=1", "home");
    check((await text(page, "home-title")) === "슬슬 밥 먹을 시간이에요" && (await text(page, "home-cta")) === "오늘 분석하기", "출출함 — 제목 · 버튼 \"오늘 분석하기\"");
    check((await text(page, "mini-mission-sub")).startsWith("밥 주기") && (await text(page, "mission-mini-bar")).includes("0/2"), "미니 바 — 다음 할 일은 밥 주기 (0/2)", await text(page, "mini-mission-sub"));
    await page.getByTestId("home-cta").click();
    check((await calls(page)).includes("upload"), "\"오늘 분석하기\"가 업로드로 보낸다");
    // 버튼은 엄지가 닿는 아래쪽 — 미니 바 바로 위 (겹치지 않는다)
    const cta = await page.getByTestId("home-cta").boundingBox();
    const mini = await page.getByTestId("mission-mini-bar").boundingBox();
    check(cta.y > 844 * 0.5 && cta.y + cta.height <= mini.y, "버튼이 화면 아래쪽(엄지 영역)에 있고 미션 미니 바와 겹치지 않는다", `버튼 y ${Math.round(cta.y)}~${Math.round(cta.y + cta.height)} · 미니 바 y ${Math.round(mini.y)}`);
    check(cta.height >= 44, "버튼 높이 44pt 이상", String(Math.round(cta.height)));
    await context.close();
  }
  for (const [state, title, button] of [["egg", "알이 부화를 기다리고 있어요", "첫 분석으로 부화시키기"], ["none", "함께할 동물을 골라 주세요", "함께할 동물 고르기"]]) {
    const { page, context } = await open(`/preview/home?state=${state}&still=1`, "home");
    check((await text(page, "home-title")) === title && (await text(page, "home-cta")) === button, `${state} — 제목 · 버튼 "${button}"`);
    if (state === "none") check((await page.getByTestId("mission-mini-bar").count()) === 0, "동물이 없으면 미션 미니 바가 없다");
    await context.close();
  }
  {
    const { page, context } = await open("/preview/home?state=loading", "home");
    check((await page.getByTestId("home-skeleton").count()) === 1, "불러오는 중 — 자리표시 히어로");
    await context.close();
    const e = await open("/preview/home?state=error", "home");
    check((await text(e.page, "home-error")).includes("인터넷에 연결되어 있지 않거나") && (await e.page.getByTestId("retry-button").count()) === 1, "불러오기 실패 — 한국어 안내 + 다시 시도");
    await e.context.close();
  }

  /* ── 작은 폰(360 × 640)에서도 버튼이 가려지지 않는다 ───────── */
  {
    const { page, context } = await open("/preview/home?state=peckish&still=1", "home", { width: 360, height: 640 });
    // 스크롤을 끝까지 내린다 — 끝에서는 버튼이 미니 바보다 위에 있어야 한다 (미니 바는 스크롤 위에 떠 있다)
    await page.evaluate(() => document.querySelectorAll("*").forEach((el) => { if (el.scrollHeight > el.clientHeight + 1 && getComputedStyle(el).overflowY !== "visible") el.scrollTop = el.scrollHeight; }));
    await page.waitForTimeout(300);
    const cta = await page.getByTestId("home-cta").boundingBox();
    const mini = await page.getByTestId("mission-mini-bar").boundingBox();
    check(cta.y + cta.height <= mini.y + 1, "작은 폰 — 스크롤하면 버튼이 미션 미니 바 위에 온전히 보인다", `버튼 아래 ${Math.round(cta.y + cta.height)} ≤ 미니 바 위 ${Math.round(mini.y)}`);
    await page.screenshot({ path: join(OUT_DIR, "A-stage-home-small.png") });
    await context.close();
  }
} catch (err) {
  check(false, "검증 중 예외", String(err).split("\n").slice(0, 3).join(" / "));
} finally {
  await browser.close();
  stopServer();
}

console.log(`\n스크린샷: ${OUT_DIR}`);
if (failures.length) {
  console.error(`\nA안 웹 검증 실패 ${failures.length}건: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nA안 웹 검증을 통과했습니다.");
