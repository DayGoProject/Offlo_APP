/**
 * 배지 화면의 그림 — 데이터는 props로만 받는다 (mobile.md "웹 미리보기 — 미리보기 화면").
 * `app/(app)/badges.tsx`는 불러오기 · 공유를, `app/preview/badges.tsx`는 샘플 값을 넘긴다. 이 파일은 `api` · `useAuth` · Firebase를 import하지 않는다.
 *
 * 획득한 배지(자랑하기) + 아직 잠긴 배지(진행도). 자랑하기는 한마디(선택)를 받아 커뮤니티에 공유한다 — 서버가 배지 이름을 DB에서 다시 확인한다.
 */
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import Card from "@/components/app/Card";
import ErrorNotice from "@/components/app/ErrorNotice";
import PageHeader from "@/components/app/PageHeader";
import Pill from "@/components/app/Pill";
import Screen from "@/components/app/Screen";
import Skeleton from "@/components/app/Skeleton";
import TextField from "@/components/app/TextField";
import BadgeIcon from "@/components/badges/BadgeIcon";
import { SHARE_MESSAGE_MAX, badgesEyebrow, lockedProgress, shareMessage, splitBadges, type BadgeStats } from "@/logic/badges";
import type { Badge } from "@/services/api-types";
import { ALL_BADGES, getBadgeDef, type BadgeDef } from "@/shared/badge-utils";
import { fmtDate } from "@/shared/format";
import { colors, em, fonts, radius } from "@/theme";

export interface BadgesViewProps {
  badges: Badge[] | null;
  /** 잠긴 배지의 진행도에 쓰는 값 — 못 읽었으면 null (막대를 그리지 않는다) */
  stats: BadgeStats | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** 커뮤니티에 공유 — 실패하면 모달 안에 띄울 문구, 성공하면 null (부모가 커뮤니티로 보낸다) */
  onShare: (badge: Badge, message: string) => Promise<string | null>;
  onOpenCommunity: () => void;
  /** 미리보기 — 처음부터 이 배지의 공유 모달을 열어 둔다 */
  startShareId?: string;
}

const PLACEHOLDER_BADGE = ALL_BADGES[0];

