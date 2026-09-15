/**
 * M2 검증 ② — 안드로이드 dev build + adb (M2부터 주 검증층)
 *
 *   emulator -avd Medium_Phone
 *   npx expo run:android --no-bundler              # dev build 설치 — 네이티브 의존성이 바뀔 때만
 *   node scripts/verify-M2-android.mjs             # 자동 항목
 *   node scripts/verify-M2-android.mjs --persist   # 사람이 Google로 로그인한 뒤 — 재시작 후 유지 확인
 *
 * Expo Go에서는 Google 로그인을 검증할 수 없다(앱 scheme 고정). 그래서 이 층은 dev build를 연다.
 *
 * 확인 항목
 *   0. 공유 코드 드리프트 (매 검증의 첫 줄)
 *   1. 기기 연결 · dev build 설치
 *   2. dev build가 개발 서버 번들을 로드한다 (`Running "main"`)
 *   3. JS 에러 · 네이티브 크래시 0
 *   4. 로그인 화면(비로그인) 또는 홈(로그인됨)이 뜬다 — UI 트리의 글자로 확인
 *   --persist: 강제 종료 → 다시 열어도 홈이 보인다 (AsyncStorage 퍼시스턴스)
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, ".verify");
const PORT = 8081;
const PACKAGE = "com.daygoproject.offlo";
// expo-dev-client가 등록하는 scheme — `exp+<slug>`
const DEV_CLIENT_URL = `exp+offlo-app://expo-development-client/?url=${encodeURIComponent(`http://127.0.0.1:${PORT}`)}`;
const PERSIST = process.argv.includes("--persist");
const ADB = process.env.ANDROID_HOME
  ? join(process.env.ANDROID_HOME, "platform-tools", "adb")
  : join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk", "platform-tools", "adb.exe");

const TEXT_LOGIN = "Google로 계속하기";
// 로그인했을 때만 보이는 하단 탭 이름 (M4부터 로그아웃은 더보기 탭 안에 있다)
const TEXT_HOME = "더보기";

const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};
const adb = (args, opts = {}) => spawnSync(ADB, args, { encoding: "utf8", ...opts });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** 화면에 보이는 UI 트리를 XML로 받는다 — RN <Text>의 글자가 text 속성에 들어 있다 */
function dumpUi() {
  adb(["shell", "uiautomator", "dump", "/sdcard/offlo-ui.xml"]);
  return adb(["exec-out", "cat", "/sdcard/offlo-ui.xml"]).stdout ?? "";
}

/** 글자가 보이는 노드의 가운데를 탭한다. 못 찾으면 false */
function tapText(xml, text) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = xml.match(new RegExp(`text="${escaped}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`));
  if (!m) return false;
  const [x1, y1, x2, y2] = m.slice(1).map(Number);
  adb(["shell", "input", "tap", String((x1 + x2) >> 1), String((y1 + y2) >> 1)]);
  return true;
}

/**
 * dev build를 새로 설치하고 처음 열면 개발 메뉴 안내 시트가 화면을 덮는다.
 * 시트가 접근성 트리를 가려 앱 글자를 못 읽으므로 닫고 시작한다.
 */
async function dismissDevMenuOnboarding() {
  let xml = dumpUi();
  if (xml.includes("This is the developer menu") && tapText(xml, "Continue")) {
    console.log("  (dev build 첫 실행 안내를 닫았습니다)");
    await wait(1500);
    xml = dumpUi();
  }
  // Continue 뒤에는 개발 메뉴 본체가 열린 채로 남는다 — 뒤로 가기로 닫는다
  if (xml.includes("Toggle element inspector")) {
    adb(["shell", "input", "keyevent", "KEYCODE_BACK"]);
    await wait(1500);
  }
}

async function waitForText(texts, timeoutMs) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const xml = dumpUi();
    const found = texts.find((t) => xml.includes(t));
    if (found) return found;
    await wait(2000);
  }
  return null;
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
      await dismissDevMenuOnboarding();
      return true;
    }
  }
  return false;
}

/* ── 0. 공유 코드 드리프트 ─────────────────────────────────── */
if (
  spawnSync(process.execPath, [join(ROOT, "scripts", "sync-shared.mjs")], { stdio: "inherit" })
    .status !== 0
) {
  console.error("\n공유 코드가 웹과 갈라져 있습니다. 먼저 맞추고 다시 실행하세요.");
  process.exit(1);
}

