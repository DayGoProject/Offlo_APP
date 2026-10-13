/**
 * 글자 입력칸 — 웹 `components/app/Field.tsx` 이식. 라벨 · 입력 · 힌트 한 묶음.
 *
 * 입력면은 카드보다 한 단계 밝은 `bgNav`다 — 카드 안에 입력이 있을 때 카드와 같은 색이면 칸의 경계가 사라진다 (웹 설정 화면과 같은 이유).
 * 포커스된 칸만 테두리가 브랜드 그린이다. 높이 44(터치 영역) · 여러 줄이면 `multiline`.
 */
import { useState } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { colors, fonts } from "@/theme";

export default function TextField({
  label,
  hint,
  multiline = false,
  testID,
  ...rest
}: {
  label?: string;
  hint?: string;
} & Pick<
  TextInputProps,
  | "value"
  | "onChangeText"
  | "placeholder"
  | "maxLength"
  | "keyboardType"
  | "editable"
  | "returnKeyType"
  | "onSubmitEditing"
  | "autoCapitalize"
  | "autoCorrect"
  | "numberOfLines"
  | "accessibilityLabel"
  | "textAlign"
> & { multiline?: boolean; testID?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        testID={testID}
        accessibilityLabel={rest.accessibilityLabel ?? label}
        placeholderTextColor={colors.textFaint}
        selectionColor={colors.brand}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, multiline && styles.multiline, focused && styles.focused, rest.editable === false && styles.disabled]}
        {...rest}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  input: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgNav,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  multiline: {
    minHeight: 84,
    paddingTop: 12,
  },
  focused: {
    borderColor: colors.brand,
  },
  disabled: {
    opacity: 0.6,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
  },
});
