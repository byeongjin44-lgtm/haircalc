import type { PrepaidEvent, MembershipEvent } from "./types.ts";
export const PASS_DELETE_BLOCKED = "이미 사용/환불/조정 내역이 있는 이용권입니다. 정산 기록 보존을 위해 이용권을 삭제할 수 없습니다.";
export function hasPassActivity(events: readonly (PrepaidEvent | MembershipEvent)[]): boolean {
  return events.some(event => event.type !== "PURCHASE");
}
export function assertPassDeletable(events: readonly (PrepaidEvent | MembershipEvent)[]): void {
  if (hasPassActivity(events)) throw new Error(PASS_DELETE_BLOCKED);
}
