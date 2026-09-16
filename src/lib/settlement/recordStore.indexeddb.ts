// RecordStore의 실제 브라우저 구현 (IndexedDB). 이 파일의 함수는 항상 브라우저에서만
// 호출된다 — 호출 전에 storage.ts가 isBrowser() 여부를 먼저 확인한다.
// SSR(Node)에는 indexedDB 전역이 없으므로, 최상위 스코프에서 indexedDB를 참조하지 않고
// 함수 내부에서만 접근해 import 자체는 SSR에서도 안전하게 만든다.

import { STORE_KEY_PATHS, STORE_NAMES, type RecordStore, type StoreName } from "./recordStore.ts";

const DB_NAME = "haircalc";
// v2: 회원권(membershipPasses/membershipEvents) object store 추가. 버전을 올려야
// 기존 사용자의 브라우저에서도 onupgradeneeded가 다시 실행되어 새 store가 생성된다.
// 기존 store는 `if (!db.objectStoreNames.contains(name))`로 건너뛰므로 기존 데이터는
// 그대로 보존된다.
const DB_VERSION = 2;

let dbPromise: Promise<IDBDatabase> | null = null;

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDatabase(): Promise<IDBDatabase> {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(new Error("이 브라우저는 IndexedDB를 지원하지 않습니다."));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of STORE_NAMES) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: STORE_KEY_PATHS[name] });
          }
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return dbPromise;
}

function runRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const indexedDbStore: RecordStore = {
  async getAll<T>(storeName: StoreName): Promise<T[]> {
    const db = await openDatabase();
    const tx = db.transaction(storeName, "readonly");
    return runRequest(tx.objectStore(storeName).getAll() as IDBRequest<T[]>);
  },

  async get<T>(storeName: StoreName, key: string): Promise<T | undefined> {
    const db = await openDatabase();
    const tx = db.transaction(storeName, "readonly");
    return runRequest(tx.objectStore(storeName).get(key) as IDBRequest<T | undefined>);
  },

  async put<T>(storeName: StoreName, value: T): Promise<void> {
    const db = await openDatabase();
    const tx = db.transaction(storeName, "readwrite");
    await runRequest(tx.objectStore(storeName).put(value));
  },

  async delete(storeName: StoreName, key: string): Promise<void> {
    const db = await openDatabase();
    const tx = db.transaction(storeName, "readwrite");
    await runRequest(tx.objectStore(storeName).delete(key));
  },

  async clear(storeName: StoreName): Promise<void> {
    const db = await openDatabase();
    const tx = db.transaction(storeName, "readwrite");
    await runRequest(tx.objectStore(storeName).clear());
  },
};
