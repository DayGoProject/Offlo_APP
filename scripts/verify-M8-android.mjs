/**
 * M8 검증 ② — 알림 실데이터 (안드로이드 dev build + adb · 실계정 · 실서버 Firestore 구독)
 *
 *   emulator -avd Medium_Phone
 *   (앱에서 Google로 로그인해 둔 상태)
 *   node scripts/verify-M8-android.mjs
 *
 * **이 스크립트는 알림을 하나도 읽음 처리하지 않는다** — 줄을 누르지도 "모두 읽음"을 누르지도 않는다 (읽음 표시는 되돌릴 수 없는 이 계정의 기록이다 · 읽음 흐름은 웹 미리보기의 가짜 서버가 같은 코드로 검증한다).
 * 눈으로 보고 숫자만 맞춰 본다. 계정에 알림이 몇 개든(0개 포함) 통과해야 한다. 알림 제목 · 본문은 출력하지 않는다 (스크린샷은 `.verify/` — gitignore 대상).
 *
 * 확인 항목
 *   0. 공유 코드 드리프트 · 기기 · 번들 로드 · 하단 탭
 *   1. 실서버 Firestore 구독이 열린다 — 보안 규칙이 자기 알림 읽기를 허용하는가 (권한 오류면 화면이 "알림을 읽을 권한이 없습니다."를 띄운다)
 *   2. 같은 숫자를 세 곳이 본다 — 홈의 종 · 더보기의 "알림" 줄 · 더보기 탭 배지 · 알림 화면 머리글 · 화면의 안 읽은 줄 수 (한 번 구독을 나눠 쓰는가)
 *   3. 알림 화면 — 모두 읽음 버튼은 안 읽은 알림이 있을 때만 열려 있다 · 읽은 줄 / 안 읽은 줄 구분(접근성 라벨) · 화면을 열기만 해서는 숫자가 변하지 않는다
 *   3b. 네이티브 미리보기(가짜 서버) — 실계정에 알림이 없어도 목록 · 읽음(낙관적) · 종 배지(3 · 9+)를 기기에서 본다 (`offlo://preview/notifications` · 실계정을 건드리지 않는다)
 *   4. 앱 생존 · JS 에러 · 네이티브 크래시 0
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
function boundsOf(xml, attr, value) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = xml.match(new RegExp(`${attr}="${escaped}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`));
  return m ? m.slice(1).map(Number) : null;
}
/** resource-id(= testID)로 노드의 속성을 읽는다 — 속성 순서: text · resource-id · class · package · content-desc · checkable · … · enabled · … · bounds */
function nodeOf(xml, id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = xml.match(new RegExp(`<node [^>]*?resource-id="${escaped}"[^>]*?>`));
  if (!m) return null;
  const attr = (name) => m[0].match(new RegExp(` ${name}="([^"]*)"`))?.[1] ?? null;
  const bounds = m[0].match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)?.slice(1).map(Number) ?? null;
  return { text: attr("text"), desc: attr("content-desc"), enabled: attr("enabled") === "true", bounds };
}
const has = (xml, id) => nodeOf(xml, id) !== null;
const tapAt = (b) => adb(["shell", "input", "tap", String((b[0] + b[2]) >> 1), String((b[1] + b[3]) >> 1)]);
function tapId(xml, id) {
  const n = nodeOf(xml, id);
  if (n?.bounds) tapAt(n.bounds);
  return Boolean(n?.bounds);
}
const tapText = (xml, text) => {
  const b = boundsOf(xml, "text", text);
  if (b) tapAt(b);
  return Boolean(b);
};
/** 조건이 맞는 화면 덤프가 나올 때까지 기다린다 */
async function until(test, timeoutMs = 20_000, everyMs = 1200) {
  const end = Date.now() + timeoutMs;
  let xml = "";
  while (Date.now() < end) {
    xml = dumpUi();
    if (test(xml)) return { ok: true, xml };
    await wait(everyMs);
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
/** 딥링크로 화면을 연다 (offlo://more · offlo://notifications …) */
async function openRoute(route, settleMs = 2500) {
  adb(["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", `offlo://${route}`, "-p", PACKAGE]);
  await wait(settleMs);
}
const shot = (name) => {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, name), adb(["exec-out", "screencap", "-p"], { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 }).stdout);
};
/** 화면 아래로 스크롤 (손가락을 위로) */
const scrollDown = (amount = 900) => adb(["shell", "input", "swipe", "540", "1900", "540", String(1900 - amount), "350"]);

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

