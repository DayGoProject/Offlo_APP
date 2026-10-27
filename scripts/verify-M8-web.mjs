/**
 * M8 검증 ① — 알림 미리보기 화면 + Playwright (에이전트 자동 실행용)
 *
 *   node scripts/verify-M8-web.mjs
 *
 * 웹 미리보기는 CORS 때문에 실제 API를 부를 수 없고 Playwright는 Google 로그인을 못 넘는다.
 * 그래서 가드 밖 `/preview/notifications`에 **실제 화면과 같은 컴포넌트 + 같은 `useNotificationFeed`**를 샘플 값 + 화면 안 가짜 서버로 띄워 끝까지 눌러 본다.
 * 실데이터 · 실시간 구독 · 실서버는 ② 안드로이드(verify-M8-android.mjs).
 *
 * 샘플 기준 시각은 KST 2026-09-17(목) 10:00이고, 브라우저 시간대를 Asia/Seoul로 고정한다.
 *
 * 확인 항목
 *   알림 — 안 읽은 줄(점) · 읽은 줄 · 시간 · 갈 곳이 있는 줄만 ›(화살표) · 줄을 누르면 읽음이 **응답보다 먼저** 바뀐다(낙관적) · 연달아 눌러도 한 번 ·
 *         서버가 보내 주는 옛 스냅숏이 읽음을 되돌리지 않는다 · 이미 읽은 줄은 다시 보내지 않는다 · 이동 대상(아는 경로만 · 외부 주소는 안 감) ·
 *         "모두 읽음"(한 번만 · 다 읽으면 잠김) · 읽음 실패 → 되돌리고 한국어 안내 · 실시간으로 새 알림이 들어온다 · 빈 상태 · 로딩 · 구독 실패 · 홈의 종(배지 숫자 · 9+)
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
const BRAND_RGB = "rgb(61, 219, 135)";
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

const calls = (page) => page.evaluate(() => [...(globalThis.__offloNotiCalls ?? [])]);
const rowLabel = (page, id) => page.getByTestId(`notification-${id}`).getAttribute("aria-label");
const dotColor = (page, id) => page.getByTestId(`notification-dot-${id}`).evaluate((el) => getComputedStyle(el).backgroundColor);
/** 화면 머리글의 눈썹 줄 (알림 화면 맨 윗줄) */
const eyebrow = async (page) => (await page.getByTestId("notifications").innerText()).split("\n")[0].trim();
const READ_ROWS = (page) => page.locator('[data-testid^="notification-"]:not([data-testid^="notification-dot"])');

