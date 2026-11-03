/**
 * M4 검증 ② — 하단 탭 · 대시보드 · 기록 실데이터 (안드로이드 dev build + adb)
 *
 *   emulator -avd Medium_Phone
 *   (앱에서 Google로 로그인해 둔 상태)
 *   node scripts/verify-M4-android.mjs
 *
 * M4 완료 조건: "탭 전환 + 홈 · 기록 추이가 실기기에서 렌더된다 · 콘솔 에러 0" (UIUX 실험 A안: 탭 4개 + 가운데 올리기 버튼 · 홈은 동물 방 · 더보기는 스택 화면)
 * 레이아웃 · 빈/로딩/에러 상태 모양은 층 ①(verify-M4-web.mjs)이 샘플 값으로 본다. 여기서는 실데이터와 네이티브 탭 전환을 본다.
 *
 * 확인 항목
 *   0. 공유 코드 드리프트 (매 검증의 첫 줄)
 *   1. 하단 탭 4개가 보인다
 *   2. 홈 — 동물 방 · 오늘 할 일 버튼 · 프로필 · 알림 종이 서버 데이터로 뜬다 · 가운데 올리기(+) 버튼
 *   3. 탭 전환 — 분석 · 정원 · 커뮤니티 (각 화면 글자로 확인)
 *   4. 더보기(딥링크) → 분석 기록 → 뒤로
 *   5. 앱 생존 · JS 에러 · 네이티브 크래시 0
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, ".verify");
const PORT = 8081;
const PACKAGE = "com.daygoproject.offlo";
const DEV_CLIENT_URL = `exp+offlo-app://expo-development-client/?url=${encodeURIComponent(`http://127.0.0.1:${PORT}`)}`;
const ADB = process.env.ANDROID_HOME
  ? join(process.env.ANDROID_HOME, "platform-tools", "adb")
  : join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk", "platform-tools", "adb.exe");

// UIUX 실험 A안 — 하단 탭 4개(+ 가운데 올리기 버튼). 더보기는 스택 화면(`offlo://more` · 각 탭 헤더의 프로필 버튼)
const TABS = ["홈", "분석", "정원", "커뮤니티"];
const TEXT_LOGIN = "Google로 계속하기";

const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};
const adb = (args, opts = {}) => spawnSync(ADB, args, { encoding: "utf8", ...opts });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function dumpUi() {
  adb(["shell", "uiautomator", "dump", "/sdcard/offlo-ui.xml"]);
  return adb(["exec-out", "cat", "/sdcard/offlo-ui.xml"]).stdout ?? "";
}

function tapText(xml, text) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = xml.match(new RegExp(`text="${escaped}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`));
  if (!m) return false;
  const [x1, y1, x2, y2] = m.slice(1).map(Number);
  adb(["shell", "input", "tap", String((x1 + x2) >> 1), String((y1 + y2) >> 1)]);
  return true;
}

const has = (xml, id) => xml.includes(`resource-id="${id}"`);
function tapId(xml, id) {
  const m = xml.match(new RegExp(String.raw`resource-id="${id}"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"`));
  if (!m) return false;
  const [x1, y1, x2, y2] = m.slice(1).map(Number);
  adb(["shell", "input", "tap", String((x1 + x2) >> 1), String((y1 + y2) >> 1)]);
  return true;
}
async function untilXml(test, timeoutMs) {
  const end = Date.now() + timeoutMs;
  let xml = "";
  while (Date.now() < end) {
    xml = dumpUi();
    if (test(xml)) return { ok: true, xml };
    await wait(1500);
  }
  return { ok: false, xml };
}

/** texts가 전부 화면에 보일 때까지 기다린다 */
async function waitForAll(texts, timeoutMs) {
  const until = Date.now() + timeoutMs;
  let xml = "";
  while (Date.now() < until) {
    xml = dumpUi();
    if (texts.every((t) => xml.includes(`text="${t}"`) || xml.includes(t))) return { ok: true, xml };
    await wait(1500);
  }
  return { ok: false, xml, missing: texts.filter((t) => !xml.includes(t)) };
}

async function dismissDevMenu() {
  let xml = dumpUi();
  if (xml.includes("This is the developer menu") && tapText(xml, "Continue")) {
    await wait(1500);
    xml = dumpUi();
  }
  if (xml.includes("Toggle element inspector")) {
    adb(["shell", "input", "keyevent", "KEYCODE_BACK"]);
    await wait(1500);
  }
}

async function launchApp() {
  adb(["shell", "am", "force-stop", PACKAGE]);
  await wait(1000);
  adb(["reverse", `tcp:${PORT}`, `tcp:${PORT}`]); // 길이 중간에 끊긴 적이 있다 — 앱을 다시 띄울 때마다 다시 잇는다 (같은 걸 또 이어도 무해)
  adb(["logcat", "-c"]);
  adb(["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", DEV_CLIENT_URL, "-p", PACKAGE]);
  for (let i = 0; i < 60; i++) {
    await wait(3000);
    if ((adb(["logcat", "-d", "-s", "ReactNativeJS"]).stdout ?? "").includes('Running "main"')) {
      await wait(2000);
      await dismissDevMenu();
      // 홈의 동물이 계속 움직이면 uiautomator 덤프가 실패한다 — 정지 모드 딥링크로 같은 홈을 다시 연다 (로그인 전이면 로그인 화면이 그대로 뜬다)
      adb(["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", "offlo://?still=1", "-p", PACKAGE]);
      await wait(2500);
      return true;
    }
  }
  return false;
}

