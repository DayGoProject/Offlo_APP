/**
 * 분석 기록 — 불러오기만 하고 그리기는 HistoryView가 한다.
 */
import { useState } from "react";
import { useRouter } from "expo-router";

import HistoryView from "@/components/history/HistoryView";
import { useApiQuery } from "@/hooks/use-api-query";
import type { HistoryFilter } from "@/logic/history";
import { api } from "@/services/api";

export default function HistoryScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<HistoryFilter>("all");
  // "상위 앱"이 apps를 쓴다 — 목록 API의 옵트인 파라미터로 받는다
  const history = useApiQuery((signal) => api.analyses.list({ limit: 100, includeApps: true }, signal));

  return (
    <HistoryView
      analyses={history.data?.analyses ?? null}
      loading={history.loading}
      error={history.error}
      onRetry={history.reload}
      filter={filter}
      onFilterChange={setFilter}
      onOpenAnalysis={() => router.navigate("/analysis")}
    />
  );
}
