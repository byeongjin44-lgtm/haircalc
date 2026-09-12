import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildDateString,
  currentMonthKey,
  formatMonthLabel,
  getDaysInMonth,
  getFirstWeekday,
  monthKeyOf,
  shiftMonthKey,
} from "./month.ts";

describe("monthKeyOf", () => {
  test("날짜 문자열에서 월 키를 추출한다", () => {
    assert.equal(monthKeyOf("2026-09-12"), "2026-09");
  });
});

describe("shiftMonthKey", () => {
  test("같은 해 안에서 이동", () => {
    assert.equal(shiftMonthKey("2026-09", 1), "2026-10");
    assert.equal(shiftMonthKey("2026-09", -1), "2026-08");
  });

  test("연도 경계를 넘어가는 이동", () => {
    assert.equal(shiftMonthKey("2026-01", -1), "2025-12");
    assert.equal(shiftMonthKey("2025-12", 1), "2026-01");
  });
});

describe("getDaysInMonth", () => {
  test("31일까지 있는 달", () => {
    assert.equal(getDaysInMonth("2026-01"), 31);
  });

  test("평년 2월은 28일", () => {
    assert.equal(getDaysInMonth("2026-02"), 28);
  });

  test("윤년 2월은 29일", () => {
    assert.equal(getDaysInMonth("2024-02"), 29);
  });
});

describe("buildDateString / formatMonthLabel", () => {
  test("월 키와 일자로 날짜 문자열 조립", () => {
    assert.equal(buildDateString("2026-09", 5), "2026-09-05");
  });

  test("사람이 읽는 월 라벨", () => {
    assert.equal(formatMonthLabel("2026-09"), "2026년 9월");
  });
});

describe("currentMonthKey / getFirstWeekday", () => {
  test("currentMonthKey는 YYYY-MM 형식이다", () => {
    assert.match(currentMonthKey(), /^\d{4}-\d{2}$/);
  });

  test("getFirstWeekday는 0~6 범위다", () => {
    const weekday = getFirstWeekday("2026-09");
    assert.ok(weekday >= 0 && weekday <= 6);
  });
});
