/**
 * M9 검증 — **릴리스 빌드** 스모크 테스트 (안드로이드 에뮬레이터 + adb · 실계정 · 실서버 · **개발 서버 없이**)
 *
 *   EXPO_APP_VARIANT=production npx expo prebuild --platform android --no-install
 *   npx expo run:android --variant release --no-bundler        # JS 번들 내장 · R8 축소 · 디버그 서명(출시 서명은 EAS)
 *   (앱에서 Google로 로그인해 둔 상태 — 개발 빌드 위에 같은 서명으로 덮어 설치하면 로그인이 남는다)
 *   node scripts/verify-M9-release-android.mjs
 *
 * 왜 따로 보나: 개발 빌드에서 멀쩡해도 릴리스에서만 깨지는 것이 있다 — R8이 지운 클래스 · Hermes 번들 · 환경변수(EXPO_PUBLIC_*)가 번들에 박혔는가 ·
 * 개발 서버 없이 뜨는가 · 개발 전용 화면(`/preview` · `/foundation`)이 사용자에게 열리지 않는가 · 개발 빌드에서만 들어 있던 권한이 빠졌는가.
 * **읽기만 한다** — 서버에 쓰는 것이 없고 알림도 읽음 처리하지 않는다. 개인 정보(이름 · 이메일 · 글)는 출력하지 않는다.
 *
 * 확인 항목
 *   0. 릴리스 빌드인가 — 디버그 가능(debuggable)이 아니다 · 개발 서버(8081)로 가는 길을 끊어도 뜬다
 *   1. 콜드 스타트 — 시간 · 로그인 상태가 그대로 · 하단 탭 5개
 *   2. 개발 흔적 없음 — 개발 도구("Tools") · 개발자 메뉴 문구 · 빨간 오류 상자가 없다
 *   3. 권한 — 알림 · 부팅 뒤 재예약 · 진동 · 인터넷만 (SYSTEM_ALERT_WINDOW · 위험 권한 · launcher 배지 권한 없음)
 *   4. 화면 — 홈 · 분석 · 정원(3D) · 커뮤니티 · 더보기 · 기록 · 목표 · 배지 · 설정(리마인더 카드) · 알림이 실서버 데이터로 열린다
 *   5. 개발 전용 화면 차단 — `offlo://preview` · `offlo://preview/dashboard` · `offlo://foundation`이 열리지 않는다
 *   6. 앱을 껐다 켜도 로그인이 남는다 · 크래시 · JS 에러 · R8 관련 오류(ClassNotFound · NoSuchMethod · UnsatisfiedLink) 0
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, ".verify");
const PACKAGE = "com.daygoproject.offlo";
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
  adb(["shell", "rm", "-f", "/sdcard/offlo-ui.xml"]);
  adb(["shell", "uiautomator", "dump", "/sdcard/offlo-ui.xml"]);
  return adb(["exec-out", "cat", "/sdcard/offlo-ui.xml"]).stdout ?? "";
}
function nodeOf(xml, id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = xml.match(new RegExp(`<node [^>]*?resource-id="${escaped}"[^>]*?>`));
  if (!m) return null;
  const attr = (name) => m[0].match(new RegExp(` ${name}="([^"]*)"`))?.[1] ?? null;
  const bounds = m[0].match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)?.slice(1).map(Number) ?? null;
  return { text: attr("text"), desc: attr("content-desc"), enabled: attr("enabled") === "true", checked: attr("checked") === "true", bounds };
}
const has = (xml, id) => nodeOf(xml, id) !== null;
const tapAt = (b) => adb(["shell", "input", "tap", String((b[0] + b[2]) >> 1), String((b[1] + b[3]) >> 1)]);
const tapId = (xml, id) => {
  const n = nodeOf(xml, id);
  if (n?.bounds) tapAt(n.bounds);
  return Boolean(n?.bounds);
};
async function until(test, timeoutMs = 20_000, everyMs = 1000) {
  const end = Date.now() + timeoutMs;
  let xml = "";
  while (Date.now() < end) {
    xml = dumpUi();
    if (test(xml)) return { ok: true, xml };
    await wait(everyMs);
  }
  return { ok: false, xml };
}
const shot = (name) => {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, name), adb(["exec-out", "screencap", "-p"], { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 }).stdout);
};
const scrollDown = (amount = 700) => adb(["shell", "input", "swipe", "540", "1900", "540", String(1900 - amount), "350"]);
const openRoute = async (route, settleMs = 2500) => {
  adb(["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", `offlo://${route}`, "-p", PACKAGE]);
  await wait(settleMs);
};
const hasTabs = (x) => TABS.every((t) => x.includes(t));

/** 콜드 스타트 — `am start -W`가 돌려주는 시간(ms) */
function coldStart() {
  adb(["shell", "am", "force-stop", PACKAGE]);
  const out = adb(["shell", "am", "start", "-W", "-n", `${PACKAGE}/.MainActivity`]).stdout ?? "";
  return { total: Number(out.match(/TotalTime:\s*(\d+)/)?.[1] ?? NaN), wait: Number(out.match(/WaitTime:\s*(\d+)/)?.[1] ?? NaN) };
}

