/**
 * "커뮤니티 글이 바뀌었다" 알림 — 커뮤니티 탭은 한 번 불러온 뒤 계속 살아 있다. 배지를 자랑해 글이 새로 생기면
 * `notifyPostsChanged()`를 부르고, 듣고 있는 피드가 첫 페이지를 다시 불러온다 (`analyses-changed.ts`와 같은 방식).
 *
 *   usePostsChanged(feed.refresh);
 */
import { useEffect, useEffectEvent } from "react";

const listeners = new Set<() => void>();

export function notifyPostsChanged(): void {
  for (const listener of listeners) listener();
}

export function usePostsChanged(callback: () => void): void {
  const onChange = useEffectEvent(callback);
  useEffect(() => {
    const listener = () => onChange();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
}
