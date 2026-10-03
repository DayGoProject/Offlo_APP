/**
 * 3D 동물 리그 — 뼈대(Bone)와 얼굴 부품을 상태값(`art/moods.ts`의 Mood)과 동작(밥 먹기 · 쓰다듬기)으로 매 프레임 움직인다.
 * three만 import한다 (R3F · React 없음) — 네이티브 · 웹이 같이 쓴다.
 *
 * 이름 규약은 `scripts/sculpt/pets.html`이 정한다:
 *   뼈대: Root · Body · Head · EarL/EarR(+EarL2/EarR2) · Tail1~3 · ForeL/ForeR(앞다리 — 어깨) · PawL/PawR(앞발 — 손목)
 *   얼굴: EyeL · EyeR(묶음) · MouthSmile/MouthOpen/MouthFlat/MouthFrown(표정별 입) · BrowsSad · Tear    (L = +x)
 * 클립(애니메이션 파일)을 쓰지 않는 이유: 배고픔 · 쓰다듬기 같은 게임 몸짓은 상태값으로 구동해야 표정과 자세가 연속적으로 섞이고,
 * 모델을 바꿔도 이름만 맞으면 그대로 움직인다.
 */
import type { Material, Object3D } from "three";

import type { Mood } from "@/components/garden/art/moods";

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

interface Rest {
  px: number; py: number; pz: number;
  rx: number; ry: number; rz: number;
  sx: number; sy: number; sz: number;
}

export type MouthName = "smile" | "open" | "flat" | "frown";

export interface Rig {
  root: Object3D | null;
  body: Object3D | null;
  head: Object3D | null;
  earL: Object3D[];
  earR: Object3D[];
  tail: Object3D[];
  eyes: Object3D[];
  foreL: Object3D | null;
  foreR: Object3D | null;
  pawL: Object3D | null;
  pawR: Object3D | null;
  mouths: Record<MouthName, Object3D | null>;
  brows: Object3D | null;
  tear: Object3D | null;
  /** 고양이 · 토끼는 귀가 서 있고, 강아지는 늘어져 있다 — 귀 처짐의 방향이 반대다 */
  floppyEars: boolean;
  rest: Map<Object3D, Rest>;
}

/** 진행 중인 동작의 세기(0~1)와 시작 후 경과 초 */
export interface Action {
  eat: number;
  eatT: number;
  pet: number;
  petT: number;
}
export const NO_ACTION: Action = { eat: 0, eatT: 0, pet: 0, petT: 0 };

/**
 * 성장 단계가 바꾸는 체형 — 아기는 머리가 크고 몸이 짧고 통통하고 다리가 짧고 꼬리가 짧다 (성체 = 모두 1).
 * 배율은 모두 "성체 대비 실제로 보이는 크기"다: 뼈대 계층이 배율을 물려받는 것(머리 ← 몸통 · 귀 ← 머리 · 꼬리 ← 몸통)은 리그가 상쇄한다.
 */
export interface Look {
  headScale: number;
  eyeScale: number;
  /** 몸통 (가로 · 높이 · 앞뒤) — 높이를 줄이면 앞다리 · 뒷발이 함께 짧아진다 */
  body: [number, number, number];
  ear: number;
  tail: number;
}
export const ADULT_LOOK: Look = { headScale: 1, eyeScale: 1, body: [1, 1, 1], ear: 1, tail: 1 };

/** 몸통 관절의 높이 — 몸통을 세로로 줄이면 발이 이만큼 떠서, 그 비율만큼 뿌리를 내려 발바닥을 바닥에 둔다 */
const BODY_JOINT_Y = 0.6;

export function makeRig(scene: Object3D, kind: "cat" | "dog" | "rabbit"): Rig {
  const find = (names: string[]) => names.map((n) => scene.getObjectByName(n)).filter((o): o is Object3D => Boolean(o));
  const one = (n: string) => scene.getObjectByName(n) ?? null;
  const rig: Rig = {
    root: one("Root"),
    body: one("Body"),
    head: one("Head"),
    earL: find(["EarL", "EarL2"]),
    earR: find(["EarR", "EarR2"]),
    tail: find(["Tail1", "Tail2", "Tail3"]),
    eyes: find(["EyeL", "EyeR"]),
    foreL: one("ForeL"),
    foreR: one("ForeR"),
    pawL: one("PawL"),
    pawR: one("PawR"),
    mouths: { smile: one("MouthSmile"), open: one("MouthOpen"), flat: one("MouthFlat"), frown: one("MouthFrown") },
    brows: one("BrowsSad"),
    tear: one("Tear"),
    floppyEars: kind === "dog",
    rest: new Map(),
  };
  const all = [rig.root, rig.body, rig.head, rig.tear, rig.foreL, rig.foreR, rig.pawL, rig.pawR, ...rig.earL, ...rig.earR, ...rig.tail, ...rig.eyes];
  for (const o of all) {
    if (!o) continue;
    rig.rest.set(o, {
      px: o.position.x, py: o.position.y, pz: o.position.z,
      rx: o.rotation.x, ry: o.rotation.y, rz: o.rotation.z,
      sx: o.scale.x, sy: o.scale.y, sz: o.scale.z,
    });
  }
  return rig;
}

