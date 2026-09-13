"use client";

import { useEffect } from "react";

/**
 * PWA 설치 요건 충족을 위한 최소 Service Worker 등록.
 * public/sw.js는 캐싱 없이 네트워크로 그대로 전달만 하므로 IndexedDB 데이터에 영향이 없다.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // 등록 실패해도 앱 사용 자체에는 지장이 없다 (설치 배너만 뜨지 않을 수 있음).
    });
  }, []);

  return null;
}
