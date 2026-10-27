/**
 * M8 검증 — 로컬 예약 알림 계획 (Node · 에이전트 자동 실행용)
 *
 *   node scripts/verify-M8-reminders.mjs
 *
 * `src/logic/reminders.ts`는 순수 파일이라 Node(타입 제거 실행)로 바로 돌린다. 시각은 KST로 못 박았으므로
 * **시간대 3개(Asia/Seoul · UTC · America/Los_Angeles)에서 다시 실행해 답이 같아야** 통과다.
 *
 * 확인 항목
 *   1. 설정 읽기 — 없음 · 깨짐 · 일부만 · 기본값은 모두 꺼짐
 *   2. 저녁 리마인더 — 오늘 21시(분석 전) · 이미 했으면 오늘은 빠지고 내일부터 · 21시가 지났으면 내일부터 · 3일치만 · 목록을 못 읽으면 오늘 몫은 건드리지 않는다(incomplete)
 *   3. 동물 배고픔 — 이틀 이상 못 먹었을 때만 · 오늘 분석했으면 빠진다 · 알 · 동물 없음 · 못 읽음 · 10시가 지났으면 내일만 · 2일치만 · 이름 · 일수 문구
 *   4. 목표 마감 D-1 — 진행 중만 · 종료일 하루 전 10시 · 시작 전에는 안 울림 · 14일 밖 · 10개 상한 · 긴 제목 자르기 · 못 읽으면 incomplete
 *   5. 꺼진 종류는 계획에서 빠진다 · 정렬 · 식별자 · 식별자로 종류 알아내기 · 알림 데이터 링크 읽기
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ZONES = ["Asia/Seoul", "UTC", "America/Los_Angeles"];

if (!process.env.OFFLO_TZ_CHILD) {
  let failed = 0;
  for (const tz of ZONES) {
    console.log(`\n── TZ=${tz} ──`);
    const run = spawnSync(process.execPath, process.execArgv.concat(process.argv.slice(1)), {
      stdio: "inherit",
      env: { ...process.env, TZ: tz, OFFLO_TZ_CHILD: "1" },
    });
    if (run.status !== 0) failed++;
  }
  if (failed) {
    console.error(`\nM8 로컬 알림 계획 검증 실패 — ${failed}개 시간대`);
    process.exit(1);
  }
  console.log(`\nM8 로컬 알림 계획 검증을 통과했습니다 (${ZONES.join(" · ")}).`);
  process.exit(0);
}

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

const R = await import(pathToFileURL(join(SRC, "logic", "reminders.ts")).href);

const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};
const kst = (key, hour, min = 0) => Date.parse(`${key}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00+09:00`);
const ids = (plan, kind) => plan.items.filter((i) => i.kind === kind).map((i) => i.id);

const ALL = { evening: true, hungry: true, goal: true };
const ONLY = (k) => ({ evening: false, hungry: false, goal: false, [k]: true });
const base = { analyzedToday: false, animal: null, goals: [] };
const goal = (id, over = {}) => ({ id, userId: "u", title: "하루 4시간 이하", targetMinutes: 240, startDate: "2026-10-01T00:00:00.000Z", endDate: "2026-10-31T00:00:00.000Z", status: "active", createdAt: "2026-10-01T00:00:00.000Z", ...over });

/* ── 1. 설정 읽기 ─────────────────────────────────────── */
check(JSON.stringify(R.DEFAULT_PREFS) === JSON.stringify({ evening: false, hungry: false, goal: false }), "기본값은 모두 꺼짐 (켜는 것은 사용자의 선택)");
check(JSON.stringify(R.normalizePrefs(undefined)) === JSON.stringify(R.DEFAULT_PREFS) && JSON.stringify(R.normalizePrefs("x")) === JSON.stringify(R.DEFAULT_PREFS) && JSON.stringify(R.normalizePrefs(null)) === JSON.stringify(R.DEFAULT_PREFS), "설정 읽기 — 없음 · 문자열 · null이면 모두 꺼짐");
check(JSON.stringify(R.normalizePrefs({ evening: true, hungry: "yes", goal: 1 })) === JSON.stringify({ evening: true, hungry: false, goal: false }), "설정 읽기 — true만 켜진 것으로 본다 (\"yes\" · 1은 아님)");
check(R.anyOn({ evening: false, hungry: false, goal: true }) && !R.anyOn(R.DEFAULT_PREFS), "anyOn");

