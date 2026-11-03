/**
 * "스크린타임 올리기" 바닥 시트 — 가운데 + 버튼(`StageTabBar`)이 연다 (UIUX 실험 A안).
 * 고르기 전에 한 번 더 설명하고 두 갈래(오늘 일간 / 이번 주 주간)로 나눈다. props만 받는다 — api · 내비게이션을 import하지 않는다.
 *
 *   일간 분석 → 분석 탭으로 가서 사진 고르기를 바로 연다 (엄지 두 번: + → 일간)
 *   주간 분석 → 분석 탭의 주간 카드로
 */
import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { UploadIcon } from "@/components/app/Icons";
import { AnalysisIcon } from "@/components/app/TabIcons";
import { colors, fonts, radius } from "@/theme";

export default function UploadSheet({
  visible,
  onClose,
  onDaily,
  onWeekly,
}: {
  visible: boolean;
  onClose: () => void;
  onDaily: () => void;
  onWeekly: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable testID="upload-sheet-dim" accessibilityRole="button" accessibilityLabel="닫기" style={StyleSheet.absoluteFill} onPress={onClose}>
          <View style={styles.dim} />
        </Pressable>

        <View testID="upload-sheet" style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />
          <Text accessibilityRole="header" style={styles.title}>
            스크린타임 올리기
          </Text>
          <Text style={styles.sub}>하루 한 번 · 사진은 저장하지 않고 분석한 뒤 바로 버려요</Text>

          <View style={styles.options}>
            <Option testID="upload-daily" title="오늘 일간 분석" hint="오늘 화면 사용 시간 스크린샷을 골라요" icon={<UploadIcon color={colors.brand} size={22} />} onPress={onDaily} />
            <Option testID="upload-weekly" title="이번 주 주간 분석" hint="일간 분석이 7개 모이면 열려요" icon={<AnalysisIcon color={colors.brand} size={22} />} onPress={onWeekly} />
          </View>

          <Pressable testID="upload-sheet-close" accessibilityRole="button" onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>닫기</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Option({ testID, title, hint, icon, onPress }: { testID: string; title: string; hint: string; icon: ReactNode; onPress: () => void }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${hint}`}
      onPress={onPress}
      style={({ pressed }) => [styles.option, { opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={styles.optionIcon}>{icon}</View>
      <View style={styles.optionText}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionHint}>{hint}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  dim: {
    flex: 1,
    backgroundColor: colors.scrim,
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgNav,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 20,
    backgroundColor: colors.textGhost,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 20,
    lineHeight: 28,
    color: colors.textPrimary,
  },
  sub: {
    marginTop: 4,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
  },
  options: {
    gap: 12,
    marginTop: 24,
    marginBottom: 16,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgBarSm,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  optionHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  chevron: {
    fontFamily: fonts.regular,
    fontSize: 22,
    color: colors.textFaint,
  },
  close: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  closeText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textPrimary,
  },
});
