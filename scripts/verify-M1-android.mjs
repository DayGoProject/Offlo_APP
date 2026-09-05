/**
 * M1 검증 ② — 안드로이드 에뮬레이터 + adb (에이전트 자동 실행용)
 *
 *   emulator -avd Medium_Phone          # 먼저 에뮬레이터를 띄운다
 *   node scripts/verify-M1-android.mjs
 *
 * iOS는 아니지만 RN Web이 못 보는 것을 본다 — 진짜 네이티브 런타임, 실제 폰트 래스터라이즈,
 * SafeArea 인셋, 네이티브 스크롤. M5(권한)·M6(햅틱)·M8(알림)에서 이 층의 값어치가 커진다.
 *
 * 확인 항목
 *   0. 공유 코드 드리프트 (매 검증의 첫 줄)
 *   1. 기기 연결 · Expo Go 실행
 *   2. 번들 로드 완료 (`Running "main"`)
 *   3. JS 에러 · 네이티브 크래시 0
 *   4. 스크린샷 캡처 → .verify/M1-android.png (사람이 눈으로 대조)
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, ".verify");
const PORT = 8081;
const ADB = process.env.ANDROID_HOME
  ? join(process.env.ANDROID_HOME, "platform-tools", "adb")
  : join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk", "platform-tools", "adb.exe");

const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};
const adb = (args, opts = {}) => spawnSync(ADB, args, { encoding: "utf8", ...opts });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── 0. 공유 코드 드리프트 ─────────────────────────────────── */
if (
  spawnSync(process.execPath, [join(ROOT, "scripts", "sync-shared.mjs")], { stdio: "inherit" })
    .status !== 0
) {
  console.error("\n공유 코드가 웹과 갈라져 있습니다. 먼저 맞추고 다시 실행하세요.");
  process.exit(1);
}

/* ── 1. 기기 ───────────────────────────────────────────────── */
const devices = adb(["devices"]).stdout ?? "";
const device = devices.split("\n").find((l) => /\tdevice$/.test(l.trim()));
if (!device) {
  console.error("\n✗ 연결된 안드로이드 기기가 없습니다.");
  console.error("  emulator -avd Medium_Phone   으로 에뮬레이터를 먼저 띄우세요.");
  process.exit(1);
}
check(true, "기기 연결", device.split("\t")[0]);

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
  // 에뮬레이터의 localhost를 PC로 넘겨 LAN IP에 의존하지 않게 한다.
  adb(["reverse", `tcp:${PORT}`, `tcp:${PORT}`]);
  // 이미 떠 있으면 am start가 앱을 다시 로드하지 않는다 — 항상 껐다 켠다.
  adb(["shell", "am", "force-stop", "host.exp.exponent"]);
  await wait(1000);
  adb(["logcat", "-c"]);
  adb(["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", `exp://127.0.0.1:${PORT}`]);
} else {
  console.log(`\n개발 서버를 띄우고 Expo Go로 엽니다 …`);
  devServer = spawn("npx", ["expo", "start", "--android", "--port", String(PORT)], {
    cwd: ROOT,
    env: { ...process.env, BROWSER: "none", EXPO_NO_TELEMETRY: "1" },
    stdio: "ignore",
    shell: true,
  });
}

function stopServer() {
  if (!devServer) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(devServer.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    devServer.kill("SIGTERM");
  }
}

/* ── 2. 번들 로드 대기 ─────────────────────────────────────── */
let bundled = false;
for (let i = 0; i < 60 && !bundled; i++) {
  await wait(3000);
  bundled = (adb(["logcat", "-d", "-s", "ReactNativeJS"]).stdout ?? "").includes('Running "main"');
}
check(bundled, "번들 로드 (Expo Go)", bundled ? "" : "3분 안에 'Running \"main\"'을 보지 못했습니다");

if (bundled) {
  await wait(4000); // 첫 페인트 + 폰트 적용을 기다린다

  /* ── 3. 에러 ─────────────────────────────────────────────── */
  const logs = adb(["logcat", "-d", "-s", "ReactNativeJS:E", "AndroidRuntime:E"]).stdout ?? "";
  const errors = logs
    .split("\n")
    .filter((l) => /\b[EF]\b|FATAL|Unhandled/.test(l) && l.trim())
    .slice(0, 5);
  check(errors.length === 0, "JS 에러 · 네이티브 크래시 0", errors.join(" | ").slice(0, 300));

  const foreground = (adb(["shell", "dumpsys", "window", "windows"]).stdout ?? "").includes(
    "host.exp.exponent",
  );
  check(foreground, "Expo Go가 화면에 떠 있음");

  /* ── 4. 스크린샷 ─────────────────────────────────────────── */
  mkdirSync(OUT_DIR, { recursive: true });
  const shot = adb(["exec-out", "screencap", "-p"], { encoding: "buffer" }).stdout;
  const out = join(OUT_DIR, "M1-android.png");
  writeFileSync(out, shot);
  check(shot.length > 20_000, "스크린샷 캡처", `${out} (${Math.round(shot.length / 1024)}KB)`);
}

stopServer();

if (failures.length) {
  console.error(`\nM1 안드로이드 검증 실패 ${failures.length}건: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nM1 안드로이드 검증을 통과했습니다.");
console.log("스크린샷을 눈으로 확인하세요 — 폰트·색·SafeArea는 사람이 봐야 확실합니다.");
