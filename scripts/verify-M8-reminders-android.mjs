/**
 * M8 검증 ② — 로컬 예약 알림 (안드로이드 dev build + adb · 실계정 · 실제 알림 권한 · 실제 예약 · 실제로 울림)
 *
 *   emulator -avd Medium_Phone
 *   (앱에서 Google로 로그인해 둔 상태 · 개발 빌드에 expo-notifications가 들어 있어야 한다 — npm run android:build)
 *   node scripts/verify-M8-reminders-android.mjs
 *
 * **이 스크립트가 바꾸는 것은 이 기기 안의 일뿐이다** — 알림 권한을 껐다 켜고(`pm revoke`), 설정 스위치를 켜고 끄고, 기기에 알림을 예약하고 지운다. 서버에는 쓰지 않는다
 * (분석 목록 · 목표 · 정원 문서를 읽기만 한다). 끝나면 스위치는 모두 꺼 두고 예약도 비운다. 알림 제목 · 본문의 개인 정보는 출력하지 않는다.
 * 예약 목록은 앱 안에서 `expo-notifications`를 직접 불러 읽는다 (Metro 인스펙터 CDP — 토큰은 앱 밖으로 나오지 않는다. 함정: 127.0.0.1로 붙고 · Origin 헤더 필수 · perMessageDeflate 끔).
 *
 * 확인 항목
 *   0. 공유 코드 드리프트 · 기기 · 번들 로드 · 매니페스트 권한(알림 · 부팅 후 재예약만 — 정확한 알람 권한은 쓰지 않는다)
 *   1. 설정 → 리마인더 카드 — 스위치 셋 · 처음엔 꺼짐 · 열기만 해서는 권한 창이 뜨지 않는다
 *   2. 권한 — 거절하면 안 켜지고 안내 · (다시 물을 수 있는 동안) 다시 켜 보면 또 묻고 · 기기 설정을 열 수 있고 · 기기 설정에서 허용하고 돌아오면 안내가 사라진다
 *   3. 켜기 — 허용하면 켜지고(권한 창은 한 번) · 알림 채널("리마인더")이 생기고 · 실계정 자료로 계획한 예약이 기기에 들어간다 (저녁 3번 KST 21시 · 배고픔 · 목표 D-1은 KST 10시 · 링크는 아는 경로만)
 *   4. 끄기 — 한 종류만 끄면 그 종류만 사라지고 · 모두 끄면 예약이 비워진다
 *   5. 실제로 울린다 — 앱을 뒤로 보내고 예약한 알림이 도착하고 · 알림을 누르면 가리키는 화면(목표)으로 간다
 *   6. 알림 화면의 "리마인더 알림 설정" 줄 → 설정
 *   7. 앱 생존 · JS 에러 · 네이티브 크래시 0
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const WebSocket = require("ws");

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, ".verify");
const PORT = 8081;
const PACKAGE = "com.daygoproject.offlo";
const PERMISSION = "android.permission.POST_NOTIFICATIONS";
const DEV_CLIENT_URL = `exp+offlo-app://expo-development-client/?url=${encodeURIComponent(`http://127.0.0.1:${PORT}`)}`;
const ADB = process.env.ANDROID_HOME
  ? join(process.env.ANDROID_HOME, "platform-tools", "adb")
  : join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk", "platform-tools", "adb.exe");

const TABS = ["홈", "분석", "정원", "커뮤니티", "더보기"];
const TEXT_LOGIN = "Google로 계속하기";
const KINDS = ["evening", "hungry", "goal"];
const ALLOWED_LINKS = ["/analysis", "/goals"];
const KST_MS = 9 * 60 * 60 * 1000;

const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};
const adb = (args, opts = {}) => spawnSync(ADB, args, { encoding: "utf8", ...opts });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function dumpUi() {
  // 덤프가 "idle state를 못 얻어" 실패하면 파일이 안 바뀌어 옛 화면이 읽힌다 — 먼저 지워 실패를 빈 글자로 드러낸다
  adb(["shell", "rm", "-f", "/sdcard/offlo-ui.xml"]);
  adb(["shell", "uiautomator", "dump", "/sdcard/offlo-ui.xml"]);
  return adb(["exec-out", "cat", "/sdcard/offlo-ui.xml"]).stdout ?? "";
}
function boundsOf(xml, attr, value) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = xml.match(new RegExp(`${attr}="${escaped}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`));
  return m ? m.slice(1).map(Number) : null;
}
/** resource-id(= testID)로 노드의 속성을 읽는다 */
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
const scrollDown = (amount = 900) => adb(["shell", "input", "swipe", "540", "1900", "540", String(1900 - amount), "350"]);

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
async function openRoute(route, settleMs = 2500) {
  adb(["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", `offlo://${route}`, "-p", PACKAGE]);
  await wait(settleMs);
}

