/**
 * M7 검증 — 목표 · 배지 · 커뮤니티 계산 로직 (Node · 에이전트 자동 실행용)
 *
 *   node scripts/verify-M7-logic.mjs
 *
 * `src/logic/*.ts`는 순수 파일이라 Node(타입 제거 실행)로 바로 돌린다. 공유 코드 `@/shared/*`를 런타임에 import하므로 `@/` 경로를 src/로 푸는 해석 훅을 단다.
 * 날짜는 **날짜 키 + KST**로만 계산한다 — 그래서 **시간대 3개(Asia/Seoul · UTC · America/Los_Angeles)에서 다시 실행해 답이 같아야** 통과다.
 *
 * 확인 항목
 *   1. 달력(logic/calendar.ts) — 날짜 키 검증(없는 날짜 · 윤년) · 일 수 더하기 · 요일 · 달력 격자 · 달 이동
 *   2. 목표(logic/goals.ts, 7-1) — 기간 진행률(KST 경계) · 시작 전 · 끝남 · 목록 나누기 · 기본값 · 입력 검증(서버와 같은 규칙) · 시작일 바꾸면 종료일 · 수정 본문 · 분 입력 파싱
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
    console.error(`\nM7 로직 검증 실패 — ${failed}개 시간대`);
    process.exit(1);
  }
  console.log(`\nM7 로직 검증을 통과했습니다 (${ZONES.join(" · ")}).`);
  process.exit(0);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");

// `@/foo/bar` → src/foo/bar.ts (Metro · tsconfig paths와 같은 규칙)
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

const load = (...parts) => import(pathToFileURL(join(SRC, ...parts)).href);

const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** KST 벽시계 시각 → 절대 시각(ms). 실행 시간대와 무관하다 */
const at = (y, mo, d, h = 0, mi = 0) => Date.UTC(y, mo - 1, d, h - 9, mi);

