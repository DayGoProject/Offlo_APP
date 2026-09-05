/**
 * M1 기반 점검 화면.
 *
 * 이 화면의 목적은 하나다 — 폰트·색 토큰·공유 코드·테마 전환이 실기기에서
 * 실제로 동작하는지 눈으로 확인하는 것. M4에서 대시보드로 대체된다.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BRAND, fonts, shadowCard, type ThemeColors } from "@/theme";
import { useTheme, type ThemePref } from "@/theme-context";
import { fmt } from "@/shared/format";
import { ALL_BADGES } from "@/shared/badge-utils";
import {
  getAnimalEmoji,
  getAnimalStage,
  getPlantLevel,
  nextPlantLevel,
} from "@/shared/garden-utils";

/** 공유 코드가 웹과 같은 답을 내는지 보기 위한 표본값 */
const SAMPLE_MINUTES = 1450;
const SAMPLE_STREAK = 12;

const THEME_OPTIONS: { pref: ThemePref; label: string }[] = [
  { pref: "system", label: "시스템" },
  { pref: "light", label: "라이트" },
  { pref: "dark", label: "다크" },
];

export default function FoundationScreen() {
  const { colors: c, scheme, pref, setPref } = useTheme();
  const insets = useSafeAreaInsets();

  const plant = getPlantLevel(SAMPLE_MINUTES);
  const next = nextPlantLevel(plant);
  const stage = getAnimalStage(SAMPLE_STREAK);

  return (
    <ScrollView
      testID="screen"
      style={{ backgroundColor: c.bgPage }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 40 },
      ]}
    >
      <Text style={[styles.brandMark, { color: c.brand }]}>Offlo</Text>
      <Text style={[styles.caption, { color: c.textMuted }]}>M1 · 기반 점검</Text>

      <Card colors={c} scheme={scheme} title="폰트">
        <Text style={[styles.sample, { fontFamily: fonts.regular, color: c.textPrimary }]}>
          스포카 한 산스 네오 Regular 0123
        </Text>
        <Text style={[styles.sample, { fontFamily: fonts.medium, color: c.textPrimary }]}>
          스포카 한 산스 네오 Medium 0123
        </Text>
        <Text style={[styles.sample, { fontFamily: fonts.bold, color: c.textPrimary }]}>
          스포카 한 산스 네오 Bold 0123
        </Text>
        <Text style={[styles.note, { color: c.textFaint }]}>
          RN은 굵기가 아니라 파일명으로 고른다 — 400·500·700 3종만 쓴다.
        </Text>
      </Card>

      <Card colors={c} scheme={scheme} title="색">
        <View style={styles.swatchRow}>
          <Swatch colors={c} color="#0A0A0F" label="base" />
          <Swatch colors={c} color={BRAND} label="brand" />
          <Swatch colors={c} color="#FFFFFF" label="text" />
        </View>
        <Text style={[styles.note, { color: c.textFaint }]}>
          색은 이 3개뿐이다. 중간 색조는 전부 투명도로 만든다.
        </Text>
      </Card>

      <Card colors={c} scheme={scheme} title="공유 코드">
        <Row colors={c} label="누적 절약" value={fmt(SAMPLE_MINUTES)} />
        <Row
          colors={c}
          label="식물 레벨"
          value={`${plant.emoji} Lv.${plant.level} ${plant.name}`}
        />
        <Row
          colors={c}
          label="다음 레벨까지"
          value={next ? `${fmt(next.minMinutes - SAMPLE_MINUTES)} 남음` : "최고 레벨"}
        />
        <Row
          colors={c}
          label={`연속 기록 ${SAMPLE_STREAK}일`}
          value={`${getAnimalEmoji("cat", SAMPLE_STREAK)} ${stage.name}`}
        />
        <Row colors={c} label="배지" value={`${ALL_BADGES.length}종`} />
        <Text style={[styles.note, { color: c.textFaint }]}>
          웹 `web/src/lib`의 복사본이다. 값이 웹과 다르면 sync-shared가 잡는다.
        </Text>
      </Card>

      <Card colors={c} scheme={scheme} title="테마">
        <View style={styles.segment}>
          {THEME_OPTIONS.map((opt) => {
            const active = pref === opt.pref;
            return (
              <Pressable
                key={opt.pref}
                onPress={() => setPref(opt.pref)}
                style={({ pressed }) => [
                  styles.segmentItem,
                  {
                    backgroundColor: active ? c.brand : c.bgSubtle,
                    borderColor: active ? c.brand : c.borderCard,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    { color: active ? "#0A0A0F" : c.textSecondary },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.note, { color: c.textFaint }]}>
          지금 적용된 스킴: {scheme === "dark" ? "다크" : "라이트"}
        </Text>
      </Card>
    </ScrollView>
  );
}

function Card({
  colors: c,
  scheme,
  title,
  children,
}: {
  colors: ThemeColors;
  scheme: "light" | "dark";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.card,
        shadowCard[scheme],
        { backgroundColor: c.bgCard, borderColor: c.borderCard },
      ]}
    >
      <Text style={[styles.cardTitle, { color: c.textMuted }]}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ colors: c, label, value }: { colors: ThemeColors; label: string; value: string }) {
  return (
    <View style={[styles.row, { borderTopColor: c.borderStrip }]}>
      <Text style={[styles.rowLabel, { color: c.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: c.textPrimary }]}>{value}</Text>
    </View>
  );
}

function Swatch({ colors: c, color, label }: { colors: ThemeColors; color: string; label: string }) {
  return (
    <View style={styles.swatch}>
      <View style={[styles.swatchChip, { backgroundColor: color, borderColor: c.borderStrong }]} />
      <Text style={[styles.swatchLabel, { color: c.textSecondary }]}>{label}</Text>
      <Text style={[styles.swatchHex, { color: c.textFaint }]}>{color}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  brandMark: {
    fontFamily: fonts.bold,
    fontSize: 32,
    letterSpacing: -0.5,
  },
  caption: {
    fontFamily: fonts.regular,
    fontSize: 13,
    marginTop: -10,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    gap: 10,
  },
  cardTitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  sample: {
    fontSize: 16,
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
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
  },
  swatchLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  swatchHex: {
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    paddingVertical: 10,
    gap: 12,
  },
  rowLabel: {
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  rowValue: {
    fontFamily: fonts.medium,
    fontSize: 15,
    flexShrink: 1,
    textAlign: "right",
  },
  segment: {
    flexDirection: "row",
    gap: 8,
  },
  segmentItem: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
  },
  segmentLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
  },
});
