/**
 * @offlo-shared — 자동 생성 파일. 직접 수정하지 마세요.
 * 원본: Offlo/web/src/lib/garden-utils.ts
 * 갱신: node scripts/sync-shared.mjs --pull
 */
/* 클라이언트·서버 양쪽에서 안전하게 쓸 수 있는 순수 유틸 */

/* ── 식물 레벨 정의 ───────────────────────────────────────── */

/* `image`는 Paper에서 생성한 유리 식물 렌더를 **투명 배경 AVIF**(512px)로 뽑은 것이다.
   어떤 면 위에 얹어도 사각형 경계가 생기지 않는다 (만드는 법 .claude/rules/3d.md).
   `thumb`는 96px — 성장 단계 목록처럼 작게 여러 개 뿌리는 자리에서 512px 7장을 받지 않게 한다.
   emoji는 이미지가 과한 좁은 자리(알림·피드 등)에서 계속 쓴다. */
export const PLANT_LEVELS = [
  { level: 1, name: "씨앗",      minMinutes: 0,    emoji: "🌰", image: "/plants/plant-1-seed.avif",     thumb: "/plants/thumb/plant-1-seed.avif"     },
  { level: 2, name: "새싹",      minMinutes: 120,  emoji: "🌱", image: "/plants/plant-2-sprout.avif",   thumb: "/plants/thumb/plant-2-sprout.avif"   },
  { level: 3, name: "어린 식물", minMinutes: 480,  emoji: "🌿", image: "/plants/plant-3-seedling.avif", thumb: "/plants/thumb/plant-3-seedling.avif" },
  { level: 4, name: "꽃봉오리",  minMinutes: 1200, emoji: "🌸", image: "/plants/plant-4-bud.avif",      thumb: "/plants/thumb/plant-4-bud.avif"      },
  { level: 5, name: "활짝 꽃",   minMinutes: 2400, emoji: "🌺", image: "/plants/plant-5-bloom.avif",    thumb: "/plants/thumb/plant-5-bloom.avif"    },
  { level: 6, name: "열매",      minMinutes: 4800, emoji: "🍎", image: "/plants/plant-6-fruit.avif",    thumb: "/plants/thumb/plant-6-fruit.avif"    },
  { level: 7, name: "고목나무",  minMinutes: 9600, emoji: "🌳", image: "/plants/plant-7-tree.avif",     thumb: "/plants/thumb/plant-7-tree.avif"     },
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

/* ── 친밀도(쓰다듬기) ─────────────────────────────────────── */

/* 쓰다듬기 한 번 = 친밀도 +1. 하루(KST) 상한을 넘은 탭은 화면 효과만 있고 기록되지 않는다.
   이 앱은 "화면을 덜 보게 하는" 앱이라 쓰다듬기가 새 중독 고리가 되지 않게 상한을 작게 둔다 (5회).
   수치 근거: 앱 레포 docs/garden-game-design.md 8-5 모의실험 — 꾸준한 사용자가 4·11·26·49일에 레벨이 오르도록.
   동물을 바꾸면(reset) animal 문서가 통째로 덮어써져 이 기록도 0부터 다시 시작한다. 죽거나 줄어들지 않는다. */
export const PET_DAILY_CAP = 5;

export const AFFECTION_LEVELS = [
  { level: 1, name: "낯선 사이",       minTotal: 0   },
  { level: 2, name: "조심스러운 사이", minTotal: 10  },
  { level: 3, name: "친구",           minTotal: 30  },
  { level: 4, name: "단짝",           minTotal: 70  },
  { level: 5, name: "평생 가족",       minTotal: 130 },
] as const;

export type AffectionLevel = typeof AFFECTION_LEVELS[number];

export function getAffectionLevel(total: number): AffectionLevel {
  return [...AFFECTION_LEVELS].reverse().find((l) => total >= l.minTotal) ?? AFFECTION_LEVELS[0];
}

export function nextAffectionLevel(current: AffectionLevel): AffectionLevel | null {
  const idx = AFFECTION_LEVELS.findIndex((l) => l.level === current.level);
  return idx < AFFECTION_LEVELS.length - 1 ? AFFECTION_LEVELS[idx + 1] : null;
}

/** 지금 레벨 안에서 다음 레벨까지의 진행률 0~1 (마지막 레벨은 1) */
export function affectionRatio(total: number): number {
  const cur = getAffectionLevel(total);
  const next = nextAffectionLevel(cur);
  return next ? (total - cur.minTotal) / (next.minTotal - cur.minTotal) : 1;
}

/* `users/{uid}/garden/animal`의 `pet` 필드 — date는 KST 날짜 키, today는 그날 인정된 횟수, total은 누적(= 친밀도) */
export interface PetRecord {
  date: string | null;
  today: number;
  total: number;
}

export const EMPTY_PET: PetRecord = { date: null, today: 0, total: 0 };

/** Firestore에서 읽은 값을 안전하게 PetRecord로 — 없거나 깨졌으면 빈 기록 */
export function normalizePet(raw: unknown): PetRecord {
  if (!raw || typeof raw !== "object") return { ...EMPTY_PET };
  const r = raw as Record<string, unknown>;
  const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  return { date: typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : null, today: int(r.today), total: int(r.total) };
}

/** 오늘(KST 날짜 키)의 인정된 횟수 — 날짜가 다르면 0 */
export function petTodayCount(pet: PetRecord, todayKey: string): number {
  return pet.date === todayKey ? pet.today : 0;
}

/**
 * 쓰다듬기 `count`번을 기록에 반영한다 — 서버(트랜잭션 안)와 앱·웹의 낙관적 갱신이 같은 함수를 쓴다.
 * 오늘 상한(`cap`)까지만 인정하고 남는 몫은 버린다 (에러가 아니다). 날짜가 바뀌었으면 today를 0에서 센다.
 */
export function applyPetTaps(
  prev: PetRecord,
  todayKey: string,
  count: number,
  cap: number = PET_DAILY_CAP,
): { next: PetRecord; accepted: number } {
  const already = petTodayCount(prev, todayKey);
  const accepted = Math.max(0, Math.min(Math.floor(count), cap - already));
  return { next: { date: todayKey, today: already + accepted, total: prev.total + accepted }, accepted };
}
