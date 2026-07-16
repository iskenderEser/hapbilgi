// lib/push/istemci.ts
//
// PUSH İSTEMCİ AKIŞI (P2 — hapbilgi_push_teknik_is_plani.md).
// Tarayıcı tarafının tek kaynağı: SW kaydı, izin, abonelik ve sunucuya
// bildirme burada yaşar. Yalnız client bileşenlerinden çağrılır
// (browser API'leri kullanır); sunucu tarafında import edilmez.
//
// Abone olmak rol-agnostiktir (K-P11): burada rol/kimlik düzlemi bilgisi
// YOKTUR — sunucu, aboneliği oturumdaki auth_user_id'ye kendisi bağlar.

import type { TarayiciAboneligi } from "./tipler";

const ABONELIK_API = "/api/push/abonelik";

export type PushIzinDurumu = "granted" | "denied" | "default" | "desteklenmiyor";

export function pushDestekliMi(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function mevcutIzin(): PushIzinDurumu {
  if (!pushDestekliMi()) return "desteklenmiyor";
  return Notification.permission;
}

// VAPID public key'i (base64url) pushManager.subscribe'ın istediği
// Uint8Array biçimine çevirir — Web Push standardının bilinen dönüşümü.
function vapidAnahtarCoz(base64url: string): Uint8Array {
  const dolgu = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + dolgu).replace(/-/g, "+").replace(/_/g, "/");
  const ham = atob(base64);
  return Uint8Array.from(ham, (k) => k.charCodeAt(0));
}

async function swHazirla(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

// Mevcut aboneliği döner, yoksa yenisini açar.
async function abonelikEdin(kayit: ServiceWorkerRegistration): Promise<PushSubscription> {
  const mevcut = await kayit.pushManager.getSubscription();
  if (mevcut) return mevcut;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY tanımsız.");

  return kayit.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidAnahtarCoz(publicKey) as BufferSource,
  });
}

function teleCevir(abonelik: PushSubscription): TarayiciAboneligi {
  const json = abonelik.toJSON();
  return {
    endpoint: json.endpoint ?? "",
    keys: {
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
    },
  };
}

async function sunucuyaYaz(abonelik: PushSubscription): Promise<boolean> {
  const yanit = await fetch(ABONELIK_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(teleCevir(abonelik)),
  });
  return yanit.ok;
}

/**
 * İzin ister (gerekirse) ve aboneliği açıp sunucuya kaydeder.
 * Yumuşak izin kartındaki "İzin ver" butonundan çağrılır.
 * Dönen değer izin sonucudur; "denied" dönerse bir daha zorlanmaz.
 */
export async function aboneOlVeKaydet(): Promise<PushIzinDurumu> {
  if (!pushDestekliMi()) return "desteklenmiyor";

  const izin = await Notification.requestPermission();
  if (izin !== "granted") return izin;

  try {
    const kayit = await swHazirla();
    const abonelik = await abonelikEdin(kayit);
    await sunucuyaYaz(abonelik);
  } catch (hata) {
    // Push best-effort'tur (K-P3): abonelik hatası uygulamayı bozmaz.
    console.warn("[lib/push/istemci] abonelik açılamadı:", hata);
  }
  return "granted";
}

/**
 * Her app-load'da çağrılır (izin zaten verilmişse): aboneliği sessizce
 * tazeler — endpoint rotasyonuna karşı upsert (K-P5). UI göstermez.
 */
export async function aboneligiTazele(): Promise<void> {
  if (!pushDestekliMi() || Notification.permission !== "granted") return;

  try {
    const kayit = await swHazirla();
    const abonelik = await abonelikEdin(kayit);
    await sunucuyaYaz(abonelik);
  } catch (hata) {
    console.warn("[lib/push/istemci] abonelik tazelenemedi:", hata);
  }
}

/**
 * Kullanıcı tarayıcıdan izni geri çekmişse sunucudaki aboneliği pasifler
 * (C.5 — izin geri çekme algısı). Endpoint bilinmediğinden (izin yokken
 * getSubscription null döner) sunucu, oturum sahibinin TÜM aboneliklerini
 * pasifleyemez — yalnız bu tarayıcıda saklı endpoint gönderilebilseydi
 * nokta atışı olurdu; pratik çözüm: sunucu tarafı ölü budama (K-P5)
 * kalan uçları zaten düşürür. Burada yalnız SW'deki artık abonelik varsa
 * kapatılır.
 */
export async function aboneligiPasifle(): Promise<void> {
  if (!pushDestekliMi()) return;

  try {
    const kayit = await navigator.serviceWorker.getRegistration("/sw.js");
    const abonelik = await kayit?.pushManager.getSubscription();
    if (!abonelik) return;

    await fetch(ABONELIK_API, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: abonelik.endpoint }),
    });
    await abonelik.unsubscribe();
  } catch (hata) {
    console.warn("[lib/push/istemci] abonelik pasifleme hatası:", hata);
  }
}
