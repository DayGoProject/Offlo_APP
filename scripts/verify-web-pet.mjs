/**
 * 웹 정원의 3D 동물 검증 (Node · Playwright · 에이전트 자동 실행용)
 *
 *   node scripts/verify-web-pet.mjs
 *
 * **웹 레포(Offlo)의 개발 서버**를 띄워 `/preview/garden`(개발 전용 · 프로덕션에서는 404)을 연다. 웹 `/garden`은 Firebase 로그인이 필요해
 * Playwright가 못 넘으므로, 같은 컴포넌트(`PetStage`)와 같은 쓰다듬기 규칙(`tapPet`)을 샘플 값으로 띄운 이 페이지로 점검한다.
 * 개발 서버가 이미 떠 있으면(`OFFLO_WEB_APP_URL`, 기본 http://localhost:3000) 그대로 쓴다. 웹 경로가 다르면 OFFLO_WEB_ROOT.
 *
 * 확인 항목
 *   0. 앱 → 웹 동기화가 어긋나지 않았는가 (`sync-pet-web.mjs`)
 *   1. 상태 4종(배부름 · 출출 · 굶주림 · 알) × 동물 — 방 + 3D 캔버스 1개 + 식물 · 말풍선 · 상태 칩 · 움직임 · 가로 넘침 없음 · 콘솔 에러 0
 *   2. 쓰다듬기 — 탭(하트 · 친밀도 +1 · 반응 말) · 하루 5번 상한(말 · 더는 안 쌓임) · 문지르기(= 1번) · 세로로만 끌면 안 센다 · 터치 스크롤이 막히지 않는다
 *   3. 장면 — 굶주리면 방이 가라앉음 · 시간대별 하늘 · 먹는 연출 · 부화
 *   4. 폴백(.claude/rules/3d.md) — 동작 줄이기 · WebGL 불가 · `fallback=1`이면 기존 SVG 동물 · 3D 번들을 받지 않는다
 *   5. 성능 가드 — 픽셀 비율 ≤ 1.5 · 고른 동물의 모델 하나만 받는다
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Buffer } from "node:buffer";

import { chromium } from "playwright-core";
import { PNG } from "pngjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, ".verify");
const WEB_ROOT = process.env.OFFLO_WEB_ROOT ?? resolve(ROOT, "..", "Offlo");
const URL = process.env.OFFLO_WEB_APP_URL ?? "http://localhost:3000";
const PORT = new globalThis.URL(URL).port || "3000";

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

/* ── 0. 동기화 ─────────────────────────────────────────────── */
{
  const sync = spawnSync(process.execPath, [join(ROOT, "scripts", "sync-pet-web.mjs")], { stdio: "inherit" });
  if (sync.status !== 0) {
    console.error("\n웹의 동물 코드가 앱 원본과 갈라져 있습니다. 먼저 `node scripts/sync-pet-web.mjs --push`로 맞추세요.");
    process.exit(1);
  }
}

/* ── 개발 서버 ─────────────────────────────────────────────── */
const previewUp = async () => {
  try {
    return (await fetch(`${URL}/preview/garden`, { signal: AbortSignal.timeout(4000) })).status === 200;
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

// `@/…` → 앱 src/ (logic/pet.ts · scene.ts가 공유 코드를 런타임에 import한다 — 웹 복사본과 같은 내용이다)
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) {
      const base = join(ROOT, "src", specifier.slice(2));
      const file = [".ts", ".tsx", "/index.ts"].map((ext) => base + ext).find(existsSync);
      if (file) return next(pathToFileURL(file).href, context);
    }
    return next(specifier, context);
  },
});
const P = await import(pathToFileURL(join(ROOT, "src", "logic", "pet.ts")).href);
const scene = await import(pathToFileURL(join(ROOT, "src", "logic", "scene.ts")).href);

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ executablePath: findChromium() });
const ctxOpts = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: "dark", timezoneId: "Asia/Seoul", locale: "ko-KR" };

