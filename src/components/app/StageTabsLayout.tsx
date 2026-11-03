/**
 * A안 탭 구성 — 홈 · 분석 · [+] · 정원 · 커뮤니티 (UIUX 실험 `exp/uiux-a-stage`).
 *
 * 실제 앱(`app/(app)/(tabs)/_layout.tsx`)과 로그인 없이 내비게이션까지 눌러 보는 미리보기(`app/preview/stage/_layout.tsx`)가 **같은 코드**를 쓴다.
 * 달라지는 것은 분석 탭의 주소뿐이라 `analysisHref`로 받는다.
 *
 * 탭바는 `StageTabBar`다. 가운데 +는 라우트가 아니라 "스크린타임 올리기" 시트(`UploadSheet`)를 여는 버튼이다:
 *   일간 → 분석 탭 `?start=pick` (분석 탭이 사진 고르기를 바로 연다) · 주간 → 분석 탭
 * '더보기'는 탭에서 빠져 `(app)/more.tsx`(스택 화면)가 됐고 홈 오른쪽 위 프로필 버튼으로 들어간다 — 알림 숫자 배지도 홈의 종으로 옮겼다.
 */
import { useState } from "react";
import { useRouter, type Href } from "expo-router";
import { Tabs } from "expo-router/js-tabs";

import StageTabBar from "@/components/app/StageTabBar";
import { AnalysisIcon, CommunityIcon, GardenIcon, HomeIcon } from "@/components/app/TabIcons";
import UploadSheet from "@/components/app/UploadSheet";
import { colors } from "@/theme";

export default function StageTabsLayout({ analysisHref = "/analysis" }: { analysisHref?: string }) {
  const router = useRouter();
  const [sheet, setSheet] = useState(false);

  return (
    <>
      <Tabs
        tabBar={(props) => <StageTabBar {...props} onUpload={() => setSheet(true)} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.bgPage },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: "홈", tabBarButtonTestID: "tab-home", tabBarIcon: ({ color }) => <HomeIcon color={color} /> }}
        />
        <Tabs.Screen
          name="analysis"
          options={{ title: "분석", tabBarButtonTestID: "tab-analysis", tabBarIcon: ({ color }) => <AnalysisIcon color={color} /> }}
        />
        <Tabs.Screen
          name="garden"
          options={{ title: "정원", tabBarButtonTestID: "tab-garden", tabBarIcon: ({ color }) => <GardenIcon color={color} /> }}
        />
        <Tabs.Screen
          name="community"
          options={{ title: "커뮤니티", tabBarButtonTestID: "tab-community", tabBarIcon: ({ color }) => <CommunityIcon color={color} /> }}
        />
      </Tabs>

      <UploadSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        onDaily={() => {
          setSheet(false);
          router.navigate({ pathname: analysisHref, params: { start: "pick" } } as Href);
        }}
        onWeekly={() => {
          setSheet(false);
          router.navigate(analysisHref as Href);
        }}
      />
    </>
  );
}
