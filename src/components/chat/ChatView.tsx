/**
 * AI 코치 채팅 화면의 그림 — 웹 `components/analysis/AnalysisChat.tsx` 이식. 데이터는 props로만 받는다.
 * 이 파일은 `api` · `useAuth` · Firebase를 import하지 않는다 (불러오기 · 전송은 app/(app)/chat/[id].tsx).
 *
 * - 아바타 없이 말풍선의 좌 · 우 정렬과 바탕색만으로 화자를 가른다 (웹과 같다)
 * - 입력줄은 알약 하나 안에 글 · 첨부 · 보내기 — 키보드가 올라오면 KeyboardAvoidingView가 함께 올린다
 * - 코치 답변도 사용자 글도 `<Text>`로만 그린다 (security.md)
 */
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ErrorNotice from "@/components/app/ErrorNotice";
import { BackIcon, CloseIcon, ImageIcon, SendIcon } from "@/components/app/Icons";
import Skeleton from "@/components/app/Skeleton";
import { MAX_MESSAGE_LENGTH, visibleText, type ChatItem } from "@/logic/chat";
import { colors, em, fonts, radius, VOID } from "@/theme";

export interface ChatViewProps {
  /** 상단 바 아래 줄 — "일간 분석 · 2026.09.19" */
  subtitle: string | null;
  /** 분석을 불러와 대화할 준비가 됐는지 */
  ready: boolean;
  loading: boolean;
  error: string | null;
  onRetry: () => void;

  messages: ChatItem[];
  sending: boolean;
  /** 보내지 못했을 때 — 보낸 글은 입력창으로 돌아와 있다 */
  sendError: string | null;
  input: string;
  onChangeInput: (text: string) => void;
  pendingImage: string | null;
  onPickImage: () => void;
  onRemoveImage: () => void;
  onSend: () => void;
  onBack: () => void;
}

