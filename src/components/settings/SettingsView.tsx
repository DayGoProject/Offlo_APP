/**
 * 설정 화면의 그림 — 데이터는 props로만 받는다 (mobile.md "웹 미리보기 — 미리보기 화면").
 * `app/(app)/settings.tsx`는 불러오기 · 저장 · 로그아웃 · 탈퇴를, `app/preview/settings.tsx`는 샘플 값 + 가짜 서버를 넘긴다.
 * 이 파일은 `api` · `useAuth` · Firebase를 import하지 않는다.
 *
 * 웹 `/settings`에서 **빠진 것**: 비밀번호 변경(로그인이 소셜 전용이라 비밀번호가 없다) · 테마(다크 단일 테마).
 * **들어온 것**: 이름 변경(서버 이름 — 커뮤니티에 공개된다) · 로그아웃 · 회원 탈퇴(확인 문구를 직접 입력해야 눌린다).
 */
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import Card, { CardHeader } from "@/components/app/Card";
import ErrorNotice from "@/components/app/ErrorNotice";
import PageHeader from "@/components/app/PageHeader";
import Pill from "@/components/app/Pill";
import Screen from "@/components/app/Screen";
import Skeleton from "@/components/app/Skeleton";
import TextField from "@/components/app/TextField";
import Avatar from "@/components/community/Avatar";
import RemindersCard, { type RemindersCardProps } from "@/components/settings/RemindersCard";
import { DELETE_LOSSES, DELETE_PHRASE, NAME_MAX, canDeleteAccount, checkName, joinedLabel, providerLabel } from "@/logic/settings";
import type { ApiUser } from "@/services/api-types";
import { colors, fonts, radius } from "@/theme";

export interface SettingsViewProps {
  profile: ApiUser | null;
  /** Firebase `providerData`의 providerId들 — 로그인 방식 라벨 */
  providerIds: readonly string[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** 이름 저장 — 실패하면 화면에 띄울 문구, 성공하면 null (부모가 서버 이름을 다시 읽는다) */
  onSaveName: (name: string) => Promise<string | null>;
  onSignOut: () => Promise<void>;
  /** 회원 탈퇴 — 실패하면 문구, 성공하면 null (이어서 로그아웃돼 로그인 화면으로 간다) */
  onDeleteAccount: () => Promise<string | null>;
  /** 리마인더(로컬 예약 알림) 설정 — 안 주면 카드를 그리지 않는다 */
  reminders?: RemindersCardProps;
}

export default function SettingsView({ profile, providerIds, loading, error, onRetry, onSaveName, onSignOut, onDeleteAccount, reminders }: SettingsViewProps) {
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <Screen testID="settings" refreshing={loading && profile !== null} onRefresh={onRetry}>
      <PageHeader eyebrow="계정 · 보안" title="설정" />

      {error ? <ErrorNotice testID="settings-error" message={error} onRetry={onRetry} /> : null}

      {!profile ? (
        error ? null : (
          <View testID="settings-skeleton" style={styles.skeletons}>
            <Skeleton height={96} radius={radius.card} />
            <Skeleton height={150} radius={radius.card} />
          </View>
        )
      ) : (
        <>
          <Card testID="settings-profile">
            <View style={styles.profile}>
              <Avatar name={profile.name} size={52} tone="brand" />
              <View style={styles.profileText}>
                <Text testID="settings-name" numberOfLines={1} style={styles.profileName}>
                  {profile.name}
                </Text>
                <Text testID="settings-email" numberOfLines={1} style={styles.profileEmail}>
                  {profile.email}
                </Text>
              </View>
              <View style={styles.chip}>
                <Text testID="settings-provider" style={styles.chipText}>
                  {providerLabel(providerIds)}
                </Text>
              </View>
            </View>
          </Card>

          {/* 이름 — 저장하면 서버 이름이 바뀐다 (`profile.name`이 새 이름이 되면 "바뀌지 않음"이라 저장 버튼이 다시 잠긴다) */}
          <NameCard current={profile.name} onSave={onSaveName} />

          {reminders ? <RemindersCard {...reminders} /> : null}

          <Card testID="settings-account">
            <CardHeader title="계정" />
            <View>
              <InfoRow label="로그인 방식" value={providerLabel(providerIds)} />
              <InfoRow label="가입일" value={joinedLabel(profile.createdAt)} />
              <InfoRow label="플랜" value={profile.premium ? "프리미엄" : "무료 플랜"} last />
            </View>
          </Card>

          <Card testID="settings-session" style={styles.menuCard}>
            <Pressable
              testID="settings-signout"
              accessibilityRole="button"
              disabled={signingOut}
              onPress={signOut}
              style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.menuLabel, { color: colors.danger }]}>{signingOut ? "로그아웃 중..." : "로그아웃"}</Text>
            </Pressable>
          </Card>

          <DeleteCard onDelete={onDeleteAccount} />
        </>
      )}
    </Screen>
  );
}

