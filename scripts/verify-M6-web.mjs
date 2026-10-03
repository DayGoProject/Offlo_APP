/**
 * M6 검증 ① — 정원 미리보기 화면 + Playwright (에이전트 자동 실행용)
 *
 *   node scripts/verify-M6-web.mjs
 *
 * 웹 미리보기는 CORS 때문에 실제 API를 부를 수 없고 Playwright는 Google 로그인을 못 넘는다.
 * 그래서 가드 밖 `/preview/garden`에 **실제 화면과 같은 컴포넌트**를 샘플 값으로 띄워 점검한다.
 * 실데이터 · 동물 저장 · 탭 갱신은 ② 안드로이드(verify-M6-android.mjs).
 *
 * 샘플 기준 시각은 KST 2026-09-17(목) 10:00이고, 브라우저 시간대를 Asia/Seoul로 고정한다.
 *
 * 확인 항목 (동물 상태 6종 × 저장 실패 · 로딩 · 실패)
 *   - 상태별 헤드라인 · 한 줄 안내 · 상태 칩 · 밥 주기 버튼 (배부름은 버튼이 없다)
 *   - 굶주림 문구가 서버 동작(연속 기록 1일부터)을 사실대로 말하는가
 *   - 동물 6단계 · 식물 7단계 목록 · 현재 단계 강조 · 진행 바 숫자
 *   - 동물 변경 — 선택 화면 → 경고 모달(연속 기록 초기화 안내) → 취소 / 확인
 *   - 장면(6-2) — 방 · 동물 · 식물이 그려지는가 · 상태별 말풍선 대사 · 굶주리면 방이 가라앉는가
 *   - **3D 동물(6-2b)** — 투명 캔버스 1개가 뜨고(`pet-3d-ready`) SVG 폴백은 빠진다 · 동물을 누르면 하트가 올라온다 · 출출함 → 배부름으로 바뀌면 먹는 연출이 돈다
 *     · 시스템 "동작 줄이기"에서는 SVG 폴백이 대신 그려진다
 *   - **효과음** — 누르면 종 · 상태에 맞는 소리 파일이 불린다(재생 호출을 가로채 확인 — 귀로 듣지는 못한다) · 먹는 연출에서 eat.wav · 소리 끄기 · 선택 저장
 *   - **살아 있는가** — 동물이 움직이는 프레임이 실제로 달라지는가(정지 화면 금지) · 정지 모드 · 시스템 "동작 줄이기"에서는 멈추는가
 *   - 식물 썸네일(AVIF) 로드 · 숫자는 Familjen Grotesk · 바탕 #040508
 *   - 빈 상태(미선택) · 스켈레톤 · 한국어 에러 + 다시 시도 · 가로 넘침 없음 · 콘솔 에러 0
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

import { pathToFileURL } from "node:url";
import { Buffer } from "node:buffer";

import { chromium } from "playwright-core";
import { PNG } from "pngjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, ".verify");
const URL = process.env.OFFLO_WEB_URL ?? "http://localhost:8081";
const BG = "rgb(4, 5, 8)";
const BRAND = "rgb(61, 219, 135)";
const TEXT_FAINT = "rgba(216, 216, 216, 0.34)";
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
// 효과음 — 소리는 들을 수 없으니 재생 호출(HTMLMediaElement.play)을 가로채 어떤 파일이 불렸는지 본다
await context.addInitScript(() => {
  window.__plays = [];
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...a) {
    window.__plays.push(String(this.currentSrc || this.src));
    return play.apply(this, a);
  };
});
const playedFiles = (page) => page.evaluate(() => window.__plays.map((s) => s.split("/").pop()));

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
  await scrollTo("top");
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT_DIR, `M6-${name}-top.png`) });
  await scrollTo("bottom");
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT_DIR, `M6-${name}-bottom.png`) });
}

const chipDot = (page) => style(page, '[data-testid="pet-condition-chip"] > div', "backgroundColor");

/** 3D 동물이 준비될 때까지 기다린다 — 모델을 불러와 첫 프레임을 그리면 `pet-3d-ready` 표식이 붙는다 */
const waitFor3d = (page) =>
  page
    .getByTestId("pet-3d-ready")
    .waitFor({ state: "attached", timeout: 30_000 })
    .then(() => true)
    .catch(() => false);

