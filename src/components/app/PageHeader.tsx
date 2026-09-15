/**
 * 화면 헤더 — 눈썹(점 + 라벨) · 제목 · 액션. 웹 `components/app/PageHeader.tsx` 이식.
 *
 * 제목은 **굵게 하지 않는다**(weight 400) — 거대하되 가볍게가 웹의 타이포 규칙이다.
 * 위계는 굵기가 아니라 크기와 색으로 만든다. 모바일 크기 26px.
 */
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, em, fonts } from "@/theme";

export default function PageHeader({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: string;
  title: string;
  /** 제목 아래 한 줄에 놓인다 (모바일은 옆에 둘 폭이 없다) */
  actions?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      {eyebrow ? (
        <View style={styles.eyebrow}>
          <View style={styles.dot} />
          <Text style={styles.eyebrowText}>{eyebrow}</Text>
        </View>
      ) : null}
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 7,
  },
  eyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.brand,
  },
  eyebrowText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: em(11, 0.14),
    color: colors.textMuted,
  },
  title: {
    fontFamily: fonts.regular,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: em(26, -0.035),
    color: colors.textPrimary,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    marginTop: 9,
  },
});
