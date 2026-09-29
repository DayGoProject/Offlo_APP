/**
 * M5 검증 — AI 분석 · 이미지 압축 · 코치 채팅 계산 로직 (Node · 에이전트 자동 실행용)
 *
 *   node scripts/verify-M5-logic.mjs
 *
 * src/logic/*.ts 는 순수 파일이라 Node(타입 제거 실행)로 바로 돌린다. analysis.ts는 공유 코드
 * `@/shared/kst`를 런타임에 import하므로 `@/` 경로를 src/로 푸는 해석 훅을 단다.
 *
 * 분석 탭의 "오늘 · 이번 주"는 기기 시간대가 아니라 **KST**다 (서버 일간 1회 제한과 같은 경계).
 * 그래서 **시간대 3개(Asia/Seoul · UTC · America/Los_Angeles)에서 다시 실행해 답이 같아야** 통과다.
 *
 * 확인 항목
 *   1. 오늘 판단 — KST 자정 경계 · 오전 9시 전 기록 · 주간 기록은 제외
 *   2. 이번 주 7칸 — 월요일 시작 · 요일 자리에 채움(웹 순서 채움 버그 수정) · 오늘/미래
 *   3. 주간 요약 — 오래된 → 최신 · 날짜 라벨 · 이번 주 주간 분석 여부
 *   4. 점수 라벨 · 채팅 컨텍스트 · 문자열 목록 정리
 *   5. 이미지 — 장변 1600 축소 · 품질 단계(웹 루프와 같음) · base64 정리
 *   6. 채팅 — 이미지는 마지막 메시지에만 · 50개 상한 자르기 · 긴 답변 2,000자 자르기 · 첫 말풍선
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ZONES = ["Asia/Seoul", "UTC", "America/Los_Angeles"];

if (!process.env.OFFLO_TZ_CHILD) {
  let failed = 0;
  for (const tz of ZONES) {
    console.log(`\n── TZ=${tz} ──`);
    const run = spawnSync(process.execPath, process.execArgv.concat(process.argv.slice(1)), {
      stdio: "inherit",
      env: { ...process.env, TZ: tz, OFFLO_TZ_CHILD: "1" },
    });
    if (run.status !== 0) failed++;
  }
  if (failed) {
    console.error(`\nM5 로직 검증 실패 — ${failed}개 시간대`);
    process.exit(1);
  }
  console.log(`\nM5 로직 검증을 통과했습니다 (${ZONES.join(" · ")}).`);
  process.exit(0);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");

// `@/foo/bar` → src/foo/bar.ts (Metro · tsconfig paths와 같은 규칙)
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

const load = (file) => import(pathToFileURL(join(SRC, "logic", file)).href);
const kst = await import(pathToFileURL(join(SRC, "shared", "kst.ts")).href);
const a = await load("analysis.ts");
const img = await load("image.ts");
const chat = await load("chat.ts");

const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);

/** KST 벽시계 시각 → 절대 시각(ms). 실행 시간대와 무관하다 */
const at = (y, mo, d, h = 0, mi = 0) => Date.UTC(y, mo - 1, d, h - 9, mi);
const iso = (ms) => new Date(ms).toISOString();
const row = (id, ms, totalMinutes = 300, detoxScore = 60, periodType = "daily", apps) => ({
  id,
  periodType,
  totalMinutes,
  detoxScore,
  isPremium: false,
  createdAt: iso(ms),
  ...(apps && { apps }),
});

/** 2026-09-17 목요일 오전 10시 (KST) */
const NOW = at(2026, 9, 17, 10);

/* ── 1. 오늘 판단 ──────────────────────────────────────────── */
{
  const early = row("early", at(2026, 9, 17, 0, 30)); // UTC로는 9/16 15:30 — 기기가 UTC면 "어제"로 보인다
  const lastNight = row("last-night", at(2026, 9, 16, 23, 59));
  const weekly = row("weekly", at(2026, 9, 17, 9), 2100, 60, "weekly");
  check(a.todayDaily([early, lastNight], NOW)?.id === "early", "오늘: KST 00:30 기록은 오늘 (서버와 같은 경계)");
  check(a.todayDaily([lastNight], NOW) === null, "오늘: KST 전날 23:59 기록은 오늘이 아니다");
  check(a.todayDaily([weekly], NOW) === null, "오늘: 주간 분석은 일간 1회에 세지 않는다");
  check(a.todayDaily([early], at(2026, 9, 18, 0, 0)) === null, "오늘: KST 자정이 지나면 다시 올릴 수 있다");
  check(a.todayDaily([], NOW) === null, "오늘: 기록 없음");
}

