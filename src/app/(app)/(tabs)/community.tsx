/**
 * 커뮤니티 탭 — 불러오기와 저장만 여기서, 그리기는 CommunityView가 한다.
 *
 * 피드 상태(첫 페이지 · 다음 페이지 · 낙관적 좋아요 · 댓글)는 `useFeed`가, 서버 호출은 아래 `server`가 한다 (`api.community.*`만 쓴다).
 * 이름 공개 안내는 한 번 닫으면 다시 안 뜬다 (AsyncStorage — 읽기 · 쓰기 실패는 무시한다: 안내가 한 번 더 뜰 뿐이다).
 * 배지를 자랑하면(`notifyPostsChanged`) 새 글이 맨 위에 오도록 첫 페이지를 다시 읽는다. 알림 링크 `?post=<id>`는 그 글을 강조한다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useLocalSearchParams } from "expo-router";

import { useAuth } from "@/auth-context";
import CommunityView, { type CommunityMode } from "@/components/community/CommunityView";
import { usePostsChanged } from "@/hooks/community-changed";
import { useApiQuery } from "@/hooks/use-api-query";
import { useFeed, type FeedServer } from "@/hooks/use-feed";
import { NOTICE_KEY } from "@/logic/community";
import { api } from "@/services/api";

const server: FeedServer = {
  page: (cursor) => api.community.feed(cursor),
  createPost: (content) => api.community.createPost(content),
  like: (postId) => api.community.toggleLike(postId),
  deletePost: (postId) => api.community.deletePost(postId),
  comments: (postId) => api.community.comments(postId),
  addComment: (postId, content) => api.community.createComment(postId, content),
  deleteComment: (commentId) => api.community.deleteComment(commentId),
};

export default function CommunityTab() {
  const { user } = useAuth();
  const { post: highlightId } = useLocalSearchParams<{ post?: string }>();
  const [mode, setMode] = useState<CommunityMode>("feed");
  const [now, setNow] = useState(() => Date.now());

  const feed = useFeed(server);
  const ranking = useApiQuery((signal) => api.community.ranking(signal));
  usePostsChanged(feed.reload);

  // 탭에 돌아올 때마다 "n분 전"을 새로 센다 (글은 당겨서 새로고침으로 다시 읽는다 — 읽던 자리를 잃지 않게)
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
    }, []),
  );

  const [showNotice, setShowNotice] = useState(false);
  const noticeRead = useRef(false);
  useEffect(() => {
    if (noticeRead.current) return;
    noticeRead.current = true;
    AsyncStorage.getItem(NOTICE_KEY)
      .then((value) => setShowNotice(value !== "1"))
      .catch(() => setShowNotice(true));
  }, []);
  const dismissNotice = () => {
    setShowNotice(false);
    AsyncStorage.setItem(NOTICE_KEY, "1").catch(() => {});
  };

  const reloadRanking = ranking.reload;
  const refreshFeed = feed.refresh;
  const onRefresh = () => {
    setNow(Date.now());
    if (mode === "ranking") reloadRanking();
    else refreshFeed();
  };

  return (
    <CommunityView
      now={now}
      myName={user?.displayName ?? user?.email ?? ""}
      mode={mode}
      onModeChange={setMode}
      posts={feed.posts}
      hasMore={feed.hasMore}
      loading={feed.loading}
      refreshing={mode === "feed" ? feed.refreshing : ranking.loading && ranking.data !== null}
      loadingMore={feed.loadingMore}
      error={feed.error}
      moreError={feed.moreError}
      onRefresh={onRefresh}
      onLoadMore={feed.loadMore}
      onPost={feed.post}
      showNotice={showNotice}
      onDismissNotice={dismissNotice}
      highlightId={highlightId ?? null}
      actions={feed.actions}
      ranking={{ data: ranking.data, error: ranking.error, onRetry: reloadRanking }}
    />
  );
}
