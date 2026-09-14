/**
 * 웹 API Routes 클라이언트의 뼈대 — 타임아웃 · 재시도 · 한국어 에러 + 엔드포인트 전체.
 *
 * 이 파일은 앱 모듈(@/config · Firebase)을 런타임에 import하지 않는다. 타입만 가져온다.
 * 그래서 Node에서 가짜 fetch로 그대로 돌려 검증할 수 있다 (scripts/verify-M3-client.mjs).
 * 앱에 연결하는 곳은 services/api.ts 다 — 화면은 거기서 `api`를 가져간다.
 *
 * 재시도 원칙: **같은 요청을 두 번 보내도 결과가 같은 것만** 다시 보낸다.
 * 조회(GET)와 값 덮어쓰기만 해당한다. AI 분석(비용·하루 1회 제한), 경험치 적립(increment),
 * 좋아요(토글), 글·댓글·목표 생성은 서버가 처리했을 수도 있으므로 절대 다시 보내지 않는다.
 */
import type {
  Analysis,
  AnalysisContext,
  AnalysisResult,
  AnalysisSummary,
  AnimalTypeId,
  ApiUser,
  Badge,
  ChatMessagePayload,
  CreateAnalysisInput,
  CreateGoalInput,
  DailySummary,
  FeedComment,
  FeedPost,
  Goal,
  GoalStatus,
  NotificationItem,
  PeriodType,
  RankingEntry,
  UpdateGoalInput,
} from "@/services/api-types";

/* ── 에러 ───────────────────────────────────────────────────── */

export type ApiErrorKind = "network" | "timeout" | "unauthorized" | "http" | "aborted";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** HTTP 상태 코드 — 응답을 받지 못했으면 0 */
  readonly status: number;

  constructor(kind: ApiErrorKind, message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

export const API_MESSAGES = {
  network: "인터넷에 연결되어 있지 않거나 서버에 연결할 수 없습니다. 연결 상태를 확인한 뒤 다시 시도해주세요.",
  timeout: "서버 응답이 너무 늦어 요청을 멈췄습니다. 잠시 후 다시 시도해주세요.",
  unauthorized: "로그인이 만료되었습니다. 다시 로그인해주세요.",
  signInRequired: "로그인이 필요합니다.",
  server: "서버에 일시적인 문제가 생겼습니다. 잠시 후 다시 시도해주세요.",
  aborted: "요청을 취소했습니다.",
  unknown: "요청을 처리하지 못했습니다. 다시 시도해주세요.",
} as const;

/** 화면에 띄울 한국어 한 줄 */
export function getErrorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : API_MESSAGES.unknown;
}

/* ── 요청 뼈대 ──────────────────────────────────────────────── */

export const DEFAULT_TIMEOUT_MS = 15_000;
/** /api/ai/* 는 Vercel Hobby 상한이 60초다 — 콜드 스타트·이미지 업로드까지 감안해 그보다 길게 기다린다 */
export const AI_TIMEOUT_MS = 90_000;
/** 재시도 사이 대기 — 길이가 곧 최대 재시도 횟수다 */
const RETRY_DELAYS_MS = [600, 1800] as const;
/** 게이트웨이·배포 전환 중에 나오는 일시 장애 — 다시 보내면 풀릴 수 있다 */
const RETRYABLE_STATUS = new Set([502, 503, 504]);

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | null | undefined>;
  timeoutMs?: number;
  /** 두 번 보내도 결과가 같을 때만 true. GET은 기본 true, 나머지는 기본 false */
  idempotent?: boolean;
  signal?: AbortSignal;
}

export interface ApiClientOptions {
  baseUrl: string;
  /** 로그인 전이면 null. forceRefresh면 캐시를 버리고 새 ID 토큰을 받는다 */
  getToken: (forceRefresh: boolean) => Promise<string | null>;
  /** 테스트에서 가짜 fetch를 넣는다 */
  fetch?: typeof fetch;
  /** 테스트에서 대기를 0으로 줄인다 */
  retryDelaysMs?: readonly number[];
  timeouts?: { default?: number; ai?: number };
}

export type Requester = <T>(method: HttpMethod, path: string, options?: RequestOptions) => Promise<T>;

