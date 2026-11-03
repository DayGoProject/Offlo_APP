/**
 * 분석 탭 "둘러보기" 타일 계산 — 이미 불러온 기록에서 네 장의 요약만 만든다 (순수 함수 · 새 요청 없음).
 *
 *   today    오늘 점수 (분석 전이면 "아직 전")
 *   week     이번 주 일간 분석 n / 7
 *   apps     이번 주 가장 오래 쓴 앱
 *   history  분석 기록 전체 보기 (기록 화면으로)
 *
 * "오늘 · 이번 주"는 분석 탭과 같이 KST (logic/analysis.ts).
 */
import { thisWeekDaily, todayDaily, WEEKLY_THRESHOLD, type AnalysisRecords } from "@/logic/analysis";
import { fmtHM } from "@/shared/format";

export type BrowseKey = "today" | "week" | "apps" | "history";
export type BrowseTone = "brand" | "blue" | "amber" | "violet";

export interface BrowseTile {
  key: BrowseKey;
  tone: BrowseTone;
  label: string;
  value: string;
  hint: string;
}

/** 이번 주 일간 분석의 앱별 시간을 합쳐 가장 오래 쓴 앱 — 앱 정보가 없으면 null */
export function topAppThisWeek(records: AnalysisRecords, now: number): { name: string; minutes: number } | null {
  const sums = new Map<string, number>();
  for (const r of thisWeekDaily(records.daily, now)) {
    for (const app of r.apps ?? []) {
      sums.set(app.appName, (sums.get(app.appName) ?? 0) + app.minutes);
    }
  }
  let best: { name: string; minutes: number } | null = null;
  for (const [name, minutes] of sums) {
    if (minutes > 0 && (!best || minutes > best.minutes)) best = { name, minutes };
  }
  return best;
}

export function browseTiles(records: AnalysisRecords | null, now: number): BrowseTile[] {
  const today = records ? todayDaily(records.daily, now) : null;
  const weekCount = records ? thisWeekDaily(records.daily, now).length : 0;
  const top = records ? topAppThisWeek(records, now) : null;

  return [
    {
      key: "today",
      tone: "brand",
      label: "오늘",
      value: !records ? "—" : today ? `${Math.round(today.detoxScore)}점` : "아직 전",
      hint: !records ? "불러오는 중" : today ? `${fmtHM(today.totalMinutes)} 사용` : "스크린샷을 올려 보세요",
    },
    {
      key: "week",
      tone: "blue",
      label: "이번 주",
      value: !records ? "—" : `${weekCount} / ${WEEKLY_THRESHOLD}`,
      hint: !records
        ? "불러오는 중"
        : weekCount >= WEEKLY_THRESHOLD
          ? "종합 분석을 받을 수 있어요"
          : `${WEEKLY_THRESHOLD - weekCount}개 더 모으면 종합 분석`,
    },
    {
      key: "apps",
      tone: "amber",
      label: "많이 쓴 앱",
      value: !records ? "—" : (top?.name ?? "아직 없음"),
      hint: !records ? "불러오는 중" : top ? `이번 주 ${fmtHM(top.minutes)}` : "앱별 시간이 읽히면 보여요",
    },
    {
      key: "history",
      tone: "violet",
      label: "분석 기록",
      value: "전체 보기",
      hint: "지난 분석을 다시 봐요",
    },
  ];
}