/* ── 기기 · 설치 ────────────────────────────────────────────── */
const device = (adb(["devices"]).stdout ?? "").split("\n").find((l) => /\tdevice$/.test(l.trim()));
if (!device) {
  console.error("\n✗ 연결된 안드로이드 기기가 없습니다. emulator -avd Medium_Phone 으로 먼저 띄우세요.");
  process.exit(1);
}
const pkgDump = adb(["shell", "dumpsys", "package", PACKAGE], { maxBuffer: 32 * 1024 * 1024 }).stdout ?? "";
if (!pkgDump.includes(`Package [${PACKAGE}]`)) {
  console.error("\n✗ 앱이 설치돼 있지 않습니다. npx expo run:android --variant release --no-bundler 로 먼저 설치하세요.");
  process.exit(1);
}
check(true, "기기 · 앱 설치", device.split("\t")[0]);

try {
  /* ── 0. 릴리스 빌드인가 ──────────────────────────────────── */
  const flags = pkgDump.match(/\n\s*flags=\[([^\]]*)\]/)?.[1] ?? "";
  check(!/DEBUGGABLE/.test(flags), "릴리스 빌드다 — debuggable이 아니다", flags.trim().slice(0, 80));
  const versionName = pkgDump.match(/versionName=(\S+)/)?.[1] ?? "?";
  const versionCode = pkgDump.match(/versionCode=(\d+)/)?.[1] ?? "?";
  console.log(`  · 버전 ${versionName} (코드 ${versionCode})`);
  const apkPath = (adb(["shell", "pm", "path", PACKAGE]).stdout ?? "").split("\n").find((l) => l.startsWith("package:"))?.slice(8).trim();
  if (apkPath) {
    const localApk = join(ROOT, "android", "app", "build", "outputs", "apk", "release", "app-release.apk");
    if (existsSync(localApk)) console.log(`  · APK 크기 ${(statSync(localApk).size / 1024 / 1024).toFixed(1)} MB (4개 ABI 전부 — 스토어는 AAB로 기기별로 쪼개 내려받는다)`);
  }
  // 개발 서버로 가는 길을 끊는다 — 번들이 내장돼 있으면 그래도 뜬다
  adb(["reverse", "--remove-all"]);
  check(!(adb(["reverse", "--list"]).stdout ?? "").includes("8081"), "개발 서버(8081)로 가는 길을 끊었다 — 번들이 내장돼 있어야 뜬다");

  /* ── 1. 콜드 스타트 ──────────────────────────────────────── */
  adb(["logcat", "-c"]);
  const start = coldStart();
  console.log(`  · 콜드 스타트 TotalTime ${start.total}ms · WaitTime ${start.wait}ms (에뮬레이터 — 참고용)`);
  const home = await until((x) => hasTabs(x), 45_000);
  if (!home.ok && home.xml.includes(TEXT_LOGIN)) {
    check(false, "로그인 상태", "로그인 화면이 떴다 — 먼저 앱에서 Google로 로그인한 뒤 다시 실행하세요 (개발 빌드와 같은 서명이어야 로그인이 남는다)");
    throw new Error("not signed in");
  }
  check(home.ok, "개발 서버 없이 뜬다 — 로그인 상태가 그대로이고 하단 탭 5개가 보인다");
  check(Number.isFinite(start.total) && start.total < 8000, "콜드 스타트 8초 이내 (에뮬레이터 기준 — 실기기는 더 빠르다)", `${start.total}ms`);

  /* ── 2. 개발 흔적 ────────────────────────────────────────── */
  await wait(3000);
  let xml = dumpUi();
  check(!/content-desc="Tools"/.test(xml), "개발 도구 막대(\"Tools\")가 없다");
  check(!/developer menu|Toggle element inspector|Reload\b/i.test(xml) && !has(xml, "error-notice"), "개발자 메뉴 · 빨간 오류 상자가 없다");

  /* ── 3. 권한 ─────────────────────────────────────────────── */
  const requested = new Set([...pkgDump.matchAll(/^\s+((?:android|com)\.[\w.]*permission\.[A-Z_.a-z]+)(?::|$)/gm)].map((m) => m[1]));
  const list = [...requested].sort();
  console.log(`  · 요청 권한 ${list.length}개: ${list.map((p) => p.replace(/^android\.permission\./, "")).join(", ")}`);
  check(requested.has("android.permission.POST_NOTIFICATIONS") && requested.has("android.permission.RECEIVE_BOOT_COMPLETED") && requested.has("android.permission.INTERNET"), "알림 · 부팅 뒤 재예약 · 인터넷 권한이 있다");
  check(!requested.has("android.permission.SYSTEM_ALERT_WINDOW"), "\"다른 앱 위에 표시\"(SYSTEM_ALERT_WINDOW)를 요청하지 않는다 (production 빌드에서 막았다 — 개발 전용 권한)");
  const risky = list.filter((p) => /CAMERA|RECORD_AUDIO|LOCATION|CONTACTS|READ_PHONE|SMS|CALL_LOG|BLUETOOTH|READ_EXTERNAL|WRITE_EXTERNAL|EXACT_ALARM|badge|launcher\.permission|home\.permission/i.test(p));
  check(risky.length === 0, "위험 권한 · 정확한 알람 · launcher 배지 권한이 없다", risky.join(","));

  /* ── 4. 화면 ─────────────────────────────────────────────── */
  const tabId = (t) => ({ 홈: "tab-home", 분석: "tab-analysis", 정원: "tab-garden", 커뮤니티: "tab-community", 더보기: "tab-more" })[t];
  const rootOf = { 홈: "dashboard", 분석: "analysis", 정원: "garden", 커뮤니티: "community", 더보기: "more-tab" };
  for (const tab of TABS) {
    // 정원은 동물이 계속 움직여 uiautomator 덤프가 실패한다 — 정지 모드(`still=1`)로 연다 (mobile.md "정원 아트 · 애니메이션")
    if (tab === "정원") await openRoute("garden?still=1", 3500);
    else tapId(dumpUi(), tabId(tab));
    const screen = await until((x) => has(x, rootOf[tab]), 20_000);
    await wait(2500); // 실서버 데이터가 들어올 시간
    xml = dumpUi();
    check(screen.ok && !has(xml, "error-notice"), `${tab} 탭이 실서버 데이터로 열린다 (오류 안내 없음)`);
    if (tab === "정원") shot("M9-release-garden.png");
    if (tab === "홈") shot("M9-release-home.png");
  }

  // 정원 3D — 릴리스(Hermes · R8)에서도 three.js 장면이 도는가. 릴리스 덤프에는 `pet-3d-ready` 표식이 안 보이므로(실패하면 4초 뒤 SVG로 돌아가 눈으로도 구분이 어렵다)
  // 움직이는 화면을 열고 **로그에 three.js · EXGL 실행 흔적**(셰이더 컴파일 경고 · 시계 경고)이 남는지 본다. 정지 모드가 아니라 실제 모드다 (덤프는 쓰지 않는다)
  adb(["logcat", "-c"]);
  await openRoute("garden", 15_000);
  const glLog = adb(["logcat", "-d"], { maxBuffer: 64 * 1024 * 1024 }).stdout ?? "";
  check(/THREE\.(WebGLProgram|Clock)/.test(glLog) && /EXGL/.test(glLog), "정원 — 릴리스에서도 3D 장면이 돈다 (로그에 three.js 셰이더 컴파일 · EXGL 흔적)", /THREE\./.test(glLog) ? "" : "three.js 흔적 없음 — 3D 실패 · SVG 폴백일 수 있다");
  shot("M9-release-garden-3d.png");
  await openRoute("community", 3000); // 움직이는 화면을 떠난다 — 이어지는 덤프가 실패하지 않게
  const stackScreens = [
    ["history", "기록"],
    ["goals", "목표"],
    ["badges", "배지"],
    ["settings", "설정"],
    ["notifications", "알림"],
  ];
  for (const [route, label] of stackScreens) {
    await openRoute(route, 3500);
    const opened = await until((x) => has(x, route === "history" ? "history" : route), 20_000);
    await wait(2000);
    xml = dumpUi();
    check(opened.ok && !has(xml, "error-notice"), `${label} 화면이 실서버 데이터로 열린다`);
    if (route === "settings") {
      for (let i = 0; i < 6 && !has(xml, "reminder-switch-evening"); i++) {
        scrollDown(700);
        await wait(600);
        xml = dumpUi();
      }
      check(has(xml, "reminder-switch-evening") && has(xml, "reminder-switch-hungry") && has(xml, "reminder-switch-goal"), "설정 — 리마인더 카드(스위치 셋)가 있다");
      shot("M9-release-settings.png");
    }
  }

  /* ── 5. 개발 전용 화면 차단 ──────────────────────────────── */
  for (const route of ["preview", "preview/dashboard?state=ready", "foundation"]) {
    await openRoute(route, 3500);
    xml = dumpUi();
    const leaked = /검증 층|미리보기|기반 점검|foundation/i.test(xml) && (has(xml, "preview-index") || /검증 층 ① · 샘플 값|기반 점검/.test(xml));
    check(!leaked && !has(xml, "preview-index"), `offlo://${route} — 개발 전용 화면이 열리지 않는다`);
  }
  shot("M9-release-preview-blocked.png");

  /* ── 6. 재시작 · 로그 ────────────────────────────────────── */
  const again = coldStart();
  const relogin = await until((x) => hasTabs(x), 45_000);
  check(relogin.ok && !relogin.xml.includes(TEXT_LOGIN), "앱을 껐다 켜도 로그인이 남는다", `${again.total}ms`);
  check(Boolean((adb(["shell", "pidof", PACKAGE]).stdout ?? "").trim()), "앱 프로세스 생존");
  const log = adb(["logcat", "-d"], { maxBuffer: 64 * 1024 * 1024 }).stdout ?? "";
  const fatal = log.split("\n").filter((l) => /FATAL EXCEPTION|AndroidRuntime.*E |ReactNativeJS.*\bE\b/.test(l) && !/permissioncontroller/.test(l));
  check(fatal.length === 0, "크래시 · JS 에러 0", fatal.slice(0, 2).join(" | ").slice(0, 260));
  const r8 = log.split("\n").filter((l) => /ClassNotFoundException|NoSuchMethodError|NoSuchFieldError|UnsatisfiedLinkError|java\.lang\.VerifyError/.test(l));
  check(r8.length === 0, "R8(코드 축소)가 지운 것을 찾는 오류가 없다 (ClassNotFound · NoSuchMethod · UnsatisfiedLink)", r8.slice(0, 2).join(" | ").slice(0, 260));
} catch (e) {
  if (String(e) !== "Error: not signed in") check(false, "검증 중 예외", String(e).split("\n")[0]);
}

console.log(`\n스크린샷: ${OUT_DIR}`);
if (failures.length) {
  console.error(`\nM9 릴리스 스모크 검증 실패 ${failures.length}건: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nM9 릴리스 스모크 검증을 통과했습니다.");
