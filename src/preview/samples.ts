/**
 * 미리보기 화면용 샘플 값 — 로그인 가드 밖에서 컴포넌트를 그릴 때만 쓴다 (mobile.md · security.md).
 *
 * - **실제 사용자 데이터를 복사해 넣지 않는다** — 이름 · 이메일 · 앱 목록 전부 지어낸 값이다 (Public 레포)
 * - 타입은 api-types 그대로 — 서버 응답 모양과 어긋나면 컴파일에서 걸린다
 * - 기준 시각을 고정해 스크린샷이 날마다 달라지지 않게 한다 (2026-09-17 목요일 오전 10시, 기기 시간대)
 */
import type { DashboardData } from "@/components/dashboard/DashboardView";
import type { AnalysisRecords } from "@/logic/analysis";
import type { ChatItem } from "@/logic/chat";
import type { BadgeStats } from "@/logic/badges";
import type { Analysis, AnalysisSummary, ApiUser, Badge, FeedComment, FeedPost, GardenSnapshot, Goal, RankingEntry } from "@/services/api-types";

export const SAMPLE_NOW = new Date(2026, 8, 17, 10, 0, 0);
export const SAMPLE_NAME = "지우";

/** 기준 시각에서 며칠 전 · 몇 시의 ISO 문자열 */
function daysAgo(days: number, hour = 21): string {
  return new Date(2026, 8, 17 - days, hour, 12, 0).toISOString();
}

function analysis(
  id: string,
  days: number,
  totalMinutes: number,
  detoxScore: number,
  periodType: AnalysisSummary["periodType"] = "daily",
  apps: [string, number][] = [],
): AnalysisSummary {
  return {
    id,
    periodType,
    totalMinutes,
    detoxScore,
    isPremium: false,
    createdAt: daysAgo(days),
    apps: apps.map(([appName, minutes]) => ({ appName, minutes, category: "기타" })),
  };
}

const SAMPLE_ANALYSES: AnalysisSummary[] = [
  // 오늘 기록은 오전 8시 — 한국 시간 오전 9시 전이라 UTC로는 전날이다 (요일이 밀리지 않는지 보는 표본)
  { ...analysis("a-today", 0, 252, 72, "daily", [["인스타그램", 96], ["유튜브", 71], ["카카오톡", 40]]), createdAt: daysAgo(0, 8) },
  analysis("a-1", 1, 290, 66, "daily", [["유튜브", 120], ["인스타그램", 88]]),
  analysis("a-2", 2, 318, 61, "daily", [["틱톡", 131], ["인스타그램", 90]]),
  analysis("a-3", 3, 340, 58, "daily", [["유튜브", 150], ["넷플릭스", 60]]),
  analysis("w-1", 4, 2310, 60, "weekly"),
  analysis("a-5", 5, 365, 55, "daily", [["인스타그램", 140], ["유튜브", 80]]),
  analysis("a-6", 6, 402, 51, "daily", [["틱톡", 160], ["유튜브", 90]]),
  analysis("a-8", 8, 380, 49, "daily", [["유튜브", 170], ["카카오톡", 50]]),
  analysis("a-9", 9, 420, 46, "daily", [["인스타그램", 180], ["틱톡", 70]]),
  analysis("a-10", 10, 445, 44, "daily", [["유튜브", 200], ["인스타그램", 90]]),
];

const SAMPLE_GOALS: Goal[] = [
  {
    id: "g-1",
    userId: "sample",
    title: "하루 4시간 이하",
    targetMinutes: 240,
    startDate: daysAgo(7, 0),
    endDate: daysAgo(-7, 0),
    status: "active",
    createdAt: daysAgo(7),
  },
  {
    id: "g-2",
    userId: "sample",
    title: "잠들기 전 SNS 끊기",
    targetMinutes: 60,
    startDate: daysAgo(2, 0),
    endDate: daysAgo(-13, 0),
    status: "active",
    createdAt: daysAgo(2),
  },
];

export const DASHBOARD_READY: DashboardData = {
  analyses: SAMPLE_ANALYSES,
  goals: SAMPLE_GOALS,
  garden: { totalDetoxMinutes: 1450, animal: { type: "cat", streak: 12, lastAnalysisDate: "2026-09-17", pet: { date: "2026-09-17", today: 3, total: 41 } } },
  tip: "잠들기 1시간 전에는 휴대폰을 거실에 두고 들어가 보세요. 밤 시간 사용량이 가장 크게 줄어드는 습관이에요.",
};

