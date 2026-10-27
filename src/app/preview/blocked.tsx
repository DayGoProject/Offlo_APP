/**
 * 차단한 사용자 미리보기 — `?state=ready|empty|loading|error` (`&fail=unblock`이면 차단 해제가 실패한다 · `&slow=1`이면 서버가 느리다).
 * 샘플 값만 쓴다 (api · useAuth 금지). 해제는 **화면 안 가짜 서버**다 — 풀면 목록에서 빠지고 호출 기록은 `globalThis.__offloBlockedCalls`에 남는다.
 */
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";

import BlockedUsersView from "@/components/settings/BlockedUsersView";
import { BLOCKED_USERS } from "@/preview/samples";
import { API_MESSAGES } from "@/services/api-client";
import type { BlockedUser } from "@/services/api-types";

const noop = () => {};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function BlockedPreview() {
  const { state = "ready", fail, slow } = useLocalSearchParams<{ state?: string; fail?: string; slow?: string }>();
  const [items, setItems] = useState<BlockedUser[]>(state === "ready" ? BLOCKED_USERS.map((u) => ({ ...u })) : []);

  return (
    <BlockedUsersView
      items={state === "loading" || state === "error" ? null : items}
      loading={state === "loading"}
      error={state === "error" ? API_MESSAGES.network : null}
      onRetry={noop}
      onUnblock={async (user) => {
        const g = globalThis as { __offloBlockedCalls?: string[] };
        (g.__offloBlockedCalls ??= []).push(`unblock ${user.userId}`);
        await sleep(slow === "1" ? 900 : 200);
        if (fail === "unblock") return API_MESSAGES.network;
        setItems((prev) => prev.filter((u) => u.userId !== user.userId));
        return null;
      }}
    />
  );
}
