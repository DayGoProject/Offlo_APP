/**
 * M4 검증 ① — 미리보기 화면 + Playwright (에이전트 자동 실행용)
 *
 *   node scripts/verify-M4-web.mjs
 *
 * 웹 미리보기는 CORS 때문에 실제 API를 부를 수 없고 Playwright는 Google 로그인을 못 넘는다.
 * 그래서 가드 밖 `/preview/*`에 **실제 화면과 같은 컴포넌트**를 샘플 값으로 띄워 점검한다
 * (mobile.md "웹 미리보기 — 미리보기 화면"). 실데이터 · 탭 전환은 ② 안드로이드(verify-M4-android.mjs).
 *
 * 샘플 기준 시각은 2026-09-17(목) 10:00이고, 브라우저 시간대를 Asia/Seoul로 고정한다.
 *
 * 확인 항목 (대시보드 · 기록 × 데이터 있음 · 비어 있음 · 불러오는 중 · 실패)
 *   - 샘플에서 계산한 숫자가 그대로 나오는가 (오늘 4h 12m · 어제보다 38분 ↓ · 연속 12일 · 1,450분 …)
 *   - 오전 8시(KST) 기록이 오늘로 잡히는가 · 상위 앱이 appName으로 나오는가 (웹 버그 수정분)
 *   - 폰트 — 숫자는 Familjen Grotesk, 제목은 Pretendard · 바탕 #040508
 *   - 빈 상태 · 스켈레톤 · 한국어 에러 + 다시 시도
 *   - 가로 넘침 없음 · 콘솔 에러 0
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
const BG = "rgb(4, 5, 8)";
const BRAND = "rgb(61, 219, 135)";
const TODAY_BAR = "rgba(61, 219, 135, 0.55)";
const ACCENT_SOFT = "rgba(61, 219, 135, 0.13)";
const OFFLINE_TEXT = "인터넷에 연결되어 있지 않거나";

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

async function serverUp() {
  try {
    return (await fetch(URL, { signal: AbortSignal.timeout(3000) })).ok;
  } catch {
    return false;
  }
}

/* ── 0. 공유 코드 드리프트 ─────────────────────────────────── */
if (spawnSync(process.execPath, [join(ROOT, "scripts", "sync-shared.mjs")], { stdio: "inherit" }).status !== 0) {
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
    env: { ...process.env, BROWSER: "none", EXPO_NO_TELEMETRY: "1" },
    stdio: "ignore",
    shell: true,
  });
  for (let i = 0; i < 90 && !(await serverUp()); i++) await new Promise((r) => setTimeout(r, 2000));
}
function stopServer() {
  if (!devServer) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(devServer.pid), "/T", "/F"], { stdio: "ignore" });
  else devServer.kill("SIGTERM");
}

/* ── 브라우저 ──────────────────────────────────────────────── */
mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ executablePath: findChromium() });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
  timezoneId: "Asia/Seoul",
  locale: "ko-KR",
});

/** 화면을 열고 콘솔 에러를 모은다. rootTestId가 보일 때까지 기다린다 */
async function open(path, rootTestId) {
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(`${URL}${path}`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.getByTestId(rootTestId).first().waitFor({ state: "visible", timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  return { page, errors };
}

const text = (page, testId) => page.getByTestId(testId).first().innerText().then((t) => t.trim());
const style = (page, selector, prop) =>
  page.evaluate(([s, p]) => {
    const el = document.querySelector(s);
    return el ? getComputedStyle(el)[p] : null;
  }, [selector, prop]);

async function commonChecks(name, page, errors, scrollTestId) {
  const layout = await page.evaluate((id) => {
    const scroller = document.querySelector(`[data-testid="${id}"]`);
    return {
      doc: document.documentElement.scrollWidth <= window.innerWidth,
      inner: scroller ? scroller.scrollWidth <= scroller.clientWidth + 1 : false,
      bg: scroller ? getComputedStyle(scroller).backgroundColor : null,
    };
  }, scrollTestId);
  check(layout.doc && layout.inner, `${name} · 가로 넘침 없음`);
  check(layout.bg === BG, `${name} · 바탕 #040508`, layout.bg);
  check(errors.length === 0, `${name} · 콘솔 에러 0`, errors.join(" | ").slice(0, 240));
}

async function shots(page, name, scrollTestId) {
  const scrollTo = (position) =>
    page.evaluate(
      ([id, pos]) => {
        const el = document.querySelector(`[data-testid="${id}"]`);
        if (el) el.scrollTop = pos === "top" ? 0 : el.scrollHeight;
      },
      [scrollTestId, position],
    );
  // 앞선 점검(scrollIntoView)이 화면을 내려 둔 채일 수 있다 — 위로 되돌리고 찍는다
  await scrollTo("top");
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT_DIR, `M4-${name}-top.png`) });
  await scrollTo("bottom");
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT_DIR, `M4-${name}-bottom.png`) });
}