/* ── 2. 저녁 리마인더 ─────────────────────────────────── */
{
  const now = kst("2026-10-27", 14); // 화요일 오후 2시 — 아직 분석 전
  const p = R.planReminders({ ...base, now, prefs: ONLY("evening") });
  check(ids(p, "evening").join() === "offlo-evening-2026-10-27,offlo-evening-2026-10-28,offlo-evening-2026-10-29", "저녁 — 오늘 · 내일 · 모레 3번", ids(p, "evening").join());
  check(p.items[0].at === kst("2026-10-27", 21) && p.items[1].at === kst("2026-10-28", 21), "저녁 — 매일 KST 21시 (기기 시간대와 무관)");
  check(p.items.every((i) => i.link === "/analysis" && i.title.length > 0 && i.body.length > 0), "저녁 — 눌러서 분석 탭 · 제목과 내용이 있다");
  check(p.complete.join() === "evening", "저녁 — 완전한 계획");

  const done = R.planReminders({ ...base, now, prefs: ONLY("evening"), analyzedToday: true });
  check(ids(done, "evening").join() === "offlo-evening-2026-10-28,offlo-evening-2026-10-29,offlo-evening-2026-10-30", "저녁 — 오늘 이미 분석했으면 오늘은 빠지고 내일부터 3번", ids(done, "evening").join());

  const late = R.planReminders({ ...base, now: kst("2026-10-27", 22), prefs: ONLY("evening") });
  check(ids(late, "evening").join() === "offlo-evening-2026-10-28,offlo-evening-2026-10-29,offlo-evening-2026-10-30", "저녁 — 오늘 21시가 지났으면 오늘은 없고 내일부터 3번", ids(late, "evening").join());

  const edge = R.planReminders({ ...base, now: kst("2026-10-27", 20, 59) + 40_000, prefs: ONLY("evening") });
  check(!ids(edge, "evening").includes("offlo-evening-2026-10-27"), "저녁 — 21시까지 30초도 안 남았으면 오늘은 거른다 (예약하는 사이 지나간다)");
  const edge2 = R.planReminders({ ...base, now: kst("2026-10-27", 20, 50), prefs: ONLY("evening") });
  check(ids(edge2, "evening").includes("offlo-evening-2026-10-27"), "저녁 — 10분 남았으면 오늘 것도 예약한다");

  const unknown = R.planReminders({ ...base, now, prefs: ONLY("evening"), analyzedToday: null });
  check(ids(unknown, "evening").join() === "offlo-evening-2026-10-28,offlo-evening-2026-10-29,offlo-evening-2026-10-30" && !unknown.complete.includes("evening"), "저녁 — 분석 목록을 못 읽었으면(null) 오늘 몫을 모르니 incomplete (기존 예약을 지우지 않는다)", `${ids(unknown, "evening").join()} / ${unknown.complete.join()}`);
  const unknownLate = R.planReminders({ ...base, now: kst("2026-10-27", 23), prefs: ONLY("evening"), analyzedToday: null });
  check(unknownLate.complete.includes("evening"), "저녁 — 못 읽었어도 오늘 21시가 이미 지났으면 몰라도 되니 complete");

  // KST 날짜 경계 — 자정(KST) 직후는 다음 날이다. UTC로는 아직 전날 15시
  const midnight = R.planReminders({ ...base, now: kst("2026-10-28", 0, 5), prefs: ONLY("evening") });
  check(ids(midnight, "evening")[0] === "offlo-evening-2026-10-28", "저녁 — KST 자정 직후엔 그날(10/28)부터", ids(midnight, "evening")[0]);
}

