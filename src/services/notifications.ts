/**
 * 알림 출처 (M8) — Firestore `users/{uid}/notifications` 실시간 구독 + 읽음 표시는 웹 API.
 *
 * **Firestore는 읽기만 한다** (security.md). 알림 문서는 서버(Admin SDK)만 만들고, 읽음 표시(`read: true`)도 `api.notifications.*`로 보낸다 —
 * 보안 규칙이 클라이언트의 `read` 갱신을 허용하더라도 앱은 쓰지 않는다 (정원과 같은 규칙).
 * 구독 에러는 `readGarden`과 같은 한국어 안내로 바꾼다 (SDK 로그는 꺼 둔다 — `firebase.ts`).
 */
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";

import { NOTIFICATION_LIMIT, normalizeNotification, sortNotifications, type NotificationSource } from "@/logic/notifications";
import { api } from "@/services/api";
import { API_MESSAGES } from "@/services/api-client";
import type { NotificationItem } from "@/services/api-types";
import { db } from "@/services/firebase";

function subscribeMessage(e: unknown): string {
  const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
  if (code === "unavailable") return API_MESSAGES.network;
  if (code === "permission-denied") return "알림을 읽을 권한이 없습니다.";
  return code ? `${API_MESSAGES.unknown} (firestore/${code})` : API_MESSAGES.unknown;
}

export function notificationSource(uid: string): NotificationSource {
  return {
    subscribe(onData, onError) {
      const q = query(collection(db, "users", uid, "notifications"), orderBy("createdAt", "desc"), limit(NOTIFICATION_LIMIT));
      return onSnapshot(
        q,
        (snap) => {
          const items = snap.docs.map((d) => normalizeNotification(d.id, d.data())).filter((n): n is NotificationItem => n !== null);
          onData(sortNotifications(items));
        },
        (e) => onError(subscribeMessage(e)),
      );
    },
    markRead: (id) => api.notifications.markRead(id),
    markAllRead: () => api.notifications.markAllRead(),
  };
}
