/**
 * 커뮤니티 미리보기 — `?state=ready|empty|loading|error|ranking|ranking-outside|ranking-empty|ranking-loading|ranking-error`
 * (`&notice=0`이면 이름 공개 안내를 닫아 둔다 · `&highlight=p-03`이면 그 글을 강조한다 ·
 *  `&fail=like|post|comments|add|more|refresh|report|block|all`이면 그 서버 호출이 실패한다 · `&slow=1`이면 서버가 느리다 — 화면은 실제와 같은 `useFeed`를 거친다 ·
 *  `&rules=ask`이면 이용 규칙에 아직 동의하지 않은 상태로 시작한다 — 글 · 댓글을 쓰려는 순간 규칙 창이 뜬다 (기본은 이미 동의한 상태 — 다른 검증이 규칙 창에 막히지 않게)).
 * 샘플 값만 쓴다 (api · useAuth 금지). 서버는 **화면 안 가짜 서버**다: 글 25개를 10개씩 커서로 돌려주고, 좋아요 · 글쓰기 · 댓글 · 삭제 ·
 * **신고(그 글 · 댓글이 이후 읽기에서 빠진다) · 차단(그 작성자의 글 · 댓글이 모두 빠진다)** 이 실제처럼 동작한다. 호출 기록은 `globalThis.__offloFeedCalls`.
 */
import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";

import CommunityView, { type CommunityMode } from "@/components/community/CommunityView";
import { useCommunityRules } from "@/hooks/use-community-rules";
import { useFeed, type FeedServer } from "@/hooks/use-feed";
import { COMMUNITY_COMMENTS, COMMUNITY_POSTS, RANKING_EMPTY, RANKING_OUTSIDE, RANKING_READY, SAMPLE_NOW } from "@/preview/samples";
import { API_MESSAGES, ApiError } from "@/services/api-client";
import type { FeedComment, FeedPost } from "@/services/api-types";
import type { RulesStore } from "@/services/community-rules";

const noop = () => {};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PAGE = 10;

