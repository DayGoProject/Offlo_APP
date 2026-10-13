/**
 * 커뮤니티 화면의 그림 — 데이터는 props로만 받는다 (mobile.md "웹 미리보기 — 미리보기 화면").
 * `app/(app)/(tabs)/community.tsx`는 불러오기 · 저장을, `app/preview/community.tsx`는 샘플 값 + 가짜 서버를 넘긴다.
 * 이 파일은 `api` · `useAuth` · Firebase를 import하지 않는다.
 *
 * 피드는 `FlatList`다 (끝에 닿으면 다음 페이지 — 커서 페이지네이션이 서버에 이미 있다). 머리(제목 · 탭 · 안내 · 글쓰기)는 목록 머리로,
 * 글 한 개가 한 항목이다. "주간 랭킹"은 같은 화면의 다른 모습이다 (모드 전환) — 웹의 오른쪽 위젯 자리가 모바일엔 없다.
 */
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Card from "@/components/app/Card";
import ErrorNotice from "@/components/app/ErrorNotice";
import PageHeader from "@/components/app/PageHeader";
import Segmented from "@/components/app/Segmented";
import Skeleton from "@/components/app/Skeleton";
import Avatar from "@/components/community/Avatar";
import PostCard, { type PostActions } from "@/components/community/PostCard";
import RankingCard, { type RankingData } from "@/components/community/RankingCard";
import { POST_MAX, checkPost, indexOfPost } from "@/logic/community";
import type { FeedPost } from "@/services/api-types";
import { colors, fonts, radius } from "@/theme";

export type CommunityMode = "feed" | "ranking";

export interface CommunityViewProps {
  /** 기준 시각(ms) — 상대 시간 */
  now: number;
  /** 글쓰기 아바타에 넣는 내 이름 */
  myName: string;
  mode: CommunityMode;
  onModeChange: (mode: CommunityMode) => void;

  posts: FeedPost[] | null;
  hasMore: boolean;
  /** 처음 불러오는 중 */
  loading: boolean;
  /** 당겨서 새로고침 중 */
  refreshing: boolean;
  loadingMore: boolean;
  /** 첫 페이지를 못 불러왔다 */
  error: string | null;
  /** 다음 페이지를 못 불러왔다 — 이미 읽은 글은 그대로 두고 아래에 다시 시도를 둔다 */
  moreError: string | null;
  onRefresh: () => void;
  onLoadMore: () => void;

  /** 글 올리기 — 실패하면 문구, 성공하면 null (입력은 부모가 알려 주기 전에 비우지 않는다) */
  onPost: (text: string) => Promise<string | null>;
  showNotice: boolean;
  onDismissNotice: () => void;
  /** 알림 링크로 들어온 글 — 테두리를 강조하고 그 자리로 스크롤한다 (첫 페이지에 없으면 강조하지 않는다) */
  highlightId?: string | null;
  actions: PostActions;

  ranking: {
    data: RankingData | null;
    error: string | null;
    onRetry: () => void;
  };
}