/** 화면을 열고 콘솔 에러 · 받은 모델 파일을 모은다 */
async function open(path, { context, ready = true } = {}) {
  const ctx = context ?? (await browser.newContext(ctxOpts));
  const page = await ctx.newPage();
  const errors = [];
  const glbs = [];
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204, body: "" })); // 웹에 파비콘이 없다 — 이 검증과 무관한 404
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("request", (r) => r.url().endsWith(".glb") && glbs.push(r.url().split("/").pop()));
  await page.goto(`${URL}${path}`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.getByTestId("preview-affection").waitFor({ state: "visible", timeout: 60_000 });
  if (ready) {
    const ok = await page.getByTestId("pet-3d-ready").waitFor({ state: "attached", timeout: 30_000 }).then(() => true).catch(() => false);
    if (!ok) errors.push("3D 동물이 준비되지 않았다");
    await page.waitForTimeout(700); // 페이드 인
  }
  return { page, errors, glbs, ctx };
}

const text = (page, id) => page.getByTestId(id).first().innerText().then((t) => t.trim());
const today = async (page) => {
  const m = (await text(page, "preview-affection")).match(/오늘 (\d+)\/(\d+)번/);
  return m ? Number(m[1]) : -1;
};
const bubble = async (page) => {
  await page.getByTestId("pet-bubble").last().waitFor({ state: "visible", timeout: 5000 });
  return (await page.getByTestId("pet-bubble").last().innerText()).trim();
};
const lines = (cond, type, kind) => [0, 1, 2].map((i) => P.reactionLine(cond, type, kind, i));
const petClip = async (page) => {
  const box = await page.getByTestId("pet-stage").boundingBox();
  return { x: box.x + box.width * 0.38, y: box.y + box.height * 0.44, width: box.width * 0.5, height: box.height * 0.5 };
};
/** 쓰다듬기 하트(#FF6F8E 계열)의 픽셀 수 */
const heartPixels = (png) => {
  const img = PNG.sync.read(png);
  let n = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    const [r, g, b] = [img.data[i], img.data[i + 1], img.data[i + 2]];
    if (r > 225 && g > 70 && g < 140 && b > 100 && b < 190 && r - g > 110) n++;
  }
  return n;
};
const changedPixels = (a, b) => {
  const [pa, pb] = [PNG.sync.read(a), PNG.sync.read(b)];
  let n = 0;
  for (let i = 0; i < pa.data.length; i += 4) {
    if (Math.abs(pa.data[i] - pb.data[i]) + Math.abs(pa.data[i + 1] - pb.data[i + 1]) + Math.abs(pa.data[i + 2] - pb.data[i + 2]) > 24) n++;
  }
  return n;
};
const hearts = async (page, clip) => heartPixels(Buffer.from(await page.screenshot({ clip })));

