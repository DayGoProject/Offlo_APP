/**
 * 동물 변경 경고 — 연속 기록이 통째로 초기화되므로 되돌릴 수 없다는 것을 분명히 알린다 (웹 정원 페이지 Modal 이식).
 * 가림막을 누르거나 뒤로 가기로 닫힌다. 저장 중에는 닫히지 않는다.
 */
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import Pill from "@/components/app/Pill";
import { ANIMAL_TYPES, getAnimalEmoji, type AnimalTypeId } from "@/shared/garden-utils";
import { colors, em, fonts, radius } from "@/theme";

export interface ChangeAnimalTarget {
  from: AnimalTypeId;
  streak: number;
  /** 지금 단계 이름 — "성체" */
  stageName: string;
  to: AnimalTypeId;
}

export default function ChangeAnimalModal({
  target,
  saving,
  onCancel,
  onConfirm,
}: {
  target: ChangeAnimalTarget | null;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const close = () => {
    if (!saving) onCancel();
  };
  const from = target && ANIMAL_TYPES.find((t) => t.id === target.from);
  const to = target && ANIMAL_TYPES.find((t) => t.id === target.to);

  return (
    <Modal visible={!!target} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <Pressable testID="change-scrim" accessibilityLabel="닫기" style={styles.scrim} onPress={close}>
        {/* 카드 안을 눌러도 닫히지 않게 한 겹 막는다 */}
        <Pressable testID="change-modal" style={styles.card} onPress={() => {}}>
          {target && from && to ? (
            <>
              <Text accessibilityRole="header" style={styles.title}>
                동물을 변경하시겠어요?
              </Text>
              <Text style={styles.danger}>지금까지 쌓은 연속 기록이 모두 초기화됩니다.</Text>

              <View style={styles.compare}>
                <View style={styles.side}>
                  <Text style={styles.emoji}>{getAnimalEmoji(target.from, target.streak)}</Text>
                  <Text style={styles.sideName}>{from.name}</Text>
                  <Text style={[styles.sideDays, { color: colors.brand }]}>{target.streak}일 연속</Text>
                </View>
                <Text style={styles.arrow}>→</Text>
                <View style={styles.side}>
                  <Text style={styles.emoji}>{to.emoji}</Text>
                  <Text style={styles.sideName}>{to.name}</Text>
                  <Text style={[styles.sideDays, { color: colors.textMuted }]}>0일 연속</Text>
                </View>
              </View>

              <Text style={styles.notice}>
                연속 기록 {target.streak}일과 현재 단계 {target.stageName}이(가) 영구적으로 사라집니다. 되돌릴 수 없어요.
              </Text>

              <View style={styles.actions}>
                <Pill testID="change-cancel" label="취소" onPress={close} disabled={saving} />
                <Pill
                  testID="change-confirm"
                  variant="danger"
                  label={saving ? "변경 중…" : "변경하기"}
                  onPress={onConfirm}
                  disabled={saving}
                />
              </View>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
    backgroundColor: colors.scrim,
  },
  card: {
    gap: 16,
    padding: 22,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgCard,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  danger: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.danger,
  },
  compare: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  side: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgSubtle,
  },
  emoji: {
    fontSize: 36,
    lineHeight: 44,
  },
  sideName: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textPrimary,
  },
  sideDays: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: em(12, 0),
  },
  arrow: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.danger,
  },
  notice: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.danger,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.dangerLine,
    backgroundColor: colors.dangerSoft,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
});
