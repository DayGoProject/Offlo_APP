/**
 * 화면에서 API 데이터를 읽는 기본 틀 — 로딩 · 한국어 에러 · 다시 시도.
 *
 *   const profile = useApiQuery((signal) => api.users.me(signal));
 *
 * - 로딩은 finally에서 끈다 (mobile.md — 웹 13단계 교훈)
 * - 화면이 사라지거나 다시 시도하면 이전 요청을 취소하고, 늦게 온 응답은 버린다
 */
import { useEffect, useEffectEvent, useState } from "react";

import { getErrorMessage } from "@/services/api-client";

interface QueryState<T> {
  data: T | null;
  /** 화면에 그대로 띄울 한국어 한 줄 */
  error: string | null;
  loading: boolean;
}

export function useApiQuery<T>(fetcher: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<QueryState<T>>({ data: null, error: null, loading: true });
  const [attempt, setAttempt] = useState(0);
  const load = useEffectEvent(fetcher);

  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      setState((prev) => ({ ...prev, error: null, loading: true }));
      try {
        const data = await load(controller.signal);
        if (!controller.signal.aborted) setState((prev) => ({ ...prev, data }));
      } catch (e) {
        // 이전 데이터는 남긴다 — 새로고침이 실패해도 화면이 비지 않게
        if (!controller.signal.aborted) setState((prev) => ({ ...prev, error: getErrorMessage(e) }));
      } finally {
        if (!controller.signal.aborted) setState((prev) => ({ ...prev, loading: false }));
      }
    }

    run();
    return () => controller.abort();
  }, [attempt]);

  return { ...state, reload: () => setAttempt((n) => n + 1) };
}
