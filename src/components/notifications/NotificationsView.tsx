/**
 * 알림 화면의 그림 — 데이터는 props로만 받는다 (mobile.md "웹 미리보기 — 미리보기 화면").
 * `app/(app)/notifications.tsx`는 앱 전체가 구독해 둔 목록을, `app/preview/notifications.tsx`는 샘플 + 가짜 서버를 넘긴다. 이 파일은 `api` · `useAuth` · Firebase를 import하지 않는다.
 *
 * 최근 50건을 한 장의 카드 안 줄로 보여 준다 (50건이 상한이라 `Screen`의 스크롤로 충분하다). 안 읽은 줄은 옅은 그린 바탕 + 점, 누르면 읽음으로 바뀌고
 * 갈 곳이 있는 알림(`link` — 앱이 아는 화면)은 그 화면으로 간다. 갈 곳이 없는 알림은 읽음 처리만 된다.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import Card from "@/components/app/Card";
import ErrorNotice from "@/components/app/ErrorNotice";
import PageHeader from "@/components/app/PageHeader";
import Pill from "@/components/app/Pill";
import Screen from "@/components/app/Screen";
import Skeleton from "@/components/app/Skeleton";
import { relativeTime } from "@/logic/community";
import { notificationsEyebrow, routeFor, unreadCount } from "@/logic/notifications";
import type { NotificationItem } from "@/services/api-types";
import { colors, fonts, radius } from "@/theme";

export interface NotificationsViewProps {
  /** 기준 시각(ms) — 상대 시간 */
  now: number;
  /** 아직 못 받았으면 null */
  items: NotificationItem[] | null;
  /** 구독 에러 (한국어) — 목록이 있으면 위에 알리고 그대로 둔다 */
  error: string | null;
  /** 읽음 처리 실패 (한국어) */
  actionError: string | null;
  onRetry: () => void;
  /** 한 줄을 눌렀다 — 읽음 처리와 화면 이동은 부모가 한다 */
  onOpen: (item: NotificationItem) => void;
  onMarkAllRead: () => void;
  /** 리마인더(예약 알림) 설정으로 — 안 주면 안내 줄을 그리지 않는다 */
  onOpenReminders?: () => void;
}

export default function NotificationsView({ now, items, error, actionError, onRetry, onOpen, onMarkAllRead, onOpenReminders }: NotificationsViewProps) {
  const unread = items ? unreadCount(items) : 0;

  return (
    <Screen testID="notifications" refreshing={false} onRefresh={onRetry}>
      <PageHeader
        eyebrow={notificationsEyebrow(items)}
        title="알림"
        actions={<Pill testID="notifications-read-all" label="모두 읽음" onPress={onMarkAllRead} disabled={unread === 0} />}
      />

      {error ? <ErrorNotice testID="notifications-error" message={error} onRetry={onRetry} /> : null}
      {actionError ? <ErrorNotice testID="notifications-action-error" message={actionError} /> : null}

      {!items ? (
        error ? null : (
          <View testID="notifications-skeleton" style={styles.skeletons}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={74} radius={radius.card} />
            ))}
          </View>
        )
      ) : items.length === 0 ? (
        <Card testID="notifications-empty">
          <View style={styles.emptyText}>
            <Text style={styles.emptyTitle}>아직 알림이 없어요</Text>
            <Text style={styles.emptyBody}>배지를 받거나 식물이 자라거나 내 글에 댓글이 달리면 여기서 알려 드려요.</Text>
          </View>
        </Card>
      ) : (
        <Card testID="notifications-list" style={styles.listCard}>
          {items.map((item, i) => (
            <Row key={item.id} item={item} now={now} last={i === items.length - 1} onOpen={onOpen} />
          ))}
        </Card>
      )}

      {onOpenReminders && items ? (
        <Pressable
          testID="notifications-reminders-link"
          accessibilityRole="link"
          onPress={onOpenReminders}
          style={({ pressed }) => [styles.reminders, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={styles.remindersLabel}>리마인더 알림 설정</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

function Row({ item, now, last, onOpen }: { item: NotificationItem; now: number; last: boolean; onOpen: (item: NotificationItem) => void }) {
  const time = relativeTime(item.createdAt, now);
  const goes = routeFor(item.link) !== null;
  return (
    <Pressable
      testID={`notification-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${item.read ? "" : "읽지 않음. "}${item.title}. ${item.body}${time ? `. ${time}` : ""}`}
      onPress={() => onOpen(item)}
      style={({ pressed }) => [styles.row, !item.read && styles.rowUnread, !last && styles.divider, { opacity: pressed ? 0.75 : 1 }]}
    >
      <View testID={`notification-dot-${item.id}`} style={[styles.dot, item.read ? styles.dotOff : styles.dotOn]} />
      <View style={styles.text}>
        {item.title ? (
          <Text style={[styles.title, item.read && styles.titleRead]} numberOfLines={2}>
            {item.title}
          </Text>
        ) : null}
        {item.body ? (
          <Text style={[styles.body, item.read && styles.bodyRead]} numberOfLines={3}>
            {item.body}
          </Text>
        ) : null}
        {time ? <Text style={styles.time}>{time}</Text> : null}
      </View>
      {goes ? <Text style={styles.chevron}>›</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  skeletons: {
    gap: 12,
  },
  emptyText: {
    gap: 6,
  },
  emptyTitle: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  emptyBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 21,
    color: colors.textMuted,
  },
  listCard: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    gap: 0,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    minHeight: 64,
  },
  rowUnread: {
    backgroundColor: colors.accentFaint,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderCard,
  },
  dot: {
    width: 7,
    height: 7,
    marginTop: 7,
    borderRadius: 4,
  },
  dotOn: {
    backgroundColor: colors.brand,
  },
  dotOff: {
    backgroundColor: "transparent",
  },
  text: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  titleRead: {
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textPrimarySoft,
  },
  bodyRead: {
    color: colors.textMuted,
  },
  time: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textFaint,
  },
  reminders: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  remindersLabel: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  chevron: {
    alignSelf: "center",
    fontFamily: fonts.regular,
    fontSize: 20,
    color: colors.textMuted,
  },
});
