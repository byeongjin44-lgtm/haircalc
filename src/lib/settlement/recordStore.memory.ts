// RecordStore의 메모리 구현. 테스트 전용 — Node에는 IndexedDB가 없어
// migration.ts/backup.ts의 로직을 실제 IndexedDB 없이 검증하기 위해 사용한다.
// put 시 JSON 왕복으로 깊은 복사를 해서, 실제 저장소처럼 참조가 아닌 값으로 저장되게 한다.

import { STORE_KEY_PATHS, STORE_NAMES, type RecordStore, type StoreName } from "./recordStore.ts";

export function createMemoryStore(): RecordStore {
  const data = new Map<StoreName, Map<string, unknown>>(
    STORE_NAMES.map((name) => [name, new Map<string, unknown>()])
  );

  return {
    async getAll<T>(storeName: StoreName): Promise<T[]> {
      return Array.from(data.get(storeName)!.values()) as T[];
    },

    async get<T>(storeName: StoreName, key: string): Promise<T | undefined> {
      return data.get(storeName)!.get(key) as T | undefined;
    },

    async put<T>(storeName: StoreName, value: T): Promise<void> {
      const keyPath = STORE_KEY_PATHS[storeName] as keyof T;
      const key = String(value[keyPath]);
      const cloned = JSON.parse(JSON.stringify(value));
      data.get(storeName)!.set(key, cloned);
    },

    async delete(storeName: StoreName, key: string): Promise<void> {
      data.get(storeName)!.delete(key);
    },

    async clear(storeName: StoreName): Promise<void> {
      data.get(storeName)!.clear();
    },
  };
}
