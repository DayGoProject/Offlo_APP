/**
 * 동물 모션 기반 — 모든 움직임은 Reanimated 공유 값(UI 스레드)이다. 프레임마다 JS `setState`를 하지 않는다
 * (docs/garden-game-design.md 7장).
 *
 * React Compiler가 켜져 있어서 공유 값은 `.value` 대신 `.get()` / `.set()`으로 다룬다.
 *
 * 세 가지 원칙
 * 1. 정지 화면 금지 — 항상 2개 이상의 앰비언트 동작이 돈다 (숨쉬기 · 깜빡임 · 꼬리 · 귀)
 * 2. 기계처럼 보이지 않게 — 반복 패턴은 길이가 다른 대기 시간을 이어 붙여 불규칙하게 만든다
 * 3. 시스템 "동작 줄이기"를 지킨다 — 켜져 있으면 움직임 값은 0에 머문다 (정지 포즈 · 표정 변화만)
 */
import { useEffect } from "react";
import {
  cancelAnimation,
  Easing,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

/** 움직임을 켤지 — 부모가 `animate`를 끄거나(스크린샷용) 시스템이 동작 줄이기를 켜면 false */
export function useMotionEnabled(animate: boolean): boolean {
  const reduced = useReducedMotion();
  return animate && !reduced;
}

const SINE = Easing.inOut(Easing.sin);

/** -1 ↔ 1을 사인처럼 오가는 값. 주기 · 위상이 바뀌면 다시 시작한다 */
export function useOscillator(periodMs: number, enabled: boolean, phaseMs = 0): SharedValue<number> {
  const value = useSharedValue(0);
  useEffect(() => {
    if (!enabled || periodMs <= 0) {
      cancelAnimation(value);
      value.set(0);
      return;
    }
    const half = periodMs / 2;
    value.set(
      withDelay(
        phaseMs,
        withRepeat(withSequence(withTiming(1, { duration: half, easing: SINE }), withTiming(-1, { duration: half, easing: SINE })), -1, false),
      ),
    );
    return () => cancelAnimation(value);
  }, [periodMs, enabled, phaseMs, value]);
  return value;
}

/** 깜빡임 — 0(뜸) ↔ 1(감음). 길이가 다른 대기를 이어 붙여 불규칙하게 보이고, 가끔 두 번 깜빡인다 */
export function useBlink(enabled: boolean, speed = 1): SharedValue<number> {
  const closed = useSharedValue(0);
  useEffect(() => {
    if (!enabled) {
      cancelAnimation(closed);
      closed.set(0);
      return;
    }
    const blink = () => withSequence(withTiming(1, { duration: 70 }), withTiming(0, { duration: 120 }));
    const wait = (ms: number) => Math.round(ms / speed);
    closed.set(
      withRepeat(
        withSequence(
          withDelay(wait(2600), blink()),
          withDelay(wait(3900), blink()),
          withDelay(wait(240), blink()), // 두 번 연달아
          withDelay(wait(4600), blink()),
          withDelay(wait(2200), blink()),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(closed);
  }, [enabled, speed, closed]);
  return closed;
}

/**
 * 짧은 동작을 길게 쉬어 가며 반복 — 0 → 1 → 0 한 번이 `actionMs`, 다음 동작까지 `restMs`.
 * 귀 쫑긋 · 앞발 툭툭 · 뒷발 쿵 같은 "가끔 하는 행동"에 쓴다.
 */
export function usePulse(enabled: boolean, actionMs: number, restMs: number, phaseMs = 0): SharedValue<number> {
  const value = useSharedValue(0);
  useEffect(() => {
    if (!enabled) {
      cancelAnimation(value);
      value.set(0);
      return;
    }
    value.set(
      withDelay(
        phaseMs,
        withRepeat(
          withSequence(
            withDelay(restMs, withTiming(1, { duration: actionMs / 2, easing: Easing.out(Easing.quad) })),
            withTiming(0, { duration: actionMs / 2, easing: Easing.in(Easing.quad) }),
          ),
          -1,
          false,
        ),
      ),
    );
    return () => cancelAnimation(value);
  }, [enabled, actionMs, restMs, phaseMs, value]);
  return value;
}

/**
 * 연타 동작(예: 발 구르기 3번 → 쉼) — 0 → 1 → 0을 `count`번 빠르게 한 뒤 `restMs` 쉰다.
 */
export function useBurst(enabled: boolean, count: number, tapMs: number, restMs: number, phaseMs = 0): SharedValue<number> {
  const value = useSharedValue(0);
  useEffect(() => {
    if (!enabled) {
      cancelAnimation(value);
      value.set(0);
      return;
    }
    const taps = Array.from({ length: count }, () =>
      withSequence(withTiming(1, { duration: tapMs / 2, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: tapMs / 2, easing: Easing.in(Easing.quad) })),
    );
    value.set(withDelay(phaseMs, withRepeat(withSequence(withDelay(restMs, taps[0]), ...taps.slice(1)), -1, false)));
    return () => cancelAnimation(value);
  }, [enabled, count, tapMs, restMs, phaseMs, value]);
  return value;
}

/** 목표 값으로 부드럽게 따라가는 값 — 상태가 바뀔 때 포즈가 뚝 끊기지 않게 한다 */
export function useEased(target: number, enabled: boolean, durationMs = 500): SharedValue<number> {
  const value = useSharedValue(target);
  useEffect(() => {
    if (!enabled) {
      value.set(target);
      return;
    }
    value.set(withTiming(target, { duration: durationMs, easing: Easing.out(Easing.cubic) }));
  }, [target, enabled, durationMs, value]);
  return value;
}

/** 0 → 1로 한 방향으로 흐르고 잠시 쉬는 값 — 눈물 방울이 떨어지는 것처럼 되돌아오지 않는 동작 */
export function useRamp(enabled: boolean, durationMs: number, restMs: number, phaseMs = 0): SharedValue<number> {
  const value = useSharedValue(0);
  useEffect(() => {
    if (!enabled) {
      cancelAnimation(value);
      value.set(0);
      return;
    }
    value.set(
      withDelay(
        phaseMs,
        withRepeat(
          withSequence(
            withTiming(1, { duration: durationMs, easing: Easing.in(Easing.quad) }),
            withDelay(restMs, withTiming(0, { duration: 0 })),
          ),
          -1,
          false,
        ),
      ),
    );
    return () => cancelAnimation(value);
  }, [enabled, durationMs, restMs, phaseMs, value]);
  return value;
}
