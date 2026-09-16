// 저장소 추상화. IndexedDB(브라우저 실사용)와 메모리 스토어(테스트)가
// 동일한 인터페이스를 구현해, migration.ts/backup.ts 로직을 Node 환경에서도
// 실제 IndexedDB 없이 그대로 테스트할 수 있게 한다.

export type StoreName =
  | "settings"
  | "transactions"
  | "prepaidPasses"
  | "prepaidEvents"
  | "monthlyActualPayouts"
  | "membershipPasses"
  | "membershipEvents"
  | "meta";

/** 실제 정산 데이터가 들어있는 store (meta 제외). "IndexedDB가 비어있는가" 판단 등에 쓴다. */
export const DATA_STORE_NAMES: readonly StoreName[] = [
  "settings",
  "transactions",
  "prepaidPasses",
  "prepaidEvents",
  "monthlyActualPayouts",
  "membershipPasses",
  "membershipEvents",
];

export const STORE_NAMES: readonly StoreName[] = [...DATA_STORE_NAMES, "meta"];

export const STORE_KEY_PATHS: Record<StoreName, string> = {
  settings: "id",
  transactions: "id",
  prepaidPasses: "id",
  prepaidEvents: "id",
  monthlyActualPayouts: "month",
  membershipPasses: "id",
  membershipEvents: "id",
  meta: "key",
};

export interface RecordStore {
  getAll<T>(storeName: StoreName): Promise<T[]>;
  get<T>(storeName: StoreName, key: string): Promise<T | undefined>;
  put<T>(storeName: StoreName, value: T): Promise<void>;
  delete(storeName: StoreName, key: string): Promise<void>;
  clear(storeName: StoreName): Promise<void>;
}
