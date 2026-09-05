import { useEffect } from "react";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";

import { fonts } from "@/theme";
import { ThemeProvider, useTheme } from "@/theme-context";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  /**
   * Expo Go에서는 app.json의 expo-font 플러그인(네이티브 임베딩)이 적용되지 않는다.
   * 런타임 로드를 해야 검증 3층(웹·에뮬레이터·Expo Go) 모두에서 같은 폰트가 뜬다.
   */
  const [loaded, error] = useFonts({
    [fonts.regular]: require("../../assets/fonts/SpoqaHanSansNeo-Regular.ttf"),
    [fonts.medium]: require("../../assets/fonts/SpoqaHanSansNeo-Medium.ttf"),
    [fonts.bold]: require("../../assets/fonts/SpoqaHanSansNeo-Bold.ttf"),
  });

  useEffect(() => {
    // 폰트 로드에 실패해도 스플래시에 갇히지 않게 한다 (시스템 폰트로 뜬다).
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <ThemeProvider>
      <RootStack />
    </ThemeProvider>
  );
}

function RootStack() {
  const { scheme, colors } = useTheme();

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bgPage },
        }}
      />
    </>
  );
}
