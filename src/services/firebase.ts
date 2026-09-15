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
import { getFirestore, initializeFirestore, setLogLevel, type Firestore } from "firebase/firestore";

import { firebaseConfig } from "@/config";

const isFirstLoad = getApps().length === 0;

export const app = isFirstLoad ? initializeApp(firebaseConfig) : getApp();

// initializeAuth는 앱당 한 번만 부를 수 있다 — Fast Refresh로 모듈이 다시 돌면 만들어 둔 인스턴스를 쓴다.
export const auth: Auth = isFirstLoad
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : getAuth(app);

/**
 * Firestore — **읽기 전용으로만 쓴다** (정원 상태 · M8 알림 구독).
 * 쓰기는 보안 규칙이 막고 있고 전부 `api.garden.*` 로 보낸다 (security.md).
 * RN에서는 스트리밍 연결이 불안정해 롱폴링을 강제한다.
 */
export const db: Firestore = isFirstLoad
  ? initializeFirestore(app, { experimentalForceLongPolling: true })
  : getFirestore(app);

// Firestore SDK는 오프라인이면 "Could not reach Cloud Firestore backend"를 console.error로 남긴다.
// 개발 빌드에선 그게 화면 아래 빨간 알림으로 떠 탭바를 가린다 (M3 비행기 모드 점검에서 확인).
// 실패는 getDoc이 던지는 에러로 받아 services/garden.ts가 한국어 안내로 바꾸므로 SDK 자체 로그는 끈다.
setLogLevel("silent");
