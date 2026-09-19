/**
 * 분석 결과 화면의 그림 — 웹 `app/analysis/result/[id]/page.tsx` 이식. 데이터는 props로만 받는다.
 * 이 파일은 `api` · `useAuth` · Firebase를 import하지 않는다 (불러오기는 app/(app)/result/[id].tsx).
 *
 * 순서는 웹과 같다: 요약(점수 링 · 총 시간 · 카테고리) → 앱별 시간 → 시간대 패턴 → 핵심 문제 · 원인
 * → 디톡스 전략 → 하루 루틴 → 추천 → AI 코치.
 * 모바일은 한 줄로 쌓는다 (웹의 2 · 3열은 좁은 폭에서 글이 계단처럼 접힌다).
 * AI가 만든 글도 전부 `<Text>`로만 그린다 (security.md).
 *
 * 웹과 다른 점: 코치 채팅은 결과 아래에 붙이지 않고 **별도 화면**으로 연다 — 긴 결과 스크롤 안에 입력창을 두면
 * 키보드가 올라올 때 대화가 가려진다. 여기에는 첫 질문과 "코치와 대화하기"만 둔다.
 * 프리미엄 안내에는 버튼을 두지 않는다 (결제 문구 금지 — design.md).
 */
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import Card, { CardHeader } from "@/components/app/Card";
import ErrorNotice from "@/components/app/ErrorNotice";
import { SmallCheckIcon, WarnIcon, WhyIcon } from "@/components/app/Icons";
import PageHeader from "@/components/app/PageHeader";
import Pill from "@/components/app/Pill";
import Screen from "@/components/app/Screen";
import Skeleton from "@/components/app/Skeleton";
import { SparkIcon } from "@/components/app/TabIcons";
import ScoreRing from "@/components/result/ScoreRing";
import { scoreLabel, textList } from "@/logic/analysis";
import { openingMessage } from "@/logic/chat";
import type { Analysis, AppUsage, TimePattern } from "@/services/api-types";
import { fmt, fmtDate, fmtHM } from "@/shared/format";
import { BRAND, colors, em, fonts, radius } from "@/theme";

export interface ResultViewProps {
  analysis: Analysis | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenChat: () => void;
  onOpenHistory: () => void;
}

export default function ResultView({ analysis, loading, error, onRetry, onOpenChat, onOpenHistory }: ResultViewProps) {
  const weekly = analysis?.periodType === "weekly";

  return (
    <Screen testID="result">
      <PageHeader
        eyebrow={analysis ? `${weekly ? "주간" : "일간"} 분석 · ${fmtDate(analysis.createdAt)}` : "분석 결과"}
        title="분석 결과"
        actions={<Pill testID="result-history" label="기록 보기" onPress={onOpenHistory} />}
      />

      {error ? <ErrorNotice testID="result-error" message={error} onRetry={onRetry} /> : null}

      {analysis ? (
        <ResultBody analysis={analysis} onOpenChat={onOpenChat} />
      ) : loading ? (
        <View testID="result-skeleton" style={styles.skeletons}>
          <Skeleton height={300} radius={12} />
          <Skeleton height={220} radius={12} />
          <Skeleton height={160} radius={12} />
        </View>
      ) : null}
    </Screen>
  );
}

