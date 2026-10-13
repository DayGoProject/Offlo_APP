/**
 * 축하 연출의 색 · 입자 규칙 (M6 6-5) — 순수 데이터 + 계산만 둔다 (Node로 검증한다 — scripts/verify-M6-logic.mjs).
 *
 * design.md "콘텐츠 일러스트 예외" — 동물 · 방 색은 `palette.ts`, **연출에 쓰는 입자 · 빛의 색은 이 파일**에 둔다 (컴포넌트에 색을 흩뿌리지 않는다).
 * 3D 장면이 아니라 방 위에 얹는 2D 층(`CelebrationLayer`)이 이 값으로 그린다 — 그래서 SVG 폴백에서도, 웹 미리보기에서도 같다.
 *
 * 좌표는 방의 360 × 418 단위 · 시간은 ms · 속도는 단위/초 · 중력은 단위/초² (아래쪽이 +y).
 * 입자는 `seed`로 만든다 — 같은 시드면 같은 모양이라 스크린샷 · 검증이 날마다 같다.
 */

/** 무슨 일이 있었나 — 밥 · 굶주림 회복 · 부화 · 성장 · 쓰다듬기 미션 */
export type BurstKind = "eat" | "recover" | "hatch" | "stageUp" | "mission";

export type PieceShape = "bar" | "dot" | "spark";

export interface Piece {
  shape: PieceShape;
  /** 시작 위치 (방 좌표) */
  x0: number;
  y0: number;
  /** 처음 속도 */
  vx: number;
  vy: number;
  /** 중력 (+y) */
  g: number;
  /** 도는 속도 (도/초) */
  spin: number;
  size: number;
  delay: number;
  duration: number;
  color: string;
}

export interface BurstSpec {
  pieces: Piece[];
  /** 방 전체가 밝아지는 빛 — peak 0이면 없다 */
  bloom: { peak: number; inMs: number; outMs: number };
  /** 이름 카드가 떠 있는 시간 — 카드가 없는 연출은 0 */
  cardMs: number;
  /** 연출이 끝나는 시각 — 이 뒤에 층을 걷는다 */
  totalMs: number;
}

/** 빛 번짐의 색 — `rgb`에 불투명도를 붙여 쓴다 */
export const BLOOM_RGB = "255, 232, 178";

const CONFETTI = ["#FF6F8E", "#FFD36B", "#7FD6FF", "#9BE58A", "#C9A6FF", "#FFFFFF"] as const;
/** 부화 · 성장 — 금빛 위주 (조금 차분하게) */
const GOLD = ["#FFE08A", "#FFD36B", "#FFF3C9", "#FFFFFF", "#FFC46B"] as const;
const TWINKLE = ["#FFF3C9", "#FFFFFF", "#FFE08A"] as const;

/** 방 좌표의 동물 몸 중심 (PetStage의 PET_CENTER_X와 같은 가로 · 세로는 가슴 높이) */
export const BURST_ORIGIN = { x: 196, y: 262 } as const;

/** 작은 난수 — 같은 시드면 같은 수열 (mulberry32) */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rad = (deg: number) => (deg * Math.PI) / 180;

function pick<T>(list: readonly T[], r: () => number): T {
  return list[Math.floor(r() * list.length)];
}

/** 위쪽 부채꼴로 터지는 폭죽 — 위로 솟았다가 중력으로 떨어진다 */
function fan(n: number, r: () => number, opt: { from: number; to: number; speed: [number, number]; g: number; ms: [number, number]; colors: readonly string[]; size: [number, number] }): Piece[] {
  return Array.from({ length: n }, (_, i) => {
    const a = rad(opt.from + (opt.to - opt.from) * ((i + r() * 0.8) / n));
    const sp = opt.speed[0] + (opt.speed[1] - opt.speed[0]) * r();
    return {
      shape: i % 4 === 3 ? "dot" : "bar",
      x0: BURST_ORIGIN.x + (r() - 0.5) * 18,
      y0: BURST_ORIGIN.y + (r() - 0.5) * 12,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      g: opt.g,
      spin: (r() - 0.5) * 900,
      size: opt.size[0] + (opt.size[1] - opt.size[0]) * r(),
      delay: Math.round(r() * 160),
      duration: Math.round(opt.ms[0] + (opt.ms[1] - opt.ms[0]) * r()),
      color: pick(opt.colors, r),
    } satisfies Piece;
  });
}

