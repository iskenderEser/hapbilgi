// public/sw.js
//
// HapBilgi Service Worker (P1 — hapbilgi_push_teknik_is_plani.md C.1/C.3).
// Tek görevi web push'tur: fetch/önbellek katmanı BİLEREK yok — uygulama
// davranışına karışmaz, yalnız site kapalıyken bildirim gösterir.
// Yük sözleşmesi lib/push/tipler.ts PushYuku'dur (K-P6 — PII taşımaz).

// Yeni SW sürümü beklemeden devralsın (push-only SW'de güvenli).
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let yuk;
  try {
    yuk = event.data.json();
  } catch {
    return; // sözleşme dışı yük — sessiz geç
  }

  const baslik = yuk.baslik || "HapBilgi";
  event.waitUntil(
    self.registration.showNotification(baslik, {
      body: yuk.govde || "",
      icon: yuk.icon || "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: yuk.url || "/" },
    })
  );
});

// Tıklama: açık bir HapBilgi sekmesi varsa ona odaklan ve hedefe götür,
// yoksa yeni pencere aç. Login değilse proxy zaten giriş ekranına yönlendirir.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((sekmeler) => {
      for (const sekme of sekmeler) {
        if (new URL(sekme.url).origin === self.location.origin && "focus" in sekme) {
          sekme.navigate(url);
          return sekme.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
