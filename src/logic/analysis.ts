/**
 * AI 분석 탭 · 결과 화면 계산 — 웹 `app/analysis/page.tsx` · `analysis/result/[id]/page.tsx`의 파생값.
 * 순수 함수만 둔다 (런타임 import는 공유 코드 `@/shared/kst` 뿐) — Node로 검증한다 (scripts/verify-M5-logic.mjs).
 *
 * **"오늘"과 "이번 주"는 KST로 자른다 — 기기 시간대가 아니다.**
 * 대시보드(logic/dashboard.ts)는 기록을 기기 시간대로 그리지만, 분석 탭은 서버의 일간 1회 제한
 * (KST 자정 기준 · 웹 `lib/daily-analysis.ts`)을 미리 보여 주는 자리라 서버와 같은 경계를 써야 한다.
 * 한국에서는 둘이 같고, 시간대가 다른 기기에서만 갈린다 (그때 기기 날짜를 쓰면 "오늘 완료"가 서버와 어긋난다).
 *
 * 웹과 다른 점
 * 1. 이번 주 7칸을 **요일 자리에** 채운다. 웹은 기록을 순서대로 월→일 칸에 채워서, 월요일을 건너뛰면
 *    화요일 기록이 "월" 칸에 들어간다
 * 2. 주간 요약의 날짜 라벨을 직접 만든다 — Hermes의 Intl(`toLocaleDateString` 옵션)에 기대지 않는다
 * 3. 이번 주 주간 분석이 이미 있으면 알려 준다 — 웹은 같은 주에 주간 분석을 몇 번이고 다시 만든다 (Gemini 비용)
 */
import { kstDateKey, kstWeek } from "@/shared/kst";
import type { Analysis, AnalysisContext, AnalysisSummary, DailySummary } from "@/services/api-types";

/** 주간 분석에 필요한 이번 주 일간 분석 수 (서버 `/api/ai/weekly`도 7개를 요구한다) */
export const WEEKLY_THRESHOLD = 7;

const DOW = ["일", "월", "화", "수", "목", "금", "토"] as const;

/* ── 분석 흐름의 화면 상태 (hooks/use-analysis-flow.ts가 만들고 AnalysisView가 그린다) ── */

export type UploadPhase = "idle" | "picked" | "preparing" | "analyzing" | "saving" | "save-failed";

export interface UploadState {
  phase: UploadPhase;
  /** 고른 사진 (기기 안의 주소) */
  imageUri: string | null;
  /** 화면에 그대로 띄울 한국어 한 줄 */
  error: string | null;
}

export type WeeklyPhase = "idle" | "generating" | "saving" | "save-failed";

export interface WeeklyState {
  phase: WeeklyPhase;
  error: string | null;
}

/** 탭이 불러오는 기록 — 이번 주 일간(앱별 시간 포함)과 가장 최근 주간 한 건 */
export interface AnalysisRecords {
  daily: AnalysisSummary[];
  weekly: AnalysisSummary[];
}

/** KST 오늘의 일간 분석 — 없으면 오늘 분석을 올릴 수 있다 */
export function todayDaily(analyses: AnalysisSummary[], now: number): AnalysisSummary | null {
  const today = kstDateKey(now);
  return analyses.find((a) => a.periodType === "daily" && kstDateKey(a.createdAt) === today) ?? null;
}

/** 이번 주(KST 월~일) 날짜별 일간 분석. 같은 날 여럿이면 목록 앞(최신)이 이긴다 — API가 최신순으로 준다 */
function thisWeekByDate(analyses: AnalysisSummary[], now: number): Map<string, AnalysisSummary> {
  const keys = new Set(kstWeek(now).days.map((d) => d.key));
  const byDate = new Map<string, AnalysisSummary>();
  for (const a of analyses) {
    if (a.periodType !== "daily") continue;
    const key = kstDateKey(a.createdAt);
    if (keys.has(key) && !byDate.has(key)) byDate.set(key, a);
  }
  return byDate;
}