/* ── 2. 이번 주 7칸 ────────────────────────────────────────── */
{
  // 월요일(9/14)을 건너뛰고 화·수·목 — 웹은 화요일 기록을 "월" 칸에 넣는다
  const list = [
    row("thu", at(2026, 9, 17, 8), 252, 72),
    row("wed", at(2026, 9, 16, 21), 290, 66),
    row("tue", at(2026, 9, 15, 21), 318, 61),
    row("last-sun", at(2026, 9, 13, 21), 340, 58), // 지난주 — 빠져야 한다
  ];
  const slots = a.weekSlots(list, NOW);
  check(same(slots.map((s) => s.day), ["월", "화", "수", "목", "금", "토", "일"]), "7칸: 월요일 시작");
  check(slots[0].record === null && slots[1].record?.id === "tue", "7칸: 화요일 기록은 화요일 칸 (웹 순서 채움 버그 수정)");
  check(slots[3].record?.id === "thu" && slots[3].isToday, "7칸: 오늘(목) 칸 · 오전 8시 기록");
  check(slots.slice(4).every((s) => s.isFuture && !s.record) && !slots[2].isFuture, "7칸: 금~일은 미래");
  check(same(a.thisWeekDaily(list, NOW).map((r) => r.id), ["tue", "wed", "thu"]), "이번 주 일간: 오래된 → 최신 · 지난주 제외");

  // 일요일 밤 — 이번 주가 끝나는 날. 다음 날 월요일 0시(KST)에 새 주
  const sunday = at(2026, 9, 20, 23, 50);
  check(a.weekSlots(list, sunday)[6].isToday, "7칸: 일요일은 마지막 칸");
  check(a.thisWeekDaily(list, at(2026, 9, 21, 0, 5)).length === 0, "7칸: 월요일 0시(KST)에 초기화");

  const dup = [row("new", at(2026, 9, 16, 22)), row("old", at(2026, 9, 16, 9))];
  check(a.thisWeekDaily(dup, NOW).map((r) => r.id).join() === "new", "같은 날 두 건이면 최신만");
}

/* ── 2-1. 주 경계 — 서버의 주간 1회 제한이 쓰는 값 (웹 lib/kst.ts = 공유 코드) ── */
{
  const iso = (ms) => new Date(ms).toISOString();
  const monday = iso(at(2026, 9, 14, 0, 0)); // 2026-09-14(월) 0시 KST
  check(kst.kstWeekStart(NOW).toISOString() === monday, "주 경계: 목요일 → 그 주 월요일 0시(KST)", kst.kstWeekStart(NOW).toISOString());
  check(kst.kstWeekStart(at(2026, 9, 14, 0, 0)).toISOString() === monday, "주 경계: 월요일 0시 정각은 그 주에 든다");
  check(kst.kstWeekStart(at(2026, 9, 20, 23, 59)).toISOString() === monday, "주 경계: 일요일 23:59까지 같은 주");
  check(kst.kstWeekStart(at(2026, 9, 21, 0, 1)).toISOString() === iso(at(2026, 9, 21, 0, 0)), "주 경계: 월요일 0시에 새 주");
  check(kst.kstWeekStart(at(2026, 9, 13, 23, 59)).toISOString() === iso(at(2026, 9, 7, 0, 0)), "주 경계: 지난주 일요일은 지난주 월요일");
  check(kst.kstDayStart(at(2026, 9, 17, 0, 30)).toISOString() === iso(at(2026, 9, 17, 0, 0)), "하루 경계: KST 0시");
}

/* ── 3. 주간 요약 · 이번 주 주간 분석 ──────────────────────── */
{
  const apps = [{ appName: "앱A", minutes: 90, category: "SNS" }];
  const week = [row("mon", at(2026, 9, 14, 7), 300, 55, "daily", apps), row("tue", at(2026, 9, 15, 21), 280, 60)];
  const summaries = a.weeklySummaries(week);
  check(summaries[0].date === "9월 14일 (월)", "요약: 날짜 라벨은 KST (월요일 오전 7시 = 9/14)", summaries[0].date);
  check(summaries[1].date === "9월 15일 (화)", "요약: 순서 유지", summaries[1].date);
  check(same(summaries[0].apps, apps) && same(summaries[1].apps, []), "요약: 앱별 시간 · 없으면 빈 배열");
  check(summaries[0].totalMinutes === 300 && summaries[0].detoxScore === 55, "요약: 시간 · 점수");

  const thisWeek = row("w-now", at(2026, 9, 14, 0, 10), 2000, 60, "weekly");
  const lastWeek = row("w-last", at(2026, 9, 13, 23, 50), 2000, 60, "weekly");
  check(a.thisWeekWeekly([thisWeek], NOW)?.id === "w-now", "주간: 이번 주 월요일 0:10(KST) 생성분 = 이번 주");
  check(a.thisWeekWeekly([lastWeek], NOW) === null, "주간: 지난주 일요일 23:50 생성분은 지난주");
  check(a.thisWeekWeekly([row("d", NOW)], NOW) === null, "주간: 일간 기록은 세지 않는다");
  check(a.WEEKLY_THRESHOLD === 7, "주간: 7개 필요 (서버와 같다)");
}

