"use client";

import { useCallback, useRef } from "react";

/**
 * 저장 실패(validation 오류) 시, 화면에서 가장 위에 있는 첫 번째 오류 필드로
 * scrollIntoView + focus를 함께 수행하기 위한 공용 hook. 폼마다 새로 만들지 않고
 * 이 hook 하나를 재사용한다.
 *
 * 사용법:
 * 1. `register(key)`를 input/select의 ref로 연결한다. ChoiceGroup처럼 버튼 여러 개로
 *    이루어진 커스텀 필드는 감싸는 wrapper(`tabIndex={-1}`)를 register 대상으로 쓴다.
 * 2. 저장 시도 후 오류가 있으면 `focusFirstError(errors, fieldOrder)`를 호출한다.
 *    fieldOrder는 화면에 보이는 순서(위→아래)와 반드시 일치해야 한다.
 */
export function useFieldRefs<K extends string>() {
  const refs = useRef<Partial<Record<K, HTMLElement | null>>>({});

  const register = useCallback(
    (key: K) => (el: HTMLElement | null) => {
      refs.current[key] = el;
    },
    []
  );

  const focusFirstError = useCallback(
    (errors: Partial<Record<K, string | undefined>>, fieldOrder: readonly K[]) => {
      const firstErrorKey = fieldOrder.find((key) => errors[key]);
      if (!firstErrorKey) return;

      const el = refs.current[firstErrorKey];
      if (!el) return;

      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus({ preventScroll: true });
    },
    []
  );

  return { register, focusFirstError };
}
