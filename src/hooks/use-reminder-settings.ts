/**
 * 리마인더 설정 상태 — 켠 종류 · 알림 권한 · 켜는 중 표시. 기기 쪽 일은 `ReminderService`가 하므로 미리보기도 같은 훅을 쓴다 (`app/preview/reminders.tsx`의 가짜 서비스).
 *
 * 스위치를 **켤 때만** 시스템 알림 권한을 묻는다 — 앱을 열자마자 묻지 않는다. 권한이 거절되면 스위치는 켜지지 않고 안내를 띄운다
 * (거절하면 "기기 설정 열기" 버튼이 따라온다). **허용 전이면 항상 요청하고 결과로 판단한다** — 시스템이 더는 창을 못 띄우는 상태(두 번 거절 등)면 창 없이 곧바로 거절이 돌아온다.
 * 끄는 것은 언제나 된다. 저장은 사용자별 AsyncStorage (서비스).
 */
import { useCallback, useEffect, useRef, useState } from "react";

import {
  DEFAULT_PREFS,
  PERMISSION_UNSUPPORTED,
  type ReminderKind,
  type ReminderPermission,
  type ReminderPrefs,
  type ReminderService,
} from "@/logic/reminders";

export const REMINDER_MESSAGES = {
  unsupported: "이 환경에서는 예약 알림을 쓸 수 없어요. 앱을 설치한 기기에서 켤 수 있어요.",
  denied: "기기에서 Offlo 알림이 꺼져 있어요. 기기 설정에서 알림을 허용해 주세요.",
} as const;

export interface ReminderSettings {
  supported: boolean;
  /** 저장된 설정 · 권한을 읽었는가 */
  ready: boolean;
  prefs: ReminderPrefs;
  permission: ReminderPermission;
  busy: boolean;
  error: string | null;
  setPref: (kind: ReminderKind, on: boolean) => Promise<void>;
  /** 앱으로 돌아왔을 때 — 사용자가 기기 설정에서 권한을 바꿨을 수 있다 */
  refreshPermission: () => Promise<void>;
  openSettings: () => void;
}

export function useReminderSettings(service: ReminderService | null): ReminderSettings {
  const [prefs, setPrefs] = useState<ReminderPrefs>(DEFAULT_PREFS);
  const [permission, setPermission] = useState<ReminderPermission>(PERMISSION_UNSUPPORTED);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prefsRef = useRef(prefs);
  const permissionRef = useRef(permission);
  const busyRef = useRef(false);
  const serviceRef = useRef(service);
  useEffect(() => {
    prefsRef.current = prefs;
    permissionRef.current = permission;
    serviceRef.current = service;
  });

  useEffect(() => {
    if (!service) return;
    let alive = true;
    Promise.all([service.loadPrefs(), service.getPermission()]).then(([loadedPrefs, loadedPermission]) => {
      if (!alive) return;
      setPrefs(loadedPrefs);
      setPermission(loadedPermission);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [service]);

  const refreshPermission = useCallback(async () => {
    const svc = serviceRef.current;
    if (!svc) return;
    const next = await svc.getPermission();
    setPermission((prev) => (prev.state === next.state ? prev : next));
  }, []);

  const setPref = useCallback(async (kind: ReminderKind, on: boolean) => {
    const svc = serviceRef.current;
    if (!svc || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      if (on) {
        let current = permissionRef.current;
        if (current.state === "unsupported") {
          setError(REMINDER_MESSAGES.unsupported);
          return;
        }
        if (current.state !== "granted") {
          // 시스템 창을 띄운다 — 더는 못 띄우는 상태(두 번 거절 등)면 창 없이 곧바로 거절이 돌아온다 (라이브러리의 canAskAgain은 안드로이드에서 어긋날 수 있어 믿지 않는다)
          current = await svc.requestPermission();
          setPermission(current);
          if (current.state !== "granted") {
            setError(REMINDER_MESSAGES.denied);
            return;
          }
        }
      }
      const next = { ...prefsRef.current, [kind]: on };
      prefsRef.current = next;
      setPrefs(next);
      await svc.savePrefs(next);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const openSettings = useCallback(() => serviceRef.current?.openSettings(), []);

  return { supported: service?.supported ?? false, ready, prefs, permission, busy, error, setPref, refreshPermission, openSettings };
}
