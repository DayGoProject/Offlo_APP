/**
 * AI 코치 채팅 — 분석을 불러와 대화 문맥으로 쓰고, 전송은 여기서 한다. 그리기는 ChatView가 한다.
 *
 * - 대화는 **앱을 켜 둔 동안만** 분석별로 기억한다 (결과 화면에 다녀와도 이어진다). 기기에 저장하지 않는다 —
 *   웹도 페이지를 떠나면 대화가 사라진다
 * - 사진은 보낼 때 한 번만 압축해 마지막 메시지에 싣는다 (logic/chat.ts `buildChatPayload`)
 * - 보내지 못하면 글과 사진을 입력창으로 되돌린다 — 실패한 메시지를 대화에 남기지 않는다
 * - AI 호출이라 자동으로 다시 보내지 않는다 (api-client가 재시도하지 않는다)
 */
import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import ChatView from "@/components/chat/ChatView";
import { useApiQuery } from "@/hooks/use-api-query";
import { analysisContext } from "@/logic/analysis";
import { IMAGE_ONLY_TEXT, buildChatPayload, openingMessage, type ChatItem } from "@/logic/chat";
import { api, getErrorMessage } from "@/services/api";
import { ImageError, getImageErrorMessage, pickImage, toInlineImage } from "@/services/image";
import { fmtDate } from "@/shared/format";

const sessions = new Map<string, ChatItem[]>();

export default function ChatScreen() {
  const router = useRouter();
  const id = String(useLocalSearchParams<{ id: string }>().id);
  const loaded = useApiQuery((signal) => api.analyses.get(id, signal));
  const analysis = loaded.data?.analysis ?? null;

  const [stored, setStored] = useState<ChatItem[] | null>(() => sessions.get(id) ?? null);
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  // 첫 말풍선은 분석을 불러와야 정해진다 (첫 시간대 질문)
  const messages: ChatItem[] =
    stored ?? (analysis ? [{ role: "model", text: openingMessage(analysis.timePatterns) }] : []);

  // 화면을 떠나면 기다리던 답을 버린다
  useEffect(() => () => controller.current?.abort(), []);

  function commit(next: ChatItem[]) {
    sessions.set(id, next);
    setStored(next);
  }

  async function attach() {
    try {
      const uri = await pickImage();
      if (uri) {
        setPendingImage(uri);
        setSendError(null);
      }
    } catch (e) {
      setSendError(getImageErrorMessage(e));
    }
  }

  async function send() {
    if (!analysis || sending) return;
    const text = input.trim();
    const imageUri = pendingImage;
    if (!text && !imageUri) return;

    const history = messages;
    const mine: ChatItem = { role: "user", text: text || IMAGE_ONLY_TEXT, ...(imageUri && { imageUri }) };
    commit([...history, mine]);
    setInput("");
    setPendingImage(null);
    setSendError(null);
    setSending(true);

    const abort = new AbortController();
    controller.current = abort;
    try {
      const image = imageUri ? await toInlineImage(imageUri) : undefined;
      const { reply } = await api.ai.chat(
        {
          analysisId: analysis.id,
          messages: buildChatPayload(history, { text, image }),
          analysisContext: analysisContext(analysis),
        },
        abort.signal,
      );
      commit([...history, mine, { role: "model", text: reply }]);
    } catch (e) {
      if (abort.signal.aborted) return;
      commit(history);
      setInput(text);
      setPendingImage(imageUri);
      setSendError(e instanceof ImageError ? e.message : getErrorMessage(e));
    } finally {
      if (controller.current === abort) controller.current = null;
      if (!abort.signal.aborted) setSending(false);
    }
  }

  return (
    <ChatView
      subtitle={analysis ? `${analysis.periodType === "weekly" ? "주간" : "일간"} 분석 · ${fmtDate(analysis.createdAt)}` : null}
      ready={analysis !== null}
      loading={loaded.loading}
      error={loaded.error}
      onRetry={loaded.reload}
      messages={messages}
      sending={sending}
      sendError={sendError}
      input={input}
      onChangeInput={setInput}
      pendingImage={pendingImage}
      onPickImage={attach}
      onRemoveImage={() => setPendingImage(null)}
      onSend={send}
      onBack={() => router.back()}
    />
  );
}
