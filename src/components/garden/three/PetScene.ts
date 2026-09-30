/**
 * 3D 동물 장면 조립기 — 동물(GLB 복제본) · 알 · 밥그릇 · 하트 · 장신구 · 그림자를 하나의 `root`로 묶고,
 * 매 프레임 `update()`가 성장 단계 · 배고픔 · 밥 먹기 · 쓰다듬기를 반영한다. three만 import한다 (R3F · React 없음).
 * 네이티브(`ClayPetView.tsx`)와 웹(`ClayPetView.web.tsx`)이 같은 이 클래스를 쓴다 — 둘의 차이는 GLB를 여는 방법뿐이다.
 */
import { CircleGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry, Vector3, type Material, type Object3D } from "three";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";

import { moodFor, type Mood } from "@/components/garden/art/moods";
import type { PetCondition } from "@/logic/garden";
import type { AnimalStatus, AnimalTypeId } from "@/shared/garden-utils";

import { makeAura, makeCrown, makeScarf, type Aura } from "./accessories";
import { makeEgg, type Egg } from "./egg";
import { STAGE_LOOK } from "./growth";
import { makeBowl, makeHearts, type Bowl, type Hearts } from "./props3d";
import { applyRig, makeRig, type Action, type Rig } from "./rig";

/** 밥 먹는 연출 길이(초) · 쓰다듬기 한 번이 이어지는 길이 */
export const EAT_DURATION = 3.6;
export const PET_DURATION = 1.7;

/** 스크린샷용 — 동작의 한 순간을 붙잡아 둔다 */
export type HoldAction = "eat" | "pet" | null;

export interface FrameInput {
  stage: AnimalStatus;
  condition: PetCondition;
  /** 저녁까지 출출하면 더 초조해한다 */
  anxious: boolean;
  /** 천천히 좌우로 돌려 3D를 확인한다 */
  spin: boolean;
  /** 고정 회전각(rad) — 뒷모습 · 3/4 각도를 정지 화면으로 볼 때 (spin이 켜져 있으면 무시) */
  yaw?: number;
  /** true면 시간을 t=0에 두고 단계 전환도 즉시 (스크린샷용) */
  still: boolean;
  hold: HoldAction;
}

const ease = (x: number) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

export class PetScene {
  /** 장면 전체 — R3F에 `<primitive object={scene.root} />`로 넣는다 */
  readonly root = new Group();
  private readonly stageGroup = new Group();
  private readonly model: Object3D;
  private readonly rig: Rig;
  private readonly egg: Egg;
  private readonly aura: Aura;
  private readonly bowl: Bowl;
  private readonly hearts: Hearts;
  private readonly scarf: Object3D;
  private readonly crown: Object3D;
  private readonly owned: Object3D[] = [];

  private stage: AnimalStatus | null = null;
  private scale = 1;
  private popStart = -99;
  private eatStart = -99;
  private petStart = -99;
  private petUntil = -99;
  private lastHeart = -99;
  private heldHearts = false;
  private moodKey = "";
  private mood: Mood = moodFor("fed", false);
  private readonly tmp = new Vector3();

