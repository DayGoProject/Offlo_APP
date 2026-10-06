/**
 * 쓰다듬기 → 친밀도 (M6 6-4) — 화면에 즉시 반영하고, 모아서 서버에 한 번에 보낸다.
 *
 * 계산은 `logic/pet.ts`(순수)가 하고 이 훅은 시간 · 타이머 · 전송만 맡는다. 서버 호출은 `send`로 받는다 —
 * 실제 화면은 `api.garden.pet`을, 미리보기는 가짜 전송을 넘기므로 이 파일은 `api` · Firebase를 import하지 않는다.
 *
 * 전송 시점: 마지막 탭 뒤 1.2초 · 탭이 포커스를 잃을 때 · 앱이 백그라운드로 갈 때 · 화면이 사라질 때.
 * 한 번에 하나만 보낸다(순서 보장). 실패하면 보낸 몫은 버리고 서버 값으로 되돌린다 — 두 번 보내면 두 번 반영되는 요청이라 재전송하지 않는다.
 *
 * 상태는 작은 외부 저장소에 둔다: 탭 · 타이머 · 비동기 응답이 항상 최신 값을 보고, 효과 안에서 `setState`를 부르지 않는다.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import {
  affectionView,
  beginFlush,
  flushDone,
  flushFailed,
  initAffection,
  samePet,
  syncServer,
  tapPet,
  type AffectionState,
  type AffectionView,
  type TapResult,
} from "@/logic/pet";
import { getErrorMessage } from "@/services/api-client";
import type { PetRecord } from "@/shared/garden-utils";
import { kstDateKey } from "@/shared/kst";

/** 서버가 돌려주는 기록 (`POST /api/garden/pet` 응답의 일부) */
export interface PetSendResult {
  date: string | null;
  today: number;
  total: number;
}

/** 화면이 쓰는 한 묶음 */
export interface AffectionControls {
  view: AffectionView;
  /** 마지막 전송 실패 한 줄 (한국어) — 성공하면 사라진다 */
  error: string | null;
  /** 쓰다듬기 한 번 — 화면에 먼저 반영하고 인정됐는지 · 레벨이 올랐는지 돌려준다 */
  tap: () => TapResult;
}

interface Snapshot {
  state: AffectionState;
  view: AffectionView;
  error: string | null;
}

function createStore(pet: PetRecord | null | undefined, at: number) {
  let snap: Snapshot = build(initAffection(pet), null, at);
  const listeners = new Set<() => void>();
  function build(state: AffectionState, error: string | null, time: number): Snapshot {
    return { state, error, view: affectionView(state, kstDateKey(time)) };
  }
  return {
    get: () => snap,
    commit(state: AffectionState, error: string | null, time: number) {
      snap = build(state, error, time);
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const FLUSH_DELAY_MS = 1200;

export function usePetAffection({
  pet,
  scope,
  now,
  send,
  active = true,
  onFailed,
  getNow = Date.now,
}: {
  /** 서버가 알려 준 쓰다듬기 기록 (Firestore 읽기) — 동물이 없으면 null */
  pet: PetRecord | null | undefined;
  /** 이 값이 바뀌면(동물을 바꿨다) 모아 둔 쓰다듬기를 버리고 처음부터 센다 */
  scope: string | null;
  /** 화면의 기준 시각(ms) — 처음 그릴 때의 "오늘" */
  now: number;
  /** 서버에 `count`번을 보낸다 — 응답의 기록이 진실이다. 실패하면 던진다 */
  send: (count: number) => Promise<PetSendResult>;
  /** false가 되면(다른 탭으로 갔다) 모아 둔 것을 바로 보낸다 */
  active?: boolean;
  /** 전송이 실패했다 — 화면이 서버 값을 다시 읽을 때 쓴다 */
  onFailed?: () => void;
  /** 탭하는 순간의 시각 (기본 `Date.now`) — 미리보기는 고정 시각을 넘긴다 */
  getNow?: () => number;
}): AffectionControls {
  const [store] = useState(() => createStore(pet, now));
  const snap = useSyncExternalStore(store.subscribe, store.get, store.get);

  // 최신 콜백 — 타이머 · 비동기 응답은 이 값을 읽는다
  const latest = useRef({ send, onFailed, getNow });
  useEffect(() => {
    latest.current = { send, onFailed, getNow };
  });

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  // 타이머가 부를 "지금 보내기" — 아래 flush를 가리킨다 (flush가 스스로를 다시 예약해야 해서 ref로 건너뛴다)
  const flushLater = useRef<() => Promise<void>>(async () => {});
  const schedule = useCallback(() => {
    clearTimer();
    timer.current = setTimeout(() => void flushLater.current(), FLUSH_DELAY_MS);
  }, [clearTimer]);

  const flush = useCallback(async () => {
    clearTimer();
    const { state, count } = beginFlush(store.get().state);
    if (count === 0) return;
    store.commit(state, null, latest.current.getNow());
    try {
      const res = await latest.current.send(count);
      store.commit(flushDone(store.get().state, res), null, latest.current.getNow());
    } catch (e) {
      store.commit(flushFailed(store.get().state), getErrorMessage(e), latest.current.getNow());
      latest.current.onFailed?.();
    }
    // 보내는 동안 더 쌓였으면 이어서 보낸다
    if (store.get().state.pending > 0 && !timer.current) schedule();
  }, [store, clearTimer, schedule]);
  useEffect(() => {
    flushLater.current = flush;
  }, [flush]);

  const tap = useCallback((): TapResult => {
    const at = latest.current.getNow();
    const { state, result } = tapPet(store.get().state, kstDateKey(at));
    if (result.counted) {
      store.commit(state, store.get().error, at);
      schedule();
    }
    return result;
  }, [store, schedule]);

  // 서버 기록이 바뀌었다(다시 읽었다) · 동물을 바꿨다 — 저장소를 맞춘다
  const lastScope = useRef(scope);
  const lastPet = useRef(pet);
  useEffect(() => {
    const at = latest.current.getNow();
    if (lastScope.current !== scope) {
      lastScope.current = scope;
      lastPet.current = pet;
      clearTimer();
      store.commit(initAffection(pet), null, at);
    } else if (!samePet(lastPet.current, pet)) {
      lastPet.current = pet;
      store.commit(syncServer(store.get().state, pet), store.get().error, at);
    }
  }, [store, pet, scope, clearTimer]);

  // 탭을 떠나거나 앱이 뒤로 가면 모아 둔 것을 바로 보낸다
  useEffect(() => {
    if (!active) void flush();
  }, [active, flush]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") void flush();
    });
    return () => sub.remove();
  }, [flush]);
  // 화면이 사라질 때 — 남은 것을 보낸다 (응답은 기다리지 않는다)
  useEffect(() => () => void flush(), [flush]);

  return { view: snap.view, error: snap.error, tap };
}
