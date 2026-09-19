/**
 * M5 검증 ② — AI 분석 · 결과 · 코치 채팅 실데이터 (안드로이드 dev build + adb)
 *
 *   emulator -avd Medium_Phone
 *   (앱에서 Google로 로그인해 둔 상태 · 시험 이미지 .verify/screentime.png)
 *   node scripts/verify-M5-android.mjs
 *
 * M5 완료 조건: "안드로이드에서 사진 선택 → 압축 → AI 분석 → 저장 → 결과까지 끝까지 동작 · 코치 채팅(사진 첨부 포함) · 콘솔 에러 0"
 * 레이아웃 · 상태 모양은 층 ①(verify-M5-web.mjs)이 샘플로 본다. 여기서는 실서버 · 시스템 사진 선택기 · 이미지 압축을 본다.
 *
 * ⚠ 실제 Gemini를 부르고 실제 기록을 남긴다 — 오늘 일간 분석이 없으면 1건 저장, 코치 채팅 2회.
 *   일간 분석은 하루 1회라 **오늘 이미 분석했으면 업로드 경로는 건너뛴다**(✗가 아니라 "건너뜀"). 다음 날 다시 돌리면 그 경로까지 본다.
 *   사진 선택 · 압축은 코치 채팅의 사진 첨부로 매번 확인한다.
 *
 * 확인 항목
 *   0. 공유 코드 드리프트
 *   1. 분석 탭 — 오늘 상태(서버 기록) · 이번 주 n / 7
 *   2. (오늘 분석 전일 때) 스크린샷 고르기 → 시스템 선택기 → AI 분석 시작 → 결과 화면 → 탭이 "오늘 완료"로 바뀜
 *   3. 오늘 결과 — 점수 링 · 총 시간 · 앱별 시간 · 코치와 대화하기
 *   4. 코치 채팅 — 첫 질문 · 키보드 위 입력줄 · 글 보내기 → 답 · 사진 첨부 보내기 → 답
 *   5. 분석 기록에서 한 줄 눌러 결과 열기
 *   6. 앱 생존 · JS 에러 · 네이티브 크래시 0 (시험 이미지는 기기에서 지운다)
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, ".verify");
const TEST_IMAGE = join(OUT_DIR, "screentime.png");
const DEVICE_IMAGE = "/sdcard/Pictures/offlo-verify.png";
const PORT = 8081;
const PACKAGE = "com.daygoproject.offlo";
const DEV_CLIENT_URL = `exp+offlo-app://expo-development-client/?url=${encodeURIComponent(`http://127.0.0.1:${PORT}`)}`;
const ADB = process.env.ANDROID_HOME
  ? join(process.env.ANDROID_HOME, "platform-tools", "adb")
  : join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk", "platform-tools", "adb.exe");

const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};
const skip = (label, why) => console.log(`- ${label} — 건너뜀: ${why}`);
const adb = (args, opts = {}) => spawnSync(ADB, args, { encoding: "utf8", ...opts });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function dumpUi() {
  adb(["shell", "uiautomator", "dump", "/sdcard/offlo-ui.xml"]);
  return adb(["exec-out", "cat", "/sdcard/offlo-ui.xml"]).stdout ?? "";
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** attr="value"(value는 앞부분 일치)인 노드의 영역 */
function boundsOf(xml, attr, value, { prefix = false } = {}) {
  const v = escape(value) + (prefix ? '[^"]*' : "");
  const m = xml.match(new RegExp(`${attr}="${v}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`));
  return m ? m.slice(1).map(Number) : null;
}
function tap(xml, attr, value, opts) {
  const b = boundsOf(xml, attr, value, opts);
  if (!b) return false;
  adb(["shell", "input", "tap", String((b[0] + b[2]) >> 1), String((b[1] + b[3]) >> 1)]);
  return true;
}
const has = (xml, id) => xml.includes(`resource-id="${id}"`);
const countId = (xml, id) => xml.split(`resource-id="${id}"`).length - 1;

async function waitUntil(pred, timeoutMs, interval = 1500) {
  const until = Date.now() + timeoutMs;
  let xml = "";
  while (Date.now() < until) {
    xml = dumpUi();
    const r = pred(xml);
    if (r) return { ok: true, xml, value: r };
    await wait(interval);
  }
  return { ok: false, xml };
}

