/**
 * M8 검증 — 알림 계산 로직 (Node · 에이전트 자동 실행용)
 *
 *   node scripts/verify-M8-logic.mjs
 *
 * `src/logic/notifications.ts`는 순수 파일이라 Node(타입 제거 실행)로 바로 돌린다 (런타임 import 없음).
 *
 * 확인 항목
 *   1. 문서 읽기 — 정상 · 제목/내용 없음 · 문서가 아님 · 깨진 값(시각 · read · link · type)
 *   2. 정렬 — 최신순 · 같은 시각은 id 큰 쪽 먼저 · 시각을 못 읽으면 맨 뒤 · 50건 상한 · 원본 불변
 *   3. 읽음 — 한 건 · 전부 · 되돌리기 · 불변 · 이미 읽은 것은 그대로
 *   4. 스냅숏 합치기 — 읽음 표시를 보낸 뒤 옛 스냅숏이 와도 안 읽음으로 되돌아가지 않는다 · 서버가 확인하면 보류에서 뺀다 · 목록에서 사라지면 뺀다
 *   5. 표시 — 배지 숫자("9+") · 머리글 문구
 *   6. 누르면 갈 화면 — 아는 웹 경로만 앱 화면으로 · 글 id 검증 · 외부 주소 · 이상한 값은 움직이지 않는다
 */
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) {
      const base = join(SRC, specifier.slice(2));
      const file = [".ts", ".tsx", "/index.ts"].map((ext) => base + ext).find(existsSync);
      if (file) return next(pathToFileURL(file).href, context);
    }
    return next(specifier, context);
  },
});

const N = await import(pathToFileURL(join(SRC, "logic", "notifications.ts")).href);

const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const item = (id, over = {}) => ({ id, type: "badge_earned", title: `알림 ${id}`, body: "내용", read: false, createdAt: "2026-09-17T01:00:00.000Z", ...over });

/* ── 1. 문서 읽기 ───────────────────────────────────────────── */
{
  const ok = N.normalizeNotification("a", { type: "badge_earned", title: " 새 배지 ", body: "얻었어요", link: " /badges ", read: false, createdAt: "2026-09-17T01:00:00.000Z" });
  check(eq(ok, { id: "a", type: "badge_earned", title: "새 배지", body: "얻었어요", link: "/badges", read: false, createdAt: "2026-09-17T01:00:00.000Z" }), "정상 문서 — 제목 · 내용 · 주소의 앞뒤 공백을 자르고 그대로 읽는다");
  check(!("link" in N.normalizeNotification("a", { title: "t", body: "b" })), "link가 없으면 필드도 없다");
  check(N.normalizeNotification("a", { title: "t", body: "b", link: "   " }).link === undefined, "link가 공백뿐이면 없는 것으로");
  check(N.normalizeNotification("a", { title: "제목만", body: "" }) !== null && N.normalizeNotification("a", { title: "", body: "내용만" }) !== null, "제목만 · 내용만 있어도 알림이다");
  check(N.normalizeNotification("a", { title: "  ", body: "" }) === null && N.normalizeNotification("a", {}) === null, "제목도 내용도 없으면 건너뛴다");
  check(N.normalizeNotification("a", null) === null && N.normalizeNotification("a", "문자열") === null && N.normalizeNotification("a", [1, 2]) === null && N.normalizeNotification("a", 7) === null, "문서가 아니면(null · 문자열 · 배열 · 숫자) 건너뛴다");
  check(N.normalizeNotification("", { title: "t", body: "b" }) === null && N.normalizeNotification(undefined, { title: "t", body: "b" }) === null, "id가 없으면 건너뛴다");
  check(N.normalizeNotification("a", { title: "t", body: "b", read: true }).read === true && N.normalizeNotification("a", { title: "t", body: "b", read: false }).read === false, "read는 true일 때만 읽음");
  const bad = [undefined, null, "true", 1, "yes", {}];
  check(bad.every((v) => N.normalizeNotification("a", { title: "t", body: "b", read: v }).read === false), "read가 없거나 true가 아닌 값(문자열 \"true\" · 1 포함)이면 안 읽음 — 서버 규칙(read !== true)과 같다");
  check(N.normalizeNotification("a", { title: "t", body: "b", createdAt: "엉터리" }).createdAt === "" && N.normalizeNotification("a", { title: "t", body: "b", createdAt: 123 }).createdAt === "" && N.normalizeNotification("a", { title: "t", body: "b" }).createdAt === "", "시각을 읽을 수 없으면 빈 글자");
  check(N.normalizeNotification("a", { title: "t", body: "b", type: 5 }).type === "" && N.normalizeNotification("a", { title: "t", body: "b", type: "처음 보는 종류" }).type === "처음 보는 종류", "type이 문자가 아니면 빈 글자 · 처음 보는 종류는 그대로 둔다 (깨지지 않는다)");
}

