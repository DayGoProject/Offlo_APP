/**
 * 주간 종합 분석 카드 — 이번 주(KST 월~일) 7칸과 주간 분석 버튼.
 * 칸은 **요일 자리에** 채운다 (웹은 기록을 순서대로 채워 월요일을 건너뛰면 요일이 밀린다 — logic/analysis.ts).
 */
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import Card, { CardHeader } from "@/components/app/Card";
import ErrorNotice from "@/components/app/ErrorNotice";
import Pill from "@/components/app/Pill";
import { WEEKLY_THRESHOLD, type WeekSlot, type WeeklyState } from "@/logic/analysis";
import { colors, em, fonts, radius } from "@/theme";

export default function WeeklyCard({
  slots,
  count,
  doneId,
  weekly,
  loading,
  onGenerate,
  onRetrySave,
  onOpenResult,
}: {
  slots: WeekSlot[];
  /** 이번 주 일간 분석 수 */
  count: number;
  /** 이번 주에 이미 만든 주간 분석 */
  doneId: string | null;
  weekly: WeeklyState;
  loading: boolean;
  onGenerate: () => void;
  onRetrySave: () => void;
  onOpenResult: (id: string) => void;
}) {
  const canWeekly = count >= WEEKLY_THRESHOLD;
  const needed = WEEKLY_THRESHOLD - count;
  const busy = weekly.phase === "generating" || weekly.phase === "saving";

  let action;
  if (busy) {
    action = (
      <View testID="weekly-busy" style={styles.busy}>
        <ActivityIndicator color={colors.brand} />
        <Text style={styles.busyText}>
          {weekly.phase === "saving" ? "주간 분석 저장 중…" : "주간 분석 생성 중… (30~60초)"}
        </Text>
      </View>
    );
  } else if (weekly.phase === "save-failed") {
    action = (
      <View style={styles.row}>
        <Pill testID="weekly-retry-save" label="주간 분석 저장 다시 시도" variant="accent" onPress={onRetrySave} />
      </View>
    );
  } else if (doneId) {
    action = (
      <View style={styles.row}>
        <Text style={styles.doneText}>이번 주 종합 분석을 마쳤어요</Text>
        <Pill testID="open-weekly-result" label="종합 결과 보기" onPress={() => onOpenResult(doneId)} />
      </View>
    );
  } else if (canWeekly) {
    action = (
      <View style={styles.row}>
        <Pill testID="start-weekly" label="이번 주 종합 분석 시작" variant="accent" onPress={onGenerate} />
      </View>
    );
  } else {
    action = (
      <View testID="weekly-locked" style={styles.locked}>
        <Text style={styles.lockedText}>
          {loading ? "불러오는 중…" : count === 0 ? "오늘 분석부터 시작해 보세요" : `${needed}개 더 완료하면 열립니다`}
        </Text>
      </View>
    );
  }

  return (
    <Card testID="weekly-card" style={canWeekly && !doneId ? styles.ready : undefined}>
      <CardHeader title="주간 종합 분석" right={loading ? "—" : `${count} / ${WEEKLY_THRESHOLD}`} />
      <Text style={styles.desc}>
        이번 주 일간 분석 {WEEKLY_THRESHOLD}개를 모두 완료하면 주간 종합 분석을 받을 수 있습니다. 매주 월요일 초기화됩니다.
      </Text>

      <View testID="week-slots" style={styles.slots}>
        {slots.map((slot) => (
          <View key={slot.day} testID={slot.record ? "week-slot-filled" : "week-slot"} style={styles.slot}>
            <View style={[styles.cell, slot.record ? styles.cellFilled : null]}>
              {slot.record ? <Text style={styles.score}>{slot.record.detoxScore}</Text> : null}
            </View>
            <Text
              style={[
                styles.day,
                { color: slot.isToday ? colors.textPrimary : slot.record ? colors.textMuted : colors.textGhost },
              ]}
            >
              {slot.day}
            </Text>
          </View>
        ))}
      </View>

      {weekly.error ? <ErrorNotice testID="weekly-error" message={weekly.error} /> : null}
      {action}
    </Card>
  );
}

const styles = StyleSheet.create({
  ready: {
    borderColor: colors.accentLine,
  },
  desc: {
    marginTop: -6,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 21,
    color: colors.textMuted,
  },
  slots: {
    flexDirection: "row",
    gap: 6,
  },
  slot: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 7,
  },
  cell: {
    width: "100%",
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.scoreTrack,
  },
  cellFilled: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentLine,
  },
  score: {
    fontFamily: fonts.num,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    color: colors.brand,
  },
  day: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 14,
  },
  busy: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 40,
  },
  busyText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textPrimarySoft,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
  },
  doneText: {
    flexShrink: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textPrimarySoft,
  },
  locked: {
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.scoreTrack,
  },
  lockedText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    letterSpacing: em(13, -0.01),
    color: colors.textFaint,
  },
});