try {
  /* ── 미리보기 목록 ─────────────────────────────────────── */
  {
    const { page, errors } = await open("/preview", "preview-index");
    const links = await page.locator('a[href*="/preview/"]').count();
    check(links === 8, "미리보기 목록 — 2개 화면 × 4개 상태", `${links}개`);
    check(errors.length === 0, "미리보기 목록 · 콘솔 에러 0", errors.join(" | ").slice(0, 200));
    await page.close();
  }

  /* ── 대시보드 · 데이터 있음 ────────────────────────────── */
  {
    const { page, errors } = await open("/preview/dashboard?state=ready", "dashboard");
    const body = await page.locator("body").innerText();
    check(body.includes("12일째, 잘 버티고 있어요"), "제목 — 연속 기록이 있으면 일수로 인사");
    check(body.includes("2026. 09. 17 · 목"), "눈썹 — 기준 날짜");

    check((await text(page, "stat-screentime-value")) === "4h 12m", "오늘 스크린타임 4h 12m (오전 8시 기록 = 오늘)", await text(page, "stat-screentime-value"));
    check(body.includes("어제보다 38분 ↓"), "각주 — 어제보다 38분 ↓");
    const noteColor = await page.getByText("어제보다 38분 ↓").evaluate((el) => getComputedStyle(el).color);
    check(noteColor === BRAND, "줄었으면 각주가 브랜드 그린", noteColor);
    check((await text(page, "stat-score-value")) === "72", "디톡스 점수 72");
    check((await text(page, "stat-streak-value")) === "12", "연속 기록 12");
    check(body.includes("21일이면 성체가 돼요"), "다음 동물 단계 안내");
    check((await text(page, "stat-detox-value")) === "1,450", "누적 디톡스 1,450");
    check(body.includes("꽃봉오리 · 다음까지 950분"), "식물 단계 · 다음까지 950분");

    const numFont = await style(page, '[data-testid="stat-screentime-value"]', "fontFamily");
    check(Boolean(numFont?.includes("FamiljenGrotesk")), "숫자는 Familjen Grotesk", numFont);
    const titleFont = await page.getByText("12일째, 잘 버티고 있어요").evaluate((el) => getComputedStyle(el).fontFamily);
    check(titleFont.includes("Pretendard-Regular"), "제목은 Pretendard 400 (굵게 하지 않는다)", titleFont);

    const bars = await page.locator('[data-testid="week-bars"] > div').count();
    check(bars === 7, "주간 막대 7칸", `${bars}칸`);
    const todayBar = await style(page, '[data-testid="week-bar-today"] > div', "backgroundColor");
    check(todayBar === TODAY_BAR, "오늘 막대만 브랜드 그린", todayBar);
    check(body.includes("일 평균 5시간"), "일 평균 5시간 (월~목 기록 4일)");

    const goals = await page.locator('[data-testid="goals-list"] > div').count();
    check(goals === 2 && body.includes("2개"), "진행 중인 목표 2개", `${goals}행`);
    check(body.includes("8 / 15") && body.includes("3 / 16"), "목표 기간 진행 8/15 · 3/16일");
    check(await page.getByTestId("ai-tip").isVisible(), "AI 한마디");

    await page.getByTestId("garden-card").scrollIntoViewIfNeeded();
    check(body.includes("Lv.4 꽃봉오리"), "정원 카드 — Lv.4 꽃봉오리");
    const plantLoaded = await page
      .waitForFunction(() => {
        const root = document.querySelector('[data-testid="plant-image"]');
        const img = root?.tagName === "IMG" ? root : root?.querySelector("img");
        return Boolean(img && img.complete && img.naturalWidth > 0);
      }, null, { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    check(plantLoaded, "식물 이미지(AVIF) 로드");

    await commonChecks("대시보드", page, errors, "dashboard");
    await shots(page, "dashboard-ready", "dashboard");
    await page.close();
  }

  /* ── 대시보드 · 첫 사용 ───────────────────────────────── */
  {
    const { page, errors } = await open("/preview/dashboard?state=empty", "dashboard");
    const body = await page.locator("body").innerText();
    check(body.includes("지우님, 오늘부터 시작해요"), "빈 상태 — 이름으로 인사");
    check(body.includes("오늘 분석을 올려주세요"), "빈 상태 — 오늘 분석 안내");
    check(body.includes("기록 없음"), "빈 상태 — 주간 '기록 없음'");
    check(await page.getByTestId("goals-empty").isVisible(), "빈 상태 — 목표 없음 안내");
    check((await page.getByTestId("ai-tip").count()) === 0, "빈 상태 — AI 한마디 없음");
    check(body.includes("Lv.1 씨앗"), "빈 상태 — 정원은 씨앗");
    await commonChecks("대시보드(빈)", page, errors, "dashboard");
    await shots(page, "dashboard-empty", "dashboard");
    await page.close();
  }

  /* ── 대시보드 · 불러오는 중 ───────────────────────────── */
  {
    const { page, errors } = await open("/preview/dashboard?state=loading", "dashboard");
    const skeletons = ["week-skeleton", "goals-skeleton", "garden-skeleton"];
    const visible = await Promise.all(skeletons.map((id) => page.getByTestId(id).isVisible()));
    check(visible.every(Boolean), "로딩 — 주간 · 목표 · 정원 스켈레톤");
    check((await text(page, "stat-screentime-value")) === "—", "로딩 — 숫자 자리 '—'");
    await commonChecks("대시보드(로딩)", page, errors, "dashboard");
    await shots(page, "dashboard-loading", "dashboard");
    await page.close();
  }

  /* ── 대시보드 · 실패 ──────────────────────────────────── */
  {
    const { page, errors } = await open("/preview/dashboard?state=error", "dashboard");
    check((await text(page, "dashboard-error")).includes(OFFLINE_TEXT), "실패 — 한국어 네트워크 안내");
    check(await page.getByTestId("retry-button").isVisible(), "실패 — 다시 시도 버튼");
    check((await page.getByTestId("stat-screentime").count()) === 0, "실패 — 빈 숫자 카드를 그리지 않음");
    await commonChecks("대시보드(실패)", page, errors, "dashboard");
    await shots(page, "dashboard-error", "dashboard");
    await page.close();
  }

  /* ── 기록 · 데이터 있음 ───────────────────────────────── */
  {
    const { page, errors } = await open("/preview/history?state=ready", "history");
    const body = await page.locator("body").innerText();
    check(body.includes("총 10개의 기록"), "눈썹 — 총 10개");
    check((await page.getByTestId("history-row").count()) === 10, "기록 10줄");
    check(body.includes("최근 7일 +21"), "추이 — 최근 7건 변화 +21");
    const pathD = await page.evaluate(() => {
      const paths = [...document.querySelectorAll('[data-testid="trend-line"] path')];
      return paths.map((p) => p.getAttribute("d") ?? "").find((d) => d.includes("C")) ?? "";
    });
    check(pathD.startsWith("M") && pathD.includes("C"), "추이 곡선이 그려짐", pathD.slice(0, 40));
    check(body.includes("인스타그램 · 유튜브"), "상위 앱 — appName으로 표시 (웹 버그 수정)");
    check(body.includes("주간 종합 리포트"), "주간 기록 — 종합 리포트");
    const firstBg = await style(page, '[data-testid="history-row"]', "backgroundColor");
    check(firstBg === ACCENT_SOFT, "가장 최근 기록 한 줄 강조", firstBg);

    await page.getByTestId("segment-weekly").click();
    await page.waitForTimeout(300);
    check((await page.getByTestId("history-row").count()) === 1, "필터 주간 → 1줄");
    await page.getByTestId("segment-daily").click();
    await page.waitForTimeout(300);
    check((await page.getByTestId("history-row").count()) === 9, "필터 일간 → 9줄");
    await page.getByTestId("segment-all").click();
    await page.waitForTimeout(300);

    await commonChecks("기록", page, errors, "history");
    await shots(page, "history-ready", "history");
    await page.close();
  }

  /* ── 기록 · 비어 있음 / 로딩 / 실패 ───────────────────── */
  {
    const empty = await open("/preview/history?state=empty", "history");
    check((await text(empty.page, "history-empty")).includes("아직 기록이 없어요"), "기록 빈 상태 안내");
    check((await empty.page.locator("body").innerText()).includes("기록이 2건 이상 쌓이면"), "추이 빈 상태 안내");
    await commonChecks("기록(빈)", empty.page, empty.errors, "history");
    await empty.page.close();

    const loading = await open("/preview/history?state=loading", "history");
    check(await loading.page.getByTestId("trend-skeleton").isVisible(), "기록 로딩 — 추이 스켈레톤");
    check((await loading.page.getByTestId("row-skeleton").count()) === 5, "기록 로딩 — 줄 스켈레톤 5개");
    await commonChecks("기록(로딩)", loading.page, loading.errors, "history");
    await loading.page.close();

    const failed = await open("/preview/history?state=error", "history");
    check((await text(failed.page, "history-error")).includes(OFFLINE_TEXT), "기록 실패 — 한국어 네트워크 안내");
    await commonChecks("기록(실패)", failed.page, failed.errors, "history");
    await shots(failed.page, "history-error", "history");
    await failed.page.close();
  }
} catch (err) {
  check(false, "검증 중 예외", String(err).split("\n")[0]);
} finally {
  await browser.close();
  stopServer();
}

console.log(`\n스크린샷: ${OUT_DIR}`);
if (failures.length) {
  console.error(`\nM4 웹 검증 실패 ${failures.length}건: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nM4 웹 검증을 통과했습니다.");
