/**
 * 홈(몰입형 스테이지) 미리보기 — UIUX 실험 A안. 홈 히어로 + 가운데 + 탭바 + 업로드 시트를 한 화면에 얹어 본다.
 * `?state=fed|peckish|starving|egg|none|legend|loading|error` (`&still=1`이면 동물 정지 · `&sheet=1`이면 업로드 시트가 열린 채 시작 ·
 * `&tab=analysis|garden|community`이면 그 탭이 선택된 모양 · `&week=N`이면 이번 주 일간 분석 N개).
 * 샘플 값만 쓴다 (api · useAuth 금지). 호출 기록은 `globalThis.__offloHomeCalls`.
 */
import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";

import { StageTabBarView, type StageTabItem } from "@/components/app/StageTabBar";
import { AnalysisIcon, CommunityIcon, GardenIcon, HomeIcon } from "@/components/app/TabIcons";
import UploadSheet from "@/components/app/UploadSheet";
import HomeStage from "@/components/home/HomeStage";
import { usePetAffection } from "@/hooks/use-pet-affection";
import { GARDEN_NOW, GARDEN_SAMPLES, gardenWeekRecords } from "@/preview/samples";
import { API_MESSAGES } from "@/services/api-client";
import { applyPetTaps, type PetRecord } from "@/shared/garden-utils";
import { kstDateKey } from "@/shared/kst";
import { colors } from "@/theme";

const log = (entry: string) => {
  const g = globalThis as { __offloHomeCalls?: string[] };
  (g.__offloHomeCalls ??= []).push(entry);
};

export default function HomePreview() {
  const { state = "fed", still, sheet, tab = "home", week } = useLocalSearchParams<{ state?: string; still?: string; sheet?: string; tab?: string; week?: string }>();
  const [sheetOpen, setSheetOpen] = useState(sheet === "1");

  const data = state === "loading" || state === "error" ? null : (GARDEN_SAMPLES[state] ?? null);
  const weekCount = week !== undefined && Number.isFinite(Number(week)) ? Number(week) : state === "fed" || state === "legend" ? 4 : 3;
  const records = state === "loading" || state === "error" ? null : gardenWeekRecords(weekCount, false);

  // 쓰다듬기 — 서버가 하는 일을 같은 함수로 흉내 낸다 (정원 미리보기와 같다)
  const dayKey = kstDateKey(GARDEN_NOW);
  const startPet: PetRecord | null = data?.animal ? data.animal.pet : null;
  const serverPet = useRef<PetRecord | null>(startPet);
  const affection = usePetAffection({
    pet: startPet,
    scope: data?.animal?.type ?? null,
    now: GARDEN_NOW,
    getNow: () => GARDEN_NOW,
    send: async (count) => {
      log(`pet ${count}`);
      await new Promise((r) => setTimeout(r, 200));
      const { next } = applyPetTaps(serverPet.current ?? { date: null, today: 0, total: 0 }, dayKey, count);
      serverPet.current = next;
      return next;
    },
    onFailed: () => {
      serverPet.current = startPet;
    },
  });

  const items: StageTabItem[] = [
    { key: "home", label: "홈", icon: (c) => <HomeIcon color={c} />, focused: tab === "home", testID: "tab-home", onPress: () => log("tab home") },
    { key: "analysis", label: "분석", icon: (c) => <AnalysisIcon color={c} />, focused: tab === "analysis", testID: "tab-analysis", onPress: () => log("tab analysis") },
    { key: "garden", label: "정원", icon: (c) => <GardenIcon color={c} />, focused: tab === "garden", testID: "tab-garden", onPress: () => log("tab garden") },
    { key: "community", label: "커뮤니티", icon: (c) => <CommunityIcon color={c} />, focused: tab === "community", testID: "tab-community", onPress: () => log("tab community") },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
      <View style={{ flex: 1 }}>
        <HomeStage
          now={GARDEN_NOW}
          data={data}
          loading={state === "loading"}
          error={state === "error" ? API_MESSAGES.network : null}
          onRetry={() => log("retry")}
          records={records}
          weekStatus={records ? "ready" : state === "error" ? "error" : "loading"}
          animate={still !== "1"}
          affection={data?.animal?.type ? affection : null}
          unreadCount={3}
          onOpenNotifications={() => log("notifications")}
          onOpenProfile={() => log("profile")}
          onUpload={() => log("upload")}
          onOpenToday={(id) => log(`today ${id}`)}
          onOpenGarden={() => log("garden")}
        />
      </View>
      <StageTabBarView items={items} onUpload={() => setSheetOpen(true)} />
      <UploadSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onDaily={() => {
          log("sheet daily");
          setSheetOpen(false);
        }}
        onWeekly={() => {
          log("sheet weekly");
          setSheetOpen(false);
        }}
      />
    </View>
  );
}
