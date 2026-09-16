import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createDefaultSettlementSettings } from "./engine.ts";
import {
  BACKUP_VERSION,
  SCHEMA_VERSION,
  buildBackup,
  restoreBackup,
  validateBackup,
  type BackupData,
} from "./backup.ts";
import { migrateLegacyDataIfNeeded, type LegacyLocalStorageData } from "./migration.ts";
import { createMemoryStore } from "./recordStore.memory.ts";
import { DATA_STORE_NAMES } from "./recordStore.ts";
import type { PrepaidEvent, PrepaidPass, Transaction } from "./types.ts";

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

async function seededStore() {
  const store = createMemoryStore();
  const legacy: LegacyLocalStorageData = {
    settings: createDefaultSettlementSettings({ baseIncentiveRate: 0.4 }),
    transactions: [makeTransaction()],
    prepaidPasses: [makePrepaidPass()],
    prepaidEvents: [makePrepaidEvent()],
    monthlyActualPayouts: [{ month: "2026-09", amount: 500_000, updatedAt: "2026-09-30T00:00:00.000Z" }],
  };
  await migrateLegacyDataIfNeeded(store, legacy);
  return store;
}

describe("F. JSON export 데이터 전체 포함", () => {
  test("buildBackup이 모든 데이터를 포함한다", async () => {
    const store = await seededStore();
    const backup = await buildBackup(store);

    assert.equal(backup.backupVersion, BACKUP_VERSION);
    assert.equal(backup.schemaVersion, SCHEMA_VERSION);
    assert.equal(typeof backup.exportedAt, "string");
    assert.equal(backup.settings.baseIncentiveRate, 0.4);
    assert.equal(backup.transactions.length, 1);
    assert.equal(backup.prepaidPasses.length, 1);
    assert.equal(backup.prepaidEvents.length, 1);
    assert.equal(backup.monthlyActualPayouts.length, 1);
  });
});

describe("G. export -> 전체 삭제 -> restore -> 원래 데이터 완전 복구", () => {
  test("복원 후 모든 데이터가 백업 시점과 동일하다", async () => {
    const store = await seededStore();
    const backup = await buildBackup(store);

    for (const name of DATA_STORE_NAMES) {
      await store.clear(name);
    }
    for (const name of DATA_STORE_NAMES) {
      assert.deepEqual(await store.getAll(name), []);
    }

    await restoreBackup(store, backup);

    const settings = await store.get("settings", "default");
    assert.deepEqual(settings, backup.settings);
    assert.deepEqual(await store.getAll<Transaction>("transactions"), backup.transactions);
    assert.deepEqual(await store.getAll<PrepaidPass>("prepaidPasses"), backup.prepaidPasses);
    assert.deepEqual(await store.getAll<PrepaidEvent>("prepaidEvents"), backup.prepaidEvents);
    assert.deepEqual(await store.getAll("monthlyActualPayouts"), backup.monthlyActualPayouts);
  });

  test("복원은 병합이 아니라 전체 교체다 (복원 전 데이터는 남지 않는다)", async () => {
    const store = await seededStore();
    await store.put("transactions", makeTransaction({ id: "tx-should-be-removed" }));
    assert.equal((await store.getAll<Transaction>("transactions")).length, 2);

    const backup = await buildBackup(createMemoryStore()); // 완전히 다른(빈 기본값) 백업
    await restoreBackup(store, backup);

    const transactions = await store.getAll<Transaction>("transactions");
    assert.equal(transactions.length, 0); // 병합되지 않고 백업 내용으로 완전히 대체됨
  });
});

describe("H. 잘못된 JSON 차단", () => {
  test("구조가 다른 값은 전부 거부한다", () => {
    assert.equal(validateBackup(null), false);
    assert.equal(validateBackup(undefined), false);
    assert.equal(validateBackup("문자열"), false);
    assert.equal(validateBackup(123), false);
    assert.equal(validateBackup([]), false);
    assert.equal(validateBackup({}), false);
    assert.equal(
      validateBackup({
        backupVersion: 1,
        schemaVersion: 1,
        exportedAt: "2026-09-12T00:00:00.000Z",
        settings: {},
        transactions: "not-an-array",
        prepaidPasses: [],
        prepaidEvents: [],
        monthlyActualPayouts: [],
      }),
      false
    );
  });

  test("정상 구조는 통과한다", async () => {
    const store = await seededStore();
    const backup = await buildBackup(store);
    assert.equal(validateBackup(backup), true);
    assert.equal(validateBackup(JSON.parse(JSON.stringify(backup))), true);
  });
});

describe("I. 지원하지 않는 version 차단", () => {
  test("backupVersion이 현재보다 높으면 거부한다", async () => {
    const store = await seededStore();
    const backup = await buildBackup(store);
    assert.equal(validateBackup({ ...backup, backupVersion: BACKUP_VERSION + 1 }), false);
  });

  test("schemaVersion이 현재보다 높으면 거부한다", async () => {
    const store = await seededStore();
    const backup = await buildBackup(store);
    assert.equal(validateBackup({ ...backup, schemaVersion: SCHEMA_VERSION + 1 }), false);
  });
});

describe("J. 회원권 이전(schemaVersion 1) 백업도 정상 복원된다", () => {
  test("membershipPasses/membershipEvents 필드가 아예 없어도 통과/정상 복원된다", async () => {
    const store = await seededStore();
    const fullBackup = await buildBackup(store);

    // 회원권 필드가 아예 없는 구버전 백업을 흉내낸다 (schemaVersion 1 시절 실제 포맷).
    const legacyBackup = { ...fullBackup, schemaVersion: 1 } as Record<string, unknown>;
    delete legacyBackup.membershipPasses;
    delete legacyBackup.membershipEvents;

    assert.equal(validateBackup(legacyBackup), true);

    await restoreBackup(store, legacyBackup as unknown as BackupData);

    assert.deepEqual(await store.getAll("membershipPasses"), []);
    assert.deepEqual(await store.getAll("membershipEvents"), []);
    // 나머지 데이터는 정상적으로 복원된다.
    assert.equal((await store.getAll<Transaction>("transactions")).length, 1);
  });

  test("membershipPasses/membershipEvents가 배열이 아니면 거부한다", () => {
    assert.equal(
      validateBackup({
        backupVersion: 1,
        schemaVersion: 1,
        exportedAt: "2026-09-15T00:00:00.000Z",
        settings: {},
        transactions: [],
        prepaidPasses: [],
        prepaidEvents: [],
        monthlyActualPayouts: [],
        membershipPasses: "not-an-array",
      }),
      false
    );
  });
});
