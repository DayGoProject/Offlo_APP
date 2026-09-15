/**
 * 알약 세그먼트 컨트롤 — 웹 `components/app/Segmented.tsx` 이식.
 * 선택된 항목만 `--accent-soft` 바탕 + 브랜드 그린 글자 + 600.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, radius } from "@/theme";

export default function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <View accessibilityRole="tablist" style={styles.track}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={`segment-${option.value}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            hitSlop={{ top: 5, bottom: 5 }}
            style={[styles.item, active && styles.itemActive]}
          >
            <Text style={[styles.label, active ? styles.labelActive : null]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderCard,
  },
  item: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  itemActive: {
    backgroundColor: colors.accentSoft,
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  labelActive: {
    fontFamily: fonts.semibold,
    color: colors.brand,
  },
});
