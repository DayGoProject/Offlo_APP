/**
 * Google 로그인 — 웹 미리보기(RN Web). 웹 레포와 같은 팝업 방식이다.
 * 네이티브는 `google-auth.ts`.
 */
import { GoogleAuthProvider, signInWithPopup, type UserCredential } from "firebase/auth";

import { getErrorCode } from "@/services/auth-errors";
import { auth } from "@/services/firebase";

const CANCEL_CODES = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

/** 사용자가 팝업을 닫으면 null */
export async function signInWithGoogleProvider(): Promise<UserCredential | null> {
  try {
    return await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    if (CANCEL_CODES.has(getErrorCode(e))) return null;
    throw e;
  }
}

export async function signOutGoogleProvider(): Promise<void> {
  // 팝업 방식은 Firebase 로그아웃만으로 충분하다
}
