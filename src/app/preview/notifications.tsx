/**
 * 알림 미리보기 — `?state=ready|empty|loading|error` (`&live=1`이면 1.5초 뒤 새 알림이 실시간으로 들어온다 · `&fail=read|all`이면 읽음 요청이 실패한다 ·
 * `&slow=1`이면 서버가 느리다 — 읽음 표시가 응답보다 먼저 보이는지 · 옛 스냅숏이 되돌리지 않는지 확인용).
 * 샘플 값만 쓴다 (api · useAuth · Firebase 금지). 서버는 **화면 안 가짜 서버**다: 실제와 같은 `useNotificationFeed`를 거치고, 읽음이 서버에 반영되면 구독으로 새 목록이 돌아온다.
 */
import { useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { View } from "react-native";

import NotificationBell from "@/components/notifications/NotificationBell";
import NotificationsView from "@/components/notifications/NotificationsView";
import { useNotificationFeed } from "@/hooks/use-notification-feed";
import { routeFor, type NotificationSource } from "@/logic/notifications";
import { NOTIFICATIONS_READY, SAMPLE_NOW } from "@/preview/samples";
import { API_MESSAGES, ApiError } from "@/services/api-client";
import type { NotificationItem } from "@/services/api-types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function NotificationsPreview() {
  const { state = "ready", live, fail = "", slow } = useLocalSearchParams<{ state?: string; live?: string; fail?: string; slow?: string }>();
  const store = useRef<NotificationItem[]>(state === "ready" ? NOTIFICATIONS_READY.map((n) => ({ ...n })) : []);
  const [, setNavigated] = useState<string | null>(null);
  const log = (entry: string) => {
    const g = globalThis as { __offloNotiCalls?: string[] };
    (g.__offloNotiCalls ??= []).push(entry);
  };

  const source = useMemo<NotificationSource>(() => {
    const listeners = new Set<(items: NotificationItem[]) => void>();
    const emit = () => listeners.forEach((l) => l(store.current.map((n) => ({ ...n }))));
    const server = async (entry: string, op: string) => {
      log(entry);
      await sleep(slow === "1" ? 900 : 200);
      if (fail === "all" || fail === op) throw new ApiError("network", API_MESSAGES.network);
    };
    return {
      subscribe(onData, onError) {
        listeners.add(onData);
        const timers: ReturnType<typeof setTimeout>[] = [];
        if (state === "error") timers.push(setTimeout(() => onError(API_MESSAGES.network), 150));
        else if (state !== "loading") timers.push(setTimeout(emit, 150));
        if (live === "1" && state === "ready") {
          timers.push(
            setTimeout(() => {
              store.current = [
                {
                  id: "n-live",
                  type: "badge_earned",
                  title: "새 배지 획득 🏆",
                  body: "'첫 분석' 배지를 얻었어요!",
                  link: "/badges",
                  read: false,
                  createdAt: new Date(SAMPLE_NOW).toISOString(),
                },
                ...store.current,
              ];
              emit();
            }, 1500),
          );
        }
        return () => {
          listeners.delete(onData);
          timers.forEach(clearTimeout);
        };
      },
      markRead: async (id) => {
        await server(`read ${id}`, "read");
        store.current = store.current.map((n) => (n.id === id ? { ...n, read: true } : n));
        emit(); // 서버에 반영되면 구독이 새 목록을 돌려준다
      },
      markAllRead: async () => {
        await server("readAll", "readAll");
        store.current = store.current.map((n) => ({ ...n, read: true }));
        emit();
      },
    };
  }, [state, live, fail, slow]);

  const feed = useNotificationFeed(source);

  return (
    <>
      <NotificationsView
        now={SAMPLE_NOW.getTime()}
        items={feed.items}
        error={feed.error}
        actionError={feed.actionError}
        onRetry={feed.retry}
        onOpen={(item) => {
          void feed.markRead(item.id);
          const target = routeFor(item.link);
          if (!target) return;
          // 미리보기는 화면을 옮기지 않고 가려 했던 곳만 기록한다
          const where = target.params ? `${target.pathname}?post=${target.params.post}` : target.pathname;
          log(`go ${where}`);
          setNavigated(where);
        }}
        onMarkAllRead={() => void feed.markAllRead()}
      />
      {/* 헤더 종의 숫자가 같은 목록을 따라가는지 보는 표식 (화면 밖 · 검증 전용) */}
      <PreviewBell unread={feed.unread} />
    </>
  );
}

function PreviewBell({ unread }: { unread: number }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 8, right: 8, opacity: 0 }}>
      <NotificationBell unread={unread} onPress={() => {}} testID="preview-bell" />
    </View>
  );
}
