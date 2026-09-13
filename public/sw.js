// 최소 Service Worker. 캐싱 전략 없음 — 모든 요청을 그대로 네트워크로 전달한다.
// IndexedDB 데이터 안전성을 위해 오프라인 캐싱/프리캐시는 v0.1에서 도입하지 않는다.
// (PWA 설치 요건 중 "활성 Service Worker 존재"만 충족하는 목적)

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
