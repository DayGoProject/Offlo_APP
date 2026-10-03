/**
 * 친밀도(쓰다듬기) 규칙 모의실험 — 하루 상한 · 레벨 임계값을 사용자 유형별로 돌려 "며칠째에 어느 레벨이 되는가"를 본다. 게임 설계 도구이고 검증 스크립트가 아니다.
 *
 *   node scripts/sim-affection.mjs
 *
 * 규칙(제안): 하루(KST) 쓰다듬기는 `CAP`번까지 인정(+1씩), 넘은 탭은 화면 효과만. 친밀도 = 누적 인정 횟수. 레벨은 임계값을 넘을 때 오른다. 동물을 바꾸면 0부터.
 * 이 앱은 "화면을 덜 보게 하는" 앱이다 — 쓰다듬기가 새 중독 고리가 되지 않게 상한은 작아야 하고, 그래도 매일 잠깐 들를 이유(미션 · 성장)는 되어야 한다.
 */
const rand = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** 사용자 유형 — pOpen: 그날 앱을 여는 확률 · taps: 연 날 누르는 횟수의 범위 */
const ARCHETYPES = [
  { name: "열성 (매일 · 상한까지)", pOpen: 1.0, taps: [99, 99] },
  { name: "꾸준 (90%의 날 · 평균 3번)", pOpen: 0.9, taps: [1, 5] },
  { name: "가끔 (50%의 날 · 평균 3번)", pOpen: 0.5, taps: [1, 5] },
  { name: "주말형 (주 2일 · 상한까지)", pOpen: 2 / 7, taps: [99, 99] },
];

function daysToLevels(cap, thresholds, arche, seed) {
  const r = rand(seed);
  let total = 0;
  const reached = thresholds.map(() => null);
  for (let day = 1; day <= 400 && reached.some((x) => x === null); day++) {
    if (r() < arche.pOpen) {
      const want = arche.taps[0] + Math.floor(r() * (arche.taps[1] - arche.taps[0] + 1));
      total += Math.min(want, cap);
    }
    thresholds.forEach((th, i) => {
      if (reached[i] === null && total >= th) reached[i] = day;
    });
  }
  return reached;
}

function run(cap, thresholds, label) {
  console.log(`\n■ ${label} — 하루 상한 ${cap} · 임계값 ${thresholds.join(" / ")}`);
  for (const a of ARCHETYPES) {
    const N = 1000;
    const sums = thresholds.map(() => []);
    for (let s = 0; s < N; s++) daysToLevels(cap, thresholds, a, s + 1).forEach((d, i) => sums[i].push(d ?? 400));
    const med = sums.map((arr) => arr.sort((x, y) => x - y)[Math.floor(N / 2)]);
    console.log(`  ${a.name.padEnd(26)} → ` + thresholds.map((th, i) => `Lv${i + 2}(${th}) ${String(med[i]).padStart(3)}일`).join("  "));
  }
}

const TH = [10, 30, 70, 130]; // Lv2 · Lv3 · Lv4 · Lv5 (Lv1은 0)
run(5, TH, "제안");
run(3, TH, "상한을 3으로 낮추면");
run(10, TH, "상한을 10으로 올리면");
run(5, [8, 20, 45, 90], "임계값을 낮게 잡으면");
run(5, [15, 50, 120, 250], "임계값을 높게 잡으면");
console.log("\n참고 — 성장 단계(연속 기록): 아기 1일 · 성장 중 7일 · 성체 21일 · 강화 성체 60일 · 전설 120일");
