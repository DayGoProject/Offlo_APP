/**
 * M7 검증 ② — 목표 · 배지 · 커뮤니티 · 설정 실데이터 (안드로이드 dev build + adb · 실계정 · 실서버)
 *
 *   emulator -avd Medium_Phone
 *   (앱에서 Google로 로그인해 둔 상태)
 *   node scripts/verify-M7-android.mjs
 *
 * **이 스크립트가 서버에 쓰는 것은 "이 계정만 보는 비공개 데이터"뿐이다** — 목표를 만들고 · 고치고 · 지운다 (끝나면 처음 상태로 돌아온다).
 * **하지 않는 것**: 커뮤니티 글 · 댓글 · 좋아요 · 배지 자랑하기 (다른 사용자에게 보이는 공개 변경 — 승인 없이 하지 않는다 · 웹 미리보기가 같은 코드를 가짜 서버로 검증한다),
 * 목표 **완료 처리**(식물 경험치 +20분 · 배지가 실제로 지급된다), **회원 탈퇴 · 로그아웃**(계정 · 로그인 상태가 사라진다 — 버튼이 잠겨 있다 풀리는 것까지만 본다).
 *
 * 계정 상태가 무엇이든 통과해야 한다 (목표 · 배지 · 글이 있든 없든). 개인 정보(이름 · 이메일 · 글 내용)는 출력하지 않는다.
 *
 * 확인 항목
 *   0. 공유 코드 드리프트 · 기기 · 번들 로드 · 하단 탭
 *   1. 더보기 메뉴 — 기록 · 목표 · 배지 · 설정이 열린다 (더 이상 "M7에서 열려요"가 아니다)
 *   2. 목표 — 불러오기 · 입력 검증 · 추가(제목 · 빠른 선택 · **달력(모달 위의 모달)**) · 수정 · 삭제 · 서버에 실제로 반영됐는가(앱을 껐다 켜도) · 끝나면 처음 상태
 *   3. 배지 — 획득 + 잠김 = 4 · 잠긴 배지 진행도 · 자랑하기 모달(열고 닫기만)
 *   4. 커뮤니티 — 실서버 피드 · 랭킹 · 글쓰기 입력(키보드 · 글자 수 · 올리지는 않는다) · 댓글 펼치기(읽기만)
 *   5. 설정 — 프로필 · 이름 입력(저장은 누르지 않는다 — 공개 이름이라 공개 변경이다) · 탈퇴 확인 문구
 *   6. 앱 생존 · JS 에러 · 네이티브 크래시 0
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
const keyboardShown = () => /mInputShown=true/.test(adb(["shell", "dumpsys", "input_method"], { maxBuffer: 16 * 1024 * 1024 }).stdout ?? "");
/** 키보드가 떠 있을 때만 뒤로 가기를 보낸다 — 키보드가 없으면 뒤로 가기가 화면(모달)을 닫아 버린다 */
async function hideKeyboard() {
  if (keyboardShown()) {
    adb(["shell", "input", "keyevent", "KEYCODE_BACK"]);
    await wait(700);
  }
}
/** 포커스된 입력칸에 영문을 친다 (adb는 한글을 못 친다) */
async function typeText(text) {
  adb(["shell", "input", "text", text.replace(/ /g, "%s")]);
  await wait(500);
}
/** 포커스된 입력칸을 비운다 — 끝으로 가서 지우기를 여러 번 */
async function clearField(len = 60) {
  adb(["shell", "input", "keyevent", "KEYCODE_MOVE_END"]);
  adb(["shell", "input", "keyevent", ...Array(len).fill("KEYCODE_DEL")]);
  await wait(400);
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
/** 딥링크로 화면을 연다 (offlo://goals · offlo://more · offlo://community …) */
async function openRoute(route, settleMs = 2500) {
  adb(["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", `offlo://${route}`, "-p", PACKAGE]);
  await wait(settleMs);
}
const screencap = () => adb(["exec-out", "screencap", "-p"], { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 }).stdout;
const shot = (name) => {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, name), screencap());
};
/** 화면 아래로 스크롤 (손가락을 위로) */
const scrollDown = (amount = 900) => adb(["shell", "input", "swipe", "540", "1900", "540", String(1900 - amount), "350"]);
const scrollUp = (amount = 900) => adb(["shell", "input", "swipe", "540", String(700), "540", String(700 + amount), "350"]);

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