  constructor(kind: AnimalTypeId, source: Object3D) {
    // GLB 장면은 useLoader가 캐시해 공유한다 — 장신구를 뼈대에 붙이므로 뼈대까지 복제해 이 장면 전용으로 쓴다
    this.model = cloneSkinned(source);
    this.stageGroup.add(this.model);
    this.root.add(this.stageGroup);
    this.rig = makeRig(this.model, kind);

    // 그림자 — 발밑의 겹친 원판 셋 (네이티브엔 캔버스 그라데이션이 없어 원판을 겹쳐 가장자리를 부드럽게)
    const shadow = new Group();
    [[1.35, 0.1], [1.05, 0.12], [0.75, 0.14]].forEach(([r, o]) => {
      const disc = new Mesh(new CircleGeometry(r, 36), new MeshBasicMaterial({ color: "#000000", transparent: true, opacity: o, depthWrite: false }));
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.012;
      shadow.add(disc);
    });
    shadow.position.z = -0.05;
    this.stageGroup.add(shadow);

    this.egg = makeEgg(kind);
    this.stageGroup.add(this.egg.group);

    this.bowl = makeBowl();
    this.bowl.group.position.set(0, 0, 1.5);
    this.bowl.group.scale.setScalar(0.62);
    this.stageGroup.add(this.bowl.group);

    this.aura = makeAura();
    this.stageGroup.add(this.aura.group);

    // 탭을 받는 넉넉한 투명 구 — 동물 · 알 어디를 눌러도 쓰다듬는다 (그리지는 않는다)
    const hit = new Mesh(new SphereGeometry(1.6, 12, 8), new MeshBasicMaterial({ visible: false }));
    hit.position.set(0, 1.5, 0.15);
    hit.name = "HitArea";
    this.stageGroup.add(hit);

    this.hearts = makeHearts();
    this.root.add(this.hearts.group); // 단계 배율을 받지 않는다 — 하트는 늘 같은 크기

    // 장신구는 모델 공간 좌표로 만들어 뼈대에 붙인다 (지금은 root · stageGroup이 항등이라 좌표가 그대로 맞는다)
    this.root.updateMatrixWorld(true);
    this.scarf = makeScarf();
    this.crown = makeCrown(kind);
    this.stageGroup.add(this.scarf, this.crown);
    this.rig.body?.attach(this.scarf);
    this.rig.head?.attach(this.crown);

    this.owned.push(shadow, this.egg.group, this.bowl.group, this.aura.group, this.hearts.group, this.scarf, this.crown, hit);

    // 탭 판정은 투명 구(hit)만 받는다. R3F는 탭마다 광선을 쏘는데, 3만 삼각형짜리 스키닝 메시를 맞히려면 삼각형마다 뼈대 변환을 계산해야 해서
    // Hermes에서 1.7초 넘게 JS 스레드가 막혔다 (탭 뒤 화면이 굳고 쓰다듬기가 한참 뒤에야 시작) — 핸들러도 겹친 메시마다 5번씩 불렸다
    const skipRaycast = () => {};
    this.root.traverse((o) => {
      if (o !== hit && (o as Mesh).isMesh) (o as Mesh).raycast = skipRaycast;
    });
  }

  /** 밥 주기 · 쓰다듬기는 **요청만 남긴다** — 시작 시각은 다음 `update(t)`가 프레임 루프의 시계로 잰다 (이벤트 핸들러는 시계를 몰라도 된다). */
  requestFeed(): void {
    this.feedRequested = true;
  }

  /** 쓰다듬기 — 탭할 때마다 (이어 누르면 이어서) */
  requestPet(): void {
    this.petRequested = true;
  }

  private feedRequested = false;
  private petRequested = false;

