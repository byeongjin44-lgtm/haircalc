// localStorage(v1) -> IndexedDB 자동 마이그레이션.
//
// 원칙:
// - IndexedDB가 비어있고 legacy localStorage에 데이터가 있을 때만 복사한다.
// - 복사 후 반드시 검증하고, 검증에 실패하면 완료 플래그를 남기지 않는다 (재시도 가능).
// - 검증 성공 여부와 무관하게 legacy localStorage는 이 함수에서 지우지 않는다
//   (데이터 유실 방지가 최우선 — v0.1에서는 성공 후에도 legacy를 남겨둔다).
// - 이미 완료 플래그가 있거나 IndexedDB에 데이터가 있으면 항상 아무것도 하지 않는다
//   (여러 번 실행해도 중복 생성/덮어쓰기가 없다).

import { DATA_STORE_NAMES, type RecordStore } from "./recordStore.ts";
import type {
  MonthlyActualPayout,
  PrepaidEvent,
  PrepaidPass,
  SettlementSettings,
  Transaction,
} from "./types.ts";

const LEGACY_KEYS = {
  settings: "haircalc.settlementSettings.v1",
  transactions: "haircalc.transactions.v1",
  prepaidPasses: "haircalc.prepaidPasses.v1",
  prepaidEvents: "haircalc.prepaidEvents.v1",
  monthlyActualPayouts: "haircalc.monthlyActualPayouts.v1",
} as const;

const MIGRATION_FLAG_KEY = "migrationCompleted";

export interface LegacyLocalStorageData {
  settings: SettlementSettings | null;
  transactions: Transaction[];
  prepaidPasses: PrepaidPass[];
  prepaidEvents: PrepaidEvent[];
  monthlyActualPayouts: MonthlyActualPayout[];
}

interface MetaRecord {
  key: string;
  value: unknown;
  updatedAt: string;
}

export type MigrationReason =
  | "already_migrated"
  | "store_not_empty"
  | "no_legacy_data"
  | "migrated";

export interface MigrationResult {
  migrated: boolean;
  reason: MigrationReason;
}

function readLegacyJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** 브라우저의 legacy localStorage(v1)를 읽는다. Node(SSR/테스트)에서는 항상 빈 값을 반환한다. */
export function readLegacyLocalStorageData(): LegacyLocalStorageData {
  const monthlyActualPayoutsMap =
    readLegacyJson<Record<string, MonthlyActualPayout>>(LEGACY_KEYS.monthlyActualPayouts) ?? {};

  return {
    settings: readLegacyJson<SettlementSettings>(LEGACY_KEYS.settings),
    transactions: readLegacyJson<Transaction[]>(LEGACY_KEYS.transactions) ?? [],
    prepaidPasses: readLegacyJson<PrepaidPass[]>(LEGACY_KEYS.prepaidPasses) ?? [],
    prepaidEvents: readLegacyJson<PrepaidEvent[]>(LEGACY_KEYS.prepaidEvents) ?? [],
    monthlyActualPayouts: Object.values(monthlyActualPayoutsMap),
  };
}

export function clearLegacyLocalStorage(): void {
  if (typeof window === "undefined") return;
  for (const key of Object.values(LEGACY_KEYS)) {
    window.localStorage.removeItem(key);
  }
}

function hasLegacyData(legacy: LegacyLocalStorageData): boolean {
  return (
    legacy.settings !== null ||
    legacy.transactions.length > 0 ||
    legacy.prepaidPasses.length > 0 ||
    legacy.prepaidEvents.length > 0 ||
    legacy.monthlyActualPayouts.length > 0
  );
}

export async function isStoreEmpty(store: RecordStore): Promise<boolean> {
  for (const name of DATA_STORE_NAMES) {
    const all = await store.getAll(name);
    if (all.length > 0) return false;
  }
  return true;
}

export async function getMigrationFlag(store: RecordStore): Promise<boolean> {
  const record = await store.get<MetaRecord>("meta", MIGRATION_FLAG_KEY);
  return record?.value === true;
}