const shot = (name) => {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, name), adb(["exec-out", "screencap", "-p"], { encoding: "buffer" }).stdout);
};

const TAB_IDS = { 홈: "tab-home", 분석: "tab-analysis", 정원: "tab-garden", 커뮤니티: "tab-community" };
async function openTab(label, expectTexts, screenshot) {
  const tapped = tapId(dumpUi(), TAB_IDS[label]);
  const shown = tapped ? await waitForAll(expectTexts, 20_000) : { ok: false, missing: expectTexts };
  check(tapped && shown.ok, `탭 전환 — ${label}`, shown.ok ? "" : `안 보임: ${shown.missing?.join(", ")}`);
  shot(screenshot);
}

/* ── 0. 공유 코드 드리프트 ─────────────────────────────────── */
if (spawnSync(process.execPath, [join(ROOT, "scripts", "sync-shared.mjs")], { stdio: "inherit" }).status !== 0) {
  console.error("\n공유 코드가 웹과 갈라져 있습니다. 먼저 맞추고 다시 실행하세요.");
  process.exit(1);
}

/* ── 기기 · 설치 · 개발 서버 ───────────────────────────────── */
const device = (adb(["devices"]).stdout ?? "").split("\n").find((l) => /\tdevice$/.test(l.trim()));
if (!device) {
  console.error("\n✗ 연결된 안드로이드 기기가 없습니다. emulator -avd Medium_Phone 으로 먼저 띄우세요.");
  process.exit(1);
}
if (!(adb(["shell", "pm", "list", "packages", PACKAGE]).stdout ?? "").includes(`package:${PACKAGE}`)) {
  console.error("\n✗ dev build가 없습니다. npm run android:build 로 먼저 설치하세요.");
  process.exit(1);
}
check(true, "기기 · dev build", device.split("\t")[0]);

const serverUp = async () => {
  try {
    return (await fetch(`http://localhost:${PORT}`, { signal: AbortSignal.timeout(3000) })).ok;
  } catch {
    return false;
  }
};
let devServer = null;
if (!(await serverUp())) {
  console.log("\n개발 서버를 띄웁니다 …");
  devServer = spawn("npx", ["expo", "start", "--dev-client", "--port", String(PORT)], {
    cwd: ROOT,
    env: { ...process.env, BROWSER: "none", EXPO_NO_TELEMETRY: "1" },
    stdio: "ignore",
    shell: true,
  });
  for (let i = 0; i < 90 && !(await serverUp()); i++) await wait(2000);
}
const stopServer = () => {
  if (!devServer) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(devServer.pid), "/T", "/F"], { stdio: "ignore" });
  else devServer.kill("SIGTERM");
};
adb(["reverse", `tcp:${PORT}`, `tcp:${PORT}`]);

