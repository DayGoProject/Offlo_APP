/**
 * UIUX 실험 A안 검증 — 홈 문구 · 분석 탭 둘러보기 타일 계산 (Node · 에이전트 자동 실행용)
 *
 *   node scripts/verify-A-logic.mjs
 *
 * `logic/home.ts` · `logic/browse.ts`는 순수 파일이라 Node(타입 제거 실행)로 바로 돌린다. 오늘 · 이번 주는 KST라
 * **시간대 3개(Asia/Seoul · UTC · America/Los_Angeles)에서 다시 실행해 답이 같아야** 통과다 (verify-M5-logic과 같은 방식).
 *
 * 확인 항목
 *   1. koDuration — 분 → "3시간 42분" · "3시간" · "42분" · 이상한 값
 *   2. homeSubline — 오늘 분석했으면 숫자, 아니면 대체 문구
 *   3. topAppThisWeek — 이번 주(KST 월~일) 일간 분석의 앱별 시간을 합쳐 가장 오래 쓴 앱 · 지난주 · 주간 분석은 제외
 *   4. browseTiles — 네 장(오늘 · 이번 주 · 많이 쓴 앱 · 분석 기록) · 불러오기 전 · 분석 전 · 7개 완료 문구
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
    console.error(`\nA안 로직 검증 실패 — ${failed}개 시간대`);
    process.exit(1);
  }
  console.log(`\nA안 로직 검증을 통과했습니다 (${ZONES.join(" · ")}).`);
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

const load = (file) => import(pathToFileURL(join(SRC, "logic", file)).href);
const home = await load("home.ts");
const browse = await load("browse.ts");

const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};

/** KST 벽시계 시각 → 절대 시각(ms). 실행 시간대와 무관하다 */
const at = (y, mo, d, h = 0, mi = 0) => Date.UTC(y, mo - 1, d, h - 9, mi);
const row = (id, ms, totalMinutes, detoxScore, apps, periodType = "daily") => ({
  id,
  periodType,
  totalMinutes,
  detoxScore,
  isPremium: false,
  createdAt: new Date(ms).toISOString(),
  ...(apps && { apps }),
});
const app = (appName, minutes) => ({ appName, minutes, category: "etc" });

/** 2026-09-17 목요일 오전 10시 (KST) — 이번 주는 9/14(월) ~ 9/20(일) */
const NOW = at(2026, 9, 17, 10);

/* ── 1. koDuration ─────────────────────────────────────────── */
check(home.koDuration(222) === "3시간 42분", "koDuration: 222분 → 3시간 42분", home.koDuration(222));
check(home.koDuration(180) === "3시간", "koDuration: 180분 → 3시간");
check(home.koDuration(42) === "42분", "koDuration: 42분 → 42분");
check(home.koDuration(0) === "0분" && home.koDuration(-5) === "0분" && home.koDuration(Number.NaN) === "0분", "koDuration: 0 · 음수 · NaN → 0분");
check(home.koDuration(59.6) === "1시간", "koDuration: 반올림 (59.6분 → 1시간)", home.koDuration(59.6));

/* ── 2. homeSubline ────────────────────────────────────────── */
check(home.homeSubline({ totalMinutes: 222, detoxScore: 71.4 }, "대체") === "오늘 3시간 42분 · 디톡스 점수 71점", "homeSubline: 오늘 분석 → 숫자 한 줄", home.homeSubline({ totalMinutes: 222, detoxScore: 71.4 }, "대체"));
check(home.homeSubline(null, "오늘은 아직 분석 전이에요") === "오늘은 아직 분석 전이에요", "homeSubline: 분석 전 → 대체 문구");

