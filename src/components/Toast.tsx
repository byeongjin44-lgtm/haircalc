"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ShowToastOptions {
  action?: ToastAction;
  durationMs?: number;
}

interface ToastState {
  id: number;
  message: string;
  action?: ToastAction;
}

interface ToastContextValue {
  showToast: (message: string, options?: ShowToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 1800;

/**
 * 가벼운 자체 Toast/Snackbar. 외부 라이브러리를 쓰지 않는다.
 * 하단 네비게이션과 겹치지 않도록 그 위쪽에 고정 표시하고, 화면 조작을 막지 않는다.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, options?: ShowToastOptions) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const id = Date.now();
    setToast({ id, message, action: options?.action });

    timeoutRef.current = setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, options?.durationMs ?? DEFAULT_DURATION_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 z-30 flex justify-center px-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))]"
        >
          <div className="flex w-full max-w-md items-center gap-3 rounded-xl bg-zinc-900 px-4 py-3 text-sm text-white shadow-lg">
            <span className="flex-1">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  setToast(null);
                }}
                className="shrink-0 font-semibold underline underline-offset-2"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast는 ToastProvider 내부에서만 사용할 수 있습니다.");
  }
  return ctx;
}
