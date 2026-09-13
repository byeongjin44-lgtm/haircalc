/** 입력 필드 바로 아래 표시하는 빨간 인라인 오류 문구. 값이 없으면 아무것도 렌더링하지 않는다. */
export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

/** 오류가 있는 입력/선택 요소에 붙일 테두리 클래스. 없으면 기본 테두리를 유지한다. */
export function fieldBorderClass(hasError: boolean | undefined): string {
  return hasError ? "border-red-500" : "border-zinc-200";
}
