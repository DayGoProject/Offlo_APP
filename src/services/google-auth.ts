/**
 * Google 로그인 — 네이티브(Android dev build · M8부터 iOS).
 *
 * 계정 선택 → idToken → Firebase `signInWithCredential`.
 * `expo-auth-session`을 쓰지 않는다 — Google이 안드로이드 OAuth 클라이언트의 커스텀 URI scheme
 * 리다이렉트를 기본 차단한다. 네이티브 SDK는 리다이렉트 없이 토큰을 받는다.
 *
 * 웹 미리보기는 `google-auth.web.ts`.
 */
import Constants, { ExecutionEnvironment } from "expo-constants";
import { GoogleAuthProvider, signInWithCredential, type UserCredential } from "firebase/auth";
import type * as GoogleSigninModule from "@react-native-google-signin/google-signin";

import { GOOGLE_WEB_CLIENT_ID } from "@/config";
import { AuthFlowError } from "@/services/auth-errors";
import { auth } from "@/services/firebase";

type GoogleSigninLib = typeof GoogleSigninModule;

/** Android GoogleSignInStatusCodes.DEVELOPER_ERROR — SHA-1·클라이언트 ID가 등록값과 다를 때 */
const ANDROID_DEVELOPER_ERROR = "10";

let configured = false;

/**
 * 누를 때 불러온다 — 이 라이브러리는 import 순간 네이티브 모듈을 찾아서,
 * 모듈이 없는 Expo Go에선 앱 전체가 뜨지 않는다. Expo Go면 null.
 */
function loadNative(): GoogleSigninLib | null {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- 정적 import면 Expo Go에서 앱이 뜨지 않는다
  const lib = require("@react-native-google-signin/google-signin") as GoogleSigninLib;
  if (!configured) {
    lib.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    configured = true;
  }
  return lib;
}

/** 사용자가 계정 선택을 취소하면 null */
export async function signInWithGoogleProvider(): Promise<UserCredential | null> {
  const lib = loadNative();
  if (!lib) throw new AuthFlowError("expo-go");
  if (!GOOGLE_WEB_CLIENT_ID) throw new AuthFlowError("config-missing");

  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = lib;

  let idToken: string | null;
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null;
    idToken = response.data.idToken;
  } catch (e) {
    if (isErrorWithCode(e)) {
      switch (e.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          return null;
        case statusCodes.IN_PROGRESS:
          throw new AuthFlowError("in-progress");
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          throw new AuthFlowError("play-services");
        case ANDROID_DEVELOPER_ERROR:
          throw new AuthFlowError("developer-error");
      }
    }
    throw e;
  }

  if (!idToken) throw new AuthFlowError("missing-id-token");
  return signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
}

/** 다음 로그인 때 계정 선택 창이 다시 뜨도록 Google 쪽 세션도 끊는다 */
export async function signOutGoogleProvider(): Promise<void> {
  const lib = loadNative();
  if (!lib) return;
  await lib.GoogleSignin.signOut().catch(() => {});
}
