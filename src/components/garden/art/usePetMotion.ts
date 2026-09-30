/**
 * 동물 한 마리의 앰비언트 모션 묶음 — 세 종이 같이 쓴다. 상태(condition)가 바뀌면 값이 부드럽게 따라간다.
 * 반환값은 전부 UI 스레드 공유 값이라, 종별 컴포넌트가 `useAnimatedStyle`에서 읽어 몸에 맞게 쓴다.
 */
import type { PetCondition } from "@/logic/garden";

import { moodFor, type Mood } from "./moods";
import { useBlink, useEased, useMotionEnabled, useOscillator, usePulse, useRamp } from "./motion";

export interface PetMotion {
  enabled: boolean;
  mood: Mood;
  /** -1 ↔ 1 숨쉬기 */
  breath: ReturnType<typeof useOscillator>;
  /** -1 ↔ 1 꼬리 */
  tail: ReturnType<typeof useOscillator>;
  /** -1 ↔ 1 떨림 (빠른 진동) */
  shiver: ReturnType<typeof useOscillator>;
  /** 0 ↔ 1 귀 쫑긋 */
  earTwitch: ReturnType<typeof usePulse>;
  /** 0(뜸) ↔ 1(감음) */
  blink: ReturnType<typeof useBlink>;
  /** 0 ↔ 1 폴짝 */
  hop: ReturnType<typeof usePulse>;
  /** 0 ↔ 1 잠깐 나(화면)를 쳐다봄 — 출출할 때 빈 그릇과 번갈아 본다 */
  look: ReturnType<typeof usePulse>;
  /** 0 → 1 눈물이 흘러내림 */
  tearFall: ReturnType<typeof useRamp>;
  /** 상태에 따라 부드럽게 따라가는 값들 */
  droop: ReturnType<typeof useEased>;
  lid: ReturnType<typeof useEased>;
  slump: ReturnType<typeof useEased>;
  tailBase: ReturnType<typeof useEased>;
  eyeScale: ReturnType<typeof useEased>;
}

export function usePetMotion({
  condition,
  anxious = false,
  animate = true,
}: {
  condition: PetCondition;
  anxious?: boolean;
  animate?: boolean;
}): PetMotion {
  const enabled = useMotionEnabled(animate);
  const mood = moodFor(condition, anxious);

  return {
    enabled,
    mood,
    breath: useOscillator(mood.breathMs, enabled),
    tail: useOscillator(mood.tailMs, enabled, 200),
    shiver: useOscillator(mood.tremble > 0 ? 90 : 0, enabled),
    earTwitch: usePulse(enabled && mood.earTwitch, 260, 3400, 900),
    blink: useBlink(enabled, mood.blinkSpeed),
    hop: usePulse(enabled && mood.hopEveryMs > 0, 620, mood.hopEveryMs || 1000, 1500),
    look: usePulse(enabled && condition === "peckish", 500, 2600, 700),
    tearFall: useRamp(enabled && mood.tear, 1500, 1600, 400),
    // 포즈는 동작 줄이기여도 상태에 맞게 바뀐다 (정지 포즈 · 표정 변화만) — 두 번째 인자는 "애니메이션으로 이동할지"
    droop: useEased(mood.earDroop, enabled),
    lid: useEased(mood.lid, enabled),
    slump: useEased(mood.slump, enabled),
    tailBase: useEased(mood.tailBase, enabled),
    eyeScale: useEased(mood.eyeScale, enabled),
  };
}
