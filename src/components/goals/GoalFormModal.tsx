/**
 * 목표 추가 · 수정 폼 — 제목 · 하루 목표 시간(빠른 선택 + 직접) · 시작일 · 종료일.
 * 부모가 `key`로 열 때마다 새로 만들어 입력 상태가 열린 순간의 값에서 시작한다.
 * 저장은 부모가 한다 (`onSubmit`이 서버 에러 문구를 돌려주면 폼 안에 띄우고 열어 둔다).
 */
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import DatePickerModal from "@/components/app/DatePickerModal";
import Pill from "@/components/app/Pill";
import TextField from "@/components/app/TextField";
import { addDays, dateLabel } from "@/logic/calendar";
import {
  GOAL_MINUTES_MAX,
  GOAL_PRESETS,
  GOAL_TITLE_MAX,
  parseMinutes,
  validateGoalForm,
  withStartDate,
  type GoalForm,
} from "@/logic/goals";
import type { CreateGoalInput } from "@/services/api-types";
import { fmt } from "@/shared/format";
import { kstDateKey } from "@/shared/kst";
import { colors, fonts, radius } from "@/theme";

export default function GoalFormModal({
  mode,
  initial,
  now,
  onSubmit,
  onClose,
}: {
  mode: "create" | "edit";
  initial: GoalForm;
  now: number;
  /** 서버에 저장한다 — 실패하면 화면에 띄울 한국어 문구, 성공하면 null (부모가 폼을 닫는다) */
  onSubmit: (input: CreateGoalInput) => Promise<string | null>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<GoalForm>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState<"start" | "end" | null>(null);
  const today = kstDateKey(now);

  const close = () => {
    if (!saving) onClose();
  };

  async function submit() {
    if (saving) return;
    const result = validateGoalForm(form);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const message = await onSubmit(result.input);
      if (message) setError(message);
    } finally {
      setSaving(false);
    }
  }

  const minutes = form.targetMinutes;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <Pressable testID="goal-form-scrim" accessibilityLabel="닫기" style={styles.scrim} onPress={close}>
          <Pressable testID="goal-form" style={styles.card} onPress={() => {}}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              <Text accessibilityRole="header" style={styles.title}>
                {mode === "create" ? "새 목표 추가" : "목표 수정"}
              </Text>

              <TextField
                testID="goal-title"
                label="목표 제목"
                placeholder="예: 하루 스크린타임 2시간 이하로 줄이기"
                value={form.title}
                onChangeText={(title) => setForm((f) => ({ ...f, title }))}
                maxLength={GOAL_TITLE_MAX}
              />

              <View style={styles.group}>
                <Text style={styles.label}>하루 목표 스크린타임</Text>
                <View style={styles.chips}>
                  {GOAL_PRESETS.map((min) => {
                    const on = minutes === min;
                    return (
                      <Pressable
                        key={min}
                        testID={`goal-preset-${min}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        onPress={() => setForm((f) => ({ ...f, targetMinutes: min }))}
                        hitSlop={{ top: 6, bottom: 6 }}
                        style={[styles.chip, on && styles.chipOn]}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{fmt(min)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.minutesRow}>
                  <View style={styles.minutesInput}>
                    <TextField
                      testID="goal-minutes"
                      accessibilityLabel="하루 목표 시간 (분)"
                      keyboardType="number-pad"
                      textAlign="center"
                      value={minutes === null ? "" : String(minutes)}
                      onChangeText={(text) => setForm((f) => ({ ...f, targetMinutes: parseMinutes(text) }))}
                      maxLength={String(GOAL_MINUTES_MAX).length}
                    />
                  </View>
                  <Text style={styles.unit}>분 이하</Text>
                </View>
                <Text testID="goal-minutes-hint" style={styles.hint}>
                  {minutes !== null && minutes >= 1 ? `현재 설정: 하루 ${fmt(minutes)} 이하` : "1분 이상으로 정해주세요."}
                </Text>
              </View>

              <View style={styles.dates}>
                <DateField testID="goal-start" label="시작일" value={form.startDate} onPress={() => setPicking("start")} />
                <DateField testID="goal-end" label="종료일" value={form.endDate} onPress={() => setPicking("end")} />
              </View>

              {error ? (
                <Text testID="goal-form-error" accessibilityRole="alert" style={styles.error}>
                  {error}
                </Text>
              ) : null}

              <View style={styles.actions}>
                <Pill testID="goal-cancel" label="취소" onPress={close} disabled={saving} />
                <Pill
                  testID="goal-submit"
                  variant="accent"
                  label={saving ? (mode === "create" ? "추가 중…" : "저장 중…") : mode === "create" ? "목표 추가" : "저장"}
                  onPress={submit}
                  disabled={saving}
                />
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={picking !== null}
        title={picking === "end" ? "종료일" : "시작일"}
        value={picking === "end" ? form.endDate : form.startDate}
        today={today}
        // 종료일은 시작일 다음 날부터 — 서버가 "종료일은 시작일 이후"를 요구한다
        min={picking === "end" ? addDays(form.startDate, 1) : undefined}
        onPick={(key) => {
          setForm((f) => (picking === "end" ? { ...f, endDate: key } : withStartDate(f, key)));
          setPicking(null);
        }}
        onClose={() => setPicking(null)}
      />
    </Modal>
  );
}

function DateField({ label, value, onPress, testID }: { label: string; value: string; onPress: () => void; testID: string }) {
  return (
    <View style={styles.dateField}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label} ${dateLabel(value)}, 눌러서 바꾸기`}
        onPress={onPress}
        style={styles.dateButton}
      >
        <Text style={styles.dateText}>{dateLabel(value)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  scrim: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
    backgroundColor: colors.scrim,
  },
  card: {
    maxHeight: "92%",
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgCard,
  },
  content: {
    gap: 20,
    padding: 22,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  group: {
    gap: 10,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    height: 32,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgSubtle,
  },
  chipOn: {
    borderColor: colors.accentLine,
    backgroundColor: colors.accentSoft,
  },
  chipText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  chipTextOn: {
    fontFamily: fonts.semibold,
    color: colors.brand,
  },
  minutesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  minutesInput: {
    width: 96,
  },
  unit: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
  },
  dates: {
    gap: 14,
  },
  dateField: {
    gap: 8,
  },
  dateButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgNav,
  },
  dateText: {
    // 한글 요일이 섞여 있다 — Familjen Grotesk에는 한글 글리프가 없다 (design.md)
    fontFamily: fonts.regular,
    fontVariant: ["tabular-nums"],
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.dangerLine,
    backgroundColor: colors.dangerSoft,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
});
