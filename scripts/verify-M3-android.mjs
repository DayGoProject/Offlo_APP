/**
 * M3 검증 ② — 비행기 모드에서 한국어 에러 · 앱 생존 (안드로이드 dev build + adb)
 *
 *   emulator -avd Medium_Phone
 *   (앱에서 Google로 로그인해 둔 상태)
 *   node scripts/verify-M3-android.mjs
 *
 * M3 완료 조건: "비행기모드에서 한국어 에러 메시지가 뜨고 앱이 죽지 않는다"
 *
 * 확인 항목
 *   0. 공유 코드 드리프트 (매 검증의 첫 줄)
 *   1. 온라인 — 홈(대시보드)이 서버 데이터를 불러온다
 *   2. 비행기 모드 켜고 앱 재시작 — 한국어 네트워크 에러가 뜬다
 *   3. 그동안 앱 프로세스가 살아 있고 크래시가 없다
 *   4. 비행기 모드 끄고 "다시 시도" — 정보를 다시 불러온다
 *
 * 비행기 모드는 무슨 일이 있어도 끝에서 되돌린다.
 * 번들은 adb reverse(에뮬레이터 브리지)로 받아서 비행기 모드의 영향을 받지 않는다.
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

// 로그인했을 때만 보이는 하단 탭 이름
const TEXT_HOME = "더보기";
const TEXT_LOGIN = "Google로 계속하기";
// 대시보드 "이번 주 스크린타임" 카드 우측 — 불러오기에 성공해야만 나온다 (로딩 중엔 "—")
const TEXTS_READY = ["일 평균", "기록 없음"];
// src/services/api-client.ts API_MESSAGES.network 의 앞부분
const TEXT_OFFLINE = "인터넷에 연결되어 있지 않거나";
const TEXT_RETRY = "다시 시도";

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

async function waitForText(texts, timeoutMs) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const xml = dumpUi();
    const found = texts.find((t) => xml.includes(t));
    if (found) return { found, xml };
    await wait(1500);
  }
  return { found: null, xml: "" };
}

/** dev build 첫 실행 안내 · 개발 메뉴가 화면을 덮고 있으면 닫는다 */
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

const setAirplane = (on) => adb(["shell", "cmd", "connectivity", "airplane-mode", on ? "enable" : "disable"]);
const appAlive = () => Boolean((adb(["shell", "pidof", PACKAGE]).stdout ?? "").trim());
const shot = (name) => {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, name), adb(["exec-out", "screencap", "-p"], { encoding: "buffer" }).stdout);
};

/* ── 0. 공유 코드 드리프트 ─────────────────────────────────── */
if (
  spawnSync(process.execPath, [join(ROOT, "scripts", "sync-shared.mjs")], { stdio: "inherit" })
    .status !== 0
) {
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
setAirplane(false);

try {
  /* ── 1. 온라인 ───────────────────────────────────────────── */
  check(await launchApp(), "번들 로드 (dev build)");
  const home = await waitForText([TEXT_HOME, TEXT_LOGIN], 30_000);
  if (home.found !== TEXT_HOME) {
    check(false, "로그인 상태", "먼저 앱에서 Google로 로그인한 뒤 다시 실행하세요");
    throw new Error("not signed in");
  }
  const online = await waitForText([...TEXTS_READY, TEXT_OFFLINE], 30_000);
  check(TEXTS_READY.includes(online.found), "온라인 — 대시보드가 서버 데이터를 불러옴", online.found ?? "");

  /* ── 2. 비행기 모드 ──────────────────────────────────────── */
  setAirplane(true);
  await wait(3000);
  console.log("\n비행기 모드를 켜고 앱을 다시 엽니다 …");
  check(await launchApp(), "비행기 모드에서 번들 로드");
  // 조회는 두 번 재시도한 뒤 실패한다 (600ms + 1800ms + 요청 시간)
  const offline = await waitForText([TEXT_OFFLINE, ...TEXTS_READY], 45_000);
  check(offline.found === TEXT_OFFLINE, "비행기 모드 — 한국어 네트워크 에러 표시", offline.found ?? "아무 안내도 없음");
  shot("M3-android-offline.png");

  /* ── 3. 생존 ─────────────────────────────────────────────── */
  await wait(3000);
  check(appAlive(), "앱 프로세스 생존");
  const crashes = (adb(["logcat", "-d", "-s", "AndroidRuntime:E", "ReactNativeJS:E"]).stdout ?? "")
    .split("\n")
    .filter((l) => /FATAL|\bE\b/.test(l));
  check(crashes.length === 0, "크래시 · JS 에러 0", crashes.slice(0, 2).join(" | ").slice(0, 200));

  /* ── 4. 복구 ─────────────────────────────────────────────── */
  setAirplane(false);
  console.log("\n비행기 모드를 끄고 다시 시도합니다 …");
  await wait(6000); // 네트워크가 다시 붙을 시간
  const retryXml = dumpUi();
  check(tapText(retryXml, TEXT_RETRY), "\"다시 시도\" 버튼 탭");
  const recovered = await waitForText(TEXTS_READY, 30_000);
  check(Boolean(recovered.found), "연결 복구 — 대시보드를 다시 불러옴");
  shot("M3-android-recovered.png");
} catch (e) {
  if (String(e) !== "Error: not signed in") check(false, "검증 중 예외", String(e).split("\n")[0]);
} finally {
  setAirplane(false);
  stopServer();
}

if (failures.length) {
  console.error(`\nM3 안드로이드 검증 실패 ${failures.length}건: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nM3 안드로이드 검증을 통과했습니다.");