/** 가입 직후 — 분석 · 목표 · 정원 모두 비어 있다 */
export const DASHBOARD_EMPTY: DashboardData = {
  analyses: [],
  goals: [],
  garden: { totalDetoxMinutes: 0, animal: null },
  tip: null,
};

export const HISTORY_READY: AnalysisSummary[] = SAMPLE_ANALYSES;

/* ── M5 · AI 분석 탭 ──────────────────────────────────────────── */

const DAILY = SAMPLE_ANALYSES.filter((a) => a.periodType === "daily");
const WEEKLY = SAMPLE_ANALYSES.filter((a) => a.periodType === "weekly");

/** 오늘 분석 전 — 이번 주 월 · 화 · 수 기록 3개 (지난주 주간 분석 1건) */
export const ANALYSIS_READY: AnalysisRecords = {
  daily: DAILY.filter((a) => a.id !== "a-today").slice(0, 7),
  weekly: WEEKLY,
};

/** 오늘 분석 완료 — 오늘(오전 8시) 포함 이번 주 4개 */
export const ANALYSIS_DONE: AnalysisRecords = { daily: DAILY.slice(0, 7), weekly: WEEKLY };

export const ANALYSIS_EMPTY: AnalysisRecords = { daily: [], weekly: [] };

/** 주간 분석이 열리는 날 — 2026-09-20 일요일 밤, 월~일 7개 모두 기록 */
export const WEEKLY_NOW = new Date(2026, 8, 20, 21, 0, 0);
export const ANALYSIS_WEEKLY: AnalysisRecords = {
  daily: [66, 70, 58, 72, 61, 64, 68].map((score, i) => ({
    ...analysis(`wk-${i}`, 0, 240 + i * 11, score, "daily", [["유튜브", 90], ["인스타그램", 60]]),
    createdAt: new Date(2026, 8, 20 - i, 20, 30, 0).toISOString(),
  })),
  weekly: WEEKLY,
};

/** 고른 사진 자리 — 지어낸 스크린타임 화면 그림 (실제 캡처가 아니다) */
const FAKE_SCREENSHOT_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='360' height='780' viewBox='0 0 360 780'>" +
  "<rect width='360' height='780' fill='#15171c'/>" +
  "<rect x='24' y='72' width='150' height='16' rx='4' fill='#4a4d55'/>" +
  "<rect x='24' y='104' width='220' height='40' rx='6' fill='#6a6d75'/>" +
  [60, 120, 90, 150, 70, 110, 40].map((h, i) => `<rect x='${32 + i * 44}' y='${330 - h}' width='26' height='${h}' rx='3' fill='#3f8fd9'/>`).join("") +
  [0, 1, 2, 3, 4].map((i) => `<rect x='24' y='${380 + i * 64}' width='36' height='36' rx='9' fill='#3a3d44'/><rect x='76' y='${388 + i * 64}' width='${170 - i * 24}' height='12' rx='3' fill='#5a5d65'/><rect x='76' y='${406 + i * 64}' width='${110 - i * 16}' height='6' rx='3' fill='#3f8fd9'/>`).join("") +
  "</svg>";
export const SAMPLE_SCREENSHOT = `data:image/svg+xml;utf8,${encodeURIComponent(FAKE_SCREENSHOT_SVG)}`;

/* ── M5 · 결과 · 채팅 ─────────────────────────────────────────── */

