/**
 * 디자인 토큰 — 웹 globals.css 의 :root 값을 그대로 옮긴 것 (웹 14단계 · Paper `Offlo_3D_REAL`).
 *
 * **다크 단일 테마다.** 라이트 테마는 웹과 함께 없앴다 — 값이 하나뿐이라 테마 컨텍스트 없이
 * `colors`를 바로 import한다. 색은 base·brand·text 3개와 그 투명도 변형뿐이다 (.claude/rules/design.md).
 * 새 색을 추가하지 않는다 — 필요하면 투명도를 조절한다.
 */

export const BRAND = "#3DDB87";
/** 페이지 바탕 — 순흑이 아닌 살짝 푸른 검정 (Paper: --color-void) */
export const VOID = "#040508";
/** 흰 알약 버튼 바탕 — 한 화면에 하나만 (PageHeader `Pill` primary) */
export const WHITE = "#FFFFFF";

export const colors = {
  /* 표면 — 뒤로 갈수록 밝아진다 (바탕 < 카드 < 입력면) */
  bgPage: VOID,
  bgCard: "#0B0D11",
  bgNav: "#0E1116",
  bgChat: "#080F0C",
  bgSubtle: "rgba(216, 216, 216, 0.03)",
  bgBar: "rgba(216, 216, 216, 0.07)",
  bgBarSm: "rgba(216, 216, 216, 0.05)",
  bgStrip: "rgba(216, 216, 216, 0.015)",

  borderCard: "rgba(216, 216, 216, 0.10)",
  borderSubtle: "rgba(216, 216, 216, 0.08)",
  borderMedium: "rgba(216, 216, 216, 0.13)",
  borderStrong: "rgba(216, 216, 216, 0.16)",
  borderStrip: "rgba(216, 216, 216, 0.05)",

  /* 텍스트 — 순백(#FFF)이 아니다. 다크에서 순백은 눈을 찌른다 */
  textPrimary: "#D8D8D8",
  textPrimarySoft: "rgba(216, 216, 216, 0.80)",
  textSecondary: "rgba(216, 216, 216, 0.55)",
  textMuted: "rgba(216, 216, 216, 0.45)",
  textFaint: "rgba(216, 216, 216, 0.34)",
  textGhost: "rgba(216, 216, 216, 0.18)",

  scoreTrack: "rgba(216, 216, 216, 0.07)",
  gridLine: "rgba(216, 216, 216, 0.04)",

  brand: BRAND,
  accentSoft: "rgba(61, 219, 135, 0.13)",
  accentLine: "rgba(61, 219, 135, 0.14)",
  /** 주간 막대에서 오늘 한 칸 */
  brandBar: "rgba(61, 219, 135, 0.55)",

  /* 위험(에러·탈퇴·삭제) — 팔레트 3색 외 유일한 예외 */
  danger: "#FF5656",
  dangerSoft: "rgba(255, 86, 86, 0.10)",
  dangerLine: "rgba(255, 86, 86, 0.24)",
} as const;

export type ThemeColors = typeof colors;

export const radius = {
  /** 카드 12px — 16px 이상은 다크에서 경계가 흐려져 화면이 물러 보인다 */
  card: 12,
  pill: 999,
} as const;

/**
 * 폰트 — 굵기(fontWeight)가 아니라 **파일 이름**으로 고른다. 웹과 같은 400 · 600 두 굵기뿐이다.
 * 웹의 `font-medium`(500)은 파일이 없어 400으로 그려진다 → 앱도 regular를 쓴다.
 */
export const fonts = {
  regular: "Pretendard-Regular",
  semibold: "Pretendard-SemiBold",
  /** 숫자·영문 디스플레이 전용 (웹 `.num`). **한글 글리프가 없다** — 한글에 쓰면 행간이 무너진다 */
  num: "FamiljenGrotesk",
} as const;

/** 웹의 em 단위 자간을 RN의 px로 바꾼다 — 예: 38px에 -0.045em → -1.71 */
export function em(fontSize: number, value: number): number {
  return fontSize * value;
}
