/**
 * M6 검증 — 정원 계산 로직 (Node · 에이전트 자동 실행용)
 *
 *   node scripts/verify-M6-logic.mjs
 *
 * src/logic/garden.ts 는 순수 파일이라 Node(타입 제거 실행)로 바로 돌린다. 공유 코드 `@/shared/*`를
 * 런타임에 import하므로 `@/` 경로를 src/로 푸는 해석 훅을 단다.
 *
 * 동물 상태의 "오늘"은 기기 시간대가 아니라 **KST**다 (서버 연속 기록이 KST로 어제 분석했나를 가른다).
 * 그래서 **시간대 3개(Asia/Seoul · UTC · America/Los_Angeles)에서 다시 실행해 답이 같아야** 통과다.
 *
 * 확인 항목
 *   1. 며칠 지났나 — KST 자정 경계 · 기록 없음 · 형식 오류 · 미래 날짜
 *   2. 동물 상태 — none · egg · fed · peckish · starving
 *   3. 연속 기록 전망 — 서버 `updateAnimalStreak`(웹 lib/garden.ts)와 같은 결과 (기준 구현을 옮겨 대조)
 *   4. 문구 — 굶주림은 "1일부터 다시", 출출은 "이어져요"
 *   5. 성장 진행률 — 식물 7단계 · 동물 6단계 경계 · 마지막 단계
 *   6. 미리보기 샘플이 의도한 상태로 계산되는가
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
    console.error(`\nM6 로직 검증 실패 — ${failed}개 시간대`);
    process.exit(1);
  }
  console.log(`\nM6 로직 검증을 통과했습니다 (${ZONES.join(" · ")}).`);
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

const g = await import(pathToFileURL(join(SRC, "logic", "garden.ts")).href);
const { GARDEN_NOW, GARDEN_SAMPLES } = await import(pathToFileURL(join(SRC, "preview", "samples.ts")).href);

const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};

/** KST 벽시계 시각 → 절대 시각(ms). 실행 시간대와 무관하다 */
const at = (y, mo, d, h = 0, mi = 0) => Date.UTC(y, mo - 1, d, h - 9, mi);
const NOW = at(2026, 9, 17, 10, 0);

/* ── 1. 며칠 지났나 ─────────────────────────────────────────── */
{
  check(g.daysSinceFed("2026-09-17", NOW) === 0, "오늘 분석 → 0일");
  check(g.daysSinceFed("2026-09-16", NOW) === 1, "어제 → 1일");
  check(g.daysSinceFed("2026-09-14", NOW) === 3, "3일 전 → 3일");
  check(g.daysSinceFed("2026-08-31", NOW) === 17, "월을 넘겨도 정확", String(g.daysSinceFed("2026-08-31", NOW)));
  check(g.daysSinceFed(null, NOW) === null && g.daysSinceFed(undefined, NOW) === null, "기록 없음 → null");
  check(g.daysSinceFed("", NOW) === null && g.daysSinceFed("어제", NOW) === null && g.daysSinceFed("2026-13-40", NOW) === null, "형식 오류 → null");
  check(g.daysSinceFed("2026-09-20", NOW) === 0, "미래 날짜(기기 시계 어긋남)는 0일로 묶음");

  // KST 자정 경계 — 기기 시간대와 무관해야 한다
  check(g.daysSinceFed("2026-09-16", at(2026, 9, 17, 0, 0)) === 1, "KST 00:00 → 새 날이 시작 (어제 = 1일)");
  check(g.daysSinceFed("2026-09-16", at(2026, 9, 16, 23, 59)) === 0, "KST 23:59 → 아직 같은 날 (0일)");
  check(g.daysSinceFed("2026-09-16", at(2026, 9, 17, 8, 59)) === 1, "KST 오전 8:59 (UTC로는 전날) → 여전히 KST 17일");
}

/* ── 2. 동물 상태 ───────────────────────────────────────────── */
{
  const animal = (last, streak = 5, type = "cat") => ({ type, streak, lastAnalysisDate: last });
  check(g.petCondition(null, NOW) === "none", "동물 문서 없음 → none");
  check(g.petCondition(animal("2026-09-17", 5, null), NOW) === "none", "type이 null → none");
  check(g.petCondition(animal(null, 0), NOW) === "egg", "분석 기록 없음 → egg");
  check(g.petCondition(animal("2026-09-17"), NOW) === "fed", "오늘 분석 → fed");
  check(g.petCondition(animal("2026-09-16"), NOW) === "peckish", "어제까지 → peckish");
  check(g.petCondition(animal("2026-09-15"), NOW) === "starving", "그제 → starving (하루 걸렀다)");
  check(g.petCondition(animal("2026-08-01"), NOW) === "starving", "한 달 굶어도 starving (죽지 않는다)");
  check(g.petCondition(animal("이상한값", 3), NOW) === "egg", "읽을 수 없는 날짜는 기록 없음으로 취급");
}

