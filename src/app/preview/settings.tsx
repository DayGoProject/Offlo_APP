/**
 * 설정 미리보기 — `?state=ready|premium|loading|error` (`&fail=name|delete|old`이면 그 서버 호출이 실패한다 — `old`는 서버가 이름 변경을 아직 모르는 상태(405)).
 * 샘플 값만 쓴다 (api · useAuth 금지). 저장 · 로그아웃 · 탈퇴는 **화면 안 가짜 서버**다 — 탈퇴를 눌러도 아무것도 지워지지 않는다.
 */
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";

import SettingsView from "@/components/settings/SettingsView";
import { nameSaveHint } from "@/logic/settings";
import { SETTINGS_USER } from "@/preview/samples";
import { API_MESSAGES } from "@/services/api-client";
import type { ApiUser } from "@/services/api-types";

const noop = () => {};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function SettingsPreview() {
  const { state = "ready", fail } = useLocalSearchParams<{ state?: string; fail?: string }>();
  const [profile, setProfile] = useState<ApiUser>({ ...SETTINGS_USER, premium: state === "premium" });
  const log = (entry: string) => {
    const g = globalThis as { __offloSettingsCalls?: string[] };
    (g.__offloSettingsCalls ??= []).push(entry);
  };

  return (
    <SettingsView
      profile={state === "loading" || state === "error" ? null : profile}
      providerIds={["google.com"]}
      loading={state === "loading"}
      error={state === "error" ? API_MESSAGES.network : null}
      onRetry={noop}
      onSaveName={async (name) => {
        log(`name ${JSON.stringify(name)}`);
        await sleep(250);
        if (fail === "name") return API_MESSAGES.network;
        if (fail === "old") return nameSaveHint(405, "Method Not Allowed");
        setProfile((p) => ({ ...p, name }));
        return null;
      }}
      onSignOut={async () => {
        log("signout");
        await sleep(150);
      }}
      onDeleteAccount={async () => {
        log("delete");
        await sleep(250);
        if (fail === "delete") return API_MESSAGES.network;
        return null;
      }}
    />
  );
}
