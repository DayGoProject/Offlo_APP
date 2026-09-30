/**
 * 성장 장신구 — 스카프(강화 성체) · 왕관(전설) · 오라(전설). three만 쓰는 순수 코드 (네이티브 · 웹 공용).
 * 스카프는 몸통 뼈대에, 왕관은 머리 뼈대에 붙어 함께 움직이고, 오라는 발밑에서 천천히 돌며 반짝임이 떠오른다.
 */
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
} from "three";

import type { AnimalTypeId } from "@/shared/garden-utils";

import { CROWN_SPOT } from "./growth";

/**
 * 스카프 — 목(머리 아래 · 가슴 위)에 두른 고리 + 늘어진 끝자락 두 개. **모델 공간** 좌표로 만들고 몸통 뼈대에 `attach`한다.
 * 머리 타원체는 y≈1.0에서 폭이 좁아져(반폭 ~0.4) 그 아래 가슴(반폭 ~0.57)이 스카프를 받친다.
 */
export function makeScarf(): Group {
  const g = new Group();
  g.name = "Scarf";
  const red = new MeshStandardMaterial({ color: "#E5544D", roughness: 0.7 });
  const dark = new MeshStandardMaterial({ color: "#B63A36", roughness: 0.7 });

  const ring = new Mesh(new TorusGeometry(0.6, 0.13, 12, 36), red);
  ring.rotation.x = Math.PI / 2 + 0.1;
  ring.scale.set(1.02, 0.94, 1);
  ring.position.set(0, 1.0, 0.1);
  g.add(ring);

  // 매듭 + 늘어진 끝자락 (가슴 앞으로)
  const knot = new Mesh(new SphereGeometry(0.15, 14, 10), dark);
  knot.position.set(0.28, 0.93, 0.62);
  g.add(knot);
  const tail1 = new Mesh(new BoxGeometry(0.2, 0.5, 0.07), red);
  tail1.position.set(0.3, 0.66, 0.64);
  tail1.rotation.z = 0.12;
  g.add(tail1);
  const tail2 = new Mesh(new BoxGeometry(0.14, 0.38, 0.07), dark);
  tail2.position.set(0.12, 0.72, 0.66);
  tail2.rotation.z = -0.1;
  g.add(tail2);
  return g;
}

/** 왕관 — 금빛 띠 + 뾰족한 다섯 봉우리 + 보석. **모델 공간** 좌표(`CROWN_SPOT`)로 만들고 머리 뼈대에 `attach`한다 */
export function makeCrown(kind: AnimalTypeId): Group {
  const spot = CROWN_SPOT[kind];
  const g = new Group();
  g.name = "Crown";
  const gold = new MeshStandardMaterial({ color: "#FFCE4A", metalness: 0.25, roughness: 0.35, emissive: "#7A5200", emissiveIntensity: 0.55 });
  gold.side = DoubleSide;

  const r = spot.r;
  const band = new Mesh(new CylinderGeometry(r, r * 1.08, 0.17, 24, 1, true), gold);
  g.add(band);
  const rimTop = new Mesh(new TorusGeometry(r, 0.018, 8, 24), gold);
  rimTop.rotation.x = Math.PI / 2;
  rimTop.position.y = 0.085;
  g.add(rimTop);

  const jewelColors = ["#FF6F8E", "#9FD4FF", "#FF6F8E", "#9FD4FF", "#FF6F8E"];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spike = new Mesh(new ConeGeometry(r * 0.3, 0.27 + r * 0.25, 6), gold);
    spike.position.set(Math.sin(a) * r * 0.92, 0.085 + (0.27 + r * 0.25) / 2, Math.cos(a) * r * 0.92);
    g.add(spike);
    const tip = new Mesh(new SphereGeometry(r * 0.1, 8, 6), new MeshStandardMaterial({ color: jewelColors[i], roughness: 0.25, emissive: jewelColors[i], emissiveIntensity: 0.35 }));
    tip.position.set(Math.sin(a) * r * 0.92, 0.085 + 0.27 + r * 0.25, Math.cos(a) * r * 0.92);
    g.add(tip);
  }
  const jewel = new Mesh(new SphereGeometry(r * 0.13, 10, 8), new MeshStandardMaterial({ color: "#FF3D6E", roughness: 0.2, emissive: "#FF3D6E", emissiveIntensity: 0.5 }));
  jewel.position.set(0, 0, r * 1.06);
  g.add(jewel);

  g.position.set(0, spot.y, spot.z);
  g.rotation.x = spot.tilt;
  return g;
}

export interface Aura {
  group: Group;
  update: (t: number) => void;
}

/** 오라 — 발밑에서 퍼지는 금빛 고리 여러 겹 + 위로 떠오르는 반짝임 */
export function makeAura(): Aura {
  const group = new Group();
  group.name = "Aura";

  const rings: Mesh[] = [];
  [[0.95, 1.5, 0.2], [1.5, 2.05, 0.13], [2.05, 2.6, 0.08], [2.6, 3.1, 0.045]].forEach(([inner, outer, opacity]) => {
    const m = new Mesh(new RingGeometry(inner, outer, 56), new MeshBasicMaterial({ color: "#FFE08A", transparent: true, opacity, depthWrite: false, side: DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.03;
    group.add(m);
    rings.push(m);
  });

  const sparks: Mesh[] = [];
  for (let i = 0; i < 12; i++) {
    const s = new Mesh(new OctahedronGeometry(0.06, 0), new MeshBasicMaterial({ color: "#FFF3B0", transparent: true, opacity: 0.9, depthWrite: false }));
    group.add(s);
    sparks.push(s);
  }

  return {
    group,
    update(t) {
      rings.forEach((m, i) => {
        m.scale.setScalar(1 + Math.sin(t * 1.4 - i * 0.6) * 0.035);
      });
      sparks.forEach((s, i) => {
        const life = (t * 0.32 + i * 0.083) % 1;
        const ang = t * 0.55 + i * 0.9;
        const rad = 1.05 + 0.5 * Math.sin(i * 1.7) + life * 0.25;
        s.position.set(Math.sin(ang) * rad, 0.15 + life * 2.9, Math.cos(ang) * rad);
        s.rotation.y = t * 2 + i;
        s.scale.setScalar(0.6 + Math.sin(life * Math.PI) * 0.9);
        (s.material as MeshBasicMaterial).opacity = Math.sin(life * Math.PI) * 0.9;
      });
    },
  };
}
