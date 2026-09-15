/**
 * 반려 정원 카드 — 식물 렌더 · 누적 디톡스 · 다음 단계까지 진행 바.
 */
import { StyleSheet, Text, View } from "react-native";

import Card, { CardHeader } from "@/components/app/Card";
import PlantImage from "@/components/garden/PlantImage";
import { getPlantLevel, nextPlantLevel } from "@/shared/garden-utils";
import { colors, em, fonts, radius } from "@/theme";

/** 1234 → "1,234" */
const grouped = (n: number) => n.toLocaleString("ko-KR");

export default function GardenCard({ totalDetoxMinutes, onOpenGarden }: { totalDetoxMinutes: number; onOpenGarden?: () => void }) {
  const plant = getPlantLevel(totalDetoxMinutes);
  const next = nextPlantLevel(plant);
  const remain = next ? next.minMinutes - totalDetoxMinutes : 0;
  const ratio = next ? (totalDetoxMinutes - plant.minMinutes) / (next.minMinutes - plant.minMinutes) : 1;

  return (
    <Card testID="garden-card">
      <CardHeader
        title="반려 정원"
        right={`Lv.${plant.level} ${plant.name}`}
        rightTone="brand"
        onPressRight={onOpenGarden}
      />

      <View style={styles.plant}>
        <PlantImage totalMinutes={totalDetoxMinutes} size={220} />
      </View>

      <View style={styles.footer}>
        {/* 숫자만 Familjen Grotesk — "분"은 한글이라 Pretendard로 되돌린다 */}
        <Text style={styles.amount}>
          {grouped(totalDetoxMinutes)}
          {next ? ` / ${grouped(next.minMinutes)}` : ""}
          <Text style={styles.amountUnit}>분</Text>
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%` }]} />
        </View>
        <Text style={styles.note}>
          {next ? `${next.name}까지 ${grouped(remain)}분 남았어요` : "마지막 단계까지 키웠어요"}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  plant: {
    alignItems: "center",
    paddingVertical: 8,
  },
  footer: {
    gap: 10,
  },
  amount: {
    fontFamily: fonts.num,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: em(22, -0.03),
    fontVariant: ["tabular-nums"],
    color: colors.textMuted,
  },
  amountUnit: {
    fontFamily: fonts.regular,
    fontSize: 15,
    letterSpacing: 0,
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
    color: colors.textMuted,
  },
});
