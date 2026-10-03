/**
 * 3D 동물 캔버스 (네이티브) — 장면 조립은 `PetScene`이 하고, 이 파일은 GLB를 열어 R3F 캔버스에 올릴 뿐이다.
 * 정원 방(`PetStage`)과 확인용 뷰어(`ClayPetView`)가 같이 쓴다. 캔버스는 화면당 하나 (GL 컨텍스트 여러 개는 모바일에서 메모리로 죽는다).
 * 배경은 투명하다 — 방 그림 위에 그대로 얹힌다.
 */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber/native";
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
  petSignal = 0,
  layout = VIEWER_LAYOUT,
  onReady,
  onEvent,
  interactive = false,
}: PetCanvasProps) {
  const gltf = useLoader(GLTFLoader, PET_MODELS[type]);
  const scene = useMemo(() => new PetScene(type, gltf.scene), [gltf, type]);
  const invalidate = useThree((s) => s.invalidate);
  const seen = useRef({ eat: eatSignal, pet: petSignal });
  const readied = useRef(false);

  useEffect(() => () => scene.dispose(), [scene]);
  useEffect(() => {
    scene.setEventHandler(onEvent ?? null);
  }, [scene, onEvent]);
  // 정지 모드(demand)는 값이 바뀔 때만 다시 그린다
  useEffect(() => {
    invalidate();
  }, [invalidate, scene, stage, condition, anxious, spin, yaw, still, hold]);

  useFrame((state, dt) => {
    if (eatSignal !== seen.current.eat) {
      seen.current.eat = eatSignal;
      scene.requestFeed();
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
      testID="pet-canvas"
      style={{ flex: 1 }}
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