/** 알림 화면의 머리글 눈썹에서 안 읽은 수를 읽는다 — null: 아직 불러오는 중 · -1: 알 수 없음 */
function eyebrowOf(xml) {
  const m = xml.match(/text="(읽지 않은 알림 (\d+)개|모두 읽었어요|새 소식이 없어요|불러오는 중)"/);
  if (!m) return { raw: null, unread: -1 };
  if (m[2]) return { raw: m[1], unread: Number(m[2]) };
  if (m[1] === "불러오는 중") return { raw: m[1], unread: null };
  return { raw: m[1], unread: 0 };
}
/** 화면에 보이는 알림 줄 — id와 "읽지 않음" 여부 (제목 · 본문은 읽지 않는다) */
function visibleRows(xml) {
  const rows = new Map();
  for (const m of xml.matchAll(/<node [^>]*?resource-id="notification-(?!dot-)([^"]+)"[^>]*?>/g)) {
    const desc = m[0].match(/ content-desc="([^"]*)"/)?.[1] ?? "";
    rows.set(m[1], desc.startsWith("읽지 않음."));
  }
  return rows;
}
/** 어떤 노드(testID) 영역 안에 있는 글자 — 배지 숫자는 배지 View가 아니라 그 안의 Text에 있다 (그 Text에는 resource-id가 없다) */
function textInside(xml, id, label) {
  const box = nodeOf(xml, id)?.bounds;
  if (!box || !label) return null;
  for (const m of xml.matchAll(/<node [^>]*?text="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)) {
    if (m[1] !== label) continue;
    const [x1, y1, x2, y2] = m.slice(2).map(Number);
    if (x1 >= box[0] && x2 <= box[2] && y1 >= box[1] && y2 <= box[3]) return m[1];
  }
  return null;
}
/** 더보기 탭 배지 — `tab-more` 영역 안에 있는 글자 */
const tabBadge = (xml, label) => textInside(xml, "tab-more", label);
/** 종 배지 — 숫자 글자가 종 영역 안에 있는가 */
const bellBadge = (xml, label) => (has(xml, "notification-bell-badge") ? textInside(xml, "notification-bell", label) : null);
const badgeLabel = (n) => (n <= 0 ? "" : n > 9 ? "9+" : String(n));

try {
  check(await launchApp(), "번들 로드 (dev build)");
  const tabs = await until((x) => TABS.every((t) => x.includes(t)), 30_000);
  if (!tabs.ok && tabs.xml.includes(TEXT_LOGIN)) {
    check(false, "로그인 상태", "먼저 앱에서 Google로 로그인한 뒤 다시 실행하세요");
    throw new Error("not signed in");
  }
  check(tabs.ok, "하단 탭 5개");

  /* ── 1 · 2. 홈의 종 — 구독이 열려 숫자가 정해질 때까지 ──────── */
  await wait(4000); // 로그인 직후 구독이 첫 스냅숏을 받을 시간
  const home = await until((x) => has(x, "notification-bell"), 20_000);
  check(home.ok, "홈 헤더에 알림 종이 있다");
  const bellDesc = nodeOf(home.xml, "notification-bell")?.desc ?? "";
  const bellUnread = Number(bellDesc.match(/읽지 않은 알림 (\d+)개/)?.[1] ?? 0);
  console.log(`  · 이 계정의 안 읽은 알림(종 기준): ${bellUnread}개`);
  check(bellDesc === "알림" || /^알림, 읽지 않은 알림 \d+개$/.test(bellDesc), "종의 접근성 라벨 모양", bellDesc.replace(/\d+/, "N"));
  const bellBox = nodeOf(home.xml, "notification-bell")?.bounds ?? [0, 0, 0, 0];
  check(bellBox[2] - bellBox[0] >= 100 && bellBox[3] - bellBox[1] >= 100, "종의 터치 영역이 충분하다 (44dp ≈ 100px 이상)", `${bellBox[2] - bellBox[0]}×${bellBox[3] - bellBox[1]}px`);
  if (bellUnread > 0) check(bellBadge(home.xml, badgeLabel(bellUnread)) === badgeLabel(bellUnread), `종 배지 \"${badgeLabel(bellUnread)}\"`);
  else check(!has(home.xml, "notification-bell-badge"), "안 읽은 알림이 없으면 종에 배지가 없다");
  shot("M8-android-home.png");

  /* ── 더보기: 알림 줄 · 탭 배지 ───────────────────────────── */
  await openRoute("more");
  const more = await until((x) => has(x, "menu-notifications"), 20_000);
  check(more.ok, "더보기에 \"알림\" 줄이 있다");
  const menuCount = Number(nodeOf(more.xml, "menu-notifications-count")?.text ?? 0);
  check(menuCount === bellUnread, "더보기 \"알림\" 줄 숫자 = 홈 종 숫자 (한 번 구독을 나눠 쓴다)", `${menuCount} / ${bellUnread}`);
  const badge = tabBadge(more.xml, badgeLabel(bellUnread));
  if (bellUnread > 0) check(badge === badgeLabel(bellUnread), `더보기 탭 배지 \"${badgeLabel(bellUnread)}\"`, String(badge));
  else check(tabBadge(more.xml, "0") === null, "안 읽은 알림이 없으면 더보기 탭에 배지가 없다");
  shot("M8-android-more.png");

  /* ── 3. 알림 화면 ────────────────────────────────────────── */
  tapId(more.xml, "menu-notifications");
  const screen = await until((x) => has(x, "notifications-list") || has(x, "notifications-empty") || has(x, "notifications-error"), 25_000);
  check(!has(screen.xml, "notifications-error"), "실서버 구독이 열린다 — 권한 오류 · 네트워크 오류 없음", has(screen.xml, "notifications-error") ? "오류 안내가 떠 있다 (Firestore 규칙 · 네트워크 확인)" : "");
  check(has(screen.xml, "notifications-list") || has(screen.xml, "notifications-empty"), "더보기 → 알림 화면이 열리고 목록(또는 빈 상태)이 뜬다");
  const eyebrow = eyebrowOf(screen.xml);
  check(eyebrow.unread === bellUnread, "머리글 숫자 = 종 숫자", `${eyebrow.raw} / ${bellUnread}`);
  const readAll = nodeOf(screen.xml, "notifications-read-all");
  check(readAll !== null && readAll.enabled === (bellUnread > 0), "\"모두 읽음\" 버튼은 안 읽은 알림이 있을 때만 열려 있다 (누르지는 않는다)", `enabled=${readAll?.enabled}`);

  if (has(screen.xml, "notifications-list")) {
    // 스크롤하며 줄을 모은다 (보이는 줄만 덤프에 나온다)
    const seen = new Map();
    let xml = screen.xml;
    let still = 0;
    for (let i = 0; i < 10 && still < 2; i++) {
      const before = seen.size;
      for (const [id, unread] of visibleRows(xml)) seen.set(id, unread);
      still = seen.size === before ? still + 1 : 0;
      scrollDown(900);
      await wait(700);
      xml = dumpUi();
    }
    const total = seen.size;
    const unreadRows = [...seen.values()].filter(Boolean).length;
    console.log(`  · 알림 줄 ${total}개 (안 읽음 ${unreadRows}개)`);
    check(total >= 1 && total <= 50, "알림 줄 수가 1~50개 (최근 50건 상한)", String(total));
    check(unreadRows === bellUnread, "안 읽은 줄(접근성 라벨 \"읽지 않음.\") 수 = 머리글 숫자", `${unreadRows} / ${bellUnread}`);
    shot("M8-android-notifications.png");
  } else {
    check(has(screen.xml, "notifications-empty") && bellUnread === 0, "알림이 없는 계정 — 빈 상태 안내 · 안 읽음 0");
    shot("M8-android-notifications-empty.png");
  }

  // 화면을 열고 둘러보기만 했으니 읽음이 바뀌었으면 안 된다
  await openRoute("more");
  const after = await until((x) => has(x, "menu-notifications"), 20_000);
  const menuAfter = Number(nodeOf(after.xml, "menu-notifications-count")?.text ?? 0);
  check(menuAfter === menuCount, "알림 화면을 열어 보기만 해서는 안 읽은 수가 변하지 않는다", `${menuCount} → ${menuAfter}`);

  // 앱을 껐다 켜도 구독이 다시 열려 같은 숫자가 나온다
  check(await launchApp(), "앱을 껐다 켠다");
  await until((x) => TABS.every((t) => x.includes(t)), 30_000);
  await wait(4000);
  const reopened = await until((x) => has(x, "notification-bell"), 20_000);
  const bellAgain = Number((nodeOf(reopened.xml, "notification-bell")?.desc ?? "").match(/읽지 않은 알림 (\d+)개/)?.[1] ?? 0);
  check(reopened.ok && bellAgain === bellUnread, "앱을 다시 켜도 구독이 다시 열려 같은 숫자가 나온다", `${bellAgain} / ${bellUnread}`);

  /* ── 3b. 네이티브 미리보기 — 실계정에 알림이 없어도 목록 · 읽음 · 종 배지를 기기에서 본다 (가짜 서버 · 실계정을 건드리지 않는다) ── */
  await openRoute("preview/notifications?state=ready");
  const pv = await until((x) => has(x, "notification-n1"), 25_000);
  check(pv.ok && eyebrowOf(pv.xml).unread === 3, "미리보기(네이티브) — 머리글 \"읽지 않은 알림 3개\"", eyebrowOf(pv.xml).raw ?? "");
  const pvRows = visibleRows(pv.xml);
  check(pvRows.get("n1") === true && pvRows.get("n2") === true && pvRows.get("n3") === true && pvRows.get("n4") === false, "미리보기 — 안 읽은 줄(n1~n3)만 \"읽지 않음.\" 라벨");
  shot("M8-android-preview.png");
  tapId(pv.xml, "notification-n1");
  const pvRead = await until((x) => eyebrowOf(x).unread === 2, 8000);
  check(pvRead.ok && visibleRows(pvRead.xml).get("n1") === false, "미리보기 — 줄을 누르면 곧바로 읽음으로 바뀐다 (3 → 2 · 낙관적 · 가짜 서버)", eyebrowOf(pvRead.xml).raw ?? "");
  await wait(1500); // 가짜 서버가 확인해 준 뒤에도 그대로여야 한다
  check(eyebrowOf(dumpUi()).unread === 2, "미리보기 — 서버 확인 뒤에도 2개 그대로 (옛 스냅숏이 되돌리지 않는다)");
  await openRoute("preview/dashboard?state=ready%26unread=3");
  const pvHome = await until((x) => has(x, "notification-bell"), 25_000);
  check(pvHome.ok && bellBadge(pvHome.xml, "3") === "3" && nodeOf(pvHome.xml, "notification-bell")?.desc === "알림, 읽지 않은 알림 3개", "미리보기 — 홈 헤더 종에 배지 3 · 접근성 라벨");
  shot("M8-android-preview-home.png");
  await openRoute("preview/dashboard?state=ready%26unread=12");
  const pvMany = await until((x) => has(x, "notification-bell-badge"), 25_000);
  check(pvMany.ok && bellBadge(pvMany.xml, "9+") === "9+" && nodeOf(pvMany.xml, "notification-bell")?.desc === "알림, 읽지 않은 알림 12개", "미리보기 — 12개면 배지 \"9+\" (접근성 라벨은 실제 수 12)");

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
  console.error(`\nM8 안드로이드 검증 실패 ${failures.length}건: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nM8 안드로이드 검증을 통과했습니다.");
