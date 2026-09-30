/**
 * GLB 검사 — 뼈대 · 삼각형 · 재질 · 텍스처 · 애니메이션 클립 · 필수 확장을 읽어 요약한다 (JSON 청크만 읽는다 — 모델을 실행하지 않는다).
 *
 *   node scripts/inspect-glb.mjs assets/models/incoming/cat-2023.glb [...]
 *   node scripts/inspect-glb.mjs assets/models/incoming            # 폴더째
 *
 * 3D 동물 모델을 들이기 전 확인용 (docs/garden-game-design.md 8-2): RN에서 안 되는 것(Draco · meshopt · KTX2 압축)이 있는지,
 * 뼈대(머리 · 귀 · 꼬리 · 척추)가 있는지, 클립이 무엇인지, 크기가 모바일에 맞는지 본다.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function parseGlb(file) {
  const buf = readFileSync(file);
  if (buf.toString("ascii", 0, 4) !== "glTF") throw new Error("GLB가 아닙니다");
  const length = buf.readUInt32LE(8);
  let off = 12;
  let json = null;
  let binLength = 0;
  while (off < length) {
    const size = buf.readUInt32LE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    if (type === "JSON") json = JSON.parse(buf.toString("utf8", off + 8, off + 8 + size));
    if (type.startsWith("BIN")) binLength = size;
    off += 8 + size;
  }
  return { json, binLength, size: buf.length };
}

const COMPONENT_COUNT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function summarize(file) {
  const { json: g, binLength, size } = parseGlb(file);
  const nodes = g.nodes ?? [];
  const accessors = g.accessors ?? [];

  // 삼각형 수 — 인덱스가 있으면 인덱스/3, 없으면 POSITION/3
  let triangles = 0;
  let skinnedMeshes = 0;
  const meshNames = [];
  for (const mesh of g.meshes ?? []) {
    meshNames.push(mesh.name ?? "(이름 없음)");
    for (const p of mesh.primitives ?? []) {
      const count = p.indices !== undefined ? accessors[p.indices].count : accessors[p.attributes.POSITION].count;
      triangles += Math.floor(count / 3);
    }
  }
  for (const n of nodes) if (n.skin !== undefined) skinnedMeshes++;

  const skins = (g.skins ?? []).map((s) => ({
    joints: s.joints.length,
    names: s.joints.map((j) => nodes[j].name ?? `#${j}`),
  }));

  const animations = (g.animations ?? []).map((a) => {
    let duration = 0;
    for (const s of a.samplers ?? []) duration = Math.max(duration, accessors[s.input].max?.[0] ?? 0);
    return { name: a.name ?? "(이름 없음)", channels: a.channels.length, duration: Number(duration.toFixed(2)) };
  });

  const images = (g.images ?? []).map((im) => {
    const bv = im.bufferView !== undefined ? g.bufferViews[im.bufferView] : null;
    return { mime: im.mimeType ?? "(외부 파일)", bytes: bv ? bv.byteLength : 0, uri: im.uri ? "외부 URI" : "내장" };
  });

  const materials = (g.materials ?? []).map((m) => ({
    name: m.name ?? "(이름 없음)",
    color: m.pbrMetallicRoughness?.baseColorFactor?.map((v) => Number(v.toFixed(2))) ?? null,
    texture: m.pbrMetallicRoughness?.baseColorTexture !== undefined,
    metallic: m.pbrMetallicRoughness?.metallicFactor,
    roughness: m.pbrMetallicRoughness?.roughnessFactor,
  }));

  // 버텍스 컬러 사용 여부
  let vertexColors = false;
  for (const mesh of g.meshes ?? []) for (const p of mesh.primitives ?? []) if (p.attributes.COLOR_0 !== undefined) vertexColors = true;

  return {
    file,
    size,
    binLength,
    generator: g.asset?.generator ?? "?",
    extensionsUsed: g.extensionsUsed ?? [],
    extensionsRequired: g.extensionsRequired ?? [],
    nodes: nodes.length,
    meshes: meshNames,
    triangles,
    skinnedMeshes,
    skins,
    animations,
    images,
    materials,
    vertexColors,
  };
}

const args = process.argv.slice(2);
const targets = args.flatMap((a) => (statSync(a).isDirectory() ? readdirSync(a).filter((f) => f.endsWith(".glb")).map((f) => join(a, f)) : [a]));
if (targets.length === 0) {
  console.error("사용법: node scripts/inspect-glb.mjs <파일.glb | 폴더> …");
  process.exit(1);
}

for (const file of targets) {
  try {
    const s = summarize(file);
    console.log(`\n══ ${file}  (${(s.size / 1024).toFixed(0)} KB · 생성 ${s.generator})`);
    console.log(`  삼각형 ${s.triangles.toLocaleString()} · 노드 ${s.nodes} · 메쉬 ${s.meshes.length}개 (${s.meshes.slice(0, 6).join(", ")}${s.meshes.length > 6 ? " …" : ""}) · 스키닝된 노드 ${s.skinnedMeshes}`);
    console.log(`  확장 사용: ${s.extensionsUsed.join(", ") || "없음"} · 필수: ${s.extensionsRequired.join(", ") || "없음"}`);
    console.log(`  재질 ${s.materials.length}개: ${s.materials.slice(0, 8).map((m) => `${m.name}${m.texture ? "(텍스처)" : ""}`).join(", ")}${s.materials.length > 8 ? " …" : ""} · 버텍스컬러 ${s.vertexColors ? "예" : "아니오"}`);
    console.log(`  이미지 ${s.images.length}개: ${s.images.map((i) => `${i.mime} ${(i.bytes / 1024).toFixed(0)}KB ${i.uri}`).join(" · ") || "없음"}`);
    for (const sk of s.skins) console.log(`  뼈대(스킨) ${sk.joints}개: ${sk.names.join(", ")}`);
    console.log(`  클립 ${s.animations.length}개: ${s.animations.map((a) => `${a.name}(${a.duration}s)`).join(", ") || "없음"}`);
  } catch (e) {
    console.log(`\n══ ${file}\n  검사 실패: ${e.message}`);
  }
}