/** 목표 카드의 id들 — 카드 testID는 `goal-<cuid>`다 (`goal-add` · `goal-form` 같은 다른 id와 겹치지 않게 25자 안팎의 cuid만) */
const goalIds = (xml) => [...xml.matchAll(/resource-id="goal-([a-z0-9]{20,})"/g)].map((m) => m[1]);

try {
  check(await launchApp(), "번들 로드 (dev build)");
  const tabs = await until((x) => TABS.every((t) => x.includes(t)), 30_000);
  if (!tabs.ok && tabs.xml.includes(TEXT_LOGIN)) {
    check(false, "로그인 상태", "먼저 앱에서 Google로 로그인한 뒤 다시 실행하세요");
    throw new Error("not signed in");
  }
  check(tabs.ok, "하단 탭 5개");

  /* ── 1. 더보기 메뉴 ──────────────────────────────────────── */
  await openRoute("more");
  const more = await until((x) => has(x, "more-tab") || has(x, "menu-goals"), 20_000);
  check(has(more.xml, "menu-history") && has(more.xml, "menu-goals") && has(more.xml, "menu-badges") && has(more.xml, "menu-settings"), "더보기 — 기록 · 목표 · 배지 · 설정이 모두 열려 있다");
  check(!more.xml.includes("M7에서 열려요"), "더보기 — \"M7에서 열려요\" 표시가 남아 있지 않다");
  shot("M7-android-more.png");

  /* ── 2. 목표 ─────────────────────────────────────────────── */
  tapId(more.xml, "menu-goals");
  const goals = await until((x) => x.includes("목표 관리") && !x.includes("불러오는 중"), 25_000);
  check(goals.ok && has(goals.xml, "goal-add"), "더보기 → 목표 화면이 열리고 실서버 목록이 뜬다");
  const before = goalIds(goals.xml);
  console.log(`  · 이 계정의 진행 중 목표: ${before.length}개`);
  shot("M7-android-goals.png");

  // 입력 검증 — 제목 없이 추가
  tapId(goals.xml, "goal-add") || tapId(goals.xml, "goal-add-empty");
  const form = await until((x) => has(x, "goal-form"), 10_000);
  check(form.ok, "\"새 목표 추가\" → 폼이 열린다");
  tapId(form.xml, "goal-submit");
  const empty = await until((x) => has(x, "goal-form-error"), 8000);
  check(empty.ok && nodeOf(empty.xml, "goal-form-error")?.text === "제목을 입력해주세요.", "제목이 비면 \"제목을 입력해주세요.\" (서버에 보내지 않는다)");

  // 제목 입력 · 빠른 선택
  tapId(empty.xml, "goal-title");
  await wait(800);
  await typeText("verify goal M7");
  await hideKeyboard();
  let x1 = dumpUi();
  check(nodeOf(x1, "goal-title")?.text === "verify goal M7", "한글이 아닌 입력도 입력칸에 들어간다 (키보드 · 포커스)", nodeOf(x1, "goal-title")?.text ?? "");
  tapId(x1, "goal-preset-90");
  await wait(500);
  x1 = dumpUi();
  check(nodeOf(x1, "goal-minutes")?.text === "90" && nodeOf(x1, "goal-minutes-hint")?.text === "현재 설정: 하루 1시간 30분 이하", "90분 선택 → 입력칸 90 · \"1시간 30분 이하\"");

  // 달력 — 모달 위의 모달
  const endBefore = nodeOf(x1, "goal-end")?.desc ?? "";
  tapId(x1, "goal-end");
  const picker = await until((x) => has(x, "date-picker"), 8000);
  check(picker.ok && has(picker.xml, "date-prev") && has(picker.xml, "date-next"), "종료일 → 달력이 폼 위에 열린다 (모달 위의 모달)");
  shot("M7-android-datepicker.png");
  const monthText = nodeOf(picker.xml, "date-month")?.text ?? "";
  check(/^\d{4}년 \d{1,2}월$/.test(monthText), "달력 — 연 · 월 머리글", monthText);
  const days = [...picker.xml.matchAll(/resource-id="date-(\d{4}-\d{2}-\d{2})"/g)].map((m) => m[1]);
  const enabledDays = days.filter((d) => nodeOf(picker.xml, `date-${d}`)?.enabled);
  // 종료일 달력은 시작일 + 7일이 있는 달로 열린다 — 월말이면 다음 달이라 비활성이 하나도 없다(전부 시작일 뒤). 시작일과 같은 달일 때만 이전 날이 비활성이어야 한다
  const startMonth = `${new Date(Date.now() + 9 * 3600_000).getUTCFullYear()}년 ${new Date(Date.now() + 9 * 3600_000).getUTCMonth() + 1}월`;
  check(days.length >= 28 && enabledDays.length > 0 && (monthText !== startMonth || enabledDays.length < days.length), "달력 — 한 달이 그려지고 시작일 이전(오늘 이전)은 비활성이다 (시작일과 다른 달이면 전부 활성)", `${monthText} · ${days.length}칸 · 활성 ${enabledDays.length}`);
  // 활성인 마지막 날을 고른다 (종료일은 시작일 다음 날부터라 그 달 말일이 가장 안전하다)
  const pick = enabledDays.at(-1);
  tapId(picker.xml, `date-${pick}`);
  const closed = await until((x) => !has(x, "date-picker") && has(x, "goal-form"), 8000);
  const endAfter = nodeOf(closed.xml, "goal-end")?.desc ?? "";
  check(closed.ok && endAfter !== endBefore && endAfter.includes(pick.replace(/-/g, ".")), "날짜를 누르면 달력이 닫히고 종료일이 바뀐다", endAfter);

  // 저장 → 서버에 실제로 생긴다
  tapId(closed.xml, "goal-submit");
  const created = await until((x) => !has(x, "goal-form") && x.includes("verify goal M7"), 25_000);
  check(created.ok, "저장 → 폼이 닫히고 새 목표가 목록에 뜬다 (실서버 POST /api/goals → 다시 읽기)");
  const afterIds = goalIds(created.xml);
  const mine = afterIds.find((id) => nodeOf(created.xml, `goal-title-${id}`)?.text === "verify goal M7");
  check(Boolean(mine) && afterIds.length === before.length + 1, "목록에 하나가 늘었다", `${before.length} → ${afterIds.length}`);
  shot("M7-android-goal-created.png");

  // 앱을 껐다 켜도 남아 있다 = 서버에 저장됐다
  check(await launchApp(), "앱 재시작 (메모리 상태를 버린다)");
  await until((x) => TABS.every((t) => x.includes(t)), 30_000);
  await openRoute("goals");
  const persisted = await until((x) => x.includes("verify goal M7"), 25_000);
  check(persisted.ok, "껐다 켜도 목표가 그대로 — 서버에 저장됐다");

  // 수정
  const goalId = goalIds(persisted.xml).find((id) => nodeOf(persisted.xml, `goal-title-${id}`)?.text === "verify goal M7");
  tapId(persisted.xml, `goal-edit-${goalId}`);
  const editForm = await until((x) => has(x, "goal-form"), 10_000);
  check(editForm.ok && nodeOf(editForm.xml, "goal-title")?.text === "verify goal M7" && nodeOf(editForm.xml, "goal-minutes")?.text === "90", "수정 → 기존 제목 · 시간이 채워져 있다 (서버 값)");
  tapId(editForm.xml, "goal-title");
  await wait(600);
  await clearField(30);
  await typeText("verify goal edited");
  await hideKeyboard();
  const editReady = dumpUi();
  tapId(editReady, "goal-submit");
  const edited = await until((x) => !has(x, "goal-form") && x.includes("verify goal edited"), 25_000);
  check(edited.ok && !edited.xml.includes("verify goal M7"), "수정 저장 → 제목이 바뀐다 (실서버 PATCH → 다시 읽기)");

  // 삭제 — 한 번 더 묻고 지운다
  tapId(edited.xml, `goal-delete-${goalId}`);
  const ask = await until((x) => has(x, `goal-ask-${goalId}`), 8000);
  check(ask.ok && (nodeOf(ask.xml, `goal-ask-${goalId}`)?.text ?? "").length >= 0 && !has(ask.xml, `goal-edit-${goalId}`), "삭제 → 카드 안에서 한 번 더 묻는다 (다른 버튼은 감춘다)");
  tapId(ask.xml, `goal-ask-ok-${goalId}`);
  // 수정이 안 됐다면 "edited" 글자가 처음부터 없어 조건이 곧바로 참이 된다 — 두 제목이 모두 사라지고 개수가 처음으로 돌아올 때까지 기다린다
  const gone = await until((x) => !x.includes("verify goal edited") && !x.includes("verify goal M7") && goalIds(x).length === before.length, 25_000);
  check(gone.ok, "삭제 확인 → 목록이 처음 상태로 돌아온다 (실서버 DELETE)", `${goalIds(gone.xml).length}개`);

  /* ── 3. 배지 ─────────────────────────────────────────────── */
  await openRoute("badges");
  const badges = await until((x) => x.includes("배지") && /\d개 획득 · \d개 남음/.test(x.replace(/&#10;/g, " ")), 25_000);
  const eyebrow = badges.xml.match(/text="(\d)개 획득 · (\d)개 남음"/);
  check(Boolean(eyebrow) && Number(eyebrow[1]) + Number(eyebrow[2]) === 4, "배지 — 획득 + 잠김 = 4 (공유 정의 4개)", eyebrow ? `${eyebrow[1]}개 획득 · ${eyebrow[2]}개 남음` : "머리글 없음");
  shot("M7-android-badges.png");
  const earnedIds = [...badges.xml.matchAll(/resource-id="badge-(c[a-z0-9]{20,})"/g)].map((m) => m[1]);
  const lockedNames = [...badges.xml.matchAll(/resource-id="badge-locked-([^"]+)"/g)].map((m) => m[1]);
  check(earnedIds.length === Number(eyebrow?.[1] ?? -1), "획득한 배지 카드 수가 머리글과 같다", `${earnedIds.length}개`);
  // 잠긴 배지는 화면 아래쪽에 있을 수 있다 — 스크롤해서 읽는다
  scrollDown(1100);
  await wait(800);
  const lockedView = dumpUi();
  const lockedNow = [...lockedView.matchAll(/resource-id="badge-locked-([^"]+)"/g)].map((m) => m[1]);
  const allLocked = [...new Set([...lockedNames, ...lockedNow])];
  check(allLocked.length === Number(eyebrow?.[2] ?? -1), "잠긴 배지 카드 수가 머리글과 같다", allLocked.join(" · "));
  const notes = allLocked.map((n) => nodeOf(lockedView, `badge-note-${n}`)?.text ?? nodeOf(badges.xml, `badge-note-${n}`)?.text).filter(Boolean);
  check(notes.length === allLocked.length && notes.every((t) => t.length > 0), "잠긴 배지마다 진행 안내 한 줄이 있다", notes.join(" | "));
  scrollUp(1100);
  await wait(600);

  // 자랑하기 모달 — 열고 닫기만 (글은 올리지 않는다)
  const freshBadges = dumpUi();
  const shareable = earnedIds.find((id) => nodeOf(freshBadges, `badge-share-${id}`)?.enabled);
  if (shareable) {
    tapId(freshBadges, `badge-share-${shareable}`);
    const modal = await until((x) => has(x, "share-modal"), 8000);
    check(modal.ok && has(modal.xml, "share-message") && has(modal.xml, "share-submit"), "자랑하기 → 한마디 모달이 열린다 (올리지는 않는다)");
    tapId(modal.xml, "share-message");
    await wait(700);
    await typeText("hello");
    await hideKeyboard();
    check(nodeOf(dumpUi(), "share-message")?.text === "hello", "모달 안에서 한마디를 칠 수 있다 (키보드)");
    tapId(dumpUi(), "share-cancel");
    const shut = await until((x) => !has(x, "share-modal"), 8000);
    check(shut.ok, "취소 → 모달이 닫힌다 (서버에 아무것도 안 보냈다)");
  } else {
    console.log("  · 아직 자랑하지 않은 배지가 없어 자랑하기 모달은 건너뜀 (획득 0개이거나 모두 공유함)");
  }

  /* ── 4. 커뮤니티 ─────────────────────────────────────────── */
  await openRoute("community");
  const feed = await until((x) => has(x, "community") && (has(x, "composer") || has(x, "feed-error")), 25_000);
  check(feed.ok && !has(feed.xml, "feed-error"), "커뮤니티 탭 — 실서버 피드가 불러와진다 (글쓰기 칸이 보인다)");
  shot("M7-android-community.png");
  // 글 본문 글자(`post-content-<id>`)로 센다 — 글 id 모양(cuid · uuid)에 기대지 않는다
  const postIds = [...feed.xml.matchAll(/resource-id="post-content-([^"]+)"/g)].map((m) => m[1]);
  console.log(`  · 첫 화면에 보이는 글: ${postIds.length}개 (${has(feed.xml, "feed-empty") ? "피드가 비어 있음" : "내용은 출력하지 않는다"})`);
  check(postIds.length > 0 || has(feed.xml, "feed-empty"), "피드 — 글 카드가 있거나 빈 안내가 뜬다");

  // 글쓰기 입력 — 키보드 · 글자 수 · 올리기 버튼 (누르지 않는다)
  const composerNode = nodeOf(feed.xml, "composer-input");
  if (composerNode) {
    check(nodeOf(feed.xml, "composer-submit")?.enabled === false, "글쓰기 — 비어 있으면 \"글 올리기\"가 잠겨 있다");
    tapId(feed.xml, "composer-input");
    await wait(800);
    await typeText("keyboard test");
    await hideKeyboard();
    const typed = dumpUi();
    check((nodeOf(typed, "composer-input")?.text ?? "").toLowerCase() === "keyboard test" && // 키보드가 첫 글자를 대문자로 바꿀 수 있다
       nodeOf(typed, "composer-count")?.text === "13 / 1000", "글쓰기 — 입력이 들어가고 글자 수가 센다 (13 / 1000)", nodeOf(typed, "composer-count")?.text ?? "");
    check(nodeOf(typed, "composer-submit")?.enabled === true, "글쓰기 — 내용이 생기면 \"글 올리기\"가 열린다 (누르지는 않는다)");
    tapId(typed, "composer-input");
    await wait(600);
    await clearField(20);
    await hideKeyboard();
  }

  // 댓글 펼치기 (읽기만) — 첫 글
  if (postIds[0]) {
    const x2 = dumpUi();
    tapId(x2, `post-comments-${postIds[0]}`);
    const opened = await until((x) => has(x, `post-comment-area-${postIds[0]}`), 12_000);
    check(opened.ok && has(opened.xml, `comment-input-${postIds[0]}`) && nodeOf(opened.xml, `comment-send-${postIds[0]}`)?.enabled === false, "글의 댓글을 펼친다 — 실서버 목록 · 입력칸 · 빈 입력이면 \"등록\"이 잠겨 있다 (올리지는 않는다)");
    // 키보드가 입력칸을 가리지 않는가
    tapId(opened.xml, `comment-input-${postIds[0]}`);
    await wait(900);
    const kb = dumpUi();
    const input = nodeOf(kb, `comment-input-${postIds[0]}`);
    const ime = adb(["shell", "dumpsys", "window", "displays"], { maxBuffer: 16 * 1024 * 1024 }).stdout?.match(/mImeHeight=(\d+)/)?.[1];
    const screenH = 2400;
    const covered = keyboardShown() && input?.bounds && ime ? input.bounds[3] > screenH - Number(ime) : false;
    check(Boolean(input?.bounds) && !covered, "댓글 입력칸이 키보드에 가려지지 않는다", input?.bounds ? `하단 ${input.bounds[3]} · 키보드 높이 ${ime ?? 0}` : "입력칸 안 보임");
    shot("M7-android-comment-keyboard.png");
    await hideKeyboard();
  }

  // 주간 랭킹
  const back = dumpUi();
  tapId(back, "segment-ranking");
  const ranking = await until((x) => has(x, "ranking-rows") || has(x, "ranking-empty") || has(x, "ranking-error"), 20_000);
  check(ranking.ok && !has(ranking.xml, "ranking-error"), "주간 랭킹 — 실서버에서 불러와진다 (순위 줄 또는 \"아직 없어요\" 안내)");
  const rankRows = [...ranking.xml.matchAll(/resource-id="rank-(\d+)"/g)].length;
  check(has(ranking.xml, "ranking-empty") ? rankRows === 0 : rankRows >= 1 && rankRows <= 11, "랭킹 — 줄 수가 규칙 안이다 (Top 10 + 내 순위 한 줄까지)", `${rankRows}줄`);
  shot("M7-android-ranking.png");
  tapId(ranking.xml, "segment-feed");
  await wait(800);

  /* ── 5. 설정 ─────────────────────────────────────────────── */
  await openRoute("settings");
  const settings = await until((x) => has(x, "settings-name-card") && has(x, "settings-profile"), 25_000);
  check(settings.ok, "설정 — 실서버 프로필이 불러와진다");
  const realName = nodeOf(settings.xml, "settings-name")?.text ?? "";
  check(realName.length > 0 && (nodeOf(settings.xml, "settings-email")?.text ?? "").includes("@") && nodeOf(settings.xml, "settings-provider")?.text === "Google", "설정 — 이름 · 이메일 · 로그인 방식(Google)이 있다 (값은 출력하지 않는다)");
  shot("M7-android-settings.png");
  check(!settings.xml.includes("비밀번호") && !settings.xml.includes("테마"), "설정 — 비밀번호 변경 · 테마 항목은 없다");
  check(nodeOf(settings.xml, "name-save")?.enabled === false, "이름 — 바꾸기 전에는 \"이름 저장\"이 잠겨 있다");

  // 이름 — **저장은 누르지 않는다.** 서버 이름은 커뮤니티 글 · 댓글 · 랭킹에 공개되는 값이라 이름 변경은 공개 변경이다 (security.md). 서버가 이 라우트를 모르던 때(405)에는 거절만 확인했지만
  // 배포된 뒤에는 실제로 바뀌어 버리므로 입력 → "이름 저장"이 열리는 데까지만 보고, 저장 흐름은 웹 미리보기의 가짜 서버(verify:M7-web)와 verify:M7-users-api가 같은 코드로 검증한다.
  tapId(settings.xml, "name-input");
  await wait(700);
  await clearField(40);
  await typeText("verifyname");
  await hideKeyboard();
  const nameForm = dumpUi();
  check(nodeOf(nameForm, "name-save")?.enabled === true, "이름을 바꾸면 \"이름 저장\"이 열린다 (저장은 누르지 않는다)");
  // 입력만 했으니 서버에는 아무것도 가지 않았다 — 입력칸을 비워 두고 넘어간다 (화면을 나가면 사라진다)
  await clearField(40);
  scrollDown(1400);
  await wait(800);
  const dangerView = dumpUi();
  check(has(dangerView, "settings-delete") && nodeOf(dangerView, "delete-confirm")?.enabled === false, "회원 탈퇴 — 확인 문구 전에는 잠겨 있다");
  tapId(dangerView, "delete-input");
  await wait(700);
  await typeText("x");
  await hideKeyboard();
  check(nodeOf(dumpUi(), "delete-confirm")?.enabled === false, "회원 탈퇴 — 틀린 글자로는 안 열린다");
  // 한글은 adb로 못 친다 — 열리는 쪽은 웹 검증이 확인한다 (정확히 \"탈퇴\"를 쳐야 열린다). 탈퇴 버튼은 누르지 않는다
  tapId(dumpUi(), "delete-input");
  await wait(500);
  await clearField(5);
  await hideKeyboard();

  /* ── 6. 생존 · 에러 ──────────────────────────────────────── */
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
  console.error(`\nM7 안드로이드 검증 실패 ${failures.length}건: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nM7 안드로이드 검증을 통과했습니다.");