export function createRequester(options: ApiClientOptions): Requester {
  const {
    baseUrl,
    getToken,
    fetch: fetchImpl = globalThis.fetch,
    retryDelaysMs = RETRY_DELAYS_MS,
  } = options;
  const defaultTimeout = options.timeouts?.default ?? DEFAULT_TIMEOUT_MS;

  return async function request<T>(method: HttpMethod, path: string, opts: RequestOptions = {}): Promise<T> {
    const idempotent = opts.idempotent ?? method === "GET";
    const url = `${baseUrl}${path}${toQueryString(opts.query)}`;
    const hasBody = opts.body !== undefined;

    let retries = 0;
    let forceRefresh = false;
    let tokenRefreshed = false;

    for (;;) {
      let response: { status: number; data: unknown };
      try {
        const token = await readToken(getToken, forceRefresh);
        forceRefresh = false;
        response = await send(
          fetchImpl,
          url,
          {
            method,
            headers: {
              Authorization: `Bearer ${token}`,
              ...(hasBody && { "Content-Type": "application/json" }),
            },
            body: hasBody ? JSON.stringify(opts.body) : undefined,
          },
          opts.timeoutMs ?? defaultTimeout,
          opts.signal,
        );
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError("network", API_MESSAGES.network);
        const transient = err.kind === "network" || err.kind === "timeout";
        if (transient && idempotent && retries < retryDelaysMs.length) {
          await sleep(retryDelaysMs[retries++], opts.signal);
          continue;
        }
        throw err;
      }

      const { status, data } = response;

      // 토큰이 서버에서 거절되면 한 번만 새로 받아 다시 보낸다 — 서버는 검증 전에 막으므로 어떤 요청이든 안전하다
      if (status === 401 && !tokenRefreshed) {
        tokenRefreshed = true;
        forceRefresh = true;
        continue;
      }
      if (RETRYABLE_STATUS.has(status) && idempotent && retries < retryDelaysMs.length) {
        await sleep(retryDelaysMs[retries++], opts.signal);
        continue;
      }
      if (status >= 200 && status < 300) return data as T;
      throw httpError(status, data);
    }
  };
}

async function readToken(getToken: ApiClientOptions["getToken"], forceRefresh: boolean): Promise<string> {
  let token: string | null;
  try {
    token = await getToken(forceRefresh);
  } catch (e) {
    // 만료된 토큰을 새로 받으려면 네트워크가 필요하다 — 오프라인이면 여기서 실패한다
    const offline = errorCode(e) === "auth/network-request-failed";
    throw offline
      ? new ApiError("network", API_MESSAGES.network)
      : new ApiError("unauthorized", API_MESSAGES.unauthorized, 401);
  }
  if (!token) throw new ApiError("unauthorized", API_MESSAGES.signInRequired, 401);
  return token;
}

/** 응답 본문까지 타임아웃 안에서 읽는다 */
async function send(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  external: AbortSignal | undefined,
): Promise<{ status: number; data: unknown }> {
  if (external?.aborted) throw new ApiError("aborted", API_MESSAGES.aborted);

  // AbortSignal.timeout · AbortSignal.any 는 Hermes에 없을 수 있어 직접 엮는다
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort();
  external?.addEventListener("abort", forwardAbort);

  try {
    const res = await fetchImpl(url, { ...init, signal: controller.signal });
    const text = await res.text();
    return { status: res.status, data: parseJson(text) };
  } catch {
    if (timedOut) throw new ApiError("timeout", API_MESSAGES.timeout);
    if (external?.aborted) throw new ApiError("aborted", API_MESSAGES.aborted);
    // RN은 "Network request failed", 브라우저는 "Failed to fetch" — 둘 다 응답을 못 받은 것이다
    throw new ApiError("network", API_MESSAGES.network);
  } finally {
    clearTimeout(timer);
    external?.removeEventListener("abort", forwardAbort);
  }
}

function httpError(status: number, data: unknown): ApiError {
  if (status === 401) return new ApiError("unauthorized", API_MESSAGES.unauthorized, status);

  // 웹 handleApiError는 { error: "<한국어 메시지>" } 를 돌려준다. Vercel 게이트웨이 에러는 HTML이라 없다.
  const serverMessage =
    data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : null;
  if (status >= 500) return new ApiError("http", serverMessage ?? API_MESSAGES.server, status);
  return new ApiError("http", serverMessage ?? `${API_MESSAGES.unknown} (${status})`, status);
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ApiError("aborted", API_MESSAGES.aborted));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new ApiError("aborted", API_MESSAGES.aborted));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort);
  });
}

