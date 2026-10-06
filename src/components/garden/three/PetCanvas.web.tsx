/**
 * 3D 동물 캔버스 (웹) — 네이티브(PetCanvas.tsx)와 같은 장면. 웹은 `@react-three/fiber` 본체를 쓰고 GLB는 에셋 주소로 연다.
 */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Asset } from "expo-asset";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { PetScene } from "./PetScene";
import { PET_MODELS } from "./pets";
import { VIEWER_LAYOUT, type PetCanvasProps } from "./petCanvasTypes";

function Pet({
  type,
  stage,
  condition,
  anxious = false,
  spin = false,
  yaw = 0,
  still = false,
  hold = null,
  eatSignal = 0,
  eatRecovery = false,
  petSignal = 0,
  layout = VIEWER_LAYOUT,
  onReady,
  onEvent,
  interactive = false,
}: PetCanvasProps) {
  const uri = useMemo(() => Asset.fromModule(PET_MODELS[type] as unknown as number).uri, [type]);
  const gltf = useLoader(GLTFLoader, uri);
  const scene = useMemo(() => new PetScene(type, gltf.scene), [gltf, type]);
  const invalidate = useThree((s) => s.invalidate);
  const seen = useRef({ eat: eatSignal, pet: petSignal });
  const readied = useRef(false);

  useEffect(() => () => scene.dispose(), [scene]);
  // 장면이 밥 · 부화 · 성장을 "지금 시작했다"고 알리면 햅틱이 난다
  useEffect(() => {
    scene.setEventHandler(onEvent ?? null);
    return () => scene.setEventHandler(null);
  }, [scene, onEvent]);
  // 정지 모드(demand)는 값이 바뀔 때만 다시 그린다
  useEffect(() => {
    invalidate();
  }, [invalidate, scene, stage, condition, anxious, spin, yaw, still, hold]);

  useFrame((state, dt) => {
    if (eatSignal !== seen.current.eat) {
      seen.current.eat = eatSignal;
      scene.requestFeed(eatRecovery);
    }
    if (petSignal !== seen.current.pet) {
      seen.current.pet = petSignal;
      scene.requestPet();
    }
    scene.update(still ? 0 : state.clock.elapsedTime, dt, { stage, condition, anxious, spin, yaw, still, hold });
    if (!readied.current) {
      readied.current = true;
      onReady?.();
    }
  });

  return <primitive object={scene.root} scale={layout.fit[type]} position={layout.position} onPointerDown={interactive ? () => scene.requestPet() : undefined} />;
}

export default function PetCanvas(props: PetCanvasProps) {
  const layout = props.layout ?? VIEWER_LAYOUT;
  const frameloop = props.active === false ? "never" : props.still ? "demand" : "always";
  return (
    <Canvas
      data-testid="pet-canvas"
      style={{ flex: 1, minHeight: 100 }}
      frameloop={frameloop}
      camera={{ position: layout.camera, fov: layout.fov }}
      onCreated={({ camera }) => camera.lookAt(layout.lookAt[0], layout.lookAt[1], layout.lookAt[2])}
    >
      <hemisphereLight color="#DCE6FF" groundColor="#B08A66" intensity={1.5} />
      <directionalLight color="#FFE6C0" position={[3.5, 5, 6]} intensity={2.7} />
      <directionalLight color="#FFD7B0" position={[-4, 2, 6]} intensity={0.9} />
      <directionalLight color="#9BB6FF" position={[-4, 3, -4]} intensity={1.0} />
      <Suspense fallback={null}>
        <Pet {...props} />
      </Suspense>
    </Canvas>
  );
}
