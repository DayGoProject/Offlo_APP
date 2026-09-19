/**
 * M5 검증 ① — AI 분석 · 결과 · 코치 채팅 미리보기 화면 + Playwright (에이전트 자동 실행용)
 *
 *   node scripts/verify-M5-web.mjs
 *
 * 웹 미리보기는 CORS 때문에 실제 API를 부를 수 없다 — 가드 밖 `/preview/*`에 실제 화면과 같은 컴포넌트를
 * 샘플 값으로 띄워 레이아웃 · 상태 모양을 본다 (mobile.md). 실제 분석 · 저장 · 채팅은 ② 안드로이드(verify-M5-android.mjs).
 *
 * 샘플 기준 시각은 2026-09-17(목) 10:00(주간 열림 상태만 9/20 일요일 밤), 브라우저 시간대는 Asia/Seoul.
 *
 * 확인 항목
 *   분석 탭 — 오늘 분석 전 · 사진 고름 · 분석 중 · 저장만 실패 · 오늘 완료 · 주간 열림(7/7) · 빈 · 로딩 · 실패
 *     7칸이 요일 자리에 채워지는가 · n / 7 · 최근 결과(오늘/어제 라벨) · 분석 방법 모달 열고 닫기
 *   결과 — 점수 링(72% 채움) · 총 시간 · 라벨 · 카테고리 · 앱별 막대 · 시간대 패턴/안내 · 문제 · 원인 · 전략 · 루틴 · 추천 · 코치 첫 질문
 *   채팅 — 말풍선 좌우 · 보내기 비활성 → 글을 쓰면 활성 · 답 기다리는 점 · 보내기 실패 안내 · 첨부 미리보기
 *   공통 — 폰트(숫자 Familjen · 본문 Pretendard) · 바탕 #040508 · 가로 넘침 없음 · 콘솔 에러 0
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
const WHITE = "rgb(255, 255, 255)";
const BRAND = "rgb(61, 219, 135)";
const ACCENT_LINE = "rgba(61, 219, 135, 0.14)";
const OFFLINE_TEXT = "인터넷에 연결되어 있지 않거나";
const TIMEOUT_TEXT = "서버 응답이 너무 늦어";

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

async function open(path, rootTestId) {
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(`${URL}${path}`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.getByTestId(rootTestId).first().waitFor({ state: "visible", timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  return { page, errors, body: () => page.locator("body").innerText() };
}

const text = (page, testId) => page.getByTestId(testId).first().innerText().then((t) => t.trim());
const count = (page, testId) => page.getByTestId(testId).count();
const visible = (page, testId) => page.getByTestId(testId).first().isVisible();
const cssOf = (page, testId, prop) =>
  page.getByTestId(testId).first().evaluate((el, p) => getComputedStyle(el)[p], prop);

/** 가로 넘침 · 바탕 · 콘솔 에러 — rootTestId는 화면의 바깥 틀 */
async function common(name, page, errors, rootTestId) {
  const layout = await page.evaluate((id) => {
    const root = document.querySelector(`[data-testid="${id}"]`);
    return {
      doc: document.documentElement.scrollWidth <= window.innerWidth,
      inner: root ? root.scrollWidth <= root.clientWidth + 1 : false,
      bg: root ? getComputedStyle(root).backgroundColor : null,
    };
  }, rootTestId);
  check(layout.doc && layout.inner, `${name} · 가로 넘침 없음`);
  check(layout.bg === BG, `${name} · 바탕 #040508`, layout.bg);
  check(errors.length === 0, `${name} · 콘솔 에러 0`, errors.join(" | ").slice(0, 240));
}

async function shot(page, name, scrollTestId) {
  if (scrollTestId) {
    await page.evaluate((id) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (el) el.scrollTop = 0;
    }, scrollTestId);
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: join(OUT_DIR, `M5-${name}.png`) });
  if (scrollTestId) {
    await page.evaluate((id) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (el) el.scrollTop = el.scrollHeight;
    }, scrollTestId);
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT_DIR, `M5-${name}-bottom.png`) });
  }
}

