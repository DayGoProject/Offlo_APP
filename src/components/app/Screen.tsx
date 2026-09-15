/**
 * 앱 화면의 공통 틀 — 웹 `components/app/AppShell.tsx` 대응.
 * 모바일 여백(가로 16 · 세로 24 · 간격 20)을 페이지마다 다시 적지 않는다.
 *
 * 탭 화면은 하단 탭바가 아래 인셋을 차지하므로 `underTabBar`를 켠다.
 */
import type { ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/theme";

export default function Screen({
  children,
  testID,
  underTabBar = false,
  refreshing = false,
  onRefresh,
}: {
  children: ReactNode;
  testID?: string;
  underTabBar?: boolean;
  refreshing?: boolean;
  /** 주면 당겨서 새로고침을 켠다 */
  onRefresh?: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      testID={testID}
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 24, paddingBottom: (underTabBar ? 0 : insets.bottom) + 32 },
      ]}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
            progressBackgroundColor={colors.bgCard}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.bgPage,
  },
  content: {
    paddingHorizontal: 16,
    gap: 20,
  },
});