/* ── 4. 점수 라벨 · 채팅 컨텍스트 · 목록 정리 ─────────────── */
{
  check(
    [100, 70, 69, 40, 39, 0].map(a.scoreLabel).join("|") === "건강한 사용|건강한 사용|주의 필요|주의 필요|디톡스 필요|디톡스 필요",
    "점수 라벨: 70 · 40 경계 (웹과 같다)",
  );
  const ctx = a.analysisContext({ periodType: "weekly", totalMinutes: 100, detoxScore: 50, apps: null, coreProblems: undefined });
  check(same(ctx, { periodType: "weekly", totalMinutes: 100, apps: [], detoxScore: 50, coreProblems: [] }), "컨텍스트: 빠진 배열은 빈 배열");
  check(same(a.textList(["a", "", "  ", 3, null, "b"]), ["a", "b"]), "목록 정리: 문자열만");
  check(same(a.textList("문자열"), []) && same(a.textList(undefined), []), "목록 정리: 배열이 아니면 빈 목록");
}

/* ── 5. 이미지 ─────────────────────────────────────────────── */
{
  check(same(img.fitWithin(1080, 2400), { width: 720, height: 1600 }), "축소: 1080×2400 → 720×1600");
  check(same(img.fitWithin(3000, 2000), { width: 1600, height: 1067 }), "축소: 가로가 길면 가로 기준");
  check(img.fitWithin(1600, 900) === null && img.fitWithin(800, 1200) === null, "축소: 1600 이하는 그대로");
  check(img.fitWithin(0, 0) === null, "축소: 크기를 모르면 그대로");
  check(same(img.qualitySteps(), [0.85, 0.7, 0.55, 0.4]), "품질 단계: 0.85 → 0.7 → 0.55 → 0.4 (웹 루프와 같다)", JSON.stringify(img.qualitySteps()));
  check(img.cleanBase64("data:image/jpeg;base64,QUJD\nREVG\r\n") === "QUJDREVG", "base64: data 머리 · 줄바꿈 제거");
  check(/^[A-Za-z0-9+/]+={0,2}$/.test(img.cleanBase64("QUJD\nRA==")), "base64: 서버 정규식 통과");
  check(img.MAX_BASE64_LENGTH === 3 * 1024 * 1024, "상한: base64 3MB (서버 4MB보다 낮게)");
}

/* ── 6. 채팅 ──────────────────────────────────────────────── */
{
  const history = [
    { role: "model", text: "첫 질문" },
    { role: "user", text: "사진 보냄", imageUri: "file:///a.jpg" },
    { role: "model", text: "답" },
  ];
  const image = { imageBase64: "QUJD", mimeType: "image/jpeg" };
  const payload = chat.buildChatPayload(history, { text: "  새 질문  ", image });
  check(payload.length === 4 && payload[3].text === "새 질문" && payload[3].imageBase64 === "QUJD", "보내기: 마지막 메시지에 이미지");
  check(payload.slice(0, 3).every((m) => !("imageBase64" in m) && !("imageUri" in m)), "보내기: 지난 메시지엔 이미지 · 기기 주소 없음");
  check(chat.buildChatPayload([], { text: "   ", image }).at(-1).text === "(이미지 첨부)", "보내기: 이미지만 보내면 '(이미지 첨부)'");

  const long = Array.from({ length: 80 }, (_, i) => ({ role: i % 2 ? "user" : "model", text: `m${i}` }));
  const trimmed = chat.buildChatPayload(long, { text: "마지막" });
  check(trimmed.length === 50 && trimmed[0].text === "m31" && trimmed[49].text === "마지막", "보내기: 50개 상한 — 오래된 대화를 자른다", `${trimmed.length}개`);

  const essay = chat.buildChatPayload([{ role: "model", text: "가".repeat(3500) }], { text: "q" });
  check(essay[0].text.length === 2000, "보내기: 2,000자 넘는 답변은 히스토리에서 자른다 (서버 400 방지)");
  check(chat.buildChatPayload([], { text: "가".repeat(2500) })[0].text.length === 2000, "보내기: 내 메시지도 2,000자 상한");

  check(chat.openingMessage([{ timeSlot: "22-24", apps: [], question: "밤에 왜 켰나요?" }]) === "밤에 왜 켰나요?", "첫 말풍선: 첫 시간대 질문");
  check(chat.openingMessage([]) === chat.DEFAULT_OPENING && chat.openingMessage(null) === chat.DEFAULT_OPENING, "첫 말풍선: 없으면 기본 인사");
  check(chat.visibleText({ role: "user", text: "(이미지 첨부)" }) === null && chat.visibleText({ role: "user", text: "hi" }) === "hi", "말풍선: 이미지만 보낸 글은 숨김");
}

if (failures.length) {
  console.error(`\n[${process.env.TZ}] 실패 ${failures.length}건: ${failures.join(", ")}`);
  process.exit(1);
}
