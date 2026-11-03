import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

import { colors, fonts } from "@/theme";

/** 자리 표시 — 탭 이동 · `?start=` 전달 확인용 */
export default function StagePlaceholder() {
  const { start } = useLocalSearchParams<{ start?: string }>();
  return (
    <View testID="stage-garden" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.bgPage }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 28, color: colors.textPrimary }}>garden</Text>
      <Text testID="stage-start-garden" style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textMuted }}>
        start={start ?? "-"}
      </Text>
    </View>
  );
}
