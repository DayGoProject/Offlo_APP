/**
 * M9 검증 — 커뮤니티 신고 · 차단 · 이용 규칙 + Playwright (에이전트 자동 실행용)
 *
 *   node scripts/verify-M9-moderation-web.mjs
 *
 * 웹 미리보기는 CORS 때문에 실제 API를 부를 수 없고 Playwright는 Google 로그인을 못 넘는다.
 * 그래서 가드 밖 `/preview/community` · `/preview/blocked` · `/preview/settings`에 **실제 화면과 같은 컴포넌트 + 같은 `useFeed` · `useCommunityRules`**를
 * 샘플 값 + 화면 안 가짜 서버로 띄워 끝까지 눌러 본다. 실서버 동작은 `verify:M9-moderation-api`(웹의 실제 라우트)가 본다.
 *
 * 확인 항목
 *   이용 규칙 — 규칙 링크 · 규칙 창(항목 · 처리 방식 · 화면 안에 들어옴) · 동의 전에는 글 · 댓글이 서버로 가지 않는다(취소하면 쓴 글이 남는다) ·
 *               동의하면 한 번만 저장되고 이어서 올라간다 · 이후엔 다시 묻지 않는다 · 동의한 사람이 다시 보면 읽기 전용 · 신고 · 차단은 규칙 동의가 필요 없다
 *   글 신고 — 남의 글에만 "신고 · 차단" · 사유 5개 · 고르기 전엔 잠김 · 서버에 한 번(연달아 눌러도) · 카드가 사라지고 안내 · 실패하면 카드가 남고 한국어 안내
 *   글 차단 — 이름이 들어간 확인 문구 · 그 작성자의 글이 모두 빠진다 · 안내 · 실패 · 취소
 *   댓글 — 신고(그 댓글만 빠지고 카드 안 안내) · 차단(작성자 댓글이 모두 빠지고 피드도 다시 읽는다) · 패널은 한 번에 하나
 *   차단한 사용자 — 목록 · 해제(서버에 한 번 · 목록에서 빠진다) · 빈 상태 · 로딩 · 실패 · 해제 실패 · 설정의 "차단한 사용자" 줄
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

const feedCalls = (page) => page.evaluate(() => [...(globalThis.__offloFeedCalls ?? [])]);
const OPEN_COMMUNITY = (query = "") => open(`/preview/community?state=ready&notice=0${query}`, "community");
const NOTICE_REPORTED = "신고했어요. 이 글은 이제 보이지 않아요. 운영자가 확인할게요.";
const NOTICE_REPORTED_COMMENT = "신고했어요. 이 댓글은 이제 보이지 않아요. 운영자가 확인할게요.";

/** 글 카드들의 줄 단위 글자 — 작성자 이름이 한 줄로 따로 있다 */
const authorLines = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-testid^="post-p-"]')]
      .filter((el) => /^post-p-(\d+|new-\d+)$/.test(el.getAttribute("data-testid")))
      .map((el) => el.innerText.split("\n").map((s) => s.trim())),
  );

