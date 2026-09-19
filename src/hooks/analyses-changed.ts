/**
 * "분석 기록이 바뀌었다" 알림 — 탭 화면은 한 번 불러온 뒤 계속 살아 있어서, 분석을 저장해도 홈 · 기록이
 * 예전 숫자를 보여 준다. 저장한 쪽이 `notifyAnalysesChanged()`를 부르면 듣고 있는 화면이 다시 불러온다.
 *
 *   useAnalysesChanged(dashboard.reload);
 */
import { useEffect, useEffectEvent } from "react";

const listeners = new Set<() => void>();

export function notifyAnalysesChanged(): void {
  for (const listener of listeners) listener();
}

export function useAnalysesChanged(callback: () => void): void {
  const onChange = useEffectEvent(callback);
  useEffect(() => {
    const listener = () => onChange();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
}
