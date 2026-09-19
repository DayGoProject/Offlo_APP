/**
 * AI 코치 채팅 계산 — 웹 `components/analysis/AnalysisChat.tsx`의 전송 규칙.
 * 순수 함수만 둔다 (타입만 import) — Node로 검증한다 (scripts/verify-M5-logic.mjs).
 *
 * 웹과 다른 점
 * 1. **대화가 서버 상한(50개)을 넘으면 오래된 메시지를 잘라 보낸다.** 웹은 51번째부터 400으로 대화가 막힌다
 * 2. **히스토리의 긴 답변은 2,000자로 잘라 보낸다.** 서버는 히스토리의 모든 메시지를 2,000자로 검사한다 —
 *    웹은 코치가 긴 답을 한 번 하면 다음 질문부터 400이 난다
 * 3. 실패한 전송을 "⚠️ …" 모델 메시지로 대화에 끼우지 않는다 — 웹은 그 문구가 다음 요청 히스토리에 섞여 코치에게 간다.
 *    앱은 보낸 글을 입력창으로 되돌리고 에러를 따로 띄운다 (화면이 한다)
 */
import type { ChatMessagePayload, TimePattern } from "@/services/api-types";

/** 서버 `/api/ai/chat` 상한 */
export const MAX_MESSAGES = 50;
export const MAX_MESSAGE_LENGTH = 2000;
/** 글 없이 이미지만 보낼 때의 본문 — 웹과 같다 */
export const IMAGE_ONLY_TEXT = "(이미지 첨부)";

export const DEFAULT_OPENING =
  "분석 결과에 대해 더 자세히 이야기 나눠볼까요? 궁금한 점이나 사용 패턴에 대해 말씀해 주세요. 이미지도 첨부하실 수 있어요.";

/** 화면에 그리는 한 줄 — 이미지는 기기 안의 주소만 들고 있다 (base64는 보낼 때 한 번만 만든다) */
export interface ChatItem {
  role: "user" | "model";
  text: string;
  imageUri?: string;
}

/** 첫 말풍선 — 분석의 첫 시간대 질문, 없으면 기본 인사 (웹과 같다) */
export function openingMessage(timePatterns: unknown): string {
  const first = Array.isArray(timePatterns) ? (timePatterns[0] as Partial<TimePattern> | undefined) : undefined;
  return typeof first?.question === "string" && first.question.trim() ? first.question : DEFAULT_OPENING;
}

/**
 * 서버로 보낼 메시지 목록 — 지난 대화 + 방금 보내는 메시지.
 * 이미지는 방금 보내는 메시지에만 싣는다 (히스토리에 계속 실으면 본문이 누적돼 상한을 넘는다 — 웹과 같다).
 */
export function buildChatPayload(
  history: ChatItem[],
  outgoing: { text: string; image?: { imageBase64: string; mimeType: string } },
): ChatMessagePayload[] {
  const past: ChatMessagePayload[] = history
    .slice(-(MAX_MESSAGES - 1))
    .map((m) => ({ role: m.role, text: m.text.slice(0, MAX_MESSAGE_LENGTH) }));
  const text = outgoing.text.trim() || IMAGE_ONLY_TEXT;
  return [...past, { role: "user", text: text.slice(0, MAX_MESSAGE_LENGTH), ...outgoing.image }];
}

/** 말풍선에 글을 그릴지 — 이미지만 보낸 메시지는 사진만 보인다 */
export function visibleText(item: ChatItem): string | null {
  return item.text && item.text !== IMAGE_ONLY_TEXT ? item.text : null;
}