/** 쓰다듬기 하트(#FF6F8E 계열 · 초록이 낮은 분홍)의 픽셀 수 — 고양이 귀 안쪽(#FF9FB2) · 볼터치 · 주황 털과 가른다 */
const heartPixels = (png) => {
  const img = PNG.sync.read(png);
  let n = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    const [r, g, b] = [img.data[i], img.data[i + 1], img.data[i + 2]];
    if (r > 225 && g > 70 && g < 140 && b > 100 && b < 190 && r - g > 110) n++;
  }
  return n;
};

/** 두 스크린샷에서 눈에 띄게 달라진 픽셀 수 */
const changedPixels = (a, b) => {
  const [pa, pb] = [PNG.sync.read(a), PNG.sync.read(b)];
  let n = 0;
  for (let i = 0; i < pa.data.length; i += 4) {
    if (Math.abs(pa.data[i] - pb.data[i]) + Math.abs(pa.data[i + 1] - pb.data[i + 1]) + Math.abs(pa.data[i + 2] - pb.data[i + 2]) > 24) n++;
  }
  return n;
};

/** 식물 썸네일 7장이 실제로 로드됐는가 */
async function thumbsLoaded(page) {
  return page
    .waitForFunction(
      () => {
        const imgs = [...document.querySelectorAll('[data-testid^="plant-level-"] img')];
        return imgs.length === 7 && imgs.every((img) => img.complete && img.naturalWidth > 0);
      },
      null,
      { timeout: 15_000 },
    )
    .then(() => true)
    .catch(() => false);
}

