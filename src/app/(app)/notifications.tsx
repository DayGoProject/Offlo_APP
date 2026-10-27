/**
 * 알림 — 앱 전체가 구독해 둔 목록(`NotificationsProvider`)을 보여 주고, 한 줄을 누르면 읽음 처리 + (갈 곳이 있으면) 그 화면으로 간다.
 *
 * 화면은 목록을 불러오지 않는다 — 로그인하는 순간부터 Firestore 구독이 돌고 있어 이 화면을 열면 이미 있다 (더보기 탭의 숫자 · 홈의 종이 같은 값을 본다).
 * 읽음 표시는 두 번 가도 결과가 같은 요청이라 실패하면 그 알림만 안 읽음으로 되돌리고 안내한다 (`use-notification-feed`).
 * 알림의 `link`는 서버가 쓴 **웹 주소**라 `routeFor`가 아는 경로만 앱 화면으로 바꾼다 — 모르는 것은 읽음 처리만 하고 움직이지 않는다.
 */
import { useState } from "react";
import { useRouter } from "expo-router";

import NotificationsView from "@/components/notifications/NotificationsView";
import { useNotifications } from "@/hooks/notifications-context";
import { routeFor } from "@/logic/notifications";
import type { NotificationItem } from "@/services/api-types";

export default function NotificationsScreen() {
  const router = useRouter();
  const feed = useNotifications();
  // 화면을 연 시각 기준으로 "n분 전"을 센다
  const [now] = useState(() => Date.now());

  const open = (item: NotificationItem) => {
    void feed.markRead(item.id);
    const target = routeFor(item.link);
    if (!target) return;
    router.navigate(target.params ? { pathname: target.pathname, params: target.params } : { pathname: target.pathname });
  };

  return (
    <NotificationsView
      now={now}
      items={feed.items}
      error={feed.error}
      actionError={feed.actionError}
      onRetry={feed.retry}
      onOpen={open}
      onMarkAllRead={() => void feed.markAllRead()}
      onOpenReminders={() => router.push("/settings")}
    />
  );
}
