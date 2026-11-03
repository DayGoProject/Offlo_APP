/**
 * 둘러보기 타일 — 오늘 · 이번 주 · 많이 쓴 앱 · 기록을 2 × 2로 한눈에 (UIUX 실험 A안).
 * 타일마다 옅은 색 바탕(브랜드 · 파랑 · 호박 · 보라)으로 종류를 가른다 — 색은 의미 없이 칠하지 않고 "무엇을 보는 타일인가"만 알린다.
 * 기록 타일만 누를 수 있다 (나머지는 위 무대 · 아래 카드가 같은 정보를 자세히 보여 준다).
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import { HistoryIcon } from "@/components/app/HeaderIcons";
import type { BrowseKey, BrowseTile, BrowseTone } from "@/logic/browse";
import { colors, fonts, radius } from "@/theme";

const TONES: Record<BrowseTone, { soft: string; strong: string }> = {
  brand: { soft: colors.accentSoft, strong: colors.brand },
  blue: { soft: colors.blueSoft, strong: colors.blue },
  amber: { soft: colors.amberSoft, strong: colors.amber },
  violet: { soft: colors.violetSoft, strong: colors.violet },
};

export default function BrowseTiles({
  tiles,
  onOpen,
}: {
  tiles: BrowseTile[];
  /** 누를 수 있는 타일(기록)만 호출된다 */
  onOpen: (key: BrowseKey) => void;
}) {
  return (
    <View testID="browse-tiles" style={styles.grid}>
      {tiles.map((tile) => {
        const tone = TONES[tile.tone];
        const pressable = tile.key === "history";
        const body = (
          <>
            <View style={styles.top}>
              <Text style={[styles.label, { color: tone.strong }]}>{tile.label}</Text>
              {pressable ? <HistoryIcon color={tone.strong} size={16} /> : null}
            </View>
            <Text numberOfLines={1} style={styles.value}>
              {tile.value}
            </Text>
            <Text numberOfLines={2} style={styles.hint}>
              {tile.hint}
            </Text>
          </>
        );
        const box = [styles.tile, { backgroundColor: tone.soft }];
        return pressable ? (
          <Pressable
            key={tile.key}
            testID={`browse-${tile.key}`}
            accessibilityRole="button"
            accessibilityLabel={`${tile.label} ${tile.value}. ${tile.hint}`}
            onPress={() => onOpen(tile.key)}
            style={({ pressed }) => [...box, { opacity: pressed ? 0.8 : 1 }]}
          >
            {body}
          </Pressable>
        ) : (
          <View
            key={tile.key}
            testID={`browse-${tile.key}`}
            accessible
            accessibilityLabel={`${tile.label} ${tile.value}. ${tile.hint}`}
            style={box}
          >
            {body}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  tile: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 112,
    borderRadius: radius.tile,
    padding: 16,
    gap: 4,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
  },
  value: {
    marginTop: 8,
    fontFamily: fonts.semibold,
    fontSize: 17,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
  },
});
