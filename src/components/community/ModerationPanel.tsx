/**
 * 신고 · 차단 패널 — 글 카드나 댓글 줄 안에서 펼쳐진다 (OS 대화상자를 쓰지 않는다 · 목표 삭제 확인과 같은 방식). props로만 그린다 (api · Firebase 없음).
 *
 *  1단계 메뉴: "이 글(댓글) 신고하기" · "{이름}님 차단하기" · 닫기
 *  2단계 신고: 사유를 하나 고르고 "신고하기" — 사유는 서버와 같은 5개(`logic/moderation.ts`)
 *  2단계 차단: "{이름}님의 글 · 댓글 · 랭킹이 내게 보이지 않아요…" + "차단하기"
 * 성공하면 부모가 글 · 댓글을 치우므로(카드가 사라진다) 이 패널은 에러만 책임진다. 보내는 중에는 버튼이 잠긴다 (연달아 눌러도 한 번).
 * 모든 testID는 `prefix`(`post-<id>` · `comment-<id>`)로 시작해 한 화면에 여러 패널이 있어도 겹치지 않는다.
 */
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import Pill from "@/components/app/Pill";
import { REPORT_REASONS, blockConfirmText, type ReportReason } from "@/logic/moderation";
import { colors, fonts, radius } from "@/theme";

type Step = "menu" | "report" | "block";

export default function ModerationPanel({
  prefix,
  subject,
  authorName,
  onReport,
  onBlock,
  onClose,
}: {
  prefix: string;
  /** "글" | "댓글" — 문구에 쓴다 */
  subject: "글" | "댓글";
  authorName: string;
  /** 신고 — 실패하면 문구, 성공하면 null */
  onReport: (reason: ReportReason) => Promise<string | null>;
  /** 작성자 차단 — 실패하면 문구, 성공하면 null */
  onBlock: () => Promise<string | null>;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("menu");
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(task: () => Promise<string | null>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const failed = await task();
      if (failed) setError(failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View testID={`${prefix}-mod`} style={styles.panel}>
      {step === "menu" ? (
        <View style={styles.menu}>
          <Pressable testID={`${prefix}-mod-report`} accessibilityRole="button" onPress={() => setStep("report")} style={styles.menuRow}>
            <Text style={styles.menuText}>이 {subject} 신고하기</Text>
          </Pressable>
          <Pressable testID={`${prefix}-mod-block`} accessibilityRole="button" onPress={() => setStep("block")} style={styles.menuRow}>
            <Text style={styles.menuText}>{authorName}님 차단하기</Text>
          </Pressable>
          <Pressable testID={`${prefix}-mod-close`} accessibilityRole="button" onPress={onClose} style={styles.menuRow}>
            <Text style={[styles.menuText, { color: colors.textMuted }]}>닫기</Text>
          </Pressable>
        </View>
      ) : null}

      {step === "report" ? (
        <View style={styles.body}>
          <Text style={styles.title}>어떤 문제인가요?</Text>
          <View style={styles.reasons}>
            {REPORT_REASONS.map((r) => {
              const selected = reason === r.value;
              return (
                <Pressable
                  key={r.value}
                  testID={`${prefix}-reason-${r.value}`}
                  accessibilityRole="radio"
                  aria-checked={selected}
                  accessibilityLabel={`${r.label}. ${r.hint}`}
                  onPress={() => setReason(r.value)}
                  style={[styles.reason, selected && styles.reasonOn]}
                >
                  <View style={[styles.dot, selected && styles.dotOn]} />
                  <View style={styles.reasonText}>
                    <Text style={[styles.reasonLabel, selected && { color: colors.brand }]}>{r.label}</Text>
                    <Text style={styles.reasonHint}>{r.hint}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.foot}>신고하면 이 {subject}은 바로 보이지 않아요. 상대에게는 알리지 않고, 운영자가 확인해요.</Text>
          <View style={styles.actions}>
            <Pressable testID={`${prefix}-mod-cancel`} accessibilityRole="button" hitSlop={10} onPress={onClose} style={styles.cancel}>
              <Text style={styles.cancelText}>취소</Text>
            </Pressable>
            <Pill testID={`${prefix}-mod-submit`} label={busy ? "보내는 중…" : "신고하기"} variant="accent" disabled={!reason || busy} onPress={() => reason && void run(() => onReport(reason))} />
          </View>
        </View>
      ) : null}

      {step === "block" ? (
        <View style={styles.body}>
          <Text style={styles.title}>{authorName}님을 차단할까요?</Text>
          <Text style={styles.foot}>{blockConfirmText(authorName)}</Text>
          <View style={styles.actions}>
            <Pressable testID={`${prefix}-mod-cancel`} accessibilityRole="button" hitSlop={10} onPress={onClose} style={styles.cancel}>
              <Text style={styles.cancelText}>취소</Text>
            </Pressable>
            <Pill testID={`${prefix}-mod-block-ok`} label={busy ? "차단하는 중…" : "차단하기"} variant="accent" disabled={busy} onPress={() => void run(onBlock)} />
          </View>
        </View>
      ) : null}

      {error ? (
        <Text testID={`${prefix}-mod-error`} accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 10,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgNav,
  },
  menu: {
    gap: 2,
  },
  menuRow: {
    minHeight: 44,
    justifyContent: "center",
  },
  menuText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textPrimary,
  },
  body: {
    gap: 12,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  reasons: {
    gap: 8,
  },
  reason: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgCard,
  },
  reasonOn: {
    borderColor: colors.accentLine,
    backgroundColor: colors.accentSoft,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.textFaint,
  },
  dotOn: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  reasonText: {
    flex: 1,
    gap: 2,
  },
  reasonLabel: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  reasonHint: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textMuted,
  },
  foot: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 19,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 18,
  },
  cancel: {
    minHeight: 44,
    justifyContent: "center",
  },
  cancelText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.danger,
  },
});