export default function BadgesView({ badges, stats, loading, error, onRetry, onShare, onOpenCommunity, startShareId }: BadgesViewProps) {
  const ready = badges !== null;
  const { earned, locked } = splitBadges(badges ?? []);
  const [target, setTarget] = useState<Badge | null>(() => badges?.find((b) => b.id === startShareId) ?? null);
  const [shareKey, setShareKey] = useState(0);

  return (
    <Screen testID="badges" refreshing={loading && ready} onRefresh={onRetry}>
      <PageHeader
        eyebrow={badgesEyebrow(badges)}
        title="배지"
        actions={<Pill testID="badges-community" variant="primary" label="커뮤니티 가기" onPress={onOpenCommunity} />}
      />

      {error ? <ErrorNotice testID="badges-error" message={error} onRetry={onRetry} /> : null}

      {/* ── 획득한 배지 ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>획득한 배지</Text>
        {!ready ? (
          error ? null : (
            <View style={styles.grid}>
              {[0, 1].map((i) => (
                <View key={i} style={styles.cell}>
                  <Skeleton testID={i === 0 ? "badges-skeleton" : undefined} height={190} radius={radius.card} />
                </View>
              ))}
            </View>
          )
        ) : earned.length === 0 ? (
          <Card testID="badges-empty">
            <View style={styles.emptyText}>
              <Text style={styles.emptyTitle}>아직 획득한 배지가 없어요</Text>
              <Text style={styles.emptyBody}>분석을 한 번만 올려도 첫 배지가 열립니다.</Text>
            </View>
          </Card>
        ) : (
          <View style={styles.grid}>
            {earned.map((badge) => {
              const def = getBadgeDef(badge.name);
              return (
                <View key={badge.id} testID={`badge-${badge.id}`} style={[styles.cell, styles.card, styles.cardEarned]}>
                  <BadgeIcon badge={def ?? PLACEHOLDER_BADGE} />
                  <View style={styles.cardText}>
                    <Text testID={`badge-name-${badge.id}`} style={styles.name}>
                      {badge.name}
                    </Text>
                    <Text style={styles.date}>
                      <Text style={styles.num}>{fmtDate(badge.earnedAt)}</Text>
                      {" 획득"}
                    </Text>
                  </View>
                  <Pill
                    testID={`badge-share-${badge.id}`}
                    label={badge.shared ? "공유함" : "자랑하기"}
                    disabled={badge.shared}
                    onPress={() => {
                      setShareKey((k) => k + 1);
                      setTarget(badge);
                    }}
                  />
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* ── 잠긴 배지 ── */}
      {ready && locked.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>아직 잠긴 배지</Text>
          <View style={styles.grid}>
            {locked.map((badge) => {
              const { ratio, note } = lockedProgress(badge.name, stats);
              return (
                <View key={badge.name} testID={`badge-locked-${badge.name}`} style={[styles.cell, styles.card]}>
                  <BadgeIcon badge={badge} locked />
                  <View style={styles.cardText}>
                    <Text style={[styles.name, { color: colors.textFaint }]}>{badge.name}</Text>
                    <Text testID={`badge-note-${badge.name}`} style={styles.note}>
                      {note}
                    </Text>
                  </View>
                  {ratio !== null ? (
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }]} />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {target ? (
        <ShareModal
          key={shareKey}
          badge={target}
          onShare={async (message) => {
            const error = await onShare(target, message);
            if (!error) setTarget(null);
            return error;
          }}
          onClose={() => setTarget(null)}
        />
      ) : null}
    </Screen>
  );
}

function ShareModal({
  badge,
  onShare,
  onClose,
}: {
  badge: Badge;
  onShare: (message: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const def: BadgeDef | undefined = getBadgeDef(badge.name);

  const close = () => {
    if (!sharing) onClose();
  };

  async function submit() {
    if (sharing) return;
    const checked = shareMessage(message);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    setError(null);
    setSharing(true);
    try {
      const failed = await onShare(checked.content);
      if (failed) setError(failed);
    } finally {
      setSharing(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <Pressable testID="share-scrim" accessibilityLabel="닫기" style={styles.scrim} onPress={close}>
          <Pressable testID="share-modal" style={styles.modal} onPress={() => {}}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Text accessibilityRole="header" style={styles.modalTitle}>
                배지 자랑하기
              </Text>

              <View style={styles.preview}>
                <BadgeIcon badge={def ?? PLACEHOLDER_BADGE} />
                <View style={styles.previewText}>
                  <Text style={styles.previewLabel}>커뮤니티에 공유할 배지</Text>
                  <Text testID="share-badge-name" style={styles.previewName}>
                    {badge.name}
                  </Text>
                </View>
              </View>

              <TextField
                testID="share-message"
                label="한마디 (선택)"
                hint="커뮤니티 피드에 이름과 함께 공개됩니다."
                placeholder="예: 드디어 7일 연속 달성했어요!"
                multiline
                value={message}
                onChangeText={setMessage}
                maxLength={SHARE_MESSAGE_MAX}
              />

              {error ? (
                <Text testID="share-error" accessibilityRole="alert" style={styles.error}>
                  {error}
                </Text>
              ) : null}

              <View style={styles.actions}>
                <Pill testID="share-cancel" label="취소" onPress={close} disabled={sharing} />
                <Pill testID="share-submit" variant="accent" label={sharing ? "공유 중…" : "커뮤니티에 공유"} onPress={submit} disabled={sharing} />
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 14,
  },
  sectionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: em(11, 0.14),
    color: colors.textMuted,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  // 2열 — 폭의 절반에서 간격 절반을 뺀다
  cell: {
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: 140,
  },
  card: {
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgCard,
  },
  cardEarned: {
    borderColor: colors.accentLine,
  },
  cardText: {
    flex: 1,
    gap: 6,
  },
  name: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  date: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  num: {
    fontFamily: fonts.num,
    fontVariant: ["tabular-nums"],
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  track: {
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.scoreTrack,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.brandBar,
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
    lineHeight: 20,
    color: colors.textMuted,
  },
  flex: {
    flex: 1,
  },
  scrim: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
    backgroundColor: colors.scrim,
  },
  modal: {
    maxHeight: "92%",
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgCard,
  },
  modalContent: {
    gap: 20,
    padding: 22,
  },
  modalTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.accentLine,
    backgroundColor: colors.accentSoft,
  },
  previewText: {
    flex: 1,
    gap: 4,
  },
  previewLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  previewName: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.brand,
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.dangerLine,
    backgroundColor: colors.dangerSoft,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
});
