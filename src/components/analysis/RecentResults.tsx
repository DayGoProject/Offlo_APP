/**
 * 최근 분석 결과 — 이번 주 일간 분석 최신 3건 + 촬영 팁. 줄을 누르면 결과 화면으로 간다.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import Card, { CardHeader } from "@/components/app/Card";
import { SparkIcon } from "@/components/app/TabIcons";
import { relativeDay } from "@/logic/analysis";
import type { AnalysisSummary } from "@/services/api-types";
import { fmtHM } from "@/shared/format";
import { colors, em, fonts } from "@/theme";

export default function RecentResults({
  records,
  now,
  onOpenResult,
}: {
  /** 최신 → 오래된 */
  records: AnalysisSummary[];
  now: number;
  onOpenResult: (id: string) => void;
}) {
  return (
    <Card testID="recent-results">
      <CardHeader title="최근 분석 결과" />
      {records.length === 0 ? (
        <Text style={styles.empty}>이번 주 기록이 아직 없어요. 첫 분석을 올리면 여기에 쌓입니다.</Text>
      ) : (
        <View style={styles.list}>
          {records.map((r) => (
            <Pressable
              key={r.id}
              testID="recent-row"
              accessibilityRole="button"
              onPress={() => onOpenResult(r.id)}
              style={({ pressed }) => [styles.row, { opacity: pressed ? 0.75 : 1 }]}
            >
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{relativeDay(r.createdAt, now)} · 일간</Text>
                <Text style={styles.rowTime}>{fmtHM(r.totalMinutes)}</Text>
              </View>
              <Text style={styles.rowScore}>{r.detoxScore}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.tip}>
        <View style={styles.tipIcon}>
          <SparkIcon color={colors.brand} size={13} />
        </View>
        <Text style={styles.tipText}>
          더 정확한 분석을 위한 팁 — 하루가 끝난 저녁에, &apos;일&apos; 탭 화면 전체가 보이도록 캡처하면 앱별 시간을 더 잘 읽습니다.
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  empty: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 21,
    color: colors.textMuted,
  },
  list: {
    gap: 10,
  },
  row: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 9,
    backgroundColor: colors.bgNav,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  rowTitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 16,
    color: colors.textPrimary,
  },
  rowTime: {
    fontFamily: fonts.num,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  rowScore: {
    fontFamily: fonts.num,
    fontSize: 20,
    lineHeight: 24,
    fontVariant: ["tabular-nums"],
    color: colors.textPrimary,
  },
  tip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.accentLine,
    backgroundColor: colors.accentSoft,
  },
  tipIcon: {
    marginTop: 3,
  },
  tipText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 19,
    letterSpacing: em(12, 0.01),
    color: colors.textPrimarySoft,
  },
});
