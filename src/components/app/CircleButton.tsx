/**
 * 둥근 아이콘 버튼 — 헤더의 뒤로 · 프로필 · 기록 같은 보조 행동 (UIUX 실험 A안). 터치 영역 44pt.
 * `glass`면 장면(동물 방) 위에 얹는 반투명 바탕, 아니면 면 위의 옅은 바탕.
 */
import type { ReactNode } from "react";
import { Pressable, StyleSheet } from "react-native";

import { colors } from "@/theme";

export default function CircleButton({
  children,
  label,
  onPress,
  testID,
  glass = false,
}: {
  children: ReactNode;
  /** 스크린리더 · 자동화가 읽는 이름 */
  label: string;
  onPress: () => void;
  testID?: string;
  glass?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: glass ? colors.glass : colors.bgBar, opacity: pressed ? 0.7 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderCard,
  },
});
