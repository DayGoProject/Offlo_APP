/**
 * 커뮤니티 이용 규칙 동의 문 — 글 · 댓글을 쓰기 **직전에** 규칙을 보여 주고 동의를 받는다 (Play UGC 정책 · `logic/moderation.ts`).
 *
 *   const ok = await rules.ensure();   // 이미 동의했으면 바로 true · 아니면 규칙 창을 띄우고 동의하면 true · 닫으면 false
 *
 * 저장소(`RulesStore`)를 받으니 미리보기도 같은 훅을 쓴다. 규칙 창은 "규칙 보기"(`show`)로도 열 수 있다 — 이미 동의한 사람에게는 읽기 전용이다.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import type { RulesStore } from "@/services/community-rules";

export interface CommunityRules {
  /** 저장된 동의를 읽었는가 전에는 null */
  accepted: boolean | null;
  /** 규칙 창이 열려 있는가 */
  open: boolean;
  /** 쓰기 직전에 부른다 — 동의했으면 true */
  ensure: () => Promise<boolean>;
  /** 창에서 "동의하고 계속" */
  accept: () => void;
  /** 창을 닫는다 (동의 전이면 기다리던 쓰기는 취소된다) */
  dismiss: () => void;
  /** 규칙 다시 보기 */
  show: () => void;
}

export function useCommunityRules(store: RulesStore): CommunityRules {
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const acceptedRef = useRef<boolean | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const storeRef = useRef(store);
  useEffect(() => {
    storeRef.current = store;
  });

  useEffect(() => {
    let alive = true;
    store.read().then((value) => {
      if (!alive) return;
      acceptedRef.current = value;
      setAccepted(value);
    });
    return () => {
      alive = false;
    };
  }, [store]);

  const finish = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
  }, []);

  const ensure = useCallback(async (): Promise<boolean> => {
    if (acceptedRef.current === true) return true;
    // 못 읽은 채(null)로 쓰려 하면 읽기를 마저 기다리지 않고 규칙부터 보여 준다 — 한 번 더 보는 것이 동의 없이 쓰는 것보다 낫다
    finish(false); // 이전에 기다리던 것이 있다면 취소
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOpen(true);
    });
  }, [finish]);

  const accept = useCallback(() => {
    acceptedRef.current = true;
    setAccepted(true);
    setOpen(false);
    void storeRef.current.write();
    finish(true);
  }, [finish]);

  const dismiss = useCallback(() => {
    setOpen(false);
    finish(false);
  }, [finish]);

  const show = useCallback(() => setOpen(true), []);

  return { accepted, open, ensure, accept, dismiss, show };
}
