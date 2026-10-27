/**
 * 설정 — 불러오기와 저장만 여기서, 그리기는 SettingsView가 한다.
 *
 * 이름은 **서버의 이름**(`PATCH /api/users/me`)을 바꾼다 — 커뮤니티 글 · 댓글 · 랭킹에 보이는 이름이다. 서버가 저장에 성공한 뒤에만 Firebase 프로필도 맞춘다
 * (홈 인사말에 쓴다 · 실패해도 서버 이름은 이미 바뀐 것이니 무시한다).
 * 회원 탈퇴는 서버가 Supabase · Firestore · Firebase Auth 계정까지 지운다. 성공하면 곧바로 로그아웃해 라우트 가드가 로그인 화면으로 보낸다
 * (두 번 가면 안 되는 요청이라 재시도하지 않는다 — 실패하면 문구를 띄우고 사용자가 다시 누른다).
 */
import { updateProfile } from "firebase/auth";
import { Linking } from "react-native";

import { useAuth } from "@/auth-context";
import SettingsView from "@/components/settings/SettingsView";
import { useApiQuery } from "@/hooks/use-api-query";
import { useReminders } from "@/hooks/reminders-context";
import { nameSaveHint } from "@/logic/settings";
import { api } from "@/services/api";
import { ApiError, getErrorMessage } from "@/services/api-client";
import { PRIVACY_URL } from "@/config";
import { auth } from "@/services/firebase";

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const profile = useApiQuery((signal) => api.users.me(signal));
  const reminders = useReminders();

  const saveName = async (name: string): Promise<string | null> => {
    try {
      await api.users.updateName(name);
    } catch (e) {
      return e instanceof ApiError ? nameSaveHint(e.status, e.message) : getErrorMessage(e);
    }
    if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: name }).catch(() => {});
    profile.reload();
    return null;
  };

  const deleteAccount = async (): Promise<string | null> => {
    try {
      await api.users.deleteMe();
    } catch (e) {
      return getErrorMessage(e);
    }
    // 서버가 Firebase 계정까지 지웠다 — 이 기기의 로그인 상태(구글 · Firebase)를 정리한다. 가드가 로그인 화면으로 보낸다
    await signOut().catch(() => {});
    return null;
  };

  return (
    <SettingsView
      profile={profile.data?.user ?? null}
      providerIds={user?.providerData.map((p) => p.providerId) ?? []}
      loading={profile.loading}
      error={profile.error}
      onRetry={profile.reload}
      onSaveName={saveName}
      onSignOut={signOut}
      onDeleteAccount={deleteAccount}
      onOpenPrivacy={() => void Linking.openURL(PRIVACY_URL).catch(() => {})}
      reminders={{
        supported: reminders.supported,
        ready: reminders.ready,
        prefs: reminders.prefs,
        permission: reminders.permission,
        busy: reminders.busy,
        error: reminders.error,
        onToggle: (kind, on) => void reminders.setPref(kind, on),
        onOpenSettings: reminders.openSettings,
      }}
    />
  );
}