/* ── 2. 정렬 ───────────────────────────────────────────────── */
{
  const a = item("a", { createdAt: "2026-09-17T01:00:00.000Z" });
  const b = item("b", { createdAt: "2026-09-17T03:00:00.000Z" });
  const c = item("c", { createdAt: "2026-09-17T02:00:00.000Z" });
  check(eq(N.sortNotifications([a, b, c]).map((x) => x.id), ["b", "c", "a"]), "최신순으로 정렬한다");
  const same = N.sortNotifications([item("a"), item("c"), item("b")]);
  check(eq(same.map((x) => x.id), ["c", "b", "a"]), "같은 시각이면 id가 큰 쪽이 먼저 (순서가 매번 같다)");
  check(eq(N.sortNotifications([item("x", { createdAt: "" }), a, b]).map((x) => x.id), ["b", "a", "x"]), "시각을 못 읽는 알림은 맨 뒤");
  const many = Array.from({ length: 80 }, (_, i) => item(`id${String(i).padStart(2, "0")}`, { createdAt: new Date(Date.UTC(2026, 8, 17, 0, i)).toISOString() }));
  const sorted = N.sortNotifications(many);
  check(sorted.length === 50 && sorted[0].id === "id79" && sorted[49].id === "id30" && N.NOTIFICATION_LIMIT === 50, "50건까지만 (가장 새 50건) — 서버 `GET /api/notifications`와 같다");
  const input = [a, b, c];
  N.sortNotifications(input);
  check(input[0] === a && input[1] === b && input[2] === c, "원본 배열은 바뀌지 않는다");
}

/* ── 3. 읽음 ───────────────────────────────────────────────── */
{
  const list = [item("a"), item("b", { read: true }), item("c")];
  check(N.unreadCount(list) === 2 && N.unreadCount([]) === 0, "안 읽은 수");
  const one = N.applyRead(list, "a");
  check(one[0].read && !one[2].read && one[1] === list[1] && !list[0].read, "한 건만 읽음으로 · 원본 · 다른 알림은 그대로");
  check(N.applyRead(list, "없는id") .every((n, i) => n === list[i]), "없는 id는 아무 일도 없다");
  check(N.applyRead(list, "b")[1] === list[1], "이미 읽은 알림은 같은 객체 그대로");
  const all = N.applyReadAll(list);
  check(all.every((n) => n.read) && all[1] === list[1] && N.unreadCount(list) === 2, "모두 읽음 — 이미 읽은 것은 그대로 · 원본은 안 바뀐다");
  const reverted = N.revertRead(all, new Set(["a", "c"]));
  check(!reverted[0].read && reverted[1].read && !reverted[2].read, "읽음 실패 — 지정한 id만 안 읽음으로 되돌린다 (원래 읽은 b는 그대로)");
}

/* ── 4. 스냅숏 합치기 ──────────────────────────────────────── */
{
  // 읽음 표시를 보냈다(pending) — 서버가 아직 모르는 옛 스냅숏이 오면 안 읽음으로 보이면 안 된다
  const stale = [item("a"), item("b")];
  const m1 = N.mergeSnapshot(stale, new Set(["a"]));
  check(m1.items[0].read && !m1.items[1].read && eq([...m1.pending], ["a"]), "옛 스냅숏(a가 아직 안 읽음)이 와도 보류 중인 a는 읽음으로 덮는다 · 보류는 유지");
  // 서버가 읽음으로 확인했다
  const m2 = N.mergeSnapshot([item("a", { read: true }), item("b")], m1.pending);
  check(m2.items[0].read && m2.pending.size === 0, "서버가 읽음으로 확인하면 보류에서 뺀다");
  // 목록에서 사라졌다(50건 밖으로 밀림)
  const m3 = N.mergeSnapshot([item("b")], new Set(["a"]));
  check(m3.pending.size === 0 && m3.items.length === 1, "목록에서 사라진 알림은 보류에서 뺀다 (영영 남지 않는다)");
  check(eq(N.mergeSnapshot([item("a")], new Set()).items[0].read, false), "보류가 없으면 서버 값 그대로");
  const input = [item("a")];
  const merged = N.mergeSnapshot(input, new Set(["a"]));
  check(!input[0].read && merged.items[0] !== input[0], "들어온 스냅숏은 바꾸지 않는다");
  // 새 알림이 들어오면 안 읽음으로 보인다
  const m4 = N.mergeSnapshot([item("new"), item("a", { read: true })], new Set());
  check(!m4.items[0].read && N.unreadCount(m4.items) === 1, "새로 들어온 알림은 안 읽음 (실시간)");
}

