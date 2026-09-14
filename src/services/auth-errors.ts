/**
 * 로그인 에러 → 한국어 안내. 웹 `services/auth.ts`의 getAuthErrorMessage에서
 * 이메일 계열 코드를 뺀 것 + 네이티브 Google 로그인 코드.
 */
import { ApiError } from "@/services/api";

/** Firebase·Google 코드가 아닌, 앱 로그인 절차가 직접 던지는 사유 */
export type AuthFlowCode =
  | "no-account"
  | "expo-go"
  | "config-missing"
  | "missing-id-token"
  | "in-progress"
  | "play-services"
  | "developer-error";

export class AuthFlowError extends Error {
  constructor(readonly code: AuthFlowCode) {
    super(code);
    this.name = "AuthFlowError";
  }
}

export function getErrorCode(err: unknown): string {
  if (err && typeof err === "object" && "code" in err && typeof err.code === "string") return err.code;
  return "";
}

export function getAuthErrorMessage(err: unknown): string {
  // 서버가 준 한국어 메시지를 그대로 보여준다
  if (err instanceof ApiError) return err.message;

  const code = err instanceof AuthFlowError ? err.code : getErrorCode(err);
  switch (code) {
    case "no-account":
      return "가입된 계정이 없습니다. Offlo 웹에서 먼저 회원가입을 진행해주세요.";
    case "expo-go":
      return "Expo Go에서는 Google 로그인을 쓸 수 없습니다. 개발 빌드에서 확인해주세요.";
    case "config-missing":
      return "Google 로그인 설정이 비어 있습니다. (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID)";
    case "missing-id-token":
      return "Google 인증 토큰을 받지 못했습니다. 웹 클라이언트 ID 설정을 확인해주세요.";
    case "in-progress":
      return "이미 로그인이 진행 중입니다.";
    case "play-services":
      return "Google Play 서비스를 사용할 수 없습니다. 기기에서 Play 서비스를 업데이트해주세요.";
    case "developer-error":
      return "Google 로그인 설정이 맞지 않습니다. OAuth 클라이언트의 SHA-1과 웹 클라이언트 ID를 확인해주세요. (DEVELOPER_ERROR)";

    case "auth/network-request-failed":
      return "네트워크 연결에 실패했습니다. 인터넷 상태를 확인해주세요.";
    case "auth/too-many-requests":
      return "시도 횟수가 많아 일시적으로 차단되었습니다. 잠시 후 다시 시도해주세요.";
    case "auth/operation-not-allowed":
      return "Google 로그인이 비활성화되어 있습니다. (auth/operation-not-allowed)";
    case "auth/user-disabled":
      return "사용이 중지된 계정입니다.";
    case "auth/invalid-credential":
      return "Google 인증 정보가 올바르지 않습니다. 다시 시도해주세요. (auth/invalid-credential)";

    /* 웹 미리보기(RN Web)에서만 나오는 팝업 계열 */
    case "auth/unauthorized-domain":
      return "이 주소는 Firebase 승인된 도메인이 아닙니다. (auth/unauthorized-domain)";
    case "auth/popup-blocked":
      return "브라우저가 로그인 팝업을 차단했습니다. 팝업 차단을 해제한 뒤 다시 시도해주세요.";

    default:
      // 알 수 없는 코드는 그대로 노출한다 — 없으면 원인 파악이 불가능하다 (웹과 동일)
      return code ? `오류가 발생했습니다. 다시 시도해주세요 (${code})` : "오류가 발생했습니다. 다시 시도해주세요";
  }
}