/* ── CDP — 앱 안에서 모듈을 직접 부른다 ───────────────────────
 * RN의 Promise는 폴리필이라 CDP `awaitPromise`가 풀지 못한다 — 비동기 결과를 전역(`__cdp`)에 쌓고 폴링한다. */
function openSession(url) {
  return new Promise((resolveSession, reject) => {
    const ws = new WebSocket(url, { headers: { Origin: `http://127.0.0.1:${PORT}` }, perMessageDeflate: false });
    // 앱이 다시 떠서 죽은 대상이 목록에 남아 있으면 연결이 영영 안 된다 — 시간을 두고 다음 대상으로 넘어간다
    const connectTimer = setTimeout(() => {
      ws.terminate();
      reject(new Error("CDP 연결 시간 초과"));
    }, 6000);
    let seq = 0;
    const waiting = new Map();
    ws.on("message", (data) => {
      const msg = JSON.parse(String(data));
      const done = waiting.get(msg.id);
      if (done) {
        waiting.delete(msg.id);
        done(msg);
      }
    });
    ws.on("error", (e) => {
      clearTimeout(connectTimer);
      reject(e);
    });
    ws.on("open", () => {
      clearTimeout(connectTimer);
      resolveSession({
        evaluate: (expression) =>
          new Promise((resolveEval) => {
            const id = ++seq;
            const timer = setTimeout(() => {
              waiting.delete(id);
              resolveEval({ timeout: true });
            }, 10_000);
            waiting.set(id, (msg) => {
              clearTimeout(timer);
              resolveEval(msg);
            });
            ws.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression, returnByValue: true } }));
          }),
        close: () => ws.close(),
      });
    });
  });
}
/** 번들 안의 모듈을 경로 끝으로 찾는 도우미 — 본문은 `get(경로끝)`으로 모듈을 얻는다 */
const PRELUDE = `
  const mods = __r.getModules();
  const entries = mods instanceof Map ? [...mods.entries()] : Object.entries(mods);
  const get = (suffix) => {
    for (const [id, mod] of entries) {
      if (mod && typeof mod.verboseName === "string" && mod.verboseName.split("\\\\").join("/").endsWith(suffix)) return __r(typeof id === "string" ? Number(id) : id);
    }
    throw new Error("모듈을 못 찾았다: " + suffix);
  };
`;
async function cdp(body, timeoutMs = 30_000) {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  for (const t of targets) {
    if (!t.webSocketDebuggerUrl) continue;
    let session;
    try {
      session = await openSession(t.webSocketDebuggerUrl);
    } catch {
      continue; // 죽은 대상 — 다음으로
    }
    try {
      const probe = await session.evaluate(`typeof __r === "function"`);
      if (probe.result?.result?.value !== true) continue;
      if (probe.timeout) continue;
      const start = `globalThis.__cdp = { done: false }; (async () => { try { const value = await (async () => { ${PRELUDE} ${body} })(); globalThis.__cdp = { done: true, value }; } catch (e) { globalThis.__cdp = { done: true, error: String((e && e.stack) || e) }; } })(); true`;
      const started = await session.evaluate(start);
      if (started.result?.exceptionDetails) throw new Error("CDP 시작 실패");
      const end = Date.now() + timeoutMs;
      while (Date.now() < end) {
        await wait(300);
        const polled = (await session.evaluate("globalThis.__cdp")).result?.result?.value;
        if (polled?.done) {
          if (polled.error) throw new Error(polled.error.split("\n")[0]);
          return polled.value;
        }
      }
      throw new Error("CDP 시간 초과");
    } finally {
      session.close();
    }
  }
  throw new Error("연결할 인스펙터 대상이 없습니다");
}
const NOTIFICATIONS = 'node_modules/expo-notifications/build/index.js';
const scheduled = async () => {
  const list = await cdp(`
    const N = get(${JSON.stringify(NOTIFICATIONS)});
    const all = await N.getAllScheduledNotificationsAsync();
    return all.map((n) => ({ id: n.identifier, title: n.content.title, link: n.content.data && n.content.data.link, trigger: n.trigger }));
  `);
  return list
    .filter((n) => /^offlo-(evening|hungry|goal)-/.test(n.id))
    .map((n) => {
      const raw = n.trigger?.value ?? n.trigger?.date ?? n.trigger?.dateMs;
      const ms = typeof raw === "number" ? (raw < 1e12 ? raw * 1000 : raw) : Date.parse(raw);
      return { ...n, kind: n.id.split("-")[1], ms };
    });
};
const kstHour = (ms) => new Date(ms + KST_MS).getUTCHours();
const kstDay = (ms) => Math.floor((ms + KST_MS) / 86_400_000);

