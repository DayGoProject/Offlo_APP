/**
 * 앱의 API 클라이언트 — 앱의 모든 API 호출은 여기서 `api`를 가져간다 (mobile.md).
 * 화면에서 직접 fetch 하지 않는다.
 *
 * 타임아웃 · 재시도 · 에러 · 엔드포인트는 api-client.ts 에 있다.
 * 여기서는 환경변수와 Firebase ID 토큰만 연결한다.
 */
import { API_BASE_URL } from "@/config";
import { createApiClient } from "@/services/api-client";
import { auth } from "@/services/firebase";

export { ApiError, API_MESSAGES, getErrorMessage, type ApiErrorKind } from "@/services/api-client";
export type * from "@/services/api-types";

export const api = createApiClient({
  baseUrl: API_BASE_URL,
  getToken: async (forceRefresh) => (auth.currentUser ? auth.currentUser.getIdToken(forceRefresh) : null),
});