/* ── 3. topAppThisWeek ─────────────────────────────────────── */
{
  const thisWeek = [
    row("mon", at(2026, 9, 14, 21), 300, 60, [app("유튜브", 120), app("인스타그램", 60)]),
    row("tue", at(2026, 9, 15, 21), 280, 62, [app("유튜브", 30), app("인스타그램", 100)]),
    row("wed", at(2026, 9, 16, 21), 240, 66, [app("카카오톡", 40)]),
  ];
  const lastWeek = row("old", at(2026, 9, 13, 21), 400, 40, [app("게임", 999)]); // 일요일 — 지난주
  const weekly = row("wk", at(2026, 9, 17, 9), 2100, 60, [app("게임", 999)], "weekly");
  const top = browse.topAppThisWeek({ daily: [...thisWeek, lastWeek], weekly: [weekly] }, NOW);
  check(top?.name === "인스타그램" && top.minutes === 160, "많이 쓴 앱: 이번 주 합계가 가장 큰 앱 (인스타그램 60 + 100)", JSON.stringify(top));
  check(browse.topAppThisWeek({ daily: [lastWeek], weekly: [weekly] }, NOW) === null, "많이 쓴 앱: 지난주 · 주간 분석은 세지 않는다");
  check(browse.topAppThisWeek({ daily: [row("x", at(2026, 9, 15, 21), 100, 50)], weekly: [] }, NOW) === null, "많이 쓴 앱: 앱 정보가 없으면 null");
  check(browse.topAppThisWeek({ daily: [row("z", at(2026, 9, 15, 21), 100, 50, [app("없음", 0)])], weekly: [] }, NOW) === null, "많이 쓴 앱: 0분뿐이면 null");
}

/* ── 4. browseTiles ────────────────────────────────────────── */
{
  const keys = (tiles) => tiles.map((t) => t.key).join(",");
  const loading = browse.browseTiles(null, NOW);
  check(keys(loading) === "today,week,apps,history", "타일: 네 장 · 순서 (오늘 · 이번 주 · 많이 쓴 앱 · 기록)", keys(loading));
  check(loading[0].value === "—" && loading[1].value === "—" && loading[2].value === "—" && loading[3].value === "전체 보기", "타일: 불러오기 전에는 숫자 대신 — (기록 타일은 늘 열려 있다)");

  const before = browse.browseTiles({ daily: [row("tue", at(2026, 9, 15, 21), 280, 62, [app("유튜브", 90)])], weekly: [] }, NOW);
  check(before[0].value === "아직 전" && before[1].value === "1 / 7" && before[1].hint === "6개 더 모으면 종합 분석" && before[2].value === "유튜브", "타일: 오늘 분석 전 — 아직 전 · 1 / 7 · 6개 더 · 유튜브", before.map((t) => t.value).join(" | "));

  const doneToday = browse.browseTiles({ daily: [row("today", at(2026, 9, 17, 8), 222, 71.4, [app("유튜브", 90)])], weekly: [] }, NOW);
  check(doneToday[0].value === "71점" && doneToday[0].hint === "3h 42m 사용" && doneToday[0].tone === "brand", "타일: 오늘 분석 — 71점 · 사용 시간", `${doneToday[0].value} / ${doneToday[0].hint}`);

  const seven = Array.from({ length: 7 }, (_, i) => row(`d${i}`, at(2026, 9, 14 + i, 9), 200, 60, [app("유튜브", 10)]));
  const full = browse.browseTiles({ daily: seven.slice(0, 4), weekly: [] }, at(2026, 9, 20, 22));
  check(full[1].value === "4 / 7", "타일: 일요일 밤에도 이번 주 월~일만 센다", full[1].value);
  const complete = browse.browseTiles({ daily: seven, weekly: [] }, at(2026, 9, 20, 22));
  check(complete[1].value === "7 / 7" && complete[1].hint === "종합 분석을 받을 수 있어요", "타일: 7개를 채우면 종합 분석 안내", `${complete[1].value} / ${complete[1].hint}`);

  const empty = browse.browseTiles({ daily: [], weekly: [] }, NOW);
  check(empty[0].value === "아직 전" && empty[1].value === "0 / 7" && empty[2].value === "아직 없음", "타일: 기록이 하나도 없어도 깨지지 않는다", empty.map((t) => t.value).join(" | "));
  check(browse.browseTiles(null, NOW).every((t) => ["brand", "blue", "amber", "violet"].includes(t.tone)), "타일: 색 종류는 네 가지 중 하나");
}

console.log(failures.length ? `\n실패 ${failures.length}건: ${failures.join(", ")}` : "\n통과");
process.exit(failures.length ? 1 : 0);
