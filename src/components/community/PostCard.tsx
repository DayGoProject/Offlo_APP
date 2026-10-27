/**
 * 피드 글 카드 — 웹 `components/community/PostCard.tsx` 이식. 작성자 · 본문 · 좋아요 · 댓글(펼침) · 내 글 삭제.
 *
 * 서버와 얘기하는 일은 전부 `actions`로 받는다 (api · Firebase를 import하지 않는다 — 미리보기와 실제 화면이 같은 컴포넌트를 쓴다).
 * 실패 문구는 카드 안(액션 줄 아래)에 한국어로 띄운다.
 *
 *  · 좋아요는 눌러 둔 요청이 끝나기 전에 다시 누르지 않는다 (토글이라 두 번 가면 취소된다).
 *  · 댓글은 처음 펼칠 때만 불러오고 이후엔 카드 안 상태로 관리한다. 등록 · 삭제 뒤의 댓글 수는 부모(`actions`)가 글에 반영한다.
 *  · 삭제(글 · 댓글)는 카드 안에서 한 번 더 묻는다 — OS 대화상자를 쓰지 않는다.
 *  · 남의 글 · 댓글에는 "신고 · 차단"이 있다 (M9 — Play UGC 정책). 누르면 카드 안에 패널이 펼쳐진다 (`ModerationPanel`).
 *    글을 신고 · 차단하면 부모가 카드를 치운다 · 댓글은 이 카드가 목록에서 치우고 안내를 남긴다.
 *  · 댓글을 쓰기 전에 이용 규칙 동의를 확인한다 (`ensureRules` — 동의 전이면 규칙 창이 뜨고, 취소하면 보내지 않는다).
 */
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { CommentIcon, HeartIcon } from "@/components/app/Icons";
import Avatar from "@/components/community/Avatar";
import ModerationPanel from "@/components/community/ModerationPanel";
import { COMMENT_MAX, checkComment, relativeTime } from "@/logic/community";
import { NOTICE_REPORTED_COMMENT, noticeBlocked, type ReportReason } from "@/logic/moderation";
import type { FeedComment, FeedPost } from "@/services/api-types";
import { colors, fonts, radius } from "@/theme";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

export interface PostActions {
  /** 좋아요 토글 — 실패하면 문구, 성공하면 null (낙관적 갱신 · 되돌리기는 부모가 한다) */
  like: (post: FeedPost) => Promise<string | null>;
  remove: (post: FeedPost) => Promise<string | null>;
  comments: (post: FeedPost) => Promise<Result<{ comments: FeedComment[] }>>;
  addComment: (post: FeedPost, text: string) => Promise<Result<{ comment: FeedComment }>>;
  removeComment: (post: FeedPost, comment: FeedComment) => Promise<string | null>;
  /** 쓰기 직전 — 이용 규칙에 동의했으면 true (동의 전이면 규칙 창을 띄우고 기다린다) */
  ensureRules: () => Promise<boolean>;
  /** 글 신고 · 작성자 차단 — 실패하면 문구, 성공하면 null (성공하면 부모가 이 카드를 치운다) */
  report: (post: FeedPost, reason: ReportReason) => Promise<string | null>;
  block: (post: FeedPost) => Promise<string | null>;
  /** 댓글 신고 · 작성자 차단 — 성공하면 null (목록에서 치우는 일은 카드가 한다) */
  reportComment: (post: FeedPost, comment: FeedComment, reason: ReportReason) => Promise<string | null>;
  blockComment: (post: FeedPost, comment: FeedComment) => Promise<string | null>;
}