try {
  /* ── 미리보기 목록 ─────────────────────────────────────── */
  {
    const { page, errors } = await open("/preview", "preview-index");
    const links = await page.locator('a[href*="/preview/garden"]').count();
    check(links === 9, "미리보기 목록 — 정원 × 9개 상태", `${links}개`);
    check(errors.length === 0, "미리보기 목록 · 콘솔 에러 0", errors.join(" | ").slice(0, 200));
    await page.close();
  }

  /* ── 배부름 (오늘 분석함) ──────────────────────────────── */
  {
    const { page, errors } = await open("/preview/garden?state=fed", "garden");
    const body = await page.locator("body").innerText();
    check(body.includes("오늘 밥을 배부르게 먹었어요"), "배부름 — 헤드라인");
    check(body.includes("고양이 · 성장 중"), "눈썹 — 고양이 · 성장 중 (12일)");
    check((await text(page, "pet-condition-sub")).includes("12일째 함께하고 있어요"), "배부름 — 연속 일수 안내");
    check((await text(page, "pet-condition-chip")) === "배부름", "상태 칩 — 배부름");
    check((await chipDot(page)) === BRAND, "배부름 — 칩 점이 브랜드 그린", await chipDot(page));
    check((await page.getByTestId("garden-feed").count()) === 0, "배부름 — 밥 주기 버튼 없음");
    check(await page.getByTestId("animal-change").isVisible(), "동물 변경하기 버튼");

    // 동물 성장
    check((await page.locator('[data-testid^="stage-row-"]').count()) === 6, "동물 단계 6줄");
    check((await style(page, '[data-testid="stage-row-growing"]', "backgroundColor")) === ACCENT_SOFT, "현재 단계(성장 중)만 강조");
    check((await style(page, '[data-testid="stage-row-adult"]', "backgroundColor")) !== ACCENT_SOFT, "다른 단계는 강조 없음");
    check(body.includes("3 / 6"), "동물 단계 3 / 6");
    const animalProgress = await text(page, "animal-progress");
    check(animalProgress.includes("12 / 21일") && animalProgress.includes("성체까지 9일 남았어요"), "동물 진행 — 12 / 21일 · 성체까지 9일", animalProgress.replace(/\n/g, " "));

    // 식물 성장
    check((await page.locator('[data-testid^="plant-level-"]').count()) === 7, "식물 단계 7칸");
    check((await style(page, '[data-testid="plant-level-4"]', "backgroundColor")) === ACCENT_SOFT, "현재 단계(Lv.4 꽃봉오리)만 강조");
    check(body.includes("4 / 7"), "식물 단계 4 / 7");
    const plantProgress = await text(page, "plant-progress");
    check(plantProgress.includes("1,450 / 2,400분") && plantProgress.includes("활짝 꽃까지 950분 남았어요"), "식물 진행 — 1,450 / 2,400분 · 950분 남음", plantProgress.replace(/\n/g, " "));
    check(await thumbsLoaded(page), "식물 썸네일(AVIF) 7장 로드");

    const numFont = await page.getByText("12 / 21").first().evaluate((el) => getComputedStyle(el).fontFamily);
    check(numFont.includes("FamiljenGrotesk"), "진행 숫자는 Familjen Grotesk", numFont);
    const titleFont = await page.getByText("오늘 밥을 배부르게 먹었어요").first().evaluate((el) => getComputedStyle(el).fontFamily);
    check(titleFont.includes("Pretendard-Regular"), "헤드라인은 Pretendard 400 (굵게 하지 않는다)", titleFont);

    await commonChecks("정원(배부름)", page, errors, "garden");
    await shots(page, "fed", "garden");
    await page.close();
  }

  /* ── 출출함 (어제까지 이어짐) ──────────────────────────── */
  {
    const { page, errors } = await open("/preview/garden?state=peckish", "garden");
    const body = await page.locator("body").innerText();
    check(body.includes("슬슬 밥 먹을 시간이에요"), "출출함 — 헤드라인");
    check(body.includes("강아지 · 성장 중"), "눈썹 — 강아지 · 성장 중 (8일)");
    check((await text(page, "pet-condition-sub")).includes("연속 기록이 9일로 이어져요"), "출출함 — 오늘 주면 9일로 이어짐");
    check((await text(page, "pet-condition-chip")) === "출출함", "상태 칩 — 출출함");
    check((await chipDot(page)) === TEXT_FAINT, "출출함 — 칩 점은 브랜드 그린이 아님", await chipDot(page));
    check((await text(page, "garden-feed")).includes("밥 주기"), "밥 주기 버튼이 보임");
    await commonChecks("정원(출출함)", page, errors, "garden");
    await shots(page, "peckish", "garden");
    await page.close();
  }

  /* ── 굶주림 (연속 기록이 끊김) ─────────────────────────── */
  {
    const { page, errors } = await open("/preview/garden?state=starving", "garden");
    const body = await page.locator("body").innerText();
    check(body.includes("굶어서 힘이 없어요"), "굶주림 — 헤드라인");
    check(body.includes("토끼 · 성체"), "눈썹 — 토끼 · 성체 (서버 값 30일 그대로)");
    const sub = await text(page, "pet-condition-sub");
    check(sub.includes("1일부터 다시 시작해요"), "굶주림 — 밥을 줘도 1일부터 다시 (서버 동작을 사실대로)", sub);
    check((await text(page, "pet-condition-chip")) === "굶주림", "상태 칩 — 굶주림");
    check(await page.getByTestId("garden-feed").isVisible(), "굶주림 — 밥 주기 버튼");
    check((await text(page, "animal-progress")).includes("30 / 60일"), "동물 진행 — 30 / 60일");
    await commonChecks("정원(굶주림)", page, errors, "garden");
    await shots(page, "starving", "garden");
    await page.close();
  }

  /* ── 알 (분석 기록 없음) ───────────────────────────────── */
  {
    const { page, errors } = await open("/preview/garden?state=egg", "garden");
    const body = await page.locator("body").innerText();
    check(body.includes("알이 부화를 기다리고 있어요"), "알 — 헤드라인");
    check(body.includes("고양이 · 알"), "눈썹 — 고양이 · 알");
    check((await text(page, "pet-condition-chip")) === "알", "상태 칩 — 알");
    check((await text(page, "garden-feed")).includes("첫 분석으로 부화시키기"), "알 — 첫 분석 유도 버튼");
    check((await text(page, "animal-progress")).includes("0 / 1일"), "동물 진행 — 0 / 1일 (아기까지)");
    check((await text(page, "plant-progress")).includes("60 / 120분"), "식물 진행 — 60 / 120분");
    await commonChecks("정원(알)", page, errors, "garden");
    await shots(page, "egg", "garden");
    await page.close();
  }

  /* ── 동물 미선택 ───────────────────────────────────────── */
  {
    const { page, errors } = await open("/preview/garden?state=none", "garden");
    const body = await page.locator("body").innerText();
    check(body.includes("함께할 동물을 골라 주세요"), "미선택 — 헤드라인");
    check(await page.getByTestId("animal-picker").isVisible(), "미선택 — 동물 선택 카드");
    const options = await page.locator('[data-testid^="animal-option-"]').count();
    check(options === 3, "미선택 — 고양이 · 강아지 · 토끼 3개", `${options}개`);
    check((await page.getByTestId("pet-stage").count()) === 0, "미선택 — 무대를 그리지 않음");
    check((await page.getByTestId("animal-growth").count()) === 0, "미선택 — 동물 성장 카드 없음");
    check(await page.getByTestId("plant-growth").isVisible(), "미선택이어도 식물은 자란다");
    check((await text(page, "plant-progress")).includes("0 / 120분"), "식물 0 / 120분");
    await commonChecks("정원(미선택)", page, errors, "garden");
    await shots(page, "none", "garden");
    await page.close();
  }

  /* ── 마지막 단계 ───────────────────────────────────────── */
  {
    const { page, errors } = await open("/preview/garden?state=legend", "garden");
    const body = await page.locator("body").innerText();
    check(body.includes("6 / 6") && body.includes("7 / 7"), "동물 6 / 6 · 식물 7 / 7");
    check((await style(page, '[data-testid="stage-row-legend"]', "backgroundColor")) === ACCENT_SOFT, "전설 단계 강조");
    const a = await text(page, "animal-progress");
    check(a.includes("130일") && a.includes("마지막 단계에 도달했어요"), "동물 — 마지막 단계 문구", a.replace(/\n/g, " "));
    const p = await text(page, "plant-progress");
    check(p.includes("10,200분") && p.includes("마지막 단계까지 키웠어요"), "식물 — 마지막 단계 문구", p.replace(/\n/g, " "));
    await commonChecks("정원(마지막 단계)", page, errors, "garden");
    await page.close();
  }

  /* ── 동물 변경 흐름 ────────────────────────────────────── */
  {
    const { page, errors } = await open("/preview/garden?state=fed", "garden");
    await page.getByTestId("animal-change").click();
    await page.getByTestId("animal-picker").waitFor({ state: "visible" });
    check((await page.getByTestId("pet-stage").count()) === 0, "변경 — 선택 화면이 무대를 대신함");
    check(
      (await page.getByTestId("animal-option-cat").getAttribute("aria-disabled")) === "true",
      "변경 — 지금 함께하는 고양이는 다시 고를 수 없음",
    );
    check((await text(page, "animal-option-cat")).includes("지금 함께하고 있어요"), "변경 — 현재 동물 표시");
    check(await page.getByTestId("animal-picker-cancel").isVisible(), "변경 — 취소 버튼");

    await page.getByTestId("animal-option-dog").click();
    await page.getByTestId("change-modal").waitFor({ state: "visible" });
    const modal = await text(page, "change-modal");
    check(modal.includes("동물을 변경하시겠어요?"), "경고 모달 — 제목");
    check(modal.includes("지금까지 쌓은 연속 기록이 모두 초기화됩니다"), "경고 모달 — 초기화 안내");
    check(modal.includes("12일 연속") && modal.includes("0일 연속"), "경고 모달 — 12일 → 0일 비교");
    check(modal.includes("연속 기록 12일과 현재 단계 성장 중") && modal.includes("되돌릴 수 없어요"), "경고 모달 — 사라지는 것과 되돌릴 수 없음");
    // testID는 버튼 상자에 붙고 글자 색은 안쪽 텍스트에 있다
    const confirmLabel = await page.getByTestId("change-confirm").getByText("변경하기").evaluate((el) => getComputedStyle(el).color);
    const confirmBg = await page.getByTestId("change-confirm").evaluate((el) => getComputedStyle(el).backgroundColor);
    check(confirmLabel === "rgb(255, 86, 86)" && confirmBg === "rgba(255, 86, 86, 0.1)", "변경하기는 danger 알약", `${confirmLabel} · ${confirmBg}`);
    // 모달은 페이드 인 — 끝난 뒤 찍어야 카드가 불투명하게 보인다
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(OUT_DIR, "M6-garden-change-modal.png") });

    await page.getByTestId("change-cancel").click();
    await page.getByTestId("change-modal").waitFor({ state: "hidden" });
    check(await page.getByTestId("animal-picker").isVisible(), "모달 취소 — 선택 화면으로 돌아옴");

    await page.getByTestId("animal-option-rabbit").click();
    await page.getByTestId("change-modal").waitFor({ state: "visible" });
    await page.getByTestId("change-confirm").click();
    await page.getByTestId("change-modal").waitFor({ state: "hidden" });
    await page.getByTestId("pet-stage").waitFor({ state: "visible" });
    check(true, "변경 확인 — 저장 성공 후 모달이 닫히고 무대로 돌아옴");

    await page.getByTestId("animal-change").click();
    await page.getByTestId("animal-picker-cancel").click();
    await page.getByTestId("pet-stage").waitFor({ state: "visible" });
    check(true, "선택 화면 취소 — 무대로 돌아옴");
    await commonChecks("정원(변경 흐름)", page, errors, "garden");
    await page.close();
  }


  /* ── 장면 (6-2) — 방 · 동물 · 말풍선 · 살아 있음 ────────── */
  {
    const scene = await import(pathToFileURL(join(ROOT, "src", "logic", "scene.ts")).href);
    const cases = [
      { state: "fed", cond: "fed", type: "cat", sound: "cat_happy.wav" },
      { state: "peckish", cond: "peckish", type: "dog", sound: "dog_happy.wav" },
      { state: "starving", cond: "starving", type: "rabbit", sound: "rabbit_sad.wav" }, // 굶주리면 쓰다듬어도 시무룩한 소리
      { state: "egg", cond: "egg", type: "cat", sound: "egg_knock.wav" },
    ];
    /** 동물이 있는 영역만 잘라 찍는다 — 말풍선(위쪽) · 식물(왼쪽, 이미지가 늦게 뜬다)이 끼어들지 않게 */
    const petClip = async (page) => {
      const box = await page.getByTestId("pet-stage").boundingBox();
      return { x: box.x + box.width * 0.38, y: box.y + box.height * 0.44, width: box.width * 0.5, height: box.height * 0.5 };
    };

    for (const { state, cond, type, sound } of cases) {
      const { page, errors } = await open(`/preview/garden?state=${state}`, "garden");
      const stage = page.getByTestId("pet-stage");
      await stage.waitFor({ state: "visible" });
      check(await waitFor3d(page), `장면(${state}) · 3D 동물이 그려짐 (pet-3d-ready)`);
      await page.waitForTimeout(700); // 페이드 인이 끝나도록

      const box = await stage.boundingBox();
      check(Math.abs(box.height / box.width - 418 / 360) < 0.02, `장면(${state}) · 방 비율 360:418`, `${Math.round(box.width)}×${Math.round(box.height)}`);
      // 3D가 준비되면 SVG 동물 · 그릇은 빠지고(폴백) 방 그림(svg)만 남는다 — 3D 캔버스는 하나
      const layers = await stage.locator("svg").count();
      const canvases = await stage.locator("canvas").count();
      const fallback = await stage.locator('[data-testid="pet-svg-fallback"]').count();
      check(canvases === 1 && fallback === 0 && layers >= 3 && layers <= 8, `장면(${state}) · 방 + 3D 캔버스 1개 · SVG 폴백 없음`, `svg ${layers} · canvas ${canvases} · 폴백 ${fallback}`);
      check((await stage.locator('[data-testid="plant-image"]').count()) >= 1, `장면(${state}) · 식물이 방에 놓임`);

      // 말풍선 — 첫 대사가 1.5초 뒤에 나온다. 상태 · 동물에 맞는 대사여야 한다
      await page.getByTestId("pet-bubble").waitFor({ state: "visible", timeout: 8000 });
      const line = (await text(page, "pet-bubble")).trim();
      const pool = scene.speechLines(cond, type);
      check(pool.includes(line), `장면(${state}) · 말풍선 대사가 ${type} · ${cond}에 맞음`, line);

      // 살아 있는가 — 같은 영역을 0.9초 간격으로 두 번 찍어 픽셀이 달라야 한다
      await page.waitForTimeout(3600); // 말풍선이 사라진 뒤
      const clip = await petClip(page);
      const a = await page.screenshot({ clip });
      await page.waitForTimeout(900);
      const b = await page.screenshot({ clip });
      check(!Buffer.from(a).equals(Buffer.from(b)), `장면(${state}) · 동물이 움직인다 (정지 화면 아님)`);

      await page.screenshot({ path: join(OUT_DIR, `M6-scene-${state}.png`) });

      // 쓰다듬기 — 동물을 누르면 하트가 올라온다 (안 누르면 하트 픽셀이 거의 없다)
      const before = heartPixels(Buffer.from(await page.screenshot({ clip })));
      await page.getByTestId("pet-touch").click();
      await page.waitForTimeout(700);
      const after = heartPixels(Buffer.from(await page.screenshot({ clip })));
      check(after > before + 40, `장면(${state}) · 동물을 누르면 하트가 올라온다`, `하트 픽셀 ${before} → ${after}`);
      const played = await playedFiles(page);
      check(played.length === 1 && played[0] === sound, `장면(${state}) · 누르면 ${sound} 효과음이 난다`, played.join(" · ") || "재생 없음");
      await page.screenshot({ path: join(OUT_DIR, `M6-scene-${state}-pet.png`) });

      check(errors.length === 0, `장면(${state}) · 콘솔 에러 0`, errors.join(" | ").slice(0, 240));
      await page.close();
    }

    // 정지 모드 (스크린샷 비교용) — 움직임 · 말풍선 없음, 프레임이 같다
    {
      const { page } = await open("/preview/garden?state=fed&still=1", "garden");
      await page.getByTestId("pet-stage").waitFor({ state: "visible" });
      check(await waitFor3d(page), "정지 모드 · 3D 동물이 그려짐");
      await page.waitForTimeout(900);
      const clip = await petClip(page);
      const a = await page.screenshot({ clip });
      await page.waitForTimeout(900);
      const b = await page.screenshot({ clip });
      check(Buffer.from(a).equals(Buffer.from(b)), "정지 모드 · 두 프레임이 같다");
      check((await page.getByTestId("pet-bubble").count()) === 0, "정지 모드 · 말풍선 없음");
      check((await page.getByTestId("pet-touch").count()) === 0, "정지 모드 · 쓰다듬기 표면 없음");
      await page.close();
    }

    // 시스템 "동작 줄이기" — 동물이 멈춘다 (접근성)
    {
      const reduced = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        colorScheme: "dark",
        reducedMotion: "reduce",
        timezoneId: "Asia/Seoul",
        locale: "ko-KR",
      });
      const page = await reduced.newPage();
      await page.goto(`${URL}/preview/garden?state=fed`, { waitUntil: "networkidle", timeout: 120_000 });
      await page.getByTestId("pet-stage").waitFor({ state: "visible", timeout: 60_000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);
      const clip = await petClip(page);
      const a = await page.screenshot({ clip });
      await page.waitForTimeout(900);
      const b = await page.screenshot({ clip });
      check(Buffer.from(a).equals(Buffer.from(b)), "동작 줄이기 · 동물이 멈춘다");
      // 3D 대신 SVG 리그가 그려진다 (폴백) — 캔버스를 띄우지 않는다
      check((await page.getByTestId("pet-stage").locator("canvas").count()) === 0, "동작 줄이기 · 3D 캔버스를 띄우지 않는다");
      check((await page.getByTestId("pet-svg-fallback").count()) === 1, "동작 줄이기 · SVG 폴백이 동물을 그린다");
      await reduced.close();
    }

    // 밥을 먹으면(출출함 → 배부름) 먹는 연출이 돈다 — `then=fed`는 4.5초 뒤 같은 동물이 분석을 마친 상태로 바뀐다.
    // 서 있던 동물이 고개를 그릇에 넣는 자세로 바뀌므로 동물 영역 픽셀이 크게 달라져야 하고(가만히 서 있을 때의 숨쉬기 · 깜빡임은 수천 px 이하), 끝나면 그릇에 밥이 남는다
    {
      const { page, errors } = await open("/preview/garden?state=peckish&then=fed", "garden");
      await page.getByTestId("pet-stage").waitFor({ state: "visible" });
      check(await waitFor3d(page), "먹는 연출 · 3D 동물이 그려짐");
      await page.waitForTimeout(700);
      const box = await page.getByTestId("pet-stage").boundingBox();
      const wide = { x: box.x, y: box.y + box.height * 0.3, width: box.width, height: box.height * 0.7 };
      check((await text(page, "pet-condition-chip")) === "출출함", "먹는 연출 · 전환 전에는 출출함");
      const hungry = await page.screenshot({ clip: wide });
      await page.getByTestId("pet-condition-chip").filter({ hasText: "배부름" }).waitFor({ timeout: 15_000 });
      await page.waitForTimeout(1200);
      const eating = await page.screenshot({ clip: wide });
      const moved = changedPixels(hungry, eating);
      check(moved > 30_000, "먹는 연출 · 배부름으로 바뀌면 동물이 그릇으로 고개를 숙인다", `달라진 픽셀 ${moved}`);
      await page.screenshot({ path: join(OUT_DIR, "M6-scene-eating.png") });
      await page.waitForTimeout(3000); // 연출(3.6초)이 끝난 뒤
      const done = await page.screenshot({ clip: wide });
      check(changedPixels(eating, done) > 30_000, "먹는 연출 · 끝나면 다시 고개를 든다", `달라진 픽셀 ${changedPixels(eating, done)}`);
      const eatSounds = (await playedFiles(page)).filter((f) => f === "eat.wav");
      check(eatSounds.length === 1, "먹는 연출 · 먹는 소리(eat.wav)가 한 번 난다", `${eatSounds.length}번`);
      check(errors.length === 0, "먹는 연출 · 콘솔 에러 0", errors.join(" | ").slice(0, 240));
      await page.close();
    }

    // 소리 끄기 — 스피커 버튼을 누르면 효과음이 나지 않고 선택이 기기에 남는다 (확인 뒤 다시 켠다 — 같은 브라우저 문맥이라 다음 화면에 새지 않게)
    {
      const { page, errors } = await open("/preview/garden?state=fed", "garden");
      check(await waitFor3d(page), "소리 끄기 · 3D 동물이 그려짐");
      await page.waitForTimeout(500);
      check(await page.getByTestId("pet-sound-toggle").isVisible(), "소리 끄기 · 스피커 버튼이 보임");
      await page.getByTestId("pet-sound-toggle").click();
      await page.getByTestId("pet-touch").click();
      await page.waitForTimeout(900);
      check((await playedFiles(page)).length === 0, "소리 끄기 · 끈 뒤 누르면 소리가 나지 않는다");
      check((await page.evaluate(() => localStorage.getItem("offlo:pet-sound"))) === "0", "소리 끄기 · 선택이 기기에 저장됨");
      await page.getByTestId("pet-sound-toggle").click(); // 다시 켠다
      await page.getByTestId("pet-touch").click();
      await page.waitForTimeout(900);
      check((await playedFiles(page)).length === 1, "소리 끄기 · 다시 켜면 소리가 난다");
      check((await page.evaluate(() => localStorage.getItem("offlo:pet-sound"))) === "1", "소리 끄기 · 켠 선택도 저장됨");
      check(errors.length === 0, "소리 끄기 · 콘솔 에러 0", errors.join(" | ").slice(0, 240));
      await page.close();
    }

    // 굶주리면 방이 서늘하게 가라앉는다 — 오버레이가 켜지고, 배부르면 꺼져 있다
    {
      const overlayOpacity = async (state) => {
        const { page } = await open(`/preview/garden?state=${state}&still=1`, "garden");
        await page.getByTestId("pet-stage").waitFor({ state: "visible" });
        await waitFor3d(page);
        await page.waitForTimeout(1200);
        const v = await page.evaluate(() => {
          const rect = document.querySelector('[data-testid="pet-stage"] rect[fill="rgba(10, 18, 44, 0.34)"]');
          const wrapper = rect?.closest("svg")?.parentElement;
          return wrapper ? Number(getComputedStyle(wrapper).opacity) : null;
        });
        await page.close();
        return v;
      };
      const starving = await overlayOpacity("starving");
      const fed = await overlayOpacity("fed");
      check(starving === 1 && fed === 0, "굶주림 — 방이 어두워지고 배부르면 그대로", `굶주림 ${starving} · 배부름 ${fed}`);
    }
  }

  /* ── 저장 실패 · 로딩 · 불러오기 실패 ──────────────────── */
  {
    const saveError = await open("/preview/garden?state=save-error", "garden");
    check((await text(saveError.page, "garden-action-error")).includes(OFFLINE_TEXT), "저장 실패 — 한국어 네트워크 안내");
    check(await saveError.page.getByTestId("pet-stage").isVisible(), "저장 실패 — 화면은 그대로 남음");
    await commonChecks("정원(저장 실패)", saveError.page, saveError.errors, "garden");
    await saveError.page.close();

    const loading = await open("/preview/garden?state=loading", "garden");
    check(await loading.page.getByTestId("garden-skeleton").isVisible(), "로딩 — 스켈레톤");
    check((await loading.page.getByTestId("pet-stage").count()) === 0, "로딩 — 빈 무대를 그리지 않음");
    await commonChecks("정원(로딩)", loading.page, loading.errors, "garden");
    await shots(loading.page, "loading", "garden");
    await loading.page.close();

    const failed = await open("/preview/garden?state=error", "garden");
    check((await text(failed.page, "garden-error")).includes(OFFLINE_TEXT), "실패 — 한국어 네트워크 안내");
    check(await failed.page.getByTestId("retry-button").isVisible(), "실패 — 다시 시도 버튼");
    check((await failed.page.getByTestId("animal-growth").count()) === 0, "실패 — 빈 성장 카드를 그리지 않음");
    await commonChecks("정원(실패)", failed.page, failed.errors, "garden");
    await shots(failed.page, "error", "garden");
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
  console.error(`\nM6 웹 검증 실패 ${failures.length}건: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nM6 웹 검증을 통과했습니다.");
