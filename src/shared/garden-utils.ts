/**
 * @offlo-shared — 자동 생성 파일. 직접 수정하지 마세요.
 * 원본: Offlo/web/src/lib/garden-utils.ts
 * 갱신: node scripts/sync-shared.mjs --pull
 */
/* 클라이언트·서버 양쪽에서 안전하게 쓸 수 있는 순수 유틸 */

/* ── 식물 레벨 정의 ───────────────────────────────────────── */

export const PLANT_LEVELS = [
  { level: 1, name: "씨앗",      minMinutes: 0,    emoji: "🌰" },
  { level: 2, name: "새싹",      minMinutes: 120,  emoji: "🌱" },
  { level: 3, name: "어린 식물", minMinutes: 480,  emoji: "🌿" },
  { level: 4, name: "꽃봉오리",  minMinutes: 1200, emoji: "🌸" },
  { level: 5, name: "활짝 꽃",   minMinutes: 2400, emoji: "🌺" },
  { level: 6, name: "열매",      minMinutes: 4800, emoji: "🍎" },
  { level: 7, name: "고목나무",  minMinutes: 9600, emoji: "🌳" },
] as const;

export type PlantLevel = typeof PLANT_LEVELS[number];

export function getPlantLevel(totalMinutes: number): PlantLevel {
  return [...PLANT_LEVELS].reverse().find((l) => totalMinutes >= l.minMinutes) ?? PLANT_LEVELS[0];
}

export function nextPlantLevel(current: PlantLevel): PlantLevel | null {
  const idx = PLANT_LEVELS.findIndex((l) => l.level === current.level);
  return idx < PLANT_LEVELS.length - 1 ? PLANT_LEVELS[idx + 1] : null;
}

/* ── 동물 스테이지 정의 ───────────────────────────────────── */

export const ANIMAL_TYPES = [
  { id: "cat",    name: "고양이", emoji: "🐱" },
  { id: "dog",    name: "강아지", emoji: "🐶" },
  { id: "rabbit", name: "토끼",   emoji: "🐰" },
] as const;

export type AnimalTypeId = typeof ANIMAL_TYPES[number]["id"];

export const ANIMAL_STAGES = [
  { minStreak: 0,   name: "알",       status: "egg"      },
  { minStreak: 1,   name: "아기",     status: "baby"     },
  { minStreak: 7,   name: "성장 중",  status: "growing"  },
  { minStreak: 21,  name: "성체",     status: "adult"    },
  { minStreak: 60,  name: "강화 성체", status: "enhanced" },
  { minStreak: 120, name: "전설",     status: "legend"   },
] as const;

export type AnimalStatus = typeof ANIMAL_STAGES[number]["status"];

export function getAnimalStage(streak: number): typeof ANIMAL_STAGES[number] {
  return [...ANIMAL_STAGES].reverse().find((s) => streak >= s.minStreak) ?? ANIMAL_STAGES[0];
}

export function getAnimalEmoji(typeId: AnimalTypeId | null, streak: number): string {
  if (!typeId) return "🥚";
  const stage = getAnimalStage(streak);
  const stageEmoji: Record<AnimalStatus, Record<AnimalTypeId, string>> = {
    egg:      { cat: "🥚",  dog: "🥚",  rabbit: "🥚"  },
    baby:     { cat: "🐱",  dog: "🐶",  rabbit: "🐰"  },
    growing:  { cat: "😺",  dog: "🐕",  rabbit: "🐇"  },
    adult:    { cat: "🐈",  dog: "🦮",  rabbit: "🐇"  },
    enhanced: { cat: "🐈‍⬛", dog: "🦴",  rabbit: "🐇"  },
    legend:   { cat: "🦁",  dog: "🐺",  rabbit: "🦊"  },
  };
  return stageEmoji[stage.status][typeId];
}