export async function setMigrationFlag(store: RecordStore): Promise<void> {
  await store.put<MetaRecord>("meta", {
    key: MIGRATION_FLAG_KEY,
    value: true,
    updatedAt: new Date().toISOString(),
  });
}

function byKey<T>(items: T[], key: keyof T) {
  return [...items].sort((a, b) => String(a[key]).localeCompare(String(b[key])));
}

function sameRecordSet<T>(a: T[], b: T[], key: keyof T): boolean {
  if (a.length !== b.length) return false;
  return JSON.stringify(byKey(a, key)) === JSON.stringify(byKey(b, key));
}

async function verifyMigration(
  store: RecordStore,
  legacy: LegacyLocalStorageData
): Promise<boolean> {
  if (legacy.settings) {
    const settings = await store.get<SettlementSettings>("settings", legacy.settings.id);
    if (JSON.stringify(settings) !== JSON.stringify(legacy.settings)) return false;
  }

  const [transactions, prepaidPasses, prepaidEvents, monthlyActualPayouts] = await Promise.all([
    store.getAll<Transaction>("transactions"),
    store.getAll<PrepaidPass>("prepaidPasses"),
    store.getAll<PrepaidEvent>("prepaidEvents"),
    store.getAll<MonthlyActualPayout>("monthlyActualPayouts"),
  ]);

  if (!sameRecordSet(transactions, legacy.transactions, "id")) return false;
  if (!sameRecordSet(prepaidPasses, legacy.prepaidPasses, "id")) return false;
  if (!sameRecordSet(prepaidEvents, legacy.prepaidEvents, "id")) return false;
  if (!sameRecordSet(monthlyActualPayouts, legacy.monthlyActualPayouts, "month")) return false;

  return true;
}

/**
 * 순수 마이그레이션 로직. legacy 데이터를 인자로 직접 받기 때문에
 * (내부에서 localStorage를 읽지 않는다) 메모리 RecordStore로 완전히 테스트할 수 있다.
 */
export async function migrateLegacyDataIfNeeded(
  store: RecordStore,
  legacy: LegacyLocalStorageData | null
): Promise<MigrationResult> {
  const alreadyFlagged = await getMigrationFlag(store);
  if (alreadyFlagged) {
    return { migrated: false, reason: "already_migrated" };
  }

  const empty = await isStoreEmpty(store);
  if (!empty) {
    // IndexedDB에 이미 데이터가 있다 -> legacy가 절대 덮어쓰지 않는다.
    await setMigrationFlag(store);
    return { migrated: false, reason: "store_not_empty" };
  }

  if (!legacy || !hasLegacyData(legacy)) {
    await setMigrationFlag(store);
    return { migrated: false, reason: "no_legacy_data" };
  }

  if (legacy.settings) {
    await store.put("settings", legacy.settings);
  }
  for (const tx of legacy.transactions) {
    await store.put("transactions", tx);
  }
  for (const pass of legacy.prepaidPasses) {
    await store.put("prepaidPasses", pass);
  }
  for (const event of legacy.prepaidEvents) {
    await store.put("prepaidEvents", event);
  }
  for (const payout of legacy.monthlyActualPayouts) {
    await store.put("monthlyActualPayouts", payout);
  }

  const verified = await verifyMigration(store, legacy);
  if (!verified) {
    // 완료 플래그를 남기지 않는다 -> 다음 실행에서 다시 시도할 수 있다.
    // legacy localStorage도 건드리지 않았으므로 원본 데이터는 안전하다.
    throw new Error(
      "마이그레이션 검증에 실패했습니다. 원본 데이터는 보존되어 있습니다."
    );
  }

  await setMigrationFlag(store);
  return { migrated: true, reason: "migrated" };
}

let migrationPromise: Promise<MigrationResult> | null = null;

/** 세션(모듈 로드) 당 한 번만 실제로 마이그레이션을 시도하도록 캐싱한다. */
export function ensureMigrated(store: RecordStore): Promise<MigrationResult> {
  if (!migrationPromise) {
    const legacy = typeof window !== "undefined" ? readLegacyLocalStorageData() : null;
    migrationPromise = migrateLegacyDataIfNeeded(store, legacy);
  }
  return migrationPromise;
}