/** 동물 둘레로 퍼지는 반짝이 고리 — 거의 떨어지지 않고 떠오르듯 사라진다 */
function ring(n: number, r: () => number, colors: readonly string[]): Piece[] {
  return Array.from({ length: n }, (_, i) => {
    const a = rad((360 / n) * i + r() * 14);
    const sp = 80 + 70 * r();
    return {
      shape: i % 3 === 0 ? "dot" : "spark",
      x0: BURST_ORIGIN.x,
      y0: BURST_ORIGIN.y + 18,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp * 0.8 - 14,
      g: 40,
      spin: (r() - 0.5) * 200,
      size: 7 + 6 * r(),
      delay: Math.round(r() * 120),
      duration: Math.round(1100 + 500 * r()),
      color: pick(colors, r),
    } satisfies Piece;
  });
}

/** 밥을 다 먹은 뒤 얼굴 둘레에서 깜빡이는 반짝이 — 먹는 동작이 끝나갈 즈음에 시작한다 */
function twinkles(n: number, r: () => number): Piece[] {
  return Array.from({ length: n }, (_, i) => ({
    shape: "spark",
    x0: BURST_ORIGIN.x + (r() - 0.5) * 120,
    y0: BURST_ORIGIN.y - 24 + (r() - 0.5) * 70,
    vx: (r() - 0.5) * 14,
    vy: -(14 + 22 * r()),
    g: 0,
    spin: (r() - 0.5) * 120,
    size: 8 + 6 * r(),
    delay: 1500 + i * 130 + Math.round(r() * 90),
    duration: 900 + Math.round(300 * r()),
    color: pick(TWINKLE, r),
  }) satisfies Piece);
}

export function burstSpec(kind: BurstKind, seed: number): BurstSpec {
  const r = rng(seed * 7919 + kind.length * 104729);
  let pieces: Piece[];
  let bloom: BurstSpec["bloom"];
  let cardMs = 0;
  switch (kind) {
    case "recover":
      // 굶주림에서 돌아왔다 — 가장 크다: 방이 환해지고 폭죽이 터진다
      pieces = fan(30, r, { from: -155, to: -25, speed: [130, 250], g: 250, ms: [1500, 2100], colors: CONFETTI, size: [6, 10] });
      bloom = { peak: 0.26, inMs: 220, outMs: 1300 };
      break;
    case "hatch":
      pieces = [...ring(18, r, GOLD), ...fan(10, r, { from: -150, to: -30, speed: [90, 170], g: 200, ms: [1300, 1800], colors: GOLD, size: [5, 8] })];
      bloom = { peak: 0.22, inMs: 240, outMs: 1100 };
      cardMs = 2800;
      break;
    case "stageUp":
      pieces = [...ring(16, r, GOLD), ...fan(8, r, { from: -150, to: -30, speed: [90, 160], g: 200, ms: [1300, 1700], colors: GOLD, size: [5, 8] })];
      bloom = { peak: 0.2, inMs: 240, outMs: 1000 };
      cardMs = 2800;
      break;
    case "mission":
      pieces = fan(14, r, { from: -150, to: -30, speed: [100, 190], g: 230, ms: [1100, 1500], colors: CONFETTI, size: [5, 8] });
      bloom = { peak: 0, inMs: 0, outMs: 0 };
      break;
    case "eat":
      pieces = twinkles(7, r);
      bloom = { peak: 0, inMs: 0, outMs: 0 };
      break;
  }
  const end = pieces.reduce((m, p) => Math.max(m, p.delay + p.duration), 0);
  const totalMs = Math.max(end, cardMs, bloom.inMs + bloom.outMs) + 200;
  return { pieces, bloom, cardMs, totalMs };
}

export interface PiecePose {
  x: number;
  y: number;
  rotate: number;
  scale: number;
  opacity: number;
}

/**
 * 진행도 p(0~1)에서의 자리 — 던져 올린 물체의 운동 (x = x0 + vx·s · y = y0 + vy·s + g·s²/2). UI 스레드 worklet에서도 부른다.
 * 처음 10%는 커지며 나타나고, 마지막 30%는 사라진다. 시작 전(delay 중)에는 p가 0이라 보이지 않는다.
 */
export function piecePose(piece: Piece, p: number): PiecePose {
  "worklet";
  const s = (p * piece.duration) / 1000;
  const fadeIn = p < 0.1 ? p / 0.1 : 1;
  const fadeOut = p > 0.7 ? (1 - p) / 0.3 : 1;
  return {
    x: piece.x0 + piece.vx * s,
    y: piece.y0 + piece.vy * s + 0.5 * piece.g * s * s,
    rotate: piece.spin * s,
    // 반짝이는 숨 쉬듯 커졌다 작아진다
    scale: piece.shape === "spark" ? fadeIn * (0.65 + 0.35 * Math.abs(Math.sin(s * 9))) : fadeIn,
    opacity: p <= 0 ? 0 : Math.max(0, Math.min(1, fadeOut)),
  };
}
