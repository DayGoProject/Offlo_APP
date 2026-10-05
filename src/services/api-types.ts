/**
 * 웹 API Routes의 요청 · 응답 타입.
 *
 * 원본: ../Offlo/web/src/services/ai.ts · community.ts 의 타입 + app/api/**\/route.ts 의 응답 모양.
 * sync-shared 대상이 아니다 — 원본 파일에 fetch 코드가 섞여 있어 통째로 복사할 수 없다.
 * 라우트 응답이 바뀌면 여기를 손으로 맞춘다 (서버가 원본이라 어긋나면 런타임에 드러난다).
 */
import type { AnimalTypeId, PetRecord } from "@/shared/garden-utils";

/* ── 사용자 ─────────────────────────────────────────────────── */

export interface ApiUser {
  id: string;
  uid: string;
  email: string;
  name: string;
  premium: boolean;
  createdAt: string;
}

/* ── AI 분석 (services/ai.ts) ───────────────────────────────── */

export type PeriodType = "daily" | "weekly";

export interface AppUsage {
  appName: string;
  minutes: number;
  category: string;
}

export interface TimePattern {
  timeSlot: string;
  apps: string[];
  question: string;
}

export interface DailyRoutine {
  morning: string;
  afternoon: string;
  evening: string;
}

export interface AnalysisResult {
  totalMinutes: number;
  periodType: PeriodType;
  apps: AppUsage[];
  topCategories: { category: string; minutes: number }[];
  recommendations: string[];
  detoxScore: number;
  coreProblems: string[];
  psychologicalCauses: string[];
  detoxStrategies: string[];
  dailyRoutine: DailyRoutine;
  timePatterns: TimePattern[];
}

/** 주간 분석에 전달하는 일간 요약 */
export interface DailySummary {
  date: string;
  totalMinutes: number;
  apps: AppUsage[];
  detoxScore: number;
}

/** 채팅에 전달하는 분석 컨텍스트 */
export interface AnalysisContext {
  periodType: PeriodType;
  totalMinutes: number;
  apps: AppUsage[];
  detoxScore: number;
  coreProblems: string[];
}

export interface ChatMessagePayload {
  role: "user" | "model";
  text: string;
  /** 방금 보내는 메시지에만 포함한다 — 히스토리에 남기면 요청 본문이 불어난다 */
  imageBase64?: string;
  mimeType?: string;
}

/* ── 분석 기록 ──────────────────────────────────────────────── */

/** GET /api/analyses 목록 한 줄 — apps는 includeApps=1 일 때만 온다 */
export interface AnalysisSummary {
  id: string;
  periodType: PeriodType;
  totalMinutes: number;
  detoxScore: number;
  isPremium: boolean;
  createdAt: string;
  apps?: AppUsage[];
}

/** GET /api/analyses/[id] — 저장된 분석 전체 */
export interface Analysis extends AnalysisResult {
  id: string;
  userId: string;
  isPremium: boolean;
  sourceAnalysisIds: string[] | null;
  createdAt: string;
}

/** POST /api/analyses 본문 — AI 결과를 그대로 저장한다. isPremium은 서버가 토큰에서 정한다 */
export type CreateAnalysisInput = AnalysisResult & { sourceAnalysisIds?: string[] };

/* ── 목표 ───────────────────────────────────────────────────── */

export type GoalStatus = "active" | "completed" | "paused";

export interface Goal {
  id: string;
  userId: string;
  title: string;
  targetMinutes: number;
  startDate: string;
  endDate: string;
  status: GoalStatus;
  createdAt: string;
}

/** 날짜는 ISO 문자열 */
export interface CreateGoalInput {
  title: string;
  targetMinutes: number;
  startDate: string;
  endDate: string;
}

export type UpdateGoalInput = Partial<CreateGoalInput & { status: GoalStatus }>;

/* ── 배지 · 정원 ────────────────────────────────────────────── */

export interface Badge {
  id: string;
  userId: string;
  name: string;
  earnedAt: string;
  shared: boolean;
}

export type { AnimalTypeId, PetRecord };

/**
 * 정원 상태 — API가 아니라 Firestore `users/{uid}/garden/plant · animal` 문서에서 읽는다 (services/garden.ts).
 * 그림 컴포넌트가 Firebase 쪽 모듈을 import하지 않도록 모양만 여기에 둔다.
 */
export interface GardenSnapshot {
  /** 식물 경험치 = 누적 디톡스 분 */
  totalDetoxMinutes: number;
  /** 동물을 아직 고르지 않았으면 null */
  animal: {
    type: AnimalTypeId | null;
    streak: number;
    /** 마지막으로 밥(일간 분석)을 받은 날 — KST 날짜 키 "2026-09-17". 한 번도 없으면 null */
    lastAnalysisDate: string | null;
    /** 쓰다듬기 기록(서버) — `date`가 오늘(KST)이 아니면 오늘 횟수는 0이다 (`petTodayCount`). 없으면 빈 기록 */
    pet: PetRecord;
  } | null;
}

/** `POST /api/garden/pet` 응답 — 서버가 하루 상한을 강제하고 인정된 몫만 돌려준다 */
export interface PetResponse {
  ok: true;
  /** 이번 요청에서 실제로 인정된 횟수 (상한을 넘은 몫은 버려진다 — 에러가 아니다) */
  accepted: number;
  /** 서버가 센 오늘(KST) 날짜 키 */
  date: string;
  /** 오늘 인정된 횟수 / 하루 상한 */
  today: number;
  cap: number;
  /** 누적 인정 횟수 = 친밀도 */
  total: number;
  level: { level: number; name: string };
  /** 마지막 레벨이면 null */
  nextLevel: { level: number; name: string; minTotal: number } | null;
}

/* ── 알림 ───────────────────────────────────────────────────── */

export type NotificationType =
  | "badge_earned"
  | "plant_levelup"
  | "goal_deadline"
  | "pet_hungry"
  | "daily_reminder"
  | "post_comment";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

/* ── 커뮤니티 (services/community.ts) ───────────────────────── */

export type PostType = "text" | "badge";

export interface FeedPost {
  id: string;
  type: PostType;
  content: string;
  badgeName: string | null;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  authorName: string;
  isMine: boolean;
  liked: boolean;
}

export interface FeedComment {
  id: string;
  content: string;
  createdAt: string;
  authorName: string;
  isMine: boolean;
}

export interface RankingEntry {
  rank: number;
  name: string;
  avgScore: number;
  analysisCount: number;
  isMe: boolean;
}

export const MAX_POST_LENGTH = 1000;
export const MAX_COMMENT_LENGTH = 300;