export default function CommunityView(props: CommunityViewProps) {
  const {
    now,
    myName,
    mode,
    onModeChange,
    posts,
    hasMore,
    refreshing,
    loadingMore,
    error,
    moreError,
    onRefresh,
    onLoadMore,
    onPost,
    highlightId,
    actions,
  } = props;
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList<FeedPost>>(null);

  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  // 알림 링크의 글로 스크롤 — 목록이 처음 그려진 뒤 한 번만
  const scrolledTo = useRef<string | null>(null);
  useEffect(() => {
    const index = indexOfPost(posts ?? [], highlightId);
    if (index < 0 || !highlightId || scrolledTo.current === highlightId) return;
    scrolledTo.current = highlightId;
    const id = setTimeout(
      () =>
        list.current?.scrollToIndex({
          index,
          viewPosition: 0.2,
          animated: true,
        }),
      300,
    );
    return () => clearTimeout(id);
  }, [posts, highlightId]);

  async function submitPost() {
    if (posting) return;
    const checked = checkPost(draft);
    if (!checked.ok) {
      if (!checked.empty) setPostError(checked.error);
      return;
    }
    setPosting(true);
    setPostError(null);
    try {
      const failed = await onPost(checked.text);
      if (failed) setPostError(failed);
      else setDraft("");
    } finally {
      setPosting(false);
    }
  }

  const feed = mode === "feed";
  const canPost = draft.trim().length > 0 && !posting;

  const header = (
    <View style={styles.header}>
      <PageHeader
        eyebrow={feed ? (posts ? `글 ${posts.length}개${hasMore ? "+" : ""}` : "불러오는 중") : "최근 7일"}
        title="커뮤니티"
        actions={
          <Segmented
            value={mode}
            onChange={onModeChange}
            options={[
              { value: "feed", label: "피드" },
              { value: "ranking", label: "주간 랭킹" },
            ]}
          />
        }
      />

      {feed ? (
        <>
          {props.showNotice ? (
            <View testID="community-notice" style={styles.notice}>
              <View style={styles.noticeText}>
                <Text style={styles.noticeTitle}>커뮤니티에는 설정에 저장된 이름이 공개돼요</Text>
                <Text style={styles.noticeBody}>
                  글·댓글·랭킹에 이름이 그대로 표시됩니다. 실명이 부담된다면 설정에서 이름을 바꿔주세요.
                </Text>
              </View>
              <Pressable testID="community-notice-dismiss" accessibilityRole="button" hitSlop={12} onPress={props.onDismissNotice}>
                <Text style={styles.noticeAction}>확인</Text>
              </Pressable>
            </View>
          ) : null}

          {/* 글쓰기 */}
          <Card testID="composer">
            <View style={styles.composerRow}>
              <Avatar name={myName} size={36} tone="brand" />
              <TextInput
                testID="composer-input"
                accessibilityLabel="글 쓰기"
                value={draft}
                onChangeText={setDraft}
                maxLength={POST_MAX}
                multiline
                placeholder="오늘의 디톡스는 어땠나요? 팁이나 응원을 남겨주세요."
                placeholderTextColor={colors.textFaint}
                selectionColor={colors.brand}
                textAlignVertical="top"
                style={styles.composerInput}
              />
            </View>
            <View style={styles.composerFoot}>
              <Text testID="composer-count" style={styles.counter}>
                {draft.length} / {POST_MAX}
              </Text>
              <Pressable
                testID="composer-submit"
                accessibilityRole="button"
                accessibilityState={{ disabled: !canPost }}
                disabled={!canPost}
                onPress={submitPost}
                hitSlop={{ top: 4, bottom: 4 }}
                style={[styles.submit, { opacity: canPost ? 1 : 0.35 }]}
              >
                <Text style={styles.submitText}>{posting ? "등록 중…" : "글 올리기"}</Text>
              </Pressable>
            </View>
            {postError ? <ErrorNotice testID="composer-error" message={postError} /> : null}
          </Card>
        </>
      ) : (
        <RankingCard {...props.ranking} />
      )}

      {feed && error ? <ErrorNotice testID="feed-error" message={error} onRetry={props.onRefresh} /> : null}
    </View>
  );

  const empty = !feed ? null : posts === null ? (
    error ? null : (
      <View testID="feed-skeleton" style={styles.skeletons}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={157} radius={radius.card} />
        ))}
      </View>
    )
  ) : posts.length === 0 ? (
    <Card testID="feed-empty">
      <View style={styles.emptyText}>
        <Text style={styles.emptyTitle}>아직 글이 없어요</Text>
        <Text style={styles.emptyBody}>첫 글을 남겨 커뮤니티를 시작해 보세요. 획득한 배지는 배지 화면에서 바로 자랑할 수 있어요.</Text>
      </View>
    </Card>
  ) : null;

  const footer =
    !feed || !posts ? null : loadingMore ? (
      <View testID="feed-loading-more" style={styles.more}>
        <ActivityIndicator color={colors.brand} />
      </View>
    ) : moreError ? (
      <ErrorNotice testID="feed-more-error" message={moreError} onRetry={onLoadMore} />
    ) : posts.length > 0 && !hasMore ? (
      <Text testID="feed-end" style={styles.end}>
        모든 글을 봤어요
      </Text>
    ) : null;

  /**
   * 글 카드 안의 입력칸(댓글)에 포커스가 가면 그 카드의 아래쪽(= 입력칸)이 키보드 바로 위에 오도록 스크롤한다.
   * 안드로이드는 edge-to-edge라 키보드가 창을 줄이지 않는다 — 아래 `KeyboardAvoidingView`가 목록을 키보드 위로 줄여 주고, 줄어든 목록 안에서 입력칸을 보이게 하는 건 여기서 한다.
   * (키보드가 올라오는 시간을 주고 스크롤한다)
   */
  const revealCard = (index: number) => {
    setTimeout(() => list.current?.scrollToIndex({ index, viewPosition: 1, animated: true }), 350);
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.flex}>
      <FlatList
        ref={list}
        testID="community"
        data={feed && posts ? posts : []}
        keyExtractor={(post) => post.id}
        renderItem={({ item, index }) => (
          <PostCard post={item} now={now} highlight={item.id === highlightId} actions={actions} onFocusInput={() => revealCard(index)} />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        onEndReached={() => {
          if (feed && posts && hasMore && !loadingMore && !moreError) onLoadMore();
        }}
        onEndReachedThreshold={0.6}
        onScrollToIndexFailed={(info) =>
          list.current?.scrollToOffset({
            offset: info.averageItemLength * info.index,
            animated: true,
          })
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
            progressBackgroundColor={colors.bgCard}
          />
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        style={styles.list}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.bgPage,
  },
  list: {
    flex: 1,
    backgroundColor: colors.bgPage,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 14,
  },
  header: {
    gap: 20,
  },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.accentLine,
    backgroundColor: colors.accentSoft,
  },
  noticeText: {
    flex: 1,
    gap: 4,
  },
  noticeTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  noticeBody: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 19,
    color: colors.textMuted,
  },
  noticeAction: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
  },
  composerInput: {
    flex: 1,
    minHeight: 56,
    maxHeight: 160,
    paddingVertical: 8,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  composerFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingLeft: 47,
  },
  counter: {
    fontFamily: fonts.num,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    color: colors.textGhost,
  },
  submit: {
    height: 36,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  submitText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.bgPage,
  },
  skeletons: {
    gap: 14,
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
  more: {
    paddingVertical: 16,
  },
  end: {
    textAlign: "center",
    paddingVertical: 12,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textGhost,
  },
});
