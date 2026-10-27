/**
 * 커뮤니티 이용 규칙 창 — 글 · 댓글을 쓰기 전에 보여 주고 동의를 받는다 (Play UGC 정책). props로만 그린다 (`hooks/use-community-rules.ts`가 상태를 든다).
 *
 * 동의 전: "동의하고 계속" + "취소" (취소하면 쓰려던 글 · 댓글은 보내지 않는다) · 이미 동의한 사람이 "이용 규칙"을 눌러 열면 읽기 전용("닫기")이다.
 * 긴 내용은 창 안에서 스크롤한다. 가림막을 눌러도 닫히지 않는다 (동의 창을 실수로 넘기지 않게) — 뒤로 가기 · 취소로만 닫는다.
 */
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import Pill from "@/components/app/Pill";
import { COMMUNITY_RULES, RULES_ENFORCEMENT, RULES_TITLE } from "@/logic/moderation";
import { colors, fonts, radius } from "@/theme";

export default function CommunityRulesModal({
  visible,
  alreadyAccepted,
  onAccept,
  onClose,
}: {
  visible: boolean;
  /** 이미 동의한 사람이 다시 보는 것이면 읽기 전용 */
  alreadyAccepted: boolean;
  onAccept: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View testID="rules-scrim" style={styles.scrim}>
        <View testID="rules-modal" style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>
            {RULES_TITLE}
          </Text>
          <Text style={styles.lead}>{alreadyAccepted ? "함께 지키는 규칙이에요." : "글과 댓글을 쓰기 전에 읽어 주세요. 동의해야 쓸 수 있어요."}</Text>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator>
            {COMMUNITY_RULES.map((rule, i) => (
              <View key={rule.title} testID={`rule-${i}`} style={styles.rule}>
                <Text style={styles.ruleTitle}>{rule.title}</Text>
                <Text style={styles.ruleBody}>{rule.body}</Text>
              </View>
            ))}
            <View style={styles.enforce}>
              <Text style={styles.enforceTitle}>규칙을 어기면</Text>
              {RULES_ENFORCEMENT.map((line) => (
                <Text key={line} style={styles.enforceLine}>
                  · {line}
                </Text>
              ))}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            {alreadyAccepted ? (
              <Pill testID="rules-close" label="닫기" onPress={onClose} />
            ) : (
              <>
                <Pressable testID="rules-cancel" accessibilityRole="button" hitSlop={10} onPress={onClose} style={styles.cancel}>
                  <Text style={styles.cancelText}>취소</Text>
                </Pressable>
                <Pill testID="rules-accept" label="동의하고 계속" variant="accent" onPress={onAccept} />
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
    backgroundColor: colors.scrim,
  },
  card: {
    maxHeight: "88%",
    gap: 12,
    padding: 22,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgCard,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    lineHeight: 23,
    color: colors.textPrimary,
  },
  lead: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: 10,
    paddingVertical: 2,
  },
  rule: {
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgSubtle,
  },
  ruleTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textPrimary,
  },
  ruleBody: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 19,
    color: colors.textPrimarySoft,
  },
  enforce: {
    gap: 6,
    paddingTop: 6,
  },
  enforceTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 19,
    color: colors.brand,
  },
  enforceLine: {
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
    paddingTop: 4,
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
});
