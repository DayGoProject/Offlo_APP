/**
 * 미리보기 화면용 샘플 값 — 로그인 가드 밖에서 컴포넌트를 그릴 때만 쓴다 (mobile.md · security.md).
 *
 * - **실제 사용자 데이터를 복사해 넣지 않는다** — 이름 · 이메일 · 앱 목록 전부 지어낸 값이다 (Public 레포)
 * - 타입은 api-types 그대로 — 서버 응답 모양과 어긋나면 컴파일에서 걸린다
 * - 기준 시각을 고정해 스크린샷이 날마다 달라지지 않게 한다 (2026-09-17 목요일 오전 10시, 기기 시간대)
 */
import type { DashboardData } from "@/components/dashboard/DashboardView";
import type { AnalysisSummary, Goal } from "@/services/api-types";

export const SAMPLE_NOW = new Date(2026, 8, 17, 10, 0, 0);
export const SAMPLE_NAME = "지우";

/** 기준 시각에서 며칠 전 · 몇 시의 ISO 문자열 */
function daysAgo(days: number, hour = 21): string {
  return new Date(2026, 8, 17 - days, hour, 12, 0).toISOString();
}

function analysis(
  id: string,
  days: number,
  totalMinutes: number,
  detoxScore: number,
  periodType: AnalysisSummary["periodType"] = "daily",
  apps: [string, number][] = [],
): AnalysisSummary {
  return {
    id,
    periodType,
    totalMinutes,
    detoxScore,
    isPremium: false,
    createdAt: daysAgo(days),
    apps: apps.map(([appName, minutes]) => ({ appName, minutes, category: "기타" })),
  };
}

const SAMPLE_ANALYSES: AnalysisSummary[] = [
  // 오늘 기록은 오전 8시 — 한국 시간 오전 9시 전이라 UTC로는 전날이다 (요일이 밀리지 않는지 보는 표본)
  { ...analysis("a-today", 0, 252, 72, "daily", [["인스타그램", 96], ["유튜브", 71], ["카카오톡", 40]]), createdAt: daysAgo(0, 8) },
  analysis("a-1", 1, 290, 66, "daily", [["유튜브", 120], ["인스타그램", 88]]),
  analysis("a-2", 2, 318, 61, "daily", [["틱톡", 131], ["인스타그램", 90]]),
  analysis("a-3", 3, 340, 58, "daily", [["유튜브", 150], ["넷플릭스", 60]]),
  analysis("w-1", 4, 2310, 60, "weekly"),
  analysis("a-5", 5, 365, 55, "daily", [["인스타그램", 140], ["유튜브", 80]]),
  analysis("a-6", 6, 402, 51, "daily", [["틱톡", 160], ["유튜브", 90]]),
  analysis("a-8", 8, 380, 49, "daily", [["유튜브", 170], ["카카오톡", 50]]),
  analysis("a-9", 9, 420, 46, "daily", [["인스타그램", 180], ["틱톡", 70]]),
  analysis("a-10", 10, 445, 44, "daily", [["유튜브", 200], ["인스타그램", 90]]),
];

const SAMPLE_GOALS: Goal[] = [
  {
    id: "g-1",
    userId: "sample",
    title: "하루 4시간 이하",
    targetMinutes: 240,
    startDate: daysAgo(7, 0),
    endDate: daysAgo(-7, 0),
    status: "active",
    createdAt: daysAgo(7),
  },
  {
    id: "g-2",
    userId: "sample",
    title: "잠들기 전 SNS 끊기",
    targetMinutes: 60,
    startDate: daysAgo(2, 0),
    endDate: daysAgo(-13, 0),
    status: "active",
    createdAt: daysAgo(2),
  },
];

export const DASHBOARD_READY: DashboardData = {
  analyses: SAMPLE_ANALYSES,
  goals: SAMPLE_GOALS,
  garden: { totalDetoxMinutes: 1450, animal: { type: "cat", streak: 12 } },
  tip: "잠들기 1시간 전에는 휴대폰을 거실에 두고 들어가 보세요. 밤 시간 사용량이 가장 크게 줄어드는 습관이에요.",
};

/** 가입 직후 — 분석 · 목표 · 정원 모두 비어 있다 */
export const DASHBOARD_EMPTY: DashboardData = {
  analyses: [],
  goals: [],
  garden: { totalDetoxMinutes: 0, animal: null },
  tip: null,
};

export const HISTORY_READY: AnalysisSummary[] = SAMPLE_ANALYSES;