export const RESULT_READY: Analysis = {
  id: "r-today",
  userId: "sample",
  periodType: "daily",
  totalMinutes: 252,
  detoxScore: 72,
  isPremium: true,
  createdAt: daysAgo(0, 8),
  sourceAnalysisIds: null,
  apps: [
    { appName: "인스타그램", minutes: 96, category: "SNS" },
    { appName: "유튜브", minutes: 71, category: "영상" },
    { appName: "카카오톡", minutes: 40, category: "메신저" },
    { appName: "웹툰", minutes: 25, category: "엔터테인먼트" },
    { appName: "지도", minutes: 20, category: "유틸리티" },
  ],
  topCategories: [
    { category: "SNS", minutes: 96 },
    { category: "영상", minutes: 71 },
    { category: "메신저", minutes: 40 },
  ],
  timePatterns: [
    { timeSlot: "22:00 – 24:00", apps: ["인스타그램", "유튜브"], question: "밤 10시 이후에 인스타그램을 가장 오래 봤어요. 그 시간에 무엇을 찾고 있었나요?" },
    { timeSlot: "12:00 – 13:00", apps: ["카카오톡"], question: "점심시간 메신저는 필요한 대화였나요, 습관이었나요?" },
  ],
  coreProblems: [
    "잠들기 직전 SNS 사용이 하루 사용량의 40%를 차지해요.",
    "짧은 영상을 연달아 보는 패턴이 반복돼요.",
  ],
  psychologicalCauses: ["하루를 마무리하는 보상 심리가 SNS로 향하고 있어요.", "알림이 올 때마다 확인하는 습관이 굳어졌어요."],
  detoxStrategies: [
    "밤 10시 이후에는 SNS 앱을 두 번째 화면으로 옮겨 보세요.",
    "영상 앱의 자동 재생을 꺼 두세요.",
    "메신저 알림을 묶어서 받도록 바꿔 보세요.",
  ],
  dailyRoutine: {
    morning: "눈 뜨고 30분은 휴대폰 대신 창문을 열고 스트레칭해요.",
    afternoon: "점심 후 10분 산책 — 휴대폰은 주머니에 넣어 둬요.",
    evening: "잠들기 1시간 전 휴대폰을 거실에 두고 들어가요.",
  },
  recommendations: [
    "잠들기 1시간 전에는 휴대폰을 거실에 두고 들어가 보세요.",
    "인스타그램 사용 시간 알림을 30분으로 걸어 두세요.",
  ],
};

/** 프리미엄이 아닌 분석 — 시간대 패턴 자리에 안내만 */
export const RESULT_FREE: Analysis = { ...RESULT_READY, id: "r-free", isPremium: false, timePatterns: [] };

export const RESULT_WEEKLY: Analysis = {
  ...RESULT_READY,
  id: "r-week",
  periodType: "weekly",
  totalMinutes: 2104,
  detoxScore: 64,
  createdAt: new Date(2026, 8, 13, 21, 40, 0).toISOString(),
};

export const CHAT_MESSAGES: ChatItem[] = [
  { role: "model", text: RESULT_READY.timePatterns[0].question },
  { role: "user", text: "자기 전에 그냥 습관처럼 켜게 돼요. 어떻게 끊을 수 있을까요?" },
  {
    role: "model",
    text: "습관은 신호 → 행동 → 보상으로 굳어져요. 침대에 눕는 순간이 신호라면, 휴대폰을 충전기에 꽂아 거실에 두는 것부터 시작해 보세요. 대신 읽을 책 한 권을 머리맡에 두면 보상을 바꿀 수 있어요.",
  },
  { role: "user", text: "어제 캡처도 같이 봐 주세요", imageUri: SAMPLE_SCREENSHOT },
];

/* ── M6 · 정원 탭 ─────────────────────────────────────────────── */

/** 기준 시각 — KST 2026-09-17 10:00. 기기 시간대와 무관하게 서버 기준 날짜가 같다 */
export const GARDEN_NOW = Date.UTC(2026, 8, 17, 1, 0, 0);

/**
 * 정원 미리보기의 "이번 주 분석 기록" — 기준일(2026-09-17 · 한국 시간 월 9/14 ~ 일 9/20) 주에 일간 `daily`개(월요일부터 차례로)와
 * 선택적으로 이번 주 주간 분석 1건. 오늘의 미션 중 "주간 분석 받기" 줄이 이 값으로 그려진다.
 */
export function gardenWeekRecords(daily: number, weeklyDone: boolean): AnalysisRecords {
  const at = (day: number) => new Date(Date.UTC(2026, 8, 14 + day, 12, 0, 0)).toISOString(); // 한국 시간 21시 — 같은 날짜
  const count = Math.max(0, Math.min(7, Math.floor(daily)));
  return {
    // API는 최신순으로 준다
    daily: Array.from({ length: count }, (_, i) => count - 1 - i).map((i) => ({
      id: `gw-${i}`,
      periodType: "daily" as const,
      totalMinutes: 250 + i * 9,
      detoxScore: 60 + i,
      isPremium: false,
      createdAt: at(i),
    })),
    weekly: weeklyDone
      ? [{ id: "gw-weekly", periodType: "weekly" as const, totalMinutes: 1800, detoxScore: 62, isPremium: false, createdAt: at(2) }]
      : [],
  };
}

/* ── M7 · 설정 ────────────────────────────────────────────────── */

/** 지어낸 계정 — 실제 사용자 이름 · 이메일을 복사해 넣지 않는다 (Public 레포 · security.md) */
export const SETTINGS_USER: ApiUser = {
  id: "sample-id",
  uid: "sample-uid",
  email: "sample@example.com",
  name: "지우",
  premium: false,
  createdAt: "2026-08-01T00:00:00.000Z",
};