export default function CommunityPreview() {
  const {
    state = "ready",
    notice,
    highlight,
    fail = "",
    slow,
    rules: rulesParam,
  } = useLocalSearchParams<{ state?: string; notice?: string; highlight?: string; fail?: string; slow?: string; rules?: string }>();
  const [mode, setMode] = useState<CommunityMode>(state.startsWith("ranking") ? "ranking" : "feed");
  const [showNotice, setShowNotice] = useState(notice !== "0");

  // 가짜 서버의 저장소 — 화면이 다시 그려져도 유지된다
  const db = useRef<{
    posts: FeedPost[];
    comments: Record<string, FeedComment[]>;
    seq: number;
    /** 신고한 대상 ("post:p-01" · "comment:c-1") — 이후 읽기에서 빠진다 */
    reported: Set<string>;
    /** 차단한 작성자 이름 — 그 사람의 글 · 댓글이 이후 읽기에서 모두 빠진다 */
    blocked: Set<string>;
  }>({
    posts: state === "ready" || state === "ranking" ? COMMUNITY_POSTS.map((p) => ({ ...p })) : [],
    comments: Object.fromEntries(Object.entries(COMMUNITY_COMMENTS).map(([k, v]) => [k, v.map((c) => ({ ...c }))])),
    seq: 1,
    reported: new Set(),
    blocked: new Set(),
  });
  const postVisible = (p: FeedPost) => !db.current.reported.has(`post:${p.id}`) && (p.isMine || !db.current.blocked.has(p.authorName));
  const commentVisible = (c: FeedComment) => !db.current.reported.has(`comment:${c.id}`) && (c.isMine || !db.current.blocked.has(c.authorName));

  // 이용 규칙 동의의 가짜 저장소 — 한 번 동의하면 이 화면이 열려 있는 동안 다시 묻지 않는다 (훅이 `store`가 바뀌면 다시 읽으니 한 번만 만든다)
  const [rulesStore] = useState<RulesStore>(() => {
    let accepted = rulesParam !== "ask";
    return {
      read: async () => accepted,
      write: async () => {
        accepted = true;
        const g = globalThis as { __offloFeedCalls?: string[] };
        (g.__offloFeedCalls ??= []).push("rules accepted");
      },
    };
  });
  const rules = useCommunityRules(rulesStore);
  const log = (entry: string) => {
    const g = globalThis as { __offloFeedCalls?: string[] };
    (g.__offloFeedCalls ??= []).push(entry);
  };
  const failing = (op: string) => fail === "all" || fail === op;
  const call = async <T,>(entry: string, op: string, run: () => T): Promise<T> => {
    log(entry);
    // `&slow=1` — 응답이 느린 서버 (낙관적 갱신이 응답 전에 보이는지 · 연달아 눌러도 한 번인지 확인용)
    await sleep(slow === "1" ? 900 : 200);
    if (failing(op)) throw new ApiError("network", API_MESSAGES.network);
    return run();
  };

  const server: FeedServer = {
    page: async (cursor) => {
      if (state === "loading") await new Promise(() => {}); // 끝나지 않는 로딩
      return call(`page ${cursor ?? "first"}`, cursor ? "more" : "refresh", () => {
        if (state === "error") throw new ApiError("network", API_MESSAGES.network);
        // 커서는 걸러내기 전 목록의 자리다 — 신고 · 차단으로 글이 빠져도 페이지가 꽉 차고 커서가 이어진다 (서버와 같다)
        const all = db.current.posts;
        const rest = all.slice(cursor ? all.findIndex((p) => p.id === cursor) + 1 : 0).filter(postVisible);
        const page = rest.slice(0, PAGE);
        return { posts: page.map((p) => ({ ...p })), nextCursor: rest.length > PAGE ? page[page.length - 1].id : null };
      });
    },
    createPost: (content) =>
      call(`post ${JSON.stringify(content)}`, "post", () => {
        const id = `p-new-${db.current.seq++}`;
        db.current.posts = [
          { id, type: "text", content, badgeName: null, likeCount: 0, commentCount: 0, createdAt: new Date(SAMPLE_NOW).toISOString(), authorName: "지우", isMine: true, liked: false },
          ...db.current.posts,
        ];
      }),
    like: (postId) =>
      call(`like ${postId}`, "like", () => {
        const p = db.current.posts.find((x) => x.id === postId)!;
        p.liked = !p.liked;
        p.likeCount = Math.max(0, p.likeCount + (p.liked ? 1 : -1));
        return { liked: p.liked, likeCount: p.likeCount };
      }),
    deletePost: (postId) =>
      call(`delete ${postId}`, "delete", () => {
        db.current.posts = db.current.posts.filter((p) => p.id !== postId);
      }),
    comments: (postId) => call(`comments ${postId}`, "comments", () => ({ comments: (db.current.comments[postId] ?? []).filter(commentVisible).map((c) => ({ ...c })) })),
    addComment: (postId, content) =>
      call(`comment ${postId} ${JSON.stringify(content)}`, "add", () => {
        const comment: FeedComment = { id: `c-new-${db.current.seq++}`, content, createdAt: new Date(SAMPLE_NOW).toISOString(), authorName: "지우", isMine: true };
        db.current.comments[postId] = [...(db.current.comments[postId] ?? []), comment];
        const p = db.current.posts.find((x) => x.id === postId);
        if (p) p.commentCount += 1;
        return { comment };
      }),
    deleteComment: (commentId) =>
      call(`uncomment ${commentId}`, "uncomment", () => {
        for (const [postId, list] of Object.entries(db.current.comments)) {
          if (list.some((c) => c.id === commentId)) {
            db.current.comments[postId] = list.filter((c) => c.id !== commentId);
            const p = db.current.posts.find((x) => x.id === postId);
            if (p) p.commentCount = Math.max(0, p.commentCount - 1);
          }
        }
      }),
    report: (targetType, targetId, reason) =>
      call(`report ${targetType} ${targetId} ${reason}`, "report", () => {
        db.current.reported.add(`${targetType}:${targetId}`);
      }),
    block: (targetType, targetId) =>
      call(`block ${targetType} ${targetId}`, "block", () => {
        const author =
          targetType === "post"
            ? db.current.posts.find((p) => p.id === targetId)?.authorName
            : Object.values(db.current.comments)
                .flat()
                .find((c) => c.id === targetId)?.authorName;
        if (author) db.current.blocked.add(author);
      }),
  };

  const feed = useFeed(server);

  const rankingData = state === "ranking-empty" ? RANKING_EMPTY : state === "ranking-outside" ? RANKING_OUTSIDE : state === "ranking-loading" || state === "ranking-error" ? null : RANKING_READY;

  return (
    <CommunityView
      now={SAMPLE_NOW.getTime()}
      myName="지우"
      mode={mode}
      onModeChange={setMode}
      posts={feed.posts}
      hasMore={feed.hasMore}
      loading={feed.loading}
      refreshing={feed.refreshing}
      loadingMore={feed.loadingMore}
      error={feed.error}
      moreError={feed.moreError}
      onRefresh={feed.refresh}
      onLoadMore={feed.loadMore}
      onPost={feed.post}
      showNotice={showNotice}
      onDismissNotice={() => setShowNotice(false)}
      highlightId={highlight ?? null}
      actions={feed.actions}
      rules={rules}
      feedNotice={feed.notice}
      onDismissFeedNotice={feed.dismissNotice}
      ranking={{ data: rankingData, error: state === "ranking-error" ? API_MESSAGES.network : null, onRetry: noop }}
    />
  );
}
