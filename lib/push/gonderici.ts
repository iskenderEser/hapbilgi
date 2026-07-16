// lib/push/gonderici.ts
//
// Provider-agnostik push gönderimi (P4 — lib/sms/gonderici.ts'in ikizi, §2.7).
// `web-push` bir sağlayıcı SDK'sı değil, açık standart uygulamasıdır
// (RFC 8030 protokol, RFC 8292 VAPID imza, RFC 8291 yük şifreleme — K-P4);
// yine de transport bu dosyanın arkasında kalır: çağıranlar (orkestrasyon)
// yalnız pushGonder imzasını bilir, kütüphane değişse imza değişmez.
//
// K-P7: canlı olmayan ortamlarda gerçek gönderim YAPILMAZ — loglanır ve
// başarı döner (K-E8 SMS deseni). İkinci kilit: VAPID private key yalnız
// production env'de tanımlıdır; tanımsızsa canlıda da no-op kalır (C.8).

import webpush from "web-push";
import { SupabaseClient } from "@supabase/supabase-js";
import { canliOrtamMi } from "@/lib/utils/ortam";
import { abonelikPasifle } from "./abonelik";
import type { PushGonderimDurumu, PushYuku } from "./tipler";

// Gönderim hedefi: aktifAbonelikleriGetir'in döndürdüğü satır.
export interface PushHedefi {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// denemeliFetch deseni (lib/utils/aiIstemci.ts): geçici hatalarda exponential
// backoff, kalıcı hatalarda ilk denemede dön.
const GECICI_HATA_KODLARI = new Set([429, 500, 502, 503, 504]);
const OLU_ABONELIK_KODLARI = new Set([404, 410]); // K-P5
const MAX_DENEME = 3;
const BEKLEME_BASLANGIC_MS = 500;

function bekle(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// VAPID yapılandırması bir kez kurulur. Private key yoksa false —
// gönderim no-op (C.8: env tanımsızsa production'da sessiz kalır).
let vapidKuruldu: boolean | null = null;

function vapidHazirMi(): boolean {
  if (vapidKuruldu !== null) return vapidKuruldu;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    console.warn("[lib/push/gonderici] VAPID env eksik; push gönderimi no-op (C.8).");
    vapidKuruldu = false;
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidKuruldu = true;
  return true;
}

/**
 * Tek bir aboneliğe push gönderir; dönen durum push_gonderim_kayitlari.durum
 * sözleşmesidir (C.2). 404/410'da aboneliği pasifler (K-P5) ve retry etmez;
 * geçici hatalarda backoff'la yeniden dener; asla fırlatmaz (K-P3 —
 * push hatası çağıran iş akışını bozamaz).
 */
export async function pushGonder(
  adminSupabase: SupabaseClient,
  hedef: PushHedefi,
  yuk: PushYuku,
  ttlSaniye: number
): Promise<PushGonderimDurumu> {
  if (!canliOrtamMi()) {
    console.log(
      `[PUSH TEST] ${hedef.endpoint.slice(0, 60)}… → "${yuk.baslik}" (canlı dışı ortam, gönderilmedi — K-P7)`
    );
    return "gonderildi";
  }

  if (!vapidHazirMi()) return "basarisiz";

  const abonelik = {
    endpoint: hedef.endpoint,
    keys: { p256dh: hedef.p256dh, auth: hedef.auth },
  };
  const govde = JSON.stringify(yuk);

  for (let deneme = 1; deneme <= MAX_DENEME; deneme++) {
    try {
      await webpush.sendNotification(abonelik, govde, { TTL: ttlSaniye });
      return "gonderildi";
    } catch (hata) {
      const kod = (hata as { statusCode?: number })?.statusCode ?? 0;

      if (OLU_ABONELIK_KODLARI.has(kod)) {
        await abonelikPasifle(adminSupabase, hedef.endpoint);
        return "abonelik_olu";
      }

      if (GECICI_HATA_KODLARI.has(kod) && deneme < MAX_DENEME) {
        await bekle(BEKLEME_BASLANGIC_MS * 2 ** (deneme - 1));
        continue;
      }

      console.error(
        `[lib/push/gonderici] gönderim hatası (kod ${kod || "ağ"}, deneme ${deneme}):`,
        hata instanceof Error ? hata.message : hata
      );
      return "basarisiz";
    }
  }

  return "basarisiz";
}
