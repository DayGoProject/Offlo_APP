/**
 * 불러오기 실패 안내 — 한국어 메시지 + "다시 시도".
 * 메시지는 `ApiError.message`를 그대로 받는다 (services/api-client.ts의 API_MESSAGES).
 */
import { StyleSheet, Text, View } from "react-native";

import Pill from "@/components/app/Pill";
import { colors, fonts, radius } from "@/theme";

export default function ErrorNotice({
  message,
  onRetry,
  testID = "error-notice",
}: {
  message: string;
  onRetry?: () => void;
  testID?: string;
}) {
  return (
    <View testID={testID} accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.box}>
      <Text style={styles.text}>{message}</Text>
      {onRetry ? (
        <View style={styles.action}>
          <Pill testID="retry-button" label="다시 시도" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: 14,
    borderWidth: 1,
    borderColor: colors.dangerLine,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  text: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
  },
  action: {
    flexDirection: "row",
  },
});
