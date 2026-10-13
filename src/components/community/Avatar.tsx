/**
 * 작성자 아바타 — 이름의 첫 글자를 얹은 원 (웹 PostCard의 `Avatar`). 프로필 사진은 쓰지 않는다 (서버에 없다).
 */
import { StyleSheet, Text, View } from "react-native";

import { initialOf } from "@/logic/community";
import { colors, fonts } from "@/theme";

export default function Avatar({ name, size = 32, tone = "muted" }: { name: string; size?: number; tone?: "muted" | "brand" }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: tone === "brand" ? colors.accentSoft : colors.scoreTrack },
      ]}
    >
      <Text
        style={[
          styles.text,
          // 한글 · 영문 모두 이 폰트로 — 숫자 전용 폰트에는 한글 글리프가 없다
          { fontSize: size >= 32 ? 12 : 11, color: tone === "brand" ? colors.brand : colors.textMuted },
        ]}
      >
        {initialOf(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontFamily: fonts.semibold,
  },
});