/** RN의 URLSearchParams는 일부만 구현돼 있어 직접 만든다 */
function toQueryString(query: RequestOptions["query"]): string {
  if (!query) return "";
  const parts = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

function parseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function errorCode(err: unknown): string {
  return err && typeof err === "object" && "code" in err && typeof err.code === "string" ? err.code : "";
}

/* ── 엔드포인트 ─────────────────────────────────────────────── */

export function createApiClient(options: ApiClientOptions) {
  const request = createRequester(options);
  const aiTimeout = options.timeouts?.ai ?? AI_TIMEOUT_MS;
  const id = encodeURIComponent;

  return {
    users: {
      me: (signal?: AbortSignal) => request<{ user: ApiUser }>("GET", "/api/users/me", { signal }),
      /** 로그인할 때마다 부른다 — 서버가 uid 기준 upsert라 여러 번 보내도 결과가 같다 */
      ensure: (input: { email: string; name: string }) =>
        request<{ user: ApiUser }>("POST", "/api/users", { body: input, idempotent: true }),
      /** 회원 탈퇴 — Supabase · Firestore · Firebase Auth 계정까지 지운다 */
      deleteMe: () => request<{ ok: true }>("DELETE", "/api/users/me"),
    },

    analyses: {
      list: (params: { periodType?: PeriodType; limit?: number; includeApps?: boolean } = {}, signal?: AbortSignal) =>
        request<{ analyses: AnalysisSummary[] }>("GET", "/api/analyses", {
          query: {
            periodType: params.periodType,
            limit: params.limit,
            includeApps: params.includeApps ? 1 : undefined,
          },
          signal,
        }),
      get: (analysisId: string, signal?: AbortSignal) =>
        request<{ analysis: Analysis }>("GET", `/api/analyses/${id(analysisId)}`, { signal }),
      /** 일간은 하루 1회 — 두 번째는 409 */
      create: (input: CreateAnalysisInput) =>
        request<{ analysisId: string }>("POST", "/api/analyses", { body: input }),
    },

    ai: {
      analyze: (input: { imageBase64: string; mimeType: string }, signal?: AbortSignal) =>
        request<{ analysisData: AnalysisResult }>("POST", "/api/ai/analyze", {
          body: input,
          timeoutMs: aiTimeout,
          signal,
        }),
      weekly: (input: { dailySummaries: DailySummary[] }, signal?: AbortSignal) =>
        request<{ analysisData: AnalysisResult }>("POST", "/api/ai/weekly", {
          body: input,
          timeoutMs: aiTimeout,
          signal,
        }),
      chat: (
        input: { analysisId: string; messages: ChatMessagePayload[]; analysisContext: AnalysisContext },
        signal?: AbortSignal,
      ) => request<{ reply: string }>("POST", "/api/ai/chat", { body: input, timeoutMs: aiTimeout, signal }),
    },

    goals: {
      list: (status?: GoalStatus, signal?: AbortSignal) =>
        request<{ goals: Goal[] }>("GET", "/api/goals", { query: { status }, signal }),
      create: (input: CreateGoalInput) => request<{ goal: Goal }>("POST", "/api/goals", { body: input }),
      /** completed로 바꾸면 서버가 보상을 지급한다 — 두 번 보내면 안 된다 */
      update: (goalId: string, patch: UpdateGoalInput) =>
        request<{ goal: Goal }>("PATCH", `/api/goals/${id(goalId)}`, { body: patch }),
      /** 성공하면 204 — 본문이 없어 null이 온다 */
      remove: (goalId: string) => request<null>("DELETE", `/api/goals/${id(goalId)}`),
    },

    badges: {
      list: (signal?: AbortSignal) => request<{ badges: Badge[] }>("GET", "/api/badges", { signal }),
    },

    garden: {
      /** 동물 선택(reset=false) · 변경(reset=true, 연속 기록 초기화) — 같은 값을 다시 써도 결과가 같다 */
      selectAnimal: (typeId: AnimalTypeId, reset: boolean) =>
        request<{ ok: true }>("POST", "/api/garden/animal", { body: { typeId, reset }, idempotent: true }),
      /** 식물 경험치 적립 — 서버가 increment라 다시 보내면 두 번 쌓인다 */
      addPlantExp: (minutes: number) =>
        request<{ ok: true }>("POST", "/api/garden/plant-exp", { body: { minutes } }),
    },

    notifications: {
      list: (signal?: AbortSignal) =>
        request<{ notifications: NotificationItem[]; unreadCount: number }>("GET", "/api/notifications", { signal }),
      markRead: (notificationId: string) =>
        request<{ ok: true }>("PATCH", `/api/notifications/${id(notificationId)}`, {
          body: { read: true },
          idempotent: true,
        }),
      markAllRead: () =>
        request<{ ok: true; updated: number }>("POST", "/api/notifications/read-all", { idempotent: true }),
    },

    community: {
      feed: (cursor?: string | null, signal?: AbortSignal) =>
        request<{ posts: FeedPost[]; nextCursor: string | null }>("GET", "/api/posts", { query: { cursor }, signal }),
      createPost: (content: string) =>
        request<{ post: { id: string } }>("POST", "/api/posts", { body: { type: "text", content } }),
      /** 획득한 배지를 피드에 공유한다. 배지명은 서버가 DB에서 다시 확인한다 */
      shareBadge: (badgeId: string, content = "") =>
        request<{ post: { id: string } }>("POST", "/api/posts", { body: { type: "badge", badgeId, content } }),
      deletePost: (postId: string) => request<{ ok: true }>("DELETE", `/api/posts/${id(postId)}`),
      /** 토글이라 두 번 가면 취소된다 */
      toggleLike: (postId: string) =>
        request<{ liked: boolean; likeCount: number }>("POST", `/api/posts/${id(postId)}/like`),
      comments: (postId: string, signal?: AbortSignal) =>
        request<{ comments: FeedComment[] }>("GET", `/api/posts/${id(postId)}/comments`, { signal }),
      createComment: (postId: string, content: string) =>
        request<{ comment: FeedComment }>("POST", `/api/posts/${id(postId)}/comments`, { body: { content } }),
      deleteComment: (commentId: string) => request<{ ok: true }>("DELETE", `/api/comments/${id(commentId)}`),
      ranking: (signal?: AbortSignal) =>
        request<{ ranking: RankingEntry[]; myRank: RankingEntry | null; minAnalyses: number }>("GET", "/api/ranking", {
          signal,
        }),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