/* ── M7 · 커뮤니티 ────────────────────────────────────────────── */

const FEED_NAMES = ["민준", "서연", "하준", "도윤", "수아", "지우"] as const;
const FEED_TEXTS = [
  "오늘 처음으로 저녁 3시간을 폰 없이 보냈어요. 산책하고 오니 머리가 맑아졌어요.",
  "자기 전에 폰을 거실에 두니 잠드는 시간이 확 빨라졌어요. 추천합니다!",
  "알림을 전부 끄고 하루를 보냈더니 확인하는 횟수가 반으로 줄었어요.",
  "주말에 영상 시청을 2시간으로 제한해 봤는데 생각보다 할 만하네요.",
  "다들 화이팅! 작은 상한부터 시작해도 충분해요.",
] as const;

/** 서버가 최신순으로 주는 모양 그대로 — 25개 (10 · 10 · 5개 세 페이지). `p-03`과 `p-12`는 내 글, 몇 개는 배지 자랑 글이다 */
export const COMMUNITY_POSTS: FeedPost[] = Array.from({ length: 25 }, (_, i) => {
  const n = i + 1;
  const badge = n % 7 === 0;
  const mine = n === 3 || n === 12;
  return {
    id: `p-${String(n).padStart(2, "0")}`,
    type: badge ? ("badge" as const) : ("text" as const),
    content: badge ? (n % 2 === 0 ? "드디어 달성했어요!" : "") : FEED_TEXTS[i % FEED_TEXTS.length],
    badgeName: badge ? (n % 2 === 0 ? "7일 연속" : "첫 분석") : null,
    likeCount: (i * 3) % 11,
    commentCount: n <= 3 ? n : 0,
    // 5분 전부터 7시간 간격으로 거슬러 간다 — 마지막 글은 7일이 넘어 날짜로 보인다
    createdAt: new Date(SAMPLE_NOW.getTime() - (5 + n * 420) * 60_000).toISOString(),
    authorName: mine ? "지우" : FEED_NAMES[i % 5],
    isMine: mine,
    liked: n === 2 || n === 5,
  };
});

export const COMMUNITY_COMMENTS: Record<string, FeedComment[]> = {
  "p-01": [{ id: "c-1", content: "저도 어제 해봤는데 정말 좋았어요!", createdAt: new Date(SAMPLE_NOW.getTime() - 3 * 60_000).toISOString(), authorName: "서연", isMine: false }],
  "p-02": [
    { id: "c-2", content: "응원합니다 💪", createdAt: new Date(SAMPLE_NOW.getTime() - 50 * 60_000).toISOString(), authorName: "하준", isMine: false },
    { id: "c-3", content: "나도 따라 해볼게요.", createdAt: new Date(SAMPLE_NOW.getTime() - 20 * 60_000).toISOString(), authorName: "지우", isMine: true },
  ],
  "p-03": [
    { id: "c-4", content: "첫 댓글!", createdAt: new Date(SAMPLE_NOW.getTime() - 5 * 3_600_000).toISOString(), authorName: "민준", isMine: false },
    { id: "c-5", content: "대단해요.", createdAt: new Date(SAMPLE_NOW.getTime() - 2 * 3_600_000).toISOString(), authorName: "수아", isMine: false },
    { id: "c-6", content: "저도 같은 마음이에요.", createdAt: new Date(SAMPLE_NOW.getTime() - 40 * 60_000).toISOString(), authorName: "서연", isMine: false },
  ],
};

const rankEntry = (rank: number, name: string, avgScore: number, isMe = false): RankingEntry => ({ rank, name, avgScore, analysisCount: 7 - Math.min(4, rank % 5), isMe });

/** 랭킹 Top 10 — 내가 4위 */
export const RANKING_READY = {
  ranking: [
    rankEntry(1, "하준", 91),
    rankEntry(2, "서연", 88),
    rankEntry(3, "민준", 86),
    rankEntry(4, "지우", 83, true),
    rankEntry(5, "수아", 80),
    rankEntry(6, "도윤", 77),
    rankEntry(7, "유나", 74),
    rankEntry(8, "시우", 72),
    rankEntry(9, "예린", 70),
    rankEntry(10, "건우", 68),
  ],
  myRank: rankEntry(4, "지우", 83, true),
  minAnalyses: 3,
};

