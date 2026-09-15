/**
 * 분석 기록 화면의 그림 — 데이터는 props로만 받는다 (mobile.md "웹 미리보기 — 미리보기 화면").
 *
 * 기록은 최대 100건이라 `FlatList`로 그린다 (ScrollView에 목록을 통째로 넣지 않는다 — mobile.md).
 * 헤더 · 추이 카드는 목록 머리, 기록 한 줄이 한 항목이다. 이 파일은 `api` · `useAuth` · Firebase를 import하지 않는다.
 */
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Card, { CardHeader } from "@/components/app/Card";
import ErrorNotice from "@/components/app/ErrorNotice";
import PageHeader from "@/components/app/PageHeader";
import Pill from "@/components/app/Pill";
import Segmented from "@/components/app/Segmented";
import Skeleton from "@/components/app/Skeleton";
import TrendLine from "@/components/history/TrendLine";
import { filterAnalyses, scoreTrend, topApps, type HistoryFilter } from "@/logic/history";
import type { AnalysisSummary } from "@/services/api-types";
import { fmtDate, fmtDateShort, fmtHM } from "@/shared/format";
import { colors, em, fonts, radius } from "@/theme";

export interface HistoryViewProps {
  analyses: AnalysisSummary[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  filter: HistoryFilter;
  onFilterChange: (filter: HistoryFilter) => void;
  onOpenAnalysis: () => void;
}

const FILTERS: { value: HistoryFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "daily", label: "일간" },
  { value: "weekly", label: "주간" },
];

export default function HistoryView({
  analyses,
  loading,
  error,
  onRetry,
  filter,
  onFilterChange,
  onOpenAnalysis,
}: HistoryViewProps) {
  const insets = useSafeAreaInsets();
  const ready = analyses !== null;
  const filtered = ready ? filterAnalyses(analyses, filter) : [];
  const trend = scoreTrend(filtered);

  const header = (
    <View style={styles.headerBlock}>
      <PageHeader
        eyebrow={ready ? `총 ${analyses.length}개의 기록` : "불러오는 중"}
        title="분석 기록"
        actions={
          <>
            <Segmented value={filter} onChange={onFilterChange} options={FILTERS} />
            <Pill label="오늘 분석하기" variant="primary" onPress={onOpenAnalysis} />
          </>
        }
      />

      {error ? <ErrorNotice testID="history-error" message={error} onRetry={onRetry} /> : null}

      {ready || loading ? (
        <Card testID="trend-card">
          <View style={styles.trendHeader}>
            <CardHeader title="디톡스 점수 추이" />
            {trend.latest !== null ? (
              <View style={styles.trendValue}>
                <Text style={styles.latest}>{trend.latest}</Text>
                {trend.delta !== null ? (
                  <Text style={[styles.delta, { color: trend.delta >= 0 ? colors.brand : colors.danger }]}>
                    최근 {trend.recentCount}일 {trend.delta >= 0 ? "+" : ""}
                    {trend.delta}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>

          {!ready ? (
            <Skeleton testID="trend-skeleton" height={190} />
          ) : trend.points.length < 2 ? (
            <Text style={styles.trendEmpty}>기록이 2건 이상 쌓이면 추이가 그려져요</Text>
          ) : (
            <TrendLine data={trend.points.map((p) => ({ label: fmtDateShort(p.createdAt), score: p.score }))} />
          )}
        </Card>
      ) : null}
    </View>
  );

  const listEmpty = !ready ? (
    loading ? (
      <View style={styles.listCard}>
        {Array.from({ length: 5 }, (_, i) => (
          <View key={i} style={[styles.row, i < 4 && styles.rowDivider]}>
            <Skeleton testID="row-skeleton" height={20} radius={4} />
          </View>
        ))}
      </View>
    ) : null
  ) : (
    <View testID="history-empty" style={[styles.listCard, styles.empty]}>
      <Text style={styles.emptyText}>
        {filter === "all" ? "아직 기록이 없어요" : `${filter === "daily" ? "일간" : "주간"} 기록이 없어요`}
      </Text>
      <Pill label="분석 시작하기" variant="accent" onPress={onOpenAnalysis} />
    </View>
  );

  return (
    <FlatList
      testID="history"
      style={styles.list}
      contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32, paddingHorizontal: 16 }}
      data={filtered}
      keyExtractor={(a) => a.id}
      ListHeaderComponent={header}
      ListEmptyComponent={listEmpty}
      refreshControl={
        <RefreshControl
          refreshing={loading && ready}
          onRefresh={onRetry}
          tintColor={colors.brand}
          colors={[colors.brand]}
          progressBackgroundColor={colors.bgCard}
        />
      }
      renderItem={({ item, index }) => {
        // 가장 최근 기록 한 줄만 강조한다 (전체 보기에서)
        const highlight = index === 0 && filter === "all";
        const first = index === 0;
        const last = index === filtered.length - 1;
        return (
          <View
            testID="history-row"
            style={[
              styles.rowCard,
              first && styles.rowCardFirst,
              last && styles.rowCardLast,
              !last && styles.rowDivider,
              highlight && { backgroundColor: colors.accentSoft },
            ]}
          >
            <View style={styles.rowMain}>
              <View style={styles.rowTop}>
                <Text style={styles.date}>{fmtDate(item.createdAt)}</Text>
                <Text style={[styles.type, { color: highlight ? colors.brand : colors.textMuted }]}>
                  {item.periodType === "weekly" ? "주간" : "일간"}
                  {item.isPremium ? <Text style={styles.pro}> PRO</Text> : null}
                </Text>
              </View>
              <Text numberOfLines={1} style={styles.rowSub}>
                <Text style={styles.time}>{fmtHM(item.totalMinutes)}</Text>
                {"  ·  "}
                {topApps(item)}
              </Text>
            </View>
            <Text style={[styles.score, { color: highlight ? colors.brand : colors.textPrimary }]}>{item.detoxScore}</Text>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.bgPage,
  },
  headerBlock: {
    gap: 20,
    marginBottom: 20,
  },
  trendHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  trendValue: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  latest: {
    fontFamily: fonts.num,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: em(22, -0.03),
    color: colors.textPrimary,
  },
  delta: {
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  trendEmpty: {
    paddingVertical: 56,
    textAlign: "center",
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  listCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderCard,
    borderRadius: radius.card,
    overflow: "hidden",
  },
  row: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.bgCard,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.borderCard,
  },
  rowCardFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
  },
  rowCardLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: radius.card,
    borderBottomRightRadius: radius.card,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderCard,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  date: {
    fontFamily: fonts.num,
    fontSize: 13,
    lineHeight: 16,
    fontVariant: ["tabular-nums"],
    color: colors.textPrimary,
  },
  type: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  pro: {
    fontFamily: fonts.num,
    fontSize: 10,
  },
  rowSub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 16,
    color: colors.textMuted,
  },
  time: {
    fontFamily: fonts.num,
    color: colors.textPrimary,
  },
  score: {
    fontFamily: fonts.num,
    fontSize: 18,
    lineHeight: 22,
    fontVariant: ["tabular-nums"],
  },
  empty: {
    alignItems: "center",
    gap: 16,
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textPrimary,
  },
});
