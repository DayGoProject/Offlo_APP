/**
 * 커뮤니티 피드 상태 (M7 7-3) — 첫 페이지 · 새로고침 · 다음 페이지(커서) · 글 올리기 · 좋아요(낙관적) · 댓글 · 삭제.
 *
 * 서버와 얘기하는 일은 `server`로 받는다 — 실제 화면은 `api.community.*`를, 미리보기는 화면 안 가짜 서버를 넘기므로
 * 이 파일은 `api` · Firebase를 import하지 않는다 (낙관적 갱신 · 되돌리기 규칙을 웹 미리보기가 똑같이 거친다).
 *
 * 규칙
 *  · **서버가 진실이다** — 좋아요는 누르는 순간 화면에 먼저 반영하고, 응답이 오면 서버가 돌려준 값으로 덮어쓴다. 실패하면 누르기 전 값으로 되돌린다.
 *  · 좋아요 · 글 · 댓글 쓰기는 두 번 가면 두 번 반영된다 — 자동 재시도하지 않는다 (`api-client`가 알아서). 실패는 카드 안에 한국어로 띄운다.
 *  · 새로고침 도중에 온 다음 페이지 응답은 버린다 (세대 번호) — 새 첫 페이지 위에 옛 페이지가 붙지 않는다.
 *  · 글을 올리면 첫 페이지를 조용히 다시 읽는다 (새 글이 맨 위에 오도록 · 스켈레톤 없이).
 */
import { useCallback, useEffect, useRef, useState } from "react";

import type { PostActions } from "@/components/community/PostCard";
import { appendPage, commentCountAfter, likeOptimistic, patchPost, removePost } from "@/logic/community";
import { getErrorMessage } from "@/services/api-client";
import type { FeedComment, FeedPost } from "@/services/api-types";

export interface FeedServer {
  page: (cursor: string | null) => Promise<{ posts: FeedPost[]; nextCursor: string | null }>;
  createPost: (content: string) => Promise<unknown>;
  like: (postId: string) => Promise<{ liked: boolean; likeCount: number }>;
  deletePost: (postId: string) => Promise<unknown>;
  comments: (postId: string) => Promise<{ comments: FeedComment[] }>;
  addComment: (postId: string, content: string) => Promise<{ comment: FeedComment }>;
  deleteComment: (commentId: string) => Promise<unknown>;
}

export function useFeed(server: FeedServer) {
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);

  // 최신 서버 어댑터 · 세대 번호 — 비동기 응답이 항상 최신 값을 본다
  const latest = useRef({ server, cursor, loadingMore });
  useEffect(() => {
    latest.current = { server, cursor, loadingMore };
  });
  const generation = useRef(0);

  /** 첫 페이지를 읽어 목록을 갈아 끼운다 — 세대 번호가 바뀌었으면(그 사이 또 새로고침했다) 응답을 버린다 */
  const fetchFirst = useCallback(async (gen: number) => {
    try {
      const res = await latest.current.server.page(null);
      if (gen !== generation.current) return;
      setPosts(res.posts);
      setCursor(res.nextCursor);
      setError(null);
    } catch (e) {
      // 이전에 읽은 글은 남긴다 — 새로고침이 실패해도 화면이 비지 않게
      if (gen === generation.current) setError(getErrorMessage(e));
    } finally {
      if (gen === generation.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  /** `pull`은 당겨서 새로고침 표시를, `quiet`는 표시 없이 (글을 올린 뒤) */
  const refresh = useCallback(
    (mode: "pull" | "quiet" = "pull") => {
      const gen = ++generation.current;
      if (mode === "pull") setRefreshing(true);
      setMoreError(null);
      return fetchFirst(gen);
    },
    [fetchFirst],
  );

  // 처음 한 번 — 로딩 표시는 처음부터 켜져 있다 (효과 안에서 setState를 먼저 부르지 않는다)
  useEffect(() => {
    void fetchFirst(++generation.current);
  }, [fetchFirst]);

  const loadMore = useCallback(async () => {
    const { cursor: next, loadingMore: busy, server: s } = latest.current;
    if (!next || busy) return;
    const gen = generation.current;
    latest.current.loadingMore = true;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const res = await s.page(next);
      if (gen !== generation.current) return;
      setPosts((prev) => appendPage(prev ?? [], res.posts));
      setCursor(res.nextCursor);
    } catch (e) {
      if (gen === generation.current) setMoreError(getErrorMessage(e));
    } finally {
      latest.current.loadingMore = false;
      setLoadingMore(false);
    }
  }, []);

  const post = useCallback(
    async (text: string): Promise<string | null> => {
      try {
        await latest.current.server.createPost(text);
      } catch (e) {
        return getErrorMessage(e);
      }
      await refresh("quiet");
      return null;
    },
    [refresh],
  );

  const patch = useCallback((id: string, change: Partial<FeedPost>) => setPosts((prev) => (prev ? patchPost(prev, id, change) : prev)), []);

  const actions: PostActions = {
    async like(target) {
      const before = { liked: target.liked, likeCount: target.likeCount };
      patch(target.id, likeOptimistic(target));
      try {
        const res = await latest.current.server.like(target.id);
        patch(target.id, { liked: res.liked, likeCount: res.likeCount });
        return null;
      } catch (e) {
        patch(target.id, before);
        return getErrorMessage(e);
      }
    },
    async remove(target) {
      try {
        await latest.current.server.deletePost(target.id);
        setPosts((prev) => (prev ? removePost(prev, target.id) : prev));
        return null;
      } catch (e) {
        return getErrorMessage(e);
      }
    },
    async comments(target) {
      try {
        const res = await latest.current.server.comments(target.id);
        return { ok: true, comments: res.comments };
      } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
      }
    },
    async addComment(target, text) {
      try {
        const res = await latest.current.server.addComment(target.id, text);
        setPosts((prev) => prev?.map((p) => (p.id === target.id ? { ...p, commentCount: commentCountAfter(p.commentCount, 1) } : p)) ?? prev);
        return { ok: true, comment: res.comment };
      } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
      }
    },
    async removeComment(target, comment) {
      try {
        await latest.current.server.deleteComment(comment.id);
        setPosts((prev) => prev?.map((p) => (p.id === target.id ? { ...p, commentCount: commentCountAfter(p.commentCount, -1) } : p)) ?? prev);
        return null;
      } catch (e) {
        return getErrorMessage(e);
      }
    },
  };

  return {
    posts,
    hasMore: cursor !== null,
    loading,
    refreshing,
    loadingMore,
    error,
    moreError,
    /** 당겨서 새로고침 */
    refresh: () => void refresh("pull"),
    /** 표시 없이 첫 페이지를 다시 읽는다 — 다른 화면에서 글이 생겼을 때 */
    reload: () => void refresh("quiet"),
    loadMore: () => void loadMore(),
    post,
    actions,
  };
}
