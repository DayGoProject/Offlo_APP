/**
 * 지표 카드 — 라벨 / 큰 숫자 / 각주(또는 진행 바). 웹 `components/app/Stat.tsx` 이식.
 *
 * 숫자는 Familjen Grotesk, 단위("분", "일째")는 Pretendard다. 한글 글리프가 없는 라틴 폰트로
 * 한글을 그리는 사고를 막으려고 단위를 반드시 따로 받는다.
 */
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, em, fonts, radius } from "@/theme";

export default function Stat({
  label,
  value,
  unit,
  note,
  noteTone = "muted",
  progress,
  testID,
}: {
  label: string;
  /** 숫자·영문만 — 한글을 넣지 않는다 */
  value: string;
  unit?: string;
  note?: string;
  noteTone?: "muted" | "brand";
  /** 0~1. 주면 각주 대신 진행 바를 그린다 */
  progress?: number;
  testID?: string;
}) {
  return (
    <View testID={testID} style={styles.card}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.valueRow}>
        <Text testID={testID ? `${testID}-value` : undefined} numberOfLines={1} adjustsFontSizeToFit style={styles.value}>
          {value}
        </Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>

      {progress !== undefined ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.max(0, Math.min(1, progress)) * 100}%` }]} />
        </View>
      ) : note ? (
        // 2열에서는 각주가 잘리기 쉽다 — 두 줄까지 흘린다 (숫자가 잘리면 각주의 쓸모가 사라진다)
        <Text numberOfLines={2} style={[styles.note, { color: noteTone === "brand" ? colors.brand : colors.textMuted }]}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

/** 지표 카드 2열 */
export function StatGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    flexGrow: 1,
    flexBasis: "40%",
    minWidth: 0,
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderCard,
    borderRadius: radius.card,
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: em(12, 0.01),
    color: colors.textMuted,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  value: {
    flexShrink: 1,
    fontFamily: fonts.num,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: em(36, -0.045),
    fontVariant: ["tabular-nums"],
    color: colors.textPrimary,
  },
  unit: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 18,
    color: colors.textMuted,
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
  },
});