/* ── 3. 동물 배고픔 ───────────────────────────────────── */
{
  const now = kst("2026-10-27", 8); // 오전 8시 — 오늘 10시가 아직 안 왔다
  const pet = (last, type = "cat") => ({ type, lastAnalysisDate: last });
  const hungry = (over) => R.planReminders({ ...base, now, prefs: ONLY("hungry"), ...over });

  const starving = hungry({ animal: pet("2026-10-24") }); // 사흘 전
  check(ids(starving, "hungry").join() === "offlo-hungry-2026-10-27,offlo-hungry-2026-10-28", "배고픔 — 이미 굶었으면 오늘 10시 · 내일 10시 (2번만)", ids(starving, "hungry").join());
  check(starving.items[0].at === kst("2026-10-27", 10) && starving.items[0].title === "고양이가 배고파해요 🍽️" && starving.items[0].body === "3일째 밥을 못 먹었어요. 오늘 분석하면 밥을 줄 수 있어요." && starving.items[1].body.startsWith("4일째"), "배고픔 — 이름 · 일수 문구 (오늘 3일째 · 내일 4일째)", starving.items[0].body);
  check(starving.items.every((i) => i.link === "/analysis"), "배고픔 — 눌러서 분석 탭 (밥은 분석이다)");
  check(starving.complete.includes("hungry"), "배고픔 — 완전한 계획");

  const peckish = hungry({ animal: pet("2026-10-26") }); // 어제 — 오늘은 출출, 내일 아침에야 이틀째
  check(ids(peckish, "hungry").join() === "offlo-hungry-2026-10-28,offlo-hungry-2026-10-29", "배고픔 — 어제까지 먹었으면 오늘은 조용하고 내일 아침(이틀째)부터 2번", ids(peckish, "hungry").join());
  check(peckish.items[0].body.startsWith("2일째"), "배고픔 — 내일 아침은 2일째");

  check(ids(hungry({ animal: pet("2026-10-27") }), "hungry").join() === "offlo-hungry-2026-10-29,offlo-hungry-2026-10-30", "배고픔 — 오늘 먹었으면 내일은 1일째라 조용하고 모레 아침(이틀째)부터", ids(hungry({ animal: pet("2026-10-27") }), "hungry").join());
  check(ids(hungry({ animal: pet("2026-10-20"), analyzedToday: true }), "hungry").join() === "offlo-hungry-2026-10-29,offlo-hungry-2026-10-30", "배고픔 — 오늘 분석했으면 동물 문서가 아직 옛 값이어도 오늘 먹은 것으로 본다", ids(hungry({ animal: pet("2026-10-20"), analyzedToday: true }), "hungry").join());
  check(ids(hungry({ animal: pet(null) }), "hungry").length === 0 && hungry({ animal: pet(null) }).complete.includes("hungry"), "배고픔 — 한 번도 못 먹은 알은 배고프다고 하지 않는다 (알았으니 complete)");
  check(ids(hungry({ animal: pet(null), analyzedToday: true }), "hungry").join() === "offlo-hungry-2026-10-29,offlo-hungry-2026-10-30", "배고픔 — 알인데 오늘 분석했으면(곧 부화) 오늘 먹은 것으로 본다");
  check(ids(hungry({ animal: { type: null, lastAnalysisDate: "2026-10-20" } }), "hungry").length === 0 && hungry({ animal: { type: null, lastAnalysisDate: null } }).complete.includes("hungry"), "배고픔 — 동물을 안 골랐으면 없다 (complete)");
  const unk = hungry({ animal: null });
  check(unk.items.length === 0 && !unk.complete.includes("hungry"), "배고픔 — 동물 문서를 못 읽었으면(null) incomplete (기존 예약을 지우지 않는다)");
  check(ids(hungry({ animal: pet("엉터리") }), "hungry").length === 0, "배고픔 — 날짜가 깨졌으면 알리지 않는다");

  const afterTen = R.planReminders({ ...base, now: kst("2026-10-27", 11), prefs: ONLY("hungry"), animal: pet("2026-10-24", "dog") });
  check(ids(afterTen, "hungry").join() === "offlo-hungry-2026-10-28,offlo-hungry-2026-10-29" && afterTen.items[0].title === "강아지가 배고파해요 🍽️", "배고픔 — 오늘 10시가 지났으면 내일부터 2번 · 종류별 이름(강아지)", ids(afterTen, "hungry").join());
  check(R.planReminders({ ...base, now, prefs: ONLY("hungry"), animal: pet("2026-10-24", "rabbit") }).items[0].title === "토끼가 배고파해요 🍽️", "배고픔 — 토끼");
  check(R.petName("???") === "동물" && R.petName(null) === "동물", "이름 — 모르는 종류는 \"동물\"");
}

