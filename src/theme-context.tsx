/**
 * 테마 컨텍스트 — 기기 설정(useColorScheme) + 사용자 오버라이드.
 * 웹의 `.dark` 클래스 토글에 대응한다 (.claude/rules/design.md).
 *
 * 오버라이드 값은 AsyncStorage에 남겨 앱을 다시 켜도 유지한다.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import { themes, type ThemeColors, type ThemeName } from "@/theme";

export type ThemePref = ThemeName | "system";

const STORAGE_KEY = "offlo:theme-pref";

function isThemePref(value: string): value is ThemePref {
  return value === "system" || value === "light" || value === "dark";
}

interface ThemeValue {
  /** 실제로 적용된 스킴 */
  scheme: ThemeName;
  colors: ThemeColors;
  /** 사용자가 고른 값 ("system"이면 기기 설정을 따른다) */
  pref: ThemePref;
  setPref: (pref: ThemePref) => void;
  /** 저장된 오버라이드를 읽었는가 — 읽기 전에 그리면 테마가 한 번 깜빡인다 */
  hydrated: boolean;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>("system");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && isThemePref(saved)) setPrefState(saved);
      } catch {
        // 못 읽으면 기기 설정을 따른다
      } finally {
        setHydrated(true);
      }
    }
    load();
  }, []);

  // 기기 설정을 못 읽으면 다크로 떨어뜨린다 — Offlo의 기본은 다크다.
  const scheme: ThemeName = pref === "system" ? (system === "light" ? "light" : "dark") : pref;

  const value = useMemo<ThemeValue>(() => {
    function setPref(next: ThemePref) {
      setPrefState(next);
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
    }
    return { scheme, colors: themes[scheme], pref, setPref, hydrated };
  }, [scheme, pref, hydrated]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme은 ThemeProvider 안에서만 쓸 수 있습니다.");
  return ctx;
}