/** 0 → 1 → 0 짧은 펄스 — period 안에서 rest 뒤에 duration 동안 */
function pulse(t: number, period: number, duration: number, phase = 0): number {
  const x = (((t + phase) % period) + period) % period;
  const start = period - duration;
  if (x < start) return 0;
  return Math.sin(((x - start) / duration) * Math.PI);
}

/** 깜빡임 — 길이가 다른 대기를 이어 붙여 불규칙하게 (가끔 두 번) */
const BLINKS = [2.6, 6.5, 6.74, 11.3, 13.5];
const BLINK_CYCLE = 16;
function blinkAmount(t: number, speed: number): number {
  const c = (((t * speed) % BLINK_CYCLE) + BLINK_CYCLE) % BLINK_CYCLE;
  for (const b of BLINKS) if (c >= b && c < b + 0.19) return Math.sin(((c - b) / 0.19) * Math.PI);
  return 0;
}

function showMouth(r: Rig, name: MouthName) {
  for (const key of Object.keys(r.mouths) as MouthName[]) {
    const m = r.mouths[key];
    if (m) m.visible = key === name;
  }
}

export function applyRig(r: Rig, m: Mood, t: number, act: Action = NO_ACTION, look: Look = ADULT_LOOK): void {
  const rest = (o: Object3D) => r.rest.get(o)!;
  const { eat, pet } = act;
  const [bx, by, bz] = look.body;

  // 신나서 폴짝 (뿌리와 앞다리가 같이 쓴다)
  const hop = m.hopEveryMs > 0 ? pulse(t, m.hopEveryMs / 1000, 0.62, 1.5) : 0;

  // 숨쉬기 — 몸통이 늘었다 줄고 머리가 따라 오르내린다. 쓰다듬으면 그르릉(작은 진동)이 겹친다
  const breath = (Math.sin((TAU * t) / (m.breathMs / 1000)) + 1) / 2;
  const purr = Math.sin(t * 38) * 0.006 * pet;
  if (r.body) {
    const b = rest(r.body);
    r.body.scale.set(
      b.sx * bx * (1 - breath * m.breathAmp * 0.8),
      b.sy * by * (1 + breath * m.breathAmp * 1.8 + purr),
      b.sz * bz * (1 - breath * m.breathAmp * 0.8),
    );
    r.body.rotation.x = b.rx + eat * 0.16; // 밥그릇 쪽으로 몸을 숙인다
  }

  // 머리 — 숨 · 처짐 · (먹을 땐 그릇으로 내려가 오물오물) · (쓰다듬을 땐 손에 기대 좌우로 비빔). 몸통 배율을 물려받으니 상쇄해서 "성체 대비 배율"로 둔다
  const chew = Math.sin(act.eatT * 13) * 0.07 * eat;
  if (r.head) {
    const h = rest(r.head);
    r.head.position.y = h.py - breath * m.headBob * 0.014 - m.slump * 0.02 - eat * 0.42 - pet * 0.06;
    r.head.position.z = h.pz + eat * 0.5;
    r.head.rotation.x = h.rx + m.slump * 0.03 + eat * 0.5 + chew + pet * 0.22;
    r.head.rotation.z = h.rz + Math.sin(t * 0.8) * 0.025 * (1 - pet) + Math.sin(act.petT * 4) * 0.11 * pet;
    r.head.scale.set(h.sx * (look.headScale / bx), h.sy * (look.headScale / by), h.sz * (look.headScale / bz));
  }

  // 꼬리 — 처짐(z)은 밑동에, 흔들기(y)는 끝으로 갈수록 크게. 먹거나 쓰다듬으면 더 신나게. 몸통 배율을 상쇄해 길이를 look.tail로 둔다
  const wag = 1 + pet * 1.1 + eat * 0.5;
  const tailPhase = TAU * (t / ((m.tailMs / 1000) / (1 + pet * 0.6)));
  r.tail.forEach((b, i) => {
    const o = rest(b);
    b.rotation.z = o.rz + m.tailBase * DEG * (i === 0 ? 0.6 : 0.5) * (1 - pet * 0.7);
    b.rotation.y = o.ry + Math.sin(tailPhase - i * 0.7) * m.tailAmp * DEG * (0.5 + i * 0.35) * wag;
    if (i === 0) b.scale.set(o.sx * (look.tail / bx), o.sy * (look.tail / by), o.sz * (look.tail / bz));
  });

  // 귀 — 처짐 + 가끔 쫑긋 (쓰다듬으면 뒤로 눕는다). 고양이 · 토끼는 바깥으로, 강아지는 안쪽으로 눕는다. 머리 배율을 상쇄해 크기를 look.ear로 둔다
  const twitch = m.earTwitch ? pulse(t, 3.4, 0.26, 0.9) * (1 - pet) : 0;
  const droop = (m.earDroop + pet * 14 + eat * 6) * DEG;
  const sign = r.floppyEars ? -0.5 : 1;
  const earS = look.ear / look.headScale;
  r.earL.forEach((b, i) => {
    const o = rest(b);
    b.rotation.z = o.rz - droop * sign * (i === 0 ? 1 : 1.4) - twitch * 0.16;
    if (i === 0) b.scale.set(o.sx * earS, o.sy * earS, o.sz * earS);
  });
  r.earR.forEach((b, i) => {
    const o = rest(b);
    b.rotation.z = o.rz + droop * sign * (i === 0 ? 1 : 1.4) + twitch * 0.08;
    if (i === 0) b.scale.set(o.sx * earS, o.sy * earS, o.sz * earS);
  });

  // 앞다리 — 가만히 앉아 있어도 체중을 옮기고(굶주리면 힘없이 처지고), 출출하면 앞발 하나를 들어 톡톡 조르고,
  // 쓰다듬으면 양발을 번갈아 꾹꾹 누르고, 신나서 폴짝일 땐 앞발이 올라가고, 먹을 땐 몸이 숙어도 발은 바닥에 버틴다
  const sway = Math.sin(t * 0.55) * m.shift;
  const knead = Math.sin(act.petT * 9);
  const begging = m.beg > 0 ? pulse(t, 4.6 - m.beg * 1.2, 1.1, 0.4) * m.beg : 0;
  const legs: [Object3D | null, Object3D | null, number][] = [[r.foreL, r.pawL, 1], [r.foreR, r.pawR, -1]];
  for (const [fore, paw, s] of legs) {
    if (!fore) continue;
    const o = rest(fore);
    const k = s > 0 ? knead : -knead;
    const press = Math.max(0, k) * pet; // 번갈아 누를 때만 앞으로 내민다
    const beg = s < 0 ? begging : 0; // 오른쪽 앞발로 조른다
    fore.rotation.x = o.rx + sway * s + m.legSag - hop * 0.4 - press * 0.45 - beg * 1.3 - eat * 0.16; // 조를 땐 앞발을 가슴 높이까지 (그릇에 가려지지 않게 높이)
    fore.rotation.z = o.rz + s * m.legSag * 0.5;
    if (paw) {
      const p = rest(paw);
      paw.rotation.x = p.rx + m.legSag * 0.6 + press * 0.3 + beg * (0.7 + Math.sin(t * 14) * 0.3) + hop * 0.15;
    }
  }

  // 눈 — 깜빡임 · 눈꺼풀(쓰다듬으면 기분 좋아 감김) · 크기 · 시선
  const blink = blinkAmount(t, m.blinkSpeed);
  const lid = Math.max(m.lid, pet * 0.72, eat * 0.25);
  for (const e of r.eyes) {
    const o = rest(e);
    const s = m.eyeScale * look.eyeScale;
    e.scale.set(o.sx * s, o.sy * s * (1 - lid * 0.55) * (1 - blink * 0.92), o.sz);
    e.position.x = o.px + m.gazeX * 0.012;
    e.position.y = o.py - m.gazeY * 0.012;
  }

  // 입 — 상태의 표정. 먹을 땐 벌렸다 다물기를 반복하고, 쓰다듬을 땐 웃는다
  let mouth: MouthName = m.mouth;
  if (eat > 0.05) mouth = Math.sin(act.eatT * 13) > 0 ? "open" : "smile";
  else if (pet > 0.2) mouth = "smile";
  showMouth(r, mouth);

  // 굶주림의 눈썹 · 눈물 (눈물은 흘러내렸다 다시 맺힌다)
  if (r.brows) r.brows.visible = m.tear && pet < 0.3 && eat < 0.3;
  if (r.tear) {
    const o = rest(r.tear);
    const f = ((t + 0.9) % 1.7) / 1.7; // 위상을 밀어 정지 화면(t=0)에서도 맺힌 눈물이 보이게 한다
    r.tear.visible = m.tear && f > 0.06 && pet < 0.3;
    r.tear.position.y = o.py - f * 0.34;
    const mat = (r.tear as unknown as { material?: Material }).material;
    if (mat) mat.opacity = 0.85 * (1 - f * 0.65);
  }

  // 떨림 · 신나서 폴짝 · 몸통을 눕힌 만큼 뿌리를 내려 발바닥을 바닥에 둔다
  if (r.root) {
    const o = rest(r.root);
    r.root.position.x = o.px + Math.sin(t * 80) * m.tremble * 0.015;
    r.root.position.y = o.py + hop * 0.35 - BODY_JOINT_Y * (1 - by);
  }
}
