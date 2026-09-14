/**
 * @offlo-shared — 자동 생성 파일. 직접 수정하지 마세요.
 * 원본: Offlo/web/src/lib/badge-utils.ts
 * 갱신: node scripts/sync-shared.mjs --pull
 */
/* ── 배지 정의 (클라이언트·서버 양쪽 안전) ─────────────────────
   배지 지급 로직은 lib/garden.ts(awardBadge)에 있고, 여기에는
   표시용 메타데이터만 둔다. /badges 페이지와 커뮤니티 피드가 공유한다.
   ────────────────────────────────────────────────────────── */

export interface BadgeDef {
  name: string;
  emoji: string;
  description: string;
  /** 잠긴 상태에서 보여줄 달성 조건 한 줄 */
  requirement: string;
  /** 24 뷰박스 아이콘. Paper 디자인(앱 07 — 배지)에서 가져왔다.
   *  fill 계열과 stroke 계열이 섞여 있어 방식을 함께 적는다. */
  icon: { d: string; mode: "fill" | "stroke"; width?: number };
}

export const ALL_BADGES: BadgeDef[] = [
  {
    name: "첫 분석",
    emoji: "🔍",
    description: "처음으로 AI 스크린타임 분석을 완료했어요.",
    requirement: "AI 분석을 1회 완료하면 획득",
    icon: { d: "M12 3l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.4 6.7 19.2l1.1-5.9-4.3-4.1 5.9-.8L12 3z", mode: "fill" },
  },
  {
    name: "주간 분석 완료",
    emoji: "📊",
    description: "일간 분석 7회를 완료해 주간 분석을 생성했어요.",
    requirement: "이번 주 일간 분석 7회를 채우면 획득",
    icon: { d: "M4 18V10M9.3 18V5M14.7 18v-5.6M20 18V8", mode: "stroke", width: 2 },
  },
  {
    name: "7일 연속",
    emoji: "🔥",
    description: "7일 연속으로 AI 분석을 완료했어요.",
    requirement: "7일 연속으로 분석하면 획득",
    icon: { d: "M12 2.6c2.4 3.2 5.6 5 5.6 9a5.6 5.6 0 1 1-11.2 0c0-4 3.2-5.8 5.6-9z", mode: "fill" },
  },
  {
    name: "목표 달성",
    emoji: "🎯",
    description: "설정한 디지털 디톡스 목표를 달성했어요.",
    requirement: "목표를 하나 완료하면 획득",
    icon: { d: "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 12m-3.6 0a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0-7.2 0", mode: "stroke", width: 1.8 },
  },
];

export function getBadgeDef(name: string): BadgeDef | undefined {
  return ALL_BADGES.find((b) => b.name === name);
}

export function getBadgeEmoji(name: string): string {
  return getBadgeDef(name)?.emoji ?? "🏅";
}
