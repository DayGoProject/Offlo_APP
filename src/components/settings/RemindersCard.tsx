/**
 * 리마인더 알림 설정 카드 — 데이터는 props로만 받는다 (`api` · Firebase · `expo-notifications` import 없음 — 미리보기도 같은 컴포넌트).
 *
 * 세 가지 예약 알림(저녁 분석 · 동물 배고픔 · 목표 마감 하루 전)을 켜고 끈다. **처음엔 모두 꺼져 있고**, 켤 때 시스템 알림 권한을 묻는다 (부모가 `useReminderSettings`로).
 * 권한이 꺼져 있으면 이유를 알리고, 시스템 창을 다시 못 띄우는 경우(두 번 거절)에는 기기 설정으로 가는 버튼을 준다. 쓸 수 없는 환경(웹 · Expo Go)에서는 스위치가 잠긴다.
 */
import { StyleSheet, Switch, Text, View } from "react-native";

import Card, { CardHeader } from "@/components/app/Card";
import Pill from "@/components/app/Pill";
import { REMINDER_COPY, REMINDER_KINDS, type ReminderKind, type ReminderPermission, type ReminderPrefs } from "@/logic/reminders";
import { REMINDER_MESSAGES } from "@/hooks/use-reminder-settings";
import { colors, fonts } from "@/theme";

export interface RemindersCardProps {
  supported: boolean;
  /** 저장된 설정을 읽었는가 — 그 전에는 스위치를 잠근다 (꺼진 줄 알고 켜면 저장된 값을 덮어쓴다) */
  ready: boolean;
  prefs: ReminderPrefs;
  permission: ReminderPermission;
  busy: boolean;
  /** 켜지 못한 이유 (한국어) */
  error: string | null;
  onToggle: (kind: ReminderKind, on: boolean) => void;
  onOpenSettings: () => void;
}

export default function RemindersCard({ supported, ready, prefs, permission, busy, error, onToggle, onOpenSettings }: RemindersCardProps) {
  const locked = !supported || !ready;
  const anyOn = REMINDER_KINDS.some((k) => prefs[k]);
  // 권한이 없는데 켜 둔 상태(기기 설정에서 껐다) — 알림이 안 간다는 것을 알려야 한다
  const blocked = supported && permission.state === "denied" && (anyOn || error !== null);

  return (
    <Card testID="settings-reminders">
      <CardHeader title="리마인더 알림" />
      <Text style={styles.lead}>서버 없이 이 기기에서 예약하는 알림이에요. 켠 것만 울려요.</Text>

      <View>
        {REMINDER_KINDS.map((kind, i) => (
          <View key={kind} testID={`reminder-row-${kind}`} style={[styles.row, i < REMINDER_KINDS.length - 1 && styles.divider]}>
            <View style={styles.text}>
              <Text style={styles.title}>{REMINDER_COPY[kind].title}</Text>
              <Text style={styles.hint}>{REMINDER_COPY[kind].hint}</Text>
            </View>
            <Switch
              testID={`reminder-switch-${kind}`}
              accessibilityLabel={`${REMINDER_COPY[kind].title}, ${prefs[kind] ? "켜짐" : "꺼짐"}`}
              value={prefs[kind]}
              disabled={locked || busy}
              onValueChange={(on) => onToggle(kind, on)}
              trackColor={{ false: colors.bgBar, true: colors.accentSoft }}
              thumbColor={prefs[kind] ? colors.brand : colors.textMuted}
              ios_backgroundColor={colors.bgBar}
            />
          </View>
        ))}
      </View>

      {!supported ? (
        <Text testID="reminders-unsupported" style={styles.notice}>
          {REMINDER_MESSAGES.unsupported}
        </Text>
      ) : null}

      {blocked ? (
        <View testID="reminders-denied" style={styles.denied}>
          <Text style={styles.deniedText}>{REMINDER_MESSAGES.denied}</Text>
          <Pill testID="reminders-open-settings" label="기기 설정 열기" onPress={onOpenSettings} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  lead: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
    marginTop: -4,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingVertical: 12,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderCard,
  },
  text: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  notice: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: 8,
  },
  denied: {
    gap: 10,
    alignItems: "flex-start",
    marginTop: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.dangerLine,
    backgroundColor: colors.dangerSoft,
  },
  deniedText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textPrimary,
  },
});
