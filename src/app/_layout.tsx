import { useEffect } from "react";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";

import { AuthProvider, useAuth } from "@/auth-context";
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

  // 폰트 로드에 실패해도 멈추지 않는다 (시스템 폰트로 뜬다).
  if (!loaded && !error) return null;

  return (
    <ThemeProvider>
      <AuthProvider>
        <RootStack />
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootStack() {
  const { scheme, colors, hydrated } = useTheme();
  const { user, loading } = useAuth();
  const ready = hydrated && !loading;

  useEffect(() => {
    // 저장된 테마와 로그인 상태를 다 읽은 뒤에 스플래시를 내린다 — 로그인 화면이 한 번 깜빡이지 않게.
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bgPage },
        }}
      >
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="index" />
        </Stack.Protected>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="login" />
        </Stack.Protected>
        {/* M1 기반 점검 화면 — 사용자 데이터가 없는 진단용이라 가드 밖에 둔다 (M9 QA에서 정리) */}
        <Stack.Screen name="foundation" />
      </Stack>
    </>
  );
}