/* ── 시스템 권한 창 ─────────────────────────────────────────── */
const tapDialog = (xml, button) => {
  const id = button === "allow" ? "com.android.permissioncontroller:id/permission_allow_button" : "com.android.permissioncontroller:id/permission_deny_button";
  return tapId(xml, id);
};
/** 시스템 권한 창이 앞에 떠 있는가 — 창이 떠 있는 동안 uiautomator 덤프가 실패하는 때가 있어 화면 구성 대신 최상위 액티비티로 본다 */
const dialogOpen = () => /topResumedActivity=.*GrantPermissionsActivity/.test(adb(["shell", "dumpsys", "activity", "activities"], { maxBuffer: 32 * 1024 * 1024 }).stdout ?? "");
/** 1080×2400 화면에서 시스템 권한 창의 버튼 위치 (덤프가 실패할 때의 대비) */
const DIALOG_BUTTON_FALLBACK = { allow: [540, 1280], deny: [540, 1438] };
/** 권한 창이 뜰 때까지 기다렸다가(안 뜨면 shown=false) 안정된 뒤 버튼을 누르고, 창이 닫힐 때까지 기다린다 — 창 애니메이션 중에 읽은 좌표로 누르면 빗나간다 */
async function answerDialog(button, timeoutMs = 8000) {
  const end = Date.now() + timeoutMs;
  let shown = false;
  while (Date.now() < end && !(shown = dialogOpen())) await wait(500);
  if (!shown) return { shown: false, closed: true };
  await wait(900);
  const xml = dumpUi();
  if (!tapDialog(xml, button)) adb(["shell", "input", "tap", ...DIALOG_BUTTON_FALLBACK[button].map(String)]);
  const closeBy = Date.now() + 8000;
  while (Date.now() < closeBy && dialogOpen()) await wait(500);
  await wait(900);
  return { shown: true, closed: !dialogOpen() };
}
const permissionGranted = () => new RegExp(`${PERMISSION.replace(/\./g, "\\.")}: granted=true`).test(adb(["shell", "dumpsys", "package", PACKAGE], { maxBuffer: 32 * 1024 * 1024 }).stdout ?? "");

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

