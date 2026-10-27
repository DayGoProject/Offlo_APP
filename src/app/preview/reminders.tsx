/**
 * 리마인더 설정 미리보기 — `?state=`(= `perm`) `undetermined|granted|denied|unsupported` (처음 권한 상태) ·
 * `&request=grant|deny` (스위치를 켜 권한을 물을 때 시스템이 답하는 값 · 기본 grant — deny는 거절, 시스템이 더는 창을 못 띄우는 상태도 이렇게 곧바로 거절로 돌아온다) · `&analyzed=1` (오늘 분석을 이미 했다) · `&on=evening,hungry,goal` (처음부터 켜 둔 종류) · `&fail=1` (정원 읽기 실패).
 *
 * **실제와 같은 훅 · 컴포넌트**(`useReminderSettings` · `useReminderSync` · `planReminders` · `RemindersCard`)를 **가짜 기기 서비스**와 함께 돌린다 — 알림이 실제로 예약되지는 않는다.
 * 시각은 KST 2026-09-17(목) 08:00으로 고정이라 예약 결과(몇 번째 날에 울리는가)가 날마다 같다. 샘플 값만 쓴다 (api · useAuth · Firebase · expo-notifications 금지).
 *
 * 기록: `globalThis.__offloReminderCalls` — `request` · `save <켠 종류>` · `openSettings` · `cancelAll` · `sync prefs=… complete=… items=종류:오늘로부터 며칠 뒤,…;…`.
 * 화면 아래의 "예약 결과" 글자는 마지막 `sync`가 받은 계획이다 (검증 · 눈으로 보기 전용 — 실제 설정 화면에는 없다).
 */
import { useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { StyleSheet, Text } from "react-native";

import Card from "@/components/app/Card";
import PageHeader from "@/components/app/PageHeader";
import Screen from "@/components/app/Screen";
import RemindersCard from "@/components/settings/RemindersCard";
import { useReminderSettings } from "@/hooks/use-reminder-settings";
import { useReminderSync } from "@/hooks/use-reminder-sync";
import { addDays, daysBetween } from "@/logic/calendar";
import { REMINDER_KINDS, kstAt, normalizePrefs, type Plan, type PlanSources, type ReminderPermission, type ReminderPrefs, type ReminderService } from "@/logic/reminders";
import { kstDateKey } from "@/shared/kst";
import { colors, fonts } from "@/theme";

const NOW = kstAt("2026-09-17", 8);
const TODAY = kstDateKey(NOW);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function permissionOf(name: string): ReminderPermission {
  switch (name) {
    case "granted":
      return { state: "granted" };
    case "denied":
      return { state: "denied" };
    case "unsupported":
      return { state: "unsupported" };
    default:
      return { state: "undetermined" };
  }
}

const dayOffset = (at: number) => daysBetween(TODAY, kstDateKey(at));

function summarize(plan: Plan): string {
  const byKind = REMINDER_KINDS.map((kind) => {
    const days = plan.items.filter((i) => i.kind === kind).map((i) => dayOffset(i.at));
    return days.length ? `${kind}:${days.join(",")}` : "";
  }).filter(Boolean);
  return byKind.join(";");
}

export default function RemindersPreview() {
  const params = useLocalSearchParams<{ state?: string; perm?: string; request?: string; analyzed?: string; on?: string; fail?: string }>();
  const { request = "grant", analyzed, on = "", fail } = params;
  const perm = params.perm ?? params.state ?? "undetermined"; // 미리보기 목록의 링크는 `?state=`로 온다
  const [lastSync, setLastSync] = useState<string>("(아직 없음)");
  // 가짜 기기의 상태 — 권한과 저장된 설정 (렌더 밖 콜백에서만 바꾼다)
  const device = useRef({
    permission: permissionOf(perm),
    saved: normalizePrefs(Object.fromEntries(on.split(",").filter(Boolean).map((k) => [k, true]))),
  });

  const service = useMemo<ReminderService>(() => {
    const log = (entry: string) => {
      const g = globalThis as { __offloReminderCalls?: string[] };
      (g.__offloReminderCalls ??= []).push(entry);
    };
    return {
      supported: perm !== "unsupported",
      loadPrefs: async () => ({ ...device.current.saved }),
      savePrefs: async (prefs: ReminderPrefs) => {
        device.current.saved = { ...prefs };
        log(`save ${REMINDER_KINDS.filter((k) => prefs[k]).join(",") || "-"}`);
      },
      getPermission: async () => device.current.permission,
      requestPermission: async () => {
        log("request");
        await sleep(200);
        device.current.permission = request === "deny" ? { state: "denied" } : { state: "granted" };
        return device.current.permission;
      },
      openSettings: () => log("openSettings"),
      sync: async (plan, prefs) => {
        const text = `prefs=${REMINDER_KINDS.filter((k) => prefs[k]).join(",") || "-"} complete=${plan.complete.join(",") || "-"} items=${summarize(plan) || "-"}`;
        log(`sync ${text}`);
        setLastSync(text);
      },
      cancelAll: async () => {
        log("cancelAll");
        setLastSync("(모두 지움)");
      },
    };
  }, [perm, request]);

  const settings = useReminderSettings(service);

  useReminderSync({
    service,
    settings,
    now: () => NOW,
    loadSources: async (needed): Promise<PlanSources> => {
      await sleep(50);
      if (fail === "1") return { analyses: null, goals: null, garden: null };
      return {
        analyses: needed.analyses ? (analyzed === "1" ? [{ id: "a1", periodType: "daily", totalMinutes: 250, detoxScore: 70, isPremium: false, createdAt: new Date(kstAt(TODAY, 1)).toISOString() }] : []) : null,
        goals: needed.goals
          ? [
              { id: "g1", userId: "u", title: "하루 4시간 이하", targetMinutes: 240, startDate: `${addDays(TODAY, -5)}T00:00:00.000Z`, endDate: `${addDays(TODAY, 3)}T00:00:00.000Z`, status: "active", createdAt: "2026-09-01T00:00:00.000Z" },
              { id: "g2", userId: "u", title: "끝낸 목표", targetMinutes: 120, startDate: `${addDays(TODAY, -9)}T00:00:00.000Z`, endDate: `${addDays(TODAY, 2)}T00:00:00.000Z`, status: "completed", createdAt: "2026-09-01T00:00:00.000Z" },
            ]
          : null,
        garden: needed.garden ? { animal: { type: "cat", lastAnalysisDate: addDays(TODAY, -3) } } : null,
      };
    },
  });

  return (
    <Screen testID="reminders-preview">
      <PageHeader eyebrow="미리보기 · 가짜 기기" title="리마인더" />
      <RemindersCard
        supported={settings.supported}
        ready={settings.ready}
        prefs={settings.prefs}
        permission={settings.permission}
        busy={settings.busy}
        error={settings.error}
        onToggle={(kind, next) => void settings.setPref(kind, next)}
        onOpenSettings={settings.openSettings}
      />
      <Card>
        <Text style={styles.label}>예약 결과 (마지막 sync)</Text>
        <Text testID="reminders-plan" style={styles.plan}>
          {lastSync}
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  plan: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textPrimary },
});
