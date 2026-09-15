/**
 * M4 검증 — 대시보드 · 기록 계산 로직 (Node · 에이전트 자동 실행용)
 *
 *   node scripts/verify-M4-logic.mjs
 *
 * src/logic/*.ts 는 타입만 import하는 순수 파일이라 Node(타입 제거 실행)로 바로 돌린다.
 * 날짜 계산은 시간대에 따라 답이 달라지므로 **Asia/Seoul로 고정해** 다시 실행한다.
 *
 * 확인 항목
 *   1. 주간 막대 — 월요일 시작 · 오늘/미래 · 기기 시간대 기준 요일 (웹의 UTC 버그 재현 표본 포함)
 *   2. 오늘 · 어제 — 오늘 날짜의 기록만 "오늘"이다 (웹은 가장 최근 기록을 오늘로 쓴다)
 *   3. 각주 · 평균 · 목표 진행 · 이름 · AI 한마디
 *   4. 기록 — 필터 · 추이(최근 20건 · 7건 변화폭) · 상위 앱(appName)
 */
import { spawnSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

if (process.env.TZ !== "Asia/Seoul") {
  const run = spawnSync(process.execPath, process.execArgv.concat(process.argv.slice(1)), {
    stdio: "inherit",
    env: { ...process.env, TZ: "Asia/Seoul" },
  });
  process.exit(run.status ?? 1);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const load = (file) => import(pathToFileURL(join(ROOT, "src", "logic", file)).href);
const d = await load("dashboard.ts");
const h = await load("history.ts");

const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

check(new Date(Date.UTC(2026, 8, 16, 23, 0)).getHours() === 8, "시간대 = Asia/Seoul", process.env.TZ);

/** 2026-09-17 목요일 오전 10시 (KST) */
const NOW = new Date(2026, 8, 17, 10, 0, 0);
const row = (id, iso, totalMinutes, detoxScore = 60, periodType = "daily", apps) => ({
  id,
  periodType,
  totalMinutes,
  detoxScore,
  isPremium: false,
  createdAt: iso,
  ...(apps && { apps }),
});

/* ── 1. 주간 막대 ──────────────────────────────────────────── */
{
  const analyses = [
    // KST 9/17 08:00 = UTC 9/16 23:00 — 웹은 slice(0,10) 때문에 수요일로 넣는다
    row("today-early", "2026-09-16T23:00:00.000Z", 252),
    row("today-dup", "2026-09-16T22:00:00.000Z", 999), // 같은 날 더 오래된 기록 — 무시돼야 한다
    row("wed-weekly", "2026-09-16T12:00:00.000Z", 2310, 60, "weekly"),
    row("tue", "2026-09-15T12:00:00.000Z", 290),
    row("mon", "2026-09-14T01:00:00.000Z", 318),
    row("last-sun", "2026-09-13T12:00:00.000Z", 500),
  ];
  const week = d.buildWeek(analyses, NOW);
  check(same(week.map((w) => w.day), ["월", "화", "수", "목", "금", "토", "일"]), "월요일 시작 7칸");
  check(week[3].isToday && !week[2].isToday && week.filter((w) => w.isToday).length === 1, "오늘 = 목요일 한 칸");
  check(same(week.map((w) => w.isFuture), [false, false, false, false, true, true, true]), "금·토·일은 미래");
  check(week[3].minutes === 252, "오전 8시(KST) 기록이 오늘 칸에 들어감 (웹 UTC 버그 수정)", `목=${week[3].minutes}`);
  check(week[2].minutes === 0, "주간 분석은 막대에 넣지 않음", `수=${week[2].minutes}`);
  check(week[1].minutes === 290 && week[0].minutes === 318, "화·월 기록 위치");
  check(!week.some((w) => w.minutes === 500), "지난주 일요일은 빠짐");
  check(week[3].minutes !== 999, "같은 날 여러 건이면 최신이 이김");

  /* ── 2. 오늘 · 어제 ─────────────────────────────────────── */
  const { today, yesterday } = d.todayAndYesterday(analyses, NOW);
  check(today?.id === "today-early", "오늘 = 오늘 날짜의 일간 기록");
  check(yesterday === null, "어제(수)는 주간 분석뿐이라 없음");

  const stale = d.todayAndYesterday([row("3days", "2026-09-14T12:00:00.000Z", 300)], NOW);
  check(stale.today === null, "사흘 전 기록을 오늘로 쓰지 않음 (웹은 쓴다)");

  const avg = d.weekAverage(week);
  check(avg.recordedDays === 3 && avg.averageMinutes === Math.round((252 + 290 + 318) / 3), "일 평균은 기록 있는 날만", JSON.stringify(avg));
  check(same(d.weekAverage(d.buildWeek([], NOW)), { recordedDays: 0, averageMinutes: 0 }), "기록 없으면 평균 0");
}

/* ── 3. 각주 · 목표 · 이름 · 한마디 ────────────────────────── */
{
  const t = (m) => row("t", "2026-09-17T01:00:00.000Z", m);
  check(same(d.screenTimeNote(null, null), { text: "오늘 분석을 올려주세요", tone: "muted" }), "각주: 오늘 없음");
  check(same(d.screenTimeNote(t(200), null), { text: "어제 기록이 없어요", tone: "muted" }), "각주: 어제 없음");
  check(same(d.screenTimeNote(t(252), t(290)), { text: "어제보다 38분 ↓", tone: "brand" }), "각주: 줄었으면 브랜드 그린");
  check(same(d.screenTimeNote(t(300), t(290)), { text: "어제보다 10분 ↑", tone: "muted" }), "각주: 늘었음");
  check(same(d.screenTimeNote(t(290), t(290)), { text: "어제와 같아요", tone: "muted" }), "각주: 같음");

  const goal = { startDate: new Date(2026, 8, 10).toISOString(), endDate: new Date(2026, 8, 24).toISOString() };
  check(same(d.goalProgress(goal, NOW), { done: 8, total: 15 }), "목표 진행 8 / 15일", JSON.stringify(d.goalProgress(goal, NOW)));
  check(d.goalProgress(goal, new Date(2026, 8, 1)).done === 0, "시작 전 → 0일");
  check(d.goalProgress(goal, new Date(2026, 9, 30)).done === 15, "종료 후 → 전체 일수에서 멈춤");

  check(d.firstName("홍 길동", "a@b.c") === "홍", "이름: 표시 이름 첫 단어");
  check(d.firstName(null, "jiwoo@example.com") === "jiwoo", "이름: 없으면 이메일 앞부분");
  check(d.firstName("   ", null) === "사용자", "이름: 둘 다 없으면 '사용자'");

  check(d.firstRecommendation(["하루 30분 줄이기", "b"]) === "하루 30분 줄이기", "한마디: 첫 줄");
  check(
    [[], "문자열", [1], ["  "], null].every((v) => d.firstRecommendation(v) === null),
    "한마디: 모양이 이상하면 null",
  );
}

/* ── 4. 기록 ───────────────────────────────────────────────── */
{
  const many = Array.from({ length: 25 }, (_, i) =>
    row(`r${i}`, new Date(2026, 7, 1 + i, 21).toISOString(), 300, 40 + i, i % 5 === 4 ? "weekly" : "daily"),
  ).reverse(); // API처럼 최신이 앞
  check(h.filterAnalyses(many, "all").length === 25, "필터: 전체");
  check(h.filterAnalyses(many, "weekly").length === 5 && h.filterAnalyses(many, "daily").length === 20, "필터: 주간 5 · 일간 20");

  const trend = h.scoreTrend(many);
  check(trend.points.length === 20, "추이: 최근 20건");
  check(trend.points[0].score === 45 && trend.points[19].score === 64, "추이: 오래된 → 최신 순");
  check(trend.latest === 64 && trend.recentCount === 7 && trend.delta === 6, "최근 7건 변화폭 +6", JSON.stringify({ latest: trend.latest, delta: trend.delta }));
  const one = h.scoreTrend([row("x", "2026-09-01T00:00:00Z", 100, 70)]);
  check(one.latest === 70 && one.delta === null, "1건이면 변화폭 없음");
  check(h.scoreTrend([]).latest === null, "0건이면 최신 점수 없음");

  const apps = [
    { appName: "유튜브", minutes: 71, category: "영상" },
    { appName: "인스타그램", minutes: 96, category: "SNS" },
    { appName: "카카오톡", minutes: 40, category: "메신저" },
  ];
  check(h.topApps(row("a", "", 0, 0, "daily", apps)) === "인스타그램 · 유튜브", "상위 앱 2개 — appName (웹 name 버그 수정)");
  check(h.topApps(row("w", "", 0, 0, "weekly", apps)) === "주간 종합 리포트", "주간은 '주간 종합 리포트'");
  check(h.topApps(row("e", "", 0, 0, "daily")) === "—", "앱 없으면 '—'");
  check(h.topApps(row("n", "", 0, 0, "daily", [{ name: "옛 모양", minutes: 10 }])) === "—", "appName이 없는 항목은 건너뜀");
}

if (failures.length) {
  console.error(`\nM4 로직 검증 실패 ${failures.length}건: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nM4 로직 검증을 통과했습니다.");
