const fs = require("fs");
const file = process.argv[2];
const b = fs.readFileSync(file);
const jl = b.readUInt32LE(12);
const j = JSON.parse(b.slice(20, 20 + jl).toString());
const binStart = 20 + jl + 8;
const bin = b.slice(binStart);
const acc = (i) => {
  const a = j.accessors[i];
  const bv = j.bufferViews[a.bufferView];
  const off = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const n = a.count;
  const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const stride = bv.byteStride || comps * (a.componentType === 5126 ? 4 : a.componentType === 5123 ? 2 : 4);
  const out = [];
  for (let k = 0; k < n; k++) {
    const row = [];
    for (let c = 0; c < comps; c++) {
      const p = off + k * stride + c * (a.componentType === 5126 ? 4 : a.componentType === 5123 ? 2 : 4);
      row.push(a.componentType === 5126 ? bin.readFloatLE(p) : a.componentType === 5123 ? bin.readUInt16LE(p) : bin.readUInt32LE(p));
    }
    out.push(comps === 1 ? row[0] : row);
  }
  return out;
};
j.meshes.forEach((m, mi) => {
  m.primitives.forEach((p) => {
    if (p.attributes.NORMAL === undefined || p.indices === undefined) return;
    const pos = acc(p.attributes.POSITION);
    const nor = acc(p.attributes.NORMAL);
    const idx = acc(p.indices);
    let agree = 0, dis = 0;
    for (let t = 0; t < idx.length; t += 3) {
      const [a, bb, c] = [pos[idx[t]], pos[idx[t + 1]], pos[idx[t + 2]]];
      const e1 = [bb[0] - a[0], bb[1] - a[1], bb[2] - a[2]];
      const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const n0 = nor[idx[t]];
      const d = fn[0] * n0[0] + fn[1] * n0[1] + fn[2] * n0[2];
      if (d > 0) agree++; else dis++;
    }
    console.log(`mesh ${mi} ${m.name ?? ""} tris=${idx.length / 3} winding-agrees-with-normals=${agree} disagrees=${dis}`);
  });
});
