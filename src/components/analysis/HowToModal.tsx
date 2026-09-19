/**
 * "스크린샷 찍는 방법" — 웹 분석 페이지의 Modal 이식. 가림막을 누르거나 뒤로 가기로 닫힌다.
 */
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import Pill from "@/components/app/Pill";
import { colors, em, fonts, radius } from "@/theme";

const STEPS = [
  { os: "iPhone", step: "설정 → 스크린 타임 → 상단 '일' 탭을 선택한 뒤 화면 전체를 캡처하세요." },
  { os: "Android (갤럭시 등)", step: "설정 → 디지털 웰빙 및 자녀 보호 기능 → 오늘 사용 시간 화면을 캡처하세요." },
] as const;

export default function HowToModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable testID="howto-scrim" accessibilityLabel="닫기" style={styles.scrim} onPress={onClose}>
        {/* 카드 안을 눌러도 닫히지 않게 한 겹 막는다 */}
        <Pressable testID="howto-modal" style={styles.card} onPress={() => {}}>
          <Text accessibilityRole="header" style={styles.title}>
            스크린샷 찍는 방법
          </Text>
          {STEPS.map(({ os, step }) => (
            <View key={os} style={styles.step}>
              <Text style={styles.os}>{os}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
          <Text style={styles.foot}>일간 분석은 하루 1회입니다. 이번 주 7일치가 쌓이면 주간 종합 분석이 열립니다.</Text>
          <View style={styles.close}>
            <Pill testID="howto-close" label="닫기" onPress={onClose} />
          </View>
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
    gap: 12,
    padding: 22,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgCard,
  },
  title: {
    marginBottom: 4,
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  step: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgSubtle,
  },
  os: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: em(12, 0.06),
    color: colors.brand,
  },
  stepText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 21,
    color: colors.textPrimarySoft,
  },
  foot: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 19,
    color: colors.textMuted,
  },
  close: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
});