const imageLoaded = (page, testId) =>
  page
    .waitForFunction(
      (id) => {
        const root = document.querySelector(`[data-testid="${id}"]`);
        const img = root?.tagName === "IMG" ? root : root?.querySelector("img");
        return Boolean(img && img.complete && img.naturalWidth > 0);
      },
      testId,
      { timeout: 15_000 },
    )
    .then(() => true)
    .catch(() => false);

try {
  /* ── 미리보기 목록 ─────────────────────────────────────── */
  {
    const { page, errors } = await open("/preview", "preview-index");
    const m5 = await page.locator('a[href*="/preview/analysis"], a[href*="/preview/result"], a[href*="/preview/chat"]').count();
    check(m5 === 19, "미리보기 목록 — 분석 9 · 결과 5 · 채팅 5", `${m5}개`);
    check(errors.length === 0, "미리보기 목록 · 콘솔 에러 0", errors.join(" | ").slice(0, 200));
    await page.close();
  }

  /* ── 분석 탭 · 오늘 분석 전 ───────────────────────────── */
  {
    const { page, errors, body } = await open("/preview/analysis?state=ready", "analysis");
    const b = await body();
    check(b.includes("오늘 분석 전 · 하루 1회"), "눈썹 — 오늘 분석 전");
    check(await visible(page, "stage-idle"), "무대 — 스크린샷 고르기");
    check(b.includes("이미지는 분석 즉시 폐기되며 저장되지 않습니다"), "무대 — 이미지 폐기 안내");
    check((await cssOf(page, "pick-screenshot", "backgroundColor")) === WHITE, "주 행동은 흰 알약 하나 (스크린샷 고르기)");

    check((await count(page, "week-slot-filled")) === 3, "7칸 — 월 · 화 · 수 3칸 채움");
    const slotScores = await page
      .locator('[data-testid="week-slots"] > div')
      .evaluateAll((els) => els.map((el) => el.innerText.replace(/\s+/g, " ").trim()));
    check(slotScores.slice(0, 4).join("|") === "58 월|61 화|66 수|목", "7칸 — 요일 자리에 점수 (오늘 목요일은 빈칸)", slotScores.join("|"));
    check(b.includes("3 / 7") && b.includes("4개 더 완료하면 열립니다"), "주간 — 3 / 7 · 4개 더");

    check((await count(page, "recent-row")) === 3, "최근 결과 3줄");
    const firstRecent = await text(page, "recent-row");
    check(firstRecent.includes("어제 · 일간") && firstRecent.includes("66"), "최근 결과 — 어제 · 66점", firstRecent.replace(/\s+/g, " "));
    check(b.includes("9월 15일 · 일간"), "최근 결과 — 그 전은 날짜 (KST)");

    await page.getByTestId("open-howto").click();
    await page.getByTestId("howto-modal").waitFor({ state: "visible", timeout: 5000 });
    const modal = await text(page, "howto-modal");
    check(modal.includes("iPhone") && modal.includes("디지털 웰빙"), "분석 방법 모달 — iPhone · Android 안내");
    await page.screenshot({ path: join(OUT_DIR, "M5-analysis-howto.png") });
    await page.getByTestId("howto-close").click();
    await page.waitForTimeout(500);
    check((await count(page, "howto-modal")) === 0 || !(await visible(page, "howto-modal")), "분석 방법 모달 — 닫힘");

    await common("분석(전)", page, errors, "analysis");
    await shot(page, "analysis-ready", "analysis");
    await page.close();
  }

  /* ── 분석 탭 · 흐름 상태 ──────────────────────────────── */
  {
    const picked = await open("/preview/analysis?state=picked", "analysis");
    check(await visible(picked.page, "stage-picked"), "사진 고름 — 미리보기 무대");
    check(await imageLoaded(picked.page, "picked-image"), "사진 고름 — 고른 사진이 그려짐");
    check(await visible(picked.page, "start-analysis"), "사진 고름 — AI 분석 시작");
    await common("분석(사진)", picked.page, picked.errors, "analysis");
    await shot(picked.page, "analysis-picked");
    await picked.page.close();

    const busy = await open("/preview/analysis?state=analyzing", "analysis");
    check((await busy.body()).includes("AI가 분석하고 있어요"), "분석 중 — 안내 문구");
    check(await visible(busy.page, "cancel-analysis"), "분석 중 — 취소 버튼");
    await common("분석(중)", busy.page, busy.errors, "analysis");
    await shot(busy.page, "analysis-busy");
    await busy.page.close();

    const failed = await open("/preview/analysis?state=save-failed", "analysis");
    check(await visible(failed.page, "retry-save"), "저장만 실패 — 저장 다시 시도");
    check((await failed.body()).includes("분석을 다시 하지 않고 저장만"), "저장만 실패 — AI를 다시 부르지 않는다는 안내");
    check((await text(failed.page, "upload-error")).includes(OFFLINE_TEXT), "저장만 실패 — 한국어 네트워크 안내");
    await common("분석(저장실패)", failed.page, failed.errors, "analysis");
    await shot(failed.page, "analysis-save-failed");
    await failed.page.close();
  }

  /* ── 분석 탭 · 오늘 완료 / 주간 열림 ──────────────────── */
  {
    const done = await open("/preview/analysis?state=done", "analysis");
    const b = await done.body();
    check(b.includes("오늘 분석 완료 · 하루 1회"), "완료 — 눈썹");
    check(await visible(done.page, "stage-done"), "완료 — 오늘 분석을 마쳤어요");
    check((await cssOf(done.page, "open-today-result", "backgroundColor")) === WHITE, "완료 — 오늘 결과 보기(흰 알약)");
    check(b.includes("4 / 7") && (await count(done.page, "week-slot-filled")) === 4, "완료 — 4 / 7 · 오늘(오전 8시) 칸 채움");
    check((await text(done.page, "recent-row")).includes("오늘 · 일간"), "완료 — 최근 결과 첫 줄이 오늘");
    await common("분석(완료)", done.page, done.errors, "analysis");
    await shot(done.page, "analysis-done", "analysis");
    await done.page.close();

    const weekly = await open("/preview/analysis?state=weekly", "analysis");
    check((await weekly.body()).includes("7 / 7") && (await count(weekly.page, "week-slot-filled")) === 7, "주간 열림 — 7 / 7 · 7칸");
    check(await visible(weekly.page, "start-weekly"), "주간 열림 — 이번 주 종합 분석 시작");
    check((await cssOf(weekly.page, "weekly-card", "borderTopColor")) === ACCENT_LINE, "주간 열림 — 카드 테두리 브랜드 그린");
    await common("분석(주간)", weekly.page, weekly.errors, "analysis");
    await weekly.page.getByTestId("weekly-card").scrollIntoViewIfNeeded();
    await shot(weekly.page, "analysis-weekly");
    await weekly.page.close();
  }

  /* ── 분석 탭 · 빈 / 로딩 / 실패 ───────────────────────── */
  {
    const empty = await open("/preview/analysis?state=empty", "analysis");
    const b = await empty.body();
    check(b.includes("0 / 7") && b.includes("오늘 분석부터 시작해 보세요"), "빈 — 0 / 7 · 시작 안내");
    check(b.includes("이번 주 기록이 아직 없어요"), "빈 — 최근 결과 안내");
    check((await count(empty.page, "week-slot")) === 7, "빈 — 빈칸 7개");
    await common("분석(빈)", empty.page, empty.errors, "analysis");
    await empty.page.close();

    const loading = await open("/preview/analysis?state=loading", "analysis");
    check(await visible(loading.page, "stage-skeleton"), "로딩 — 무대 스켈레톤");
    check((await loading.body()).includes("불러오는 중"), "로딩 — 눈썹 · 주간 '불러오는 중'");
    await common("분석(로딩)", loading.page, loading.errors, "analysis");
    await loading.page.close();

    const failed = await open("/preview/analysis?state=error", "analysis");
    check((await text(failed.page, "analysis-error")).includes(OFFLINE_TEXT), "실패 — 한국어 네트워크 안내");
    check(await visible(failed.page, "retry-button"), "실패 — 다시 시도");
    check((await count(failed.page, "stage-idle")) === 0, "실패 — 기록을 모르면 업로드 무대를 그리지 않는다");
    await common("분석(실패)", failed.page, failed.errors, "analysis");
    await shot(failed.page, "analysis-error");
    await failed.page.close();
  }

  /* ── 결과 · 일간 ──────────────────────────────────────── */
  {
    const { page, errors, body } = await open("/preview/result?state=ready", "result");
    const b = await body();
    check(b.includes("일간 분석 · 2026.09.17"), "눈썹 — 일간 · 날짜");
    check((await text(page, "score-value")) === "72", "점수 72");
    const ratio = await page.locator('[data-testid="score-ring"] circle').nth(1).evaluate((el) => {
      const [filled, total] = (el.getAttribute("stroke-dasharray") ?? "").split(/[ ,]+/).map(Number);
      return filled / total;
    });
    check(Math.abs(ratio - 0.72) < 0.005, "점수 링 72% 채움", ratio.toFixed(3));
    check((await text(page, "result-total")) === "4h 12m" && b.includes("건강한 사용"), "총 4h 12m · 건강한 사용");
    const scoreFont = await cssOf(page, "score-value", "fontFamily");
    check(scoreFont.includes("FamiljenGrotesk"), "숫자는 Familjen Grotesk", scoreFont);
    check((await count(page, "category-chip")) === 3 && b.includes("SNS 1시간 36분"), "카테고리 칩 3개 · SNS 1시간 36분");
    check((await count(page, "app-row")) === 5, "앱별 사용 시간 5줄");
    check(await visible(page, "result-patterns"), "시간대별 사용 패턴");
    for (const title of ["내 사용 패턴의 핵심 문제", "왜 이런 패턴이 생겼을까요?", "가장 효과적인 디톡스 전략", "하루 실천 루틴", "맞춤 디톡스 추천"])
      check(b.includes(title), `섹션 — ${title}`);
    check(b.includes("STRATEGY 01") && b.includes("STRATEGY 03"), "전략 번호 01~03");
    check(["아침", "낮", "밤"].every((l) => b.includes(l)), "루틴 — 아침 · 낮 · 밤");
    check((await text(page, "coach-opening")).startsWith("밤 10시 이후에"), "코치 — 첫 시간대 질문으로 시작");
    check(await visible(page, "open-chat"), "코치와 대화하기");
    check((await count(page, "premium-note")) === 0, "프리미엄 분석엔 안내 없음");
    await common("결과(일간)", page, errors, "result");
    await shot(page, "result-ready", "result");
    await page.close();
  }

  /* ── 결과 · 무료 / 주간 / 로딩 / 실패 ─────────────────── */
  {
    const free = await open("/preview/result?state=free", "result");
    check(await visible(free.page, "premium-note"), "무료 — 시간대 패턴 대신 안내");
    check((await count(free.page, "result-patterns")) === 0, "무료 — 시간대 패턴 섹션 없음");
    const freeBody = await free.body();
    check(!/결제|구독|원\b|무료로/.test(freeBody), "무료 — 결제 · 가격 문구 없음 (design.md)");
    await common("결과(무료)", free.page, free.errors, "result");
    await free.page.close();

    const weekly = await open("/preview/result?state=weekly", "result");
    const wb = await weekly.body();
    check(wb.includes("주간 분석 · 2026.09.13") && wb.includes("이번 주 총 스크린타임"), "주간 — 눈썹 · 이번 주 문구");
    check((await text(weekly.page, "result-total")) === "35h 4m", "주간 — 총 35h 4m", await text(weekly.page, "result-total"));
    await common("결과(주간)", weekly.page, weekly.errors, "result");
    await weekly.page.close();

    const loading = await open("/preview/result?state=loading", "result");
    check(await visible(loading.page, "result-skeleton"), "로딩 — 스켈레톤");
    await common("결과(로딩)", loading.page, loading.errors, "result");
    await loading.page.close();

    const failed = await open("/preview/result?state=error", "result");
    check((await text(failed.page, "result-error")).includes(OFFLINE_TEXT), "실패 — 한국어 네트워크 안내");
    await common("결과(실패)", failed.page, failed.errors, "result");
    await failed.page.close();
  }

  /* ── 채팅 ─────────────────────────────────────────────── */
  {
    const { page, errors } = await open("/preview/chat?state=ready", "chat");
    check((await count(page, "bubble-model")) === 2 && (await count(page, "bubble-user")) === 1, "말풍선 — 코치 2 · 나 1");
    const align = await page.evaluate(() => {
      const box = (id) => document.querySelector(`[data-testid="${id}"]`).getBoundingClientRect();
      return { model: box("bubble-model").left, user: box("bubble-user").right, width: window.innerWidth };
    });
    check(align.model < 40 && align.user > align.width - 40, "말풍선 — 코치 왼쪽 · 나 오른쪽", JSON.stringify(align));
    const disabled = () => page.getByTestId("send-message").getAttribute("aria-disabled");
    check((await disabled()) === "true", "보내기 — 빈 입력이면 비활성");
    await page.getByTestId("chat-input").fill("밤에 휴대폰을 덜 보려면?");
    check((await disabled()) !== "true", "보내기 — 글을 쓰면 활성");
    const bodyFont = await page.getByTestId("bubble-model").first().locator("div").last().evaluate((el) => getComputedStyle(el).fontFamily);
    check(bodyFont.includes("Pretendard"), "본문은 Pretendard", bodyFont);
    await common("채팅", page, errors, "chat");
    await shot(page, "chat-ready");
    await page.close();

    const sending = await open("/preview/chat?state=sending", "chat");
    check(await visible(sending.page, "typing"), "답 기다리는 중 — 점 세 개");
    const sentImage = await sending.page
      .waitForFunction(
        () =>
          [...document.querySelectorAll('[data-testid="bubble-user"] img')].some((img) => img.complete && img.naturalWidth > 0),
        null,
        { timeout: 15_000 },
      )
      .then(() => true)
      .catch(() => false);
    check(sentImage, "보낸 사진이 말풍선에 그려짐");
    await common("채팅(대기)", sending.page, sending.errors, "chat");
    await shot(sending.page, "chat-sending");
    await sending.page.close();

    const failedSend = await open("/preview/chat?state=send-error", "chat");
    check((await text(failedSend.page, "send-error")).includes(TIMEOUT_TEXT), "보내기 실패 — 한국어 안내");
    check(await visible(failedSend.page, "pending-image"), "보내기 실패 — 첨부 사진이 입력줄에 남아 있음");
    check((await failedSend.page.getByTestId("chat-input").inputValue()).length > 0, "보내기 실패 — 보낸 글이 입력창으로 돌아옴");
    await common("채팅(실패)", failedSend.page, failedSend.errors, "chat");
    await shot(failedSend.page, "chat-send-error");
    await failedSend.page.close();

    const loading = await open("/preview/chat?state=loading", "chat");
    check(await visible(loading.page, "chat-skeleton"), "채팅 로딩 — 스켈레톤");
    check((await loading.page.getByTestId("send-message").getAttribute("aria-disabled")) === "true", "채팅 로딩 — 보내기 비활성");
    await common("채팅(로딩)", loading.page, loading.errors, "chat");
    await loading.page.close();

    const failed = await open("/preview/chat?state=error", "chat");
    check((await text(failed.page, "chat-error")).includes(OFFLINE_TEXT), "채팅 실패 — 한국어 네트워크 안내");
    await common("채팅(실패)", failed.page, failed.errors, "chat");
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
  console.error(`\nM5 웹 검증 실패 ${failures.length}건: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nM5 웹 검증을 통과했습니다.");
