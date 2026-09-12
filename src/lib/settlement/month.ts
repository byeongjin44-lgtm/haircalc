// 월 단위 계산 유틸리티 (순수 함수). "YYYY-MM" 형태의 monthKey를 기준으로 동작한다.

import { todayDateString } from "./format.ts";

export function currentMonthKey(): string {
  return todayDateString().slice(0, 7);
}

export function monthKeyOf(date: string): string {
  return date.slice(0, 7);
}

/** monthKey에서 delta만큼 이동한 월을 반환한다 (연도 경계 포함). */
export function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const shifted = new Date(year, month - 1 + delta, 1);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function getDaysInMonth(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

/** 해당 월 1일의 요일 (0 = 일요일). 달력 그리드의 빈 칸 수를 정할 때 사용한다. */
export function getFirstWeekday(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).getDay();
}

export function buildDateString(monthKey: string, day: number): string {
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return `${year}년 ${month}월`;
}
