/**
 * Firebase — 웹 미리보기(RN Web, 검증 1층).
 * 브라우저 기본 퍼시스턴스(IndexedDB)를 쓴다. 웹 레포 `services/firebase.ts` 와 같은 구성이다.
 */
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

import { firebaseConfig } from "@/config";

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
