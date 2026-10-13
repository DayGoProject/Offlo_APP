/**
 * 배지 미리보기 — `?state=ready|all|empty|nostats|loading|error` (`&share=bd-1`이면 그 배지의 자랑하기 모달을 열어 둔다 · `&fail=1`이면 공유가 실패한다 ·
 * `&fail=409`면 "이미 공유한 배지입니다" 응답). 샘플 값만 쓴다 (api · useAuth 금지). 공유는 **화면 안 가짜 서버**로 동작한다.
 */
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";

import BadgesView from "@/components/badges/BadgesView";
import { BADGES_READY, BADGE_STATS } from "@/preview/samples";
import { API_MESSAGES } from "@/services/api-client";
import type { Badge } from "@/services/api-types";
import { ALL_BADGES } from "@/shared/badge-utils";

const noop = () => {};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ALL: Badge[] = ALL_BADGES.map((b, i) => ({ id: `bd-all-${i}`, userId: "sample", name: b.name, earnedAt: "2026-09-16T12:00:00.000Z", shared: false }));

export default function BadgesPreview() {
  const { state = "ready", share, fail } = useLocalSearchParams<{ state?: string; share?: string; fail?: string }>();
  const initial = state === "ready" || state === "nostats" ? BADGES_READY : state === "all" ? ALL : [];
  const [badges, setBadges] = useState<Badge[]>(initial);
  const log = (entry: string) => {
    const g = globalThis as { __offloBadgeCalls?: string[] };
    (g.__offloBadgeCalls ??= []).push(entry);
  };

  return (
    <BadgesView
      badges={state === "loading" || state === "error" ? null : badges}
      // 첫 사용이면 분석도 연속 기록도 없다 — 진행도가 전부 0이다
      stats={state === "nostats" ? null : state === "empty" ? { total: 0, weekly: 0, dailyThisWeek: 0, streak: 0 } : BADGE_STATS}
      loading={state === "loading"}
      error={state === "error" ? API_MESSAGES.network : null}
      onRetry={noop}
      startShareId={share}
      onOpenCommunity={() => log("community")}
      onShare={async (badge, message) => {
        log(`share ${badge.id} ${JSON.stringify(message)}`);
        await sleep(250);
        if (fail === "1") return API_MESSAGES.network;
        if (fail === "409") {
          setBadges((list) => list.map((b) => (b.id === badge.id ? { ...b, shared: true } : b)));
          return "이미 공유한 배지입니다.";
        }
        setBadges((list) => list.map((b) => (b.id === badge.id ? { ...b, shared: true } : b)));
        log("community");
        return null;
      }}
    />
  );
}