/** 설정 화면을 열고 리마인더 카드의 스위치가 보일 때까지 스크롤한다 */
async function openRemindersCard() {
  await openRoute("settings", 3000);
  let xml = dumpUi();
  for (let i = 0; i < 6 && !has(xml, "reminder-switch-evening"); i++) {
    scrollDown(700);
    await wait(700);
    xml = dumpUi();
  }
  return xml;
}
const switchState = (xml) => Object.fromEntries(KINDS.map((k) => [k, nodeOf(xml, `reminder-switch-${k}`)?.checked ?? null]));
const scrollUp = (amount = 500) => adb(["shell", "input", "swipe", "540", "700", "540", String(700 + amount), "350"]);
/** 화면 안(상단 도구 · 하단 제스처 막대 밖)에 들어오도록 스크롤해서 누른다 — 카드 아래쪽 버튼은 화면 가장자리에 걸쳐 있다 */
async function tapVisible(id) {
  let xml = dumpUi();
  for (let i = 0; i < 6; i++) {
    const b = nodeOf(xml, id)?.bounds;
    if (b && b[3] < 2150 && b[1] > 320) {
      tapAt(b);
      return true;
    }
    if (b && b[1] <= 320) scrollUp(500);
    else scrollDown(500);
    await wait(700);
    xml = dumpUi();
  }
  return false;
}
async function tapSwitch(kind, settleMs = 1500) {
  const ok = await tapVisible(`reminder-switch-${kind}`);
  await wait(settleMs);
  return ok;
}
/** 시스템 입장에서 "한 번도 안 물어봤고 꺼진" 상태로 되돌린다 — 이 앱의 알림 권한 플래그만 (다른 앱 · 설정은 건드리지 않는다) */
function resetPermissionState() {
  adb(["shell", "pm", "clear-permission-flags", PACKAGE, PERMISSION, "user-set", "user-fixed"]);
  adb(["shell", "pm", "revoke", PACKAGE, PERMISSION]);
  // revoke가 USER_SET을 다시 켜므로 한 번 더 지운다
  adb(["shell", "pm", "clear-permission-flags", PACKAGE, PERMISSION, "user-set", "user-fixed"]);
}
const permissionFlags = () => {
  const dump = adb(["shell", "dumpsys", "package", PACKAGE], { maxBuffer: 32 * 1024 * 1024 }).stdout ?? "";
  const line = dump.split("\n").find((l) => l.includes(`${PERMISSION}: granted=`)) ?? "";
  return line.trim();
};

