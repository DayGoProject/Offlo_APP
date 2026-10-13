/**
 * 배지 — 불러오기와 자랑하기만 여기서, 그리기는 BadgesView가 한다.
 *
 * 불러오는 것: 배지 목록(필수) + 잠긴 배지의 진행도에 쓰는 분석 목록(최근 100건) · 동물의 연속 기록.
 * 뒤의 둘은 못 읽어도 배지는 그대로 보인다 — 진행 막대만 빠진다 (0으로 속여 그리지 않는다).
 * 자랑하기는 두 번 가면 글이 두 개 생기므로 재시도하지 않는다 (서버가 이미 공유한 배지는 409로 막는다 — 그때도 목록을 다시 읽어 "공유함"으로 맞춘다).
 */
import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";

import { useAuth } from "@/auth-context";
import BadgesView from "@/components/badges/BadgesView";
import { notifyPostsChanged } from "@/hooks/community-changed";
import { useApiQuery } from "@/hooks/use-api-query";
import { badgeStats, type BadgeStats } from "@/logic/badges";
import { api } from "@/services/api";
import { ApiError, getErrorMessage } from "@/services/api-client";
import type { Badge } from "@/services/api-types";
import { readGarden } from "@/services/garden";

export default function BadgesScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const query = useApiQuery<{ badges: Badge[]; stats: BadgeStats | null }>(async (signal) => {
    if (!user) throw new Error("로그인이 필요합니다.");
    const [{ badges }, analyses, garden] = await Promise.all([
      api.badges.list(signal),
      api.analyses.list({ limit: 100 }, signal).catch(() => null),
      readGarden(user.uid).catch(() => null),
    ]);
    const stats = analyses && garden ? badgeStats(analyses.analyses, garden.animal?.streak ?? 0, Date.now()) : null;
    return { badges, stats };
  });

  // 돌아올 때마다 다시 본다 — 분석 · 목표를 마쳐 새 배지를 받았을 수 있다. 첫 포커스는 위 불러오기가 한다
  const reload = query.reload;
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) reload();
      focusedOnce.current = true;
    }, [reload]),
  );

  const [sharing, setSharing] = useState(false);
  const share = async (badge: Badge, message: string): Promise<string | null> => {
    if (sharing) return null;
    setSharing(true);
    try {
      await api.community.shareBadge(badge.id, message);
      notifyPostsChanged();
      reload();
      router.navigate("/community");
      return null;
    } catch (e) {
      // 이미 공유됐다(다른 기기 · 응답만 잃은 이전 시도) — 목록을 다시 읽어 "공유함"으로 맞춘다
      if (e instanceof ApiError && e.status === 409) reload();
      return getErrorMessage(e);
    } finally {
      setSharing(false);
    }
  };

  return (
    <BadgesView
      badges={query.data?.badges ?? null}
      stats={query.data?.stats ?? null}
      loading={query.loading}
      error={query.error}
      onRetry={reload}
      onShare={share}
      onOpenCommunity={() => router.navigate("/community")}
    />
  );
}
