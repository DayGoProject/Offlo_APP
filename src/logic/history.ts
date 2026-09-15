/**
 * 분석 기록 계산 — 웹 `app/history/page.tsx`의 파생값.
 * 순수 함수만 둔다 (타입만 import) — Node로 검증한다 (scripts/verify-M4-logic.mjs).
 *
 * 웹과 다른 점: "상위 앱"을 `appName`으로 읽는다. 웹은 `name`을 읽는데 AI 분석 결과의
 * 앱 항목은 `{ appName, minutes, category }`라 웹 기록 표의 상위 앱 칸이 비어 보인다.
 */
import type { AnalysisSummary } from "@/services/api-types";

export type HistoryFilter = "all" | "daily" | "weekly";

export function filterAnalyses(analyses: AnalysisSummary[], filter: HistoryFilter): AnalysisSummary[] {
  return filter === "all" ? analyses : analyses.filter((a) => a.periodType === filter);
}

export interface TrendSummary {
  /** 오래된 → 최신, 최근 20건. 라벨 포맷은 화면이 정한다 */
  points: { createdAt: string; score: number }[];
  latest: number | null;
  /** 변화폭을 잰 건수 (최대 7) */
  recentCount: number;
  /** 최근 건들의 첫 값 대비 마지막 값 */
  delta: number | null;
}

export function scoreTrend(analyses: AnalysisSummary[]): TrendSummary {
  const points = [...analyses]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-20)
    .map((a) => ({ createdAt: a.createdAt, score: a.detoxScore }));

  const recent = points.slice(-7);
  return {
    points,
    latest: points.at(-1)?.score ?? null,
    recentCount: recent.length,
    delta: recent.length >= 2 ? recent[recent.length - 1].score - recent[0].score : null,
  };
}

/** 상위 앱 2개를 "인스타그램 · 유튜브"로 */
export function topApps(analysis: AnalysisSummary): string {
  if (analysis.periodType === "weekly") return "주간 종합 리포트";
  const apps = Array.isArray(analysis.apps) ? analysis.apps : [];
  const names = [...apps]
    .sort((x, y) => (y.minutes ?? 0) - (x.minutes ?? 0))
    .slice(0, 2)
    .map((x) => x.appName)
    .filter((name): name is string => typeof name === "string" && name.length > 0);
  return names.length ? names.join(" · ") : "—";
}
