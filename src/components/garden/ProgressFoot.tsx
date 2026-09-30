/**
 * 진행도 요약 — 큰 숫자 + 바 + 남은 만큼 한 줄. 웹 정원 페이지의 `ProgressFoot` 이식.
 * 숫자만 Familjen Grotesk — 뒤의 한글 단위는 `unit`으로 받아 Pretendard로 되돌린다 (한글 글리프가 없다).
 */
import { StyleSheet, Text, View } from "react-native";

import { colors, em, fonts, radius } from "@/theme";

export default function ProgressFoot({
  value,
  unit,
  ratio,
  note,
  testID,
}: {
  /** "1,450 / 2,400" 처럼 숫자 부분 */
  value: string;
  /** "분" · "일" */
  unit: string;
  ratio: number;
  note: string;
  testID?: string;
}) {
  return (
    <View testID={testID} style={styles.box}>
      <Text style={styles.value}>
        {value}
        <Text style={styles.unit}>{unit}</Text>
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%` }]} />
      </View>
      <Text style={styles.note}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderCard,
  },
  value: {
    fontFamily: fonts.num,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: em(22, -0.03),
    fontVariant: ["tabular-nums"],
    color: colors.textMuted,
  },
  unit: {
    fontFamily: fonts.regular,
    fontSize: 15,
    letterSpacing: 0,
  },
  track: {
    height: 5,
    borderRadius: radius.pill,
    overflow: "hidden",
    backgroundColor: colors.scoreTrack,
  },
  fill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
});
