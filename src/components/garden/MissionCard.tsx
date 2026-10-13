/**
 * 오늘의 미션 카드 — 밥 주기 · 쓰다듬기 3번(오늘) + 이번 주 주간 분석 받기(주 1회).
 * 계산은 `logic/mission.ts`가 한다 — 이 파일은 받은 판 그대로 그린다 (api · Firebase 없음 — 미리보기와 실제 화면이 같은 컴포넌트를 쓴다).
 *
 * 보상은 연출이다 (동물이 기뻐하고 진동이 난다). 식물 경험치는 올리지 않는다 — 경험치는 서버의 분석 · 목표 후처리만 올린다.
 * 눌러서 갈 곳이 있는 줄(밥 · 받을 수 있는 주간 분석)은 분석 탭으로 보낸다.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import Card, { CardHeader } from "@/components/app/Card";
import { SmallCheckIcon } from "@/components/app/Icons";
import type { Mission, MissionBoard } from "@/logic/mission";
import { colors, em, fonts } from "@/theme";

export default function MissionCard({ board, onGoAnalysis }: { board: MissionBoard; onGoAnalysis: () => void }) {
  const today = board.missions.filter((m) => m.period === "today");
  const week = board.missions.filter((m) => m.period === "week");

  return (
    <Card testID="garden-missions">
      <CardHeader
        title="오늘의 미션"
        right={board.allTodayDone ? "모두 완료" : `${board.todayDone} / ${board.todayTotal}`}
        rightTone={board.allTodayDone ? "brand" : "muted"}
      />
      <View style={styles.list}>
        {today.map((m) => (
          <Row key={m.id} mission={m} onGoAnalysis={onGoAnalysis} />
        ))}
      </View>

      {week.length > 0 ? (
        <View style={styles.weekBlock}>
          <Text style={styles.weekLabel}>이번 주</Text>
          {week.map((m) => (
            <Row key={m.id} mission={m} onGoAnalysis={onGoAnalysis} />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function Row({ mission, onGoAnalysis }: { mission: Mission; onGoAnalysis: () => void }) {
  const press = mission.goesToAnalysis ? onGoAnalysis : undefined;
  const state = mission.done ? "완료" : "진행 중";
  const progress = mission.progress ? ` ${mission.progress.value} / ${mission.progress.target}` : "";

  return (
    <Pressable
      testID={`mission-${mission.id}`}
      accessibilityRole={press ? "button" : "text"}
      accessibilityLabel={`${mission.title}${progress}, ${state}. ${mission.hint}`}
      accessibilityState={{ checked: mission.done }}
      disabled={!press}
      onPress={press}
      style={({ pressed }) => [styles.row, pressed && press ? { opacity: 0.7 } : null]}
    >
      <View style={[styles.check, mission.done ? styles.checkDone : null]}>
        {mission.done ? <SmallCheckIcon color={colors.brand} size={12} /> : null}
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, mission.done && styles.titleDone]}>{mission.title}</Text>
        <Text style={styles.hint}>{mission.hint}</Text>
      </View>
      {mission.progress ? (
        <Text testID={`mission-${mission.id}-progress`} style={[styles.count, mission.done && { color: colors.brand }]}>
          {mission.progress.value}
          <Text style={styles.countOf}>{` / ${mission.progress.target}`}</Text>
        </Text>
      ) : press ? (
        <Text style={styles.go}>분석하기</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    paddingVertical: 6,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkDone: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentLine,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  titleDone: {
    color: colors.textMuted,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  count: {
    fontFamily: fonts.num,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: em(17, -0.02),
    fontVariant: ["tabular-nums"],
    color: colors.textPrimary,
  },
  countOf: {
    color: colors.textMuted,
  },
  go: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.brand,
  },
  weekBlock: {
    gap: 4,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  weekLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: em(11, 0.04),
    color: colors.textFaint,
  },
});