export default function ChatView(props: ChatViewProps) {
  const { ready, loading, error, messages, sending, input, pendingImage } = props;
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList<ChatItem>>(null);
  const canSend = ready && !sending && (input.trim().length > 0 || pendingImage !== null);

  return (
    <KeyboardAvoidingView testID="chat" style={styles.root} behavior={Platform.OS === "web" ? undefined : "padding"}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          testID="chat-back"
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          onPress={props.onBack}
          hitSlop={10}
          style={({ pressed }) => [styles.back, { opacity: pressed ? 0.6 : 1 }]}
        >
          <BackIcon color={colors.textPrimary} />
        </Pressable>
        <View style={styles.titles}>
          <Text accessibilityRole="header" style={styles.title}>
            AI 코치
          </Text>
          {props.subtitle ? <Text style={styles.subtitle}>{props.subtitle}</Text> : null}
        </View>
      </View>

      {error ? (
        <View style={styles.pad}>
          <ErrorNotice testID="chat-error" message={error} onRetry={props.onRetry} />
        </View>
      ) : null}

      {!ready && loading ? (
        <View testID="chat-skeleton" style={[styles.pad, styles.skeletons]}>
          <Skeleton width="72%" height={64} radius={12} />
          <Skeleton width="48%" height={44} radius={12} />
        </View>
      ) : (
        <FlatList
          ref={list}
          testID="chat-messages"
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={Gap}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => <Bubble item={item} />}
          ListFooterComponent={sending ? <TypingDots /> : null}
        />
      )}

      {props.sendError ? (
        <Text testID="send-error" accessibilityRole="alert" style={styles.sendError}>
          {props.sendError}
        </Text>
      ) : null}

      {pendingImage ? (
        <View testID="pending-image" style={styles.pending}>
          <Image source={pendingImage} contentFit="cover" style={styles.pendingThumb} />
          <Text style={styles.pendingText}>사진 1장 첨부</Text>
          <Pressable
            testID="remove-image"
            accessibilityRole="button"
            accessibilityLabel="첨부 취소"
            onPress={props.onRemoveImage}
            hitSlop={8}
            style={styles.pendingRemove}
          >
            <CloseIcon color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.inputWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.inputBar}>
          <TextInput
            testID="chat-input"
            style={styles.input}
            value={input}
            onChangeText={props.onChangeInput}
            placeholder="분석 결과에 대해 무엇이든 물어보세요"
            placeholderTextColor={colors.textFaint}
            selectionColor={colors.brand}
            cursorColor={colors.brand}
            multiline
            maxLength={MAX_MESSAGE_LENGTH}
            editable={ready}
          />
          <Pressable
            testID="attach-image"
            accessibilityRole="button"
            accessibilityLabel="사진 첨부"
            disabled={!ready || sending}
            onPress={props.onPickImage}
            hitSlop={4}
            style={({ pressed }) => [styles.attach, { opacity: !ready || sending ? 0.4 : pressed ? 0.7 : 1 }]}
          >
            <ImageIcon color={colors.textMuted} />
          </Pressable>
          <Pressable
            testID="send-message"
            accessibilityRole="button"
            accessibilityLabel="보내기"
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={props.onSend}
            hitSlop={4}
            style={({ pressed }) => [styles.send, { opacity: !canSend ? 0.3 : pressed ? 0.85 : 1 }]}
          >
            <SendIcon color={VOID} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

function Bubble({ item }: { item: ChatItem }) {
  const mine = item.role === "user";
  const text = visibleText(item);
  return (
    <View testID={mine ? "bubble-user" : "bubble-model"} style={[styles.bubbleRow, mine ? styles.right : styles.left]}>
      {item.imageUri ? (
        <Image source={item.imageUri} contentFit="cover" style={styles.bubbleImage} accessibilityLabel="첨부한 사진" />
      ) : null}
      {text ? (
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleCoach]}>
          <Text selectable style={styles.bubbleText}>
            {text}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** 답을 기다리는 동안 점 세 개 — 웹 animate-bounce 대신 차례로 깜빡인다 */
function TypingDots() {
  const [dots] = useState(() => [0, 1, 2].map(() => new Animated.Value(0.3)));

  useEffect(() => {
    const useNativeDriver = Platform.OS !== "web";
    const loop = Animated.loop(
      Animated.stagger(
        150,
        dots.map((v) =>
          Animated.sequence([
            Animated.timing(v, { toValue: 1, duration: 300, useNativeDriver }),
            Animated.timing(v, { toValue: 0.3, duration: 300, useNativeDriver }),
          ]),
        ),
      ),
    );
    loop.start();
    return () => loop.stop();
  }, [dots]);

  return (
    <View testID="typing" style={[styles.bubbleRow, styles.left, styles.typingRow]}>
      <View style={[styles.bubble, styles.bubbleCoach, styles.typing]}>
        {dots.map((v, i) => (
          <Animated.View key={i} style={[styles.dot, { opacity: v }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgPage,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderCard,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  titles: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  pad: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  skeletons: {
    gap: 12,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  gap: {
    height: 12,
  },
  bubbleRow: {
    maxWidth: "86%",
    gap: 8,
  },
  left: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  right: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  bubbleMine: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentLine,
  },
  bubbleCoach: {
    backgroundColor: colors.bgNav,
    borderColor: colors.borderCard,
  },
  bubbleText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textPrimarySoft,
  },
  bubbleImage: {
    width: 150,
    height: 200,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderCard,
  },
  typingRow: {
    marginTop: 12,
  },
  typing: {
    flexDirection: "row",
    gap: 5,
    paddingVertical: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textMuted,
  },
  sendError: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.danger,
  },
  pending: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgSubtle,
  },
  pendingThumb: {
    width: 40,
    height: 40,
    borderRadius: 6,
  },
  pendingText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  pendingRemove: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  inputWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingVertical: 6,
    paddingLeft: 18,
    paddingRight: 6,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgNav,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 120,
    paddingTop: 8,
    paddingBottom: 8,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: em(14, -0.005),
    color: colors.textPrimary,
  },
  attach: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  send: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
});
