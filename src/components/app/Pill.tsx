/**
 * 알약 버튼 — 웹 PageHeader의 `<Pill>` 이식. 앱의 버튼은 이것 하나로 통일한다.
 *
 * - primary: 흰 알약 — **한 화면에 하나만.** 두 개가 되는 순간 둘 다 주목받지 못한다
 * - accent: 브랜드 그린
 * - ghost: 세선
 *
 * 높이는 Paper 기준 38px이고, 터치 영역은 hitSlop으로 44pt를 채운다 (mobile.md).
 */
import { Pressable, StyleSheet, Text } from "react-native";

import { colors, fonts, radius, WHITE } from "@/theme";

type Variant = "primary" | "accent" | "ghost";

export default function Pill({
  label,
  onPress,
  variant = "ghost",
  disabled = false,
  testID,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={{ top: 3, bottom: 3 }}
      style={({ pressed }) => [
        styles.base,
        skins[variant].box,
        { opacity: disabled ? 0.5 : pressed ? (variant === "ghost" ? 0.75 : 0.9) : 1 },
      ]}
    >
      <Text style={[styles.label, skins[variant].label]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 38,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  label: {
    fontSize: 13,
  },
});

const skins = {
  primary: StyleSheet.create({
    box: { paddingHorizontal: 20, backgroundColor: WHITE },
    label: { fontFamily: fonts.semibold, color: colors.bgPage },
  }),
  accent: StyleSheet.create({
    box: { paddingHorizontal: 20, backgroundColor: colors.brand },
    label: { fontFamily: fonts.semibold, color: colors.bgPage },
  }),
  ghost: StyleSheet.create({
    box: { paddingHorizontal: 18, borderWidth: 1, borderColor: colors.borderStrong },
    label: { fontFamily: fonts.regular, color: colors.textPrimary },
  }),
} satisfies Record<Variant, { box: object; label: object }>;
