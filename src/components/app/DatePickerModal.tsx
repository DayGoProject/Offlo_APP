/**
 * 날짜 고르기 — 한 달 달력 시트 (M7 목표의 시작일 · 종료일).
 *
 * 시스템 날짜 선택기(`@react-native-community/datetimepicker`)를 쓰지 않는 이유: ① 네이티브 모듈이라 개발 빌드를 다시 만들어야 하고
 * ② RN Web(층 ①)에는 없어 검증이 막히며 ③ 다크 단일 테마와 모양이 따로 논다. 날짜 키 계산은 `logic/calendar.ts`(순수)가 한다.
 * 날짜는 키 문자열("2026-10-13")로만 오간다 — 시각 · 시간대가 끼지 않는다.
 */
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { addMonths, monthGrid, monthLabel, WEEKDAY_LABELS, yearMonthOf } from "@/logic/calendar";
import { colors, fonts, radius } from "@/theme";

export default function DatePickerModal({
  visible,
  title,
  value,
  today,
  min,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  /** 지금 골라져 있는 날짜 키 */
  value: string;
  /** 오늘(KST) 날짜 키 — 달력에 점을 찍는다 */
  today: string;
  /** 이 날짜 키보다 이른 날은 고를 수 없다 */
  min?: string;
  onPick: (key: string) => void;
  onClose: () => void;
}) {
  // 열 때마다 고른 날짜의 달에서 시작한다 — 모달이 닫혀도 컴포넌트는 남으므로 열린 순간에 맞춘다
  const [shown, setShown] = useState(() => yearMonthOf(value) ?? yearMonthOf(today) ?? { year: 2026, month: 1 });
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setShown(yearMonthOf(value) ?? yearMonthOf(today) ?? shown);
  }

  const weeks = monthGrid(shown);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable testID="date-scrim" accessibilityLabel="닫기" style={styles.scrim} onPress={onClose}>
        <Pressable testID="date-picker" style={styles.card} onPress={() => {}}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>

          <View style={styles.nav}>
            <Pressable
              testID="date-prev"
              accessibilityRole="button"
              accessibilityLabel="이전 달"
              hitSlop={8}
              onPress={() => setShown((s) => addMonths(s, -1))}
              style={styles.navButton}
            >
              <Text style={styles.navArrow}>‹</Text>
            </Pressable>
            <Text testID="date-month" style={styles.month}>
              {monthLabel(shown)}
            </Text>
            <Pressable
              testID="date-next"
              accessibilityRole="button"
              accessibilityLabel="다음 달"
              hitSlop={8}
              onPress={() => setShown((s) => addMonths(s, 1))}
              style={styles.navButton}
            >
              <Text style={styles.navArrow}>›</Text>
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAY_LABELS.map((d) => (
              <Text key={d} style={styles.weekday}>
                {d}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {weeks.map((week, wi) => (
              <View key={wi} style={styles.weekRow}>
                {week.map((key, ci) => {
                  if (!key) return <View key={ci} style={styles.cell} />;
                  const disabled = min !== undefined && key < min;
                  const selected = key === value;
                  const isToday = key === today;
                  return (
                    <Pressable
                      key={key}
                      testID={`date-${key}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${Number(key.slice(5, 7))}월 ${Number(key.slice(8))}일${isToday ? " 오늘" : ""}`}
                      accessibilityState={{ selected, disabled }}
                      disabled={disabled}
                      onPress={() => onPick(key)}
                      style={styles.cell}
                    >
                      <View style={[styles.day, selected && styles.daySelected]}>
                        <Text
                          style={[
                            styles.dayText,
                            disabled && styles.dayDisabled,
                            isToday && !selected && styles.dayToday,
                            selected && styles.dayTextSelected,
                          ]}
                        >
                          {Number(key.slice(8))}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          <Pressable testID="date-close" accessibilityRole="button" onPress={onClose} hitSlop={8} style={styles.close}>
            <Text style={styles.closeText}>닫기</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
    backgroundColor: colors.scrim,
  },
  card: {
    gap: 14,
    padding: 20,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgCard,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navButton: {
    width: 44,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.borderCard,
  },
  navArrow: {
    fontFamily: fonts.regular,
    fontSize: 20,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  month: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  grid: {
    gap: 4,
  },
  weekRow: {
    flexDirection: "row",
  },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
  },
  cell: {
    flex: 1,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  day: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  daySelected: {
    backgroundColor: colors.brand,
  },
  dayText: {
    fontFamily: fonts.num,
    fontSize: 14,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  dayToday: {
    color: colors.brand,
    fontFamily: fonts.semibold,
  },
  dayDisabled: {
    color: colors.textGhost,
  },
  dayTextSelected: {
    color: colors.bgPage,
    fontFamily: fonts.semibold,
  },
  close: {
    alignSelf: "flex-end",
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  closeText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
});
