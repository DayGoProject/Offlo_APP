/**
 * 인증 컨텍스트 — 웹 `context/AuthContext.tsx` 이식.
 *
 * **로그인이 곧 가입이다 (M9 결정)** — Google로 처음 로그인하면 그 자리에서 계정이 만들어진다 (`POST /api/users` — 서버가 uid 기준 upsert). 이메일 가입은 앱 · 웹 어디에도 없다.
 * 예전에는 처음 로그인한 계정을 지우고 막았지만("가입은 웹에서") 스토어에서 내려받은 일반 사용자가 쓸 수 없어서 없앴다.
 *
 * 웹과 다른 점 하나: 서버 프로필 만들기(`POST /api/users`)가 끝날 때까지 `user`를 null로 둔다.
 * Firebase는 signInWithCredential 직후 곧바로 로그인 상태를 알리는데, 그 순간 라우트 가드가 홈으로 넘겨 버리면
 * 서버 프로필이 없는 채로 모든 API가 깨져 보이고, 프로필 만들기가 실패했을 때 안내를 띄울 로그인 화면도 먼저 사라진다.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, type User } from "firebase/auth";

import { api } from "@/services/api";
import { auth } from "@/services/firebase";
import { signInWithGoogleProvider, signOutGoogleProvider } from "@/services/google-auth";

interface AuthValue {
  user: User | null;
  /** 저장된 로그인 상태를 읽는 중 */
  loading: boolean;
  /** 로그인되면 true, 사용자가 취소하면 false. 실패는 throw — 화면이 한국어로 바꿔 보여준다 */
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

async function signOutEverywhere() {
  await signOutGoogleProvider();
  await firebaseSignOut(auth);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setFirebaseUser(currentUser);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthValue>(() => {
    async function signInWithGoogle() {
      setVerifying(true);
      try {
        const result = await signInWithGoogleProvider();
        if (!result) return false;

        // 처음 로그인이면 여기서 서버 프로필이 만들어지고(가입), 기존 사용자면 그대로 둔다 (서버가 upsert · 같은 값을 다시 보내도 결과가 같다).
        // 실패하면 로그인도 되돌린다 — Supabase 유저 없이 들어가면 이후 모든 API가 깨진 채로 보인다.
        try {
          await api.users.ensure({
            email: result.user.email ?? "",
            name: result.user.displayName ?? result.user.email ?? "",
          });
        } catch (e) {
          await signOutEverywhere();
          throw e;
        }
        return true;
      } finally {
        setVerifying(false);
      }
    }

    return {
      user: verifying ? null : firebaseUser,
      loading,
      signInWithGoogle,
      signOut: signOutEverywhere,
    };
  }, [firebaseUser, loading, verifying]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth는 AuthProvider 안에서만 쓸 수 있습니다.");
  return ctx;
}
