/**
 * 동물 효과음 청음 — 모든 소리를 하나씩 눌러 들어 본다. 합성 소리(`scripts/sound/build-sounds.mjs`)라 귀로 듣고 고르는 단계가 필요하다.
 * 소리 켜기 · 끄기 선택과 무관하게 재생한다 (`force`). 샘플 값만 쓴다 (api · useAuth 금지).
 */
import { StyleSheet, Text, View } from "react-native";

import PageHeader from "@/components/app/PageHeader";
import Pill from "@/components/app/Pill";
import Screen from "@/components/app/Screen";
import { playPetSound, type PetSoundId } from "@/services/pet-sound";
import { colors, fonts } from "@/theme";

const GROUPS: { title: string; note: string; items: { id: PetSoundId; label: string }[] }[] = [
  {
    title: "고양이",
    note: "쓰다듬기 — 배부름 · 출출함은 기분 좋은 야옹, 굶주림은 시무룩한 소리",
    items: [{ id: "cat_happy", label: "기분 좋은 야옹" }, { id: "cat_sad", label: "시무룩한 소리" }],
  },
  {
    title: "강아지",
    note: "쓰다듬기 — 기분 좋은 왈왈 / 굶주리면 낑낑",
    items: [{ id: "dog_happy", label: "왈왈" }, { id: "dog_sad", label: "낑낑" }],
  },
  {
    title: "토끼",
    note: "쓰다듬기 — 작은 찍찍 / 굶주리면 힘없는 한숨",
    items: [{ id: "rabbit_happy", label: "찍찍" }, { id: "rabbit_sad", label: "한숨" }],
  },
  {
    title: "장면",
    note: "밥 먹기(3.4초 · 첫 바삭은 고개가 그릇에 닿을 때) · 알 두드림 · 부화 · 단계 상승",
    items: [
      { id: "eat", label: "밥 먹는 소리" },
      { id: "egg_knock", label: "알 톡톡" },
      { id: "hatch", label: "부화" },
      { id: "chime", label: "단계 상승" },
    ],
  },
];

export default function SoundPreview() {
  return (
    <Screen testID="sound">
      <PageHeader eyebrow="동물 효과음 · 청음" title="소리 확인" />
      {GROUPS.map((g) => (
        <View key={g.title} style={styles.group}>
          <Text style={styles.title}>{g.title}</Text>
          <Text style={styles.note}>{g.note}</Text>
          <View style={styles.row}>
            {g.items.map((item) => (
              <Pill key={item.id} testID={`sound-${item.id}`} label={item.label} onPress={() => void playPetSound(item.id, true)} />
            ))}
          </View>
        </View>
      ))}
      <Text style={styles.note}>
        합성한 소리라 만든 쪽에서는 귀로 확인하지 못했습니다. 들어 보고 어색한 소리를 알려 주세요 — scripts/sound/build-sounds.mjs에서 피치 · 길이 · 음색을 고칩니다. 휴대폰의 무음 스위치가 켜져 있으면 소리가 나지 않습니다.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  title: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textPrimary },
  note: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textMuted },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
});
