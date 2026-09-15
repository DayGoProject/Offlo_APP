/**
 * 대시보드 계산 — 웹 `app/dashboard/page.tsx`의 파생값을 옮기고 날짜 버그 두 개를 고쳤다.
 *
 * 순수 함수만 둔다 (타입만 import) — Node로 그대로 돌려 검증한다 (scripts/verify-M4-logic.mjs).
 * 화면에 쓰는 문구 조립은 여기서, 그리는 일은 components/dashboard/ 가 한다.
 *
 * 웹과 다른 점
 * 1. 날짜를 **기기 시간대**로 비교한다. 웹은 `createdAt.slice(0, 10)`(UTC 날짜)을 쓰는데,
 *    한국에서 오전 9시 전에 올린 분석은 UTC로 전날이라 주간 막대의 엉뚱한 요일에 들어간다.
 * 2. "오늘 스크린타임"은 **오늘 날짜의** 일간 분석만 쓴다. 웹은 가장 최근 일간 분석을 오늘로 쓴다 —
 *    사흘 전 기록이 "오늘"로, 그 전 기록이 "어제"로 보인다.
 */
import type { AnalysisSummary, Goal } from "@/services/api-types";

const DAY_MS = 86_400_000;
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"] as const;

export interface WeekBar {
  /** 요일 한 글자 */
  day: string;
  minutes: number;
  isToday: boolean;
  isFuture: boolean;
}

/** 기기 시간대 기준 YYYY-MM-DD */
export function localDateKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

/** 같은 날 일간 분석이 여럿이면 목록 앞(최신)이 이긴다 — API가 createdAt 내림차순으로 준다 */
function dailyByDate(analyses: AnalysisSummary[]): Map<string, AnalysisSummary> {
  const map = new Map<string, AnalysisSummary>();
  for (const a of analyses) {
    if (a.periodType !== "daily") continue;
    const key = localDateKey(new Date(a.createdAt));
    if (!map.has(key)) map.set(key, a);
  }
  return map;
}

/** 월요일 시작 7칸. 미래 요일은 화면에서 흐리게 그린다 */
export function buildWeek(analyses: AnalysisSummary[], now: Date): WeekBar[] {
  const byDate = dailyByDate(analyses);
  const offsetToMonday = (now.getDay() + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offsetToMonday);

  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    return {
      day: WEEKDAY[day.getDay()],
      minutes: byDate.get(localDateKey(day))?.totalMinutes ?? 0,
      isToday: i === offsetToMonday,
      isFuture: i > offsetToMonday,
    };
  });
}

export function todayAndYesterday(
  analyses: AnalysisSummary[],
  now: Date,
): { today: AnalysisSummary | null; yesterday: AnalysisSummary | null } {
  const byDate = dailyByDate(analyses);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return {
    today: byDate.get(localDateKey(now)) ?? null,
    yesterday: byDate.get(localDateKey(yesterday)) ?? null,
  };
}

/** "오늘 스크린타임" 카드 각주 — 줄었으면 브랜드 그린 */
export function screenTimeNote(
  today: AnalysisSummary | null,
  yesterday: AnalysisSummary | null,
): { text: string; tone: "brand" | "muted" } {
  if (!today) return { text: "오늘 분석을 올려주세요", tone: "muted" };
  if (!yesterday) return { text: "어제 기록이 없어요", tone: "muted" };
  const diff = yesterday.totalMinutes - today.totalMinutes;
  if (diff > 0) return { text: `어제보다 ${diff}분 ↓`, tone: "brand" };
  if (diff < 0) return { text: `어제보다 ${-diff}분 ↑`, tone: "muted" };
  return { text: "어제와 같아요", tone: "muted" };
}

/** 기록이 있는 날만의 평균 */
export function weekAverage(week: WeekBar[]): { recordedDays: number; averageMinutes: number } {
  const recorded = week.filter((d) => d.minutes > 0);
  if (recorded.length === 0) return { recordedDays: 0, averageMinutes: 0 };
  const sum = recorded.reduce((s, d) => s + d.minutes, 0);
  return { recordedDays: recorded.length, averageMinutes: Math.round(sum / recorded.length) };
}

/** 목표 기간 중 오늘까지 며칠이 지났는지 (0 ~ 전체 일수) */
export function goalProgress(goal: Pick<Goal, "startDate" | "endDate">, now: Date): { done: number; total: number } {
  const start = new Date(goal.startDate).getTime();
  const end = new Date(goal.endDate).getTime();
  const total = Math.max(1, Math.round((end - start) / DAY_MS) + 1);
  const done = Math.max(0, Math.min(total, Math.round((now.getTime() - start) / DAY_MS) + 1));
  return { done, total };
}

/** 헤더 인사말에 쓰는 이름 — 표시 이름의 첫 단어, 없으면 이메일 앞부분 */
export function firstName(displayName: string | null | undefined, email: string | null | undefined): string {
  const source = displayName?.trim() || email?.split("@")[0] || "사용자";
  return source.split(" ")[0];
}

/** 최신 분석의 추천 첫 줄 — 서버 JSON이라 모양을 믿지 않는다 */
export function firstRecommendation(recommendations: unknown): string | null {
  return Array.isArray(recommendations) && typeof recommendations[0] === "string" && recommendations[0].trim()
    ? recommendations[0]
    : null;
}
