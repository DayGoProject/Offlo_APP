/**
 * "목표가 바뀌었다" 알림 — 홈(진행 중 목표)과 정원(완료하면 식물이 자란다)은 탭이라 한 번 불러온 뒤 계속 살아 있다.
 * 목표를 만들거나 고치거나 완료하거나 지우면 `notifyGoalsChanged()`를 부르고, 듣고 있는 화면이 다시 불러온다 (`analyses-changed.ts`와 같은 방식).
 *
 *   useGoalsChanged(dashboard.reload);
 */
import { useEffect, useEffectEvent } from "react";

const listeners = new Set<() => void>();

export function notifyGoalsChanged(): void {
  for (const listener of listeners) listener();
}

export function useGoalsChanged(callback: () => void): void {
  const onChange = useEffectEvent(callback);
  useEffect(() => {
    const listener = () => onChange();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
}
