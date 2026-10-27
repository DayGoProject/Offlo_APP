/**
 * M9 검증 — 신고 · 차단 · 이용 규칙의 순수 값 (Node · 에이전트 자동 실행용)
 *
 *   node scripts/verify-M9-moderation-logic.mjs
 *
 * 확인 항목
 *   1. 신고 사유가 **웹 서버의 `REPORT_REASONS`와 같은 값 · 같은 순서**다 (웹 레포가 있으면 소스를 읽어 대조 — 어긋나면 서버가 400을 낸다)
 *   2. 사유마다 한국어 라벨 · 힌트가 있다 · 값이 겹치지 않는다
 *   3. 이용 규칙 동의 — 없음 · 깨진 값 · 옛 버전 · 현재 버전 · 사용자별 키
 *   4. 규칙 · 안내 문구가 비어 있지 않다 · 이름이 들어간다
 */
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) {
      const base = join(SRC, specifier.slice(2));
      const file = [".ts", ".tsx", "/index.ts"].map((ext) => base + ext).find(existsSync);
      if (file) return next(pathToFileURL(file).href, context);
    }
    return next(specifier, context);
  },
});

const M = await import(pathToFileURL(join(SRC, "logic", "moderation.ts")).href);

const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};

/* ── 1. 서버와 같은 사유 ─────────────────────────────────────── */
const WEB_ROOT = process.env.OFFLO_WEB_ROOT ?? resolve(ROOT, "..", "Offlo");
const serverFile = join(WEB_ROOT, "web", "src", "lib", "moderation.ts");
const appValues = M.REPORT_REASONS.map((r) => r.value);
if (existsSync(serverFile)) {
  const text = readFileSync(serverFile, "utf8");
  const m = /export const REPORT_REASONS = \[([^\]]*)\] as const/.exec(text);
  const serverValues = m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : [];
  check(serverValues.length > 0 && JSON.stringify(serverValues) === JSON.stringify(appValues), "신고 사유가 웹 서버의 REPORT_REASONS와 같은 값 · 같은 순서다", `앱 ${appValues.join(",")} / 서버 ${serverValues.join(",")}`);
  const t = /export const TARGET_TYPES = \[([^\]]*)\] as const/.exec(text);
  check(t && [...t[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]).join() === "post,comment", "신고 대상 종류가 서버와 같다 (post · comment)");
} else {
  console.log("  · 웹 레포가 없어 서버 사유 대조는 건너뜀");
}

/* ── 2. 라벨 ─────────────────────────────────────────────────── */
check(M.REPORT_REASONS.length === 5 && new Set(appValues).size === 5, "사유 5개 · 값이 겹치지 않는다");
check(M.REPORT_REASONS.every((r) => /[가-힣]/.test(r.label) && /[가-힣]/.test(r.hint)), "사유마다 한국어 라벨 · 힌트가 있다");
check(appValues.at(-1) === "other", "맨 아래 사유는 \"기타\"다");

/* ── 3. 규칙 동의 ────────────────────────────────────────────── */
check(M.RULES_VERSION >= 1 && Number.isInteger(M.RULES_VERSION), "규칙 버전은 1 이상의 정수");
check(!M.rulesAccepted(null) && !M.rulesAccepted(undefined) && !M.rulesAccepted("") && !M.rulesAccepted("abc") && !M.rulesAccepted("0") && !M.rulesAccepted("-1") && !M.rulesAccepted("1.5"), "동의 — 저장된 값이 없거나 깨졌으면 동의하지 않은 것");
check(M.rulesAccepted(String(M.RULES_VERSION)) && M.rulesAccepted(String(M.RULES_VERSION + 3)), "동의 — 현재(또는 더 새) 버전이면 동의한 것");
check(!M.rulesAccepted(String(M.RULES_VERSION - 1)), "동의 — 규칙을 올리면(옛 버전만 저장됨) 다시 동의받는다");
check(M.rulesKey("u1") === "offlo_community_rules:u1" && M.rulesKey("u1") !== M.rulesKey("u2"), "저장 키는 사용자별이다 (같은 기기에서 계정이 바뀌어도 섞이지 않는다)");

/* ── 4. 문구 ─────────────────────────────────────────────────── */
check(M.COMMUNITY_RULES.length >= 4 && M.COMMUNITY_RULES.every((r) => r.title.length > 0 && r.body.length > 0), "이용 규칙 항목 4개 이상 · 제목과 설명이 있다");
check(M.RULES_ENFORCEMENT.length >= 3 && M.RULES_ENFORCEMENT.some((x) => x.includes("3명")) && M.RULES_ENFORCEMENT.some((x) => x.includes("차단")), "처리 방식 안내 — 신고 · 3명 숨김 · 차단이 들어 있다 (서버 동작과 같다)");
check(M.noticeBlocked("지우").includes("지우님") && M.blockConfirmText("지우").includes("지우님") && M.blockConfirmText("지우").includes("차단한 사용자"), "차단 안내에 이름이 들어가고 해제 위치(설정 → 차단한 사용자)를 알려 준다");
check(M.NOTICE_REPORTED.includes("신고했어요") && M.NOTICE_REPORTED_COMMENT.includes("댓글") && M.BLOCKED_EMPTY.length > 0, "신고 완료 · 빈 차단 목록 문구");

if (failures.length) {
  console.error(`\n실패 ${failures.length}건: ${failures.join(" · ")}`);
  process.exit(1);
}
console.log("\nM9 신고 · 차단 로직 검증을 통과했습니다.");
