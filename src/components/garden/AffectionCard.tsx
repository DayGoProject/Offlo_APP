/**
 * 친밀도 카드 — 쓰다듬은 만큼 쌓이는 사이. 레벨 이름 · 오늘 쌓은 횟수(점 5개) · 다음 레벨까지 진행.
 * 데이터는 props로만 받는다 (api · Firebase 없음) — 미리보기와 실제 화면이 같은 컴포넌트를 쓴다.
 * 하루 상한을 채워도 쓰다듬는 것은 막지 않는다 — 더 쌓이지 않을 뿐이다 (서버도 에러가 아니라 "인정 안 됨"으로 답한다).
 */
import { StyleSheet, Text, View } from "react-native";

import Card, { CardHeader } from "@/components/app/Card";
import ErrorNotice from "@/components/app/ErrorNotice";
import ProgressFoot from "@/components/garden/ProgressFoot";
import type { AffectionView } from "@/logic/pet";
import { colors, em, fonts } from "@/theme";

function hint(view: AffectionView): string {
  if (view.capped) return "오늘은 충분히 쓰다듬었어요. 내일 또 만나요.";
  if (view.today === 0) return `동물을 톡 누르거나 쓱쓱 문질러 보세요. 하루 ${view.cap}번까지 쌓여요.`;
  return `좋아해요! 오늘 ${view.cap - view.today}번 더 쌓을 수 있어요.`;
}

export default function AffectionCard({ view, error }: { view: AffectionView; error: string | null }) {
  return (
    <Card testID="pet-affection">
      <CardHeader title="친밀도" right={`Lv.${view.level.level} · ${view.level.name}`} rightTone="brand" />

      <View style={styles.today}>
        <View
          testID="pet-affection-pips"
          accessible
          accessibilityLabel={`오늘 ${view.today}번, 하루 ${view.cap}번까지`}
          style={styles.pips}
        >
          {Array.from({ length: view.cap }, (_, i) => (
            <View key={i} style={[styles.pip, { backgroundColor: i < view.today ? colors.brand : colors.textGhost }]} />
          ))}
        </View>
        <Text testID="pet-affection-today" style={styles.count}>
          {view.today}
          <Text style={styles.countOf}>{` / ${view.cap}`}</Text>
          <Text style={styles.unit}>번</Text>
        </Text>
      </View>
      <Text testID="pet-affection-hint" style={styles.hint}>
        {hint(view)}
      </Text>

      <ProgressFoot
        testID="pet-affection-progress"
        value={view.next ? `${view.total} / ${view.next.minTotal}` : `${view.total}`}
        unit="번"
        ratio={view.ratio}
        note={view.next ? `${view.next.name}까지 ${view.remainToNext}번 남았어요` : "가장 가까운 사이예요"}
      />

      {error ? <ErrorNotice testID="pet-affection-error" message={`쓰다듬기를 저장하지 못해 서버 값으로 되돌렸어요. ${error}`} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  today: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pips: {
    flexDirection: "row",
    gap: 8,
  },
  pip: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  count: {
    fontFamily: fonts.num,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: em(22, -0.03),
    fontVariant: ["tabular-nums"],
    color: colors.textPrimary,
  },
  countOf: {
    color: colors.textMuted,
  },
  unit: {
    fontFamily: fonts.regular,
    fontSize: 15,
    letterSpacing: 0,
    color: colors.textMuted,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textPrimarySoft,
  },
});
