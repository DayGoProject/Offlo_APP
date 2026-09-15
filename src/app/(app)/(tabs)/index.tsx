/**
 * 홈 = 대시보드. 여기서는 불러오기만 하고 그리기는 DashboardView가 한다.
 */
import { useState } from "react";
import { useRouter } from "expo-router";

import { useAuth } from "@/auth-context";
import DashboardView, { type DashboardData } from "@/components/dashboard/DashboardView";
import { useApiQuery } from "@/hooks/use-api-query";
import { firstName, firstRecommendation } from "@/logic/dashboard";
import { api } from "@/services/api";
import { readGarden } from "@/services/garden";

export default function HomeTab() {
  const router = useRouter();
  const { user } = useAuth();
  // 화면을 연 시각 기준으로 오늘·이번 주를 정한다
  const [now] = useState(() => new Date());

  const dashboard = useApiQuery<DashboardData>(async (signal) => {
    if (!user) throw new Error("로그인이 필요합니다.");
    const [{ analyses }, { goals }, garden] = await Promise.all([
      api.analyses.list({ limit: 10 }, signal),
      api.goals.list("active", signal),
      readGarden(user.uid),
    ]);

    // 목록 API는 recommendations를 싣지 않는다 — AI 한마디 한 줄을 위해 최신 분석 한 건만 더 읽는다
    let tip: string | null = null;
    if (analyses[0]) {
      try {
        const { analysis } = await api.analyses.get(analyses[0].id, signal);
        tip = firstRecommendation(analysis.recommendations);
      } catch {
        // 한마디는 없어도 대시보드는 온전하다
      }
    }
    return { analyses, goals, garden, tip };
  });

  return (
    <DashboardView
      name={firstName(user?.displayName, user?.email)}
      now={now}
      data={dashboard.data}
      loading={dashboard.loading}
      error={dashboard.error}
      onRetry={dashboard.reload}
      onOpenHistory={() => router.push("/history")}
      onOpenAnalysis={() => router.navigate("/analysis")}
      onOpenGoals={() => router.navigate("/more")}
      onOpenGarden={() => router.navigate("/garden")}
    />
  );
}
