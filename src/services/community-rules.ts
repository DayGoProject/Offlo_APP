/**
 * 커뮤니티 이용 규칙 동의의 저장소 — 이 기기 AsyncStorage에 **사용자별 · 규칙 버전별**로 둔다 (`logic/moderation.ts` `rulesKey`).
 * 읽기 · 쓰기 실패는 삼킨다 — 못 읽으면 동의하지 않은 것으로 보고(규칙을 한 번 더 보여 준다), 못 쓰면 이번 실행 동안만 동의한 것이다.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { RULES_VERSION, rulesAccepted, rulesKey } from "@/logic/moderation";

export interface RulesStore {
  /** 현재 규칙 버전에 동의했는가 */
  read: () => Promise<boolean>;
  /** 현재 규칙 버전에 동의했다고 기록한다 */
  write: () => Promise<void>;
}

export function communityRulesStore(uid: string): RulesStore {
  const key = rulesKey(uid);
  return {
    read: async () => {
      try {
        return rulesAccepted(await AsyncStorage.getItem(key));
      } catch {
        return false;
      }
    },
    write: async () => {
      try {
        await AsyncStorage.setItem(key, String(RULES_VERSION));
      } catch {
        // 못 써도 이번 실행에서는 동의한 것으로 진행한다 — 다음 실행에서 한 번 더 보여 줄 뿐이다
      }
    },
  };
}