  update(t: number, dt: number, input: FrameInput): void {
    const { stage, still } = input;
    const look = STAGE_LOOK[stage];
    const isEgg = stage === "egg";

    // 들어온 요청을 이 프레임의 시각으로 시작한다 (정지 화면에서는 무시)
    if (this.feedRequested && !still) this.eatStart = t;
    if (this.petRequested && !still) {
      if (t >= this.petUntil) this.petStart = t;
      this.petUntil = t + PET_DURATION;
    }
    this.feedRequested = false;
    this.petRequested = false;

    // 단계 전환 — 크기가 부드럽게 따라가고, 바뀐 순간 통 튀며 (살짝 커졌다 돌아온다)
    if (this.stage !== stage) {
      const first = this.stage === null;
      this.stage = stage;
      if (!first && !still) this.popStart = t;
      if (first || still) this.scale = look.scale;
      this.egg.group.visible = isEgg;
      this.model.visible = !isEgg;
      this.bowl.group.visible = !isEgg;
      this.scarf.visible = look.scarf;
      this.crown.visible = look.crown;
      this.aura.group.visible = look.aura;
    }
    this.scale = still ? look.scale : this.scale + (look.scale - this.scale) * (1 - Math.exp(-Math.min(dt, 0.1) * 9));
    const pop = t - this.popStart;
    const popK = pop >= 0 && pop < 1 ? Math.exp(-pop * 5) * Math.sin(pop * 16) * 0.13 : 0;
    this.stageGroup.scale.setScalar(this.scale * (1 + popK));
    this.stageGroup.rotation.y = input.spin ? Math.sin(t * 0.6) * 0.7 : (input.yaw ?? 0);

    // 동작의 세기 (0~1)
    const eatAge = input.hold === "eat" ? 0.2 : t - this.eatStart;
    const eatOn = !isEgg && eatAge >= 0 && eatAge < EAT_DURATION;
    const eat = input.hold === "eat" ? 1 : eatOn ? ease(eatAge / 0.45) * ease((EAT_DURATION - eatAge) / 0.45) : 0;
    const petOn = t < this.petUntil;
    const pet = input.hold === "pet" ? 1 : petOn ? ease((t - this.petStart) / 0.25) * ease((this.petUntil - t) / 0.5) : 0;
    const petT = input.hold === "pet" ? 0.4 : t - this.petStart;    // 밥그릇 — 배부르면 조금 남고, 배고프면 텅 비어 있다. 먹는 동안 가득 → 남은 만큼으로 줄어든다
    const rest = input.condition === "fed" ? 0.55 : 0;
    const bowlFill = input.hold === "eat" ? 0.7 : eatOn ? 1 - (1 - rest) * ease(eatAge / EAT_DURATION) : rest;
    this.bowl.setFill(bowlFill);

    // 동물 · 알
    if (isEgg) {
      this.egg.update(t, pet);
    } else {
      const key = `${input.condition}:${input.anxious}`;
      if (key !== this.moodKey) {
        this.moodKey = key;
        this.mood = moodFor(input.condition, input.anxious);
      }
      const act: Action = { eat, eatT: eatAge, pet, petT };
      applyRig(this.rig, this.mood, t, act, { headScale: look.headScale, eyeScale: look.eyeScale });
    }
    if (look.aura) this.aura.update(t);

    // 쓰다듬는 동안 0.55초마다 하트가 올라온다 (스크린샷 고정 땐 한 번만 띄워 둔다)
    if (pet > 0.5) {
      if (input.hold === "pet") {
        if (!this.heldHearts) {
          this.heldHearts = true;
          this.hearts.spawn(t - 0.6, this.heartOrigin(isEgg));
        }
      } else if (t - this.lastHeart > 0.55) {
        this.lastHeart = t;
        this.hearts.spawn(t, this.heartOrigin(isEgg));
      }
    }
    this.hearts.update(t);
  }

  /** 머리(알이면 꼭대기) 위쪽 — root 좌표 */
  private heartOrigin(isEgg: boolean): Vector3 {
    const v = this.tmp;
    if (isEgg) v.set(0, 2.1 * this.scale, 0.1);
    else if (this.rig.head) {
      this.root.updateWorldMatrix(true, true);
      this.rig.head.getWorldPosition(v);
      this.root.worldToLocal(v);
      v.y += 0.55 * this.scale; // 머리 관절(1.4)보다 위 — 뺨 높이
      v.z += 0.85 * this.scale; // 얼굴 앞쪽 (귀에 가려지지 않게)
    } else v.set(0, 2.4 * this.scale, 0.3);
    return v;
  }

  /** 이 장면이 만든 지오메트리 · 재질을 정리한다 (공유 GLB 원본은 건드리지 않는다) */
  dispose(): void {
    const seen = new Set<unknown>();
    const free = (o: Object3D) => {
      o.traverse((c) => {
        const mesh = c as Mesh;
        if (mesh.geometry && !seen.has(mesh.geometry)) {
          seen.add(mesh.geometry);
          mesh.geometry.dispose();
        }
        const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        for (const m of mats as Material[]) {
          if (!seen.has(m)) {
            seen.add(m);
            m.dispose();
          }
        }
      });
    };
    this.owned.forEach(free);
  }
}
