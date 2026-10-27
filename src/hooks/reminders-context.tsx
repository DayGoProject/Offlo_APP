/**
 * 리마인더(로컬 예약 알림)를 앱 전체에서 한 번만 돌린다 — 설정 화면은 여기서 상태를 받아 그리고, 동기화(`use-reminder-sync`)와 알림 탭 이동도 여기서 맡는다.
 *
 * `(app)/_layout.tsx`(로그인한 사람만 들어오는 폴더)가 이 Provider로 감싼다. 로그인한 사용자가 바뀌면 `key`로 새로 만들어 이전 사람의 설정이 섞이지 않고,
 * **로그아웃해서 이 Provider가 사라질 때 우리 예약을 모두 지운다** (다른 사람 · 로그아웃한 기기에 내 목표 제목이 알림으로 뜨면 안 된다).
 * Provider 밖(미리보기 · 로그인 전)에서 `useReminders()`를 불러도 깨지지 않는다 — "쓸 수 없음" 값을 돌려준다.
 */
import { useRouter } from "expo-router";
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";

import { useAuth } from "@/auth-context";
import { useReminderSettings, type ReminderSettings } from "@/hooks/use-reminder-settings";
import { useReminderSync } from "@/hooks/use-reminder-sync";
import { DEFAULT_PREFS, PERMISSION_UNSUPPORTED } from "@/logic/reminders";
import { routeFor } from "@/logic/notifications";
import { loadReminderSources } from "@/services/reminder-data";
import { createReminderService, subscribeReminderTaps } from "@/services/reminders";

const EMPTY: ReminderSettings = {
  supported: false,
  ready: false,
  prefs: DEFAULT_PREFS,
  permission: PERMISSION_UNSUPPORTED,
  busy: false,
  error: null,
  setPref: async () => {},
  refreshPermission: async () => {},
  openSettings: () => {},
};

const Context = createContext<ReminderSettings>(EMPTY);

export const useReminders = (): ReminderSettings => useContext(Context);

function Active({ uid, children }: { uid: string; children: ReactNode }) {
  const router = useRouter();
  const service = useMemo(() => createReminderService(uid), [uid]);
  const settings = useReminderSettings(service);
  useReminderSync({ service, settings, loadSources: (needed) => loadReminderSources(uid, needed) });

  // 알림을 눌러 앱이 열렸다 — 그 알림이 가리키는 화면으로 (아는 경로만 · `routeFor`)
  useEffect(
    () =>
      subscribeReminderTaps((link) => {
        const target = routeFor(link);
        if (!target) return;
        router.navigate(target.params ? { pathname: target.pathname, params: target.params } : { pathname: target.pathname });
      }),
    [router],
  );

  // 로그아웃 · 계정 전환 — 이 사람의 예약을 남기지 않는다
  useEffect(
    () => () => {
      void service.cancelAll();
    },
    [service],
  );

  return <Context.Provider value={settings}>{children}</Context.Provider>;
}

export function RemindersProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <>{children}</>;
  return (
    <Active key={user.uid} uid={user.uid}>
      {children}
    </Active>
  );
}
