/**
 * 정원 동물 효과음 — 짧은 소리 몇 개를 재생한다 (`scripts/sound/build-sounds.mjs`가 합성한 WAV, 외부 음원 없음).
 *
 * 지킬 것 (이 앱은 "화면을 덜 보게 하는" 앱이다)
 *  · **내가 한 행동에만 난다** — 동물을 누를 때 · 밥 먹는 연출 · 부화 · 단계 상승. 저절로 울리거나 반복되지 않는다
 *  · **무음 스위치를 지킨다** (`playsInSilentMode: false`) · 다른 앱의 음악을 끊지 않는다 (`mixWithOthers`)
 *  · **끌 수 있다** — 정원 무대 구석의 스피커 버튼. 선택은 기기에 남는다 (AsyncStorage)
 *  · 실패해도 화면은 멀쩡해야 한다 — 소리는 장식이다 (모든 호출은 에러를 삼킨다)
 *
 * `expo-audio`는 네이티브 모듈이라 import 순간 모듈을 찾는다 — 처음 쓸 때 `require`하고, 없으면(구버전 dev build) 조용히 소리 없이 간다.
 *
 * **재생마다 새 플레이어를 쓴다.** 다 재생한 플레이어를 되감아(`seekTo(0)`) 다시 틀면 안드로이드에서 소리가 1.4초쯤 늦게 시작했다
 * (실기에서 2번째 탭부터 — 개발 빌드는 소스를 다시 불러온다). 그래서 소리마다 **미리 준비한 플레이어(standby)**를 꺼내 틀고,
 * 곧바로 다음 것을 백그라운드에서 준비해 두며, 쓴 플레이어는 소리가 끝난 뒤 정리한다.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

import type { PetCondition } from "@/logic/garden";
import type { AnimalTypeId } from "@/shared/garden-utils";

export type PetSoundId =
  | "cat_happy" | "cat_sad" | "dog_happy" | "dog_sad" | "rabbit_happy" | "rabbit_sad"
  | "eat" | "egg_knock" | "hatch" | "chime";

/** 장면이 알리는 일 — `three/PetScene`의 `PetEvent`와 같은 이름 */
export type PetSoundEvent = "pet" | "knock" | "eat" | "hatch" | "stageUp";

const FILES: Record<PetSoundId, number> = {
  cat_happy: require("../../assets/sounds/cat_happy.wav"),
  cat_sad: require("../../assets/sounds/cat_sad.wav"),
  dog_happy: require("../../assets/sounds/dog_happy.wav"),
  dog_sad: require("../../assets/sounds/dog_sad.wav"),
  rabbit_happy: require("../../assets/sounds/rabbit_happy.wav"),
  rabbit_sad: require("../../assets/sounds/rabbit_sad.wav"),
  eat: require("../../assets/sounds/eat.wav"),
  egg_knock: require("../../assets/sounds/egg_knock.wav"),
  hatch: require("../../assets/sounds/hatch.wav"),
  chime: require("../../assets/sounds/chime.wav"),
};

/** 소리 길이(ms) — 쓴 플레이어를 이 시간(+여유) 뒤에 정리한다. 파일을 다시 만들면 `inspect-sounds.mjs`의 길이와 맞춘다 */
const DURATION_MS: Record<PetSoundId, number> = {
  cat_happy: 660, cat_sad: 950, dog_happy: 500, dog_sad: 900, rabbit_happy: 460, rabbit_sad: 700,
  eat: 3400, egg_knock: 400, hatch: 2200, chime: 1500,
};

/** 어떤 일이 났을 때 어떤 소리인가 — 굶주린 동물은 쓰다듬어도 시무룩한 소리가 난다 (기분 좋은 소리는 배가 부르거나 출출할 때) */
export function soundFor(event: PetSoundEvent, type: AnimalTypeId, condition: PetCondition): PetSoundId {
  switch (event) {
    case "pet":
      return `${type}_${condition === "starving" ? "sad" : "happy"}` as PetSoundId;
    case "knock":
      return "egg_knock";
    case "eat":
      return "eat";
    case "hatch":
      return "hatch";
    case "stageUp":
      return "chime";
  }
}

