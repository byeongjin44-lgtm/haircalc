"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface ShowSuccessOptions {
  durationMs?: number;
}

interface SuccessState {
  id: number;
  message: string;
}

interface SuccessOverlayContextValue {
  showSuccess: (message: string, options?: ShowSuccessOptions) => void;
}

const SuccessOverlayContext = createContext<SuccessOverlayContextValue | null>(null);

const DEFAULT_DURATION_MS = 1500;

/**
 * 저장 성공을 화면 중앙 오버레이로 확실하게 보여준다 (외부 modal/toast 라이브러리 없음).
 * - [확인]을 누르면 즉시 닫힘, 아무 동작이 없으면 durationMs 후 자동으로 닫힘.
 * - 실패 시에는 절대 호출하지 않는다 (호출부에서 성공했을 때만 showSuccess를 부른다).
 */
export function SuccessOverlayProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SuccessState | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setState(null);
  }, []);

  const showSuccess = useCallback((message: string, options?: ShowSuccessOptions) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const id = Date.now();
    setState({ id, message });

    timeoutRef.current = setTimeout(() => {
      setState((current) => (current?.id === id ? null : current));
    }, options?.durationMs ?? DEFAULT_DURATION_MS);
  }, []);

  return (
    <SuccessOverlayContext.Provider value={{ showSuccess }}>
      {children}
      {state && (
        <div
          role="alertdialog"
          aria-live="assertive"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-6 backdrop-blur-sm"
        >
          <div className="flex w-full max-w-[320px] flex-col items-center gap-3 rounded-2xl bg-white p-6 text-center shadow-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-xl font-bold text-white">
              ✓
            </div>
            <p className="text-base font-semibold text-zinc-900">{state.message}</p>
            <button
              type="button"
              onClick={dismiss}
              className="mt-1 min-h-[48px] w-full rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </SuccessOverlayContext.Provider>
  );
}

export function useSuccessOverlay(): SuccessOverlayContextValue {
  const ctx = useContext(SuccessOverlayContext);
  if (!ctx) {
    throw new Error("useSuccessOverlay는 SuccessOverlayProvider 내부에서만 사용할 수 있습니다.");
  }
  return ctx;
}
