/**
 * 로그인 전용 영역 — 루트 `_layout.tsx`의 `Stack.Protected`가 이 폴더 전체를 막는다.
 * 새 로그인 전용 화면은 이 폴더 아래에 만든다.
 */
import { Stack } from "expo-router";

import { NotificationsProvider } from "@/hooks/notifications-context";
import { RemindersProvider } from "@/hooks/reminders-context";
import { colors } from "@/theme";

export default function AppLayout() {
  return (
    // 알림은 로그인하는 순간부터 한 번만 구독해 모든 화면이 나눠 쓴다 (더보기 탭의 숫자 · 홈의 종 · 알림 화면)
    <NotificationsProvider>
      {/* 로컬 예약 알림(저녁 분석 · 동물 배고픔 · 목표 마감) — 설정 · 동기화 · 알림 탭 이동. 로그아웃하면 예약을 지운다 */}
      <RemindersProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgPage } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="history" />
          <Stack.Screen name="goals" />
          <Stack.Screen name="badges" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="result/[id]" />
          <Stack.Screen name="chat/[id]" />
        </Stack>
      </RemindersProvider>
    </NotificationsProvider>
  );
}
