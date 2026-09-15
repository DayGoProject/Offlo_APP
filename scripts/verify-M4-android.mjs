/**
 * M4 검증 ② — 하단 탭 · 대시보드 · 기록 실데이터 (안드로이드 dev build + adb)
 *
 *   emulator -avd Medium_Phone
 *   (앱에서 Google로 로그인해 둔 상태)
 *   node scripts/verify-M4-android.mjs
 *
 * M4 완료 조건: "5개 탭 전환 + 대시보드(지표 · 주간 막대 · 목표 · 정원)와 기록 추이가 실기기에서 렌더된다 · 콘솔 에러 0"
 * 레이아웃 · 빈/로딩/에러 상태 모양은 층 ①(verify-M4-web.mjs)이 샘플 값으로 본다. 여기서는 실데이터와 네이티브 탭 전환을 본다.
 *
 * 확인 항목
 *   0. 공유 코드 드리프트 (매 검증의 첫 줄)
 *   1. 하단 탭 5개가 보인다
 *   2. 홈 — 지표 카드 4개 · 이번 주 스크린타임 · 진행 중인 목표가 서버 데이터로 뜬다
 *   3. 탭 전환 — 분석 · 정원 · 커뮤니티 · 더보기 (각 화면 글자로 확인)
 *   4. 더보기 → 분석 기록 → 뒤로
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

const TABS = ["홈", "분석", "정원", "커뮤니티", "더보기"];
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
  adb(["logcat", "-c"]);
  adb(["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", DEV_CLIENT_URL, "-p", PACKAGE]);
  for (let i = 0; i < 60; i++) {
    await wait(3000);
    if ((adb(["logcat", "-d", "-s", "ReactNativeJS"]).stdout ?? "").includes('Running "main"')) {
      await wait(2000);
      await dismissDevMenu();
      return true;
    }
  }
  return false;
}

const shot = (name) => {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, name), adb(["exec-out", "screencap", "-p"], { encoding: "buffer" }).stdout);
};

async function openTab(label, expectTexts, screenshot) {
  const tapped = tapText(dumpUi(), label);
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
  check(tabs.ok, "하단 탭 5개", tabs.ok ? TABS.join(" · ") : `안 보임: ${tabs.missing?.join(", ")}`);

  /* ── 2. 홈 — 서버 데이터 ─────────────────────────────────── */
  const stats = await waitForAll(["오늘 스크린타임", "디톡스 점수", "연속 기록", "누적 디톡스"], 20_000);
  check(stats.ok, "홈 — 지표 카드 4개");
  // 주간 카드 우측은 불러오기에 성공해야만 "일 평균 …" 또는 "기록 없음"이 된다 (로딩 중엔 "—")
  const ready = await (async () => {
    const until = Date.now() + 40_000;
    while (Date.now() < until) {
      const xml = dumpUi();
      if (xml.includes("인터넷에 연결되어 있지 않거나")) return "offline";
      if (xml.includes("일 평균") || xml.includes("기록 없음")) return "ready";
      await wait(1500);
    }
    return "timeout";
  })();
  check(ready === "ready", "홈 — 이번 주 스크린타임을 서버에서 불러옴", ready);
  check((await waitForAll(["이번 주 스크린타임", "진행 중인 목표"], 10_000)).ok, "홈 — 주간 · 목표 카드");
  shot("M4-android-home.png");

  /* ── 3. 탭 전환 ──────────────────────────────────────────── */
  await openTab("분석", ["AI 분석", "M5에서 열려요"], "M4-android-analysis.png");
  await openTab("정원", ["반려 정원", "M6에서 열려요"], "M4-android-garden.png");
  await openTab("커뮤니티", ["M7에서 열려요"], "M4-android-community.png");
  await openTab("더보기", ["내 계정", "분석 기록", "로그아웃"], "M4-android-more.png");
  check((await waitForAll(["플랜"], 20_000)).ok, "더보기 — 서버의 내 계정 정보");

  /* ── 4. 분석 기록 ────────────────────────────────────────── */
  const openedHistory = tapText(dumpUi(), "분석 기록");
  const history = openedHistory ? await waitForAll(["디톡스 점수 추이"], 20_000) : { ok: false };
  check(openedHistory && history.ok, "더보기 → 분석 기록");
  await wait(2500); // 목록을 받아올 시간
  shot("M4-android-history.png");
  adb(["shell", "input", "keyevent", "KEYCODE_BACK"]);
  check((await waitForAll(["내 계정"], 10_000)).ok, "뒤로 → 더보기");
  await openTab("홈", ["이번 주 스크린타임"], "M4-android-home-again.png");

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