/* ── 켜기 · 끄기 (기기에 저장) ─────────────────────────────── */
const KEY = "offlo:pet-sound";
let enabled = true;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

AsyncStorage.getItem(KEY)
  .then((v) => {
    if (v === "0" && enabled) {
      enabled = false;
      emit();
    }
  })
  .catch(() => {});

export function setPetSoundEnabled(on: boolean): void {
  if (enabled === on) return;
  enabled = on;
  emit();
  AsyncStorage.setItem(KEY, on ? "1" : "0").catch(() => {});
}

/** 소리를 켜 두었는가 — 화면이 구독한다 */
export function usePetSoundEnabled(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => enabled,
    () => true,
  );
}

/* ── 재생 ─────────────────────────────────────────────── */
interface Player {
  play: () => void;
  /** 네이티브는 remove, 웹은 release — 자원을 돌려준다 */
  remove?: () => void;
  release?: () => void;
}
type AudioModule = {
  createAudioPlayer: (source: number) => Player;
  setAudioModeAsync: (mode: { playsInSilentMode?: boolean; interruptionMode?: string; shouldPlayInBackground?: boolean }) => Promise<void>;
  preload?: (source: number) => Promise<void>;
};

let audio: AudioModule | null | undefined;
let modePromise: Promise<void> | null = null;
/** 소리마다 "바로 틀 수 있게 미리 만들어 둔" 플레이어 */
const standby = new Map<PetSoundId, Player>();
const preloaded = new Set<PetSoundId>();

function load(): AudioModule | null {
  if (audio !== undefined) return audio;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- 네이티브 모듈은 쓰는 순간에 불러온다 (위 머리말)
    audio = require("expo-audio") as AudioModule;
  } catch {
    audio = null; // 이 빌드엔 오디오 모듈이 없다 — 소리 없이 간다
  }
  return audio;
}

/** 오디오 모드 — 무음 스위치를 지키고 다른 앱 음악을 끊지 않는다. 한 번만 */
function ensureMode(mod: AudioModule): Promise<void> {
  modePromise ??= mod.setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers", shouldPlayInBackground: false }).catch(() => {});
  return modePromise;
}

function ensureStandby(mod: AudioModule, id: PetSoundId): void {
  if (!preloaded.has(id)) {
    preloaded.add(id);
    mod.preload?.(FILES[id])?.catch?.(() => {}); // 소스를 메모리에 캐시해 새 플레이어가 바로 시작하게
  }
  if (!standby.has(id)) standby.set(id, mod.createAudioPlayer(FILES[id]));
}

function dispose(player: Player): void {
  try {
    if (typeof player.release === "function") player.release();
    else player.remove?.();
  } catch {
    // 이미 정리됨
  }
}

/**
 * 소리를 미리 준비한다 — 모듈 불러오기 · 오디오 모드 · 플레이어 생성을 **한가할 때** 끝내 둔다.
 * 처음 누를 때 하면 JS 스레드가 그만큼 막혀 첫 쓰다듬기가 버벅인다 (실기 검증에서 첫 탭의 반응이 늦었다). 정원에서 3D가 준비된 뒤 부른다.
 */
export function preparePetSounds(ids: PetSoundId[]): void {
  try {
    const mod = load();
    if (!mod) return;
    void ensureMode(mod);
    for (const id of ids) ensureStandby(mod, id);
  } catch {
    // 소리는 장식이다
  }
}

/** 소리를 낸다. 꺼져 있거나(또는 못 내면) 아무 일도 없다 — `force`는 청음 화면용(켜짐 여부와 무관) */
export async function playPetSound(id: PetSoundId, force = false): Promise<void> {
  if (!enabled && !force) return;
  try {
    const mod = load();
    if (!mod) return;
    await ensureMode(mod);
    const player = standby.get(id) ?? mod.createAudioPlayer(FILES[id]);
    standby.delete(id);
    player.play();
    // 다음 소리를 미리 준비하고, 쓴 플레이어는 끝난 뒤 정리한다
    setTimeout(() => {
      try {
        ensureStandby(mod, id);
      } catch {
        // 소리는 장식이다
      }
    }, 120);
    setTimeout(() => dispose(player), DURATION_MS[id] + 800);
  } catch {
    // 소리는 장식이다
  }
}