/** Top 10 밖 — 내 순위 14위를 따로 보인다 */
export const RANKING_OUTSIDE = { ...RANKING_READY, ranking: RANKING_READY.ranking.map((r) => ({ ...r, isMe: false })), myRank: rankEntry(14, "지우", 61, true) };

export const RANKING_EMPTY = { ranking: [] as RankingEntry[], myRank: null, minAnalyses: 3 };

/* ── M7 · 배지 ────────────────────────────────────────────────── */

/** 획득한 배지 둘(하나는 이미 자랑함) — 나머지 둘(주간 분석 완료 · 목표 달성)은 잠겨 있다 */
export const BADGES_READY: Badge[] = [
  { id: "bd-1", userId: "sample", name: "7일 연속", earnedAt: "2026-09-16T12:00:00.000Z", shared: false },
  { id: "bd-2", userId: "sample", name: "첫 분석", earnedAt: "2026-09-10T12:00:00.000Z", shared: true },
];

/** 이번 주 일간 3개 · 연속 5일 — 잠긴 배지의 진행도 */
export const BADGE_STATS: BadgeStats = { total: 14, weekly: 1, dailyThisWeek: 3, streak: 5 };

/* ── M7 · 목표 ────────────────────────────────────────────────── */

/**
 * 목표 샘플 — 서버가 날짜를 UTC 자정으로 저장하는 모양 그대로다 (`"2026-09-14T00:00:00.000Z"`).
 * 기준일은 2026-09-17(목 · 한국 시간)이다: 진행 중 · 곧 끝남 · 이미 끝난 기간 · 시작 전 · 완료 두 개.
 */
function goal(id: string, title: string, targetMinutes: number, start: string, end: string, status: Goal["status"] = "active"): Goal {
  return {
    id,
    userId: "sample",
    title,
    targetMinutes,
    startDate: `${start}T00:00:00.000Z`,
    endDate: `${end}T00:00:00.000Z`,
    status,
    createdAt: `${start}T03:00:00.000Z`,
  };
}

export const GOALS_READY: Goal[] = [
  goal("ga", "하루 4시간 이하", 240, "2026-09-14", "2026-09-20"),
  goal("gb", "잠들기 전 SNS 끊기", 60, "2026-09-15", "2026-09-29"),
  goal("gc", "주말 영상 줄이기", 120, "2026-09-01", "2026-09-10"),
  goal("gd", "다음 주 유튜브 1시간", 60, "2026-09-21", "2026-09-27"),
  goal("ge", "일주일 3시간 이하", 180, "2026-09-01", "2026-09-07", "completed"),
  goal("gf", "SNS 하루 30분", 30, "2026-08-20", "2026-08-26", "completed"),
];

/** 상태별 샘플 — 마지막 분석일이 기준일과 며칠 떨어졌는지가 동물 상태를 정한다 (logic/garden.ts) */
export const GARDEN_SAMPLES: Record<string, GardenSnapshot> = {
  /** 오늘 분석함 → fed */
  fed: { totalDetoxMinutes: 1450, animal: { type: "cat", streak: 12, lastAnalysisDate: "2026-09-17", pet: { date: "2026-09-17", today: 3, total: 41 } } },
  /** 어제까지 이어짐 → peckish (쓰다듬기 기록의 날짜가 어제라 오늘 횟수는 0) */
  peckish: { totalDetoxMinutes: 700, animal: { type: "dog", streak: 8, lastAnalysisDate: "2026-09-16", pet: { date: "2026-09-16", today: 5, total: 27 } } },
  /** 3일 전 → starving (서버 연속 기록 값은 그대로 30 — 다음 분석에서 1로 돌아간다) */
  starving: { totalDetoxMinutes: 3100, animal: { type: "rabbit", streak: 30, lastAnalysisDate: "2026-09-14", pet: { date: "2026-09-14", today: 2, total: 88 } } },
  /** 방금 골랐고 분석 기록 없음 → egg */
  egg: { totalDetoxMinutes: 60, animal: { type: "cat", streak: 0, lastAnalysisDate: null, pet: { date: null, today: 0, total: 0 } } },
  /** 가입 직후 — 동물 미선택 */
  none: { totalDetoxMinutes: 0, animal: null },
  /** 두 성장이 모두 마지막 단계 (쓰다듬기도 오늘 상한을 채움) */
  legend: { totalDetoxMinutes: 10200, animal: { type: "cat", streak: 130, lastAnalysisDate: "2026-09-17", pet: { date: "2026-09-17", today: 5, total: 140 } } },
};
