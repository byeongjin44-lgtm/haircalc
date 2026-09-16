import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  combineFullPeriodSummary,
  filterByDate,
  filterByMonth,
  groupByDate,
  summarizeTransactions,
} from "./summary.ts";
import type { MembershipEvent, PrepaidEvent, Transaction } from "./types.ts";

function makeTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: "tx",
    date: "2026-09-12",
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
    createdAt: "2026-09-12T00:00:00.000Z",
    updatedAt: "2026-09-12T00:00:00.000Z",
    ...overrides,
  };
}

// 검증 시나리오: 같은 날 거래 2건 + 다른 날 거래 1건(이번 달) + 이전달 거래 1건
const sameDayTx1 = makeTransaction({
  id: "tx-1",
  date: "2026-09-12",
  amount: 100_000,
  settlementAmount: 40_000,
});
const sameDayTx2 = makeTransaction({
  id: "tx-2",
  date: "2026-09-12",
  amount: 50_000,
  settlementAmount: 20_000,
});
const otherDayTx = makeTransaction({
  id: "tx-3",
  date: "2026-09-13",
  amount: 30_000,
  settlementAmount: 12_000,
});
const previousMonthTx = makeTransaction({
  id: "tx-4",
  date: "2026-08-30",
  amount: 20_000,
  settlementAmount: 8_000,
});

const allTransactions = [sameDayTx1, sameDayTx2, otherDayTx, previousMonthTx];

describe("filterByMonth", () => {
  test("이번 달 거래만 남긴다 (이전달 거래 제외)", () => {
    const result = filterByMonth(allTransactions, "2026-09");
    assert.equal(result.length, 3);
    assert.ok(!result.includes(previousMonthTx));
  });

  test("이전달 거래만 조회", () => {
    const result = filterByMonth(allTransactions, "2026-08");
    assert.deepEqual(result, [previousMonthTx]);
  });
});

describe("filterByDate", () => {
  test("같은 날짜의 거래 2건을 모두 반환", () => {
    const result = filterByDate(allTransactions, "2026-09-12");
    assert.equal(result.length, 2);
  });
});

describe("groupByDate", () => {
  test("날짜별로 거래를 묶는다", () => {
    const monthTransactions = filterByMonth(allTransactions, "2026-09");
    const grouped = groupByDate(monthTransactions);
    assert.equal(grouped["2026-09-12"].length, 2);
    assert.equal(grouped["2026-09-13"].length, 1);
    assert.equal(grouped["2026-08-30"], undefined);
  });
});

describe("summarizeTransactions", () => {
  test("이번 달 합계 (거래 저장 당시 snapshot 그대로 합산)", () => {
    const monthTransactions = filterByMonth(allTransactions, "2026-09");
    const summary = summarizeTransactions(monthTransactions);

    assert.equal(summary.totalAmount, 180_000); // 100,000 + 50,000 + 30,000
    assert.equal(summary.totalSettlementAmount, 72_000); // 40,000 + 20,000 + 12,000
    assert.equal(summary.transactionCount, 3);
    assert.equal(summary.averageAmount, 60_000); // 180,000 / 3
    assert.equal(summary.averageRate, 0.4); // 72,000 / 180,000
  });

  test("거래가 없으면 0으로 계산된다", () => {
    const summary = summarizeTransactions([]);
    assert.equal(summary.totalAmount, 0);
    assert.equal(summary.transactionCount, 0);
    assert.equal(summary.averageAmount, 0);
    assert.equal(summary.averageRate, 0);
  });
});

describe("J. combineFullPeriodSummary (거래 + 정액권 + 회원권 합산)", () => {
  test("월정산 합계에 회원권 이벤트 영향이 함께 더해진다", () => {
    const prepaidEvent: PrepaidEvent = {
      id: "p-evt-1",
      prepaidPassId: "pass-1",
      type: "PURCHASE",
      date: "2026-09-12",
      creditAmountImpact: 1_000_000,
      salesImpact: 1_000_000,
      settlementImpact: 400_000,
      commissionRateSnapshot: 0.4,
      createdAt: "2026-09-12T00:00:00.000Z",
    };
    const membershipEvent: MembershipEvent = {
      id: "m-evt-1",
      membershipPassId: "membership-1",
      type: "USE",
      date: "2026-09-12",
      countImpact: -1,
      salesImpact: 50_000,
      settlementImpact: 20_000,
      commissionRateSnapshot: 0.4,
      perUseAmountSnapshot: 50_000,
      createdAt: "2026-09-12T00:00:00.000Z",
    };

    const combined = combineFullPeriodSummary([sameDayTx1], [prepaidEvent], [membershipEvent]);

    // 거래(100,000/40,000) + 정액권(1,000,000/400,000) + 회원권(50,000/20,000)
    assert.equal(combined.totalAmount, 1_150_000);
    assert.equal(combined.totalSettlementAmount, 460_000);
    assert.equal(combined.membershipImpact.salesImpact, 50_000);
    assert.equal(combined.membershipImpact.settlementImpact, 20_000);
  });

  test("회원권 이벤트가 없으면 기존 combinePeriodSummary와 결과가 동일하다", () => {
    const combined = combineFullPeriodSummary([sameDayTx1], [], []);
    assert.equal(combined.totalAmount, 100_000);
    assert.equal(combined.totalSettlementAmount, 40_000);
    assert.equal(combined.membershipImpact.salesImpact, 0);
    assert.equal(combined.membershipImpact.settlementImpact, 0);
  });
});