/* ── 1. 기기 · 설치 ────────────────────────────────────────── */
const device = (adb(["devices"]).stdout ?? "").split("\n").find((l) => /\tdevice$/.test(l.trim()));
if (!device) {
  console.error("\n✗ 연결된 안드로이드 기기가 없습니다.");
  console.error("  emulator -avd Medium_Phone   으로 에뮬레이터를 먼저 띄우세요.");
  process.exit(1);
}
check(true, "기기 연결", device.split("\t")[0]);

const installed = (adb(["shell", "pm", "list", "packages", PACKAGE]).stdout ?? "").includes(`package:${PACKAGE}`);
check(installed, "dev build 설치", installed ? PACKAGE : "npx expo run:android --no-bundler 로 먼저 설치하세요");
if (!installed) process.exit(1);

/* ── 개발 서버 ─────────────────────────────────────────────── */
const serverUp = async () => {
  try {
    return (await fetch(`http://localhost:${PORT}`, { signal: AbortSignal.timeout(3000) })).ok;
  } catch {
    return false;
  }
};

let devServer = null;
if (await serverUp()) {
  console.log(`\n이미 떠 있는 개발 서버를 씁니다: http://localhost:${PORT}`);
} else {
  console.log(`\n개발 서버를 띄웁니다 …`);
  devServer = spawn("npx", ["expo", "start", "--dev-client", "--port", String(PORT)], {
    cwd: ROOT,
    env: { ...process.env, BROWSER: "none", EXPO_NO_TELEMETRY: "1" },
    stdio: "ignore",
    shell: true,
  });
  for (let i = 0; i < 90 && !(await serverUp()); i++) await wait(2000);
}

function stopServer() {
  if (!devServer) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(devServer.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    devServer.kill("SIGTERM");
  }
}

// 에뮬레이터의 localhost를 PC로 넘겨 LAN IP에 의존하지 않게 한다.
adb(["reverse", `tcp:${PORT}`, `tcp:${PORT}`]);

/* ── 2. 번들 로드 ──────────────────────────────────────────── */
const bundled = await launchApp();
check(bundled, "번들 로드 (dev build)", bundled ? "" : "3분 안에 'Running \"main\"'을 보지 못했습니다");

if (bundled) {
  /* ── 4. 첫 화면 ────────────────────────────────────────── */
  const found = await waitForText([TEXT_LOGIN, TEXT_HOME], 30_000);
  check(Boolean(found), "첫 화면 표시", found === TEXT_HOME ? "홈 (로그인됨)" : found ? "로그인 화면" : "로그인·홈 어느 쪽도 보이지 않음");

  if (PERSIST) {
    check(found === TEXT_HOME, "로그인 상태에서 시작", found === TEXT_HOME ? "" : "먼저 앱에서 Google로 로그인하세요");
    if (found === TEXT_HOME) {
      console.log("\n앱을 강제 종료하고 다시 엽니다 …");
      const relaunched = await launchApp();
      const after = relaunched ? await waitForText([TEXT_LOGIN, TEXT_HOME], 30_000) : null;
      check(after === TEXT_HOME, "재시작 후 로그인 유지", after === TEXT_LOGIN ? "로그인 화면으로 돌아감" : "");
    }
  }

  /* ── 3. 에러 ───────────────────────────────────────────── */
  const logs = adb(["logcat", "-d", "-s", "ReactNativeJS:E", "AndroidRuntime:E"]).stdout ?? "";
  const errors = logs
    .split("\n")
    .filter((l) => /\b[EF]\b|FATAL|Unhandled/.test(l) && l.trim())
    .slice(0, 5);
  check(errors.length === 0, "JS 에러 · 네이티브 크래시 0", errors.join(" | ").slice(0, 300));

  /* ── 스크린샷 ──────────────────────────────────────────── */
  mkdirSync(OUT_DIR, { recursive: true });
  const shot = adb(["exec-out", "screencap", "-p"], { encoding: "buffer" }).stdout;
  const out = join(OUT_DIR, PERSIST ? "M2-android-persist.png" : "M2-android.png");
  writeFileSync(out, shot);
  check(shot.length > 20_000, "스크린샷 캡처", `${out} (${Math.round(shot.length / 1024)}KB)`);
}

stopServer();

if (failures.length) {
  console.error(`\nM2 안드로이드 검증 실패 ${failures.length}건: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nM2 안드로이드 검증을 통과했습니다.");
if (!PERSIST) {
  console.log("로그인 유지는 앱에서 Google로 로그인한 뒤  node scripts/verify-M2-android.mjs --persist  로 확인하세요.");
}