/* ── 3. 연속 기록 전망 — 서버 규칙과 대조 ───────────────────── */
{
  /** 웹 `lib/garden.ts` `updateAnimalStreak`의 결정만 그대로 옮긴 기준 구현 (Firestore 부분 제외) */
  const serverNext = (data, todayKey, yesterdayKey) => {
    let newStreak = 1;
    if (data) {
      if (data.lastAnalysisDate === todayKey) return data.streak ?? 1;
      if (data.lastAnalysisDate === yesterdayKey) newStreak = (data.streak ?? 0) + 1;
    }
    return newStreak;
  };
  const todayKey = "2026-09-17";
  const yesterdayKey = "2026-09-16";
  let allMatch = true;
  const cases = [];
  for (const last of ["2026-09-17", "2026-09-16", "2026-09-15", "2026-09-10", null]) {
    for (const streak of [0, 1, 7, 30, 130]) {
      const animal = { type: "dog", streak, lastAnalysisDate: last };
      const cond = g.petCondition(animal, NOW);
      const outlook = g.streakOutlook(animal, cond);
      // egg는 서버에서 문서가 있어도 lastAnalysisDate가 없으면 1이 된다 — 같은 기준 구현으로 비교
      const expected = serverNext({ streak, lastAnalysisDate: last }, todayKey, yesterdayKey);
      if (outlook.afterFeeding !== expected) {
        allMatch = false;
        cases.push(`${last}/${streak}: 앱 ${outlook.afterFeeding} ≠ 서버 ${expected}`);
      }
    }
  }
  check(allMatch, "밥을 줬을 때 연속 기록이 서버 updateAnimalStreak와 같다 (25개 조합)", cases.join(" | "));

  const starving = { type: "cat", streak: 30, lastAnalysisDate: "2026-09-10" };
  const o = g.streakOutlook(starving, "starving");
  check(o.willReset && o.afterFeeding === 1 && o.current === 30, "굶주림 — 30일이 1일로 돌아감을 알린다");
  check(!g.streakOutlook({ type: "cat", streak: 1, lastAnalysisDate: "2026-09-10" }, "starving").willReset, "이미 1일이면 되돌아갈 것이 없다");
  check(!g.streakOutlook({ type: "cat", streak: 8, lastAnalysisDate: "2026-09-16" }, "peckish").willReset, "출출은 끊기지 않는다");
}

/* ── 4. 문구 ────────────────────────────────────────────────── */
{
  const starving = g.conditionCopy("starving", { current: 30, afterFeeding: 1, willReset: true });
  check(starving.sub.includes("1일부터 다시"), "굶주림 문구가 서버 동작(1일부터)을 사실대로 말함", starving.sub);
  const peckish = g.conditionCopy("peckish", { current: 8, afterFeeding: 9, willReset: false });
  check(peckish.sub.includes("9일") && peckish.sub.includes("이어져요"), "출출 문구가 이어질 연속 기록을 알려 줌", peckish.sub);
  check(g.conditionCopy("fed", { current: 12, afterFeeding: 12, willReset: false }).sub.includes("12일째"), "배부름 문구가 연속 일수를 보여 줌");
  check(g.conditionCopy("egg", null).sub.includes("첫 분석"), "알 문구는 첫 분석을 안내");
  check(Object.keys(g.CONDITION_LABEL).length === 5, "상태 라벨 5종");
}