/* ── 4. 목표 마감 D-1 ─────────────────────────────────── */
{
  const now = kst("2026-10-27", 12);
  const plan = (goals, at = now) => R.planReminders({ ...base, now: at, prefs: ONLY("goal"), goals });

  const one = plan([goal("a", { endDate: "2026-10-29T00:00:00.000Z" })]);
  check(one.items.length === 1 && one.items[0].id === "offlo-goal-a" && one.items[0].at === kst("2026-10-28", 10), "목표 — 종료일(10/29) 하루 전(10/28) 오전 10시", one.items[0]?.id);
  check(one.items[0].title === "목표 마감이 하루 남았어요 🎯" && one.items[0].body.includes("‘하루 4시간 이하’") && one.items[0].link === "/goals", "목표 — 제목 · 목표 이름이 든 내용 · 눌러서 목표 화면");
  check(one.complete.join() === "goal", "목표 — 완전한 계획");

  check(plan([goal("b", { status: "completed", endDate: "2026-10-29T00:00:00.000Z" })]).items.length === 0 && plan([goal("c", { status: "paused", endDate: "2026-10-29T00:00:00.000Z" })]).items.length === 0, "목표 — 진행 중(active)만 (완료 · 일시정지는 알리지 않는다)");
  check(plan([goal("d", { endDate: "2026-10-28T00:00:00.000Z" })]).items.length === 0, "목표 — 내일 끝나는 목표인데 오늘 10시는 이미 지났다 → 없음");
  check(plan([goal("d2", { endDate: "2026-10-28T00:00:00.000Z" })], kst("2026-10-27", 6)).items.length === 1, "목표 — 내일 끝나는데 오늘 아침 6시면 오늘 10시에 알린다");
  check(plan([goal("e", { startDate: "2026-10-29T00:00:00.000Z", endDate: "2026-10-29T00:00:00.000Z" })]).items.length === 0, "목표 — 하루짜리(시작=종료)는 시작도 하기 전에 \"하루 남았다\"고 하지 않는다");
  check(plan([goal("e2", { startDate: "2026-10-28T00:00:00.000Z", endDate: "2026-10-29T00:00:00.000Z" })]).items.length === 1, "목표 — 이틀짜리(10/28~29)는 시작일 아침에 알린다");
  check(plan([goal("f", { endDate: "2026-12-31T00:00:00.000Z" })]).items.length === 0 && plan([goal("f2", { endDate: "2026-11-10T00:00:00.000Z" })]).items.length === 1 && plan([goal("f3", { endDate: "2026-11-12T00:00:00.000Z" })]).items.length === 0, "목표 — 14일 안에 오는 알림만 예약한다 (11/9 아침은 14일 이내 · 11/11 아침은 밖)");
  const many = Array.from({ length: 15 }, (_, i) => goal(`g${String(i).padStart(2, "0")}`, { endDate: `2026-10-${String(29 + (i % 3)).padStart(2, "0")}T00:00:00.000Z` }));
  const capped = plan(many);
  check(capped.items.length === R.GOAL_MAX && R.GOAL_MAX === 10, "목표 — 한꺼번에 10개까지만");
  check(capped.items.every((it, i, arr) => i === 0 || arr[i - 1].at <= it.at), "목표 — 가까운 마감부터 (시각순)");
  const longTitle = plan([goal("h", { title: "가".repeat(100), endDate: "2026-10-29T00:00:00.000Z" })]);
  check(longTitle.items[0].body.includes(`‘${"가".repeat(39)}…’`), "목표 — 긴 제목은 40자로 자른다");
  check(plan([goal("i", { endDate: "엉터리" })]).items.length === 0, "목표 — 날짜가 깨졌으면 건너뛴다");
  const nul = R.planReminders({ ...base, now, prefs: ONLY("goal"), goals: null });
  check(nul.items.length === 0 && !nul.complete.includes("goal"), "목표 — 목록을 못 읽었으면(null) incomplete");
  const zero = plan([]);
  check(zero.items.length === 0 && zero.complete.includes("goal"), "목표 — 목표가 없으면 없다(complete)");
}

/* ── 5. 종류 끄기 · 정렬 · 식별자 ─────────────────────── */
{
  const now = kst("2026-10-27", 8);
  const off = R.planReminders({ ...base, now, prefs: R.DEFAULT_PREFS, animal: { type: "cat", lastAnalysisDate: "2026-10-20" }, goals: [goal("z", { endDate: "2026-10-29T00:00:00.000Z" })] });
  check(off.items.length === 0 && off.complete.length === 0, "모두 꺼져 있으면 아무것도 계획하지 않는다 (complete도 비어 — 끄는 쪽은 서비스가 종류별로 지운다)");

  const all = R.planReminders({ ...base, now, prefs: ALL, animal: { type: "dog", lastAnalysisDate: "2026-10-20" }, goals: [goal("z", { endDate: "2026-10-29T00:00:00.000Z" })] });
  check(all.items.every((it, i, arr) => i === 0 || arr[i - 1].at <= it.at), "전체 — 시각순 정렬");
  check(new Set(all.items.map((i) => i.id)).size === all.items.length, "전체 — 식별자가 겹치지 않는다");
  check(all.complete.slice().sort().join() === "evening,goal,hungry", "전체 — 세 종류 모두 complete");
  check(all.items.length === 3 + 2 + 1, "전체 — 저녁 3 + 배고픔 2 + 목표 1", String(all.items.length));
  check(all.items.every((it) => R.reminderKindOf(it.id) === it.kind), "식별자 접두어로 종류를 되짚을 수 있다");
  check(R.reminderKindOf("offlo-goal-abc") === "goal" && R.reminderKindOf("other-evening-1") === null && R.reminderKindOf("") === null && R.reminderKindOf("offlo-weird-1") === null, "식별자 — 우리 것만 알아본다 (다른 알림은 건드리지 않는다)");
  check(all.items.every((it) => Number.isFinite(it.at) && it.at > now), "모든 알림이 미래 시각이다");
}

