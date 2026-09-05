/**
 * 테마 컨텍스트 — 기기 설정(useColorScheme) + 사용자 오버라이드.
 * 웹의 `.dark` 클래스 토글에 대응한다 (.claude/rules/design.md).
 *
 * 오버라이드 값은 아직 메모리에만 남는다 — AsyncStorage 영속화는 M2에서 붙인다.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import { themes, type ThemeColors, type ThemeName } from "@/theme";

export type ThemePref = ThemeName | "system";

interface ThemeValue {
  /** 실제로 적용된 스킴 */
  scheme: ThemeName;
  colors: ThemeColors;
  /** 사용자가 고른 값 ("system"이면 기기 설정을 따른다) */
  pref: ThemePref;
  setPref: (pref: ThemePref) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [pref, setPref] = useState<ThemePref>("system");

  // 기기 설정을 못 읽으면 다크로 떨어뜨린다 — Offlo의 기본은 다크다.
  const scheme: ThemeName = pref === "system" ? (system === "light" ? "light" : "dark") : pref;

  const value = useMemo<ThemeValue>(
    () => ({ scheme, colors: themes[scheme], pref, setPref }),
    [scheme, pref],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme은 ThemeProvider 안에서만 쓸 수 있습니다.");
  return ctx;
}
