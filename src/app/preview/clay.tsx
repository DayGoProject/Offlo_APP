/**
 * 3D 클레이 동물 확인 — 정원 장면에 얹을 "교체할 에셋"을 동물 · 성장 단계 · 상태 · 동작별로 본다.
 * `?type=cat|dog|rabbit&stage=egg|baby|growing|adult|enhanced|legend&condition=fed|peckish|starving&hold=eat|pet&spin=1&still=1&yaw=180`
 * 샘플 값만 쓴다 (api · useAuth 금지). 동물(또는 알)을 직접 눌러도 쓰다듬는다.
 */
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import PageHeader from "@/components/app/PageHeader";
import Pill from "@/components/app/Pill";
import Screen from "@/components/app/Screen";
import Segmented from "@/components/app/Segmented";
import ClayPetView from "@/components/garden/three/ClayPetView";
import type { HoldAction } from "@/components/garden/three/PetScene";
import type { PetCondition } from "@/logic/garden";
import type { AnimalStatus, AnimalTypeId } from "@/shared/garden-utils";
import { colors, fonts } from "@/theme";

const CONDITIONS: { value: PetCondition; label: string }[] = [
  { value: "fed", label: "배부름" },
  { value: "peckish", label: "출출함" },
  { value: "starving", label: "굶주림" },
];

const STAGES: { value: AnimalStatus; label: string }[] = [
  { value: "egg", label: "알" },
  { value: "baby", label: "아기" },
  { value: "growing", label: "성장" },
  { value: "adult", label: "성체" },
  { value: "enhanced", label: "강화" },
  { value: "legend", label: "전설" },
];

/** 밥 먹는 연출이 끝나는 시점(3.6초) 바로 전에 "먹었다"로 넘긴다 — 실제 게임에서 분석을 마치면 배부름이 되는 흐름 */
const FED_AFTER_MS = 3400;

export default function ClayPreview() {
  const params = useLocalSearchParams<{ type?: string; stage?: string; condition?: string; hold?: string; spin?: string; still?: string; yaw?: string }>();
  const [type, setType] = useState<AnimalTypeId>((["cat", "dog", "rabbit"].includes(params.type ?? "") ? params.type : "cat") as AnimalTypeId);
  const [stage, setStage] = useState<AnimalStatus>(STAGES.find((s) => s.value === params.stage)?.value ?? "adult");
  const [condition, setCondition] = useState<PetCondition>(CONDITIONS.find((c) => c.value === params.condition)?.value ?? "fed");
  const [spin, setSpin] = useState(params.spin === "1");
  const [eatSignal, setEatSignal] = useState(0);
  const [petSignal, setPetSignal] = useState(0);
  const still = params.still === "1";
  const yaw = (Number(params.yaw) || 0) * (Math.PI / 180); // 도(°) — 180이면 뒷모습
  const hold: HoldAction = params.hold === "eat" || params.hold === "pet" ? params.hold : null;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const feed = () => {
    setEatSignal((n) => n + 1);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCondition("fed"), FED_AFTER_MS);
  };

  return (
    <Screen testID="clay">
      <PageHeader eyebrow="3D 클레이 동물 · 교체할 에셋" title="동물 확인" />
      <Segmented
        value={type}
        onChange={setType}
        options={[
          { value: "cat", label: "고양이" },
          { value: "dog", label: "강아지" },
          { value: "rabbit", label: "토끼" },
        ]}
      />
      <View style={styles.box} testID="clay-box">
        <ClayPetView type={type} stage={stage} condition={condition} spin={spin} yaw={yaw} still={still} hold={hold} anxious={false} eatSignal={eatSignal} petSignal={petSignal} />
      </View>
      <Segmented value={stage} onChange={setStage} options={STAGES} />
      <View style={styles.row}>
        {CONDITIONS.map((c) => (
          <Pill key={c.value} testID={`clay-${c.value}`} label={c.label} variant={condition === c.value ? "accent" : "ghost"} onPress={() => setCondition(c.value)} />
        ))}
      </View>
      <View style={styles.row}>
        <Pill testID="clay-eat" label="밥 먹기" onPress={feed} />
        <Pill testID="clay-pet" label="쓰다듬기" onPress={() => setPetSignal((n) => n + 1)} />
        <Pill testID="clay-spin" label={spin ? "회전 끄기" : "돌려 보기"} variant="ghost" onPress={() => setSpin((v) => !v)} />
      </View>
      <Text style={styles.note}>
        뼈대 8개 · 코드로 조각한 모델(scripts/sculpt). 얼굴 표정 · 밥 먹기 · 쓰다듬기(하트) · 성장 단계 외형(아기 큰 머리 → 스카프 → 왕관 · 오라)이 상태값으로 움직입니다. 동물을 직접 눌러도 됩니다.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: {
    height: 420,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#141D33",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
});
