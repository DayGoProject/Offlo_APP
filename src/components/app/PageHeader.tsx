/**
 * 화면 헤더 — (뒤로 버튼) · 눈썹 · 큰 제목 · 오른쪽 둥근 버튼 · 제목 아래 액션 (UIUX 실험 A안).
 *
 * 제목은 28px 굵게(600) — 스킬의 위계(크기 · 굵기 2가지 · 투명도). 글자 크기는 앱 전체에서 28 / 17 / 15 / 13 / 11 안에서만 쓴다.
 * `trailing`(= 옛 `corner`)은 제목 줄 오른쪽에 놓이는 둥근 버튼들 (프로필 · 기록 · 알림).
 *
 * **뒤로 버튼은 스택 화면(목표 · 배지 · 설정 · 기록 …)에서 자동으로 붙는다** — 탭 화면(`(tabs)`)이 아니면 보인다.
 * 탭 화면의 View가 미리보기처럼 `(tabs)` 밖에서 그려질 때는 `back={false}`로 끈다.
 */
import type { ReactNode } from "react";
import { useRouter, useSegments } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { BackIcon } from "@/components/app/Icons";
import CircleButton from "@/components/app/CircleButton";
import { colors, em, fonts } from "@/theme";

export default function PageHeader({
  eyebrow,
  title,
  actions,
  corner,
  trailing,
  back,
}: {
  eyebrow?: string;
  title: string;
  /** 제목 아래 한 줄에 놓인다 */
  actions?: ReactNode;
  /** 제목 줄 오른쪽 — 둥근 버튼들 (`trailing`과 같다 · 옛 이름) */
  corner?: ReactNode;
  trailing?: ReactNode;
  /** 뒤로 버튼 — 안 주면 탭 화면이 아닐 때 자동으로 보인다 */
  back?: boolean;
}) {
  const router = useRouter();
  const segments = useSegments() as string[];
  const showBack = back ?? !segments.includes("(tabs)");
  const right = trailing ?? corner;

  return (
    <View style={styles.header}>
      {showBack ? (
        <View style={styles.backRow}>
          <CircleButton testID="header-back" label="뒤로" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
            <BackIcon color={colors.textPrimary} size={20} />
          </CircleButton>
        </View>
      ) : null}
      <View style={styles.row}>
        <View style={styles.titles}>
          {eyebrow ? (
            <Text numberOfLines={1} style={styles.eyebrowText}>
              {eyebrow}
            </Text>
          ) : null}
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 12,
  },
  backRow: {
    flexDirection: "row",
    marginLeft: -2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  titles: {
    flex: 1,
    gap: 4,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  eyebrowText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: em(28, -0.025),
    color: colors.textPrimary,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
});
