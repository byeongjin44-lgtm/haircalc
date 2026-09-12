// 일반 거래 + 정액권 이벤트를 함께 월별로 합산하는 통합 테스트.
// 홈/월정산 화면이 실제로 호출하는 combinePeriodSummary/filterByMonth/filterPrepaidEventsByMonth를
// 그대로 사용해, "이벤트 발생일 기준으로 해당 월에만 반영되고 과거 이벤트는 바뀌지 않는다"를 검증한다.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildTransactionSnapshot, createDefaultSettlementSettings } from "./engine.ts";
import {
  purchasePrepaidPass,
  useByOtherDesigner,
  useOwnPrepaidCredit,
} from "./prepaid.ts";
import {
  combinePeriodSummary,
  filterByMonth,
  filterPrepaidEventsByMonth,
} from "./summary.ts";

const NOW = "2026-09-01T00:00:00.000Z";

describe("A. 9월 일반매출 + 정액권 판매(SALE_IMMEDIATE)", () => {
  test("9월 총매출/정산액에 둘 다 더해진다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });

    const tx = buildTransactionSnapshot(
      {
        id: "tx-a",
        date: "2026-09-05",
        amount: 1_000_000,
        customerType: "OTHER",
        serviceType: "CUT",
        paymentType: "CASH",
        createdAt: NOW,
        updatedAt: NOW,
      },
      settings
    );
    assert.equal(tx.settlementAmount, 400_000);

    const { event: purchaseEvent } = purchasePrepaidPass(
      {
        id: "pass-a",
        purchaseDate: "2026-09-10",
        paidAmount: 1_000_000,
        creditAmount: 1_000_000,
        recognitionMode: "SALE_IMMEDIATE",
        bonusSettlementMode: "CREDIT_AMOUNT",
        createdAt: NOW,
      },
      settings
    );
    assert.equal(purchaseEvent.settlementImpact, 400_000);

    const septemberSummary = combinePeriodSummary(
      filterByMonth([tx], "2026-09"),
      filterPrepaidEventsByMonth([purchaseEvent], "2026-09")
    );

    assert.equal(septemberSummary.totalAmount, 2_000_000);
    assert.equal(septemberSummary.totalSettlementAmount, 800_000);
  });
});

describe("B. 10월 타디자이너 사용 환수 (9월 판매분)", () => {
  test("환수는 10월에만 반영되고 9월 합계는 바뀌지 않는다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });

    const { pass, event: purchaseEvent } = purchasePrepaidPass(
      {
        id: "pass-b",
        purchaseDate: "2026-09-10",
        paidAmount: 1_000_000,
        creditAmount: 1_000_000,
        recognitionMode: "SALE_IMMEDIATE",
        bonusSettlementMode: "CREDIT_AMOUNT",
        createdAt: NOW,
      },
      settings
    );

    const { event: otherUseEvent } = useByOtherDesigner(
      pass,
      { id: "evt-b", date: "2026-10-05", creditAmount: 200_000, createdAt: NOW },
      settings
    );

    assert.equal(otherUseEvent.salesImpact, -200_000);
    assert.equal(otherUseEvent.settlementImpact, -80_000);

    const allEvents = [purchaseEvent, otherUseEvent];

    const septemberSummary = combinePeriodSummary(
      [],
      filterPrepaidEventsByMonth(allEvents, "2026-09")
    );
    assert.equal(septemberSummary.totalAmount, 1_000_000); // 9월분은 그대로
    assert.equal(septemberSummary.totalSettlementAmount, 400_000);

    const octoberSummary = combinePeriodSummary(
      [],
      filterPrepaidEventsByMonth(allEvents, "2026-10")
    );
    assert.equal(octoberSummary.totalAmount, -200_000);
    assert.equal(octoberSummary.totalSettlementAmount, -80_000);
  });
});

describe("C. USE_BASED 구매 -> 다음 달 본인 사용", () => {
  test("구매월은 영향 없고, 사용월에만 매출/정산이 잡힌다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });

    const { pass, event: purchaseEvent } = purchasePrepaidPass(
      {
        id: "pass-c",
        purchaseDate: "2026-09-20",
        paidAmount: 500_000,
        creditAmount: 500_000,
        recognitionMode: "USE_BASED",
        bonusSettlementMode: "CREDIT_AMOUNT",
        createdAt: NOW,
      },
      settings
    );
    assert.equal(purchaseEvent.salesImpact, 0);
    assert.equal(purchaseEvent.settlementImpact, 0);

    const { event: useEvent } = useOwnPrepaidCredit(
      pass,
      { id: "evt-c", date: "2026-10-03", creditAmount: 200_000, createdAt: NOW },
      settings
    );

    const allEvents = [purchaseEvent, useEvent];

    const septemberSummary = combinePeriodSummary(
      [],
      filterPrepaidEventsByMonth(allEvents, "2026-09")
    );
    assert.equal(septemberSummary.totalAmount, 0);
    assert.equal(septemberSummary.totalSettlementAmount, 0);

    const octoberSummary = combinePeriodSummary(
      [],
      filterPrepaidEventsByMonth(allEvents, "2026-10")
    );
    assert.equal(octoberSummary.totalAmount, 200_000);
    assert.equal(octoberSummary.totalSettlementAmount, 80_000);
  });
});

describe("D. 보너스권 PAID_RATIO 본인 사용", () => {
  test("100만/110만 보너스권에서 22만원 사용 -> 매출 20만, 정산 +8만", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });

    const { pass } = purchasePrepaidPass(
      {
        id: "pass-d",
        purchaseDate: "2026-09-10",
        paidAmount: 1_000_000,
        creditAmount: 1_100_000,
        recognitionMode: "USE_BASED",
        bonusSettlementMode: "PAID_RATIO",
        createdAt: NOW,
      },
      settings
    );

    const { event: useEvent } = useOwnPrepaidCredit(
      pass,
      { id: "evt-d", date: "2026-09-15", creditAmount: 220_000, createdAt: NOW },
      settings
    );

    assert.equal(useEvent.salesImpact, 200_000);
    assert.equal(useEvent.settlementImpact, 80_000);

    const summary = combinePeriodSummary(
      [],
      filterPrepaidEventsByMonth([useEvent], "2026-09")
    );
    assert.equal(summary.totalAmount, 200_000);
    assert.equal(summary.totalSettlementAmount, 80_000);
  });
});