/* ── 5b. 읽어 온 자료 → 계획 입력 · 어떤 자료가 필요한가 ───── */
{
  const now = kst("2026-10-27", 14);
  const daily = (iso) => ({ id: "a", periodType: "daily", totalMinutes: 200, detoxScore: 70, isPremium: false, createdAt: iso });
  const a = R.planInputFrom({ analyses: null, goals: null, garden: null }, now);
  check(a.analyzedToday === null && a.animal === null && a.goals === null, "입력 — 못 읽은 것은 모두 null (\"없음\"으로 바꾸지 않는다)");
  const b = R.planInputFrom({ analyses: [], goals: [], garden: { animal: null } }, now);
  check(b.analyzedToday === false && b.goals.length === 0 && b.animal.type === null && b.animal.lastAnalysisDate === null, "입력 — 읽었는데 비어 있으면 분석 안 함(false) · 동물 문서 없음은 \"아직 안 골랐다\"");
  const c = R.planInputFrom({ analyses: [daily("2026-10-26T14:59:00.000Z")], goals: null, garden: null }, now); // KST 10/26 23:59 — 어제
  const d = R.planInputFrom({ analyses: [daily("2026-10-26T15:00:00.000Z")], goals: null, garden: null }, now); // KST 10/27 00:00 — 오늘
  check(c.analyzedToday === false && d.analyzedToday === true, "입력 — 오늘 분석 여부는 KST 날짜로 센다 (UTC 10/26 15:00 = KST 10/27 0시)");
  const weekly = R.planInputFrom({ analyses: [{ ...daily("2026-10-27T01:00:00.000Z"), periodType: "weekly" }], goals: null, garden: null }, now);
  check(weekly.analyzedToday === false, "입력 — 주간 분석은 오늘 일간 분석이 아니다");
  const e = R.planInputFrom({ analyses: null, goals: null, garden: { animal: { type: "cat", lastAnalysisDate: "2026-10-25" } } }, now);
  check(e.animal.type === "cat" && e.animal.lastAnalysisDate === "2026-10-25", "입력 — 동물 문서의 종류 · 마지막 분석일을 그대로");
  const need = (p) => JSON.stringify(R.sourcesNeeded({ evening: false, hungry: false, goal: false, ...p }));
  check(need({}) === JSON.stringify({ analyses: false, goals: false, garden: false }), "필요한 자료 — 다 꺼져 있으면 아무것도 읽지 않는다");
  check(need({ evening: true }) === JSON.stringify({ analyses: true, goals: false, garden: false }), "필요한 자료 — 저녁은 분석 목록만");
  check(need({ hungry: true }) === JSON.stringify({ analyses: true, goals: false, garden: true }), "필요한 자료 — 배고픔은 분석 목록(오늘 먹었나) + 정원(동물)");
  check(need({ goal: true }) === JSON.stringify({ analyses: false, goals: true, garden: false }), "필요한 자료 — 목표는 목표 목록만");
}

/* ── 6. 알림 데이터 링크 ──────────────────────────────── */
check(R.linkOf({ link: "/goals" }) === "/goals" && R.linkOf(null) === null && R.linkOf("x") === null && R.linkOf({}) === null && R.linkOf({ link: 3 }) === null && R.linkOf({ link: "/" + "a".repeat(300) }) === null, "알림 데이터 — 링크가 문자열이고 200자 이하일 때만 (그 뒤 routeFor가 한 번 더 거른다)");

if (failures.length) {
  console.error(`\n실패 ${failures.length}건: ${failures.join(" · ")}`);
  process.exit(1);
}
console.log(`\n통과 (TZ=${process.env.TZ})`);
