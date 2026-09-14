/**
 * 웹 API Routes 클라이언트 — 앱의 모든 API 호출은 여기를 거친다 (mobile.md).
 *
 * M2에서는 로그인에 필요한 `POST /api/users` 하나만 연결한다.
 * 타임아웃 · 재시도 · 네트워크 에러 문구는 M3에서 이 파일에 붙인다.
 */
import { API_BASE_URL } from "@/config";
import { auth } from "@/services/firebase";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiClientOptions {
  baseUrl: string;
  /** 로그인 전이면 null — 인증이 필요한 호출은 401로 막힌다 */
  getToken: () => Promise<string | null>;
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

export function createApiClient({ baseUrl, getToken }: ApiClientOptions) {
  async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    const token = await getToken();
    if (!token) throw new ApiError("로그인이 필요합니다.", 401);

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined && { "Content-Type": "application/json" }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const data: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      // 웹 handleApiError는 { error: "<한국어 메시지>" } 형태로 돌려준다
      const message =
        data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : `요청에 실패했습니다. (${res.status})`;
      throw new ApiError(message, res.status);
    }
    return data as T;
  }

  return {
    users: {
      /** 로그인할 때마다 호출한다 — 서버가 upsert라 이미 있으면 그대로 둔다 */
      ensure: (input: { email: string; name: string }) =>
        request<{ user: ApiUser }>("POST", "/api/users", input),
    },
  };
}

export interface ApiUser {
  id: string;
  uid: string;
  email: string;
  name: string;
  premium: boolean;
  createdAt: string;
}

export const api = createApiClient({
  baseUrl: API_BASE_URL,
  getToken: async () => (auth.currentUser ? auth.currentUser.getIdToken() : null),
});
