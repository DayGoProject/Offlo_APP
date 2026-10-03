/**
 * M6 검증 ② — 정원 탭 실데이터 · 살아 있는 동물 (안드로이드 dev build + adb)
 *
 *   emulator -avd Medium_Phone
 *   (앱에서 Google로 로그인해 둔 상태)
 *   node scripts/verify-M6-android.mjs
 *
 * **읽기만 한다** — 동물 선택 · 변경은 서버에 쓰고 연속 기록을 초기화하므로 이 스크립트가 누르지 않는다.
 * 계정의 동물 상태(알 · 배부름 · 출출 · 굶주림 · 미선택)가 무엇이든 통과해야 한다.
 *
 * **두 국면으로 나눈다.** 동물이 계속 움직이는 화면에서는 `uiautomator dump`가 "could not get idle state"로 실패한다.
 * 그래서 글자 · 좌표는 정지 모드(`offlo://garden?still=1`)에서 읽고, 움직임은 애니메이션 모드에서 스크린샷 픽셀로만 본다.
 *
 * 확인 항목
 *   0. 공유 코드 드리프트
 *   1. [정지] 정원 탭이 열리고 Firestore 데이터(식물 성장 카드 · 상태 헤드라인)가 뜬다
 *   2. [정지] 동물이 있으면 방 장면(pet-stage)이 그려진다 · 밥 주기 버튼(배부름이 아닐 때) → 분석 탭 → 정원
 *   3. [애니메이션] **화면이 실제로 움직인다** (3D 클레이 동물 · expo-gl — 웹 검증이 못 보는 부분)
 *      + 동물을 누르면 하트가 올라온다 (하트는 3D 장면에서만 나온다 — 3D가 실제로 그려졌다는 증거이기도 하다. 저장 · 기록은 없는 화면 효과)
 *      + 같은 탭에서 효과음이 재생된다 (`dumpsys audio`에 이 앱의 24kHz 모노 AudioTrack이 started — 귀로 듣지는 못하지만 소리가 실제로 나갔다는 증거)
 *   4. 앱 생존 · JS 에러 · 네이티브 크래시 0
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PNG } from "pngjs";

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
/** logic/garden.ts conditionCopy의 헤드라인 — 계정 상태에 따라 하나가 뜬다 */
const HEADLINES = {
  none: "함께할 동물을 골라 주세요",
  egg: "알이 부화를 기다리고 있어요",
  fed: "오늘 밥을 배부르게 먹었어요",
  peckish: "슬슬 밥 먹을 시간이에요",
  starving: "굶어서 힘이 없어요",
};

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
function boundsOf(xml, attr, value) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = xml.match(new RegExp(`${attr}="${escaped}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`));
  return m ? m.slice(1).map(Number) : null;
}
function tapAt(b) {
  adb(["shell", "input", "tap", String((b[0] + b[2]) >> 1), String((b[1] + b[3]) >> 1)]);
}
const tapText = (xml, text) => {
  const b = boundsOf(xml, "text", text);
  if (b) tapAt(b);
  return Boolean(b);
};
async function waitForAll(texts, timeoutMs) {
  const until = Date.now() + timeoutMs;
  let xml = "";
  while (Date.now() < until) {
    xml = dumpUi();
    if (texts.every((t) => xml.includes(t))) return { ok: true, xml };
    await wait(1500);
  }
  return { ok: false, xml, missing: texts.filter((t) => !xml.includes(t)) };
}
/** 목록 중 하나라도 보이면 통과 — 상태에 따라 헤드라인이 달라진다 */
async function waitForAny(texts, timeoutMs) {
  const until = Date.now() + timeoutMs;
  let xml = "";
  while (Date.now() < until) {
    xml = dumpUi();
    if (texts.some((t) => xml.includes(t))) return { ok: true, xml };
    await wait(1500);
  }
  return { ok: false, xml };
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
/** 정원 탭을 딥링크로 연다 — still=1이면 동물이 정지해 uiautomator가 읽을 수 있다 */
async function openGarden(still) {
  adb(["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", `offlo://garden?still=${still ? 1 : 0}`, "-p", PACKAGE]);
  await wait(2500);
}
const screencap = () => adb(["exec-out", "screencap", "-p"], { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 }).stdout;
const shot = (name, png = screencap()) => {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, name), png);
};

