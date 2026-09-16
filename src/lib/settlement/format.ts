/** UI의 "%" 입력 문자열을 0~1 비율로 변환한다. 파싱 실패 시 fallback을 반환한다. */
export function percentToRate(percentText: string, fallback = 0): number {
  const value = Number(percentText);
  if (!Number.isFinite(value)) return fallback;
  return value / 100;
}

/** 0~1 비율을 "%" 입력창에 표시할 문자열로 변환한다 (부동소수점 오차 제거). */
export function rateToPercent(rate: number): string {
  return String(Math.round(rate * 100 * 100) / 100);
}

/** 값이 숫자가 아니면 min으로, 범위를 벗어나면 min/max로 잘라낸다 (폼 레벨 입력 방어용). */
export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function formatWon(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

/** 부호를 항상 표시하는 금액 표기 (정액권 조정/환수처럼 +/-가 중요한 값에 사용). */
export function formatSignedWon(amount: number): string {
  if (amount === 0) return "0원";
  const sign = amount > 0 ? "+" : "-";
  return `${sign}${Math.abs(amount).toLocaleString("ko-KR")}원`;
}

/** 달력 셀처럼 좁은 공간에 쓰는 "만원" 단위 축약 표기 (예: 580,000 -> "58만"). */
export function formatManWon(amount: number): string {
  if (amount === 0) return "-";
  const man = Math.round((amount / 10_000) * 10) / 10;
  return `${man}만`;
}

/**
 * 정액권 등록 화면의 "보너스 빠른 선택" 계산. 실결제금액에 보너스율을 적용해
 * 사용가능금액을 원 단위 정수로 계산한다. bonusRate 자체는 UI 편의값일 뿐 저장되지 않는다.
 */
export function applyBonusRate(paidAmount: number, bonusRate: number): number {
  return Math.round(paidAmount * (1 + bonusRate));
}

/**
 * 금액 입력창의 "첫자리 선행 0"만 제거한다 (예: "00010000" -> "10000"). 중간/끝의 0과
 * 소수점 이하는 그대로 둔다 ("0.5" -> "0.5", "100" -> "100"). 빈 문자열/단독 "0"은 사용자가
 * 아직 입력 중일 수 있는 정상 상태라 그대로 둔다 — 금액 input마다 제각각 regex를 새로 쓰지
 * 않고 이 helper 하나만 재사용한다.
 */
export function normalizeAmountInput(value: string): string {
  if (value === "") return value;
  return value.replace(/^0+(?=\d)/, "");
}

/** 로컬 타임존 기준 오늘 날짜 (YYYY-MM-DD). new Date().toISOString()은 UTC 기준이라 자정 근처에 날짜가 하루 밀릴 수 있다. */
export function todayDateString(): string {
  const now = new Date();
  const localTime = now.getTime() - now.getTimezoneOffset() * 60_000;
  return new Date(localTime).toISOString().slice(0, 10);
}
