/**
 * AI 한마디 — 최신 분석의 추천 첫 줄.
 * 사용자 입력이 아니라 서버 AI 결과지만, 어떤 텍스트든 `<Text>`로만 그린다 (security.md).
 */
import { StyleSheet, Text, View } from "react-native";

import { SparkIcon } from "@/components/app/TabIcons";
import { colors, em, fonts } from "@/theme";

export default function AiTip({ text }: { text: string }) {
  return (
    <View testID="ai-tip" style={styles.box}>
      <View style={styles.icon}>
        <SparkIcon color={colors.brand} />
      </View>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 9,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentLine,
  },
  icon: {
    marginTop: 3,
  },
  text: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 19,
    letterSpacing: em(12, 0.01),
    color: colors.textPrimarySoft,
  },
});
