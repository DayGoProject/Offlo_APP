/**
 * 3D 소품 — 밥그릇 · 하트 이펙트. three만 쓰는 순수 코드 (네이티브 · 웹 공용).
 * 밥그릇은 "밥 = 오늘의 분석"의 상태를 그림으로 말한다: 배부르면 가득, 아니면 텅 빔, 먹는 동안 줄어든다.
 */
import {
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Shape,
  SphereGeometry,
  Vector2,
  Vector3,
} from "three";

export interface Bowl {
  group: Group;
  /** 0(빔) ~ 1(가득) */
  setFill: (level: number) => void;
}

export function makeBowl(): Bowl {
  const group = new Group();
  group.name = "Bowl";

  // 그릇 몸통 (안팎 프로필을 하나로 이은 선반 회전체)
  const profile = [
    [0.0, 0.0], [0.52, 0.0], [0.74, 0.06], [0.94, 0.3], [1.0, 0.44], [0.93, 0.47],
    [0.8, 0.22], [0.42, 0.16], [0.0, 0.16],
  ].map(([x, y]) => new Vector2(x, y));
  const body = new Mesh(new LatheGeometry(profile, 40), new MeshStandardMaterial({ color: "#5B6C8F", roughness: 0.42, metalness: 0.05 }));
  group.add(body);
  const rim = new Mesh(new SphereGeometry(1, 1, 1), new MeshStandardMaterial({ color: "#7C8FB5", roughness: 0.4 }));
  rim.visible = false; // 자리 표시 — 림 색은 프로필이 대신한다
  group.add(rim);

  // 밥 — 봉긋한 더미 + 알갱이
  const food = new Group();
  food.name = "Food";
  const mound = new Mesh(new SphereGeometry(0.78, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new MeshStandardMaterial({ color: "#C98B4E", roughness: 0.8 }));
  mound.scale.set(1, 0.5, 1);
  mound.position.y = 0.16;
  food.add(mound);
  const kibbleMat = new MeshStandardMaterial({ color: "#E3A968", roughness: 0.7 });
  for (let i = 0; i < 12; i++) {
    const a = i * 2.399;
    const r = 0.1 + 0.5 * ((i * 0.37) % 1);
    const k = new Mesh(new SphereGeometry(0.075, 8, 6), kibbleMat);
    k.position.set(Math.sin(a) * r, 0.16 + Math.sqrt(Math.max(0.0, 0.78 * 0.78 - r * r)) * 0.5 - 0.02, Math.cos(a) * r);
    food.add(k);
  }
  group.add(food);

  return {
    group,
    setFill(level) {
      const l = Math.max(0, Math.min(1, level));
      food.visible = l > 0.04;
      food.scale.set(0.5 + 0.5 * l, 0.45 + 0.55 * l, 0.5 + 0.5 * l); // 조금 남아도 알갱이가 보이게 바닥을 두고 줄인다
    },
  };
}

export interface Hearts {
  group: Group;
  /** 머리 위 `origin`(월드) 근처에서 하트를 띄운다 */
  spawn: (t: number, origin: Vector3) => void;
  update: (t: number) => void;
}

const LIFE = 1.5;

export function makeHearts(): Hearts {
  const group = new Group();
  group.name = "Hearts";

  const s = new Shape();
  s.moveTo(0, 0.25);
  s.bezierCurveTo(0, 0.25, -0.05, 0, -0.25, 0);
  s.bezierCurveTo(-0.55, 0, -0.55, 0.35, -0.55, 0.35);
  s.bezierCurveTo(-0.55, 0.55, -0.35, 0.77, 0, 0.95);
  s.bezierCurveTo(0.35, 0.77, 0.55, 0.55, 0.55, 0.35);
  s.bezierCurveTo(0.55, 0.35, 0.55, 0, 0.25, 0);
  s.bezierCurveTo(0.1, 0, 0, 0.25, 0, 0.25);
  const geo = new ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 3 });
  geo.center();

  const pool = Array.from({ length: 8 }, () => {
    const mat = new MeshStandardMaterial({ color: "#FF6F8E", emissive: "#FF3D6E", emissiveIntensity: 0.55, roughness: 0.35, transparent: true, opacity: 0 });
    const m = new Mesh(geo, mat);
    m.visible = false;
    group.add(m);
    return { mesh: m, born: -99, ox: 0, oy: 0, oz: 0, drift: 0, size: 0.3 };
  });

  let flip = 0; // 호출마다 처음 나가는 쪽이 바뀐다 (한쪽으로만 쏠리지 않게)

  return {
    group,
    spawn(t, origin) {
      flip++;
      let n = 0;
      for (const h of pool) {
        if (t - h.born < LIFE || n >= 3) continue;
        h.born = t + n * 0.18; // 조금씩 시차를 두고 올라간다
        // 얼굴 양옆(눈 바깥)에서 올라간다 — 머리 위로 띄우면 토끼는 두 귀 사이에 겹친다
        const side = (n + flip) % 2 === 0 ? 1 : -1;
        h.ox = origin.x + side * (0.78 + Math.random() * 0.3);
        h.oy = origin.y + 0.1;
        h.oz = origin.z + 0.3;
        h.drift = side * (0.05 + Math.random() * 0.3);
        h.size = 0.26 + Math.random() * 0.14;
        n++;
      }
    },
    update(t) {
      for (const h of pool) {
        const life = (t - h.born) / LIFE;
        const alive = life >= 0 && life <= 1;
        h.mesh.visible = alive;
        if (!alive) continue;
        h.mesh.position.set(h.ox + Math.sin(life * 5) * 0.12 + h.drift * life, h.oy + life * 1.6, h.oz);
        h.mesh.rotation.z = Math.sin(life * 6) * 0.25;
        h.mesh.scale.setScalar(h.size * (life < 0.18 ? life / 0.18 : 1)); // 톡 튀어나온다
        (h.mesh.material as MeshStandardMaterial).opacity = life < 0.7 ? 1 : 1 - (life - 0.7) / 0.3;
      }
    },
  };
}
