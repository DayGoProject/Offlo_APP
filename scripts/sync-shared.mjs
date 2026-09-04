/**
 * 웹 레포(Offlo)와 공유하는 코드의 드리프트를 감지·갱신한다.
 *
 *   node scripts/sync-shared.mjs          비교만 (다르면 exit 1)
 *   node scripts/sync-shared.mjs --pull   웹 원본으로 덮어쓰기
 *
 * 원본은 언제나 웹 레포 쪽이다. 정원 레벨 임계값·배지 목록을 바꾸려면
 * Offlo/web/src/lib 에서 바꾸고 여기서 --pull 한다.
 * 웹 경로가 다르면 OFFLO_WEB_ROOT 환경변수로 지정한다.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WEB_ROOT = process.env.OFFLO_WEB_ROOT ?? resolve(ROOT, "..", "Offlo");

/** 웹 원본 → 앱 복사본 */
const FILES = [
  ["web/src/lib/format.ts", "src/shared/format.ts"],
  ["web/src/lib/garden-utils.ts", "src/shared/garden-utils.ts"],
  ["web/src/lib/badge-utils.ts", "src/shared/badge-utils.ts"],
];

const MARK = "@offlo-shared";

const banner = (from) =>
  `/**\n` +
  ` * ${MARK} — 자동 생성 파일. 직접 수정하지 마세요.\n` +
  ` * 원본: Offlo/${from}\n` +
  ` * 갱신: node scripts/sync-shared.mjs --pull\n` +
  ` */\n`;

/** 배너를 걷어내고 본문만 남긴다 (배너 문구 변경이 diff로 잡히지 않게) */
function body(text) {
  if (!text.startsWith("/**") || !text.includes(MARK)) return text;
  return text.slice(text.indexOf("*/") + 2).replace(/^\r?\n/, "");
}

const pull = process.argv.includes("--pull");

if (!existsSync(WEB_ROOT)) {
  console.error(`✗ 웹 레포를 찾을 수 없습니다: ${WEB_ROOT}`);
  console.error(`  OFFLO_WEB_ROOT 환경변수로 경로를 지정하세요.`);
  process.exit(2);
}

let drift = 0;

for (const [from, to] of FILES) {
  const srcPath = resolve(WEB_ROOT, from);
  const dstPath = resolve(ROOT, to);

  if (!existsSync(srcPath)) {
    console.error(`✗ 원본 없음: ${from}`);
    drift++;
    continue;
  }

  const src = readFileSync(srcPath, "utf8");
  const dst = existsSync(dstPath) ? readFileSync(dstPath, "utf8") : null;

  if (dst !== null && body(dst) === src) {
    console.log(`✓ ${to}`);
    continue;
  }

  drift++;
  if (pull) {
    writeFileSync(dstPath, banner(from) + src, "utf8");
    console.log(`↓ ${to}  ${dst === null ? "(신규 복사)" : "(웹 원본으로 갱신)"}`);
  } else {
    const srcLines = src.split("\n").length;
    const dstLines = dst === null ? 0 : body(dst).split("\n").length;
    console.error(
      dst === null
        ? `✗ ${to} — 복사본 없음 (원본 ${srcLines}줄)`
        : `✗ ${to} — 웹과 다름 (웹 ${srcLines}줄 / 앱 ${dstLines}줄)`
    );
  }
}

if (drift === 0) {
  console.log("\n공유 코드가 웹과 동일합니다.");
  process.exit(0);
}
if (pull) {
  console.log(`\n${drift}개 파일을 웹 원본으로 맞췄습니다.`);
  process.exit(0);
}
console.error(`\n${drift}개 파일이 웹과 갈라져 있습니다. 'node scripts/sync-shared.mjs --pull' 로 맞추세요.`);
process.exit(1);