export default function PostCard({
  post,
  now,
  highlight = false,
  actions,
  onFocusInput,
}: {
  post: FeedPost;
  /** 기준 시각(ms) — 상대 시간 */
  now: number;
  highlight?: boolean;
  actions: PostActions;
  /** 댓글 입력칸에 포커스가 갔다 — 목록이 이 카드를 키보드 위로 스크롤한다 */
  onFocusInput?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<FeedComment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmComment, setConfirmComment] = useState<string | null>(null);
  // 신고 · 차단 패널 — 글 것(modPost) 또는 댓글 하나(modComment)만 열린다
  const [modPost, setModPost] = useState(false);
  const [modComment, setModComment] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function like() {
    if (likeBusy) return;
    setLikeBusy(true);
    setError(null);
    try {
      const failed = await actions.like(post);
      if (failed) setError(failed);
    } finally {
      setLikeBusy(false);
    }
  }

  async function toggleComments() {
    const next = !open;
    setOpen(next);
    if (next && comments === null) {
      const res = await actions.comments(post);
      if (res.ok) {
        setComments(res.comments);
      } else {
        setError(res.error);
        setComments([]);
      }
    }
  }

  async function addComment() {
    if (busy) return;
    const checked = checkComment(draft);
    if (!checked.ok) {
      if (!checked.empty) setError(checked.error);
      return;
    }
    if (!(await actions.ensureRules())) return; // 규칙에 동의하지 않으면 보내지 않는다 (입력은 남긴다)
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await actions.addComment(post, checked.text);
      if (res.ok) {
        setComments((prev) => [...(prev ?? []), res.comment]);
        setDraft("");
      } else {
        setError(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function removeComment(comment: FeedComment) {
    setError(null);
    const failed = await actions.removeComment(post, comment);
    if (failed) {
      setError(failed);
      return;
    }
    setComments((prev) => (prev ?? []).filter((c) => c.id !== comment.id));
    setConfirmComment(null);
  }

  async function removePost() {
    const failed = await actions.remove(post);
    if (failed) {
      setConfirmDelete(false);
      setError(failed);
    }
  }

  /** 글 신고 · 차단 — 성공하면 부모가 카드를 치우므로 패널은 에러만 받는다 */
  const reportPost = (reason: ReportReason) => actions.report(post, reason);
  const blockPost = () => actions.block(post);

  /** 댓글 신고 — 성공하면 그 댓글을 목록에서 치우고 안내를 남긴다 */
  async function reportComment(comment: FeedComment, reason: ReportReason): Promise<string | null> {
    const failed = await actions.reportComment(post, comment, reason);
    if (failed) return failed;
    setComments((prev) => (prev ?? []).filter((c) => c.id !== comment.id));
    setModComment(null);
    setInfo(NOTICE_REPORTED_COMMENT);
    return null;
  }

  /** 댓글 작성자 차단 — 차단한 사람의 다른 댓글도 함께 빠지도록 댓글을 다시 읽는다 */
  async function blockComment(comment: FeedComment): Promise<string | null> {
    const failed = await actions.blockComment(post, comment);
    if (failed) return failed;
    setModComment(null);
    setInfo(noticeBlocked(comment.authorName));
    const res = await actions.comments(post);
    setComments(res.ok ? res.comments : (prev) => (prev ?? []).filter((c) => c.id !== comment.id));
    return null;
  }

  const canSend = draft.trim().length > 0 && !busy;

  return (
    <View testID={`post-${post.id}`} style={[styles.card, highlight && styles.cardHighlight]}>
      {/* 헤더 */}
      <View style={styles.head}>
        <Avatar name={post.authorName} />
        <View style={styles.headText}>
          <Text numberOfLines={1} style={styles.author}>
            {post.authorName}
          </Text>
          <Text style={styles.time}>{relativeTime(post.createdAt, now)}</Text>
        </View>

        {/* 배지 자랑 글이면 배지 이름을 헤더 오른쪽 알약으로 */}
        {post.type === "badge" && post.badgeName ? (
          <View testID={`post-badge-${post.id}`} style={styles.badgePill}>
            <Text style={styles.badgePillText}>{post.badgeName}</Text>
          </View>
        ) : null}

        {post.isMine ? (
          confirmDelete ? (
            <View style={styles.confirm}>
              <Pressable testID={`post-delete-ok-${post.id}`} accessibilityRole="button" hitSlop={10} onPress={removePost}>
                <Text style={[styles.small, { color: colors.danger }]}>삭제할까요?</Text>
              </Pressable>
              <Pressable testID={`post-delete-cancel-${post.id}`} accessibilityRole="button" hitSlop={10} onPress={() => setConfirmDelete(false)}>
                <Text style={[styles.small, { color: colors.textMuted }]}>취소</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              testID={`post-delete-${post.id}`}
              accessibilityRole="button"
              accessibilityLabel="내 글 삭제"
              hitSlop={10}
              onPress={() => setConfirmDelete(true)}
            >
              <Text style={[styles.small, { color: colors.textFaint }]}>삭제</Text>
            </Pressable>
          )
        ) : (
          <Pressable
            testID={`post-report-${post.id}`}
            accessibilityRole="button"
            accessibilityLabel="이 글 신고하기 또는 작성자 차단하기"
            accessibilityState={{ expanded: modPost }}
            hitSlop={10}
            onPress={() => setModPost((v) => !v)}
          >
            <Text style={[styles.small, { color: modPost ? colors.textPrimary : colors.textFaint }]}>신고 · 차단</Text>
          </Pressable>
        )}
      </View>

      {/* 본문 */}
      {post.content ? (
        <Text selectable testID={`post-content-${post.id}`} style={styles.content}>
          {post.content}
        </Text>
      ) : null}

      {modPost && !post.isMine ? (
        <ModerationPanel
          prefix={`post-${post.id}`}
          subject="글"
          authorName={post.authorName}
          onReport={reportPost}
          onBlock={blockPost}
          onClose={() => setModPost(false)}
        />
      ) : null}

      {/* 액션 */}
      <View style={styles.actions}>
        <Pressable
          testID={`post-like-${post.id}`}
          accessibilityRole="button"
          accessibilityLabel={`좋아요 ${post.likeCount}개${post.liked ? ", 눌러서 취소" : ""}`}
          accessibilityState={{ selected: post.liked, busy: likeBusy }}
          onPress={like}
          hitSlop={{ top: 12, bottom: 12, left: 6, right: 12 }}
          style={styles.action}
        >
          <HeartIcon color={post.liked ? colors.brand : colors.textMuted} filled={post.liked} />
          <Text testID={`post-like-count-${post.id}`} style={[styles.count, { color: post.liked ? colors.brand : colors.textMuted }]}>
            {post.likeCount}
          </Text>
        </Pressable>

        <Pressable
          testID={`post-comments-${post.id}`}
          accessibilityRole="button"
          accessibilityLabel={`댓글 ${post.commentCount}개, ${open ? "접기" : "펼치기"}`}
          accessibilityState={{ expanded: open }}
          onPress={toggleComments}
          hitSlop={{ top: 12, bottom: 12, left: 6, right: 12 }}
          style={styles.action}
        >
          <CommentIcon color={open ? colors.textPrimary : colors.textMuted} />
          <Text testID={`post-comment-count-${post.id}`} style={[styles.count, { color: open ? colors.textPrimary : colors.textMuted }]}>
            {post.commentCount}
          </Text>
        </Pressable>
      </View>

      {/* 댓글 */}
      {open ? (
        <View testID={`post-comment-area-${post.id}`} style={styles.comments}>
          {comments === null ? (
            <Text style={styles.faint}>댓글 불러오는 중…</Text>
          ) : comments.length === 0 ? (
            <Text style={styles.faint}>아직 댓글이 없어요. 첫 응원을 남겨보세요.</Text>
          ) : (
            comments.map((c) => (
              <View key={c.id} testID={`comment-${c.id}`} style={styles.comment}>
                <Avatar name={c.authorName} size={26} />
                <View style={styles.commentBody}>
                  <View style={styles.commentHead}>
                    <Text numberOfLines={1} style={styles.commentAuthor}>
                      {c.authorName}
                    </Text>
                    <Text style={styles.commentTime}>{relativeTime(c.createdAt, now)}</Text>
                    {c.isMine ? (
                      confirmComment === c.id ? (
                        <View style={[styles.confirm, { marginLeft: "auto" }]}>
                          <Pressable testID={`comment-delete-ok-${c.id}`} accessibilityRole="button" hitSlop={10} onPress={() => removeComment(c)}>
                            <Text style={[styles.small, { color: colors.danger }]}>삭제할까요?</Text>
                          </Pressable>
                          <Pressable testID={`comment-delete-cancel-${c.id}`} accessibilityRole="button" hitSlop={10} onPress={() => setConfirmComment(null)}>
                            <Text style={[styles.small, { color: colors.textMuted }]}>취소</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable
                          testID={`comment-delete-${c.id}`}
                          accessibilityRole="button"
                          accessibilityLabel="내 댓글 삭제"
                          hitSlop={10}
                          onPress={() => setConfirmComment(c.id)}
                          style={{ marginLeft: "auto" }}
                        >
                          <Text style={[styles.small, { color: colors.textGhost }]}>삭제</Text>
                        </Pressable>
                      )
                    ) : (
                      <Pressable
                        testID={`comment-report-${c.id}`}
                        accessibilityRole="button"
                        accessibilityLabel="이 댓글 신고하기 또는 작성자 차단하기"
                        accessibilityState={{ expanded: modComment === c.id }}
                        hitSlop={10}
                        onPress={() => setModComment((cur) => (cur === c.id ? null : c.id))}
                        style={{ marginLeft: "auto" }}
                      >
                        <Text style={[styles.small, { color: modComment === c.id ? colors.textPrimary : colors.textGhost }]}>신고 · 차단</Text>
                      </Pressable>
                    )}
                  </View>
                  <Text selectable style={styles.commentText}>
                    {c.content}
                  </Text>
                  {modComment === c.id ? (
                    <ModerationPanel
                      prefix={`comment-${c.id}`}
                      subject="댓글"
                      authorName={c.authorName}
                      onReport={(reason) => reportComment(c, reason)}
                      onBlock={() => blockComment(c)}
                      onClose={() => setModComment(null)}
                    />
                  ) : null}
                </View>
              </View>
            ))
          )}

          {/* 댓글 입력 */}
          <View style={styles.inputRow}>
            <TextInput
              testID={`comment-input-${post.id}`}
              accessibilityLabel="댓글 쓰기"
              value={draft}
              onChangeText={setDraft}
              maxLength={COMMENT_MAX}
              placeholder="따뜻한 댓글을 남겨주세요"
              placeholderTextColor={colors.textFaint}
              selectionColor={colors.brand}
              returnKeyType="send"
              onFocus={onFocusInput}
              onSubmitEditing={addComment}
              style={styles.input}
            />
            <Pressable
              testID={`comment-send-${post.id}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSend }}
              disabled={!canSend}
              onPress={addComment}
              hitSlop={{ top: 8, bottom: 8 }}
              style={[styles.send, { opacity: canSend ? 1 : 0.35 }]}
            >
              <Text style={styles.sendText}>등록</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {info ? (
        <Text testID={`post-info-${post.id}`} accessibilityRole="alert" style={styles.info}>
          {info}
        </Text>
      ) : null}

      {error ? (
        <Text testID={`post-error-${post.id}`} accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgCard,
  },
  cardHighlight: {
    borderColor: "rgba(61, 219, 135, 0.45)",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  headText: {
    flex: 1,
    gap: 2,
  },
  author: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: colors.textPrimary,
  },
  time: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textMuted,
  },
  badgePill: {
    height: 24,
    paddingHorizontal: 11,
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accentLine,
    backgroundColor: colors.accentSoft,
  },
  badgePillText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    color: colors.brand,
  },
  confirm: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  small: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 14,
  },
  content: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 23,
    color: colors.textPrimarySoft,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 22,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderCard,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 24,
  },
  count: {
    fontFamily: fonts.num,
    fontSize: 12,
    lineHeight: 16,
    fontVariant: ["tabular-nums"],
  },
  comments: {
    gap: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderCard,
  },
  faint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textFaint,
  },
  comment: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  commentBody: {
    flex: 1,
    gap: 4,
  },
  commentHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  commentAuthor: {
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textPrimary,
  },
  commentTime: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textGhost,
  },
  commentText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 19,
    color: colors.textMuted,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    paddingLeft: 16,
    paddingRight: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgNav,
  },
  input: {
    flex: 1,
    minHeight: 36,
    paddingVertical: 6,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textPrimary,
  },
  send: {
    height: 32,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  sendText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.bgPage,
  },
  info: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.danger,
  },
});
