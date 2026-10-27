/**
 * M9 검증 — 웹 **관리자 신고 처리 화면**(`components/admin/ModerationCards.tsx`)을 개발 전용 `/preview/admin`에서 Playwright로 본다 (에이전트 자동 실행용)
 *
 *   node scripts/verify-M9-admin-web.mjs      (웹 레포가 ../Offlo 에 있어야 한다 — 웹 개발 서버를 띄운다 · 이미 떠 있으면 쓴다)
 *
 * `/admin` 자체는 Firebase 로그인 + 관리자(`ADMIN_UIDS`)가 있어야 열려 Playwright가 못 넘는다 — 그래서 같은 카드를 샘플 값 + 가짜 처리로 띄운 미리보기를 본다.
 * 서버의 처리(삭제 · 제재 · 해제 · 404)는 `verify-M9-sanctions-api.mjs`가 실제 라우트로 본다. 이 스크립트는 **화면이 무엇을 보여 주고 어떤 요청을 만들어 내는가**를 본다.
 *
 * 확인 항목
 *   신고 카드 — 글 · 댓글 · 신고 수 · "모두에게 숨김" · 작성자(이름 · 이메일 · 제재 이력 · 정지 중) · 원문 · 사유 목록 · 가로 넘침 없음(390 · 1280)
 *   처리 — 제재 선택(6) · 제재를 고르면 사유(가장 많은 신고 사유가 기본) · "지우고 처리"는 한 번 더 확인 · 계정 정지는 더 강한 문구 · 취소 ·
 *          만들어 내는 요청(삭제만 · 경고 · 커뮤니티 7일 · 계정 정지 · 기각) · 처리한 카드는 사라진다 · 실패하면 카드가 남고 한국어 안내 · 연달아 눌러도 한 번
 *   제재 중 — 영구 정지 · 커뮤니티 정지 · 탈퇴한 계정 · 해제
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

import { chromium } from "playwright-core";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, ".verify");
const WEB_ROOT = process.env.OFFLO_WEB_ROOT ?? resolve(ROOT, "..", "Offlo");
const URL = process.env.OFFLO_WEB_APP_URL ?? "http://localhost:3000";
const PORT = new globalThis.URL(URL).port || "3000";
const BG = "rgb(4, 5, 8)";

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

/* ── 웹 개발 서버 ──────────────────────────────────────────── */
const previewUp = async () => {
  try {
    return (await fetch(`${URL}/preview/admin`, { signal: AbortSignal.timeout(4000) })).status === 200;
  } catch {
    return false;
  }
};
let devServer = null;
if (!(await previewUp())) {
  const webApp = join(WEB_ROOT, "web");
  if (!existsSync(webApp)) {
    console.error(`✗ 웹 앱 폴더를 찾을 수 없습니다: ${webApp}`);
    process.exit(2);
  }
  console.log("\n웹 개발 서버를 띄웁니다 …");
  devServer = spawn("npx", ["next", "dev", "--turbopack", "-p", String(PORT)], { cwd: webApp, stdio: "ignore", shell: true });
  for (let i = 0; i < 90 && !(await previewUp()); i++) await new Promise((r) => setTimeout(r, 2000));
}
const stopServer = () => {
  if (!devServer) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(devServer.pid), "/T", "/F"], { stdio: "ignore" });
  else devServer.kill("SIGTERM");
};

/* ── 브라우저 ──────────────────────────────────────────────── */
mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ executablePath: findChromium() });

async function open(query, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport, colorScheme: "dark", timezoneId: "Asia/Seoul", locale: "ko-KR" });
  const page = await context.newPage();
  const errors = [];
  // 웹 앱에는 favicon.ico가 없어 브라우저가 부르는 순간 404가 콘솔에 남는다 (이 화면과 무관한 기존 특성) — 그 한 건만 제외한다
  page.on("console", (m) => m.type() === "error" && !m.location().url?.endsWith("/favicon.ico") && errors.push(`${m.text()} ${m.location().url ?? ""}`));
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(`${URL}/preview/admin${query}`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.getByTestId("preview-admin").waitFor({ state: "visible", timeout: 60_000 });
  return { page, errors, context };
}
const text = (page, id) => page.getByTestId(id).first().innerText().then((t) => t.replace(/\s+/g, " ").trim());
const log = (page) => page.getByTestId("preview-log").innerText();
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

