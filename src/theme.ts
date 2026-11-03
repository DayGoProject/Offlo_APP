/**
 * 디자인 토큰 — UIUX 실험 A안 "몰입형 스테이지" 팔레트 (브랜치 `exp/uiux-a-stage` · mobile-app-ui-design 스킬 기준).
 *
 * **다크 단일 테마다.** 값이 하나뿐이라 테마 컨텍스트 없이 `colors`를 바로 import한다.
 *
 * 이전(웹 14단계와 같은 무채 3색)에서 달라진 것 — 스킬의 60/30/10 규칙으로 다시 잡았다:
 *   60% 바탕·표면 = 깊은 **밤하늘 남색**을 단계로 (동물 방의 창가 남색과 이어져 몰입감이 생긴다)
 *   30% 글자·요소 = 순백이 아닌 약간 푸른 오프화이트, 위계는 **투명도**로 (100 / 80 / 55 / 45 / 34 / 18)
 *   10% 강조 = 브랜드 그린 — 성장 · 완료 · 주요 행동 전용 (앱 아이콘 · 스토어 자산과 같은 색이라 그대로 둔다)
 * 분류가 필요한 자리(분석 타일 · 카테고리)에는 **방에 이미 있는 색**(창밖 푸른빛 · 스탠드의 호박색 · 밤의 보라)에서 가져온 차분한 보조색 셋을 쓴다 — 부드러운 면(옅은 투명도)으로만.
 * 그림자 대신 면의 밝기 차이와 옅은 테두리로 깊이를 만든다.
 */

export const BRAND = "#3DDB87";
/** 페이지 바탕 — 순흑이 아닌 깊은 남색 */
export const VOID = "#060913";
/** 흰 알약 버튼 바탕 — 화면의 주 행동 하나에만 */
export const WHITE = "#FFFFFF";

/** 글자·선의 바탕이 되는 오프화이트 (R, G, B) — 투명도 변형이 모두 이 색에서 나온다 */
const INK = "227, 232, 245";

export const colors = {
  /* 표면 — 뒤로 갈수록 밝아진다 (바탕 < 카드 < 시트 · 탭바 · 입력면) */
  bgPage: VOID,
  bgCard: "#0D1324",
  bgNav: "#131B31",
  bgChat: "#0A1320",
  bgSubtle: `rgba(${INK}, 0.03)`,
  bgBar: `rgba(${INK}, 0.08)`,
  bgBarSm: `rgba(${INK}, 0.05)`,
  bgStrip: `rgba(${INK}, 0.02)`,
  /** 장면(방) 위에 얹는 둥근 버튼 · 칩의 바탕 — 장면이 비쳐 보이게 반투명 */
  glass: "rgba(6, 9, 19, 0.55)",

  borderCard: `rgba(${INK}, 0.10)`,
  borderSubtle: `rgba(${INK}, 0.07)`,
  borderMedium: `rgba(${INK}, 0.13)`,
  borderStrong: `rgba(${INK}, 0.18)`,
  borderStrip: `rgba(${INK}, 0.05)`,

  /* 글자 — 순백(#FFF)이 아니다. 다크에서 순백은 눈을 찌른다 */
  textPrimary: `rgb(${INK})`,
  textPrimarySoft: `rgba(${INK}, 0.80)`,
  textSecondary: `rgba(${INK}, 0.58)`,
  textMuted: `rgba(${INK}, 0.48)`,
  textFaint: `rgba(${INK}, 0.36)`,
  textGhost: `rgba(${INK}, 0.18)`,

  scoreTrack: `rgba(${INK}, 0.08)`,
  gridLine: `rgba(${INK}, 0.05)`,
  /** 모달 · 시트 뒤 가림막 — 바탕색의 투명도 */
  scrim: "rgba(6, 9, 19, 0.78)",

  brand: BRAND,
  accentSoft: "rgba(61, 219, 135, 0.14)",
  /** 안 읽은 알림 줄의 바탕 — 브랜드 그린의 아주 옅은 투명도 */
  accentFaint: "rgba(61, 219, 135, 0.06)",
  accentLine: "rgba(61, 219, 135, 0.16)",
  /** 주간 막대에서 오늘 한 칸 */
  brandBar: "rgba(61, 219, 135, 0.55)",

  /* 분류용 보조색 — 방 안의 색에서 가져왔다. 글자 · 아이콘 · 옅은 면으로만 쓴다 (강조는 브랜드 그린 하나) */
  blue: "#8AA7FF",
  blueSoft: "rgba(138, 167, 255, 0.14)",
  violet: "#B197FF",
  violetSoft: "rgba(177, 151, 255, 0.14)",
  amber: "#FFBE6B",
  amberSoft: "rgba(255, 190, 107, 0.14)",

  /* 위험(에러·탈퇴·삭제) */
  danger: "#FF5C6C",
  dangerSoft: "rgba(255, 92, 108, 0.10)",
  dangerLine: "rgba(255, 92, 108, 0.26)",
} as const;

export type ThemeColors = typeof colors;

export const radius = {
  /** 카드 20px — 면의 밝기 차이로 경계가 보이므로 크게 둥글려도 흐려지지 않는다 (스킬: rounded-2xl 이상) */
  card: 20,
  /** 타일 · 작은 카드 */
  tile: 16,
  /** 바닥 시트 · 큰 모달의 윗모서리 */
  sheet: 28,
  pill: 999,
} as const;

/**
 * 폰트 — 굵기(fontWeight)가 아니라 **파일 이름**으로 고른다. 400 · 600 두 굵기뿐이다 (스킬: 글꼴 하나 · 굵기 2).
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
