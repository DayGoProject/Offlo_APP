/**
 * 동물 아트 시트 — `?type=cat&stage=adult&still=1`. 상태 3종(배부름 · 출출 · 굶주림)을 한 화면에 늘어놓고 눈으로 본다.
 * `still=1`이면 정지 포즈(스크린샷 비교용), 아니면 앰비언트 모션이 돈다. 샘플 값만 쓴다 (api · useAuth 금지).
 */
import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import Screen from "@/components/app/Screen";
import PageHeader from "@/components/app/PageHeader";
import Pet from "@/components/garden/art/Pet";
import type { PetCondition } from "@/logic/garden";
import { ANIMAL_STAGES, type AnimalStatus, type AnimalTypeId } from "@/shared/garden-utils";
import { colors, fonts } from "@/theme";

const CONDITIONS: { condition: PetCondition; label: string; anxious?: boolean }[] = [
  { condition: "fed", label: "배부름" },
  { condition: "peckish", label: "출출함" },
  { condition: "peckish", label: "출출함 (저녁)", anxious: true },
  { condition: "starving", label: "굶주림" },
];

export default function PetArtPreview() {
  const { type = "cat", stage = "adult", still = "1" } = useLocalSearchParams<{ type?: string; stage?: string; still?: string }>();
  const status = (ANIMAL_STAGES.find((s) => s.status === stage)?.status ?? "adult") as AnimalStatus;

  return (
    <Screen testID="pet-art">
      <PageHeader eyebrow={`${type} · ${status}`} title="동물 아트 시트" />
      <View style={styles.grid}>
        {CONDITIONS.map(({ condition, label, anxious }) => (
          <View key={label} style={styles.cell}>
            <View style={styles.frame}>
              <Pet type={type as AnimalTypeId} size={168} condition={condition} stage={status} anxious={anxious} animate={still !== "1"} />
            </View>
            <Text style={styles.label}>{label}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  cell: {
    flexBasis: "47%",
    flexGrow: 1,
    alignItems: "center",
    gap: 8,
  },
  frame: {
    width: "100%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    // 방 바닥과 비슷한 어두운 푸른 바탕 — 밝은 동물이 어떻게 보이는지 확인용
    backgroundColor: "#141D33",
    overflow: "hidden",
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
});
