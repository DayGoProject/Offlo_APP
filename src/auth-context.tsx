/**
 * 인증 컨텍스트 — 웹 `context/AuthContext.tsx` 이식.
 *
 * 웹과 다른 점 하나: 로그인 절차(미가입자 차단 → POST /api/users)가 끝날 때까지 `user`를 null로 둔다.
 * Firebase는 signInWithCredential 직후 곧바로 로그인 상태를 알리는데, 그 순간 라우트 가드가
 * 홈으로 넘겨 버리면 "가입된 계정이 없습니다" 안내를 띄울 로그인 화면이 먼저 사라진다.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getAdditionalUserInfo, onAuthStateChanged, signOut as firebaseSignOut, type User } from "firebase/auth";

import { api } from "@/services/api";
import { AuthFlowError } from "@/services/auth-errors";
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

        // 웹 로그인 페이지와 동일 — 방금 만들어진 계정이면 지우고 막는다 (security.md)
        if (getAdditionalUserInfo(result)?.isNewUser) {
          await result.user.delete().catch(() => firebaseSignOut(auth));
          await signOutGoogleProvider();
          throw new AuthFlowError("no-account");
        }

        // 서버가 upsert라 기존 사용자면 그대로 둔다. 실패하면 로그인도 되돌린다 —
        // Supabase 유저 없이 들어가면 이후 모든 API가 깨진 채로 보인다.
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
