/**
 * Firebase — 네이티브(iOS·Android).
 *
 * 로그인 상태는 AsyncStorage에 남겨 앱을 껐다 켜도 유지한다 (웹의 localStorage 자리).
 * 저장은 Firebase SDK가 한다 — ID 토큰을 직접 꺼내 저장하지 않는다 (security.md).
 *
 * 웹 미리보기(RN Web)는 `firebase.web.ts` 를 쓴다.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from "firebase/auth";

import { firebaseConfig } from "@/config";

const isFirstLoad = getApps().length === 0;

export const app = isFirstLoad ? initializeApp(firebaseConfig) : getApp();

// initializeAuth는 앱당 한 번만 부를 수 있다 — Fast Refresh로 모듈이 다시 돌면 만들어 둔 인스턴스를 쓴다.
export const auth: Auth = isFirstLoad
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : getAuth(app);
