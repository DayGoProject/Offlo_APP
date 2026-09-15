/**
 * M1 기반 점검 화면 — 폰트 · 색 토큰 · 공유 코드가 실기기에서 그대로 나오는지 눈으로 확인하는 자리.
 *
 * 로그인 가드 밖(`/foundation`)에 둔다 — verify-M1 회귀 검사가 로그인 없이 이 화면을 본다.
 * M4에서 웹 14단계 디자인(다크 단일 · Pretendard + Familjen Grotesk)으로 맞추며 테마 전환 카드를 뺐다.
 */
import { StyleSheet, Text, View } from "react-native";

import Card, { CardHeader } from "@/components/app/Card";
import PageHeader from "@/components/app/PageHeader";
import Screen from "@/components/app/Screen";
import { ALL_BADGES } from "@/shared/badge-utils";
import { fmt } from "@/shared/format";
import { getAnimalEmoji, getAnimalStage, getPlantLevel, nextPlantLevel } from "@/shared/garden-utils";
import { BRAND, colors, em, fonts, VOID } from "@/theme";

/** 공유 코드가 웹과 같은 답을 내는지 보기 위한 표본값 */
const SAMPLE_MINUTES = 1450;
const SAMPLE_STREAK = 12;

export default function FoundationScreen() {
  const plant = getPlantLevel(SAMPLE_MINUTES);
  const next = nextPlantLevel(plant);
  const stage = getAnimalStage(SAMPLE_STREAK);

  return (
    <Screen testID="screen">
      <View style={styles.brandBlock}>
        <Text style={styles.brandMark}>Offlo</Text>
        <PageHeader eyebrow="M1 · 기반 점검" title="폰트 · 색 · 공유 코드" />
      </View>

      <Card>
        <CardHeader title="폰트" />
        <Text style={[styles.sample, { fontFamily: fonts.regular }]}>Pretendard Regular 가나다 0123</Text>
        <Text style={[styles.sample, { fontFamily: fonts.semibold }]}>Pretendard SemiBold 가나다 0123</Text>
        <Text style={styles.numSample}>Familjen Grotesk 4h 12m · 0123</Text>
        <Text style={styles.note}>굵기는 400 · 600 두 가지뿐이다. 숫자·영문 디스플레이만 Familjen Grotesk — 한글 글리프가 없다.</Text>
      </Card>

      <Card>
        <CardHeader title="색" />
        <View style={styles.swatchRow}>
          <Swatch color={VOID} label="base" />
          <Swatch color={BRAND} label="brand" />
          <Swatch color={colors.textPrimary} label="text" />
        </View>
        <Text style={styles.note}>다크 단일 테마. 텍스트는 순백이 아니다 — 중간 색조는 전부 투명도로 만든다.</Text>
      </Card>

      <Card>
        <CardHeader title="공유 코드" />
        <View>
          <Row label="누적 절약" value={fmt(SAMPLE_MINUTES)} />
          <Row label="식물 레벨" value={`${plant.emoji} Lv.${plant.level} ${plant.name}`} />
          <Row label="다음 레벨까지" value={next ? `${fmt(next.minMinutes - SAMPLE_MINUTES)} 남음` : "최고 레벨"} />
          <Row label={`연속 기록 ${SAMPLE_STREAK}일`} value={`${getAnimalEmoji("cat", SAMPLE_STREAK)} ${stage.name}`} />
          <Row label="배지" value={`${ALL_BADGES.length}종`} last />
        </View>
        <Text style={styles.note}>웹 `web/src/lib`의 복사본이다. 값이 웹과 다르면 sync-shared가 잡는다.</Text>
      </Card>
    </Screen>
  );
}

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.swatch}>
      <View style={[styles.swatchChip, { backgroundColor: color }]} />
      <Text style={styles.swatchLabel}>{label}</Text>
      <Text style={styles.swatchHex}>{color}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brandBlock: {
    gap: 12,
  },
  brandMark: {
    fontFamily: fonts.num,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: em(34, -0.04),
    color: colors.brand,
  },
  sample: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  numSample: {
    fontFamily: fonts.num,
    fontSize: 22,
    letterSpacing: em(22, -0.03),
    fontVariant: ["tabular-nums"],
    color: colors.textPrimary,
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textFaint,
  },
  swatchRow: {
    flexDirection: "row",
    gap: 12,
  },
  swatch: {
    flex: 1,
    gap: 6,
  },
  swatchChip: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  swatchLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  swatchHex: {
    fontFamily: fonts.num,
    fontSize: 11,
    color: colors.textFaint,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrip,
  },
  rowLabel: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  rowValue: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textPrimary,
  },
});
