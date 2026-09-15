/**
 * 카드 — `--bg-card` + 1px `--border-card` + 라운드 12px. 그림자는 쓰지 않는다 (다크에서 보이지 않는다).
 * `CardHeader`는 카드 안의 제목 줄 (제목 · 우측 보조 텍스트).
 */
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, em, fonts, radius } from "@/theme";

export default function Card({
  children,
  style,
  testID,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
    </View>
  );
}

export function CardHeader({
  title,
  right,
  rightTone = "muted",
  onPressRight,
}: {
  title: string;
  right?: string;
  rightTone?: "muted" | "brand";
  onPressRight?: () => void;
}) {
  const rightText = right ? (
    <Text style={[styles.right, { color: rightTone === "brand" ? colors.brand : colors.textMuted }]}>{right}</Text>
  ) : null;

  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {onPressRight && rightText ? (
        <Pressable
          accessibilityRole="link"
          onPress={onPressRight}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          {rightText}
        </Pressable>
      ) : (
        rightText
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderCard,
    borderRadius: radius.card,
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: em(15, -0.01),
    color: colors.textPrimary,
  },
  right: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
  },
});
