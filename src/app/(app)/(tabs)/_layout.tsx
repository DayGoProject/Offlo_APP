/**
 * 하단 탭 5개 — 홈 · 분석 · 정원 · 커뮤니티 · 더보기.
 *
 * 웹 사이드바 7개를 5개로 줄였다: 기록 · 목표 · 배지 · 설정은 "더보기"로 묶는다 (탭바 상한 5개).
 * 활성 탭은 웹 사이드바처럼 브랜드 그린.
 */
import { Tabs } from "expo-router/js-tabs";

import { AnalysisIcon, CommunityIcon, GardenIcon, HomeIcon, MoreIcon } from "@/components/app/TabIcons";
import { colors, fonts } from "@/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bgPage },
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bgNav,
          borderTopColor: colors.borderCard,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontFamily: fonts.regular, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "홈", tabBarButtonTestID: "tab-home", tabBarIcon: ({ color }) => <HomeIcon color={color} /> }}
      />
      <Tabs.Screen
        name="analysis"
        options={{
          title: "분석",
          tabBarButtonTestID: "tab-analysis",
          tabBarIcon: ({ color }) => <AnalysisIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="garden"
        options={{ title: "정원", tabBarButtonTestID: "tab-garden", tabBarIcon: ({ color }) => <GardenIcon color={color} /> }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: "커뮤니티",
          tabBarButtonTestID: "tab-community",
          tabBarIcon: ({ color }) => <CommunityIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: "더보기", tabBarButtonTestID: "tab-more", tabBarIcon: ({ color }) => <MoreIcon color={color} /> }}
      />
    </Tabs>
  );
}
