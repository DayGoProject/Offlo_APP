/**
 * AI 코치 채팅 미리보기 — `?state=ready|sending|send-error|loading|error`. 샘플 값만 쓴다 (api · useAuth 금지).
 * 입력창은 실제로 타이핑된다 (보내기 버튼 활성화 확인용). 보내기 · 첨부는 아무 일도 하지 않는다.
 */
import { useState } from "react";
import { useLocalSearchParams } from "expo-router";

import ChatView from "@/components/chat/ChatView";
import { CHAT_MESSAGES, SAMPLE_SCREENSHOT } from "@/preview/samples";
import { API_MESSAGES } from "@/services/api-client";

const noop = () => {};

export default function ChatPreview() {
  const { state = "ready" } = useLocalSearchParams<{ state?: string }>();
  const [input, setInput] = useState(state === "send-error" ? "밤에 휴대폰을 덜 보려면 어떻게 해야 할까요?" : "");
  const ready = state === "ready" || state === "sending" || state === "send-error";

  return (
    <ChatView
      subtitle={ready ? "일간 분석 · 2026.09.17" : null}
      ready={ready}
      loading={state === "loading"}
      error={state === "error" ? API_MESSAGES.network : null}
      onRetry={noop}
      messages={ready ? (state === "ready" ? CHAT_MESSAGES.slice(0, 3) : CHAT_MESSAGES) : []}
      sending={state === "sending"}
      sendError={state === "send-error" ? API_MESSAGES.timeout : null}
      input={input}
      onChangeInput={setInput}
      pendingImage={state === "send-error" ? SAMPLE_SCREENSHOT : null}
      onPickImage={noop}
      onRemoveImage={noop}
      onSend={noop}
      onBack={noop}
    />
  );
}
