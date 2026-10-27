/**
 * 알림 목록을 앱 전체에서 한 번만 구독해 나눠 쓴다 — 더보기 탭의 숫자 · 홈의 종 · 알림 화면이 같은 값을 본다.
 *
 * `(app)/_layout.tsx`(로그인한 사람만 들어오는 폴더)가 이 Provider로 감싼다. 로그인한 사용자가 바뀌면 `key`로 새로 만들어 이전 사람의 알림이 남지 않는다.
 * Provider 밖(미리보기 · 로그인 전)에서 `useNotifications()`를 불러도 깨지지 않는다 — 빈 값을 돌려준다.
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useAuth } from "@/auth-context";
import { useNotificationFeed, type NotificationFeed } from "@/hooks/use-notification-feed";
import { notificationSource } from "@/services/notifications";

const EMPTY: NotificationFeed = {
  items: null,
  unread: 0,
  error: null,
  actionError: null,
  loading: false,
  retry: () => {},
  markRead: async () => {},
  markAllRead: async () => {},
};

const Context = createContext<NotificationFeed>(EMPTY);

export const useNotifications = (): NotificationFeed => useContext(Context);

function Subscribed({ uid, children }: { uid: string; children: ReactNode }) {
  const source = useMemo(() => notificationSource(uid), [uid]);
  const feed = useNotificationFeed(source);
  return <Context.Provider value={feed}>{children}</Context.Provider>;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <>{children}</>;
  return (
    <Subscribed key={user.uid} uid={user.uid}>
      {children}
    </Subscribed>
  );
}