/** 화면 캡처에서 영역(px)의 픽셀을 뽑는다 */
function region(pngBuffer, [x1, y1, x2, y2]) {
  const img = PNG.sync.read(pngBuffer);
  const out = [];
  for (let y = y1; y < Math.min(y2, img.height); y++) {
    for (let x = x1; x < Math.min(x2, img.width); x++) {
      const i = (y * img.width + x) * 4;
      out.push(img.data[i], img.data[i + 1], img.data[i + 2]);
    }
  }
  return Buffer.from(out);
}
/** 쓰다듬기 하트(#FF6F8E 계열 · 초록이 낮은 분홍)의 픽셀 수 — `region()`이 준 RGB 버퍼에서 센다 (고양이 귀 안쪽 · 볼터치 · 주황 털과 가른다) */
function heartPixels(rgb) {
  let n = 0;
  for (let i = 0; i < rgb.length; i += 3) {
    const [r, g, b] = [rgb[i], rgb[i + 1], rgb[i + 2]];
    if (r > 225 && g > 70 && g < 140 && b > 100 && b < 190 && r - g > 110) n++;
  }
  return n;
}
/** 화면을 누른 뒤 기기 안에서 바로 캡처한다 — adb 왕복 지연 없이 하트가 떠 있는 순간을 잡는다 */
function tapThenCap(x, y, afterMs = 450) {
  // 같은 셸에서 탭 → (소리가 나는 동안) 오디오 재생 상태를 덤프 → 캡처. 효과음은 0.4~0.7초라 바로 잡아야 한다
  adb(["shell", `input tap ${x} ${y}; sleep 0.25; dumpsys audio > /sdcard/offlo-audio.txt; sleep ${(afterMs - 250) / 1000}; screencap -p /sdcard/offlo-tap.png`]);
  return adb(["exec-out", "cat", "/sdcard/offlo-tap.png"], { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 }).stdout;
}
/** 방금 탭에서 이 앱의 24kHz 모노 AudioTrack(우리 효과음 WAV)이 재생 중(started)이었는가 — 귀로 듣지는 못해도 "실제로 소리가 나갔다"는 증거 */
function appAudioStarted() {
  const pid = (adb(["shell", "pidof", PACKAGE]).stdout ?? "").trim().split(/\s+/)[0];
  const dump = adb(["exec-out", "cat", "/sdcard/offlo-audio.txt"]).stdout ?? "";
  return Boolean(pid) && new RegExp(`u/pid:\\d+/${pid} state:started[^\\n]*sampleRate=24000`).test(dump);
}
/** 두 영역이 다른 픽셀 수 */
function diffCount(a, b) {
  let n = 0;
  for (let i = 0; i < a.length; i += 3) {
    if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24) n++;
  }
  return n;
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

  const tabs = await waitForAll([...TABS], 30_000);
  if (!tabs.ok && tabs.xml.includes(TEXT_LOGIN)) {
    check(false, "로그인 상태", "먼저 앱에서 Google로 로그인한 뒤 다시 실행하세요");
    throw new Error("not signed in");
  }
  check(tabs.ok, "하단 탭 5개");

  /* ── 1. [정지] 정원 탭 · 실데이터 ────────────────────────── */
  await openGarden(true);
  // uiautomator는 화면에 보이는 요소만 준다 — 스크롤 아래 식물 카드가 아니라 위쪽 헤드라인으로 "데이터가 떴다"를 본다
  const loaded = await waitForAny(Object.values(HEADLINES), 30_000);
  check(
    loaded.ok,
    "정원 — Firestore 데이터가 떠서 상태 헤드라인이 그려짐",
    loaded.ok ? "" : loaded.xml.includes("인터넷에 연결되어 있지 않거나") ? "오프라인" : "안 보임",
  );
  await wait(1500);
  let xml = dumpUi();
  const state = Object.entries(HEADLINES).find(([, h]) => xml.includes(h))?.[0] ?? null;
  check(state !== null, "정원 — 계정의 동물 상태 헤드라인이 뜸", state ?? "알 수 없는 헤드라인");
  console.log(`  · 이 계정의 동물 상태: ${state}`);
  shot("M6-android-garden.png");

  /* ── 2. [정지] 방 장면 · 밥 주기 ─────────────────────────── */
  let stage = null;
  if (state && state !== "none") {
    stage = boundsOf(xml, "resource-id", "pet-stage");
    check(stage !== null, "정원 — 방 장면(pet-stage)이 그려짐");
    if (stage) {
      const w = stage[2] - stage[0];
      const h = stage[3] - stage[1];
      check(Math.abs(h / w - 418 / 360) < 0.03, "방 비율 360:418", `${w}×${h}`);
    }
  } else {
    check(xml.includes("고양이") && xml.includes("강아지") && xml.includes("토끼"), "동물 미선택 — 선택 카드가 보임");
  }

  const feed = boundsOf(xml, "resource-id", "garden-feed");
  if (state === "fed" || state === "none") {
    check(!feed, `밥 주기 버튼 — ${state === "fed" ? "배부름이면 없음" : "미선택이면 없음"}`);
  } else {
    check(Boolean(feed), "밥 주기 버튼이 보임", String(state));
    if (feed) {
      tapAt(feed);
      const analysis = await waitForAll(["AI 분석", "주간 종합 분석"], 20_000);
      check(analysis.ok, "밥 주기 → 분석 탭으로 이동");
      shot("M6-android-feed-analysis.png");
      await openGarden(true);
      check((await waitForAny(Object.values(HEADLINES), 15_000)).ok, "분석 탭 → 정원으로 돌아옴");
    }
  }

  /* ── 3. [애니메이션] 움직임 ──────────────────────────────── */
  if (stage) {
    await openGarden(false);
    await wait(2500);
    const [x1, y1, x2, y2] = stage;
    const w = x2 - x1;
    const h = y2 - y1;
    // 동물이 있는 영역(오른쪽 가운데~아래)만 비교한다 — 말풍선(위) · 식물(왼쪽)은 제외
    const clip = [x1 + Math.round(w * 0.38), y1 + Math.round(h * 0.44), x1 + Math.round(w * 0.88), y1 + Math.round(h * 0.94)];
    const frames = [];
    for (let i = 0; i < 4; i++) {
      frames.push(region(screencap(), clip));
      await wait(700);
    }
    const diffs = frames.slice(1).map((f, i) => diffCount(frames[i], f));
    const moving = diffs.filter((d) => d > 30).length;
    check(moving >= 2, "동물이 실제로 움직인다 (3D 네이티브 · 정지 화면 아님)", `프레임 간 달라진 픽셀 ${diffs.join(" · ")}`);
    shot("M6-android-garden-animated.png");

    // 쓰다듬기 — 동물이 서 있는 곳(방 가운데 아래)을 누르면 하트가 올라온다. 3D가 못 뜨거나 탭이 안 먹히면 하트가 없다
    const before = heartPixels(region(screencap(), clip));
    const png = tapThenCap(x1 + Math.round(w * 0.55), y1 + Math.round(h * 0.72));
    const after = heartPixels(region(png, clip));
    check(after > before + 40, "동물을 누르면 하트가 올라온다 (3D 렌더 · 탭 판정)", `하트 픽셀 ${before} → ${after}`);
    check(appAudioStarted(), "동물을 누르면 효과음이 실제로 재생된다 (24kHz 모노 AudioTrack started)");
    shot("M6-android-garden-pet.png", png);
  }

  /* ── 4. 생존 · 에러 ──────────────────────────────────────── */
  check(Boolean((adb(["shell", "pidof", PACKAGE]).stdout ?? "").trim()), "앱 프로세스 생존");
  const errors = (adb(["logcat", "-d", "-s", "AndroidRuntime:E", "ReactNativeJS:E"]).stdout ?? "")
    .split("\n")
    .filter((l) => /FATAL|\bE\b/.test(l));
  check(errors.length === 0, "크래시 · JS 에러 0", errors.slice(0, 3).join(" | ").slice(0, 300));
} catch (e) {
  if (String(e) !== "Error: not signed in") check(false, "검증 중 예외", String(e).split("\n")[0]);
} finally {
  stopServer();
}

console.log(`\n스크린샷: ${OUT_DIR}`);
if (failures.length) {
  console.error(`\nM6 안드로이드 검증 실패 ${failures.length}건: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nM6 안드로이드 검증을 통과했습니다.");
