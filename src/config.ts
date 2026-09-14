/**
 * 환경변수 — `.env.local` (템플릿: `.env.example`).
 *
 * `EXPO_PUBLIC_*` 는 번들에 평문으로 박힌다 (.claude/rules/security.md).
 * 공개 전제인 값만 여기로 온다 — 서버 키는 이 파일에 절대 추가하지 않는다.
 *
 * Metro는 `process.env.EXPO_PUBLIC_X` 를 **글자 그대로** 써야 치환한다.
 * `process.env[name]` 처럼 동적으로 읽으면 번들에서 비어 버린다.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`환경변수 ${name}이(가) 비어 있습니다 — .env.example을 .env.local로 복사해 값을 채워주세요.`);
  }
  return value;
}

export const firebaseConfig = {
  apiKey: required("EXPO_PUBLIC_FIREBASE_API_KEY", process.env.EXPO_PUBLIC_FIREBASE_API_KEY),
  authDomain: required("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN", process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: required("EXPO_PUBLIC_FIREBASE_PROJECT_ID", process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: required("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET", process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: required(
    "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  ),
  appId: required("EXPO_PUBLIC_FIREBASE_APP_ID", process.env.EXPO_PUBLIC_FIREBASE_APP_ID),
};

export const API_BASE_URL = required("EXPO_PUBLIC_API_BASE_URL", process.env.EXPO_PUBLIC_API_BASE_URL);

/**
 * Google 웹 클라이언트 ID — 네이티브 로그인이 idToken을 받으려면 필요하다.
 * 비어 있어도 앱은 뜬다. 로그인 버튼을 누르는 순간에만 안내한다.
 */
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
