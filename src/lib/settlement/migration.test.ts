import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createDefaultSettlementSettings } from "./engine.ts";
import {
  getMigrationFlag,
  isStoreEmpty,
  migrateLegacyDataIfNeeded,
  setMigrationFlag,
  type LegacyLocalStorageData,
} from "./migration.ts";
import { createMemoryStore } from "./recordStore.memory.ts";
import { DATA_STORE_NAMES, STORE_NAMES } from "./recordStore.ts";
import type { PrepaidEvent, PrepaidPass, Transaction } from "./types.ts";

function emptyLegacy(): LegacyLocalStorageData {
  return {
    settings: null,
    transactions: [],
    prepaidPasses: [],
    prepaidEvents: [],
    monthlyActualPayouts: [],
  };
}

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-1",
    date: "2026-09-05",
    amount: 100_000,
    customerType: "OTHER",
    serviceType: "CUT",
    paymentType: "CASH",
    commissionRateSnapshot: 0.4,
    vatModeSnapshot: "NONE",
    vatDeduction: 0,
    paymentFee: 0,
    materialCost: 0,
    settlementBaseAmount: 100_000,
    settlementAmount: 40_000,
    withholding3_3Applied: false,
    estimatedPayoutAmount: 40_000,
    createdAt: "2026-09-05T00:00:00.000Z",
    updatedAt: "2026-09-05T00:00:00.000Z",
    ...overrides,
  };
}

