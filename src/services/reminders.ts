/**
 * 로컬 예약 알림 — 기기에 알림을 예약한다 (`expo-notifications`). 무엇을 언제 예약할지는 `logic/reminders.ts`가 정하고, 여기서는 **반영만** 한다.
 *
 * 규칙
 *  · `expo-notifications`는 **쓰는 순간 불러온다** — 네이티브 모듈이라 이 모듈을 넣기 전에 만든 개발 빌드에서는 import하는 순간 앱이 죽고, Expo Go에서는 쓸 수 없다 (mobile.md).
 *    불러오지 못하면 `supported: false`로 두고 조용히 넘어간다 — 알림은 장식이라 앱을 막지 않는다.
 *  · **권한은 사용자가 스위치를 켤 때만 묻는다** (앱을 열자마자 묻지 않는다). 안드로이드 13+는 알림 채널이 있어야 권한 창이 뜨므로 채널을 먼저 만든다.
 *  · 예약 식별자는 `offlo-<종류>-…` — **우리 것만** 지우고 갈아 끼운다 (`reminderKindOf`). 정확한 알람 권한(SCHEDULE_EXACT_ALARM)은 쓰지 않는다 —
 *    라이브러리가 그 권한이 없으면 부정확 알람(수 분 늦을 수 있음)으로 걸어 준다. 리마인더에는 충분하다.
 *  · 한 번에 하나씩 반영한다 (`queue`) — 겹쳐 돌면 서로의 예약을 지운다.
 *  · 설정(켠 종류)은 AsyncStorage에 **사용자별로** 둔다 (`offlo_reminders_v1:<uid>`) — 같은 기기에서 계정이 바뀌어도 서로 섞이지 않는다.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Linking, Platform } from "react-native";

import {
  PERMISSION_UNSUPPORTED,
  REMINDER_KINDS,
  linkOf,
  normalizePrefs,
  reminderKindOf,
  DEFAULT_PREFS,
  type Plan,
  type ReminderKind,
  type ReminderPermission,
  type ReminderPrefs,
  type ReminderService,
} from "@/logic/reminders";
import { BRAND } from "@/theme";

import type { NotificationResponse } from "expo-notifications";

type NotificationsModule = typeof import("expo-notifications");

const CHANNEL_ID = "reminders";
const STORAGE_PREFIX = "offlo_reminders_v1:";

let loaded: NotificationsModule | null | undefined;

function load(): NotificationsModule | null {
  if (loaded !== undefined) return loaded;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    loaded = null; // Expo Go — 이 앱의 예약 알림은 개발 빌드에서만 확인한다
    return loaded;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- 정적 import면 모듈이 없는 빌드에서 앱이 뜨지 않는다
    loaded = require("expo-notifications") as NotificationsModule;
  } catch {
    loaded = null;
  }
  return loaded;
}

export const remindersSupported = (): boolean => load() !== null;

let channelReady: Promise<void> | null = null;

/** 안드로이드 알림 채널 — 이것이 있어야 8.0+에서 알림이 뜨고 13+에서 권한 창이 뜬다 */
function ensureChannel(N: NotificationsModule): Promise<void> {
  if (Platform.OS !== "android") return Promise.resolve();
  channelReady ??= N.setNotificationChannelAsync(CHANNEL_ID, {
    name: "리마인더",
    description: "저녁 분석 · 동물 배고픔 · 목표 마감 알림",
    importance: N.AndroidImportance.DEFAULT,
    lightColor: BRAND,
  })
    .then(() => undefined)
    .catch(() => {
      channelReady = null; // 다음에 다시 시도한다
    });
  return channelReady;
}

function toPermission(res: { status: string }): ReminderPermission {
  if (res.status === "granted") return { state: "granted" };
  if (res.status === "denied") return { state: "denied" };
  return { state: "undetermined" };
}

async function getPermission(): Promise<ReminderPermission> {
  const N = load();
  if (!N) return PERMISSION_UNSUPPORTED;
  try {
    return toPermission(await N.getPermissionsAsync());
  } catch {
    return PERMISSION_UNSUPPORTED;
  }
}

async function requestPermission(): Promise<ReminderPermission> {
  const N = load();
  if (!N) return PERMISSION_UNSUPPORTED;
  try {
    await ensureChannel(N);
    return toPermission(await N.requestPermissionsAsync());
  } catch {
    return getPermission();
  }
}

