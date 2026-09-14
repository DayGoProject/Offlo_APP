/**
 * `getReactNativePersistence` 타입 보강.
 *
 * 런타임엔 있다 — Metro가 `@firebase/auth`의 react-native 빌드를 고른다.
 * 그런데 타입 진입점(`firebase/auth` → `auth-public.d.ts`)에는 빠져 있어서 이 함수 하나만 선언해 준다.
 * tsconfig `paths`로 RN 타입 전체를 덮으면 웹 미리보기가 쓰는 `signInWithPopup`이 사라진다.
 */
import type { Persistence } from "firebase/auth";

declare module "firebase/auth" {
  interface ReactNativeAsyncStorage {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }

  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
