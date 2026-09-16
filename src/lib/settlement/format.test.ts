import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { applyBonusRate, normalizeAmountInput } from "./format.ts";

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

describe("K. normalizeAmountInput (금액 입력 선행 0 제거)", () => {
  test("첫자리에 쌓인 0을 제거한다", () => {
    assert.equal(normalizeAmountInput("00010000"), "10000");
  });

  test("선행 0 하나만 있어도 제거한다", () => {
    assert.equal(normalizeAmountInput("0500"), "500");
  });

  test("이미 정상적인 값은 그대로 둔다", () => {
    assert.equal(normalizeAmountInput("10"), "10");
    assert.equal(normalizeAmountInput("100"), "100");
  });

  test("단독 0은 그대로 둔다 (아직 입력 중일 수 있음)", () => {
    assert.equal(normalizeAmountInput("0"), "0");
  });

  test("빈 문자열은 그대로 둔다", () => {
    assert.equal(normalizeAmountInput(""), "");
  });

  test("중간/끝의 0은 건드리지 않는다", () => {
    assert.equal(normalizeAmountInput("1000"), "1000");
    assert.equal(normalizeAmountInput("2000000"), "2000000");
  });

  test("소수점 이하 0은 그대로 둔다", () => {
    assert.equal(normalizeAmountInput("0.5"), "0.5");
  });
});