try {
  /* ── 목록 · 읽음 · 이동 ─────────────────────────────────── */
  {
    const { page, errors } = await open("/preview/notifications?state=ready", "notifications");
    await page.getByTestId("notification-n1").waitFor({ state: "visible" });
    check((await eyebrow(page)) === "읽지 않은 알림 3개", "머리글 \"읽지 않은 알림 3개\"", await eyebrow(page));
    check((await READ_ROWS(page).count()) === 8, "알림 8줄", String(await READ_ROWS(page).count()));
    const unread = ["n1", "n2", "n3"];
    const read = ["n4", "n5", "n6", "n7", "n8"];
    const onDots = await Promise.all(unread.map((id) => dotColor(page, id)));
    const offDots = await Promise.all(read.map((id) => dotColor(page, id)));
    check(onDots.every((c) => c === BRAND_RGB) && offDots.every((c) => c !== BRAND_RGB), "안 읽은 줄(n1~n3)만 브랜드 그린 점");
    check((await rowLabel(page, "n1")).startsWith("읽지 않음. 새 배지 획득") && !(await rowLabel(page, "n4")).startsWith("읽지 않음"), "접근성 라벨 — 안 읽은 줄은 \"읽지 않음.\"으로 시작한다");
    check(
      (await text(page, "notification-n1")).includes("12분 전") &&
        (await text(page, "notification-n2")).includes("1시간 전") &&
        (await text(page, "notification-n3")).includes("5시간 전") &&
        (await text(page, "notification-n4")).includes("1일 전"),
      "상대 시간 — 12분 전 · 1시간 전 · 5시간 전 · 1일 전",
    );
    const chevrons = await Promise.all(["n1", "n2", "n3", "n4", "n5", "n6", "n7", "n8"].map(async (id) => (await text(page, `notification-${id}`)).includes("›")));
    check(chevrons.join() === "true,true,true,true,true,true,false,false", "갈 곳이 있는 알림(n1~n6)만 › — 링크가 없거나(n7) 외부 주소(n8)는 화살표가 없다", chevrons.join());
    check(!(await page.getByTestId("notifications-read-all").isDisabled()), "안 읽은 알림이 있으면 \"모두 읽음\"이 열려 있다");
    check((await text(page, "preview-bell-badge")) === "3", "종 배지 숫자가 목록을 따라간다 (3)");
    await page.screenshot({ path: join(OUT_DIR, "M8-notifications.png"), fullPage: true });
    await commonChecks("알림", page, errors, "notifications");
    await page.close();
  }

  // 한 줄을 누르면 — 읽음이 응답보다 먼저 바뀌고 · 연달아 눌러도 한 번 · 옛 스냅숏이 되돌리지 않는다 · 이동 기록
  {
    const { page } = await open("/preview/notifications?state=ready&slow=1", "notifications");
    await page.getByTestId("notification-n1").waitFor({ state: "visible" });
    await page.getByTestId("notification-n1").dblclick();
    check(
      (await dotColor(page, "n1")) !== BRAND_RGB && !(await rowLabel(page, "n1")).startsWith("읽지 않음") && (await eyebrow(page)) === "읽지 않은 알림 2개",
      "누르는 순간(서버 응답 0.9초 전) 읽음으로 바뀐다 — 점이 꺼지고 머리글이 2개로 (낙관적)",
    );
    check((await text(page, "preview-bell-badge")) === "2", "종 배지도 같이 2로");
    await page.waitForTimeout(1500);
    check((await calls(page)).filter((c) => c === "read n1").length === 1, "연달아 눌러도 읽음 요청은 한 번", (await calls(page)).join(" | "));
    check((await dotColor(page, "n1")) !== BRAND_RGB && (await eyebrow(page)) === "읽지 않은 알림 2개", "서버가 확인해 준 뒤에도 읽음 그대로 (옛 스냅숏이 되돌리지 않는다)");
    check((await calls(page)).includes("go /badges"), "배지 알림 → 배지 화면(/badges)으로 간다", (await calls(page)).join(" | "));
    await page.getByTestId("notification-n2").click();
    await page.waitForTimeout(1300);
    check((await calls(page)).includes("go /community?post=p-03"), "댓글 알림 → 커뮤니티 · 그 글(p-03)로 간다");
    // 이미 읽은 알림 — 읽음 요청 없이 이동만
    const before = (await calls(page)).filter((c) => c.startsWith("read ")).length;
    await page.getByTestId("notification-n4").click();
    await page.waitForTimeout(300);
    check(
      (await calls(page)).filter((c) => c.startsWith("read ")).length === before && (await calls(page)).includes("go /goals"),
      "이미 읽은 알림은 읽음 요청을 다시 보내지 않고 이동만 한다 (목표 → /goals)",
    );
    // 갈 곳이 없는 알림 — 움직이지 않는다
    const goes = (await calls(page)).filter((c) => c.startsWith("go ")).length;
    await page.getByTestId("notification-n7").click();
    await page.getByTestId("notification-n8").click();
    await page.waitForTimeout(300);
    check((await calls(page)).filter((c) => c.startsWith("go ")).length === goes, "링크가 없는 알림(n7) · 외부 주소 알림(n8)은 화면을 옮기지 않는다");
    await page.close();
  }

  // 모두 읽음
  {
    const { page } = await open("/preview/notifications?state=ready", "notifications");
    await page.getByTestId("notification-n1").waitFor({ state: "visible" });
    await page.getByTestId("notifications-read-all").dblclick();
    await page.waitForTimeout(800);
    const dots = await Promise.all(["n1", "n2", "n3"].map((id) => dotColor(page, id)));
    check((await eyebrow(page)) === "모두 읽었어요" && dots.every((c) => c !== BRAND_RGB), "모두 읽음 → 머리글 \"모두 읽었어요\" · 점이 모두 꺼진다");
    check((await calls(page)).filter((c) => c === "readAll").length === 1, "연달아 눌러도 한 번만 보낸다", (await calls(page)).join(" | "));
    check(await page.getByTestId("notifications-read-all").isDisabled(), "다 읽으면 \"모두 읽음\"이 잠긴다");
    check((await count(page, "preview-bell-badge")) === 0, "종 배지가 사라진다");
    await page.close();
  }

  // 읽음 요청이 실패하면 — 되돌리고 안내
  {
    const f1 = await open("/preview/notifications?state=ready&fail=read", "notifications");
    await f1.page.getByTestId("notification-n1").click();
    await f1.page.getByTestId("notifications-action-error").waitFor({ state: "visible", timeout: 5000 });
    check((await dotColor(f1.page, "n1")) === BRAND_RGB && (await eyebrow(f1.page)) === "읽지 않은 알림 3개", "읽음 실패 — 그 알림은 다시 안 읽음(점 · 3개)으로 돌아온다");
    check((await text(f1.page, "notifications-action-error")).includes(OFFLINE_TEXT), "읽음 실패 — 한국어 네트워크 안내");
    check((await calls(f1.page)).includes("go /badges"), "읽음이 실패해도 이동은 된다 (알림을 못 열게 막지 않는다)");
    await f1.page.close();

    const f2 = await open("/preview/notifications?state=ready&fail=readAll", "notifications");
    await f2.page.getByTestId("notifications-read-all").click();
    await f2.page.getByTestId("notifications-action-error").waitFor({ state: "visible", timeout: 5000 });
    check(
      (await eyebrow(f2.page)) === "읽지 않은 알림 3개" && (await dotColor(f2.page, "n2")) === BRAND_RGB && (await dotColor(f2.page, "n4")) !== BRAND_RGB,
      "모두 읽음 실패 — 안 읽었던 3개만 되돌아오고 원래 읽은 것은 그대로",
    );
    await f2.page.close();
  }

  // 실시간 — 구독으로 새 알림이 들어온다
  {
    const { page } = await open("/preview/notifications?state=ready&live=1", "notifications");
    await page.getByTestId("notification-n1").waitFor({ state: "visible" });
    check((await eyebrow(page)) === "읽지 않은 알림 3개", "처음엔 안 읽은 3개");
    await page.getByTestId("notification-n-live").waitFor({ state: "visible", timeout: 6000 });
    check((await eyebrow(page)) === "읽지 않은 알림 4개" && (await text(page, "preview-bell-badge")) === "4", "새 알림이 실시간으로 들어오면 머리글 · 종 배지가 4로 늘어난다");
    const first = await READ_ROWS(page).first().getAttribute("data-testid");
    check(first === "notification-n-live" && (await text(page, "notification-n-live")).includes("방금"), "새 알림은 맨 위에 \"방금\"으로 뜬다", first ?? "");
    await page.getByTestId("notification-n-live").click();
    await page.waitForTimeout(700);
    check((await eyebrow(page)) === "읽지 않은 알림 3개", "그 알림을 누르면 다시 3개");
    await page.close();
  }

  // 빈 상태 · 로딩 · 구독 실패
  {
    const empty = await open("/preview/notifications?state=empty", "notifications");
    await empty.page.getByTestId("notifications-empty").waitFor({ state: "visible", timeout: 6000 });
    check(
      (await text(empty.page, "notifications-empty")).includes("아직 알림이 없어요") && (await eyebrow(empty.page)) === "새 소식이 없어요" && (await empty.page.getByTestId("notifications-read-all").isDisabled()),
      "알림이 없으면 안내 · \"모두 읽음\"이 잠긴다",
    );
    await commonChecks("알림(빈 상태)", empty.page, empty.errors, "notifications");
    await empty.page.close();

    const loading = await open("/preview/notifications?state=loading", "notifications");
    check(
      (await count(loading.page, "notifications-skeleton")) === 1 && (await count(loading.page, "notifications-empty")) === 0 && (await eyebrow(loading.page)) === "불러오는 중",
      "로딩 — 스켈레톤 (빈 상태 안내는 아직 안 띄운다)",
    );
    await loading.page.close();

    const failed = await open("/preview/notifications?state=error", "notifications");
    await failed.page.getByTestId("notifications-error").waitFor({ state: "visible", timeout: 6000 });
    check(
      (await text(failed.page, "notifications-error")).includes(OFFLINE_TEXT) &&
        (await count(failed.page, "retry-button")) === 1 &&
        (await count(failed.page, "notifications-skeleton")) === 0 &&
        (await count(failed.page, "notifications-empty")) === 0,
      "구독 실패 — 한국어 네트워크 안내 + 다시 시도 (스켈레톤 · 빈 상태와 겹치지 않는다)",
    );
    await failed.page.getByTestId("retry-button").click();
    await failed.page.waitForTimeout(700);
    check((await count(failed.page, "notifications-error")) === 1, "다시 시도 → 다시 구독한다 (그래도 안 되면 에러가 그대로)");
    await commonChecks("알림(실패)", failed.page, failed.errors, "notifications");
    await failed.page.close();
  }

  /* ── 홈의 종 ────────────────────────────────────────────── */
  {
    const bell = async (query) => {
      const o = await open(`/preview/dashboard?state=ready${query}`, "dashboard");
      const has = (await count(o.page, "notification-bell")) === 1;
      const label = has ? await o.page.getByTestId("notification-bell").getAttribute("aria-label") : null;
      const badge = (await count(o.page, "notification-bell-badge")) === 1 ? await text(o.page, "notification-bell-badge") : null;
      const box = has ? await o.page.getByTestId("notification-bell").boundingBox() : null;
      return { has, label, badge, size: box ? [Math.round(box.width), Math.round(box.height)] : null, o };
    };
    const none = await bell("");
    check(!none.has, "종을 안 주면(알림을 모르는 화면) 헤더에 종이 없다");
    await none.o.page.close();

    const three = await bell("&unread=3");
    check(three.has && three.label === "알림, 읽지 않은 알림 3개" && three.badge === "3", "안 읽은 알림 3개 → 종 배지 3 · 접근성 라벨 \"알림, 읽지 않은 알림 3개\"", `${three.label} · ${three.badge}`);
    check(three.size !== null && three.size[0] >= 44 && three.size[1] >= 44, "종의 터치 영역은 44pt 이상", String(three.size));
    // 제목과 겹치지 않는다 (종은 오른쪽 모서리, 제목은 오른쪽 여백을 비워 둔다)
    const overlap = await three.o.page.evaluate(() => {
      const b = document.querySelector('[data-testid="notification-bell"]')?.getBoundingClientRect();
      const t = document.querySelector('[role="heading"]');
      if (!b || !t) return null;
      const range = document.createRange();
      range.selectNodeContents(t);
      const r = range.getBoundingClientRect();
      return r.right > b.left && r.left < b.right && r.bottom > b.top && r.top < b.bottom;
    });
    check(overlap === false, "종이 화면 제목과 겹치지 않는다", String(overlap));
    await three.o.page.screenshot({ path: join(OUT_DIR, "M8-dashboard-bell.png") });
    await commonChecks("홈(종)", three.o.page, three.o.errors, "dashboard");
    await three.o.page.close();

    const many = await bell("&unread=12");
    check(many.badge === "9+" && many.label === "알림, 읽지 않은 알림 12개", "12개 → 배지 \"9+\" (접근성 라벨은 실제 수 12)", `${many.label} · ${many.badge}`);
    await many.o.page.close();

    const zero = await bell("&unread=0");
    check(zero.has && zero.badge === null && zero.label === "알림", "0개 → 종만 있고 배지는 없다", `${zero.label} · ${zero.badge}`);
    await zero.o.page.close();
  }
} catch (err) {
  check(false, "검증 중 예외", String(err).split("\n")[0]);
} finally {
  await browser.close();
  stopServer();
}

console.log(`\n스크린샷: ${OUT_DIR}`);
if (failures.length) {
  console.error(`\nM8 웹 검증 실패 ${failures.length}건: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nM8 웹 검증을 통과했습니다.");