/** 이번 주 일간 분석 — 오래된 → 최신 (주간 분석 요청 순서) */
export function thisWeekDaily(analyses: AnalysisSummary[], now: number): AnalysisSummary[] {
  const byDate = thisWeekByDate(analyses, now);
  return kstWeek(now)
    .days.map((d) => byDate.get(d.key))
    .filter((a): a is AnalysisSummary => a !== undefined);
}

export interface WeekSlot {
  /** 요일 한 글자 */
  day: string;
  record: AnalysisSummary | null;
  isToday: boolean;
  isFuture: boolean;
}

/** 이번 주 7칸 — 기록은 그 요일 칸에 들어간다 */
export function weekSlots(analyses: AnalysisSummary[], now: number): WeekSlot[] {
  const byDate = thisWeekByDate(analyses, now);
  const { days, todayIndex } = kstWeek(now);
  return days.map((d, i) => ({
    day: DOW[d.dow],
    record: byDate.get(d.key) ?? null,
    isToday: i === todayIndex,
    isFuture: i > todayIndex,
  }));
}

/** "2026-09-17" → "9월 17일 (목)" */
function dateLabel(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${m}월 ${d}일 (${DOW[new Date(`${key}T00:00:00Z`).getUTCDay()]})`;
}

/** 주간 분석 요청 본문 — 오래된 → 최신. 앱별 시간은 목록 API의 `includeApps`로 받아 둔 것을 쓴다 */
export function weeklySummaries(records: AnalysisSummary[]): DailySummary[] {
  return records.map((r) => ({
    date: dateLabel(kstDateKey(r.createdAt)),
    totalMinutes: r.totalMinutes,
    apps: r.apps ?? [],
    detoxScore: r.detoxScore,
  }));
}

/** 이번 주(KST)에 이미 만든 주간 분석 — 최신순 목록의 첫 줄만 보면 된다 */
export function thisWeekWeekly(weeklies: AnalysisSummary[], now: number): AnalysisSummary | null {
  const { days } = kstWeek(now);
  const first = days[0].key;
  const last = days[6].key;
  return (
    weeklies.find((a) => {
      if (a.periodType !== "weekly") return false;
      const key = kstDateKey(a.createdAt);
      return key >= first && key <= last;
    }) ?? null
  );
}

/**
 * 최근 결과 줄의 날짜 — "오늘" · "어제" · "9월 15일" (KST).
 * 웹 `relDate`는 실제 현재 시각을 쓰는데, 여기는 기준 시각을 받는다 (미리보기 스크린샷이 날마다 바뀌지 않게)
 */
export function relativeDay(createdAt: string, now: number): string {
  const key = kstDateKey(createdAt);
  if (key === kstDateKey(now)) return "오늘";
  if (key === kstDateKey(now - 86_400_000)) return "어제";
  const [, m, d] = key.split("-").map(Number);
  return `${m}월 ${d}일`;
}

/** 점수 링 옆의 한 줄 — 웹과 같은 경계 (70 · 40) */
export function scoreLabel(score: number): string {
  return score >= 70 ? "건강한 사용" : score >= 40 ? "주의 필요" : "디톡스 필요";
}

/** 코치 채팅에 넘기는 분석 요약 — 서버 JSON이라 빠진 배열은 빈 배열로 채운다 */
export function analysisContext(analysis: Analysis): AnalysisContext {
  return {
    periodType: analysis.periodType === "weekly" ? "weekly" : "daily",
    totalMinutes: analysis.totalMinutes,
    apps: Array.isArray(analysis.apps) ? analysis.apps : [],
    detoxScore: analysis.detoxScore,
    coreProblems: Array.isArray(analysis.coreProblems) ? analysis.coreProblems : [],
  };
}

/** 문자열 배열만 남긴다 — 결과 화면의 목록 섹션은 서버 JSON 모양을 믿지 않는다 */
export function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "") : [];
}