try {
  /* ── 이용 규칙 · 글 쓰기 ─────────────────────────────────── */
  {
    const { page, errors } = await OPEN_COMMUNITY("&rules=ask");
    await page.getByTestId("post-p-01").waitFor({ state: "visible" });
    check((await count(page, "community-rules-link")) === 1, "머리에 \"커뮤니티 이용 규칙\" 링크가 있다");

    // 규칙 창 — 동의 전 모습
    await page.getByTestId("community-rules-link").click();
    await page.getByTestId("rules-modal").waitFor({ state: "visible", timeout: 5000 });
    const body = await text(page, "rules-modal");
    check(body.includes("커뮤니티 이용 규칙") && (await page.locator('[data-testid^="rule-"]').count()) === 5, "규칙 창 — 제목 · 규칙 5개");
    check(body.includes("규칙을 어기면") && body.includes("서로 다른 3명") && body.includes("차단한 사용자"), "규칙 창 — 처리 방식(3명 신고 시 숨김 · 차단 해제 위치)이 적혀 있다");
    check((await count(page, "rules-accept")) === 1 && (await count(page, "rules-cancel")) === 1 && (await count(page, "rules-close")) === 0, "동의 전 — \"동의하고 계속\" · \"취소\"가 있다 (\"닫기\"는 없다)");
    const inside = await page.getByTestId("rules-modal").evaluate((el) => {
      const r = el.getBoundingClientRect();
      const a = document.querySelector('[data-testid="rules-accept"]').getBoundingClientRect();
      return r.left >= 0 && r.right <= window.innerWidth && r.top >= 0 && r.bottom <= window.innerHeight && a.bottom <= window.innerHeight && a.height >= 38;
    });
    check(inside, "규칙 창이 화면 안에 들어오고 동의 버튼이 보인다 (390 × 844)");
    await page.screenshot({ path: join(OUT_DIR, "M9-rules-modal.png") });
    await page.getByTestId("rules-cancel").click();
    await page.getByTestId("rules-modal").waitFor({ state: "detached", timeout: 5000 });
    check(!(await feedCalls(page)).includes("rules accepted"), "링크로 열었다가 취소해도 동의로 기록되지 않는다");

    // 글을 올리려는 순간 — 동의 전이면 규칙 창, 취소하면 서버에 안 가고 쓴 글은 남는다
    await page.getByTestId("composer-input").fill("규칙 동의 전에 쓴 글");
    await page.getByTestId("composer-submit").click();
    await page.getByTestId("rules-modal").waitFor({ state: "visible", timeout: 5000 });
    check((await feedCalls(page)).every((c) => !c.startsWith("post ")), "동의 전 — 글 올리기가 서버로 가지 않고 규칙 창이 먼저 뜬다");
    await page.getByTestId("rules-cancel").click();
    await page.getByTestId("rules-modal").waitFor({ state: "detached", timeout: 5000 });
    await page.waitForTimeout(400);
    check((await feedCalls(page)).every((c) => !c.startsWith("post ")) && (await page.getByTestId("composer-input").inputValue()) === "규칙 동의 전에 쓴 글", "규칙 창을 취소하면 글은 올라가지 않고 쓴 글이 입력칸에 남는다");

    // 동의 → 이어서 올라간다
    await page.getByTestId("composer-submit").click();
    await page.getByTestId("rules-modal").waitFor({ state: "visible", timeout: 5000 });
    await page.getByTestId("rules-accept").click();
    await page.getByTestId("post-p-new-1").waitFor({ state: "visible", timeout: 5000 });
    const calls = await feedCalls(page);
    check(calls.filter((c) => c === "rules accepted").length === 1 && calls.filter((c) => c.startsWith("post ")).length === 1, "\"동의하고 계속\" — 동의가 한 번 저장되고 글이 이어서 한 번 올라간다", calls.join(" | "));
    check((await count(page, "rules-modal")) === 0 && (await page.getByTestId("composer-input").inputValue()) === "", "창이 닫히고 입력칸이 비워진다");

    // 이후엔 다시 묻지 않는다
    await page.getByTestId("composer-input").fill("두 번째 글");
    await page.getByTestId("composer-submit").click();
    await page.getByTestId("post-p-new-2").waitFor({ state: "visible", timeout: 5000 });
    check((await count(page, "rules-modal")) === 0, "한 번 동의하면 다음 글에서는 규칙 창이 뜨지 않는다");

    // 동의한 사람이 다시 보면 읽기 전용
    await page.getByTestId("community-rules-link").click();
    await page.getByTestId("rules-modal").waitFor({ state: "visible", timeout: 5000 });
    check((await count(page, "rules-close")) === 1 && (await count(page, "rules-accept")) === 0 && (await count(page, "rules-cancel")) === 0, "동의한 뒤 다시 열면 읽기 전용 — \"닫기\"만 있다");
    await page.getByTestId("rules-close").click();
    await page.getByTestId("rules-modal").waitFor({ state: "detached", timeout: 5000 });
    await commonChecks("커뮤니티(규칙)", page, errors, "community");
    await page.close();
  }

  /* ── 이용 규칙 · 댓글 쓰기 ───────────────────────────────── */
  {
    const { page } = await OPEN_COMMUNITY("&rules=ask");
    await page.getByTestId("post-comments-p-04").click();
    await page.getByTestId("comment-input-p-04").fill("규칙 전에 쓴 댓글");
    await page.getByTestId("comment-send-p-04").click();
    await page.getByTestId("rules-modal").waitFor({ state: "visible", timeout: 5000 });
    check((await feedCalls(page)).every((c) => !c.startsWith("comment ")), "동의 전 — 댓글 등록이 서버로 가지 않고 규칙 창이 먼저 뜬다");
    await page.getByTestId("rules-cancel").click();
    await page.getByTestId("rules-modal").waitFor({ state: "detached", timeout: 5000 });
    await page.waitForTimeout(400);
    check((await feedCalls(page)).every((c) => !c.startsWith("comment ")) && (await page.getByTestId("comment-input-p-04").inputValue()) === "규칙 전에 쓴 댓글", "취소하면 댓글은 등록되지 않고 쓴 글이 남는다");
    await page.getByTestId("comment-send-p-04").click();
    await page.getByTestId("rules-accept").click();
    await page.locator('[data-testid^="comment-c-new"]').first().waitFor({ state: "visible", timeout: 5000 });
    check((await feedCalls(page)).filter((c) => c.startsWith("comment ")).length === 1 && (await page.getByTestId("comment-input-p-04").inputValue()) === "", "동의하면 댓글이 한 번 등록되고 입력칸이 비워진다");
    await page.close();
  }

  /* ── 글 신고 ─────────────────────────────────────────────── */
  {
    const { page, errors } = await OPEN_COMMUNITY("&rules=ask&slow=1");
    await page.getByTestId("post-p-01").waitFor({ state: "visible" });
    check((await count(page, "post-report-p-01")) === 1 && (await count(page, "post-report-p-03")) === 0, "\"신고 · 차단\"은 남의 글(p-01)에만 있고 내 글(p-03)에는 없다");
    check((await text(page, "post-report-p-01")) === "신고 · 차단", "링크 글자 \"신고 · 차단\"");

    await page.getByTestId("post-report-p-01").click();
    await page.getByTestId("post-p-01-mod").waitFor({ state: "visible" });
    check((await count(page, "post-p-01-mod-report")) === 1 && (await count(page, "post-p-01-mod-block")) === 1, "누르면 카드 안에 패널이 펼쳐지고 \"이 글 신고하기\" · \"~님 차단하기\"가 있다");
    check((await text(page, "post-p-01-mod-report")) === "이 글 신고하기", "메뉴 문구 \"이 글 신고하기\"");

    await page.getByTestId("post-p-01-mod-close").click();
    check((await count(page, "post-p-01-mod")) === 0, "메뉴의 \"닫기\"를 누르면 패널이 접힌다");
    await page.getByTestId("post-report-p-01").click();
    await page.getByTestId("post-p-01-mod-report").click();

    const reasons = await page.locator('[data-testid^="post-p-01-reason-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid").replace("post-p-01-reason-", "")));
    check(reasons.join() === "spam,abuse,sexual,privacy,other", "신고 사유 5개 — 스팸 · 욕설 · 음란 · 개인정보 · 기타", reasons.join());
    check(await page.getByTestId("post-p-01-mod-submit").isDisabled(), "사유를 고르기 전에는 \"신고하기\"가 잠겨 있다");
    await page.screenshot({ path: join(OUT_DIR, "M9-report-panel.png") });
    await page.getByTestId("post-p-01-reason-spam").click();
    check((await page.getByTestId("post-p-01-reason-spam").getAttribute("aria-checked")) === "true" && !(await page.getByTestId("post-p-01-mod-submit").isDisabled()), "사유를 고르면 선택 표시(radio · checked)가 되고 \"신고하기\"가 열린다");
    await page.getByTestId("post-p-01-reason-abuse").click();
    check((await page.getByTestId("post-p-01-reason-spam").getAttribute("aria-checked")) !== "true" && (await page.getByTestId("post-p-01-reason-abuse").getAttribute("aria-checked")) === "true", "사유는 하나만 고른다");

    await page.getByTestId("post-p-01-mod-submit").dblclick();
    await page.getByTestId("post-p-01").waitFor({ state: "detached", timeout: 8000 });
    const calls = await feedCalls(page);
    check(calls.filter((c) => c.startsWith("report ")).join() === "report post p-01 abuse", "신고 — 서버에 한 번 (연달아 눌러도 한 번 · 마지막에 고른 사유)", calls.join(" | "));
    check((await count(page, "post-p-02")) === 1, "신고한 글만 사라지고 다른 글은 그대로다");
    check((await count(page, "rules-modal")) === 0, "신고는 이용 규칙 동의가 없어도 된다 (규칙 창이 뜨지 않는다)");
    await page.getByTestId("feed-notice").waitFor({ state: "visible", timeout: 5000 });
    check((await text(page, "feed-notice")).includes(NOTICE_REPORTED), "신고 뒤 목록 아래에 안내가 뜬다", await text(page, "feed-notice"));
    await page.screenshot({ path: join(OUT_DIR, "M9-reported-notice.png") });
    await page.getByTestId("feed-notice-dismiss").click();
    check((await count(page, "feed-notice")) === 0, "\"확인\"을 누르면 안내가 사라진다");
    await commonChecks("커뮤니티(신고)", page, errors, "community");
    await page.close();
  }

  // 신고 실패 — 카드가 남고 한국어 안내
  {
    const { page } = await OPEN_COMMUNITY("&fail=report");
    await page.getByTestId("post-report-p-02").click();
    await page.getByTestId("post-p-02-mod-report").click();
    await page.getByTestId("post-p-02-reason-other").click();
    await page.getByTestId("post-p-02-mod-submit").click();
    await page.getByTestId("post-p-02-mod-error").waitFor({ state: "visible", timeout: 5000 });
    check((await text(page, "post-p-02-mod-error")).includes(OFFLINE_TEXT) && (await count(page, "post-p-02")) === 1 && (await count(page, "feed-notice")) === 0, "신고 실패 — 패널 안에 한국어 네트워크 안내 · 글은 그대로 · 완료 안내는 뜨지 않는다");
    check(!(await page.getByTestId("post-p-02-mod-submit").isDisabled()), "실패한 뒤 \"신고하기\"가 다시 열려 있다 (다시 시도할 수 있다)");
    await page.getByTestId("post-p-02-mod-cancel").click();
    check((await count(page, "post-p-02-mod")) === 0, "\"취소\"를 누르면 패널이 접힌다");
    await page.close();
  }

  /* ── 글 차단 ─────────────────────────────────────────────── */
  {
    const { page } = await OPEN_COMMUNITY();
    await page.getByTestId("post-p-02").waitFor({ state: "visible" });
    await page.getByTestId("post-report-p-02").click();
    const blockLabel = await text(page, "post-p-02-mod-block");
    const name = /^(.+)님 차단하기$/.exec(blockLabel)?.[1];
    check(!!name, "메뉴에 \"~님 차단하기\"로 작성자 이름이 들어간다", blockLabel);

    const before = (await authorLines(page)).filter((lines) => lines.includes(name)).length;
    await page.getByTestId("post-p-02-mod-block").click();
    const confirm = await text(page, "post-p-02-mod");
    check(confirm.includes(`${name}님을 차단할까요?`) && confirm.includes("설정 → 차단한 사용자"), "차단 확인 — 이름 · 해제 위치(설정 → 차단한 사용자)를 알려 준다", confirm.slice(0, 80));
    await page.screenshot({ path: join(OUT_DIR, "M9-block-confirm.png") });

    // 취소하면 그대로
    await page.getByTestId("post-p-02-mod-cancel").click();
    check((await count(page, "post-p-02-mod")) === 0 && (await feedCalls(page)).every((c) => !c.startsWith("block ")), "취소하면 차단되지 않는다");

    await page.getByTestId("post-report-p-02").click();
    await page.getByTestId("post-p-02-mod-block").click();
    await page.getByTestId("post-p-02-mod-block-ok").click();
    await page.getByTestId("post-p-02").waitFor({ state: "detached", timeout: 8000 });
    await page.waitForTimeout(600);
    const calls = await feedCalls(page);
    check(calls.filter((c) => c.startsWith("block ")).join() === "block post p-02", "차단 — 서버에 한 번 (글로 가리킨다)", calls.join(" | "));
    check(calls.at(-1) === "page first", "차단 뒤 첫 페이지를 조용히 다시 읽는다 (그 사람의 다른 글도 빠지게)");
    const after = (await authorLines(page)).filter((lines) => lines.includes(name)).length;
    check(before >= 2 && after === 0, `차단한 작성자(${before}개 → ${after}개)의 글이 모두 사라진다`, `${before} → ${after}`);
    check((await text(page, "feed-notice")).includes(`${name}님을 차단했어요`), "차단 뒤 안내 — \"~님을 차단했어요\"");
    await page.close();
  }

  // 차단 실패
  {
    const { page } = await OPEN_COMMUNITY("&fail=block");
    await page.getByTestId("post-report-p-02").click();
    await page.getByTestId("post-p-02-mod-block").click();
    await page.getByTestId("post-p-02-mod-block-ok").click();
    await page.getByTestId("post-p-02-mod-error").waitFor({ state: "visible", timeout: 5000 });
    check((await text(page, "post-p-02-mod-error")).includes(OFFLINE_TEXT) && (await count(page, "post-p-02")) === 1 && (await count(page, "feed-notice")) === 0, "차단 실패 — 한국어 네트워크 안내 · 글은 그대로");
    await page.close();
  }

  /* ── 댓글 신고 · 차단 ────────────────────────────────────── */
  {
    const { page, errors } = await OPEN_COMMUNITY();
    await page.getByTestId("post-comments-p-02").click();
    await page.getByTestId("comment-c-2").waitFor({ state: "visible", timeout: 5000 });
    check((await count(page, "comment-report-c-2")) === 1 && (await count(page, "comment-report-c-3")) === 0 && (await count(page, "comment-delete-c-3")) === 1, "댓글 — 남의 댓글(c-2)에만 \"신고 · 차단\", 내 댓글(c-3)에는 삭제만");
    await page.getByTestId("post-comments-p-03").click();
    await page.getByTestId("comment-c-4").waitFor({ state: "visible", timeout: 5000 });

    // 패널은 한 번에 하나
    await page.getByTestId("comment-report-c-5").click();
    await page.getByTestId("comment-c-5-mod").waitFor({ state: "visible" });
    await page.getByTestId("comment-report-c-4").click();
    await page.getByTestId("comment-c-4-mod").waitFor({ state: "visible" });
    check((await count(page, "comment-c-5-mod")) === 0 && (await text(page, "comment-c-4-mod-report")) === "이 댓글 신고하기", "다른 댓글의 패널을 열면 앞의 패널은 접힌다 · 메뉴 문구 \"이 댓글 신고하기\"");

    // 신고
    await page.getByTestId("comment-c-4-mod-report").click();
    await page.getByTestId("comment-c-4-reason-abuse").click();
    await page.getByTestId("comment-c-4-mod-submit").click();
    await page.getByTestId("comment-c-4").waitFor({ state: "detached", timeout: 8000 });
    const calls = await feedCalls(page);
    check(calls.includes("report comment c-4 abuse"), "댓글 신고 — 서버에 한 번", calls.join(" | "));
    check((await count(page, "comment-c-5")) === 1 && (await count(page, "post-p-03")) === 1, "신고한 댓글만 빠지고 다른 댓글 · 글은 그대로다");
    check((await text(page, "post-info-p-03")).includes(NOTICE_REPORTED_COMMENT), "카드 안에 \"신고했어요. 이 댓글은 이제 보이지 않아요\" 안내", await text(page, "post-info-p-03"));
    check((await count(page, "feed-notice")) === 0, "댓글 신고는 목록 아래 안내를 띄우지 않는다 (카드가 남아 있어 카드 안에서 알린다)");

    // 차단 — 작성자의 댓글이 모두 빠지고 피드도 다시 읽는다
    await page.getByTestId("comment-report-c-6").click();
    const blockLabel = await text(page, "comment-c-6-mod-block");
    const name = /^(.+)님 차단하기$/.exec(blockLabel)?.[1];
    await page.getByTestId("comment-c-6-mod-block").click();
    await page.getByTestId("comment-c-6-mod-block-ok").click();
    await page.getByTestId("comment-c-6").waitFor({ state: "detached", timeout: 8000 });
    await page.waitForTimeout(600);
    const after = await feedCalls(page);
    const blockedAt = after.indexOf("block comment c-6");
    check(
      after.filter((c) => c.startsWith("block ")).join() === "block comment c-6" && after.indexOf("page first", blockedAt) > blockedAt && after.indexOf("comments p-03", blockedAt) > blockedAt,
      "댓글 작성자 차단 — 서버에 한 번 (댓글로 가리킨다) · 피드와 이 글의 댓글을 다시 읽는다",
      after.slice(-4).join(" | "),
    );
    check((await text(page, "post-info-p-03")).includes(`${name}님을 차단했어요`) && (await count(page, "comment-c-5")) === 1, "카드 안에 \"~님을 차단했어요\" 안내 · 다른 사람의 댓글은 그대로", name);
    // 같은 작성자의 다른 댓글(p-01의 c-1)도 빠진다 — 서연이 차단 대상일 때
    if (name === "서연") {
      await page.getByTestId("post-comments-p-01").click();
      await page.waitForTimeout(600);
      check((await count(page, "comment-c-1")) === 0, "차단한 작성자의 다른 글 댓글(c-1)도 보이지 않는다");
    }
    await commonChecks("커뮤니티(댓글 신고 · 차단)", page, errors, "community");
    await page.close();
  }

  /* ── 차단한 사용자 화면 ──────────────────────────────────── */
  {
    const blockedCalls = (page) => page.evaluate(() => [...(globalThis.__offloBlockedCalls ?? [])]);
    const { page, errors } = await open("/preview/blocked?state=ready&slow=1", "blocked");
    await page.getByTestId("blocked-u-blocked-1").waitFor({ state: "visible" });
    check((await page.locator("body").innerText()).includes("차단 2명") && (await text(page, "blocked-u-blocked-1")).includes("도윤") && (await text(page, "blocked-u-blocked-2")).includes("예린"), "목록 — \"차단 2명\" · 이름");
    check((await text(page, "blocked-u-blocked-1")).includes("2026.09.15 차단"), "차단한 날짜 (\"2026.09.15 차단\")", (await text(page, "blocked-u-blocked-1")).slice(0, 40));
    await page.screenshot({ path: join(OUT_DIR, "M9-blocked.png"), fullPage: true });
    await page.getByTestId("unblock-u-blocked-1").dblclick();
    check((await text(page, "unblock-u-blocked-1")) === "푸는 중…" && (await page.getByTestId("unblock-u-blocked-2").isDisabled()), "해제 중에는 버튼이 \"푸는 중…\"이고 다른 해제도 잠긴다");
    await page.getByTestId("blocked-u-blocked-1").waitFor({ state: "detached", timeout: 5000 });
    check((await blockedCalls(page)).join() === "unblock u-blocked-1", "해제 — 서버에 한 번 (연달아 눌러도 한 번)", (await blockedCalls(page)).join());
    check((await count(page, "blocked-u-blocked-2")) === 1 && (await page.locator("body").innerText()).includes("차단 1명"), "해제한 사람만 빠지고 \"차단 1명\"이 된다");
    await commonChecks("차단한 사용자", page, errors, "blocked");
    await page.close();
  }
  {
    const { page } = await open("/preview/blocked?state=ready&fail=unblock", "blocked");
    await page.getByTestId("unblock-u-blocked-1").click();
    await page.getByTestId("unblock-error-u-blocked-1").waitFor({ state: "visible", timeout: 5000 });
    check((await text(page, "unblock-error-u-blocked-1")).includes(OFFLINE_TEXT) && (await count(page, "blocked-u-blocked-1")) === 1 && !(await page.getByTestId("unblock-u-blocked-1").isDisabled()), "해제 실패 — 그 줄에 한국어 안내 · 목록은 그대로 · 다시 누를 수 있다");
    await page.close();
  }
  {
    const empty = await open("/preview/blocked?state=empty", "blocked");
    await empty.page.getByTestId("blocked-empty").waitFor({ state: "visible" });
    check((await text(empty.page, "blocked-empty")).includes("차단한 사용자가 없어요") && (await empty.page.locator("body").innerText()).includes("차단 0명"), "빈 상태 — \"차단한 사용자가 없어요\" · \"차단 0명\"");
    await commonChecks("차단한 사용자(빈 상태)", empty.page, empty.errors, "blocked");
    await empty.page.close();
    const loading = await open("/preview/blocked?state=loading", "blocked");
    check((await count(loading.page, "blocked-skeleton")) === 1, "로딩 — 스켈레톤");
    await loading.page.close();
    const failed = await open("/preview/blocked?state=error", "blocked");
    await failed.page.getByTestId("blocked-error").waitFor({ state: "visible" });
    check((await text(failed.page, "blocked-error")).includes(OFFLINE_TEXT) && (await count(failed.page, "retry-button")) >= 1, "불러오기 실패 — 한국어 안내 + 다시 시도");
    await failed.page.close();
  }

  /* ── 설정의 "차단한 사용자" 줄 ───────────────────────────── */
  {
    const { page } = await open("/preview/settings?state=ready", "settings");
    await page.getByTestId("settings-blocked").waitFor({ state: "visible" });
    check((await text(page, "settings-blocked")).includes("차단한 사용자"), "설정에 \"차단한 사용자\" 줄이 있다");
    await page.getByTestId("settings-blocked").click();
    check((await page.evaluate(() => [...(globalThis.__offloSettingsCalls ?? [])])).includes("open-blocked"), "줄을 누르면 차단한 사용자 화면으로 간다 (미리보기에서는 호출 기록)");
    await page.close();
  }
} catch (err) {
  check(false, "검증 중 예외", String(err).split("\n").slice(0, 3).join(" / "));
} finally {
  await browser.close();
  stopServer();
}

console.log(`\n스크린샷: ${OUT_DIR}`);
if (failures.length) {
  console.error(`\nM9 신고 · 차단 웹 검증 실패 ${failures.length}건: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nM9 신고 · 차단 웹 검증을 통과했습니다.");