try {
  /* ── 1. 상태 4종 × 동물 ─────────────────────────────────── */
  const cases = [
    { q: "state=fed&type=cat", state: "fed", cond: "fed", type: "cat", glb: "cat.glb" },
    { q: "state=peckish&type=dog&at=dusk", state: "peckish", cond: "peckish", type: "dog", glb: "dog.glb" },
    { q: "state=starving&type=rabbit&at=night", state: "starving", cond: "starving", type: "rabbit", glb: "rabbit.glb" },
    { q: "state=egg&type=cat&at=night", state: "egg", cond: "egg", type: "cat", glb: "cat.glb" },
  ];
  for (const { q, state, cond, type, glb } of cases) {
    const { page, errors, glbs } = await open(`/preview/garden?${q}`);
    const stage = page.getByTestId("pet-stage");
    const box = await stage.boundingBox();
    check(Math.abs(box.height / box.width - 418 / 360) < 0.02, `웹 정원(${state}) · 방 비율 360:418`, `${Math.round(box.width)}×${Math.round(box.height)}`);
    check((await stage.locator("canvas").count()) === 1, `웹 정원(${state}) · 3D 캔버스 1개`);
    check((await stage.locator('[data-testid="plant-image"], img').count()) >= 1, `웹 정원(${state}) · 식물이 방에 놓임`);
    check((await text(page, "pet-condition-chip")) === { fed: "배부름", peckish: "출출함", starving: "굶주림", egg: "알" }[state], `웹 정원(${state}) · 상태 칩`);

    // 방이 가라앉는가 — 굶주림이면 오버레이가 켜진다
    const cold = Number(await page.getByTestId("pet-room-cold").evaluate((el) => getComputedStyle(el).opacity));
    check(cold === (state === "starving" ? 1 : 0), `웹 정원(${state}) · 방이 ${state === "starving" ? "서늘하게 가라앉음" : "그대로"}`, `opacity ${cold}`);

    // 말풍선 — 첫 혼잣말이 1.5초 뒤에 나온다. 상태 · 동물에 맞는 대사여야 한다
    const line = await bubble(page);
    check(scene.speechLines(cond, type).includes(line), `웹 정원(${state}) · 말풍선이 ${type} · ${cond}에 맞음`, line);

    // 살아 있는가 — 같은 영역을 0.9초 간격으로 두 번 찍어 달라야 한다 (말풍선이 사라진 뒤)
    await page.waitForTimeout(3600);
    const clip = await petClip(page);
    const a = await page.screenshot({ clip });
    await page.waitForTimeout(900);
    const b = await page.screenshot({ clip });
    check(!Buffer.from(a).equals(Buffer.from(b)), `웹 정원(${state}) · 동물이 움직인다`);
    await page.screenshot({ path: join(OUT_DIR, `W-scene-${state}.png`) });

    // 모델은 고른 동물 것 하나만 받는다 (3종 3.7MB를 다 받지 않는다)
    check(glbs.length === 1 && glbs[0] === glb, `웹 정원(${state}) · 모델 파일은 ${glb} 하나만 받는다`, glbs.join(","));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    check(overflow, `웹 정원(${state}) · 가로 넘침 없음 (390px)`);
    check(errors.length === 0, `웹 정원(${state}) · 콘솔 에러 0`, errors.join(" | ").slice(0, 240));
    await page.context().close();
  }

  /* ── 픽셀 비율 가드 ──────────────────────────────────────── */
  {
    const { page, ctx } = await open("/preview/garden?state=fed&type=cat");
    const dims = await page.getByTestId("pet-stage").locator("canvas").evaluate((c) => ({ px: c.width, css: c.getBoundingClientRect().width }));
    check(dims.px <= Math.ceil(dims.css * 1.5) + 1, "성능 가드 — 픽셀 비율이 1.5를 넘지 않는다 (DPR 2 화면에서도)", `캔버스 ${dims.px}px / CSS ${Math.round(dims.css)}px`);
    await ctx.close();
  }

  /* ── 2. 쓰다듬기 ───────────────────────────────────────── */
  {
    const { page, errors, ctx } = await open("/preview/garden?state=fed&type=cat&today=2&total=9");
    check((await today(page)) === 2, "쓰다듬기 — 시작 값 오늘 2/5번 (누적 9)");
    const touch = page.getByTestId("pet-touch");
    check((await touch.evaluate((el) => getComputedStyle(el).touchAction)) === "pan-y", "터치면은 touch-action: pan-y — 세로 스크롤을 막지 않는다");
    check((await touch.getAttribute("role")) === "button" && (await touch.getAttribute("aria-label")) === "동물 쓰다듬기", "접근성 — 버튼 역할 · 한국어 라벨");

    const clip = await petClip(page);
    const before = await hearts(page, clip);
    await touch.click();
    await page.waitForTimeout(700);
    const after = await hearts(page, clip);
    check(after > before + 40, "동물을 누르면 하트가 올라온다 (3D 렌더 · 탭 판정)", `하트 픽셀 ${before} → ${after}`);
    check((await today(page)) === 3, "탭 1 — 오늘 3/5번 + 레벨업(누적 10)", await text(page, "preview-affection"));
    check((await text(page, "preview-affection")).includes("Lv.2 조심스러운 사이"), "탭 1 — 친밀도 Lv.2 조심스러운 사이");
    check((await bubble(page)) === "친밀도 Lv.2 · 조심스러운 사이!", "탭 1 — 레벨업을 말풍선으로 알려 준다");

    await touch.click();
    await page.waitForTimeout(250);
    check((await today(page)) === 4 && lines("fed", "cat", "pet").includes(await bubble(page)), "탭 2 — 오늘 4/5번 · 쓰다듬는 손에 대답한다", await bubble(page));
    await touch.click();
    await page.waitForTimeout(250);
    check((await today(page)) === 5 && lines("fed", "cat", "capped").includes(await bubble(page)), "탭 3 — 오늘 5/5번(상한 달성) · \"오늘은 충분해요\" 말", await bubble(page));
    await touch.click();
    await page.waitForTimeout(250);
    const capped = await text(page, "preview-affection");
    check((await today(page)) === 5 && capped.includes("누적 12") && lines("fed", "cat", "capped").includes(await bubble(page)), "탭 4 — 상한 뒤에는 더 쌓이지 않는다 (누적 12 그대로 · 화면 반응만)", capped);
    check(JSON.stringify(await page.evaluate(() => globalThis.__offloPetSends)) === "[1,1,1]", "상한 뒤의 탭은 서버 기록 요청을 만들지 않는다", JSON.stringify(await page.evaluate(() => globalThis.__offloPetSends)));
    check(errors.length === 0, "쓰다듬기(탭) · 콘솔 에러 0", errors.join(" | ").slice(0, 240));
    await ctx.close();
  }
  {
    // 문지르기 — 좌우로 쓱쓱 = 마치면 1번 · 세로로만 끌면 쓰다듬기가 아니다
    const { page, ctx } = await open("/preview/garden?state=fed&type=dog&today=0&total=0");
    const touch = page.getByTestId("pet-touch");
    const box = await touch.boundingBox();
    const y = box.y + box.height * 0.5;
    const clip = await petClip(page);
    const before = await hearts(page, clip);
    await page.mouse.move(box.x + box.width * 0.25, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.75, y, { steps: 14 });
    await page.mouse.move(box.x + box.width * 0.3, y, { steps: 14 });
    await page.waitForTimeout(700);
    const mid = await hearts(page, clip);
    check((await today(page)) === 0, "문지르는 중에는 아직 세지 않는다 (마친 뒤 한 번)");
    check(mid > before + 40, "문지르면 하트가 올라온다 (떼기 전에도)", `하트 픽셀 ${before} → ${mid}`);
    check(lines("fed", "dog", "pet").includes(await bubble(page)), "문지르면 동물이 한마디 한다");
    await page.mouse.up();
    await page.waitForTimeout(200);
    check((await today(page)) === 1, "문지르기를 마치면 1번으로 센다 (아무리 오래 문질러도 1번)", String(await today(page)));

    await page.mouse.move(box.x + box.width * 0.5, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.5, y + 90, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    check((await today(page)) === 1, "세로로만 끌면 쓰다듬기가 아니다 (1/5번 그대로)");
    await ctx.close();
  }
  {
    // 터치로 위아래 스크롤 — 동물 위에서 시작해도 페이지가 스크롤된다 (CDP 터치 제스처)
    const ctx = await browser.newContext({ ...ctxOpts, viewport: { width: 390, height: 520 }, hasTouch: true, isMobile: true });
    const { page } = await open("/preview/garden?state=fed&type=cat&today=0&total=0", { context: ctx });
    const box = await page.getByTestId("pet-touch").boundingBox();
    const cdp = await ctx.newCDPSession(page);
    const scrollBefore = await page.evaluate(() => window.scrollY);
    // 실제 터치 이벤트 열 (손가락이 동물 위에서 시작해 위로 끈다) — `synthesizeScrollGesture`는 이 환경에서 스크롤을 일으키지 못해 쓰지 않는다
    const x = Math.round(box.x + box.width / 2);
    const y0 = Math.round(box.y + box.height / 2);
    const touchPoint = (y) => [{ x, y: Math.round(y), id: 1 }];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: touchPoint(y0) });
    for (let i = 1; i <= 12; i++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: touchPoint(y0 - i * 14) });
      await page.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(700);
    const scrollAfter = await page.evaluate(() => window.scrollY);
    check(scrollAfter > scrollBefore + 40, "터치로 동물 위에서 위로 쓸면 페이지가 스크롤된다 (터치면이 스크롤을 막지 않는다)", `scrollY ${scrollBefore} → ${scrollAfter}`);
    check((await today(page)) === 0, "스크롤은 쓰다듬기로 세지 않는다", String(await today(page)));
    await ctx.close();
  }

  /* ── 3. 장면 ───────────────────────────────────────────── */
  {
    // 시간대별 하늘 — 밤엔 별 · 낮엔 구름
    const night = await open("/preview/garden?state=fed&type=cat&at=night");
    const day = await open("/preview/garden?state=fed&type=cat&at=day");
    check((await night.page.locator(".offlo-room-stars-a").count()) === 1 && (await night.page.locator(".offlo-room-cloud").count()) === 0, "창밖 — 밤에는 별이 반짝인다");
    check((await day.page.locator(".offlo-room-cloud").count()) === 1 && (await day.page.locator(".offlo-room-stars-a").count()) === 0, "창밖 — 낮에는 구름이 흐른다");
    await night.ctx.close();
    await day.ctx.close();
  }
  {
    // 먹는 연출 — `then=fed`는 4.5초 뒤 분석을 마친 상태로 바뀐다 (고개를 그릇에 넣는 자세가 되므로 동물 영역이 크게 달라진다)
    const { page, errors, ctx } = await open("/preview/garden?state=peckish&type=dog&then=fed");
    const box = await page.getByTestId("pet-stage").boundingBox();
    const wide = { x: box.x, y: box.y + box.height * 0.3, width: box.width, height: box.height * 0.7 };
    check((await text(page, "pet-condition-chip")) === "출출함", "먹는 연출 · 전환 전에는 출출함");
    const hungry = await page.screenshot({ clip: wide });
    await page.getByTestId("pet-condition-chip").filter({ hasText: "배부름" }).waitFor({ timeout: 15_000 });
    await page.waitForTimeout(1200);
    const eating = await page.screenshot({ clip: wide });
    check(changedPixels(hungry, eating) > 30_000, "먹는 연출 · 배부름으로 바뀌면 동물이 그릇으로 고개를 숙인다", `달라진 픽셀 ${changedPixels(hungry, eating)}`);
    check(errors.length === 0, "먹는 연출 · 콘솔 에러 0", errors.join(" | ").slice(0, 240));
    await ctx.close();
  }
  {
    // 부화 — 알에 첫 밥(연속 기록 0 → 1)이 들어가면 알이 아기로 바뀐다
    const { page, ctx } = await open("/preview/garden?state=egg&type=cat&then=fed");
    const box = await page.getByTestId("pet-stage").boundingBox();
    const wide = { x: box.x, y: box.y + box.height * 0.3, width: box.width, height: box.height * 0.7 };
    const egg = await page.screenshot({ clip: wide });
    await page.getByTestId("pet-condition-chip").filter({ hasText: "배부름" }).waitFor({ timeout: 15_000 });
    await page.waitForTimeout(2500);
    const baby = await page.screenshot({ clip: wide });
    check(changedPixels(egg, baby) > 30_000, "부화 · 알이 아기로 바뀐다", `달라진 픽셀 ${changedPixels(egg, baby)}`);
    await ctx.close();
  }

  /* ── 4. 폴백 ───────────────────────────────────────────── */
  {
    const reduced = await browser.newContext({ ...ctxOpts, reducedMotion: "reduce" });
    const { page, glbs } = await open("/preview/garden?state=fed&type=cat", { context: reduced, ready: false });
    await page.waitForTimeout(1500);
    check((await page.getByTestId("pet-stage").count()) === 0 && (await page.locator("canvas").count()) === 0, "동작 줄이기 — 3D 무대 · 캔버스를 띄우지 않는다");
    check((await page.getByText("쓰다듬어 보세요").count()) >= 1, "동작 줄이기 — 기존 SVG 동물(Animal3D)이 대신 그려진다");
    check(glbs.length === 0, "동작 줄이기 — 3D 모델을 받지 않는다", glbs.join(","));
    await reduced.close();
  }
  {
    // WebGL을 못 쓰는 환경 — 크로미움에서 3D API를 끈다
    const noGl = await chromium.launch({ executablePath: findChromium(), args: ["--disable-3d-apis", "--disable-gpu", "--disable-webgl", "--disable-webgl2"] });
    const ctx = await noGl.newContext(ctxOpts);
    const page = await ctx.newPage();
    await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204, body: "" }));
    const glbs = [];
    page.on("request", (r) => r.url().endsWith(".glb") && glbs.push(r.url()));
    await page.goto(`${URL}/preview/garden?state=fed&type=cat`, { waitUntil: "networkidle", timeout: 120_000 });
    await page.getByTestId("preview-affection").waitFor({ state: "visible", timeout: 60_000 });
    await page.waitForTimeout(1500);
    const webgl = await page.evaluate(() => {
      const c = document.createElement("canvas");
      return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
    });
    check(webgl === false, "(시험 환경) WebGL을 껐다");
    check((await page.getByTestId("pet-stage").count()) === 0 && (await page.getByText("쓰다듬어 보세요").count()) >= 1, "WebGL 불가 — 기존 SVG 동물이 대신 그려진다");
    check(glbs.length === 0, "WebGL 불가 — 3D 모델을 받지 않는다", glbs.join(","));
    await noGl.close();
  }
  {
    const { page } = await open("/preview/garden?state=fed&type=cat&fallback=1", { ready: false });
    check((await page.getByText("쓰다듬어 보세요").count()) >= 1 && (await page.locator("canvas").count()) === 0, "fallback=1 — 폴백 동물만 그려지고 3D는 없다");
    await page.context().close();
  }

  /* ── 데스크톱 폭 ───────────────────────────────────────── */
  {
    const wide = await browser.newContext({ ...ctxOpts, viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    const { page, errors } = await open("/preview/garden?state=fed&type=cat", { context: wide });
    const box = await page.getByTestId("pet-stage").boundingBox();
    check(box.width <= 481 && Math.abs(box.height / box.width - 418 / 360) < 0.02, "데스크톱 — 방이 480px 안쪽에서 비율을 지킨다", `${Math.round(box.width)}×${Math.round(box.height)}`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "데스크톱 · 가로 넘침 없음");
    await page.screenshot({ path: join(OUT_DIR, "W-desktop.png") });
    check(errors.length === 0, "데스크톱 · 콘솔 에러 0", errors.join(" | ").slice(0, 240));
    await wide.close();
  }
} catch (err) {
  check(false, "검증 중 예외", String(err).split("\n").slice(0, 2).join(" | "));
} finally {
  await browser.close();
  stopServer();
}

console.log(`\n스크린샷: ${OUT_DIR}`);
if (failures.length) {
  console.error(`\n웹 동물 검증 실패 ${failures.length}건: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\n웹 동물 검증을 통과했습니다.");