/* ── 5. 성장 진행률 ─────────────────────────────────────────── */
{
  const p0 = g.plantProgress(0);
  check(p0.level.level === 1 && p0.ratio === 0 && p0.remainMinutes === 120, "식물 0분 — 씨앗 · 새싹까지 120분");
  check(g.plantProgress(119).level.level === 1 && g.plantProgress(120).level.level === 2, "식물 120분 경계 (웹과 같다)");
  const p = g.plantProgress(1450);
  check(p.level.level === 4 && p.next.level === 5 && p.remainMinutes === 950 && Math.abs(p.ratio - 250 / 1200) < 1e-9, "식물 1,450분 — 꽃봉오리 · 활짝 꽃까지 950분");
  const pmax = g.plantProgress(10200);
  check(pmax.level.level === 7 && pmax.next === null && pmax.ratio === 1 && pmax.remainMinutes === 0, "식물 마지막 단계");

  const a0 = g.animalProgress(0);
  check(a0.stage.status === "egg" && a0.stageNumber === 1 && a0.next.status === "baby" && a0.remainDays === 1 && a0.ratio === 0, "동물 0일 — 알 · 아기까지 1일");
  check(g.animalProgress(1).stage.status === "baby" && g.animalProgress(6).stage.status === "baby" && g.animalProgress(7).stage.status === "growing", "동물 7일 경계");
  const a12 = g.animalProgress(12);
  check(a12.stage.status === "growing" && a12.stageNumber === 3 && a12.next.minStreak === 21 && a12.remainDays === 9 && Math.abs(a12.ratio - 5 / 14) < 1e-9, "동물 12일 — 성장 중 3/6 · 성체까지 9일");
  const a130 = g.animalProgress(130);
  check(a130.stage.status === "legend" && a130.stageNumber === 6 && a130.next === null && a130.ratio === 1, "동물 마지막 단계(전설)");
}

/* ── 6. 미리보기 샘플 ───────────────────────────────────────── */
{
  const expected = { fed: "fed", peckish: "peckish", starving: "starving", egg: "egg", none: "none", legend: "fed" };
  for (const [key, want] of Object.entries(expected)) {
    const got = g.petCondition(GARDEN_SAMPLES[key].animal, GARDEN_NOW);
    check(got === want, `샘플 "${key}" → ${want}`, got);
  }
}

/* ── 7. 장면 — 시간대별 하늘 · 대사 ─────────────────────────── */
{
  const s = await import(pathToFileURL(join(SRC, "logic", "scene.ts")).href);

  check(s.kstHour(at(2026, 9, 17, 0, 0)) === 0 && s.kstHour(at(2026, 9, 17, 23, 59)) === 23, "KST 시 — 0시 · 23시 (실행 시간대와 무관)");
  const part = (h) => s.dayPartOf(at(2026, 9, 17, h, 0));
  check(part(4) === "night" && part(5) === "dawn" && part(6) === "dawn" && part(7) === "day", "새벽 5~7시 경계");
  check(part(16) === "day" && part(17) === "dusk" && part(19) === "dusk" && part(20) === "night", "저녁 17~20시 · 밤 20시 경계");
  check(part(0) === "night" && part(23) === "night", "자정 전후는 밤");

  check(s.isAnxious("peckish", at(2026, 9, 17, 18, 0)) && !s.isAnxious("peckish", at(2026, 9, 17, 17, 59)), "출출 + 18시 이후만 초조");
  check(!s.isAnxious("fed", at(2026, 9, 17, 22, 0)) && !s.isAnxious("starving", at(2026, 9, 17, 22, 0)), "배부름 · 굶주림은 초조 대상이 아님");

  const conds = ["egg", "fed", "peckish", "starving"];
  const types = ["cat", "dog", "rabbit"];
  const all = conds.flatMap((c) => types.map((t) => s.speechLines(c, t)));
  check(all.every((l) => l.length >= 3), "상태 4 × 동물 3 — 대사 각 3개 이상", `${all.map((l) => l.length).join(",")}`);
  check(s.speechLines("none", "cat").length === 0 && s.speechLines("fed", null).length === 0, "미선택은 대사 없음");
  check(new Set(all.flat()).size === all.flat().length, "대사가 서로 겹치지 않음 (동물 · 상태마다 다른 말)");
  const lines = s.speechLines("peckish", "cat");
  check(s.pickLine(lines, 0) !== s.pickLine(lines, 1) && s.pickLine(lines, lines.length) === s.pickLine(lines, 0), "대사는 연달아 같지 않고 순환한다");
  check(s.pickLine(lines, -1) === lines[lines.length - 1] && s.pickLine([], 3) === null, "음수 순번 · 빈 목록 안전");
  // 굶주림 대사는 원망하지 않는다 (기둥 4) — 금지어 표본
  const blame = /(왜 안|나쁜|미워|버렸|죽)/;
  check(!all.flat().some((l) => blame.test(l)), "원망 · 죄책감을 주는 말투가 없다");
}

if (failures.length) {
  console.error(`\n실패 ${failures.length}건: ${failures.join(" · ")}`);
  process.exit(1);
}
console.log(`\n통과 (TZ=${process.env.TZ})`);
