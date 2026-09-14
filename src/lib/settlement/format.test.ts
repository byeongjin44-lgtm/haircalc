import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { applyBonusRate } from "./format.ts";

describe("B. applyBonusRate (정액권 등록 화면 보너스 빠른 선택)", () => {
  test("100만원 + 10% -> 110만원", () => {
    assert.equal(applyBonusRate(1_000_000, 0.1), 1_100_000);
  });

  test("보너스 없음(0%)이면 실결제금액과 동일", () => {
    assert.equal(applyBonusRate(1_000_000, 0), 1_000_000);
  });

  test("소수점은 원 단위로 반올림된다", () => {
    assert.equal(applyBonusRate(333_333, 0.05), Math.round(333_333 * 1.05));
  });
});