try {
  /* ── 신고 카드 ─────────────────────────────────────────── */
  {
    const { page, errors, context } = await open("?tab=reports");
    const p1 = await text(page, "report-post_p1");
    check(p1.includes("글") && p1.includes("신고 3건") && p1.includes("모두에게 숨김") && p1.includes("서연") && p1.includes("seoyeon@example.invalid") && p1.includes("제재 이력 1회"), "신고 카드 — 글 · 신고 3건 · 모두에게 숨김 · 작성자(이름 · 이메일) · 제재 이력");
    check(p1.includes("지어낸 문제 글입니다.") && p1.includes("욕설 · 혐오 · 괴롭힘 — 욕설이 있어요") && p1.includes("스팸 · 광고"), "원문 · 신고 사유와 신고자가 쓴 내용");
    const c9 = await text(page, "report-comment_c9");
    check(c9.includes("댓글") && c9.includes("신고 1건") && !c9.includes("모두에게 숨김") && /커뮤니티 정지 ~/.test(c9) && c9.includes("제재 이력 2회") && c9.includes("연락처가 적혀 있어요"), "댓글 카드 — 숨김 아님 · 지금 커뮤니티 정지 중(끝나는 시각) · 이력 2회");
    const p7 = await text(page, "report-post_p7");
    check(p7.includes("배지 자랑 · 7일 연속") && p7.includes("이력 없음"), "배지 자랑 글 — 배지 이름 · 본문이 없어도 깨지지 않는다 · 이력 없음");
    check(!(await overflow(page)), "데스크톱 1280 — 가로 넘침 없음");
    check((await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === BG || (await page.getByTestId("preview-admin").evaluate((el) => getComputedStyle(el).backgroundColor)) === BG, "바탕 #040508");
    await page.screenshot({ path: join(OUT_DIR, "M9-admin-1280.png"), fullPage: true });

    // 처리 선택
    const choice = page.getByTestId("choice-post_p1");
    check((await choice.locator("option").count()) === 6, "처리 방법 6가지 — 삭제만 · 경고 · 커뮤니티 7일 · 30일 · 영구 · 계정 영구 정지");
    check((await page.getByLabel("사용자에게 알리는 사유").count()) === 0, "제재를 고르기 전에는 사유 선택이 없다");
    await choice.selectOption("c7");
    check((await page.getByLabel("사용자에게 알리는 사유").first().inputValue()) === "abuse", "제재를 고르면 사유가 뜨고 기본은 가장 많이 신고된 사유(욕설 · 혐오 · 괴롭힘)다");

    // 한 번 더 확인 · 취소
    const card = page.getByTestId("report-post_p1");
    await card.getByRole("button", { name: "지우고 처리" }).click();
    check((await card.getByRole("button", { name: "확인 — 지우고 처리" }).count()) === 1 && (await card.getByRole("button", { name: "취소" }).count()) === 1, "\"지우고 처리\"를 누르면 바로 처리하지 않고 한 번 더 확인한다");
    await card.getByRole("button", { name: "취소" }).click();
    check((await card.getByRole("button", { name: "지우고 처리" }).count()) === 1 && (await log(page)) === "", "취소하면 아무 요청도 가지 않는다");
    await choice.selectOption("ban");
    await card.getByRole("button", { name: "지우고 처리" }).click();
    check((await card.getByRole("button", { name: "정말 계정을 정지할까요?" }).count()) === 1, "계정 영구 정지는 더 강한 확인 문구");
    await choice.selectOption("c7"); // 바꾸면 확인이 풀린다
    check((await card.getByRole("button", { name: "지우고 처리" }).count()) === 1, "처리 방법을 바꾸면 확인 상태가 풀린다 (고른 것과 다른 처리가 나가지 않는다)");

    // 처리 — 커뮤니티 7일 정지 (연달아 눌러도 한 번)
    await card.getByRole("button", { name: "지우고 처리" }).click();
    await card.getByRole("button", { name: "확인 — 지우고 처리" }).dblclick();
    await page.getByTestId("report-post_p1").waitFor({ state: "detached", timeout: 5000 });
    check((await log(page)) === 'delete post_p1 {"kind":"community","days":7,"reason":"abuse"}', "삭제 + 커뮤니티 7일 정지 — 요청 한 번(연달아 눌러도) · 종류 · 기간 · 사유", await log(page));

    // 기각 · 삭제만
    await page.getByTestId("report-comment_c9").getByRole("button", { name: "기각 (문제 없음)" }).click();
    await page.getByTestId("report-comment_c9").waitFor({ state: "detached", timeout: 5000 });
    const p7card = page.getByTestId("report-post_p7");
    await p7card.getByRole("button", { name: "지우고 처리" }).click();
    await p7card.getByRole("button", { name: "확인 — 지우고 처리" }).click();
    await p7card.waitFor({ state: "detached", timeout: 5000 });
    check((await log(page)).endsWith("dismiss comment_c9 | delete post_p7 none"), "기각 → 요청 · 삭제만 → 제재 없이(none)", await log(page));
    check(errors.length === 0, "콘솔 에러 0", errors.join(" | ").slice(0, 200));
    await context.close();
  }

  // 모바일 폭
  {
    const { page, context } = await open("?tab=reports", { width: 390, height: 844 });
    check(!(await overflow(page)), "모바일 390 — 가로 넘침 없음 (긴 이메일 · 긴 링크 포함)");
    await page.screenshot({ path: join(OUT_DIR, "M9-admin-390.png"), fullPage: true });
    await context.close();
  }

  // 실패
  {
    const { page, context } = await open("?tab=reports&fail=1");
    const card = page.getByTestId("report-post_p1");
    await page.getByTestId("choice-post_p1").selectOption("warn");
    await card.getByRole("button", { name: "지우고 처리" }).click();
    await card.getByRole("button", { name: "확인 — 지우고 처리" }).click();
    await card.getByText("인터넷에 연결되어 있지 않거나").waitFor({ state: "visible", timeout: 5000 });
    check((await card.count()) === 1 && (await card.getByRole("button", { name: "지우고 처리" }).count()) === 1 && (await log(page)) === "", "처리 실패 — 카드가 남고 한국어 안내 · 확인 상태는 풀린다 · 처리된 것으로 치지 않는다");
    await context.close();
  }

  /* ── 제재 중 ───────────────────────────────────────────── */
  {
    const { page, context } = await open("?tab=sanctions");
    const ban = await text(page, "sanction-aaaaaaaa");
    const comm = await text(page, "sanction-bbbbbbbb");
    check(ban.includes("도윤") && ban.includes("doyun@example.invalid") && ban.includes("계정 영구 정지") && ban.includes("제재 이력 3회"), "제재 중 — 계정 영구 정지(이름 · 이메일 · 이력)");
    check(comm.includes("탈퇴한 계정") && comm.includes("커뮤니티 영구 정지"), "탈퇴한 계정의 커뮤니티 영구 정지도 보인다 (이메일 해시 기록)");
    check(!(await overflow(page)), "제재 목록 — 가로 넘침 없음");
    await page.getByTestId("sanction-aaaaaaaa").getByRole("button", { name: "제재 해제" }).click();
    await page.getByTestId("sanction-aaaaaaaa").waitFor({ state: "detached", timeout: 5000 });
    check((await log(page)) === "lift aaaa" && (await page.getByTestId("sanction-bbbbbbbb").count()) === 1, "해제 — 요청 한 번 · 그 줄만 빠진다");
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
  console.error(`\nM9 관리자 화면 검증 실패 ${failures.length}건: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nM9 관리자 화면 검증을 통과했습니다.");