/* ── 1. 달력 ────────────────────────────────────────────────── */
{
  const C = await load("logic", "calendar.ts");

  check(C.isDateKey("2026-02-28") && C.isDateKey("2024-02-29") && C.isDateKey("2026-12-31"), "실제 있는 날짜는 날짜 키로 통한다 (윤년 2월 29일 포함)");
  check(!C.isDateKey("2026-02-29") && !C.isDateKey("2026-02-30") && !C.isDateKey("2026-04-31"), "없는 날짜(평년 2월 29일 · 2월 30일 · 4월 31일)는 거른다");
  check(!C.isDateKey("2026-13-01") && !C.isDateKey("2026-00-10") && !C.isDateKey("2026-10-00"), "13월 · 0월 · 0일은 거른다");
  check(!C.isDateKey("2026-1-1") && !C.isDateKey("") && !C.isDateKey("abc") && !C.isDateKey("2026-10-13T00:00:00Z"), "형식이 다르면(0 채움 없음 · 빈 값 · 시각 포함) 거른다");

  check(C.addDays("2026-12-31", 1) === "2027-01-01" && C.addDays("2026-03-01", -1) === "2026-02-28" && C.addDays("2024-03-01", -1) === "2024-02-29", "일 수 더하기 — 해 · 달 · 윤년 경계");
  check(C.addDays("2026-10-13", 7) === "2026-10-20" && C.addDays("2026-10-13", 0) === "2026-10-13" && C.addDays("2026-10-13", 400) === "2027-11-17", "일 수 더하기 — 일주일 · 0 · 400일");
  check(C.addDays("엉터리", 3) === "엉터리", "잘못된 키는 그대로 돌려준다");

  check(C.daysBetween("2026-09-14", "2026-09-20") === 6 && C.daysBetween("2026-09-20", "2026-09-14") === -6 && C.daysBetween("2026-10-13", "2026-10-13") === 0, "날짜 사이 일 수 — 부호 · 0");
  check(C.daysBetween("2026-02-28", "2026-03-01") === 1 && C.daysBetween("2024-02-28", "2024-03-01") === 2, "날짜 사이 일 수 — 평년 · 윤년");
  check(C.daysBetween("x", "2026-10-13") === null && C.daysBetween("2026-10-13", "2026-02-30") === null, "잘못된 키가 끼면 null");

  check(C.dayOfWeek("2026-10-13") === 2 && C.dayOfWeek("2026-10-11") === 0 && C.dayOfWeek("2026-10-17") === 6, "요일 — 2026-10-13은 화(2) · 일(0) · 토(6)");
  check(C.dateLabel("2026-10-13") === "2026.10.13 (화)" && C.dateLabel("2026-01-01") === "2026.01.01 (목)" && C.dateLabel("bad") === "bad", "날짜 표기 \"2026.10.13 (화)\"", C.dateLabel("2026-10-13"));

  check(eq(C.yearMonthOf("2026-10-13"), { year: 2026, month: 10 }) && C.yearMonthOf("2026-02-30") === null, "키 → 연 · 월");
  check(eq(C.addMonths({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 }) && eq(C.addMonths({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 }) && eq(C.addMonths({ year: 2026, month: 5 }, 14), { year: 2027, month: 7 }) && eq(C.addMonths({ year: 2026, month: 3 }, -15), { year: 2024, month: 12 }), "달 이동 — 해 넘김 · 여러 달");
  check(C.monthLabel({ year: 2026, month: 10 }) === "2026년 10월", "달 이름");
  check(C.daysInMonth({ year: 2026, month: 2 }) === 28 && C.daysInMonth({ year: 2024, month: 2 }) === 29 && C.daysInMonth({ year: 2026, month: 4 }) === 30 && C.daysInMonth({ year: 2026, month: 12 }) === 31, "달의 일 수 — 평년 · 윤년 · 30 · 31");

  // 달력 격자 — 항상 7칸 · 일요일 시작 · 1일부터 말일까지 차례로
  const oct = C.monthGrid({ year: 2026, month: 10 });
  check(oct.length === 5 && oct.every((w) => w.length === 7), "2026년 10월 — 5주 · 한 주 7칸");
  check(eq(oct[0].slice(0, 4), [null, null, null, null]) && oct[0][4] === "2026-10-01" && oct[4][6] === "2026-10-31", "2026년 10월 — 1일은 목요일(앞 빈칸 4) · 31일은 토요일 칸");
  const feb = C.monthGrid({ year: 2026, month: 2 });
  check(feb.length === 4 && feb.flat().every((c) => c !== null) && feb[0][0] === "2026-02-01", "2026년 2월 — 일요일에 시작해 28일이 정확히 4주 (빈칸 없음)");
  const mar = C.monthGrid({ year: 2026, month: 3 });
  check(mar.length === 5 && mar[4].filter((c) => c === null).length === 4, "2026년 3월 — 마지막 주는 뒤가 빈칸으로 채워진다");
  let ordered = true;
  for (let year = 2024; year <= 2027; year++)
    for (let month = 1; month <= 12; month++) {
      const days = C.monthGrid({ year, month }).flat().filter((c) => c !== null);
      const total = C.daysInMonth({ year, month });
      if (days.length !== total || days.some((k, i) => k !== C.keyOf(year, month, i + 1))) ordered = false;
    }
  check(ordered, "2024~2027 모든 달 — 격자의 날짜가 1일부터 말일까지 빠짐없이 차례로 있다");
}

/* ── 2. 목표 (7-1) ──────────────────────────────────────────── */
{
  const G = await load("logic", "goals.ts");
  const NOW = at(2026, 9, 17, 10, 0);
  const goal = (start, end, status = "active", extra = {}) => ({
    id: "g",
    userId: "u",
    title: "목표",
    targetMinutes: 60,
    startDate: `${start}T00:00:00.000Z`,
    endDate: `${end}T00:00:00.000Z`,
    status,
    createdAt: `${start}T03:00:00.000Z`,
    ...extra,
  });

  check(G.goalDateKey("2026-09-14T00:00:00.000Z") === "2026-09-14", "서버 날짜(UTC 자정) → 사용자가 고른 날짜 그대로");

  // 기간 진행 — 2026-09-17(목 · KST) 기준
  const a = G.goalSpan(goal("2026-09-14", "2026-09-20"), NOW);
  check(a.total === 7 && a.done === 4 && a.left === 3 && a.pct === 57 && a.startsIn === 0 && !a.expired, "9/14~9/20 · 오늘 9/17 → 7일 중 4일 · 3일 남음 · 57%", JSON.stringify(a));
  const b = G.goalSpan(goal("2026-09-15", "2026-09-29"), NOW);
  check(b.total === 15 && b.done === 3 && b.left === 12 && b.pct === 20, "9/15~9/29 → 15일 중 3일 · 12일 남음 · 20%");
  const c = G.goalSpan(goal("2026-09-01", "2026-09-10"), NOW);
  check(c.total === 10 && c.done === 10 && c.left === 0 && c.pct === 100 && c.expired, "이미 끝난 기간 — 100%로 묶고 \"끝났다\"");
  const d = G.goalSpan(goal("2026-09-21", "2026-09-27"), NOW);
  check(d.done === 0 && d.pct === 0 && d.startsIn === 4 && !d.expired && d.total === 7, "시작 전 — 0% · 4일 뒤 시작");

  // KST 날짜 경계 — 기기 시간대와 무관해야 한다
  const g = goal("2026-09-14", "2026-09-20");
  check(G.goalSpan(g, at(2026, 9, 14, 0, 0)).done === 1 && G.goalSpan(g, at(2026, 9, 13, 23, 59)).startsIn === 1, "시작일 KST 00:00에 첫날이 된다 (그 1분 전은 하루 전)");
  check(G.goalSpan(g, at(2026, 9, 14, 8, 59)).done === 1, "KST 오전 8:59(UTC로는 전날)도 같은 날로 센다");
  const last = G.goalSpan(g, at(2026, 9, 20, 23, 59));
  check(last.left === 0 && last.done === 7 && !last.expired && G.goalNote(last) === "7일 중 7일 지남 · 오늘이 마지막 날이에요", "종료일 KST 23:59까지는 아직 기간 안 — \"오늘이 마지막 날이에요\"", G.goalNote(last));
  check(G.goalSpan(g, at(2026, 9, 21, 0, 0)).expired && G.goalSpan(g, at(2026, 9, 21, 0, 0)).done === 7, "종료일 다음 KST 00:00에 끝난다");
  check(!G.goalSpan(g, at(2026, 9, 19, 12)).expired && G.goalSpan(g, at(2026, 9, 19, 12)).left === 1, "종료일 전날은 \"1일 남음\"");
  check(G.goalSpan(goal("2026-09-14", "2026-09-14"), NOW).total === 1, "시작일 = 종료일이어도 최소 하루로 센다");

  // 진행 줄 문구
  check(G.goalNote(a) === "7일 중 4일 지남 · 3일 남음", "진행 줄 — 진행 중", G.goalNote(a));
  check(G.goalNote(c) === "10일 중 10일 지남 · 기간이 끝났어요", "진행 줄 — 끝남", G.goalNote(c));
  check(G.goalNote(d) === "아직 시작 전이에요 · 4일 뒤 시작", "진행 줄 — 시작 전", G.goalNote(d));

  // 목록 나누기
  const list = [goal("2026-09-01", "2026-09-07", "completed", { id: "1" }), goal("2026-09-14", "2026-09-20", "active", { id: "2" }), goal("2026-09-14", "2026-09-20", "paused", { id: "3" })];
  const split = G.splitGoals(list);
  check(eq(split.active.map((x) => x.id), ["2", "3"]) && eq(split.done.map((x) => x.id), ["1"]), "목록 나누기 — 완료가 아닌 것(일시정지 포함)은 진행 중 · 서버 순서 유지");
  check(G.goalsEyebrow(null) === "불러오는 중" && G.goalsEyebrow(list) === "진행 중 2개 · 완료 1개" && G.goalsEyebrow([]) === "진행 중 0개 · 완료 0개", "머리글 요약");

  // 기본값 — 오늘(KST)부터 일주일. KST 새벽에도 UTC 날짜가 아니다
  check(eq(G.defaultGoalForm(NOW), { title: "", targetMinutes: 60, startDate: "2026-09-17", endDate: "2026-09-24" }), "새 목표 기본값 — 오늘(KST)부터 일주일 · 60분");
  check(G.defaultGoalForm(at(2026, 9, 17, 0, 30)).startDate === "2026-09-17" && G.defaultGoalForm(at(2026, 9, 17, 23, 30)).startDate === "2026-09-17", "KST 새벽 0:30에 열어도 시작일은 오늘 (UTC 날짜로 채우면 어제가 된다)");
  check(G.defaultGoalForm(at(2026, 12, 28, 10)).endDate === "2027-01-04", "기본 종료일이 해를 넘겨도 맞다");

  // 입력 검증 — 서버와 같은 규칙
  const ok = { title: "  하루 2시간  ", targetMinutes: 120, startDate: "2026-09-17", endDate: "2026-09-24" };
  const res = G.validateGoalForm(ok);
  check(res.ok && eq(res.input, { title: "하루 2시간", targetMinutes: 120, startDate: "2026-09-17", endDate: "2026-09-24" }), "정상 입력 — 제목은 앞뒤 공백을 자르고 요청 본문이 된다");
  const bad = (over) => G.validateGoalForm({ ...ok, ...over });
  check(bad({ title: "   " }).error === "제목을 입력해주세요." && bad({ title: "" }).error === "제목을 입력해주세요.", "제목이 비면 거절");
  check(bad({ title: "가".repeat(201) }).error === "제목은 200자까지 쓸 수 있어요." && bad({ title: "가".repeat(200) }).ok, "제목 200자까지 (201자는 거절)");
  check(bad({ targetMinutes: null }).ok === false && bad({ targetMinutes: 0 }).ok === false && bad({ targetMinutes: 10081 }).ok === false && bad({ targetMinutes: 1.5 }).ok === false, "하루 시간 — 비어 있음 · 0 · 10081 · 소수는 거절");
  check(bad({ targetMinutes: 1 }).ok && bad({ targetMinutes: 10080 }).ok, "하루 시간 — 1분 · 10080분은 통과");
  check(bad({ startDate: "" }).error === "기간을 설정해주세요." && bad({ endDate: "2026-02-30" }).error === "기간을 설정해주세요.", "날짜가 비었거나 없는 날짜면 거절");
  check(bad({ endDate: "2026-09-17" }).error === "종료일은 시작일 이후여야 합니다." && bad({ endDate: "2026-09-10" }).error === "종료일은 시작일 이후여야 합니다.", "종료일이 시작일과 같거나 앞서면 거절 (서버도 400)");
  check(bad({ endDate: "2026-09-18" }).ok, "종료일이 시작일 다음 날이면 통과");

  // 시작일을 바꿀 때 종료일
  const f = { title: "t", targetMinutes: 60, startDate: "2026-09-17", endDate: "2026-09-24" };
  check(eq(G.withStartDate(f, "2026-09-20"), { ...f, startDate: "2026-09-20" }), "시작일을 종료일 앞으로 바꾸면 종료일은 그대로");
  check(eq(G.withStartDate(f, "2026-09-24"), { ...f, startDate: "2026-09-24", endDate: "2026-10-01" }) && eq(G.withStartDate(f, "2026-10-05"), { ...f, startDate: "2026-10-05", endDate: "2026-10-12" }), "시작일이 종료일 이후가 되면 종료일을 시작일 일주일 뒤로 끌고 간다");

  // 수정 본문 — 바뀐 필드만
  const existing = goal("2026-09-14", "2026-09-20", "active", { title: "하루 4시간 이하", targetMinutes: 240 });
  const same = G.validateGoalForm(G.formFromGoal(existing));
  check(same.ok && G.patchFromForm(existing, same.input) === null, "수정 — 아무것도 안 바꾸면 보낼 것이 없다 (null · 서버는 빈 수정을 400으로 거절한다)");
  check(eq(G.patchFromForm(existing, { ...same.input, title: "새 제목" }), { title: "새 제목" }), "수정 — 제목만 바꾸면 제목만 보낸다");
  check(eq(G.patchFromForm(existing, { ...same.input, targetMinutes: 120, endDate: "2026-09-25" }), { targetMinutes: 120, endDate: "2026-09-25" }), "수정 — 시간 · 종료일을 바꾸면 그 둘만 보낸다");

  // 분 입력
  check(G.parseMinutes("") === null && G.parseMinutes("abc") === null && G.parseMinutes("90분") === 90 && G.parseMinutes("007") === 7 && G.parseMinutes("12.5") === 125, "분 입력 — 숫자만 남긴다 (빈 값 · 글자만 → null)");
  check(G.parseMinutes("99999") === 10080 && G.parseMinutes("10080") === 10080 && G.parseMinutes("0") === 0, "분 입력 — 상한(10080)을 넘으면 상한으로 · 0은 0 (검증이 거절한다)");
  check(G.GOAL_PRESETS.join() === "30,60,90,120,180", "빠른 선택 — 웹과 같은 5개");
}

/* ── 3. 배지 (7-2) ──────────────────────────────────────────── */
{
  const B = await load("logic", "badges.ts");
  const U = await load("shared", "badge-utils.ts");
  const NOW = at(2026, 9, 17, 10, 0); // 목요일 — 이번 주 월 9/14 ~ 일 9/20
  const rec = (id, periodType, y, mo, d, h, mi = 0) => ({ id, periodType, totalMinutes: 200, detoxScore: 60, isPremium: false, createdAt: new Date(at(y, mo, d, h, mi)).toISOString() });

  // 통계
  const list = [
    rec("d1", "daily", 2026, 9, 16, 21),
    rec("d2", "daily", 2026, 9, 15, 21),
    rec("d3", "daily", 2026, 9, 14, 0, 30), // 월요일 새벽 (UTC로는 일요일) — 이번 주
    rec("d4", "daily", 2026, 9, 13, 23, 30), // 지난 일요일 밤 — 지난주
    rec("w1", "weekly", 2026, 9, 13, 22),
    rec("d5", "daily", 2026, 9, 16, 9), // 같은 날 둘 — 하루로 센다
  ];
  const stats = B.badgeStats(list, 5, NOW);
  check(stats.total === 6 && stats.weekly === 1 && stats.dailyThisWeek === 3 && stats.streak === 5, "통계 — 전체 6 · 주간 1 · 이번 주 일간 3 (KST 월~일 · 같은 날 둘은 하루) · 연속 5", JSON.stringify(stats));
  check(B.badgeStats([], 0, NOW).total === 0 && B.badgeStats([], 0, NOW).dailyThisWeek === 0, "분석이 없으면 0");
  check(B.badgeStats([], Number.NaN, NOW).streak === 0 && B.badgeStats([], -3, NOW).streak === 0 && B.badgeStats([], 4.7, NOW).streak === 4, "연속 기록 — 깨진 값은 0 · 소수는 버린다");
  check(B.badgeStats([rec("a", "daily", 2026, 9, 20, 23, 59)], 0, NOW).dailyThisWeek === 1 && B.badgeStats([rec("a", "daily", 2026, 9, 21, 0, 1)], 0, NOW).dailyThisWeek === 0, "이번 주 경계 — 일요일 23:59는 이번 주 · 월요일 00:01은 다음 주");

  // 잠긴 배지의 진행도
  const s0 = { total: 14, weekly: 1, dailyThisWeek: 3, streak: 5 };
  const first = B.lockedProgress("첫 분석", s0);
  check(first.ratio === 1 && first.note === "AI 분석 1회면 획득" && B.lockedProgress("첫 분석", { ...s0, total: 0 }).ratio === 0, "첫 분석 — 분석이 있으면 1 · 없으면 0");
  const week = B.lockedProgress("주간 분석 완료", s0);
  check(Math.abs(week.ratio - 3 / 7) < 1e-9 && week.note === "이번 주 일간 분석 3 / 7회" && B.lockedProgress("주간 분석 완료", { ...s0, dailyThisWeek: 7 }).ratio === 1, "주간 분석 완료 — 3 / 7", week.note);
  const streak = B.lockedProgress("7일 연속", s0);
  check(Math.abs(streak.ratio - 5 / 7) < 1e-9 && streak.note === "2일 더 이어가면 획득", "7일 연속 — 5일째면 \"2일 더\"", streak.note);
  check(B.lockedProgress("7일 연속", { ...s0, streak: 0 }).note === "연속 기록을 시작해 보세요" && B.lockedProgress("7일 연속", { ...s0, streak: 9 }).ratio === 1 && B.lockedProgress("7일 연속", { ...s0, streak: 9 }).note === "0일 더 이어가면 획득", "7일 연속 — 0일이면 시작 안내 · 7일 넘으면 1로 묶는다");
  check(B.lockedProgress("목표 달성", s0).ratio === 0 && B.lockedProgress("목표 달성", s0).note === "목표를 하나 완료하면 획득", "목표 달성 — 진행도 없음 · 안내");
  const none = B.lockedProgress("7일 연속", null);
  check(none.ratio === null && none.note === U.getBadgeDef("7일 연속").requirement, "통계를 못 읽었으면 막대 없음(null) · 달성 조건 문구", none.note);
  check(B.lockedProgress("처음 보는 배지", s0).ratio === 0 && B.lockedProgress("처음 보는 배지", s0).note === "", "정의에 없는 배지도 깨지지 않는다");

  // 목록 나누기
  const earned = (name, id) => ({ id, userId: "u", name, earnedAt: "2026-09-16T00:00:00.000Z", shared: false });
  const split = B.splitBadges([earned("첫 분석", "1"), earned("7일 연속", "2")]);
  check(eq(split.earned.map((b) => b.id), ["1", "2"]) && eq(split.locked.map((b) => b.name), ["주간 분석 완료", "목표 달성"]), "획득 2 → 잠긴 배지는 정의 순서로 둘 (주간 분석 완료 · 목표 달성)");
  check(B.splitBadges([]).locked.length === U.ALL_BADGES.length && B.splitBadges(U.ALL_BADGES.map((b, i) => earned(b.name, String(i)))).locked.length === 0, "아무것도 없으면 전부 잠김 · 전부 있으면 잠긴 것 없음");
  check(B.splitBadges([earned("서버에만 있는 배지", "x")]).earned.length === 1, "정의에 없는 이름의 배지도 획득 목록에 남는다");
  check(B.badgesEyebrow(null) === "불러오는 중" && B.badgesEyebrow([earned("첫 분석", "1")]) === "1개 획득 · 3개 남음", "머리글 요약");

  // 자랑하기 한마디
  check(eq(B.shareMessage("  드디어!  "), { ok: true, content: "드디어!" }) && eq(B.shareMessage("   "), { ok: true, content: "" }) && eq(B.shareMessage(""), { ok: true, content: "" }), "한마디 — 공백을 자르고 비어도 된다 (선택 사항)");
  check(B.shareMessage("가".repeat(1000)).ok && B.shareMessage("가".repeat(1001)).ok === false && B.SHARE_MESSAGE_MAX === 1000, "한마디 1000자까지 (서버 한도와 같다)");
  check(U.ALL_BADGES.length === 4 && U.ALL_BADGES.every((b) => b.icon.d.length > 0 && ["fill", "stroke"].includes(b.icon.mode)), "공유 배지 정의 4개 — 모두 아이콘 모양이 있다");
}

/* ── 4. 커뮤니티 (7-3) ──────────────────────────────────────── */
{
  const K = await load("logic", "community.ts");
  const post = (id, over = {}) => ({ id, type: "text", content: `글 ${id}`, badgeName: null, likeCount: 0, commentCount: 0, createdAt: "2026-09-16T00:00:00.000Z", authorName: "지우", isMine: false, liked: false, ...over });

  // 피드 목록
  const first = [post("a"), post("b"), post("c")];
  const merged = K.appendPage(first, [post("c"), post("d"), post("e")]);
  check(eq(merged.map((p) => p.id), ["a", "b", "c", "d", "e"]), "다음 페이지 — 이미 있는 글(c)은 건너뛰고 이어 붙인다 (커서가 밀려 겹쳐 와도 중복 없음)");
  check(K.appendPage([], [post("a")]).length === 1 && K.appendPage(first, []).length === 3 && first.length === 3, "빈 페이지 · 빈 목록 · 원본은 바뀌지 않는다");
  const patched = K.patchPost(first, "b", { likeCount: 5, liked: true });
  check(patched[1].likeCount === 5 && patched[1].liked && first[1].likeCount === 0 && patched[0] === first[0], "글 하나만 고친다 (다른 글 · 원본은 그대로)");
  check(eq(K.removePost(first, "b").map((p) => p.id), ["a", "c"]) && K.removePost(first, "없음").length === 3, "글 삭제 — 없는 id는 아무 일도 없다");
  check(K.indexOfPost(first, "c") === 2 && K.indexOfPost(first, "z") === -1 && K.indexOfPost(first, null) === -1 && K.indexOfPost(first, undefined) === -1, "알림 링크의 글 자리 — 첫 페이지에 없으면 -1");

  // 좋아요 · 댓글 수
  check(eq(K.likeOptimistic({ liked: false, likeCount: 2 }), { liked: true, likeCount: 3 }) && eq(K.likeOptimistic({ liked: true, likeCount: 3 }), { liked: false, likeCount: 2 }), "좋아요 낙관적 계산 — 누르면 +1 · 다시 누르면 −1");
  check(K.likeOptimistic({ liked: true, likeCount: 0 }).likeCount === 0, "좋아요 수는 0 아래로 내려가지 않는다 (서버와 어긋난 값이 와도)");
  check(K.commentCountAfter(3, 1) === 4 && K.commentCountAfter(3, -1) === 2 && K.commentCountAfter(0, -1) === 0, "댓글 수 — 더하기 · 빼기 · 0 아래로 안 간다");

  // 입력
  check(K.checkPost("   \n  ").ok === false && K.checkPost("   ").empty === true && K.checkPost("").empty === true, "글 — 공백만이면 못 올린다 (비어 있음으로 알린다)");
  check(eq(K.checkPost("  안녕  "), { ok: true, text: "안녕" }), "글 — 앞뒤 공백을 자른다");
  check(K.checkPost("가".repeat(1000)).ok && K.checkPost("가".repeat(1001)).ok === false && K.checkPost("가".repeat(1001)).error === "내용은 1000자까지 쓸 수 있어요.", "글 — 1000자까지 (1001자는 거절)");
  check(K.checkComment("가".repeat(300)).ok && K.checkComment("가".repeat(301)).error === "댓글은 300자까지 쓸 수 있어요." && K.checkComment("  ").empty, "댓글 — 300자까지 · 공백만이면 비어 있음");
  check(K.checkPost("줄\n바꿈").ok && K.checkPost("줄\n바꿈").text === "줄\n바꿈", "글 — 줄바꿈은 그대로 둔다");
  check(K.POST_MAX === 1000 && K.COMMENT_MAX === 300 && K.NOTICE_KEY === "offlo_community_notice_dismissed", "상수 — 웹 서버 한도와 같다");
  check(K.initialOf("지우") === "지" && K.initialOf("  alice") === "A" && K.initialOf("") === "?" && K.initialOf(null) === "?" && K.initialOf("   ") === "?", "아바타 글자 — 첫 글자(영문은 대문자) · 비면 ?");

  // 상대 시간
  const NOW = at(2026, 9, 17, 10, 0);
  const ago = (ms) => new Date(NOW - ms).toISOString();
  const S = 1000, M = 60 * S, H = 60 * M, D = 24 * H;
  check(K.relativeTime(ago(30 * S), NOW) === "방금" && K.relativeTime(ago(59 * S), NOW) === "방금" && K.relativeTime(ago(60 * S), NOW) === "1분 전", "방금 → 1분 전 (59초 / 60초)");
  check(K.relativeTime(ago(59 * M), NOW) === "59분 전" && K.relativeTime(ago(60 * M), NOW) === "1시간 전" && K.relativeTime(ago(23 * H + 59 * M), NOW) === "23시간 전", "분 → 시간 경계");
  check(K.relativeTime(ago(24 * H), NOW) === "1일 전" && K.relativeTime(ago(6 * D + 23 * H), NOW) === "6일 전", "시간 → 일 경계");
  check(K.relativeTime("2026-09-04T16:00:00.000Z", NOW) === "9.05", "7일이 넘으면 날짜 — KST로 센다 (UTC 9/4 16:00 = KST 9/5 → \"9.05\")", K.relativeTime("2026-09-04T16:00:00.000Z", NOW));
  check(K.relativeTime("2026-08-31T15:30:00.000Z", NOW) === "9.01", "달을 넘겨도 KST 날짜 (UTC 8/31 15:30 = KST 9/1)");
  check(K.relativeTime(new Date(NOW + 5 * M).toISOString(), NOW) === "방금" && K.relativeTime("엉터리", NOW) === "", "미래(시계 어긋남)는 방금 · 읽을 수 없으면 빈 글자");

  // 랭킹
  const entry = (rank, isMe = false) => ({ rank, name: `사람${rank}`, avgScore: 90 - rank, analysisCount: 5, isMe });
  const inTop = K.rankingView({ ranking: [entry(1), entry(2, true), entry(3)], myRank: entry(2, true) });
  check(inTop.rows.length === 3 && inTop.mine === null, "랭킹 — Top 10 안에 내가 있으면 아래에 또 보이지 않는다");
  const outside = K.rankingView({ ranking: [entry(1), entry(2)], myRank: entry(14, true) });
  check(outside.mine?.rank === 14, "랭킹 — Top 10 밖이면 내 순위를 따로 보인다");
  check(K.rankingView({ ranking: [], myRank: null }).mine === null && K.rankingView({ ranking: [entry(1)], myRank: null }).mine === null, "랭킹 — 내 순위가 없으면(분석 3회 미만) 따로 안 보인다");
  check(K.rankingEmptyText(3) === "아직 랭킹에 오른 사람이 없어요. 최근 7일간 일간 분석을 3회 이상 하면 순위에 등록됩니다.", "랭킹 빈 안내");
}

/* ── 5. 설정 (7-4) ──────────────────────────────────────────── */
{
  const S = await load("logic", "settings.ts");

  // 이름
  check(eq(S.checkName("  새 이름  ", "지우"), { ok: true, name: "새 이름", changed: true }), "이름 — 앞뒤 공백을 자르고 바뀌었다고 알린다");
  check(eq(S.checkName("지우", "지우"), { ok: true, name: "지우", changed: false }) && S.checkName("  지우 ", "지우").changed === false, "이름 — 지금 이름과 같으면(공백만 달라도) 바뀌지 않았다 · 보낼 필요 없다");
  check(S.checkName("", "지우").ok === false && S.checkName("", "지우").empty === true && S.checkName("   ", "지우").empty === true, "이름 — 비면 \"이름을 입력해주세요.\" (비어 있음으로 알린다)", S.checkName("  ", "지우").error);
  check(S.checkName("가".repeat(100), "지우").ok && S.checkName("가".repeat(101), "지우").ok === false && S.checkName("가".repeat(101), "지우").error === "이름은 100자까지 쓸 수 있어요.", "이름 — 100자까지 (101자는 거절 · 서버도 같은 한도)");
  check(S.checkName("Jiwoo", "jiwoo").changed === true, "이름 — 대소문자가 달라도 다른 이름");
  check(S.NAME_MAX === 100, "이름 한도는 서버와 같은 100");

  // 탈퇴 확인
  check(S.DELETE_PHRASE === "탈퇴" && S.canDeleteAccount("탈퇴") && S.canDeleteAccount(" 탈퇴 "), "탈퇴 확인 — \"탈퇴\"를 입력하면 열린다 (앞뒤 공백은 봐준다)");
  check(!S.canDeleteAccount("") && !S.canDeleteAccount("탈퇴합니다") && !S.canDeleteAccount("탈 퇴") && !S.canDeleteAccount("탈") && !S.canDeleteAccount("withdraw"), "탈퇴 확인 — 비었거나 다르면 닫혀 있다");
  check(S.DELETE_LOSSES.length === 5 && S.DELETE_LOSSES.every((x) => x.length > 0), "탈퇴로 지워지는 것 5가지를 안내한다");

  // 로그인 방식 · 가입일
  check(S.providerLabel(["google.com"]) === "Google" && S.providerLabel(["apple.com"]) === "Apple" && S.providerLabel(["password"]) === "이메일", "로그인 방식 라벨 — Google · Apple · 이메일");
  check(S.providerLabel(["apple.com", "google.com"]) === "Google" && S.providerLabel([]) === "소셜 로그인" && S.providerLabel(["facebook.com"]) === "소셜 로그인", "로그인 방식 — 여럿이면 Google 먼저 · 모르면 \"소셜 로그인\"");
  check(S.joinedLabel("2026-08-01T00:00:00.000Z") === "2026.08.01" && S.joinedLabel("2026-07-31T16:00:00.000Z") === "2026.08.01" && S.joinedLabel("2026-07-31T14:59:59.000Z") === "2026.07.31", "가입일 — 한국 날짜로 센다 (UTC 7/31 16:00 = KST 8/1)");
  check(S.joinedLabel("엉터리") === "", "가입일 — 읽을 수 없으면 빈 글자");

  // 서버가 이름 변경을 아직 모를 때
  const old = "이 서버는 아직 이름 변경을 지원하지 않아요. 서버가 업데이트된 뒤에 다시 시도해주세요.";
  check(S.nameSaveHint(405, "Method Not Allowed") === old && S.nameSaveHint(404, "Not Found") === old, "서버가 이름 변경을 모르면(404 · 405) 업데이트 안내");
  check(S.nameSaveHint(400, "이름은 1~100자여야 합니다.") === "이름은 1~100자여야 합니다." && S.nameSaveHint(0, "연결 안 됨") === "연결 안 됨" && S.nameSaveHint(500, "서버 문제") === "서버 문제", "그 밖의 실패는 서버 문구 그대로");
}

if (failures.length) {
  console.error(`\n실패 ${failures.length}건: ${failures.join(" · ")}`);
  process.exit(1);
}
console.log(`\n통과 (TZ=${process.env.TZ})`);