function NameCard({ current, onSave }: { current: string; onSave: (name: string) => Promise<string | null> }) {
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const checked = checkName(value, current);
  const dirty = checked.ok && checked.changed;

  async function save() {
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    if (!checked.changed || saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const failed = await onSave(checked.name);
      if (failed) {
        setError(failed);
      } else {
        setValue(checked.name); // 자른 이름으로 맞춘다
        setSaved(true);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card testID="settings-name-card">
      <CardHeader title="이름" />
      <TextField
        testID="name-input"
        label="표시 이름"
        hint="커뮤니티 피드와 랭킹에 이 이름이 공개됩니다."
        value={value}
        onChangeText={(text) => {
          setValue(text);
          setSaved(false);
          setError(null);
        }}
        maxLength={NAME_MAX}
        placeholder="이름을 입력하세요"
        returnKeyType="done"
        onSubmitEditing={save}
      />
      {error ? <ErrorNotice testID="name-error" message={error} /> : null}
      {saved ? (
        <Text testID="name-saved" accessibilityRole="alert" style={styles.ok}>
          이름이 저장됐어요.
        </Text>
      ) : null}
      <View style={styles.row}>
        <Pill testID="name-save" variant="accent" label={saving ? "저장 중…" : "이름 저장"} onPress={save} disabled={!dirty || saving} />
      </View>
    </Card>
  );
}

function DeleteCard({ onDelete }: { onDelete: () => Promise<string | null> }) {
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = canDeleteAccount(typed);

  async function remove() {
    if (!ready || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const failed = await onDelete();
      if (failed) setError(failed);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <View testID="settings-delete" style={styles.danger}>
      <Text accessibilityRole="header" style={styles.dangerTitle}>
        회원 탈퇴
      </Text>
      <Text style={styles.dangerBody}>탈퇴하면 아래 데이터가 모두 삭제되고 되돌릴 수 없어요.</Text>
      <View style={styles.losses}>
        {DELETE_LOSSES.map((item) => (
          <Text key={item} style={styles.loss}>
            · {item}
          </Text>
        ))}
      </View>
      <TextField
        testID="delete-input"
        label={`확인을 위해 "${DELETE_PHRASE}"를 입력하세요`}
        value={typed}
        onChangeText={(text) => {
          setTyped(text);
          setError(null);
        }}
        placeholder={DELETE_PHRASE}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!deleting}
      />
      {error ? <ErrorNotice testID="delete-error" message={error} /> : null}
      <View style={styles.row}>
        <Pill testID="delete-confirm" variant="danger" label={deleting ? "탈퇴 처리 중…" : "회원 탈퇴"} onPress={remove} disabled={!ready || deleting} />
      </View>
    </View>
  );
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.divider]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  skeletons: {
    gap: 20,
  },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  profileText: {
    flex: 1,
    gap: 3,
  },
  profileName: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  profileEmail: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  chip: {
    height: 24,
    paddingHorizontal: 11,
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  chipText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.brand,
  },
  row: {
    flexDirection: "row",
  },
  ok: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.brand,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.accentLine,
    backgroundColor: colors.accentSoft,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderCard,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  infoLabel: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  infoValue: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textPrimary,
  },
  menuCard: {
    paddingVertical: 4,
    gap: 0,
  },
  menuRow: {
    minHeight: 52,
    justifyContent: "center",
  },
  menuLabel: {
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  danger: {
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.dangerLine,
    backgroundColor: colors.dangerSoft,
  },
  dangerTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.danger,
  },
  dangerBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textPrimarySoft,
  },
  losses: {
    gap: 4,
  },
  loss: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
});
