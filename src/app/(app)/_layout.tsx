/**
 * 로그인 전용 영역 — 루트 `_layout.tsx`의 `Stack.Protected`가 이 폴더 전체를 막는다.
 * 새 로그인 전용 화면은 이 폴더 아래에 만든다.
 */
import { Stack } from "expo-router";

import { colors } from "@/theme";

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgPage } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="history" />
    </Stack>
  );
}
