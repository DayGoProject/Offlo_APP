/**
 * 진행 중인 목표 — 최대 3개. 제목 · 기간 진행 바 · "지난 일 / 전체 일".
 */
import { StyleSheet, Text, View } from "react-native";

import { goalProgress } from "@/logic/dashboard";
import type { Goal } from "@/services/api-types";
import { colors, fonts, radius } from "@/theme";

export default function GoalProgressList({ goals, now }: { goals: Goal[]; now: Date }) {
  if (goals.length === 0) {
    return (
      <Text testID="goals-empty" style={styles.empty}>
        아직 목표가 없어요. 하루 사용 시간 상한을 하나만 정해도 달라집니다.
      </Text>
    );
  }

  return (
    <View testID="goals-list" style={styles.list}>
      {goals.slice(0, 3).map((goal) => {
        const { done, total } = goalProgress(goal, now);
        return (
          <View key={goal.id} style={styles.row}>
            <Text numberOfLines={1} style={styles.title}>
              {goal.title}
            </Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round((done / total) * 100)}%` }]} />
            </View>
            <Text style={styles.count}>
              <Text style={styles.countNum}>
                {done} / {total}
              </Text>
              일
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: {
    width: 110,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 16,
    color: colors.textPrimary,
  },
  track: {
    flex: 1,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.scoreTrack,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  count: {
    width: 64,
    textAlign: "right",
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  countNum: {
    fontFamily: fonts.num,
    fontVariant: ["tabular-nums"],
  },
  empty: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
  },
});
