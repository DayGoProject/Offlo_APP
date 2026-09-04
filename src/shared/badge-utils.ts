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
}

export const ALL_BADGES: BadgeDef[] = [
  { name: "첫 분석",       emoji: "🔍", description: "처음으로 AI 스크린타임 분석을 완료했어요." },
  { name: "주간 분석 완료", emoji: "📊", description: "일간 분석 7회를 완료해 주간 분석을 생성했어요." },
  { name: "7일 연속",      emoji: "🔥", description: "7일 연속으로 AI 분석을 완료했어요." },
  { name: "목표 달성",     emoji: "🎯", description: "설정한 디지털 디톡스 목표를 달성했어요." },
];

export function getBadgeDef(name: string): BadgeDef | undefined {
  return ALL_BADGES.find((b) => b.name === name);
}

export function getBadgeEmoji(name: string): string {
  return getBadgeDef(name)?.emoji ?? "🏅";
}