try {
  check(await launchApp(), "번들 로드 (dev build)");
  const tabs = await until((x) => TABS.every((t) => x.includes(t)), 30_000);
  if (!tabs.ok && tabs.xml.includes(TEXT_LOGIN)) {
    check(false, "로그인 상태", "먼저 앱에서 Google로 로그인한 뒤 다시 실행하세요");
    throw new Error("not signed in");
  }
  check(tabs.ok, "하단 탭 5개");

  /* 매니페스트 권한 — 알림 · 부팅 후 재예약만. 정확한 알람 권한은 쓰지 않는다 */
  const pkgDump = adb(["shell", "dumpsys", "package", PACKAGE], { maxBuffer: 32 * 1024 * 1024 }).stdout ?? "";
  const requested = [...pkgDump.matchAll(/^\s+(android\.permission\.[A-Z_]+|com\.[\w.]+\.permission\.[A-Z_]+)(?::|$)/gm)].map((m) => m[1]);
  const requestedSet = new Set(requested);
  check(requestedSet.has(PERMISSION) && requestedSet.has("android.permission.RECEIVE_BOOT_COMPLETED"), "매니페스트 — 알림(POST_NOTIFICATIONS) · 부팅 후 재예약(RECEIVE_BOOT_COMPLETED) 권한이 있다");
  check(!requestedSet.has("android.permission.SCHEDULE_EXACT_ALARM") && !requestedSet.has("android.permission.USE_EXACT_ALARM"), "매니페스트 — 정확한 알람 권한은 요청하지 않는다 (스토어 심사 · 불필요한 권한 없음)");
  const unexpected = [...requestedSet].filter((p) => /CAMERA|RECORD_AUDIO|LOCATION|CONTACTS|READ_PHONE|SMS|CALL_LOG|BLUETOOTH|READ_EXTERNAL|WRITE_EXTERNAL/.test(p));
  check(unexpected.length === 0, "매니페스트 — 쓰지 않는 위험 권한(카메라 · 마이크 · 위치 · 연락처 …)이 없다", unexpected.join(","));
  const badgePerms = [...requestedSet].filter((p) => /badge|launcher\.permission|home\.permission/i.test(p));
  check(badgePerms.length === 0, "매니페스트 — 쓰지 않는 launcher 배지 권한이 없다 (expo-notifications가 끌고 오는 것을 app.json blockedPermissions로 막았다)", badgePerms.slice(0, 3).join(","));

  /* ── 1 · 2. 권한 — 거절 · 다시 켜 보기 · 기기 설정 ─────────── */
  resetPermissionState(); // 시스템 입장에서 "한 번도 안 물어본" 상태 (앱이 죽는다)
  await wait(1500);
  check(!permissionGranted(), "시험 시작 — 알림 권한을 껐고 시스템 플래그를 비웠다 (이 앱의 알림 권한만)", permissionFlags());
  check(await launchApp(), "앱 다시 실행");
  await until((x) => TABS.every((t) => x.includes(t)), 30_000);

  let card = await openRemindersCard();
  check(KINDS.every((k) => has(card, `reminder-switch-${k}`)), "설정 → 리마인더 카드에 스위치 셋이 있다");
  // 이전 시험이 남긴 켜진 스위치가 있으면 끈다 (끄는 데는 권한이 필요 없다)
  for (const kind of KINDS) {
    if (switchState(card)[kind]) {
      await tapSwitch(kind, 1200);
      card = dumpUi();
    }
  }
  const initial = switchState(card);
  check(KINDS.every((k) => initial[k] === false), "스위치는 처음엔 모두 꺼져 있다", JSON.stringify(initial));
  check(!dialogOpen(), "카드를 열기만 해서는 권한 창이 뜨지 않는다");
  shot("M8-android-reminders.png");

  // 1차 거절
  await tapSwitch("evening", 800);
  const first = await answerDialog("deny");
  check(first.shown && first.closed, "스위치를 켜면 그때 시스템 알림 권한 창이 뜬다 (거절을 눌렀다)");
  let denied = await until((x) => has(x, "reminders-denied"), 8000);
  check(denied.ok && switchState(denied.xml).evening === false, "거절하면 스위치는 꺼진 채 · 기기 알림이 꺼져 있다는 안내가 뜬다");
  check(has(denied.xml, "reminders-open-settings"), "안내에 \"기기 설정 열기\" 버튼이 있다");
  shot("M8-android-reminders-denied.png");

  // 2차 — 시스템은 두 번째까지 창을 띄운다
  await tapSwitch("evening", 800);
  const second = await answerDialog("deny");
  check(second.shown && second.closed, "거절한 뒤 다시 켜 보면 시스템이 창을 또 띄운다 (앱은 허용 전이면 늘 요청한다)");
  check(permissionFlags().includes("USER_FIXED"), "두 번 거절하면 시스템이 영구 거절로 기록한다 (USER_FIXED)", permissionFlags());
  // 3차 — 시스템이 더는 창을 못 띄운다: 앱은 그래도 요청하고, 창 없이 곧바로 거절이 돌아와 같은 안내가 남는다
  await tapSwitch("evening", 3000);
  const thirdShowsDialog = dialogOpen();
  if (thirdShowsDialog) await answerDialog("deny");
  check(!thirdShowsDialog, "영구 거절 뒤에는 시스템 권한 창이 더 뜨지 않는다 (기기 설정에서 직접 켜야 한다)");
  denied = await until((x) => has(x, "reminders-denied"), 6000);
  check(denied.ok && switchState(denied.xml).evening === false && has(denied.xml, "reminders-open-settings"), "그래도 스위치는 꺼진 채 · 안내 + 기기 설정 버튼이 남는다 (앱이 멈추거나 창이 뜨지 않는다)");

  // 기기 설정 열기 → 시스템 설정 앱이 열린다 → 사용자가 허용한 것처럼 권한을 주고 돌아온다
  check(await tapVisible("reminders-open-settings"), "화면 아래 \"기기 설정 열기\" 버튼을 누를 수 있다");
  await wait(2500);
  const sys = dumpUi();
  check(sys.includes('package="com.android.settings"') || /App info|앱 정보|Notifications/.test(sys), "\"기기 설정 열기\" → 시스템 설정(앱 정보)이 열린다");
  shot("M8-android-reminders-system-settings.png");
  adb(["shell", "pm", "grant", PACKAGE, PERMISSION]); // 사용자가 기기 설정에서 허용한 것과 같다
  await wait(800);
  adb(["shell", "input", "keyevent", "KEYCODE_BACK"]);
  await wait(2500);
  // 앞으로 돌아온 뒤 권한을 다시 읽어 안내가 사라져야 한다
  const cleared = await until((x) => !has(x, "reminders-denied") && has(x, "reminder-switch-evening"), 12_000);
  check(permissionGranted() && cleared.ok, "기기 설정에서 허용하고 돌아오면 안내가 사라진다 (앞으로 돌아올 때 권한을 다시 읽는다)");

  /* ── 3. 켜기 — 예약 목록 (실계정 자료로 계획한 결과) ──────── */
  resetPermissionState();
  await wait(1500);
  check(await launchApp(), "앱 다시 실행 (권한을 다시 껐다)");
  await until((x) => TABS.every((t) => x.includes(t)), 30_000);
  card = await openRemindersCard();
  await tapSwitch("evening", 800);
  const allow = await answerDialog("allow");
  check(allow.shown && allow.closed, "다시 켜면 권한 창이 뜬다 (허용을 눌렀다)");
  const on1 = await until((x) => nodeOf(x, "reminder-switch-evening")?.checked === true, 10_000);
  check(on1.ok && permissionGranted() && !has(on1.xml, "reminders-denied"), "허용하면 스위치가 켜지고 안내는 없다");
  await tapSwitch("hungry", 1500);
  check(!dialogOpen(), "이미 허용했으니 다른 스위치를 켜도 권한 창이 또 뜨지 않는다");
  await tapSwitch("goal", 1500);
  const on3 = await until((x) => KINDS.every((k) => nodeOf(x, `reminder-switch-${k}`)?.checked === true), 8000);
  check(on3.ok, "저녁 · 배고픔 · 목표 셋 다 켜진다");
  shot("M8-android-reminders-on.png");
  await wait(6000); // 서버에서 자료를 읽고 계획해 예약하는 시간

  const channels = await cdp(`const N = get(${JSON.stringify(NOTIFICATIONS)}); return (await N.getNotificationChannelsAsync()).map((c) => ({ id: c.id, name: c.name, importance: c.importance }));`);
  const reminderChannel = channels.find((c) => c.id === "reminders");
  check(Boolean(reminderChannel) && reminderChannel.name === "리마인더", "알림 채널 \"리마인더\"가 만들어졌다", JSON.stringify(reminderChannel ?? channels.map((c) => c.id)));

  let list = await scheduled();
  const by = (kind) => list.filter((n) => n.kind === kind);
  console.log(`  · 예약 ${list.length}개 (저녁 ${by("evening").length} · 배고픔 ${by("hungry").length} · 목표 ${by("goal").length})`);
  check(by("evening").length === 3, "저녁 리마인더 — 앞으로 울릴 3번이 예약됐다", String(by("evening").length));
  check(by("evening").every((n) => kstHour(n.ms) === 21), "저녁 — 모두 KST 21시다 (기기 시간대와 무관)", by("evening").map((n) => kstHour(n.ms)).join(","));
  const eveDays = by("evening").map((n) => kstDay(n.ms)).sort((a, b) => a - b);
  check(eveDays.every((d, i) => i === 0 || d === eveDays[i - 1] + 1), "저녁 — 하루씩 이어진 3번이다", eveDays.join(","));
  check(by("hungry").length <= 2 && by("hungry").every((n) => kstHour(n.ms) === 10 && (n.title ?? "").includes("배고파해요")), "배고픔 — 있다면 최대 2번 · KST 10시 · \"배고파해요\" 제목", String(by("hungry").length));
  check(by("goal").length <= 10 && by("goal").every((n) => kstHour(n.ms) === 10 && (n.title ?? "").includes("목표 마감이 하루 남았어요") && n.id.startsWith("offlo-goal-")), "목표 — 있다면 최대 10개 · KST 10시 · 목표 id로 식별", String(by("goal").length));
  check(list.every((n) => n.ms > Date.now()) && list.every((n) => ALLOWED_LINKS.includes(n.link)), "모든 예약이 미래 시각이고 링크는 아는 경로(분석 · 목표)뿐이다", [...new Set(list.map((n) => n.link))].join(","));
  check(new Set(list.map((n) => n.id)).size === list.length, "예약 식별자가 겹치지 않는다");

  // 앱을 다시 열어도(설정 · 권한은 저장돼 있다) 같은 예약이 그대로다 — 갈아 끼워도 개수가 늘지 않는다
  check(await launchApp(), "앱을 껐다 켠다");
  await until((x) => TABS.every((t) => x.includes(t)), 30_000);
  await wait(7000);
  const reopened = await scheduled();
  check(reopened.length === list.length && JSON.stringify(reopened.map((n) => n.id).sort()) === JSON.stringify(list.map((n) => n.id).sort()), "앱을 다시 켜도 예약이 그대로다 (갈아 끼워도 늘거나 줄지 않는다)", `${reopened.length} / ${list.length}`);
  card = await openRemindersCard();
  check(KINDS.every((k) => switchState(card)[k] === true), "켜 둔 설정이 앱을 다시 켜도 남는다 (사용자별 저장)");

  /* 목표가 바뀌면 예약이 따라온다 — 이 계정만 보는 비공개 목표를 하나 만들었다 지운다 (끝나면 처음 상태 · 완료 처리는 하지 않는다 — 식물 경험치 · 배지가 지급된다) */
  const dayMs = 86_400_000;
  const todayKey = new Date(Date.now() + KST_MS).toISOString().slice(0, 10);
  const endKey = new Date(Date.now() + KST_MS + 3 * dayMs).toISOString().slice(0, 10);
  let goalId = null;
  try {
    goalId = await cdp(`
      const { api } = get("src/services/api.ts");
      const made = await api.goals.create({ title: "리마인더 시험 목표", targetMinutes: 60, startDate: ${JSON.stringify(todayKey)}, endDate: ${JSON.stringify(endKey)} });
      get("src/hooks/goals-changed.ts").notifyGoalsChanged();
      return made.goal.id;
    `);
    check(typeof goalId === "string" && goalId.length > 5, "시험용 목표를 만들었다 (이 계정만 보는 비공개 데이터 — 끝나면 지운다)");
    await wait(7000); // 목표가 바뀌었다는 알림 → 다시 계산 → 예약
    const mine = (await scheduled()).find((n) => n.id === `offlo-goal-${goalId}`);
    check(Boolean(mine) && kstHour(mine.ms) === 10 && kstDay(mine.ms) === kstDay(Date.now()) + 2, "목표를 만들자 마감 알림이 예약된다 — 종료일 하루 전(오늘+2일) KST 10시", mine ? `${kstHour(mine.ms)}시 · +${kstDay(mine.ms) - kstDay(Date.now())}일` : "예약 없음");
    check(Boolean(mine) && (mine.title ?? "").includes("목표 마감이 하루 남았어요") && mine.link === "/goals", "마감 알림의 제목 · 눌렀을 때 갈 곳(목표)");
  } finally {
    if (goalId) {
      await cdp(`
        const { api } = get("src/services/api.ts");
        await api.goals.remove(${JSON.stringify(goalId)});
        get("src/hooks/goals-changed.ts").notifyGoalsChanged();
        return true;
      `).catch(() => console.log(`  ! 시험용 목표(${goalId})를 지우지 못했습니다 — 앱의 목표 화면에서 "리마인더 시험 목표"를 지워 주세요`));
      await wait(7000);
      check(!(await scheduled()).some((n) => n.id === `offlo-goal-${goalId}`), "목표를 지우면 그 마감 알림도 예약에서 빠진다 (시험 목표는 지웠다 — 계정은 처음 상태)");
    }
  }

  /* ── 4. 끄기 ─────────────────────────────────────────────── */
  await tapSwitch("evening", 1500);
  await wait(3500);
  list = await scheduled();
  check(list.filter((n) => n.kind === "evening").length === 0 && list.length === reopened.filter((n) => n.kind !== "evening").length, "저녁만 끄면 저녁 예약만 사라지고 나머지는 그대로다", String(list.length));
  await tapSwitch("hungry", 1500);
  await tapSwitch("goal", 1500);
  await wait(3500);
  list = await scheduled();
  check(list.length === 0, "모두 끄면 예약이 모두 비워진다", String(list.length));
  const offState = switchState(dumpUi());
  check(KINDS.every((k) => offState[k] === false), "스위치도 모두 꺼져 있다");

  /* ── 5. 실제로 울린다 — 같은 서비스로 10초 뒤 알림을 예약해 도착 · 탭 이동까지 본다 ── */
  const fired = await cdp(`
    const R = get("src/services/reminders.ts");
    const svc = R.createReminderService("verify");
    await svc.sync(
      { items: [{ id: "offlo-evening-verify", kind: "evening", at: Date.now() + 12000, title: "리마인더 시험 알림", body: "검증용 알림입니다.", link: "/goals" }], complete: ["evening"] },
      { evening: true, hungry: false, goal: false },
    );
    return true;
  `);
  check(fired === true, "같은 서비스로 12초 뒤 울릴 알림을 예약했다");
  const pending = await scheduled();
  check(pending.some((n) => n.id === "offlo-evening-verify"), "예약 목록에 시험 알림이 있다");
  adb(["shell", "input", "keyevent", "KEYCODE_HOME"]); // 앱을 뒤로 보낸다 — 앞에 떠 있으면 알림을 띄우지 않는다
  await wait(16_000);
  adb(["shell", "cmd", "statusbar", "expand-notifications"]);
  await wait(2000);
  const shade = await until((x) => x.includes("리마인더 시험 알림"), 10_000);
  check(shade.ok, "예약한 시각에 알림이 실제로 도착했다 (알림창에 보인다)");
  shot("M8-android-reminders-shade.png");
  if (shade.ok) {
    tapText(shade.xml, "리마인더 시험 알림");
    const opened = await until((x) => x.includes("목표 관리") || has(x, "goal-add") || has(x, "goal-add-empty"), 20_000);
    check(opened.ok, "알림을 누르면 앱이 열려 알림이 가리키는 화면(목표)으로 간다");
    shot("M8-android-reminders-tap.png");
  } else {
    check(false, "알림을 누르면 앱이 열려 알림이 가리키는 화면(목표)으로 간다", "알림이 도착하지 않았다");
  }
  adb(["shell", "cmd", "statusbar", "collapse"]);
  await cdp(`const R = get("src/services/reminders.ts"); await R.createReminderService("verify").cancelAll(); return true;`);
  check((await scheduled()).length === 0, "시험이 끝나 예약을 모두 지웠다");

  /* ── 6. 알림 화면의 설정 줄 ──────────────────────────────── */
  await openRoute("notifications", 3000);
  const inbox = await until((x) => has(x, "notifications-reminders-link"), 20_000);
  check(inbox.ok, "알림 화면에 \"리마인더 알림 설정\" 줄이 있다");
  if (inbox.ok) {
    tapId(inbox.xml, "notifications-reminders-link");
    const toSettings = await until((x) => x.includes("리마인더 알림") || has(x, "settings-reminders") || has(x, "reminder-switch-evening"), 15_000);
    check(toSettings.ok, "그 줄을 누르면 설정(리마인더 카드)으로 간다");
  }

  /* ── 7. 생존 · 에러 ──────────────────────────────────────── */
  check(Boolean((adb(["shell", "pidof", PACKAGE]).stdout ?? "").trim()), "앱 프로세스 생존");
  const errors = (adb(["logcat", "-d", "-s", "AndroidRuntime:E", "ReactNativeJS:E"]).stdout ?? "")
    .split("\n")
    .filter((l) => /FATAL|\bE\b/.test(l));
  check(errors.length === 0, "크래시 · JS 에러 0", errors.slice(0, 3).join(" | ").slice(0, 300));
} catch (e) {
  if (String(e) !== "Error: not signed in") check(false, "검증 중 예외", String(e).split("\n")[0]);
} finally {
  // 흔적을 남기지 않는다 — 시험 알림 · 예약을 지운다 (스위치는 위에서 모두 껐다)
  try {
    await cdp(`const R = get("src/services/reminders.ts"); await R.createReminderService("verify").cancelAll(); return true;`, 8000);
  } catch {
    // 앱이 죽어 있으면 못 지운다 — 다음 실행이 스위치를 끈다
  }
  stopServer();
}

console.log(`\n스크린샷: ${OUT_DIR}`);
if (failures.length) {
  console.error(`\nM8 로컬 알림 안드로이드 검증 실패 ${failures.length}건: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nM8 로컬 알림 안드로이드 검증을 통과했습니다.");
