/**
 * 앱의 3D 동물 코드를 웹 레포(Offlo)로 복사한다 — 웹 정원이 앱과 같은 동물을 그리도록.
 *
 *   node scripts/sync-pet-web.mjs          비교만 (다르면 exit 1)
 *   node scripts/sync-pet-web.mjs --push   앱 원본으로 웹 복사본을 덮어쓰기
 *
 * **원본은 앱 레포(여기)다** — 웹 → 앱 방향인 `sync-shared.mjs`와 반대다. 웹 쪽 복사본을 직접 고치지 않는다
 * (고치면 다음 `--push`가 지운다). 동물의 모양 · 움직임 · 표정 · 대사를 바꾸려면 여기서 고치고 `--push` 한 뒤 웹 레포에서 커밋한다.
 * 웹 경로가 다르면 OFFLO_WEB_ROOT 환경변수로 지정한다.
 *
 * 복사하는 것: 3D 장면 코드(three만 import — 앱 · 웹이 같은 클래스를 쓴다) · 상태 판정 · 대사 · 팔레트 · GLB 모델 3종.
 * 복사하지 않는 것: 방 그림(`art/Room.tsx` — react-native-svg라 웹은 DOM SVG로 따로 옮겼다) · 장면 조립(`PetStage`) · 캔버스(`PetCanvas` — GLB를 여는 방법이 다르다).
 * 그쪽을 바꾸면 웹 `components/garden/PetRoom.tsx` · `PetStage.tsx` · `components/three/pet/PetCanvas.tsx`도 손으로 맞춘다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WEB_ROOT = process.env.OFFLO_WEB_ROOT ?? resolve(ROOT, "..", "Offlo");

const THREE = "src/components/garden/three";
const WEB_THREE = "web/src/components/three/pet";

/** 앱 원본 → 웹 복사본 */
const FILES = [
  ...["PetScene", "rig", "growth", "egg", "accessories", "props3d", "petCanvasTypes"].map((n) => [`${THREE}/${n}.ts`, `${WEB_THREE}/${n}.ts`]),
  ["src/components/garden/art/moods.ts", "web/src/lib/pet/moods.ts"],
  ["src/components/garden/art/palette.ts", "web/src/lib/pet/palette.ts"],
  ["src/logic/pet-condition.ts", "web/src/lib/pet/condition.ts"],
  ["src/logic/scene.ts", "web/src/lib/pet/scene.ts"],
  ["src/logic/pet.ts", "web/src/lib/pet/affection.ts"],
  ...["cat", "dog", "rabbit"].map((n) => [`assets/models/pets/${n}.glb`, `web/public/models/pets/${n}.glb`]),
];

/** import 경로 — 앱의 별칭을 웹의 파일 위치로 바꾼다 (따옴표까지 맞춰야 `@/logic/pet`이 `@/logic/pet-condition`을 건드리지 않는다) */
const REWRITES = [
  ['"@/shared/garden-utils"', '"@/lib/garden-utils"'],
  ['"@/shared/kst"', '"@/lib/kst"'],
  ['"@/components/garden/art/moods"', '"@/lib/pet/moods"'],
  ['"@/components/garden/art/palette"', '"@/lib/pet/palette"'],
  ['"@/logic/pet-condition"', '"@/lib/pet/condition"'],
  ['"@/logic/scene"', '"@/lib/pet/scene"'],
  ['"@/logic/pet"', '"@/lib/pet/affection"'],
];

const MARK = "@offlo-pet-sync";

const banner = (from) =>
  `/**\n` +
  ` * ${MARK} — 자동 생성 파일. 직접 수정하지 마세요.\n` +
  ` * 원본: Offlo_APP/${from} (앱 레포)\n` +
  ` * 갱신: 앱 레포에서 node scripts/sync-pet-web.mjs --push\n` +
  ` */\n`;

const lf = (text) => text.replace(/\r\n/g, "\n");

function transform(text) {
  let out = lf(text);
  for (const [a, b] of REWRITES) out = out.split(a).join(b);
  return out;
}

/** 배너를 걷어내고 본문만 남긴다 (배너 문구가 바뀌어도 diff로 잡히지 않게) */
function body(text) {
  const t = lf(text);
  if (!t.startsWith("/**") || !t.includes(MARK)) return t;
  return t.slice(t.indexOf("*/") + 2).replace(/^\n/, "");
}

const push = process.argv.includes("--push");

if (!existsSync(WEB_ROOT)) {
  console.error(`✗ 웹 레포를 찾을 수 없습니다: ${WEB_ROOT}`);
  console.error(`  OFFLO_WEB_ROOT 환경변수로 경로를 지정하세요.`);
  process.exit(2);
}

let drift = 0;

for (const [from, to] of FILES) {
  const srcPath = resolve(ROOT, from);
  const dstPath = resolve(WEB_ROOT, to);

  if (!existsSync(srcPath)) {
    console.error(`✗ 앱 원본 없음: ${from}`);
    drift++;
    continue;
  }

  const binary = from.endsWith(".glb");
  let same;
  let wanted;
  if (binary) {
    wanted = readFileSync(srcPath);
    same = existsSync(dstPath) && readFileSync(dstPath).equals(wanted);
  } else {
    wanted = transform(readFileSync(srcPath, "utf8"));
    same = existsSync(dstPath) && body(readFileSync(dstPath, "utf8")) === wanted;
  }

  if (same) {
    console.log(`✓ ${to}`);
    continue;
  }

  drift++;
  if (push) {
    mkdirSync(dirname(dstPath), { recursive: true });
    const isNew = !existsSync(dstPath);
    writeFileSync(dstPath, binary ? wanted : banner(from) + wanted);
    console.log(`↑ ${to}  ${isNew ? "(신규 복사)" : "(앱 원본으로 갱신)"}`);
  } else {
    console.error(existsSync(dstPath) ? `✗ ${to} — 앱 원본과 다름` : `✗ ${to} — 웹에 복사본 없음`);
  }
}

if (drift === 0) {
  console.log("\n웹의 동물 코드가 앱 원본과 동일합니다.");
  process.exit(0);
}
if (push) {
  console.log(`\n${drift}개 파일을 앱 원본으로 맞췄습니다. (웹 레포에서 커밋하세요)`);
  process.exit(0);
}
console.error(`\n${drift}개 파일이 앱 원본과 갈라져 있습니다. 'node scripts/sync-pet-web.mjs --push' 로 맞추세요.`);
process.exit(1);
