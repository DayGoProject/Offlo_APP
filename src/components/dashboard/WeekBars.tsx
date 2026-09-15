/**
 * 이번 주 스크린타임 막대 7개 — 웹 대시보드 `WeekBars` 이식.
 * 축도 툴팁도 없는 단색 막대라 차트 라이브러리 없이 View로 그린다. 오늘 한 칸만 브랜드 그린.
 */
import { StyleSheet, Text, View } from "react-native";

import type { WeekBar } from "@/logic/dashboard";
import { fmt } from "@/shared/format";
import { colors, fonts } from "@/theme";

const MAX_BAR = 178;
const EMPTY_BAR = 70;

export default function WeekBars({ data }: { data: WeekBar[] }) {
  const max = Math.max(...data.map((d) => d.minutes), 120);

  return (
    <View testID="week-bars" style={styles.row}>
      {data.map((d, i) => {
        const height = d.minutes === 0 ? EMPTY_BAR : Math.max(16, Math.round((d.minutes / max) * MAX_BAR));
        return (
          <View
            key={i}
            testID={d.isToday ? "week-bar-today" : undefined}
            accessible
            accessibilityLabel={`${d.day}요일 ${d.minutes > 0 ? fmt(d.minutes) : "기록 없음"}`}
            style={[styles.column, { opacity: d.isFuture ? 0.5 : 1 }]}
          >
            <View style={[styles.bar, { height, backgroundColor: d.isToday ? colors.brandBar : colors.scoreTrack }]} />
            <Text style={[styles.day, { color: d.isToday ? colors.textPrimary : colors.textMuted }]}>{d.day}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 200,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 4,
    paddingHorizontal: 4,
  },
  column: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 10,
  },
  bar: {
    width: "100%",
    maxWidth: 34,
    borderRadius: 6,
  },
  day: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 14,
  },
});
