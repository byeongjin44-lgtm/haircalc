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

/** 로컬 타임존 기준 오늘 날짜 (YYYY-MM-DD). new Date().toISOString()은 UTC 기준이라 자정 근처에 날짜가 하루 밀릴 수 있다. */
export function todayDateString(): string {
  const now = new Date();
  const localTime = now.getTime() - now.getTimezoneOffset() * 60_000;
  return new Date(localTime).toISOString().slice(0, 10);
}
