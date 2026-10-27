/**
 * 차단한 사용자 — 불러오기와 해제만 여기서, 그리기는 BlockedUsersView가 한다.
 *
 * 차단은 커뮤니티 글 · 댓글의 "신고 · 차단"에서 한다. 여기서는 목록을 보고 푼다.
 * 해제는 같은 요청을 다시 보내도 같아서 재시도하는 요청이다 (`api.blocks.unblock` — idempotent).
 * 푼 뒤에는 커뮤니티 피드가 그 사람의 글을 다시 보이도록 첫 페이지를 다시 읽게 알린다 (`notifyPostsChanged`).
 */
import { useState } from "react";

import BlockedUsersView from "@/components/settings/BlockedUsersView";
import { notifyPostsChanged } from "@/hooks/community-changed";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/services/api";
import { getErrorMessage } from "@/services/api-client";
import type { BlockedUser } from "@/services/api-types";

export default function BlockedScreen() {
  const query = useApiQuery((signal) => api.blocks.list(signal));
  // 푼 사람은 서버가 다시 읽어 주기 전에도 목록에서 바로 뺀다
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());

  const items: BlockedUser[] | null = query.data ? query.data.blocks.filter((b) => !removed.has(b.userId)) : null;

  const unblock = async (user: BlockedUser): Promise<string | null> => {
    try {
      await api.blocks.unblock(user.userId);
    } catch (e) {
      return getErrorMessage(e);
    }
    setRemoved((prev) => new Set(prev).add(user.userId));
    notifyPostsChanged();
    return null;
  };

  return <BlockedUsersView items={items} loading={query.loading} error={query.error} onRetry={query.reload} onUnblock={unblock} />;
}
