import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  calculateSettlement,
  buildTransactionSnapshot,
  createDefaultSettlementSettings,
} from "./engine.ts";

describe("기본 인센티브", () => {
  test("공제 없이 기본 인센티브율만 적용", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const result = calculateSettlement(100_000, "OTHER", "CASH", settings);

    assert.equal(result.settlementBaseAmount, 100_000);
    assert.equal(result.commissionRate, 0.4);
    assert.equal(result.settlementAmount, 40_000);
    assert.equal(result.estimatedPayoutAmount, 40_000);
  });
});

describe("고객유형별 인센티브", () => {
  const settings = createDefaultSettlementSettings({
    baseIncentiveRate: 0.4,
    customerTypeRates: { NEW: 0.35, RETURNING: 0.4, DESIGNATED: 0.45 },
  });

  test("신규 35%", () => {
    const result = calculateSettlement(100_000, "NEW", "CASH", settings);
    assert.equal(result.settlementAmount, 35_000);
  });

  test("재방문 40%", () => {
    const result = calculateSettlement(100_000, "RETURNING", "CASH", settings);
    assert.equal(result.settlementAmount, 40_000);
  });

  test("지정 45%", () => {
    const result = calculateSettlement(100_000, "DESIGNATED", "CASH", settings);
    assert.equal(result.settlementAmount, 45_000);
  });

  test("설정에 없는 유형(기타)은 기본 인센티브율로 폴백", () => {
    const result = calculateSettlement(100_000, "OTHER", "CASH", settings);
    assert.equal(result.settlementAmount, 40_000);
  });
});

describe("VAT 처리", () => {
  test("공제 없음", () => {
    const settings = createDefaultSettlementSettings({ vatMode: "NONE" });
    const result = calculateSettlement(100_000, "OTHER", "CASH", settings);
    assert.equal(result.vatDeduction, 0);
    assert.equal(result.supplyAmount, 100_000);
  });

  test("결제금액의 10% 단순 차감", () => {
    const settings = createDefaultSettlementSettings({ vatMode: "SIMPLE_10_PERCENT" });
    const result = calculateSettlement(100_000, "OTHER", "CASH", settings);
    assert.equal(result.vatDeduction, 10_000);
    assert.equal(result.supplyAmount, 90_000);
    assert.equal(result.settlementAmount, 36_000); // 90,000 * 0.4
  });

  test("VAT 포함금액 -> 공급가액 환산 (MASTER 예시: 110,000 / 1.1 = 100,000)", () => {
    const settings = createDefaultSettlementSettings({ vatMode: "SUPPLY_CONVERSION" });
    const result = calculateSettlement(110_000, "OTHER", "CASH", settings);
    assert.equal(result.vatDeduction, 10_000);
    assert.equal(result.supplyAmount, 100_000);
    assert.equal(result.settlementAmount, 40_000); // 100,000 * 0.4
  });
});

describe("카드수수료", () => {
  const settings = createDefaultSettlementSettings({
    cardFee: { enabled: true, rate: 0.02 },
  });

  test("결제수단이 카드면 수수료가 공제된다", () => {
    const result = calculateSettlement(100_000, "OTHER", "CARD", settings);
    assert.equal(result.paymentFee, 2_000);
    assert.equal(result.settlementBaseAmount, 98_000);
    assert.equal(result.settlementAmount, 39_200);
  });

  test("결제수단이 카드가 아니면 수수료가 적용되지 않는다", () => {
    const result = calculateSettlement(100_000, "OTHER", "CASH", settings);
    assert.equal(result.paymentFee, 0);
    assert.equal(result.settlementAmount, 40_000);
  });
});

describe("재료비", () => {
  test("비율(%) 방식", () => {
    const settings = createDefaultSettlementSettings({
      materialCost: { mode: "PERCENT", value: 0.05 },
    });
    const result = calculateSettlement(100_000, "OTHER", "CASH", settings);
    assert.equal(result.materialCost, 5_000);
    assert.equal(result.settlementAmount, 38_000); // (100,000 - 5,000) * 0.4
  });

  test("고정금액 방식", () => {
    const settings = createDefaultSettlementSettings({
      materialCost: { mode: "FIXED", value: 8_000 },
    });
    const result = calculateSettlement(100_000, "OTHER", "CASH", settings);
    assert.equal(result.materialCost, 8_000);
    assert.equal(result.settlementAmount, 36_800); // (100,000 - 8,000) * 0.4
  });
});

describe("3.3% 원천징수 ON/OFF", () => {
  test("OFF: 예상 지급액 == 정산액", () => {
    const settings = createDefaultSettlementSettings({ withholding3_3: false });
    const result = calculateSettlement(100_000, "OTHER", "CASH", settings);
    assert.equal(result.settlementAmount, 40_000);
    assert.equal(result.estimatedPayoutAmount, 40_000);
    assert.equal(result.withholding3_3Applied, false);
  });

  test("ON: 정산액의 96.7%를 예상 지급액으로 계산", () => {
    const settings = createDefaultSettlementSettings({ withholding3_3: true });
    const result = calculateSettlement(100_000, "OTHER", "CASH", settings);
    assert.equal(result.settlementAmount, 40_000);
    assert.equal(result.estimatedPayoutAmount, 38_680); // 40,000 * (1 - 0.033)
    assert.equal(result.withholding3_3Applied, true);
  });
});

describe("복합 케이스", () => {
  test("지정고객 + 공급가액환산 + 카드수수료 + 재료비 고정 + 3.3% ON", () => {
    const settings = createDefaultSettlementSettings({
      baseIncentiveRate: 0.4,
      customerTypeRates: { DESIGNATED: 0.45 },
      vatMode: "SUPPLY_CONVERSION",
      cardFee: { enabled: true, rate: 0.03 },
      materialCost: { mode: "FIXED", value: 5_000 },
      withholding3_3: true,
    });

    const result = calculateSettlement(110_000, "DESIGNATED", "CARD", settings);

    assert.equal(result.vatDeduction, 10_000); // 110,000 - 100,000
    assert.equal(result.supplyAmount, 100_000);
    assert.equal(result.materialCost, 5_000);
    assert.equal(result.paymentFee, 3_300); // 110,000 * 0.03
    assert.equal(result.settlementBaseAmount, 91_700); // 100,000 - 5,000 - 3,300
    assert.equal(result.commissionRate, 0.45);
    assert.equal(result.settlementAmount, 41_265); // 91,700 * 0.45
    assert.equal(result.estimatedPayoutAmount, 39_903); // round(41,265 * 0.967)
  });
});

describe("거래 저장 시 snapshot 고정", () => {
  test("이후 설정이 바뀌어도 이미 만든 Transaction 값은 변하지 않는다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });

    const tx = buildTransactionSnapshot(
      {
        id: "tx-1",
        date: "2026-09-12",
        amount: 100_000,
        customerType: "OTHER",
        serviceType: "CUT",
        paymentType: "CASH",
        createdAt: "2026-09-12T00:00:00.000Z",
        updatedAt: "2026-09-12T00:00:00.000Z",
      },
      settings
    );

    assert.equal(tx.commissionRateSnapshot, 0.4);
    assert.equal(tx.settlementAmount, 40_000);

    // 설정 변경 (인센티브율 90%로) -- 이미 생성된 tx에는 영향이 없어야 한다.
    settings.baseIncentiveRate = 0.9;

    assert.equal(tx.commissionRateSnapshot, 0.4);
    assert.equal(tx.settlementAmount, 40_000);
  });
});