/** 한 번에 하나씩 — 앞의 반영이 끝나야 다음이 시작한다 */
let queue: Promise<unknown> = Promise.resolve();
const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
};

async function ourScheduled(N: NotificationsModule): Promise<{ id: string; kind: ReminderKind }[]> {
  const all = await N.getAllScheduledNotificationsAsync();
  const ours: { id: string; kind: ReminderKind }[] = [];
  for (const n of all) {
    const kind = reminderKindOf(n.identifier);
    if (kind) ours.push({ id: n.identifier, kind });
  }
  return ours;
}

function sync(plan: Plan, prefs: ReminderPrefs): Promise<void> {
  return enqueue(async () => {
    const N = load();
    if (!N) return;
    try {
      await ensureChannel(N);
      // 설정이 꺼진 종류는 지우고, 켜져 있어도 이번에 읽기에 실패한(complete가 아닌) 종류는 기존 예약을 그대로 둔다 — 못 읽은 것을 "알림 없음"으로 착각하지 않는다
      const replace = new Set(REMINDER_KINDS.filter((k) => !prefs[k] || plan.complete.includes(k)));
      for (const { id, kind } of await ourScheduled(N)) {
        if (replace.has(kind)) await N.cancelScheduledNotificationAsync(id);
      }
      for (const item of plan.items) {
        if (!replace.has(item.kind) || !prefs[item.kind]) continue;
        await N.scheduleNotificationAsync({
          identifier: item.id,
          content: { title: item.title, body: item.body, data: { link: item.link }, color: BRAND },
          trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: item.at, channelId: CHANNEL_ID },
        });
      }
    } catch {
      // 예약 실패는 다음 반영(앱을 열 때)에 다시 맞춰진다
    }
  });
}

function cancelAll(): Promise<void> {
  return enqueue(async () => {
    const N = load();
    if (!N) return;
    try {
      for (const { id } of await ourScheduled(N)) await N.cancelScheduledNotificationAsync(id);
    } catch {
      // 무시
    }
  });
}

/** 이 사용자의 리마인더 서비스 — 설정은 사용자별로 저장한다 */
export function createReminderService(uid: string): ReminderService {
  const key = `${STORAGE_PREFIX}${uid}`;
  return {
    supported: remindersSupported(),
    loadPrefs: async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        return raw ? normalizePrefs(JSON.parse(raw)) : { ...DEFAULT_PREFS };
      } catch {
        return { ...DEFAULT_PREFS };
      }
    },
    savePrefs: async (prefs) => {
      try {
        await AsyncStorage.setItem(key, JSON.stringify(prefs));
      } catch {
        // 저장에 실패하면 다음 실행에서 꺼진 것으로 돌아갈 뿐이다
      }
    },
    getPermission,
    requestPermission,
    openSettings: () => {
      void Linking.openSettings().catch(() => {});
    },
    sync,
    cancelAll,
  };
}

/**
 * 알림을 눌러 앱이 열렸을 때 — 갈 곳(`link`)을 알려 준다. 앱이 꺼져 있다가 알림으로 켜진 경우(콜드 스타트)도 받는다.
 * 같은 응답을 두 번 알리지 않는다. 돌려주는 함수로 구독을 끊는다.
 */
export function subscribeReminderTaps(onLink: (link: string) => void): () => void {
  const N = load();
  if (!N) return () => {};
  const handled = new Set<string>();
  const handle = (response: NotificationResponse | null) => {
    if (!response) return;
    const { request, date } = response.notification;
    if (!reminderKindOf(request.identifier)) return; // 우리 예약이 아니면 건드리지 않는다
    const stamp = `${request.identifier}@${date}`;
    if (handled.has(stamp)) return;
    handled.add(stamp);
    const link = linkOf(request.content.data);
    if (link) onLink(link);
  };
  try {
    // 앱이 꺼져 있다가 이 알림으로 켜진 경우 — 마지막 응답을 한 번 읽는다
    handle(N.getLastNotificationResponse());
  } catch {
    // 무시
  }
  const subscription = N.addNotificationResponseReceivedListener(handle);
  return () => subscription.remove();
}