/* ── 5. 표시 ───────────────────────────────────────────────── */
{
  check(N.badgeLabel(0) === "" && N.badgeLabel(-3) === "" && N.badgeLabel(1) === "1" && N.badgeLabel(9) === "9" && N.badgeLabel(10) === "9+" && N.badgeLabel(120) === "9+", "배지 숫자 — 0은 없음 · 9까지 그대로 · 10부터 \"9+\"");
  check(N.notificationsEyebrow(null) === "불러오는 중" && N.notificationsEyebrow([]) === "새 소식이 없어요", "머리글 — 로딩 · 알림 없음");
  check(N.notificationsEyebrow([item("a"), item("b", { read: true }), item("c")]) === "읽지 않은 알림 2개" && N.notificationsEyebrow([item("a", { read: true })]) === "모두 읽었어요", "머리글 — 안 읽은 수 · 모두 읽음");
}

/* ── 6. 누르면 갈 화면 ─────────────────────────────────────── */
{
  const r = N.routeFor;
  check(eq(r("/badges"), { pathname: "/badges" }) && eq(r("/garden"), { pathname: "/garden" }) && eq(r("/goals"), { pathname: "/goals" }) && eq(r("/analysis"), { pathname: "/analysis" }), "서버가 쓰는 웹 경로(/badges · /garden · /goals · /analysis)는 같은 앱 화면으로");
  check(eq(r("/dashboard"), { pathname: "/" }) && eq(r("/history"), { pathname: "/history" }) && eq(r("/settings"), { pathname: "/settings" }) && eq(r("/community"), { pathname: "/community" }), "/dashboard는 앱 홈(\"/\") · 기록 · 설정 · 커뮤니티");
  check(eq(r("/community?post=cm123abc"), { pathname: "/community", params: { post: "cm123abc" } }), "댓글 알림 — /community?post=<id>는 그 글을 강조하도록 id를 넘긴다");
  check(eq(r("/community?post="), { pathname: "/community" }) && eq(r("/community?foo=1"), { pathname: "/community" }), "글 id가 비었거나 다른 값이면 커뮤니티만");
  check(eq(r("/community?post=../etc/passwd"), { pathname: "/community" }) && eq(r("/community?post=a b"), { pathname: "/community" }) && eq(r(`/community?post=${"x".repeat(129)}`), { pathname: "/community" }), "글 id가 이상하면(경로 조작 · 공백 · 129자) 글 없이 커뮤니티만");
  check(eq(r("/badges/"), { pathname: "/badges" }) && eq(r(" /garden "), { pathname: "/garden" }), "끝 슬래시 · 앞뒤 공백은 봐준다");
  check(r("https://example.com/badges") === null && r("//evil.example/badges") === null && r("javascript:alert(1)") === null && r("badges") === null, "외부 주소 · 프로토콜 상대 주소 · javascript: · 슬래시 없는 값은 열지 않는다");
  check(r("/없는화면") === null && r("/") === null && r("/admin") === null && r("/badges/extra") === null && r("") === null && r("   ") === null, "모르는 경로 · 빈 값은 열지 않는다 (읽음 처리만 된다)");
  check(r(undefined) === null && r(null) === null && r(5) === null, "link가 없거나 문자가 아니면 null");
  check(r("/badges?x=1").pathname === "/badges" && !("params" in r("/badges?post=abc")), "다른 경로의 쿼리는 무시하고 post는 커뮤니티에서만 쓴다");
}

if (failures.length) {
  console.error(`\n실패 ${failures.length}건: ${failures.join(" · ")}`);
  process.exit(1);
}
console.log("\nM8 로직 검증을 통과했습니다.");