try {
  check(await launchApp(), "번들 로드 (dev build)");

  /* ── 1. 하단 탭 ──────────────────────────────────────────── */
  const tabs = await waitForAll([...TABS], 30_000);
  if (!tabs.ok && tabs.xml.includes(TEXT_LOGIN)) {
    check(false, "로그인 상태", "먼저 앱에서 Google로 로그인한 뒤 다시 실행하세요");
    throw new Error("not signed in");
  }
  check(tabs.ok, "하단 탭 4개", tabs.ok ? TABS.join(" · ") : `안 보임: ${tabs.missing?.join(", ")}`);

  /* ── 2. 홈 — 서버 데이터 ─────────────────────────────────── */
  // UIUX 실험 A안: 홈은 지표 카드 대시보드가 아니라 동물 방 + 오늘 할 일 버튼 하나다 (옛 지표 · 주간 막대 · 목표 카드는 홈에서 빠졌다).
  // 서버 데이터(정원 · 분석 목록)가 들어오면 제목이 상태별 문구가 되고 CTA가 뜬다. 실패하면 home-error가 뜬다
  const homeReady = await untilXml((x) => has(x, "home-cta") || has(x, "home-error"), 40_000);
  check(homeReady.ok && has(homeReady.xml, "home-cta") && !has(homeReady.xml, "home-error"), "홈 — 동물 방 · 오늘 할 일 버튼이 서버 데이터로 뜬다", has(homeReady.xml, "home-error") ? "오류 안내가 떠 있다" : "");
  check(has(homeReady.xml, "home-title") && has(homeReady.xml, "home-profile") && has(homeReady.xml, "notification-bell"), "홈 — 제목 · 프로필 버튼 · 알림 종");
  check(has(homeReady.xml, "tab-upload"), "하단 탭바 가운데에 올리기(+) 버튼이 있다");
  shot("M4-android-home.png");

  /* ── 3. 탭 전환 ──────────────────────────────────────────── */
  // M5부터 분석 탭이 실제 화면이다 — A안에서는 큰 제목 "분석" · 둘러보기 타일 · 주간 종합 분석
  await openTab("분석", ["분석 기록", "주간 종합 분석"], "M4-android-analysis.png");
  // M6부터 정원 탭이 실제 화면이다 — 동물 상태는 계정마다 달라도 식물 성장 카드는 늘 있다.
  // 동물이 계속 움직이는 화면은 uiautomator가 읽지 못한다("could not get idle state") — 정지 모드 딥링크로 연다.
  // (탭 누름 자체는 다른 탭 전환이 이미 보여 준다. 움직임 검증은 verify-M6-android.mjs)
  adb(["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", "offlo://garden?still=1", "-p", PACKAGE]);
  // 화면에 보이는 요소만 dump에 나온다 — 스크롤 아래 식물 카드 대신 위쪽 헤드라인(상태별 5종 중 하나)으로 본다
  const gardenHeadlines = ["함께할 동물을 골라 주세요", "알이 부화를 기다리고 있어요", "오늘 밥을 배부르게 먹었어요", "슬슬 밥 먹을 시간이에요", "굶어서 힘이 없어요"];
  let gardenXml = "";
  const gardenUntil = Date.now() + 20_000;
  while (Date.now() < gardenUntil && !gardenHeadlines.some((t) => gardenXml.includes(t))) {
    await wait(1500);
    gardenXml = dumpUi();
  }
  check(gardenHeadlines.some((t) => gardenXml.includes(t)), "탭 전환 — 정원 (정지 모드)");
  shot("M4-android-garden.png");
  // M7부터 커뮤니티 탭이 실제 화면이다 (피드 · 주간 랭킹 전환 · 글쓰기)
  await openTab("커뮤니티", ["피드", "주간 랭킹"], "M4-android-community.png");

  /* ── 4. 더보기(스택 화면) → 분석 기록 → 뒤로 ─────────────── */
  // 더보기는 탭이 아니다 — 앱에서는 탭 헤더의 프로필 버튼으로 들어오지만, 개발 빌드는 우측 상단에 Expo "Tools" 떠 있는 버튼이 있어 그 자리 탭을 가로챈다(릴리스에는 없다).
  // 그래서 여기서는 같은 화면을 딥링크로 연다. 프로필 버튼의 존재는 위 탭 검사에서 `open-profile` 표식으로 본다
  check(has(dumpUi(), "open-profile"), "커뮤니티 탭 헤더에 프로필 버튼이 있다");
  adb(["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", "offlo://more", "-p", PACKAGE]);
  const more = await waitForAll(["내 계정", "분석 기록", "로그아웃"], 20_000);
  check(more.ok, "더보기(스택 화면)가 열린다", more.ok ? "" : `안 보임: ${more.missing?.join(", ")}`);
  shot("M4-android-more.png");
  check((await waitForAll(["플랜"], 20_000)).ok, "더보기 — 서버의 내 계정 정보");
  const openedHistory = tapText(dumpUi(), "분석 기록");
  const history = openedHistory ? await waitForAll(["디톡스 점수 추이"], 20_000) : { ok: false };
  check(openedHistory && history.ok, "더보기 → 분석 기록");
  await wait(2500); // 목록을 받아올 시간
  shot("M4-android-history.png");
  adb(["shell", "input", "keyevent", "KEYCODE_BACK"]);
  check((await waitForAll(["내 계정"], 10_000)).ok, "뒤로 → 더보기");
  adb(["shell", "input", "keyevent", "KEYCODE_BACK"]);
  check((await waitForAll(["피드", "주간 랭킹"], 10_000)).ok, "뒤로 → 커뮤니티 탭");
  // 홈은 동물이 움직여 덤프가 실패한다 — 정지 모드 딥링크로 열어 홈 화면 틀로 확인한다
  adb(["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", "offlo://?still=1", "-p", PACKAGE]);
  const homeAgain = await untilXml((x) => has(x, "home-cta"), 20_000);
  check(homeAgain.ok, "홈으로 돌아온다");
  shot("M4-android-home-again.png");

  /* ── 5. 생존 · 에러 ──────────────────────────────────────── */
  check(Boolean((adb(["shell", "pidof", PACKAGE]).stdout ?? "").trim()), "앱 프로세스 생존");
  const errors = (adb(["logcat", "-d", "-s", "AndroidRuntime:E", "ReactNativeJS:E"]).stdout ?? "")
    .split("\n")
    .filter((l) => /FATAL|\bE\b/.test(l));
  check(errors.length === 0, "크래시 · JS 에러 0", errors.slice(0, 2).join(" | ").slice(0, 200));
} catch (e) {
  if (String(e) !== "Error: not signed in") check(false, "검증 중 예외", String(e).split("\n")[0]);
} finally {
  stopServer();
}

if (failures.length) {
  console.error(`\nM4 안드로이드 검증 실패 ${failures.length}건: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nM4 안드로이드 검증을 통과했습니다.");
