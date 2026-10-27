/**
 * 알림 목록 상태 (M8) — 구독 · 낙관적 읽음 · 읽음 실패 되돌리기 · 다시 구독.
 *
 * 서버와 얘기하는 일은 `source`로 받는다 — 실제는 Firestore 실시간 구독 + 웹 API(`services/notifications.ts`), 미리보기는 화면 안 가짜 서버.
 * 그래서 이 파일은 `api` · Firebase를 import하지 않고 웹 미리보기가 같은 규칙(낙관적 갱신 · 되돌리기)을 그대로 거친다 (`use-feed.ts`와 같은 방식).
 *
 * 규칙
 *  · **서버가 진실이다** — 목록은 구독이 주는 값이고, 읽음은 누르는 순간 화면에 먼저 반영한 뒤 서버가 확인해 주면(구독) 그 값이 이어받는다.
 *  · 읽음 표시를 서버에 보낸 뒤 **옛 스냅숏이 와도 안 읽음으로 되돌아가지 않는다** (`pending` + `mergeSnapshot`).
 *  · 읽음 요청이 실패하면 그 알림만 안 읽음으로 되돌리고 한국어로 알린다. 읽음 표시는 두 번 보내도 결과가 같아 `api-client`가 재시도한다 (`idempotent`).
 *  · 구독이 끊기면(오프라인 · 권한) 마지막 목록은 남기고 에러만 띄운다 — `retry()`가 다시 구독한다.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import {
  applyRead,
  applyReadAll,
  mergeSnapshot,
  revertRead,
  unreadCount,
  type NotificationSource,
} from "@/logic/notifications";
import { getErrorMessage } from "@/services/api-client";
import type { NotificationItem } from "@/services/api-types";

export interface NotificationFeed {
  /** 아직 못 받았으면 null */
  items: NotificationItem[] | null;
  unread: number;
  /** 구독 에러 (한국어) — 목록이 이미 있으면 그대로 두고 알린다 */
  error: string | null;
  /** 읽음 처리 실패 (한국어) */
  actionError: string | null;
  loading: boolean;
  retry: () => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export function useNotificationFeed(source: NotificationSource | null): NotificationFeed {
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // 읽음으로 보냈지만 서버 값이 아직 안 돌아온 id들 · 최신 목록 · 최신 출처 — 비동기 응답이 항상 최신 값을 본다
  const pending = useRef(new Set<string>());
  const itemsRef = useRef<NotificationItem[] | null>(null);
  const sourceRef = useRef(source);
  useEffect(() => {
    itemsRef.current = items;
    sourceRef.current = source;
  });

  useEffect(() => {
    if (!source) return;
    return source.subscribe(
      (incoming) => {
        const merged = mergeSnapshot(incoming, pending.current);
        pending.current = merged.pending;
        setItems(merged.items);
        setError(null);
      },
      (message) => setError(message),
    );
  }, [source, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  const markRead = useCallback(async (id: string) => {
    const current = itemsRef.current?.find((n) => n.id === id);
    const s = sourceRef.current;
    if (!s || !current || current.read || pending.current.has(id)) return; // 이미 읽음 · 보내는 중이면 다시 보내지 않는다
    setActionError(null);
    pending.current.add(id);
    setItems((prev) => (prev ? applyRead(prev, id) : prev));
    try {
      await s.markRead(id);
    } catch (e) {
      pending.current.delete(id);
      setItems((prev) => (prev ? revertRead(prev, new Set([id])) : prev));
      setActionError(getErrorMessage(e));
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const s = sourceRef.current;
    const unread = (itemsRef.current ?? []).filter((n) => !n.read).map((n) => n.id);
    if (!s || unread.length === 0) return;
    setActionError(null);
    for (const id of unread) pending.current.add(id);
    setItems((prev) => (prev ? applyReadAll(prev) : prev));
    try {
      await s.markAllRead();
    } catch (e) {
      const ids = new Set(unread);
      for (const id of ids) pending.current.delete(id);
      setItems((prev) => (prev ? revertRead(prev, ids) : prev));
      setActionError(getErrorMessage(e));
    }
  }, []);

  return {
    items,
    unread: items ? unreadCount(items) : 0,
    error,
    actionError,
    loading: items === null && error === null,
    retry,
    markRead,
    markAllRead,
  };
}
