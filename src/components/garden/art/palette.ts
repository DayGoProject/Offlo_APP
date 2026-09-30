/**
 * 정원 일러스트 팔레트 — design.md "콘텐츠 일러스트 예외". **일러스트의 색은 이 파일에만 둔다.**
 * HUD · 카드 · 버튼 · 글자는 `@/theme`의 3색 규칙을 그대로 따른다 (여기 색을 UI에 쓰지 않는다).
 *
 * 방향: 밤 창가의 아늑한 방 — 따뜻한 램프 빛 + 짙은 푸른 그림자. 동물이 화면에서 가장 밝고 따뜻한 지점이다.
 * 동물은 면마다 밝은 면(light) · 기본(base) · 그림자(shade) 3톤으로 칠한다.
 */

export const room = {
  wallTop: "#1A2743",
  wallBottom: "#0F182B",
  baseboard: "#0A101D",
  floorTop: "#4B3528",
  floorBottom: "#2A1D17",
  plank: "rgba(0, 0, 0, 0.28)",
  plankLight: "rgba(255, 224, 190, 0.05)",
  rug: "#233252",
  rugRing: "#33476F",
  rugRingSoft: "rgba(255, 255, 255, 0.06)",
  frame: "#2C3651",
  frameLight: "#3B4767",
  sill: "#36415F",
  curtain: "#1E3B52",
  curtainShade: "#152B3D",
  lampPole: "#3A3F52",
  lampShade: "#F6C47A",
  lampShadeShade: "#D99A4E",
  lampBulb: "#FFE9B8",
  /** 램프 빛 번짐 — 반투명 원을 겹쳐서 만든다 (RadialGradient는 RN Web에서 사각 경계가 보인다) */
  lampGlow: "255, 205, 130",
  stool: "#3A2A24",
  stoolTop: "#54392E",
  vignette: "4, 5, 8",
} as const;

/** 창밖 하늘 — 시간대(KST)별 위 → 아래 */
export const sky = {
  dawn: { top: "#3B4A7A", bottom: "#F2B38A" },
  day: { top: "#5CA8E8", bottom: "#BDE3FA" },
  dusk: { top: "#3E3A7C", bottom: "#F08A6B" },
  night: { top: "#0B1230", bottom: "#1D2B57" },
  star: "#FFF4D6",
  moon: "#FFF1C4",
  moonShade: "#F0DC9E",
  sun: "#FFE49A",
  cloud: "rgba(255, 255, 255, 0.85)",
} as const;

export const cat = {
  base: "#F0A05C",
  light: "#FFC98F",
  shade: "#C7783A",
  belly: "#FFE3C4",
  earInner: "#FF9FB2",
  nose: "#F27C9A",
  eye: "#1D1A2A",
  /** 눈 아래쪽 홍채 빛 */
  iris: "#7C66C9",
  blush: "#FF7E7E",
  stripe: "#B7602A",
  mouth: "#B5527A",
  whisker: "rgba(255, 255, 255, 0.65)",
  tailTip: "#C7783A",
} as const;

export const dog = {
  base: "#E5BC7B",
  light: "#F8DDA8",
  shade: "#B98A4C",
  belly: "#FFF1D6",
  ear: "#8E5F36",
  earShade: "#6E4626",
  nose: "#2A2028",
  eye: "#1D1A2A",
  blush: "#FF8E86",
  mouth: "#8A4C3A",
  tongue: "#FF8FA3",
  patch: "#A8703E",
} as const;

export const rabbit = {
  base: "#EFEAF8",
  light: "#FFFFFF",
  shade: "#C6BBDF",
  belly: "#FFFFFF",
  earInner: "#F7A9C4",
  nose: "#F27C9A",
  eye: "#2A1E3A",
  blush: "#FF9CB8",
  mouth: "#B5527A",
  tail: "#FFFFFF",
} as const;

/** 알 — 고른 동물의 무늬 색이 살짝 비친다 */
export const egg = {
  shell: "#FFF1DC",
  shellLight: "#FFFFFF",
  shellShade: "#E8CFA6",
  crack: "#CDAE7A",
  speckle: { cat: "#D9884A", dog: "#B98A4C", rabbit: "#B7A6DA" },
} as const;

export const props = {
  bowl: "#5B6C8F",
  bowlLight: "#7C8FB5",
  bowlShade: "#3F4D6C",
  bowlInside: "#2B3550",
  kibble: "#C98B4E",
  kibbleLight: "#E3A968",
  carrot: "#F0873A",
  carrotLeaf: "#5DBE7A",
  heart: "#FF6F8E",
  sparkle: "#FFE9A6",
  gold: "#FFCE4A",
  goldShade: "#D99B1F",
  scarf: "#E5544D",
  scarfShade: "#B63A36",
  tear: "#9FD4FF",
  shadow: "rgba(0, 0, 0, 0.32)",
} as const;

/** 말풍선 — 어두운 방 위에서 읽히는 밝은 종이색 */
export const bubble = {
  fill: "#F6EFE2",
  text: "#3A2A1F",
  border: "rgba(58, 42, 31, 0.12)",
} as const;