/** 원하는 요소가 보일 때까지 아래로 민다 */
async function scrollTo(id, tries = 12) {
  let xml = dumpUi();
  for (let i = 0; i < tries && !has(xml, id); i++) {
    adb(["shell", "input", "swipe", "540", "1800", "540", "700", "300"]);
    await wait(700);
    xml = dumpUi();
  }
  return xml;
}

async function dismissDevMenu() {
  let xml = dumpUi();
  if (xml.includes("This is the developer menu") && tap(xml, "text", "Continue")) {
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

/** 시스템 사진 선택기에서 가장 최근 사진(= 방금 넣은 시험 이미지)을 고른다 */
async function pickLatestPhoto() {
  const picker = await waitUntil((x) => x.includes("com.google.android.photopicker") || x.includes("Photo taken on"), 15_000);
  if (!picker.ok) return false;
  const photo = await waitUntil((x) => boundsOf(x, "content-desc", "Photo taken on", { prefix: true }), 10_000);
  return photo.ok && tap(photo.xml, "content-desc", "Photo taken on", { prefix: true });
}

/** 코치 답을 기다린다 — 코치 말풍선이 늘고 점 세 개가 사라질 때까지 (AI · 최대 90초) */
async function waitReply(before) {
  return waitUntil((x) => countId(x, "bubble-model") > before && !has(x, "typing") && !has(x, "send-error"), 90_000, 2000);
}

/* ── 0. 공유 코드 드리프트 ─────────────────────────────────── */
if (spawnSync(process.execPath, [join(ROOT, "scripts", "sync-shared.mjs")], { stdio: "inherit" }).status !== 0) {
  console.error("\n공유 코드가 웹과 갈라져 있습니다. 먼저 맞추고 다시 실행하세요.");
  process.exit(1);
}

/* ── 기기 · 설치 · 개발 서버 · 시험 이미지 ─────────────────── */
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
if (!existsSync(TEST_IMAGE)) {
  console.error(`\n✗ 시험 이미지가 없습니다: ${TEST_IMAGE} (스크린타임 캡처를 넣어 두세요 — 커밋되지 않는 폴더)`);
  process.exit(1);
}

const serverUp = async () => {
  try {
    return (await fetch(`http://127.0.0.1:${PORT}/status`, { signal: AbortSignal.timeout(3000) })).ok;
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

// 시험 이미지를 사진첩 맨 앞에 넣는다 (시각을 지금으로 → 선택기 첫 칸)
adb(["push", TEST_IMAGE, DEVICE_IMAGE]);
adb(["shell", "touch", DEVICE_IMAGE]);
adb(["shell", "am", "broadcast", "-a", "android.intent.action.MEDIA_SCANNER_SCAN_FILE", "-d", `file://${DEVICE_IMAGE}`]);

try {
  check(await launchApp(), "번들 로드 (dev build)");
  const home = await waitUntil((x) => (has(x, "tab-analysis") ? "home" : x.includes("Google로 계속하기") ? "login" : null), 30_000);
  if (home.value !== "home") {
    check(false, "로그인 상태", "먼저 앱에서 Google로 로그인한 뒤 다시 실행하세요");
    throw new Error("not signed in");
  }

  /* ── 1. 분석 탭 ──────────────────────────────────────────── */
  tap(home.xml, "resource-id", "tab-analysis");
  const tab = await waitUntil((x) => (has(x, "stage-done") ? "done" : has(x, "stage-idle") ? "idle" : null), 30_000);
  check(tab.ok, "분석 탭 — 서버 기록으로 오늘 상태 결정", tab.value ?? "안 뜸");
  const weekCount = tab.xml.match(/text="(\d) \/ 7"/)?.[1];
  check(weekCount !== undefined, "분석 탭 — 이번 주 n / 7", `${weekCount} / 7`);
  shot("M5-android-analysis.png");

  /* ── 2. 업로드 경로 (오늘 분석 전일 때만) ─────────────────── */
  if (tab.value === "idle") {
    tap(tab.xml, "resource-id", "pick-screenshot");
    check(await pickLatestPhoto(), "시스템 사진 선택기에서 시험 이미지 고름");
    const picked = await waitUntil((x) => has(x, "start-analysis") && has(x, "picked-image"), 15_000);
    check(picked.ok, "고른 사진 미리보기 · AI 분석 시작");
    shot("M5-android-picked.png");
    const started = Date.now();
    tap(picked.xml, "resource-id", "start-analysis");
    const busy = await waitUntil((x) => has(x, "analysis-busy"), 10_000, 500);
    check(busy.ok, "분석 중 표시 (취소 가능)");
    const done = await waitUntil((x) => (has(x, "result") && x.includes('text="분석 결과"') ? "result" : has(x, "upload-error") ? "error" : null), 150_000, 2000);
    const took = Math.round((Date.now() - started) / 1000);
    check(done.value === "result", "압축 → AI 분석 → 저장 → 결과 화면", done.value === "error" ? "에러 안내가 뜸" : `${took}초`);
    shot("M5-android-saved-result.png");
    adb(["shell", "input", "keyevent", "KEYCODE_BACK"]);
    const after = await waitUntil((x) => has(x, "stage-done"), 20_000);
    check(after.ok, "결과에서 돌아오면 탭이 '오늘 완료'로 바뀜");
    const newCount = after.xml.match(/text="(\d) \/ 7"/)?.[1];
    check(Number(newCount) === Number(weekCount) + 1, "이번 주 칸이 하나 늘어남", `${weekCount} → ${newCount}`);
  } else {
    skip("업로드 경로(고르기 → 분석 → 저장)", "오늘 이미 일간 분석을 했다 — 하루 1회. 내일 다시 실행하면 본다");
  }

  /* ── 3. 오늘 결과 ────────────────────────────────────────── */
  const todayTab = dumpUi();
  check(tap(todayTab, "resource-id", "open-today-result"), "오늘 결과 보기");
  const result = await waitUntil((x) => has(x, "score-ring") && x.includes('text="앱별 사용 시간"'), 20_000);
  check(result.ok, "결과 — 점수 링 · 앱별 사용 시간");
  check(countId(result.xml, "app-row") > 0 && /text="\d+h( \d+m)?"|text="\d+m"/.test(result.xml), "결과 — 앱 줄 · 총 시간");
  shot("M5-android-result.png");
  const bottom = await scrollTo("open-chat");
  shot("M5-android-result-bottom.png");
  check(has(bottom, "coach-opening"), "결과 — 코치 첫 질문");

  /* ── 4. 코치 채팅 ────────────────────────────────────────── */
  tap(bottom, "resource-id", "open-chat");
  const chat = await waitUntil((x) => has(x, "chat-input") && countId(x, "bubble-model") >= 1, 20_000);
  check(chat.ok, "채팅 — 첫 말풍선 · 입력줄");
  const modelBefore = countId(chat.xml, "bubble-model");

  tap(chat.xml, "resource-id", "chat-input");
  await wait(1500);
  adb(["shell", "input", "text", "How%scan%sI%scut%sdown%slate%snight%suse?"]);
  await wait(800);
  const typed = dumpUi();
  const keyboardShown = /mInputShown=true/.test(adb(["shell", "dumpsys", "input_method"]).stdout ?? "");
  const inputBox = boundsOf(typed, "resource-id", "chat-input");
  if (keyboardShown) {
    check(Boolean(inputBox) && inputBox[3] < 1700, "키보드가 올라와도 입력줄이 그 위에 있다", inputBox ? `입력줄 아래 끝 y=${inputBox[3]}` : "");
  } else {
    skip("키보드 위 입력줄", "에뮬레이터가 화면 키보드를 띄우지 않았다 (하드웨어 키보드 설정)");
  }
  shot("M5-android-chat-typing.png");
  check(tap(typed, "resource-id", "send-message"), "보내기");
  adb(["shell", "input", "keyevent", "KEYCODE_BACK"]); // 키보드 내리기
  const reply = await waitReply(modelBefore);
  check(reply.ok, "코치 답 (글)", reply.ok ? "" : has(reply.xml, "send-error") ? "보내기 실패 안내" : "시간 초과");
  shot("M5-android-chat-reply.png");

  const withReply = dumpUi();
  const modelBefore2 = countId(withReply, "bubble-model");
  tap(withReply, "resource-id", "attach-image");
  check(await pickLatestPhoto(), "채팅 — 시스템 사진 선택기에서 시험 이미지 고름");
  const pending = await waitUntil((x) => has(x, "pending-image"), 15_000);
  check(pending.ok, "채팅 — 첨부 미리보기");
  tap(pending.xml, "resource-id", "send-message");
  const imageReply = await waitReply(modelBefore2);
  check(imageReply.ok, "코치 답 (사진 첨부 — 압축 후 전송)", imageReply.ok ? "" : has(imageReply.xml, "send-error") ? "보내기 실패 안내" : "시간 초과");
  shot("M5-android-chat-image.png");

  /* ── 5. 분석 기록 → 결과 ─────────────────────────────────── */
  // 화면 전환이 끝나기 전에 누르면 탭이 먹히지 않는다 — 매번 다음 화면이 뜬 것을 보고 넘어간다
  tap(dumpUi(), "resource-id", "chat-back");
  // 결과는 코치 카드까지 내려 둔 채라 점수 링이 화면 밖이다 (덤프엔 보이는 것만 나온다) — 화면 틀로 확인한다
  check((await waitUntil((x) => has(x, "result") && !has(x, "chat-input"), 15_000)).ok, "채팅 뒤로 → 결과");
  adb(["shell", "input", "keyevent", "KEYCODE_BACK"]);
  check((await waitUntil((x) => has(x, "tab-more") && has(x, "analysis"), 15_000)).ok, "결과 뒤로 → 분석 탭");
  await wait(800);
  const more = await (async () => {
    for (let i = 0; i < 3; i++) {
      tap(dumpUi(), "resource-id", "tab-more");
      // "내 계정"이 서버 정보를 받으면 카드가 길어져 메뉴가 아래로 밀린다 — 다 받은 뒤에 위치를 읽는다
      const r = await waitUntil((x) => has(x, "menu-history") && (has(x, "account-profile") || has(x, "account-error")), 12_000);
      if (r.ok) return r;
    }
    return { ok: false, xml: "" };
  })();
  check(more.ok, "더보기 탭");
  await wait(800);
  tap(dumpUi(), "resource-id", "menu-history");
  const history = await waitUntil((x) => has(x, "history-row"), 25_000);
  check(history.ok, "분석 기록 — 줄이 뜸");
  tap(history.xml, "resource-id", "history-row");
  const fromHistory = await waitUntil((x) => has(x, "score-ring"), 20_000);
  check(fromHistory.ok, "기록 한 줄 → 결과 화면");
  adb(["shell", "input", "keyevent", "KEYCODE_BACK"]);
  check((await waitUntil((x) => has(x, "history-row"), 10_000)).ok, "뒤로 → 분석 기록");

  /* ── 6. 생존 · 에러 ──────────────────────────────────────── */
  check(Boolean((adb(["shell", "pidof", PACKAGE]).stdout ?? "").trim()), "앱 프로세스 생존");
  const errors = (adb(["logcat", "-d", "-s", "AndroidRuntime:E", "ReactNativeJS:E"]).stdout ?? "")
    .split("\n")
    .filter((l) => /FATAL|\bE\b/.test(l));
  check(errors.length === 0, "크래시 · JS 에러 0", errors.slice(0, 2).join(" | ").slice(0, 200));
} catch (e) {
  if (String(e) !== "Error: not signed in") check(false, "검증 중 예외", String(e).split("\n")[0]);
} finally {
  // 시험 이미지(실제 스크린타임 캡처)는 기기에 남기지 않는다
  adb(["shell", "rm", "-f", DEVICE_IMAGE]);
  adb(["shell", "am", "broadcast", "-a", "android.intent.action.MEDIA_SCANNER_SCAN_FILE", "-d", `file://${DEVICE_IMAGE}`]);
  stopServer();
}

if (failures.length) {
  console.error(`\nM5 안드로이드 검증 실패 ${failures.length}건: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nM5 안드로이드 검증을 통과했습니다.");
