/**
 * 탭바 — UIUX 실험 A안 "몰입형 스테이지" (브랜치 `exp/uiux-a-stage`).
 *
 *   홈 · 분석 · [ + ] · 정원 · 커뮤니티
 *
 * 가운데 큰 +는 라우트가 아니라 **"스크린타임 올리기"** 버튼이다 — 이 앱의 하루 한 번뿐인 핵심 행동이라 엄지가 닿는 맨 아래 가운데에 둔다.
 * '더보기'는 탭에서 빠져 홈 오른쪽 위 프로필 버튼으로 옮겼다 (`(app)/more.tsx`).
 *
 * 그림은 `StageTabBarView`(props만 — 미리보기도 같은 컴포넌트를 쓴다), 내비게이션과 잇는 일은 `StageTabBar`가 한다.
 * + 버튼은 막대 위로 솟아 있다: 안드로이드는 부모 영역 밖의 터치를 받지 않으므로 **바깥 상자를 솟은 만큼 키우고**(`pointerEvents="box-none"`)
 * 음수 위쪽 여백으로 내용 영역은 줄지 않게 한다. 그림자 대신 반투명 테두리 고리를 둘렀다.
 */
import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import type { Tabs } from "expo-router/js-tabs";

import { colors, fonts } from "@/theme";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

export interface StageTabItem {
  key: string;
  label: string;
  icon: (color: string) => ReactNode;
  focused: boolean;
  testID?: string;
  onPress: () => void;
}

/** 막대 높이 · + 버튼 지름 · 막대 위로 솟는 높이 · 버튼을 감싼 고리 두께 */
const BAR_H = 64;
const FAB = 58;
const RING = 7;
const RISE = 26;

export function StageTabBarView({ items, onUpload }: { items: StageTabItem[]; onUpload: () => void }) {
  const insets = useSafeAreaInsets();
  const left = items.slice(0, 2);
  const right = items.slice(2);

  const tab = (item: StageTabItem) => {
    const color = item.focused ? colors.brand : colors.textFaint;
    return (
      <Pressable
        key={item.key}
        testID={item.testID}
        accessibilityRole="tab"
        accessibilityLabel={item.label}
        aria-selected={item.focused}
        onPress={item.onPress}
        style={styles.tab}
      >
        {item.icon(color)}
        <Text style={[styles.label, { color: item.focused ? colors.textPrimary : colors.textFaint }]}>{item.label}</Text>
      </Pressable>
    );
  };

  return (
    <View pointerEvents="box-none" style={[styles.outer, { height: BAR_H + RISE + insets.bottom, marginTop: -RISE }]}>
      <View style={[styles.bar, { height: BAR_H + insets.bottom, paddingBottom: insets.bottom }]}>
        {left.map(tab)}
        <View style={styles.tab} />
        {right.map(tab)}
      </View>

      <View pointerEvents="box-none" style={styles.fabLane}>
        <Pressable
          testID="tab-upload"
          accessibilityRole="button"
          accessibilityLabel="스크린타임 올리기"
          onPress={onUpload}
          style={({ pressed }) => [styles.ring, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
        >
          <View style={styles.fab}>
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
              <Path d="M12 5v14M5 12h14" stroke={colors.bgPage} strokeWidth={2.4} strokeLinecap="round" />
            </Svg>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

/** 내비게이터의 탭 상태를 `StageTabBarView`로 옮긴다 — `Tabs`의 `tabBar` 자리에 꽂는다 */
export default function StageTabBar({ state, descriptors, navigation, onUpload }: TabBarProps & { onUpload: () => void }) {
  const items: StageTabItem[] = state.routes.map((route, index) => {
    const { options } = descriptors[route.key];
    const focused = state.index === index;
    return {
      key: route.key,
      label: typeof options.title === "string" ? options.title : route.name,
      icon: (color) => options.tabBarIcon?.({ focused, color, size: 22 }),
      focused,
      testID: options.tabBarButtonTestID,
      onPress: () => {
        // 기본 탭바와 같은 순서 — 누른 사실을 알리고, 막히지 않았고 다른 탭이면 이동
        const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
        if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
      },
    };
  });
  return <StageTabBarView items={items} onUpload={onUpload} />;
}

const styles = StyleSheet.create({
  outer: {
    justifyContent: "flex-end",
    backgroundColor: "transparent",
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    backgroundColor: colors.bgNav,
    borderTopWidth: 1,
    borderTopColor: colors.borderCard,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 44,
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  fabLane: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  ring: {
    width: FAB + RING * 2,
    height: FAB + RING * 2,
    borderRadius: (FAB + RING * 2) / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
  },
  fab: {
    width: FAB,
    height: FAB,
    borderRadius: FAB / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
});
