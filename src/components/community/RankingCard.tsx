/**
 * 주간 랭킹 — 웹 `components/community/RankingWidget.tsx` 이식. 기준: 최근 7일 일간 분석의 디톡스 점수 평균 (분석 횟수 미달은 서버가 제외한다).
 *
 * 메달 이모지를 쓰지 않는다 — 다크 팔레트에서 컬러 이모지 세 개가 유일한 색 덩어리가 되어 정작 강조할 내 순위를 이긴다.
 * 1~3위는 숫자 굵기와 색으로만 구분하고, 나는 브랜드 그린 바탕 한 줄이다.
 */
import { StyleSheet, Text, View } from "react-native";

import Card from "@/components/app/Card";
import ErrorNotice from "@/components/app/ErrorNotice";
import Skeleton from "@/components/app/Skeleton";
import { rankingEmptyText, rankingView } from "@/logic/community";
import type { RankingEntry } from "@/services/api-types";
import { colors, fonts, radius } from "@/theme";

export interface RankingData {
  ranking: RankingEntry[];
  myRank: RankingEntry | null;
  minAnalyses: number;
}

export default function RankingCard({
  data,
  error,
  onRetry,
}: {
  /** 아직 못 불러왔으면 null */
  data: RankingData | null;
  error: string | null;
  onRetry: () => void;
}) {
  const view = data ? rankingView(data) : null;

  return (
    <Card testID="ranking">
      <View style={styles.head}>
        <Text style={styles.title}>주간 디톡스 랭킹</Text>
        <Text style={styles.sub}>최근 7일</Text>
      </View>

      {error ? (
        <ErrorNotice testID="ranking-error" message={error} onRetry={onRetry} />
      ) : !data || !view ? (
        <View testID="ranking-skeleton" style={styles.skeleton}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={42} radius={8} />
          ))}
        </View>
      ) : data.ranking.length === 0 ? (
        <Text testID="ranking-empty" style={styles.empty}>
          {rankingEmptyText(data.minAnalyses)}
        </Text>
      ) : (
        <View testID="ranking-rows">
          {view.rows.map((entry) => (
            <Row key={entry.rank} entry={entry} />
          ))}
          {view.mine ? (
            <>
              <Text style={styles.dots}>⋯</Text>
              <Row entry={view.mine} />
            </>
          ) : null}
        </View>
      )}

      <View style={styles.foot}>
        <Text style={styles.footText}>
          최근 7일 일간 분석의 디톡스 점수 평균입니다. 분석 {data?.minAnalyses ?? 3}회 미만은 순위에서 제외됩니다.
        </Text>
      </View>
    </Card>
  );
}

function Row({ entry }: { entry: RankingEntry }) {
  const top3 = entry.rank <= 3;
  const accent = entry.isMe || entry.rank === 1;
  const strong = entry.isMe ? colors.brand : top3 ? colors.textPrimary : colors.textMuted;

  return (
    <View
      testID={`rank-${entry.rank}`}
      accessible
      accessibilityLabel={`${entry.rank}위 ${entry.name}${entry.isMe ? " (나)" : ""}, 평균 ${entry.avgScore}점, 분석 ${entry.analysisCount}회`}
      style={[styles.row, entry.isMe && styles.rowMe]}
    >
      <Text style={[styles.rank, { color: accent ? colors.brand : colors.textMuted, fontFamily: top3 || entry.isMe ? fonts.semibold : fonts.num }]}>{entry.rank}</Text>
      <Text numberOfLines={1} style={[styles.name, { color: strong, fontFamily: entry.isMe ? fonts.semibold : fonts.regular }]}>
        {entry.name}
        {entry.isMe ? " (나)" : ""}
      </Text>
      <Text style={[styles.score, { color: strong, fontFamily: entry.isMe ? fonts.semibold : fonts.num }]}>{entry.avgScore}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
  },
  skeleton: {
    gap: 4,
  },
  empty: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 19,
    color: colors.textMuted,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 42,
    borderRadius: radius.card - 4,
  },
  rowMe: {
    paddingHorizontal: 10,
    backgroundColor: colors.accentSoft,
  },
  rank: {
    width: 22,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  name: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
  },
  score: {
    width: 40,
    textAlign: "right",
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
  dots: {
    textAlign: "center",
    fontFamily: fonts.regular,
    fontSize: 12,
    paddingVertical: 4,
    color: colors.textGhost,
  },
  foot: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderCard,
  },
  footText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 18,
    color: colors.textMuted,
  },
});
