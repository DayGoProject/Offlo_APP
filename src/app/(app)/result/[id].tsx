/**
 * 분석 결과 — 불러오기만 하고 그리기는 ResultView가 한다.
 * 분석 탭(저장 직후 · 오늘 결과 보기) · 분석 기록 · 최근 결과에서 들어온다.
 */
import { useLocalSearchParams, useRouter } from "expo-router";

import ResultView from "@/components/result/ResultView";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/services/api";

export default function ResultScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const result = useApiQuery((signal) => api.analyses.get(String(id), signal));

  return (
    <ResultView
      analysis={result.data?.analysis ?? null}
      loading={result.loading}
      error={result.error}
      onRetry={result.reload}
      onOpenChat={() => router.push({ pathname: "/chat/[id]", params: { id: String(id) } })}
      onOpenHistory={() => router.push("/history")}
    />
  );
}
