/**
 * M7 검증 ① — 목표 · 배지 · 커뮤니티 · 설정 미리보기 화면 + Playwright (에이전트 자동 실행용)
 *
 *   node scripts/verify-M7-web.mjs
 *
 * 웹 미리보기는 CORS 때문에 실제 API를 부를 수 없고 Playwright는 Google 로그인을 못 넘는다.
 * 그래서 가드 밖 `/preview/*`에 **실제 화면과 같은 컴포넌트**를 샘플 값 + 화면 안 가짜 서버로 띄워 끝까지 눌러 본다.
 * 실데이터 · 저장 · 실서버 동작은 ② 안드로이드(verify-M7-android.mjs).
 *
 * 샘플 기준 시각은 KST 2026-09-17(목) 10:00이고, 브라우저 시간대를 Asia/Seoul로 고정한다.
 *
 * 확인 항목
 *   목표(7-1) — 진행 중 · 끝남 · 시작 전 카드의 진행률 · 완료한 목록 · 완료 숨기기 · 삭제 / 완료 처리의 "한 번 더 묻기" · 보내는 중 잠금(두 번 눌러도 한 번) · 실패 안내 ·
 *            추가 폼(제목 검증 · 빠른 선택 · 직접 입력 · 달력 · 종료일은 시작일 다음 날부터 · 시작일을 밀면 종료일도) · 수정 · 빈 상태 · 로딩 · 실패
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

const text = (page, testId) => page.getByTestId(testId).first().innerText().then((t) => t.replace(/\s+/g, " ").trim());
const count = (page, testId) => page.getByTestId(testId).count();

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

const calls = (page) => page.evaluate(() => [...(globalThis.__offloGoalCalls ?? [])]);

try {
  /* ── 목표 (7-1) ─────────────────────────────────────────── */
  {
    const { page, errors } = await open("/preview/goals?state=ready", "goals");
    check((await page.locator("body").innerText()).includes("진행 중 4개 · 완료 2개"), "목표 · 머리글 요약 \"진행 중 4개 · 완료 2개\"");
    check((await count(page, "goal-ga")) === 1 && (await count(page, "goal-gb")) === 1 && (await count(page, "goal-gc")) === 1 && (await count(page, "goal-gd")) === 1, "진행 중 카드 4장");
    check((await count(page, "goal-done-ge")) === 1 && (await count(page, "goal-done-gf")) === 1, "완료한 목표 2줄");

    check((await text(page, "goal-title-ga")) === "하루 4시간 이하", "카드 제목");
    check((await text(page, "goal-pct-ga")) === "57%" && (await text(page, "goal-note-ga")) === "7일 중 4일 지남 · 3일 남음", "9/14~9/20 — 57% · 7일 중 4일 지남 · 3일 남음", await text(page, "goal-note-ga"));
    check((await text(page, "goal-pct-gb")) === "20%" && (await text(page, "goal-note-gb")) === "15일 중 3일 지남 · 12일 남음", "9/15~9/29 — 20%");
    check((await text(page, "goal-pct-gc")) === "100%" && (await text(page, "goal-note-gc")) === "10일 중 10일 지남 · 기간이 끝났어요", "끝난 기간 — 100% · \"기간이 끝났어요\"");
    check((await text(page, "goal-pct-gd")) === "0%" && (await text(page, "goal-note-gd")) === "아직 시작 전이에요 · 4일 뒤 시작", "시작 전 — 0% · \"4일 뒤 시작\"");
    const colorOf = (id) => page.getByTestId(id).evaluate((el) => getComputedStyle(el).color);
    check((await colorOf("goal-note-ga")) === "rgb(61, 219, 135)" && (await colorOf("goal-note-gc")) !== "rgb(61, 219, 135)" && (await colorOf("goal-note-gd")) !== "rgb(61, 219, 135)", "진행 중만 브랜드 그린 — 끝난 · 시작 전 목표는 강조하지 않는다");
    check((await text(page, "goal-done-ge")).includes("+20분") && (await text(page, "goal-done-ge")).includes("2026.09.07 까지"), "완료한 목표 — 종료일 · +20분");

    // 완료 숨기기
    await page.getByTestId("goals-toggle-done").click();
    check((await count(page, "goals-done")) === 0 && (await text(page, "goals-toggle-done")) === "완료한 목표", "완료 숨기기 → 목록이 접히고 버튼이 \"완료한 목표\"로");
    await page.getByTestId("goals-toggle-done").click();
    check((await count(page, "goals-done")) === 1, "다시 누르면 펼쳐진다");

    await page.screenshot({ path: join(OUT_DIR, "M7-goals-ready.png"), fullPage: true });

    // 삭제 — 한 번 더 묻는다
    await page.getByTestId("goal-delete-gb").click();
    check((await count(page, "goal-ask-gb")) === 1 && (await text(page, "goal-ask-gb")).includes("삭제할까요"), "삭제를 누르면 카드 안에서 한 번 더 묻는다");
    check((await count(page, "goal-edit-gb")) === 0, "묻는 동안 다른 버튼은 감춘다");
    await page.getByTestId("goal-ask-cancel-gb").click();
    check((await count(page, "goal-ask-gb")) === 0 && (await count(page, "goal-gb")) === 1 && (await calls(page)).length === 0, "취소하면 아무 일도 없고 서버에도 안 간다");
    await page.getByTestId("goal-delete-gb").click();
    await page.getByTestId("goal-ask-ok-gb").click();
    await page.getByTestId("goal-gb").waitFor({ state: "detached", timeout: 5000 });
    check((await calls(page)).join() === "delete gb", "삭제 확인 → 서버에 한 번 · 카드가 사라진다", (await calls(page)).join());
    check((await page.locator("body").innerText()).includes("진행 중 3개 · 완료 2개"), "머리글이 \"진행 중 3개\"로");

    // 완료 처리 — 식물이 자란다고 알리고 한 번 더 묻는다 · 두 번 눌러도 한 번만 간다
    await page.getByTestId("goal-complete-ga").click();
    check((await text(page, "goal-ask-ga")).includes("식물이 20분 자라요"), "완료 처리를 누르면 \"식물이 20분 자라요 · 되돌릴 수 없어요\"라고 묻는다");
    await page.getByTestId("goal-ask-ok-ga").dblclick();
    await page.getByTestId("goal-done-ga").waitFor({ state: "visible", timeout: 5000 });
    check((await calls(page)).filter((c) => c === "complete ga").length === 1, "완료 처리를 연달아 눌러도 서버에는 한 번만 간다 (보상을 두 번 받지 않는다)", (await calls(page)).join());
    check((await count(page, "goal-ga")) === 0 && (await page.locator("body").innerText()).includes("진행 중 2개 · 완료 3개"), "완료한 목표 목록으로 옮겨 간다 (진행 중 2 · 완료 3)");

    // 완료한 목표 삭제도 한 번 더 묻는다
    await page.getByTestId("goal-done-delete-ge").click();
    check((await text(page, "goal-done-ge")).includes("이 기록을 삭제할까요?"), "완료한 목표 삭제도 한 번 더 묻는다");
    await page.getByTestId("goal-ask-cancel-ge").click();
    check((await count(page, "goal-done-ge")) === 1, "취소하면 그대로");

    await commonChecks("목표", page, errors, "goals");
    await page.close();
  }

  // 서버 저장이 실패하면 — 완료 · 삭제는 카드 위에 안내, 목록은 그대로
  {
    const { page } = await open("/preview/goals?state=ready&fail=1", "goals");
    await page.getByTestId("goal-complete-gb").click();
    await page.getByTestId("goal-ask-ok-gb").click();
    await page.getByTestId("goals-action-error").waitFor({ state: "visible", timeout: 5000 });
    check((await text(page, "goals-action-error")).includes(OFFLINE_TEXT), "완료 실패 — 한국어 네트워크 안내");
    check((await count(page, "goal-gb")) === 1 && (await count(page, "goal-done-gb")) === 0, "완료 실패 — 목표는 진행 중 그대로 남는다");
    await page.close();
  }

  // 추가 폼
  {
    const { page, errors } = await open("/preview/goals?state=ready&open=form", "goals");
    await page.getByTestId("goal-form").waitFor({ state: "visible" });
    check((await page.getByTestId("goal-start").innerText()).includes("2026.09.17 (목)") && (await page.getByTestId("goal-end").innerText()).includes("2026.09.24 (목)"), "기본값 — 오늘(KST 9/17)부터 일주일 (9/24)");
    check((await page.getByTestId("goal-minutes").inputValue()) === "60" && (await text(page, "goal-minutes-hint")) === "현재 설정: 하루 1시간 이하", "기본 하루 목표 60분 — \"하루 1시간 이하\"");
    check((await page.getByTestId("goal-preset-60").getAttribute("aria-selected")) === "true" || (await page.getByTestId("goal-preset-60").evaluate((el) => getComputedStyle(el).backgroundColor)) === "rgba(61, 219, 135, 0.13)", "빠른 선택 60분이 켜져 있다");
    await page.screenshot({ path: join(OUT_DIR, "M7-goal-form.png") });

    // 제목 검증
    await page.getByTestId("goal-submit").click();
    check((await text(page, "goal-form-error")) === "제목을 입력해주세요." && (await calls(page)).length === 0, "제목이 비면 \"제목을 입력해주세요.\" — 서버에 보내지 않는다");

    // 빠른 선택 · 직접 입력
    await page.getByTestId("goal-preset-90").click();
    check((await page.getByTestId("goal-minutes").inputValue()) === "90" && (await text(page, "goal-minutes-hint")) === "현재 설정: 하루 1시간 30분 이하", "90분 선택 → 입력칸 90 · \"1시간 30분 이하\"");
    await page.getByTestId("goal-minutes").fill("45분abc");
    check((await page.getByTestId("goal-minutes").inputValue()) === "45" && (await text(page, "goal-minutes-hint")) === "현재 설정: 하루 45분 이하", "직접 입력 — 숫자만 남는다 (\"45분abc\" → 45)");
    await page.getByTestId("goal-minutes").fill("");
    check((await text(page, "goal-minutes-hint")) === "1분 이상으로 정해주세요.", "입력을 비우면 안내가 바뀐다");
    await page.getByTestId("goal-submit").click();
    check((await text(page, "goal-form-error")) === "제목을 입력해주세요.", "제목 검사가 먼저 걸린다");
    await page.getByTestId("goal-title").fill("저녁엔 폰 내려놓기");
    await page.getByTestId("goal-submit").click();
    check((await text(page, "goal-form-error")).includes("하루 목표 시간은 1~10080분"), "시간이 비면 거절 문구", await text(page, "goal-form-error"));
    await page.getByTestId("goal-minutes").fill("99999");
    check((await page.getByTestId("goal-minutes").inputValue()).length <= 5, "시간 입력은 5자리까지");
    await page.getByTestId("goal-minutes").fill("45");

    // 달력 — 종료일은 시작일 다음 날부터
    await page.getByTestId("goal-end").click();
    await page.getByTestId("date-picker").waitFor({ state: "visible" });
    check((await text(page, "date-month")) === "2026년 9월", "종료일 달력 — 선택된 날짜의 달(2026년 9월)에서 열린다");
    check((await page.getByTestId("date-2026-09-17").isDisabled()) && (await page.getByTestId("date-2026-09-10").isDisabled()) && !(await page.getByTestId("date-2026-09-18").isDisabled()), "종료일은 시작일 이전 · 같은 날을 고를 수 없다 (9/17 이하 비활성 · 9/18부터 가능)");
    const dayBg = (key) => page.getByTestId(`date-${key}`).evaluate((el) => getComputedStyle(el.firstElementChild).backgroundColor);
    check((await page.getByTestId("date-2026-09-17").getAttribute("aria-label")) === "9월 17일 오늘", "오늘(9/17)에 \"오늘\" 접근성 라벨");
    check((await dayBg("2026-09-24")) === "rgb(61, 219, 135)" && (await dayBg("2026-09-25")) !== "rgb(61, 219, 135)", "지금 고른 날(9/24)만 브랜드 그린 원");
    await page.getByTestId("date-next").click();
    check((await text(page, "date-month")) === "2026년 10월", "다음 달");
    await page.getByTestId("date-prev").click();
    await page.getByTestId("date-prev").click();
    check((await text(page, "date-month")) === "2026년 8월", "이전 달 두 번 → 8월");
    await page.getByTestId("date-next").click();
    await page.screenshot({ path: join(OUT_DIR, "M7-goal-datepicker.png") });
    await page.getByTestId("date-2026-09-30").click();
    await page.getByTestId("date-picker").waitFor({ state: "detached", timeout: 5000 });
    check((await page.getByTestId("goal-end").innerText()).includes("2026.09.30 (수)"), "날짜를 누르면 달력이 닫히고 종료일이 바뀐다 (2026.09.30 (수))");

    // 시작일을 종료일 이후로 밀면 종료일도 따라간다
    await page.getByTestId("goal-start").click();
    await page.getByTestId("date-next").click();
    await page.getByTestId("date-2026-10-05").click();
    await page.getByTestId("date-picker").waitFor({ state: "detached", timeout: 5000 });
    check((await page.getByTestId("goal-start").innerText()).includes("2026.10.05 (월)") && (await page.getByTestId("goal-end").innerText()).includes("2026.10.12 (월)"), "시작일을 종료일 이후(10/5)로 바꾸면 종료일이 일주일 뒤(10/12)로 따라간다");
    // 시작일을 다시 앞으로 당기면 종료일은 그대로 둔다 (종료일이 여전히 시작일 이후니까)
    await page.getByTestId("goal-start").click();
    await page.getByTestId("date-prev").click();
    await page.getByTestId("date-2026-09-17").click();
    await page.getByTestId("date-picker").waitFor({ state: "detached", timeout: 5000 });
    check((await page.getByTestId("goal-start").innerText()).includes("2026.09.17 (목)") && (await page.getByTestId("goal-end").innerText()).includes("2026.10.12 (월)"), "시작일을 앞으로 당기면 종료일은 그대로(10/12)");

    // 저장
    await page.getByTestId("goal-submit").click();
    await page.getByTestId("goal-form").waitFor({ state: "detached", timeout: 5000 });
    check((await calls(page)).join() === "create 저녁엔 폰 내려놓기", "저장 → 서버에 한 번", (await calls(page)).join());
    check((await page.locator("body").innerText()).includes("저녁엔 폰 내려놓기") && (await page.locator("body").innerText()).includes("진행 중 5개 · 완료 2개"), "새 목표가 맨 위에 들어오고 머리글이 \"진행 중 5개\"로");
    await commonChecks("목표 추가", page, errors, "goals");
    await page.close();
  }

  // 추가 실패 — 폼이 열린 채 안내
  {
    const { page } = await open("/preview/goals?state=ready&open=form&fail=1", "goals");
    await page.getByTestId("goal-title").fill("실패해 볼 목표");
    await page.getByTestId("goal-submit").click();
    await page.getByTestId("goal-form-error").waitFor({ state: "visible", timeout: 5000 });
    check((await text(page, "goal-form-error")).includes(OFFLINE_TEXT) && (await count(page, "goal-form")) === 1, "추가 실패 — 폼은 열려 있고 한국어 네트워크 안내가 폼 안에 뜬다");
    await page.getByTestId("goal-cancel").click();
    check((await count(page, "goal-form")) === 0, "취소하면 닫힌다");
    await page.close();
  }

  // 수정
  {
    const { page } = await open("/preview/goals?state=ready", "goals");
    await page.getByTestId("goal-edit-ga").click();
    check((await page.getByTestId("goal-title").inputValue()) === "하루 4시간 이하" && (await page.getByTestId("goal-minutes").inputValue()) === "240", "수정 — 기존 제목 · 시간이 채워져 있다");
    check((await page.getByTestId("goal-start").innerText()).includes("2026.09.14 (월)") && (await page.getByTestId("goal-end").innerText()).includes("2026.09.20 (일)"), "수정 — 기존 기간이 채워져 있다 (서버의 UTC 자정 값이 그대로 같은 날짜로)");
    check((await text(page, "goal-submit")) === "저장" && (await page.locator("body").innerText()).includes("목표 수정"), "수정 — 제목 \"목표 수정\" · 버튼 \"저장\"");
    await page.getByTestId("goal-title").fill("하루 3시간 이하");
    await page.getByTestId("goal-submit").click();
    await page.getByTestId("goal-form").waitFor({ state: "detached", timeout: 5000 });
    check((await text(page, "goal-title-ga")) === "하루 3시간 이하" && (await calls(page)).join() === "update ga", "수정 저장 → 제목이 바뀌고 서버에 한 번");
    await page.close();
  }

  // 빈 상태 · 로딩 · 실패
  {
    const empty = await open("/preview/goals?state=empty", "goals");
    check((await count(empty.page, "goals-empty")) === 1 && (await text(empty.page, "goals-empty")).includes("진행 중인 목표가 없어요"), "빈 상태 — 안내");
    await empty.page.getByTestId("goal-add-empty").click();
    check((await count(empty.page, "goal-form")) === 1, "빈 상태 — \"목표 추가하기\"가 폼을 연다");
    await empty.page.getByTestId("goal-cancel").click();
    check((await count(empty.page, "goals-toggle-done")) === 0, "완료한 목표가 없으면 \"완료 숨기기\" 버튼이 없다");
    await commonChecks("목표(빈 상태)", empty.page, empty.errors, "goals");
    await empty.page.close();

    const loading = await open("/preview/goals?state=loading", "goals");
    check((await count(loading.page, "goals-skeleton")) === 1 && (await count(loading.page, "goals-empty")) === 0, "로딩 — 스켈레톤 (빈 상태 안내는 아직 안 띄운다)");
    await loading.page.close();

    const failed = await open("/preview/goals?state=error", "goals");
    check((await text(failed.page, "goals-error")).includes(OFFLINE_TEXT) && (await count(failed.page, "retry-button")) === 1, "실패 — 한국어 네트워크 안내 + 다시 시도");
    check((await count(failed.page, "goals-skeleton")) === 0 && (await count(failed.page, "goals-empty")) === 0, "실패 — 스켈레톤 · 빈 상태를 겹쳐 그리지 않는다");
    await commonChecks("목표(실패)", failed.page, failed.errors, "goals");
    await failed.page.close();
  }
  /* ── 배지 (7-2) ─────────────────────────────────────────── */
  {
    const badgeCalls = (page) => page.evaluate(() => [...(globalThis.__offloBadgeCalls ?? [])]);
    const { page, errors } = await open("/preview/badges?state=ready", "badges");
    check((await page.locator("body").innerText()).includes("2개 획득 · 2개 남음"), "배지 · 머리글 \"2개 획득 · 2개 남음\"");
    check((await text(page, "badge-name-bd-1")) === "7일 연속" && (await text(page, "badge-bd-1")).includes("2026.09.16 획득"), "획득한 배지 — 이름 · 획득일");
    check((await text(page, "badge-share-bd-1")) === "자랑하기" && (await page.getByTestId("badge-share-bd-1").isEnabled()), "아직 안 자랑한 배지는 \"자랑하기\"");
    check((await text(page, "badge-share-bd-2")) === "공유함" && (await page.getByTestId("badge-share-bd-2").isDisabled()), "이미 자랑한 배지는 \"공유함\"으로 잠긴다");
    check((await count(page, "badge-locked-주간 분석 완료")) === 1 && (await count(page, "badge-locked-목표 달성")) === 1 && (await count(page, "badge-locked-7일 연속")) === 0 && (await count(page, "badge-locked-첫 분석")) === 0, "잠긴 배지는 획득하지 않은 둘(주간 분석 완료 · 목표 달성)뿐");
    check((await text(page, "badge-note-주간 분석 완료")) === "이번 주 일간 분석 3 / 7회", "잠긴 배지 진행 — \"이번 주 일간 분석 3 / 7회\"");
    check((await text(page, "badge-note-목표 달성")) === "목표를 하나 완료하면 획득", "잠긴 배지 — 목표 달성 안내");
    const fillWidth = await page.getByTestId("badge-locked-주간 분석 완료").evaluate((el) => {
      const track = el.lastElementChild;
      return Math.round((track.firstElementChild.getBoundingClientRect().width / track.getBoundingClientRect().width) * 100);
    });
    check(fillWidth === 43, "진행 막대 43% (3 / 7)", String(fillWidth));
    await page.screenshot({ path: join(OUT_DIR, "M7-badges-ready.png"), fullPage: true });

    // 자랑하기 — 취소 · 한마디 없이 · 한마디와 함께 · 연달아 눌러도 한 번
    await page.getByTestId("badge-share-bd-1").click();
    check((await count(page, "share-modal")) === 1 && (await text(page, "share-badge-name")) === "7일 연속", "자랑하기 → 모달에 공유할 배지 \"7일 연속\"");
    await page.getByTestId("share-cancel").click();
    await page.getByTestId("share-modal").waitFor({ state: "detached", timeout: 5000 });
    check((await badgeCalls(page)).length === 0, "취소하면 서버에 안 간다");
    await page.getByTestId("badge-share-bd-1").click();
    await page.getByTestId("share-message").fill("  드디어 7일 연속!  ");
    await page.getByTestId("share-submit").dblclick();
    await page.getByTestId("share-modal").waitFor({ state: "detached", timeout: 5000 });
    check(JSON.stringify(await badgeCalls(page)) === JSON.stringify(['share bd-1 "드디어 7일 연속!"', "community"]), "공유 — 한마디는 공백을 자르고 서버에 한 번, 이어서 커뮤니티로 간다 (연달아 눌러도 한 번)", (await badgeCalls(page)).join(" | "));
    check((await text(page, "badge-share-bd-1")) === "공유함", "공유한 배지는 \"공유함\"으로 바뀐다");
    await commonChecks("배지", page, errors, "badges");
    await page.close();
  }
  {
    const badgeCalls = (page) => page.evaluate(() => [...(globalThis.__offloBadgeCalls ?? [])]);
    // 한마디는 선택 · 1000자까지만 들어간다
    const a = await open("/preview/badges?state=ready&share=bd-1", "badges");
    await a.page.getByTestId("share-modal").waitFor({ state: "visible" });
    await a.page.getByTestId("share-message").fill("가".repeat(1500));
    check((await a.page.getByTestId("share-message").inputValue()).length === 1000, "한마디는 1000자에서 멈춘다");
    await a.page.getByTestId("share-message").fill("");
    await a.page.getByTestId("share-submit").click();
    await a.page.getByTestId("share-modal").waitFor({ state: "detached", timeout: 5000 });
    check((await badgeCalls(a.page))[0] === 'share bd-1 ""', "한마디 없이도 공유된다 (선택 사항)", (await badgeCalls(a.page)).join(" | "));
    await a.page.close();

    // 실패 — 모달은 열려 있고 안내
    const f = await open("/preview/badges?state=ready&share=bd-1&fail=1", "badges");
    await f.page.getByTestId("share-submit").click();
    await f.page.getByTestId("share-error").waitFor({ state: "visible", timeout: 5000 });
    check((await text(f.page, "share-error")).includes(OFFLINE_TEXT) && (await count(f.page, "share-modal")) === 1, "공유 실패 — 모달은 열려 있고 한국어 네트워크 안내가 뜬다");
    check((await text(f.page, "badge-share-bd-1")) === "자랑하기", "공유 실패 — 배지는 그대로 \"자랑하기\"");
    await f.page.close();

    // 이미 공유했다(409) — 서버 문구를 그대로 보여 주고 목록은 "공유함"으로 맞춘다
    const c = await open("/preview/badges?state=ready&share=bd-1&fail=409", "badges");
    await c.page.getByTestId("share-submit").click();
    await c.page.getByTestId("share-error").waitFor({ state: "visible", timeout: 5000 });
    check((await text(c.page, "share-error")) === "이미 공유한 배지입니다.", "이미 공유한 배지(409) — 서버 문구 그대로");
    await c.page.getByTestId("share-cancel").click();
    await c.page.getByTestId("share-modal").waitFor({ state: "detached", timeout: 5000 });
    check((await text(c.page, "badge-share-bd-1")) === "공유함", "409 뒤 — 목록이 \"공유함\"으로 맞는다");
    await c.page.close();

    // 모두 획득 · 첫 사용 · 진행도를 못 읽음 · 로딩 · 실패
    const all = await open("/preview/badges?state=all", "badges");
    check((await all.page.locator("body").innerText()).includes("4개 획득 · 0개 남음") && (await all.page.getByText("아직 잠긴 배지").count()) === 0, "모두 획득 — 잠긴 배지 구역이 없다");
    await all.page.close();

    const empty = await open("/preview/badges?state=empty", "badges");
    check((await count(empty.page, "badges-empty")) === 1 && (await empty.page.locator("body").innerText()).includes("0개 획득 · 4개 남음"), "첫 사용 — \"아직 획득한 배지가 없어요\" · 4개 모두 잠김");
    check((await text(empty.page, "badge-note-첫 분석")) === "AI 분석 1회면 획득" && (await text(empty.page, "badge-note-7일 연속")) === "연속 기록을 시작해 보세요", "첫 사용 — 잠긴 배지 안내");
    await commonChecks("배지(첫 사용)", empty.page, empty.errors, "badges");
    await empty.page.close();

    const nostats = await open("/preview/badges?state=nostats", "badges");
    check((await text(nostats.page, "badge-note-주간 분석 완료")) === "이번 주 일간 분석 7회를 채우면 획득", "진행도를 못 읽으면 달성 조건 문구 (0으로 속이지 않는다)");
    const bars = await nostats.page.getByTestId("badge-locked-주간 분석 완료").evaluate((el) => el.children.length);
    check(bars === 2, "진행도를 못 읽으면 진행 막대를 그리지 않는다 (아이콘 · 글자 영역뿐)", String(bars));
    await nostats.page.close();

    const loading = await open("/preview/badges?state=loading", "badges");
    check((await count(loading.page, "badges-skeleton")) === 1 && (await count(loading.page, "badges-empty")) === 0, "로딩 — 스켈레톤 (빈 상태 안내는 아직 안 띄운다)");
    await loading.page.close();

    const failed = await open("/preview/badges?state=error", "badges");
    check((await text(failed.page, "badges-error")).includes(OFFLINE_TEXT) && (await count(failed.page, "retry-button")) === 1, "실패 — 한국어 네트워크 안내 + 다시 시도");
    check((await count(failed.page, "badges-skeleton")) === 0 && (await count(failed.page, "badges-empty")) === 0, "실패 — 스켈레톤 · 빈 상태를 겹쳐 그리지 않는다");
    await commonChecks("배지(실패)", failed.page, failed.errors, "badges");
    await failed.page.close();
  }
  /* ── 커뮤니티 (7-3) ─────────────────────────────────────── */
  {
    const feedCalls = (page) => page.evaluate(() => [...(globalThis.__offloFeedCalls ?? [])]);
    const posts = (page) => page.locator('[data-testid^="post-p-"]:not([data-testid*="-like"]):not([data-testid*="-comment"]):not([data-testid*="-delete"]):not([data-testid*="-badge"]):not([data-testid*="-content"]):not([data-testid*="-error"])').count();
    const scrollToEnd = (page) => page.evaluate(() => { const el = document.querySelector('[data-testid="community"]'); el.scrollTop = el.scrollHeight; });
    const num = async (page, id) => Number((await text(page, id)).replace(/\D/g, ""));

    // 첫 페이지 · 머리 · 안내 · 글쓰기
    const { page, errors } = await open("/preview/community?state=ready", "community");
    await page.getByTestId("post-p-01").waitFor({ state: "visible" });
    check((await page.locator("body").innerText()).includes("글 10개+"), "피드 · 머리글 \"글 10개+\" (다음 페이지가 더 있다)");
    check((await posts(page)) === 10, "첫 페이지 10개", String(await posts(page)));
    check((await count(page, "community-notice")) === 1 && (await text(page, "community-notice")).includes("이름이 공개돼요"), "이름 공개 안내가 처음엔 뜬다");
    check((await text(page, "post-p-01")).includes("7시간 전") && (await text(page, "post-p-01")).includes("민준"), "글 카드 — 작성자 · \"7시간 전\"");
    check((await count(page, "post-delete-p-03")) === 1 && (await count(page, "post-delete-p-01")) === 0, "내 글(p-03)에만 삭제가 있다");
    check((await count(page, "post-badge-p-07")) === 1 && (await text(page, "post-badge-p-07")) === "첫 분석" && (await count(page, "post-content-p-07")) === 0, "배지 자랑 글 — 헤더에 배지 알약 · 한마디가 없으면 본문 칸이 없다");
    check((await page.getByTestId("composer-submit").isDisabled()) && (await text(page, "composer-count")) === "0 / 1000", "글쓰기 — 비어 있으면 \"글 올리기\"가 잠겨 있다 · 0 / 1000");
    check((await page.getByTestId("post-like-p-02").getAttribute("aria-label")) === "좋아요 3개, 눌러서 취소" && (await page.getByTestId("post-like-p-01").getAttribute("aria-label")) === "좋아요 0개", "좋아요 접근성 라벨 — 누른 글은 \"눌러서 취소\"");
    await page.screenshot({ path: join(OUT_DIR, "M7-community-feed.png") });

    // 안내 닫기
    await page.getByTestId("community-notice-dismiss").click();
    check((await count(page, "community-notice")) === 0, "\"확인\"을 누르면 안내가 사라진다");

    // 무한 스크롤 — 끝에 닿을 때마다 다음 페이지 · 같은 페이지를 두 번 부르지 않는다
    for (let i = 0; i < 10 && (await count(page, "feed-end")) === 0; i++) {
      await scrollToEnd(page);
      await page.waitForTimeout(700);
    }
    check((await count(page, "feed-end")) === 1 && (await text(page, "feed-end")) === "모든 글을 봤어요", "끝까지 내리면 \"모든 글을 봤어요\"");
    check((await feedCalls(page)).join() === "page first,page p-10,page p-20", "다음 페이지는 커서(마지막 글 id)로 차례로 한 번씩만 — 첫 · p-10 · p-20", (await feedCalls(page)).join());
    check((await page.locator("body").innerText()).includes("글 25개") && !(await page.locator("body").innerText()).includes("글 25개+"), "머리글이 \"글 25개\"로 (더 없으니 +가 빠진다)");
    check((await text(page, "post-p-24")).includes("9.10"), "7일이 넘은 글은 날짜 (KST \"9.10\")", (await text(page, "post-p-24")).slice(0, 30));
    check((await posts(page)) === 25 && new Set(await page.locator('[data-testid^="post-p-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")))).size >= 25, "25개가 중복 없이 이어 붙는다");
    await commonChecks("커뮤니티", page, errors, "community");
    await page.close();
  }

  {
    const feedCalls = (page) => page.evaluate(() => [...(globalThis.__offloFeedCalls ?? [])]);
    const num = async (page, id) => Number((await text(page, id)).replace(/\D/g, ""));

    // 좋아요 — 응답 전에 먼저 바뀌고 · 연달아 눌러도 한 번 · 서버 값으로 맞춘다
    const a = await open("/preview/community?state=ready&notice=0&slow=1", "community");
    await a.page.getByTestId("post-p-01").waitFor({ state: "visible" });
    await a.page.getByTestId("post-like-p-01").click();
    check((await num(a.page, "post-like-count-p-01")) === 1 && (await a.page.getByTestId("post-like-p-01").getAttribute("aria-label")) === "좋아요 1개, 눌러서 취소", "좋아요 — 응답(0.9초)을 기다리지 않고 바로 1로 올라간다 (낙관적)");
    await a.page.getByTestId("post-like-p-01").click();
    await a.page.waitForTimeout(1300);
    check((await feedCalls(a.page)).filter((c) => c === "like p-01").length === 1, "응답을 기다리는 중에 다시 눌러도 서버에는 한 번만 간다 (토글이라 두 번 가면 취소된다)", (await feedCalls(a.page)).join(","));
    check((await num(a.page, "post-like-count-p-01")) === 1, "서버 응답 뒤에도 값이 튀지 않는다");
    await a.page.getByTestId("post-like-p-01").click();
    await a.page.waitForTimeout(1300);
    check((await num(a.page, "post-like-count-p-01")) === 0 && (await a.page.getByTestId("post-like-p-01").getAttribute("aria-label")) === "좋아요 0개", "다시 누르면 취소 (0)");
    await a.page.close();

    // 좋아요 실패 — 되돌린다
    const b = await open("/preview/community?state=ready&notice=0&fail=like", "community");
    await b.page.getByTestId("post-p-01").waitFor({ state: "visible" });
    await b.page.getByTestId("post-like-p-02").click();
    await b.page.getByTestId("post-error-p-02").waitFor({ state: "visible", timeout: 5000 });
    check((await num(b.page, "post-like-count-p-02")) === 3 && (await b.page.getByTestId("post-like-p-02").getAttribute("aria-label")) === "좋아요 3개, 눌러서 취소", "좋아요 실패 — 누르기 전 값(3 · 누른 상태)으로 되돌아간다");
    check((await text(b.page, "post-error-p-02")).includes(OFFLINE_TEXT), "좋아요 실패 — 카드 안에 한국어 네트워크 안내");
    await b.page.close();

    // 댓글 — 펼치기 · 쓰기 · 지우기
    const c = await open("/preview/community?state=ready&notice=0", "community");
    await c.page.getByTestId("post-p-02").waitFor({ state: "visible" });
    check((await count(c.page, "post-comment-area-p-02")) === 0, "댓글은 처음엔 접혀 있다");
    await c.page.getByTestId("post-comments-p-02").click();
    await c.page.getByTestId("comment-c-2").waitFor({ state: "visible", timeout: 5000 });
    check((await count(c.page, "comment-c-2")) === 1 && (await count(c.page, "comment-c-3")) === 1 && (await text(c.page, "comment-c-2")).includes("하준"), "펼치면 댓글 2개가 불러와진다 (오래된 순)");
    check((await c.page.getByTestId("post-comments-p-02").getAttribute("aria-label")) === "댓글 2개, 접기", "댓글 접근성 라벨 — 펼친 상태는 \"접기\"");
    check((await count(c.page, "comment-delete-c-3")) === 1 && (await count(c.page, "comment-delete-c-2")) === 0, "내 댓글(c-3)에만 삭제가 있다");
    check((await c.page.getByTestId("comment-send-p-02").isDisabled()), "댓글 입력이 비어 있으면 \"등록\"이 잠겨 있다");
    await c.page.getByTestId("comment-input-p-02").fill("가".repeat(400));
    check((await c.page.getByTestId("comment-input-p-02").inputValue()).length === 300, "댓글은 300자에서 멈춘다");
    await c.page.getByTestId("comment-input-p-02").fill("응원해요!");
    await c.page.getByTestId("comment-send-p-02").click();
    await c.page.locator('[data-testid^="comment-c-new"]').first().waitFor({ state: "visible", timeout: 5000 });
    check((await num(c.page, "post-comment-count-p-02")) === 3 && (await c.page.getByTestId("comment-input-p-02").inputValue()) === "", "댓글 등록 — 목록 끝에 붙고 글의 댓글 수가 3으로 · 입력칸이 비워진다");
    check((await feedCalls(c.page)).includes('comment p-02 "응원해요!"'), "댓글 등록 — 서버에 한 번", (await feedCalls(c.page)).join(" | "));
    await c.page.getByTestId("comment-delete-c-3").click();
    check((await text(c.page, "comment-c-3")).includes("삭제할까요?"), "댓글 삭제 — 한 번 더 묻는다");
    await c.page.getByTestId("comment-delete-cancel-c-3").click();
    check((await count(c.page, "comment-c-3")) === 1, "취소하면 그대로");
    await c.page.getByTestId("comment-delete-c-3").click();
    await c.page.getByTestId("comment-delete-ok-c-3").click();
    await c.page.getByTestId("comment-c-3").waitFor({ state: "detached", timeout: 5000 });
    check((await num(c.page, "post-comment-count-p-02")) === 2, "댓글 삭제 — 글의 댓글 수가 2로");
    await c.page.getByTestId("post-comments-p-04").click();
    await c.page.getByText("아직 댓글이 없어요. 첫 응원을 남겨보세요.").waitFor({ state: "visible", timeout: 5000 });
    check(true, "댓글이 없는 글 — \"아직 댓글이 없어요\" (불러오는 중 → 안내)");
    await c.page.screenshot({ path: join(OUT_DIR, "M7-community-comments.png") });
    await c.page.close();

    // 댓글 실패 — 불러오기 · 등록
    const d = await open("/preview/community?state=ready&notice=0&fail=comments", "community");
    await d.page.getByTestId("post-comments-p-02").click();
    await d.page.getByTestId("post-error-p-02").waitFor({ state: "visible", timeout: 5000 });
    check((await text(d.page, "post-error-p-02")).includes(OFFLINE_TEXT) && (await count(d.page, "comment-c-2")) === 0, "댓글 불러오기 실패 — 한국어 네트워크 안내");
    await d.page.close();
    const e = await open("/preview/community?state=ready&notice=0&fail=add", "community");
    await e.page.getByTestId("post-comments-p-04").click();
    await e.page.getByTestId("comment-input-p-04").fill("실패할 댓글");
    await e.page.getByTestId("comment-send-p-04").click();
    await e.page.getByTestId("post-error-p-04").waitFor({ state: "visible", timeout: 5000 });
    check((await e.page.getByTestId("comment-input-p-04").inputValue()) === "실패할 댓글" && (await num(e.page, "post-comment-count-p-04")) === 0, "댓글 등록 실패 — 쓴 글은 그대로 남고 댓글 수는 안 올라간다");
    await e.page.close();

    // 내 글 삭제
    const f = await open("/preview/community?state=ready&notice=0", "community");
    await f.page.getByTestId("post-p-03").waitFor({ state: "visible" });
    await f.page.getByTestId("post-delete-p-03").click();
    check((await text(f.page, "post-p-03")).includes("삭제할까요?"), "글 삭제 — 카드 안에서 한 번 더 묻는다");
    await f.page.getByTestId("post-delete-cancel-p-03").click();
    check((await count(f.page, "post-delete-p-03")) === 1, "취소하면 그대로");
    await f.page.getByTestId("post-delete-p-03").click();
    await f.page.getByTestId("post-delete-ok-p-03").click();
    await f.page.getByTestId("post-p-03").waitFor({ state: "detached", timeout: 5000 });
    check((await feedCalls(f.page)).includes("delete p-03"), "글 삭제 확인 → 서버에 한 번 · 카드가 사라진다");
    await f.page.close();

    // 글쓰기
    const g = await open("/preview/community?state=ready&notice=0", "community");
    await g.page.getByTestId("composer-input").waitFor({ state: "visible" });
    await g.page.getByTestId("composer-input").fill("가".repeat(1500));
    check((await text(g.page, "composer-count")) === "1000 / 1000", "글은 1000자에서 멈춘다");
    await g.page.getByTestId("composer-input").fill("  오늘도 폰 없이 산책했어요.  ");
    check(!(await g.page.getByTestId("composer-submit").isDisabled()), "내용이 있으면 \"글 올리기\"가 켜진다");
    await g.page.getByTestId("composer-submit").dblclick();
    await g.page.getByTestId("post-p-new-1").waitFor({ state: "visible", timeout: 5000 });
    check((await feedCalls(g.page)).filter((x) => x.startsWith("post ")).length === 1 && (await feedCalls(g.page)).includes('post "오늘도 폰 없이 산책했어요."'), "글 올리기 — 앞뒤 공백을 자르고 서버에 한 번 (연달아 눌러도 한 번)", (await feedCalls(g.page)).join(" | "));
    check((await g.page.getByTestId("composer-input").inputValue()) === "" && (await text(g.page, "post-p-new-1")).includes("지우") && (await count(g.page, "post-delete-p-new-1")) === 1, "새 글이 맨 위에 내 글로 들어오고 입력칸이 비워진다");
    check((await feedCalls(g.page)).at(-1) === "page first", "글을 올린 뒤 첫 페이지를 조용히 다시 읽는다");
    await g.page.close();

    const h = await open("/preview/community?state=ready&notice=0&fail=post", "community");
    await h.page.getByTestId("composer-input").fill("올라가지 못할 글");
    await h.page.getByTestId("composer-submit").click();
    await h.page.getByTestId("composer-error").waitFor({ state: "visible", timeout: 5000 });
    check((await text(h.page, "composer-error")).includes(OFFLINE_TEXT) && (await h.page.getByTestId("composer-input").inputValue()) === "올라가지 못할 글", "글 올리기 실패 — 한국어 안내 · 쓴 글은 그대로 남는다");
    await h.page.close();

    // 알림 링크로 강조
    const hi = await open("/preview/community?state=ready&notice=0&highlight=p-03", "community");
    await hi.page.getByTestId("post-p-03").waitFor({ state: "visible" });
    check((await hi.page.getByTestId("post-p-03").evaluate((el) => getComputedStyle(el).borderTopColor)) === "rgba(61, 219, 135, 0.45)" && (await hi.page.getByTestId("post-p-02").evaluate((el) => getComputedStyle(el).borderTopColor)) !== "rgba(61, 219, 135, 0.45)", "알림 링크(?post=p-03) — 그 글만 녹색 테두리");
    await hi.page.waitForTimeout(1500); // 목록이 그려진 뒤 그 글 자리로 스크롤한다
    const inView = await hi.page.getByTestId("post-p-03").evaluate((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; });
    check(inView, "알림 링크 — 그 글 자리로 스크롤돼 화면 안에 있다");
    await hi.page.close();
    const miss = await open("/preview/community?state=ready&notice=0&highlight=p-24", "community");
    await miss.page.getByTestId("post-p-01").waitFor({ state: "visible" });
    check((await miss.page.locator('[data-testid^="post-p-"]').evaluateAll((els) => els.filter((e) => getComputedStyle(e).borderTopColor === "rgba(61, 219, 135, 0.45)").length)) === 0, "알림 링크의 글이 첫 페이지에 없으면 강조하지 않는다 (수용된 한계)");
    await miss.page.close();

    // 다음 페이지 실패 — 읽은 글은 남기고 아래에 다시 시도
    const m = await open("/preview/community?state=ready&notice=0&fail=more", "community");
    await m.page.getByTestId("post-p-01").waitFor({ state: "visible" });
    await m.page.evaluate(() => { const el = document.querySelector('[data-testid="community"]'); el.scrollTop = el.scrollHeight; });
    await m.page.getByTestId("feed-more-error").waitFor({ state: "visible", timeout: 8000 });
    check((await text(m.page, "feed-more-error")).includes(OFFLINE_TEXT) && (await count(m.page, "post-p-01")) === 1 && (await count(m.page, "retry-button")) >= 1, "다음 페이지 실패 — 읽은 글은 그대로 · 아래에 한국어 안내 + 다시 시도");
    await m.page.close();

    // 빈 피드 · 로딩 · 실패
    const empty = await open("/preview/community?state=empty", "community");
    await empty.page.getByTestId("feed-empty").waitFor({ state: "visible" });
    check((await text(empty.page, "feed-empty")).includes("아직 글이 없어요") && (await count(empty.page, "feed-end")) === 0, "첫 사용 — \"아직 글이 없어요\" (끝 표시는 없다)");
    await commonChecks("커뮤니티(빈 피드)", empty.page, empty.errors, "community");
    await empty.page.close();
    const loading = await open("/preview/community?state=loading", "community");
    check((await count(loading.page, "feed-skeleton")) === 1 && (await count(loading.page, "feed-empty")) === 0, "로딩 — 스켈레톤 (빈 상태 안내는 아직 안 띄운다)");
    await loading.page.close();
    const failed = await open("/preview/community?state=error", "community");
    await failed.page.getByTestId("feed-error").waitFor({ state: "visible", timeout: 8000 });
    check((await text(failed.page, "feed-error")).includes(OFFLINE_TEXT) && (await count(failed.page, "retry-button")) === 1 && (await count(failed.page, "feed-skeleton")) === 0 && (await count(failed.page, "feed-empty")) === 0, "실패 — 한국어 네트워크 안내 + 다시 시도 (스켈레톤 · 빈 상태와 겹치지 않는다)");
    await commonChecks("커뮤니티(실패)", failed.page, failed.errors, "community");
    await failed.page.close();
  }

  // 주간 랭킹
  {
    const rows = (page) => page.locator('[data-testid^="rank-"]:not([data-testid="ranking-rows"])').count();
    const a = await open("/preview/community?state=ranking", "community");
    await a.page.getByTestId("ranking-rows").waitFor({ state: "visible" });
    check((await rows(a.page)) === 10 && (await text(a.page, "rank-4")).includes("지우 (나)") && (await text(a.page, "rank-1")).includes("하준") && (await text(a.page, "rank-1")).includes("91"), "랭킹 — Top 10 · 1위 하준 91 · 내가 4위(나)");
    check((await a.page.getByTestId("rank-4").evaluate((el) => getComputedStyle(el).backgroundColor)) === "rgba(61, 219, 135, 0.13)" && (await a.page.getByTestId("rank-5").evaluate((el) => getComputedStyle(el).backgroundColor)) === "rgba(0, 0, 0, 0)", "내 줄만 브랜드 그린 바탕");
    check((await a.page.locator("body").innerText()).includes("⋯") === false, "Top 10 안에 내가 있으면 아래에 또 보이지 않는다");
    check((await a.page.getByTestId("rank-4").getAttribute("aria-label")) === "4위 지우 (나), 평균 83점, 분석 6회" || (await a.page.getByTestId("rank-4").getAttribute("aria-label"))?.startsWith("4위 지우 (나), 평균 83점"), "랭킹 줄 접근성 라벨", await a.page.getByTestId("rank-4").getAttribute("aria-label"));
    check((await count(a.page, "composer")) === 0 && (await a.page.locator("body").innerText()).includes("분석 3회 미만은 순위에서 제외됩니다."), "랭킹 모드 — 글쓰기는 없고 안내 문구가 있다");
    await a.page.screenshot({ path: join(OUT_DIR, "M7-community-ranking.png") });
    await a.page.getByTestId("segment-feed").click();
    await a.page.getByTestId("post-p-01").waitFor({ state: "visible", timeout: 8000 });
    check((await count(a.page, "composer")) === 1 && (await count(a.page, "ranking")) === 0, "\"피드\"로 돌아오면 글쓰기 · 피드가 다시 보인다");
    await a.page.getByTestId("composer-input").fill("임시 초안");
    await a.page.getByTestId("segment-ranking").click();
    await a.page.getByTestId("segment-feed").click();
    check((await a.page.getByTestId("composer-input").inputValue()) === "임시 초안", "탭을 오가도 쓰던 글은 남는다");
    await commonChecks("커뮤니티(랭킹)", a.page, a.errors, "community");
    await a.page.close();

    const out = await open("/preview/community?state=ranking-outside", "community");
    await out.page.getByTestId("ranking-rows").waitFor({ state: "visible" });
    check((await rows(out.page)) === 11 && (await out.page.locator("body").innerText()).includes("⋯") && (await text(out.page, "rank-14")).includes("지우 (나)"), "Top 10 밖이면 \"⋯\" 아래에 내 순위(14위)를 따로 보인다");
    await out.page.close();
    const empty = await open("/preview/community?state=ranking-empty", "community");
    await empty.page.getByTestId("ranking-empty").waitFor({ state: "visible" });
    check((await text(empty.page, "ranking-empty")).includes("일간 분석을 3회 이상 하면 순위에 등록됩니다"), "랭킹이 비어 있으면 등록 조건을 알려 준다");
    await empty.page.close();
    const loading = await open("/preview/community?state=ranking-loading", "community");
    check((await count(loading.page, "ranking-skeleton")) === 1 && (await count(loading.page, "ranking-empty")) === 0, "랭킹 로딩 — 스켈레톤");
    await loading.page.close();
    const failed = await open("/preview/community?state=ranking-error", "community");
    check((await text(failed.page, "ranking-error")).includes(OFFLINE_TEXT) && (await count(failed.page, "ranking-skeleton")) === 0, "랭킹 실패 — 한국어 네트워크 안내 + 다시 시도");
    await failed.page.close();
  }
  /* ── 설정 (7-4) ─────────────────────────────────────────── */
  {
    const settingsCalls = (page) => page.evaluate(() => [...(globalThis.__offloSettingsCalls ?? [])]);
    const { page, errors } = await open("/preview/settings?state=ready", "settings");
    await page.getByTestId("settings-profile").waitFor({ state: "visible" });
    check((await text(page, "settings-name")) === "지우" && (await text(page, "settings-email")) === "sample@example.com" && (await text(page, "settings-provider")) === "Google", "프로필 — 이름 · 이메일 · 로그인 방식(Google)");
    check((await text(page, "settings-account")).includes("가입일 2026.08.01") && (await text(page, "settings-account")).includes("플랜 무료 플랜") && (await text(page, "settings-account")).includes("로그인 방식 Google"), "계정 — 가입일 · 플랜 · 로그인 방식");
    const body = await page.locator("body").innerText();
    check(!body.includes("비밀번호") && !body.includes("테마"), "비밀번호 변경 · 테마 항목은 없다 (소셜 전용 · 다크 단일 테마)");
    check((await page.getByTestId("name-input").inputValue()) === "지우" && (await page.getByTestId("name-save").isDisabled()), "이름 — 지금 이름이 채워져 있고 바꾸기 전엔 \"이름 저장\"이 잠겨 있다");
    await page.screenshot({ path: join(OUT_DIR, "M7-settings.png"), fullPage: true });

    // 이름 저장
    await page.getByTestId("name-input").fill("   ");
    check(await page.getByTestId("name-save").isDisabled(), "이름이 공백뿐이면 저장이 잠겨 있다");
    await page.getByTestId("name-input").fill("가".repeat(150));
    check((await page.getByTestId("name-input").inputValue()).length === 100, "이름은 100자에서 멈춘다");
    await page.getByTestId("name-input").fill("  민서  ");
    check(!(await page.getByTestId("name-save").isDisabled()), "바꾸면 \"이름 저장\"이 열린다");
    await page.getByTestId("name-save").dblclick();
    await page.getByTestId("name-saved").waitFor({ state: "visible", timeout: 5000 });
    check(JSON.stringify(await settingsCalls(page)) === JSON.stringify(['name "민서"']), "이름 저장 — 앞뒤 공백을 자르고 서버에 한 번 (연달아 눌러도 한 번)", (await settingsCalls(page)).join(" | "));
    check((await text(page, "settings-name")) === "민서" && (await text(page, "name-saved")) === "이름이 저장됐어요.", "저장 뒤 — 프로필 이름이 바뀌고 \"이름이 저장됐어요.\"");
    check(await page.getByTestId("name-save").isDisabled(), "저장 뒤 — 같은 이름이라 다시 잠긴다");
    await page.getByTestId("name-input").fill("민서!");
    check((await count(page, "name-saved")) === 0, "다시 고치기 시작하면 \"저장됐어요\"가 사라진다");
    await page.close();

    // 이름 저장 실패 — 네트워크 · 서버가 아직 모름
    const f1 = await open("/preview/settings?state=ready&fail=name", "settings");
    await f1.page.getByTestId("name-input").fill("새 이름");
    await f1.page.getByTestId("name-save").click();
    await f1.page.getByTestId("name-error").waitFor({ state: "visible", timeout: 5000 });
    check((await text(f1.page, "name-error")).includes(OFFLINE_TEXT) && (await text(f1.page, "settings-name")) === "지우" && (await f1.page.getByTestId("name-input").inputValue()) === "새 이름", "이름 저장 실패 — 한국어 네트워크 안내 · 이름은 그대로 · 입력은 남는다");
    await f1.page.close();
    const f2 = await open("/preview/settings?state=ready&fail=old", "settings");
    await f2.page.getByTestId("name-input").fill("새 이름");
    await f2.page.getByTestId("name-save").click();
    await f2.page.getByTestId("name-error").waitFor({ state: "visible", timeout: 5000 });
    check((await text(f2.page, "name-error")).includes("서버가 업데이트된 뒤에 다시 시도해주세요"), "서버가 이름 변경을 아직 모르면(405) 업데이트 안내");
    await f2.page.close();

    // 로그아웃
    const o = await open("/preview/settings?state=ready", "settings");
    await o.page.getByTestId("settings-signout").click();
    await o.page.waitForTimeout(500);
    check((await settingsCalls(o.page)).join() === "signout", "로그아웃 → 한 번");
    await o.page.close();

    // 회원 탈퇴 — 확인 문구를 입력해야 열린다 (미리보기는 아무것도 지우지 않는다)
    const d = await open("/preview/settings?state=ready", "settings");
    check((await text(d.page, "settings-delete")).includes("되돌릴 수 없어요") && (await text(d.page, "settings-delete")).includes("분석 기록과 결과") && (await text(d.page, "settings-delete")).includes("로그인 계정"), "탈퇴 — 지워지는 것을 알린다");
    check(await d.page.getByTestId("delete-confirm").isDisabled(), "탈퇴 — 확인 문구 전에는 잠겨 있다");
    await d.page.getByTestId("delete-input").fill("탈퇴합니다");
    check(await d.page.getByTestId("delete-confirm").isDisabled(), "탈퇴 — \"탈퇴합니다\"는 안 된다 (정확히 \"탈퇴\")");
    await d.page.getByTestId("delete-input").fill("탈퇴");
    check(!(await d.page.getByTestId("delete-confirm").isDisabled()), "탈퇴 — \"탈퇴\"를 입력하면 열린다");
    await d.page.getByTestId("delete-confirm").dblclick();
    await d.page.waitForTimeout(700);
    check((await settingsCalls(d.page)).join() === "delete", "탈퇴 확인 → 서버에 한 번 (연달아 눌러도 한 번)", (await settingsCalls(d.page)).join());
    await d.page.close();
    const df = await open("/preview/settings?state=ready&fail=delete", "settings");
    await df.page.getByTestId("delete-input").fill("탈퇴");
    await df.page.getByTestId("delete-confirm").click();
    await df.page.getByTestId("delete-error").waitFor({ state: "visible", timeout: 5000 });
    check((await text(df.page, "delete-error")).includes(OFFLINE_TEXT) && (await df.page.getByTestId("delete-input").inputValue()) === "탈퇴", "탈퇴 실패 — 한국어 네트워크 안내 · 다시 누를 수 있다");
    await commonChecks("설정", df.page, df.errors, "settings");
    await df.page.close();

    const prem = await open("/preview/settings?state=premium", "settings");
    check((await text(prem.page, "settings-account")).includes("플랜 프리미엄"), "프리미엄 계정은 \"프리미엄\"");
    await prem.page.close();
    const loading = await open("/preview/settings?state=loading", "settings");
    check((await count(loading.page, "settings-skeleton")) === 1 && (await count(loading.page, "settings-profile")) === 0, "로딩 — 스켈레톤");
    await loading.page.close();
    const failed = await open("/preview/settings?state=error", "settings");
    check((await text(failed.page, "settings-error")).includes(OFFLINE_TEXT) && (await count(failed.page, "retry-button")) === 1 && (await count(failed.page, "settings-delete")) === 0, "실패 — 한국어 네트워크 안내 + 다시 시도 (탈퇴 · 이름 폼은 숨긴다 — 서버 값을 모르는 채 위험한 버튼을 두지 않는다)");
    await commonChecks("설정(실패)", failed.page, failed.errors, "settings");
    await failed.page.close();
    check(errors.length === 0, "설정 · 콘솔 에러 0", errors.join(" | ").slice(0, 240));
  }
} catch (err) {
  check(false, "검증 중 예외", String(err).split("\n")[0]);
} finally {
  await browser.close();
  stopServer();
}

console.log(`\n스크린샷: ${OUT_DIR}`);
if (failures.length) {
  console.error(`\nM7 웹 검증 실패 ${failures.length}건: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nM7 웹 검증을 통과했습니다.");
