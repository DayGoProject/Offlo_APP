/**
 * 정원 상태 읽기 — Firestore `users/{uid}/garden/plant` · `animal`.
 *
 * **읽기만 한다.** 경험치 적립 · 동물 선택 같은 쓰기는 Firestore 규칙이 클라이언트를 막고 있고
 * 전부 `api.garden.*`(웹 API Routes)로 보낸다 (security.md). 웹 대시보드도 같은 두 문서를 클라이언트에서 읽는다.
 *
 * 에러는 API와 같은 `ApiError`로 바꿔 화면이 같은 한국어 안내를 띄우게 한다.
 */
import { doc, getDoc } from "firebase/firestore";

import { API_MESSAGES, ApiError, DEFAULT_TIMEOUT_MS } from "@/services/api-client";
import type { AnimalTypeId, GardenSnapshot } from "@/services/api-types";
import { db } from "@/services/firebase";

export async function readGarden(uid: string): Promise<GardenSnapshot> {
  try {
    const [plant, animal] = await withTimeout(
      Promise.all([
        getDoc(doc(db, "users", uid, "garden", "plant")),
        getDoc(doc(db, "users", uid, "garden", "animal")),
      ]),
    );
    const plantData = plant.data();
    const animalData = animal.data();
    return {
      totalDetoxMinutes: typeof plantData?.totalDetoxMinutes === "number" ? plantData.totalDetoxMinutes : 0,
      animal: animal.exists()
        ? {
            type: (animalData?.type as AnimalTypeId | undefined) ?? null,
            streak: typeof animalData?.streak === "number" ? animalData.streak : 0,
          }
        : null,
    };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
    // 오프라인이면 Firestore가 "client is offline"(unavailable)을 던진다
    if (code === "unavailable") throw new ApiError("network", API_MESSAGES.network);
    if (code === "permission-denied") throw new ApiError("http", "정원 정보를 읽을 권한이 없습니다.", 403);
    // SDK 로그를 꺼 뒀으므로(firebase.ts) 예상 못 한 코드는 문구에 붙여 원인을 남긴다 — 웹 로그인 에러와 같은 방식
    throw new ApiError("http", code ? `${API_MESSAGES.unknown} (firestore/${code})` : API_MESSAGES.unknown);
  }
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new ApiError("timeout", API_MESSAGES.timeout)), DEFAULT_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