function makePrepaidPass(overrides: Partial<PrepaidPass> = {}): PrepaidPass {
  return {
    id: "pass-1",
    purchaseDate: "2026-09-01",
    paidAmount: 1_000_000,
    creditAmount: 1_000_000,
    remainingBalance: 800_000,
    recognitionMode: "SALE_IMMEDIATE",
    bonusSettlementMode: "CREDIT_AMOUNT",
    status: "ACTIVE",
    label: "마이그레이션 테스트권",
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function makePrepaidEvent(overrides: Partial<PrepaidEvent> = {}): PrepaidEvent {
  return {
    id: "evt-1",
    prepaidPassId: "pass-1",
    type: "PURCHASE",
    date: "2026-09-01",
    creditAmountImpact: 1_000_000,
    salesImpact: 1_000_000,
    settlementImpact: 400_000,
    commissionRateSnapshot: 0.4,
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("A. 빈 IndexedDB 초기화", () => {
  test("빈 스토어 + legacy 없음 -> 아무 것도 옮기지 않고 완료 플래그만 남긴다", async () => {
    const store = createMemoryStore();

    assert.equal(await isStoreEmpty(store), true);
    assert.equal(await getMigrationFlag(store), false);

    const result = await migrateLegacyDataIfNeeded(store, null);

    assert.equal(result.migrated, false);
    assert.equal(result.reason, "no_legacy_data");
    assert.equal(await getMigrationFlag(store), true);
    assert.equal(await isStoreEmpty(store), true);
  });
});

describe("B/C. localStorage 데이터 존재 -> migration -> 동일 데이터/snapshot 확인", () => {
  test("settings/transactions/prepaidPasses/prepaidEvents/monthlyActualPayouts가 그대로 옮겨진다", async () => {
    const store = createMemoryStore();
    const legacy: LegacyLocalStorageData = {
      settings: createDefaultSettlementSettings({ baseIncentiveRate: 0.45 }),
      transactions: [makeTransaction()],
      prepaidPasses: [makePrepaidPass()],
      prepaidEvents: [makePrepaidEvent()],
      monthlyActualPayouts: [{ month: "2026-09", amount: 500_000, updatedAt: "2026-09-30T00:00:00.000Z" }],
    };

    const result = await migrateLegacyDataIfNeeded(store, legacy);

    assert.equal(result.migrated, true);
    assert.equal(result.reason, "migrated");

    const settings = await store.get("settings", "default");
    assert.deepEqual(settings, legacy.settings);

    const transactions = await store.getAll<Transaction>("transactions");
    assert.equal(transactions.length, 1);
    // snapshot 값(적용 인센티브율/정산 기준금액/정산액 등)이 완전히 동일해야 한다.
    assert.deepEqual(transactions[0], legacy.transactions[0]);

    const prepaidPasses = await store.getAll<PrepaidPass>("prepaidPasses");
    assert.deepEqual(prepaidPasses[0], legacy.prepaidPasses[0]);

    const prepaidEvents = await store.getAll<PrepaidEvent>("prepaidEvents");
    assert.deepEqual(prepaidEvents[0], legacy.prepaidEvents[0]);

    const payouts = await store.getAll("monthlyActualPayouts");
    assert.deepEqual(payouts, legacy.monthlyActualPayouts);
  });
});

describe("D. migration 2회 실행해도 중복 없음", () => {
  test("두 번째 실행은 already_migrated로 아무 것도 하지 않는다", async () => {
    const store = createMemoryStore();
    const legacy: LegacyLocalStorageData = {
      ...emptyLegacy(),
      transactions: [makeTransaction()],
    };

    const first = await migrateLegacyDataIfNeeded(store, legacy);
    assert.equal(first.migrated, true);

    const second = await migrateLegacyDataIfNeeded(store, legacy);
    assert.equal(second.migrated, false);
    assert.equal(second.reason, "already_migrated");

    const transactions = await store.getAll<Transaction>("transactions");
    assert.equal(transactions.length, 1); // 중복 생성되지 않음
  });
});

describe("E. IndexedDB 기존 데이터가 legacy에 의해 덮어써지지 않음", () => {
  test("스토어에 이미 데이터가 있으면 legacy를 무시한다", async () => {
    const store = createMemoryStore();
    const existingTx = makeTransaction({ id: "tx-existing", amount: 999_999 });
    await store.put("transactions", existingTx);

    const legacy: LegacyLocalStorageData = {
      ...emptyLegacy(),
      transactions: [makeTransaction({ id: "tx-legacy" })],
    };

    const result = await migrateLegacyDataIfNeeded(store, legacy);

    assert.equal(result.migrated, false);
    assert.equal(result.reason, "store_not_empty");

    const transactions = await store.getAll<Transaction>("transactions");
    assert.equal(transactions.length, 1);
    assert.equal(transactions[0].id, "tx-existing"); // legacy로 덮어써지지 않음
  });
});

describe("검증 실패 시 완료 플래그를 남기지 않는다", () => {
  test("verifyMigration이 실패하면 예외를 던지고 flag가 설정되지 않는다", async () => {
    // put()이 저장 직후 값을 임의로 바꿔치기하는 손상된 스토어를 만들어 검증 실패를 재현한다.
    const base = createMemoryStore();
    let putCount = 0;
    const corrupting = {
      ...base,
      put: async <T,>(storeName: Parameters<typeof base.put>[0], value: T) => {
        putCount += 1;
        if (storeName === "transactions") {
          await base.put(storeName, { ...(value as object), amount: -1 } as T);
          return;
        }
        await base.put(storeName, value);
      },
    };

    const legacy: LegacyLocalStorageData = {
      ...emptyLegacy(),
      transactions: [makeTransaction()],
    };

    await assert.rejects(() => migrateLegacyDataIfNeeded(corrupting, legacy));
    assert.ok(putCount > 0);
    assert.equal(await getMigrationFlag(base), false);
  });
});

describe("J. 전체 삭제 정상", () => {
  test("모든 store를 비우면 isStoreEmpty와 migrationFlag가 초기 상태로 돌아간다", async () => {
    const store = createMemoryStore();
    await migrateLegacyDataIfNeeded(store, {
      ...emptyLegacy(),
      transactions: [makeTransaction()],
    });
    assert.equal(await isStoreEmpty(store), false);

    for (const name of STORE_NAMES) {
      await store.clear(name);
    }

    for (const name of DATA_STORE_NAMES) {
      assert.deepEqual(await store.getAll(name), []);
    }
    assert.equal(await isStoreEmpty(store), true);
    assert.equal(await getMigrationFlag(store), false);

    // 삭제 후에도 기본 설정으로 정상 동작해야 한다 (기본값 fallback 확인).
    const settings = await store.get("settings", "default");
    assert.equal(settings, undefined);
    assert.deepEqual(createDefaultSettlementSettings().baseIncentiveRate, 0.4);
  });

  test("setMigrationFlag/getMigrationFlag 왕복", async () => {
    const store = createMemoryStore();
    assert.equal(await getMigrationFlag(store), false);
    await setMigrationFlag(store);
    assert.equal(await getMigrationFlag(store), true);
  });
});
