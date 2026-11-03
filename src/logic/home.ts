/**
 * 홈 히어로의 문구 계산 (UIUX 실험 A안) — 순수 함수. 화면은 이 값을 그리기만 한다.
 */
import type { MissionBoard } from "@/logic/mission";
import type { AnalysisSummary } from "@/services/api-types";

/** 분 → "3시간 42분" · "3시간" · "42분" (공유 코드 `fmtHM`은 웹 숫자 표기라 "3h 42m"이다 — 한국어 화면에는 이쪽) */
export function koDuration(minutes: number): string {
  const total = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
}

/** 히어로 제목 아래 한 줄 — 오늘 분석했으면 오늘의 숫자, 아니면 동물 상태 문구 */
export function homeSubline(today: Pick<AnalysisSummary, "totalMinutes" | "detoxScore"> | null, fallback: string): string {
  return today ? `오늘 ${koDuration(today.totalMinutes)} · 디톡스 점수 ${Math.round(today.detoxScore)}점` : fallback;
}

export interface MiniMission {
  title: string;
  /** 다음에 할 오늘 미션 한 줄 — 다 끝냈으면 칭찬 */
  sub: string;
  done: number;
  total: number;
  allDone: boolean;
}

/** 화면 아래에 떠 있는 미션 미니 바 — 오늘 미션(밥 · 쓰다듬기)만 센다 (주간 미션은 정원 탭에서) */
export function miniMission(board: MissionBoard): MiniMission {
  const next = board.missions.find((m) => m.period === "today" && !m.done);
  let sub = "오늘 미션을 모두 끝냈어요";
  if (next) {
    sub = next.id === "pet" && next.progress ? `쓰다듬기 ${next.progress.value} / ${next.progress.target}` : `${next.title} · 분석을 올려 주세요`;
  }
  return { title: `오늘의 미션 · ${board.todayDone}/${board.todayTotal}`, sub, done: board.todayDone, total: board.todayTotal, allDone: board.allTodayDone };
}
