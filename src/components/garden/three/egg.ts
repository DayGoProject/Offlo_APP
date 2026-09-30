/**
 * 알 — 동물을 골랐지만 한 번도 밥(분석)을 못 받은 상태. 코드로 빚는다 (모델 파일 없음). 네이티브 · 웹 공용.
 * 달걀 모양(선반 회전체) · 아래로 갈수록 짙어지는 껍질색 · 고른 동물의 무늬 색 반점 · 앞면의 금 · 품은 빛(바깥 반투명 껍질).
 * 정지하지 않는다: 숨쉬듯 부풀고, 가끔 안에서 톡톡 치는 것처럼 흔들리며 살짝 뜬다.
 */
import {
  BackSide,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

import type { AnimalTypeId } from "@/shared/garden-utils";

import { EGG_SPECKLE } from "./growth";

const H = 2.3; // 알 높이
const R = 0.92; // 알 반지름 기준

/** 높이 y(0~H)에서의 반지름 — 아래가 넓고 위가 좁은 달걀 */
function radiusAt(y: number): number {
  const t = Math.acos(1 - (2 * y) / H); // 0(바닥) → π(꼭대기)
  return R * Math.sin(t) * (1 + 0.15 * Math.cos(t));
}

/** 결정적 난수 — 반점 배치가 매번 같다 */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Egg {
  group: Group;
  /** t = 절대 시간(초). 쓰다듬으면(pet 0~1) 더 세게 흔들린다 */
  update: (t: number, pet?: number) => void;
}

export function makeEgg(kind: AnimalTypeId): Egg {
  const group = new Group();
  group.name = "Egg";

  const pts: Vector2[] = [];
  for (let i = 0; i <= 40; i++) {
    const y = (i / 40) * H;
    pts.push(new Vector2(Math.max(radiusAt(y), 0.001), y));
  }
  const geo = new LatheGeometry(pts, 48);
  // 정점 색 — 바닥은 짙은 껍질색, 위로 갈수록 밝은 크림
  const cream = new Color("#FFF6E6");
  const shade = new Color("#E8CFA6");
  const colors: number[] = [];
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const c = shade.clone().lerp(cream, Math.min(1, pos.getY(i) / (H * 0.75)));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new Float32BufferAttribute(colors, 3));
  const shell = new Mesh(geo, new MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0 }));
  group.add(shell);

  // 반점
  const rand = rng(7);
  const speckleMat = new MeshStandardMaterial({ color: EGG_SPECKLE[kind], roughness: 0.7, transparent: true, opacity: 0.55 });
  for (let i = 0; i < 30; i++) {
    const y = 0.3 + rand() * (H - 0.7);
    const a = rand() * Math.PI * 2;
    const r = radiusAt(y);
    const s = 0.045 + rand() * 0.06;
    const m = new Mesh(new SphereGeometry(1, 8, 6), speckleMat);
    m.position.set(Math.sin(a) * r * 0.995, y, Math.cos(a) * r * 0.995);
    m.lookAt(0, y, 0);
    m.scale.set(s, s, s * 0.35);
    group.add(m);
  }

  // 앞면의 금 (+z 쪽)
  const crackPts = [[-0.05, 1.02], [0.09, 1.26], [-0.06, 1.42], [0.1, 1.62], [0.0, 1.78]].map(([x, y]) => new Vector3(x, y, radiusAt(y) * 0.996));
  const crack = new Mesh(new TubeGeometry(new CatmullRomCurve3(crackPts), 20, 0.018, 6, false), new MeshStandardMaterial({ color: "#B99565", roughness: 0.6 }));
  group.add(crack);
  const branch = new Mesh(new TubeGeometry(new CatmullRomCurve3([new Vector3(0.09, 1.26, radiusAt(1.26) * 0.996), new Vector3(0.26, 1.34, radiusAt(1.34) * 0.985)]), 8, 0.014, 6, false), new MeshStandardMaterial({ color: "#B99565", roughness: 0.6 }));
  group.add(branch);

  // 품은 빛 — 겹친 반투명 껍질 둘로 가장자리를 부드럽게 (한 겹이면 회색 외곽선처럼 보인다) + 바닥 그림자
  const halo = new Mesh(geo.clone(), new MeshBasicMaterial({ color: "#FFCF7A", transparent: true, opacity: 0.1, side: BackSide, depthWrite: false }));
  halo.scale.set(1.1, 1.05, 1.1);
  halo.position.y = -0.05;
  group.add(halo);
  const halo2 = new Mesh(geo.clone(), new MeshBasicMaterial({ color: "#FFCF7A", transparent: true, opacity: 0.05, side: BackSide, depthWrite: false }));
  halo2.scale.set(1.24, 1.12, 1.24);
  halo2.position.y = -0.1;
  group.add(halo2);
  const shadow = new Mesh(new CircleGeometry(0.95, 32), new MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.3, depthWrite: false, side: DoubleSide }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  group.add(shadow);

  return {
    group,
    update(t, pet = 0) {
      // 숨쉬기 · 가끔(3.2초마다 0.9초) 톡톡 흔들림
      const breath = (Math.sin(t * 2.1) + 1) / 2;
      const c = (((t + 0.8) % 3.2) + 3.2) % 3.2;
      const shake = c > 2.3 ? Math.sin(((c - 2.3) / 0.9) * Math.PI) : 0;
      const wob = Math.max(shake, pet);
      shell.rotation.z = Math.sin(t * 22) * wob * 0.11;
      shell.scale.set(1 - breath * 0.01, 1 + breath * 0.022, 1 - breath * 0.01);
      shell.position.y = wob * 0.05;
      const glow = Math.sin(t * 1.6);
      halo.scale.set(1.1 + glow * 0.015, 1.05 + glow * 0.015, 1.1 + glow * 0.015);
      halo2.scale.set(1.24 + glow * 0.03, 1.12 + glow * 0.03, 1.24 + glow * 0.03);
      (halo.material as MeshBasicMaterial).opacity = 0.09 + glow * 0.03;
      (halo2.material as MeshBasicMaterial).opacity = 0.045 + glow * 0.02;
    },
  };
}
