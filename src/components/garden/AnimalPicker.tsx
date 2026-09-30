/**
 * 동물 고르기 — 처음 선택할 때와 "동물 변경하기"에서 같이 쓴다.
 * 처음엔 누르는 즉시 저장하고, 변경일 때는 부모가 경고 모달을 띄운다 (웹 정원 페이지와 같은 흐름).
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import Card, { CardHeader } from "@/components/app/Card";
import Pill from "@/components/app/Pill";
import { ANIMAL_TRAITS } from "@/logic/garden";
import { ANIMAL_TYPES, type AnimalTypeId } from "@/shared/garden-utils";
import { colors, fonts } from "@/theme";

export default function AnimalPicker({
  current,
  disabled = false,
  onPick,
  onCancel,
}: {
  /** 지금 함께하는 동물 — 변경일 때만 있다 (그 동물은 다시 고를 수 없다) */
  current?: AnimalTypeId | null;
  disabled?: boolean;
  onPick: (type: AnimalTypeId) => void;
  /** 주면 "취소"를 보인다 (변경 중) */
  onCancel?: () => void;
}) {
  return (
    <Card testID="animal-picker">
      <CardHeader title={current ? "어떤 동물로 바꿀까요?" : "함께할 동물을 선택하세요"} />
      <View style={styles.list}>
        {ANIMAL_TYPES.map((t) => {
          const isCurrent = t.id === current;
          return (
            <Pressable
              key={t.id}
              testID={`animal-option-${t.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${t.name} ${ANIMAL_TRAITS[t.id]}`}
              accessibilityState={{ disabled: disabled || isCurrent }}
              disabled={disabled || isCurrent}
              onPress={() => onPick(t.id)}
              style={({ pressed }) => [styles.option, { opacity: isCurrent ? 0.4 : pressed ? 0.75 : 1 }]}
            >
              <Text style={styles.emoji}>{t.emoji}</Text>
              <View style={styles.text}>
                <Text style={styles.name}>{t.name}</Text>
                <Text style={styles.trait}>{isCurrent ? "지금 함께하고 있어요" : ANIMAL_TRAITS[t.id]}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        })}
      </View>
      {onCancel ? (
        <View style={styles.cancel}>
          <Pill testID="animal-picker-cancel" label="취소" onPress={onCancel} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  option: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgSubtle,
  },
  emoji: {
    fontSize: 38,
    lineHeight: 46,
  },
  text: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  trait: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  chevron: {
    fontFamily: fonts.regular,
    fontSize: 22,
    color: colors.textFaint,
  },
  cancel: {
    flexDirection: "row",
  },
});
