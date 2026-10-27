/**
 * 차단한 사용자 화면의 그림 — 데이터는 props로만 받는다 (mobile.md "웹 미리보기 — 미리보기 화면").
 * `app/(app)/blocked.tsx`는 불러오기 · 해제를, `app/preview/blocked.tsx`는 샘플 값 + 가짜 서버를 넘긴다. 이 파일은 `api` · `useAuth` · Firebase를 import하지 않는다.
 *
 * 커뮤니티 글 · 댓글의 "신고 · 차단"으로 차단한 사람 목록이다 (Play UGC 정책 — 차단은 풀 수도 있어야 한다).
 * 해제는 되돌려도 되는 일(다시 차단하면 된다)이라 한 번 누르면 바로 풀린다. 한 번에 한 사람씩 — 보내는 중에는 다른 버튼도 잠근다.
 */
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import Card from "@/components/app/Card";
import ErrorNotice from "@/components/app/ErrorNotice";
import PageHeader from "@/components/app/PageHeader";
import Pill from "@/components/app/Pill";
import Screen from "@/components/app/Screen";
import Skeleton from "@/components/app/Skeleton";
import Avatar from "@/components/community/Avatar";
import { BLOCKED_EMPTY } from "@/logic/moderation";
import type { BlockedUser } from "@/services/api-types";
import { fmtDate } from "@/shared/format";
import { colors, fonts, radius } from "@/theme";

export interface BlockedUsersViewProps {
  /** 못 불러왔거나 처음 불러오는 중이면 null */
  items: BlockedUser[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** 차단 해제 — 실패하면 문구, 성공하면 null (부모가 목록에서 뺀다) */
  onUnblock: (user: BlockedUser) => Promise<string | null>;
}

export default function BlockedUsersView({ items, loading, error, onRetry, onUnblock }: BlockedUsersViewProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ id: string; message: string } | null>(null);

  async function unblock(user: BlockedUser) {
    if (busyId) return;
    setBusyId(user.userId);
    setFailed(null);
    try {
      const message = await onUnblock(user);
      if (message) setFailed({ id: user.userId, message });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen testID="blocked" refreshing={loading && items !== null} onRefresh={onRetry}>
      <PageHeader eyebrow={items ? `차단 ${items.length}명` : "불러오는 중"} title="차단한 사용자" />

      {error ? <ErrorNotice testID="blocked-error" message={error} onRetry={onRetry} /> : null}

      {items === null ? (
        error ? null : (
          <View testID="blocked-skeleton" style={styles.skeletons}>
            <Skeleton height={72} radius={radius.card} />
            <Skeleton height={72} radius={radius.card} />
          </View>
        )
      ) : items.length === 0 ? (
        <Card testID="blocked-empty">
          <Text style={styles.emptyBody}>{BLOCKED_EMPTY}</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {items.map((user) => (
            <Card key={user.userId} testID={`blocked-${user.userId}`}>
              <View style={styles.row}>
                <Avatar name={user.name} size={36} />
                <View style={styles.text}>
                  <Text numberOfLines={1} style={styles.name}>
                    {user.name}
                  </Text>
                  {user.createdAt ? (
                    <Text style={styles.date}>
                      <Text style={styles.num}>{fmtDate(user.createdAt)}</Text>
                      {" 차단"}
                    </Text>
                  ) : null}
                </View>
                <Pill
                  testID={`unblock-${user.userId}`}
                  label={busyId === user.userId ? "푸는 중…" : "차단 해제"}
                  disabled={busyId !== null}
                  onPress={() => void unblock(user)}
                />
              </View>
              {failed?.id === user.userId ? (
                <Text testID={`unblock-error-${user.userId}`} accessibilityRole="alert" style={styles.error}>
                  {failed.message}
                </Text>
              ) : null}
            </Card>
          ))}
          <Text style={styles.foot}>차단을 풀면 그 사람의 글 · 댓글이 다시 보여요. 상대에게는 알리지 않아요.</Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  skeletons: {
    gap: 14,
  },
  list: {
    gap: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  date: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textMuted,
  },
  num: {
    fontFamily: fonts.num,
    fontVariant: ["tabular-nums"],
  },
  emptyBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 21,
    color: colors.textMuted,
  },
  foot: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 19,
    color: colors.textGhost,
  },
  error: {
    paddingTop: 10,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.danger,
  },
});
