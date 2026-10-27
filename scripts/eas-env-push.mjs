/**
 * `.env.local`의 `EXPO_PUBLIC_*` 값을 EAS 환경변수(production · preview)로 올린다 — EAS 빌드 서버에는 gitignore된 `.env.local`이 올라가지 않아서 필요하다.
 *
 *   node scripts/eas-env-push.mjs            # 드라이런 — 올릴 이름만 출력한다 (값은 출력하지 않는다)
 *   node scripts/eas-env-push.mjs --apply    # 실제로 올린다 (먼저 `npx eas-cli login` · `eas init`으로 프로젝트가 연결돼 있어야 한다)
 *
 * 규칙 (security.md)
 *  · **`EXPO_PUBLIC_` 로 시작하는 키만** 올린다 — 같은 파일에 서버 키가 섞여 있어도 건드리지 않는다. 다른 키를 만나면 이름만 알리고 건너뛴다.
 *  · `EXPO_PUBLIC_*` 값은 어차피 앱 번들에 평문으로 박히는 공개 값이다 (Firebase 클라이언트 config · API 주소 · Google 웹 클라이언트 ID). 그래서 가시성은 plaintext다.
 *  · 값은 화면 · 로그에 출력하지 않는다.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, ".env.local");
const APPLY = process.argv.includes("--apply");
const ENVIRONMENTS = ["production", "preview"];
const REQUIRED = [
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "EXPO_PUBLIC_FIREBASE_APP_ID",
  "EXPO_PUBLIC_API_BASE_URL",
  "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
];

if (!existsSync(FILE)) {
  console.error("✗ .env.local이 없습니다 (.env.example을 복사해 값을 채우세요).");
  process.exit(1);
}

const vars = new Map();
const skipped = [];
for (const line of readFileSync(FILE, "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (!m || line.trim().startsWith("#")) continue;
  const [, key, raw] = m;
  const value = raw.replace(/^(['"])(.*)\1$/, "$2");
  if (!key.startsWith("EXPO_PUBLIC_")) {
    skipped.push(key);
    continue;
  }
  if (value) vars.set(key, value);
}

const missing = REQUIRED.filter((k) => !vars.has(k));
console.log(`올릴 변수 ${vars.size}개 → EAS 환경 ${ENVIRONMENTS.join(" · ")}`);
for (const key of vars.keys()) console.log(`  · ${key}`);
if (skipped.length) console.log(`건너뜀(EXPO_PUBLIC_ 아님 — 서버 키일 수 있어 올리지 않는다): ${skipped.join(", ")}`);
if (missing.length) {
  console.error(`\n✗ 앱이 쓰는 값이 비어 있습니다: ${missing.join(", ")}`);
  process.exit(1);
}
if (!APPLY) {
  console.log("\n드라이런입니다 — 실제로 올리려면 --apply 를 붙이세요 (먼저 `npx eas-cli login` · `npx eas-cli init`).");
  process.exit(0);
}

let failed = 0;
for (const [name, value] of vars) {
  const args = ["--yes", "eas-cli@latest", "env:set", "--name", name, "--value", value, "--visibility", "plaintext", "--non-interactive"];
  for (const env of ENVIRONMENTS) args.push("--environment", env);
  const run = spawnSync("npx", args, { cwd: ROOT, encoding: "utf8", shell: true });
  const ok = run.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` — ${String(run.stderr || run.stdout).split("\n").find((l) => l.trim()) ?? "실패"}`}`);
}
if (failed) {
  console.error(`\n${failed}개 실패 — 로그인 · 프로젝트 연결(eas init)을 확인하세요.`);
  process.exit(1);
}
console.log("\n모두 올렸습니다.");