function ResultBody({ analysis, onOpenChat }: { analysis: Analysis; onOpenChat: () => void }) {
  const weekly = analysis.periodType === "weekly";
  const apps: AppUsage[] = Array.isArray(analysis.apps) ? analysis.apps : [];
  const categories = Array.isArray(analysis.topCategories) ? analysis.topCategories : [];
  const patterns: TimePattern[] = Array.isArray(analysis.timePatterns) ? analysis.timePatterns : [];
  const problems = textList(analysis.coreProblems);
  const causes = textList(analysis.psychologicalCauses);
  const strategies = textList(analysis.detoxStrategies);
  const recommendations = textList(analysis.recommendations);
  const routine = analysis.dailyRoutine;
  const maxMinutes = Math.max(1, ...apps.map((a) => a.minutes));

  return (
    <>
      {/* ① 요약 */}
      <Card testID="result-summary" style={styles.summary}>
        <ScoreRing score={analysis.detoxScore} />
        <View style={styles.summaryText}>
          <View style={styles.totalRow}>
            <Text testID="result-total" style={styles.total}>
              {fmtHM(analysis.totalMinutes)}
            </Text>
            <Text style={styles.scoreLabel}>{scoreLabel(analysis.detoxScore)}</Text>
          </View>
          <Text style={styles.summaryDesc}>
            {weekly ? "이번 주" : "오늘 하루"} 총 스크린타임입니다. 아래 항목은 이 기록을 바탕으로 AI가 정리한 내용이에요.
          </Text>
          {categories.length > 0 ? (
            <View style={styles.chips}>
              {categories.map((c) => (
                <View key={c.category} testID="category-chip" style={styles.chip}>
                  <Text style={styles.chipText}>
                    {c.category} {fmt(c.minutes)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </Card>

      {/* ② 앱별 사용 시간 */}
      {apps.length > 0 ? (
        <Section title="앱별 사용 시간" testID="result-apps">
          <View style={styles.apps}>
            {apps.map((app, i) => (
              <View key={`${app.appName}-${i}`} testID="app-row" style={styles.appRow}>
                <Text numberOfLines={1} style={styles.appName}>
                  {app.appName}
                </Text>
                <View style={styles.track}>
                  <View
                    style={[
                      styles.fill,
                      // 위에서 아래로 갈수록 옅어진다 — 순위가 색으로도 읽힌다 (웹과 같다)
                      { width: `${(app.minutes / maxMinutes) * 100}%`, opacity: Math.max(0.28, 1 - i * 0.18) },
                    ]}
                  />
                </View>
                <Text style={styles.appTime}>{fmtHM(app.minutes)}</Text>
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      {/* ③ 시간대별 사용 패턴 */}
      {patterns.length > 0 ? (
        <Section title="시간대별 사용 패턴" testID="result-patterns">
          <View style={styles.stack}>
            {patterns.map((p, i) => (
              <View key={i} style={styles.pattern}>
                <Text style={styles.slot}>{p.timeSlot}</Text>
                {Array.isArray(p.apps) && p.apps.length > 0 ? <Text style={styles.body}>{p.apps.join(" · ")}</Text> : null}
                {p.question ? <Text style={styles.muted}>{p.question}</Text> : null}
              </View>
            ))}
          </View>
        </Section>
      ) : !analysis.isPremium ? (
        <View testID="premium-note" style={styles.premium}>
          <Text style={styles.premiumTitle}>시간대별 사용 패턴</Text>
          <Text style={styles.muted}>프리미엄 계정의 분석에서 볼 수 있어요.</Text>
        </View>
      ) : null}

      {/* ④ 핵심 문제 · ⑤ 원인 */}
      {problems.length > 0 ? (
        <Section title="내 사용 패턴의 핵심 문제" icon={<WarnIcon color={BRAND} />} testID="result-problems">
          <NumberedList items={problems} />
        </Section>
      ) : null}
      {causes.length > 0 ? (
        <Section title="왜 이런 패턴이 생겼을까요?" icon={<WhyIcon color={BRAND} />} testID="result-causes">
          <NumberedList items={causes} />
        </Section>
      ) : null}

      {/* ⑥ 디톡스 전략 */}
      {strategies.length > 0 ? (
        <Section title="가장 효과적인 디톡스 전략" testID="result-strategies">
          <View style={styles.stack}>
            {strategies.map((s, i) => (
              <View key={i} style={styles.strategy}>
                <Text style={styles.slot}>STRATEGY {String(i + 1).padStart(2, "0")}</Text>
                <Text style={styles.body}>{s}</Text>
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      {/* ⑦ 하루 실천 루틴 */}
      {routine && typeof routine === "object" ? (
        <Section title="하루 실천 루틴" testID="result-routine">
          <View style={styles.routine}>
            {(
              [
                ["아침", routine.morning],
                ["낮", routine.afternoon],
                ["밤", routine.evening],
              ] as const
            )
              .filter(([, text]) => typeof text === "string" && text.trim())
              .map(([label, text], i) => (
                <View key={label} style={[styles.routineItem, i > 0 && styles.routineDivider]}>
                  <Text style={styles.routineLabel}>{label}</Text>
                  <Text style={styles.body}>{text}</Text>
                </View>
              ))}
          </View>
        </Section>
      ) : null}

      {/* ⑧ 맞춤 디톡스 추천 */}
      {recommendations.length > 0 ? (
        <Section title="맞춤 디톡스 추천" testID="result-recommendations">
          <View style={styles.stack}>
            {recommendations.map((r, i) => (
              <View key={i} style={styles.recommendation}>
                <View style={styles.checkIcon}>
                  <SmallCheckIcon color={BRAND} />
                </View>
                <Text style={[styles.body, styles.flex]}>{r}</Text>
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      {/* ⑨ AI 코치 */}
      <Card testID="coach-card">
        <View style={styles.coachHeader}>
          <View style={styles.coachBadge}>
            <SparkIcon color={BRAND} size={13} />
          </View>
          <Text style={styles.sectionTitle}>AI 코치에게 물어보기</Text>
        </View>
        <View style={styles.bubble}>
          <Text testID="coach-opening" style={styles.body}>
            {openingMessage(analysis.timePatterns)}
          </Text>
        </View>
        <View style={styles.coachAction}>
          <Pill testID="open-chat" label="코치와 대화하기" variant="accent" onPress={onOpenChat} />
        </View>
      </Card>
    </>
  );
}

function Section({
  title,
  icon,
  testID,
  children,
}: {
  title: string;
  icon?: ReactNode;
  testID?: string;
  children: ReactNode;
}) {
  return (
    <Card testID={testID}>
      {icon ? (
        <View style={styles.iconTitle}>
          {icon}
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
      ) : (
        <CardHeader title={title} />
      )}
      {children}
    </Card>
  );
}

/** 01 · 02 · 03 번호가 붙은 문단 */
function NumberedList({ items }: { items: string[] }) {
  return (
    <View style={styles.stack}>
      {items.map((text, i) => (
        <View key={i} style={styles.numbered}>
          <Text style={styles.number}>{String(i + 1).padStart(2, "0")}</Text>
          <Text style={[styles.body, styles.flex]}>{text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeletons: {
    gap: 20,
  },
  flex: {
    flex: 1,
  },
  summary: {
    alignItems: "center",
    gap: 24,
  },
  summaryText: {
    alignSelf: "stretch",
    gap: 12,
  },
  totalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: 12,
  },
  total: {
    fontFamily: fonts.num,
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: em(46, -0.05),
    color: colors.textPrimary,
  },
  scoreLabel: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 18,
    color: colors.brand,
  },
  summaryDesc: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: em(14, -0.01),
    color: colors.textMuted,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  chip: {
    height: 26,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accentLine,
    backgroundColor: colors.accentSoft,
  },
  chipText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.brand,
  },
  apps: {
    gap: 14,
  },
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  appName: {
    width: 92,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 16,
    color: colors.textPrimary,
  },
  track: {
    flex: 1,
    minWidth: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.scoreTrack,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: colors.brand,
  },
  appTime: {
    width: 56,
    textAlign: "right",
    fontFamily: fonts.num,
    fontSize: 12,
    lineHeight: 16,
    fontVariant: ["tabular-nums"],
    color: colors.textMuted,
  },
  stack: {
    gap: 12,
  },
  pattern: {
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgSubtle,
  },
  slot: {
    fontFamily: fonts.num,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: em(11, 0.08),
    color: colors.brand,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 22,
    color: colors.textPrimarySoft,
  },
  muted: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 21,
    color: colors.textMuted,
  },
  premium: {
    gap: 4,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.accentLine,
    backgroundColor: colors.bgSubtle,
  },
  premiumTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  iconTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionTitle: {
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: em(15, -0.01),
    color: colors.textPrimary,
  },
  numbered: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  number: {
    width: 16,
    fontFamily: fonts.num,
    fontSize: 12,
    lineHeight: 22,
    color: colors.brand,
  },
  strategy: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.accentLine,
    backgroundColor: colors.accentSoft,
  },
  routine: {
    gap: 0,
  },
  routineItem: {
    gap: 8,
    paddingVertical: 14,
  },
  routineDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderCard,
  },
  routineLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: em(12, 0.06),
    color: colors.brand,
  },
  recommendation: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  checkIcon: {
    marginTop: 4,
  },
  coachHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  coachBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
  },
  bubble: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgNav,
  },
  coachAction: {
    flexDirection: "row",
  },
});
