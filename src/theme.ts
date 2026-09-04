/**
 * 디자인 토큰 — 웹 globals.css의 CSS 변수를 그대로 옮긴 것.
 *
 * 색은 base·brand·text 3개뿐이고 중간 색조는 전부 투명도로 표현한다 (.claude/rules/design.md).
 * 새 색을 추가하지 않는다 — 필요하면 투명도를 조절한다.
 */

export const BRAND = "#3DDB87";

export interface ThemeColors {
  scoreTrack: string;
  borderSubtle: string;
  bgPage: string;
  bgCard: string;
  bgChat: string;
  bgSubtle: string;
  bgBar: string;
  bgBarSm: string;
  bgStrip: string;
  borderCard: string;
  borderStrong: string;
  borderMedium: string;
  borderStrip: string;
  textPrimary: string;
  textPrimarySoft: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
  textGhost: string;
  gridLine: string;
  brand: string;
}

export const light: ThemeColors = {
  scoreTrack: "rgba(0, 0, 0, 0.08)",
  borderSubtle: "rgba(0, 0, 0, 0.08)",
  bgPage: "#F4F6F4",
  bgCard: "rgba(255, 255, 255, 0.90)",
  bgChat: "rgba(237, 248, 242, 0.95)",
  bgSubtle: "rgba(0, 0, 0, 0.03)",
  bgBar: "rgba(0, 0, 0, 0.06)",
  bgBarSm: "rgba(0, 0, 0, 0.04)",
  bgStrip: "rgba(0, 0, 0, 0.01)",
  borderCard: "rgba(0, 0, 0, 0.08)",
  borderStrong: "rgba(0, 0, 0, 0.10)",
  borderMedium: "rgba(0, 0, 0, 0.09)",
  borderStrip: "rgba(0, 0, 0, 0.05)",
  textPrimary: "#0A0A0F",
  textPrimarySoft: "rgba(0, 0, 0, 0.80)",
  textSecondary: "rgba(0, 0, 0, 0.50)",
  textMuted: "rgba(0, 0, 0, 0.42)",
  textFaint: "rgba(0, 0, 0, 0.32)",
  textGhost: "rgba(0, 0, 0, 0.18)",
  gridLine: "rgba(0, 0, 0, 0.04)",
  brand: BRAND,
};

export const dark: ThemeColors = {
  scoreTrack: "rgba(255, 255, 255, 0.08)",
  borderSubtle: "rgba(255, 255, 255, 0.08)",
  bgPage: "#0A0A0F",
  bgCard: "#111118",
  bgChat: "#0F1A14",
  bgSubtle: "rgba(255, 255, 255, 0.03)",
  bgBar: "rgba(255, 255, 255, 0.06)",
  bgBarSm: "rgba(255, 255, 255, 0.05)",
  bgStrip: "rgba(255, 255, 255, 0.01)",
  borderCard: "rgba(255, 255, 255, 0.08)",
  borderStrong: "rgba(255, 255, 255, 0.10)",
  borderMedium: "rgba(255, 255, 255, 0.12)",
  borderStrip: "rgba(255, 255, 255, 0.05)",
  textPrimary: "#FFFFFF",
  textPrimarySoft: "rgba(255, 255, 255, 0.80)",
  textSecondary: "rgba(255, 255, 255, 0.50)",
  textMuted: "rgba(255, 255, 255, 0.42)",
  textFaint: "rgba(255, 255, 255, 0.35)",
  textGhost: "rgba(255, 255, 255, 0.18)",
  gridLine: "rgba(255, 255, 255, 0.015)",
  brand: BRAND,
};

export const themes = { light, dark } as const;
export type ThemeName = keyof typeof themes;

/**
 * 웹은 box-shadow를 쓰지만 RN에는 없다 — iOS/Android 각각의 그림자 속성으로 옮긴다.
 * 웹 --shadow-card 대응.
 */
export const shadowCard = {
  light: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  dark: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 12,
  },
} as const;

/** 폰트 — assets/fonts 의 OTF를 expo-font로 등록한 뒤 이 이름으로 참조한다 */
export const fonts = {
  regular: "SpoqaHanSansNeo-Regular",
  medium: "SpoqaHanSansNeo-Medium",
  bold: "SpoqaHanSansNeo-Bold",
} as const;
