/**
 * 웹(RN Web)에는 예약 알림이 없다 — `services/reminders.ts`와 같은 모양의 빈 구현이다.
 * 웹 미리보기는 같은 화면을 `app/preview/reminders.tsx`의 가짜 서비스로 그린다.
 */
import { DEFAULT_PREFS, PERMISSION_UNSUPPORTED, type ReminderService } from "@/logic/reminders";

export const remindersSupported = (): boolean => false;

export function createReminderService(_uid: string): ReminderService {
  return {
    supported: false,
    loadPrefs: async () => ({ ...DEFAULT_PREFS }),
    savePrefs: async () => {},
    getPermission: async () => PERMISSION_UNSUPPORTED,
    requestPermission: async () => PERMISSION_UNSUPPORTED,
    openSettings: () => {},
    sync: async () => {},
    cancelAll: async () => {},
  };
}

export function subscribeReminderTaps(_onLink: (link: string) => void): () => void {
  return () => {};
}
