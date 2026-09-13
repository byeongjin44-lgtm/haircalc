"use client";

import { useEffect, useState } from "react";
import { APP_NAME } from "@/lib/branding";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * 설치 가능한 Chrome/Android 환경에서만 실제 설치 버튼을 보여준다.
 * - standalone(이미 설치된 상태)이면 아무것도 보여주지 않는다.
 * - beforeinstallprompt를 못 받는 환경(iOS 등)에서는 깨진 버튼 대신 짧은 안내만 보여준다.
 * - appinstalled 이후에는 버튼을 숨긴다.
 */
export default function InstallPwaButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    // matchMedia는 브라우저 전용 외부 상태라 마운트 이후에 동기화해야 한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsStandalone(standaloneQuery.matches);

    function handleStandaloneChange(event: MediaQueryListEvent) {
      setIsStandalone(event.matches);
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }

    standaloneQuery.addEventListener("change", handleStandaloneChange);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      standaloneQuery.removeEventListener("change", handleStandaloneChange);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  }

  if (isStandalone || isInstalled) {
    return null;
  }

  if (deferredPrompt) {
    return (
      <button
        type="button"
        onClick={handleInstallClick}
        className="min-h-[48px] w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white"
      >
        {APP_NAME} 앱 설치
      </button>
    );
  }

  return (
    <p className="text-center text-xs text-zinc-400">
      브라우저 메뉴에서 앱 설치를 선택할 수 있습니다.
    </p>
  );
}
