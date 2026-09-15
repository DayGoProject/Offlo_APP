import { useEffect } from "react";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";

import { AuthProvider, useAuth } from "@/auth-context";
import { colors, fonts } from "@/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  /**
   * Expo Go에서는 app.json의 expo-font 플러그인(네이티브 임베딩)이 적용되지 않는다.
   * 런타임 로드를 해야 검증 3층(웹·에뮬레이터·Expo Go) 모두에서 같은 폰트가 뜬다.
   */
  const [loaded, error] = useFonts({
    [fonts.regular]: require("../../assets/fonts/Pretendard-Regular.otf"),
    [fonts.semibold]: require("../../assets/fonts/Pretendard-SemiBold.otf"),
    [fonts.num]: require("../../assets/fonts/FamiljenGrotesk-Variable.ttf"),
  });

  // 폰트 로드에 실패해도 멈추지 않는다 (시스템 폰트로 뜬다).
  if (!loaded && !error) return null;

  return (
    <AuthProvider>
      <RootStack />
    </AuthProvider>
  );
}

function RootStack() {
  const { user, loading } = useAuth();

  useEffect(() => {
    // 저장된 로그인 상태를 읽은 뒤에 스플래시를 내린다 — 로그인 화면이 한 번 깜빡이지 않게.
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  if (loading) return null;

  return (
    <>
      {/* 다크 단일 테마 — 상태 표시줄 글자는 항상 밝게 */}
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bgPage },
        }}
      >
        {/* 로그인 전용 화면은 전부 (app)/ 아래에 둔다 — 폴더에 넣기만 하면 가드가 걸린다 */}
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="login" />
        </Stack.Protected>
        {/* 가드 밖 — 사용자 데이터가 없는 화면만 (security.md): M1 점검 · 층 ① 미리보기 */}
        <Stack.Screen name="foundation" />
        <Stack.Screen name="preview" />
      </Stack>
    </>
  );
}
