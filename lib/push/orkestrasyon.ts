// lib/push/orkestrasyon.ts
//
// PUSH ORKESTRASYON MERKEZİ (P5 — hapbilgi_push_teknik_is_plani.md C.1/C.3).
// Tek giriş: pushYayinla(olay, alıcılar). Akış:
//   olay aktif mi? (sistem_ayarlari) → alıcı başına rol (rolCozucu, gönderim
//   anında — K-P2) → role uygun içerik (icerik.ts, K-P10) → aktif abonelikler
//   → gönderim (gonderici.ts) → denetim kaydı (push_gonderim_kayitlari,
//   alici_rol snapshot'ıyla — kayıt-anı simetrisi, §2.5).
//
// K-P3: bu fonksiyon ASLA fırlatmaz — push hatası, çağıran iş akışını
// (in-app bildirim yazımı, durum geçişi) bozamaz; yalnız loglanır.
// Çağıranlar route yanıtını geciktirmemek için next/server after() içinde
// çağırır (K-P9 — çıplak fire-and-forget Vercel'de güvenli değildir).

import { after } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { aktifAbonelikleriGetir } from "./abonelik";
import { pushGonder } from "./gonderici";
import { icerikUret } from "./icerik";
import type { PushBaglami, PushGonderimDurumu, PushOlayTuru } from "./tipler";

const VARSAYILAN_TTL_SANIYE = 259200; // 3 gün — sistem_ayarlari yoksa güvenli varsayılan

interface PushAyarlari {
  ttlSaniye: number;
  olayAktifMi: boolean;
}

export interface PushYayinSonucu {
  aliciSayisi: number;
  abonelikSayisi: number;
  gonderilen: number;
  basarisiz: number;
  abonelikOlu: number;
  atlanan: number;
  hataKodu?: string;
}

async function ayarlariOku(
  adminSupabase: SupabaseClient,
  olayTuru: PushOlayTuru
): Promise<PushAyarlari> {
  const { data, error } = await adminSupabase
    .from("sistem_ayarlari")
    .select("anahtar, deger")
    .in("anahtar", ["push_ttl_saniye", "push_olay_aktif"]);

  if (error || !data) {
    // Ayar okunamazsa güvenli varsayılan: olay açık, TTL 3 gün.
    if (error) console.error("[lib/push/orkestrasyon] sistem_ayarlari okunamadı:", error.message);
    return { ttlSaniye: VARSAYILAN_TTL_SANIYE, olayAktifMi: true };
  }

  const ttlHam = data.find((a) => a.anahtar === "push_ttl_saniye")?.deger;
  const olayHam = data.find((a) => a.anahtar === "push_olay_aktif")?.deger as
    | Record<string, boolean>
    | undefined;

  return {
    ttlSaniye: typeof ttlHam === "number" && ttlHam > 0 ? ttlHam : VARSAYILAN_TTL_SANIYE,
    // Anahtar haritada yoksa açık sayılır (yeni olay eklerken ayar unutulsa push susmaz).
    olayAktifMi: olayHam?.[olayTuru] !== false,
  };
}

/**
 * Bir olayı verilen alıcılara push olarak yayınlar.
 * aliciAuthIdler: auth_user_id listesi — null/undefined/tekrar temizlenir
 * (K-P2 NULL kuralı: giriş kimliği olmayan alıcı sessizce atlanır).
 */
async function pushYayinlaIsle(
  adminSupabase: SupabaseClient,
  olayTuru: PushOlayTuru,
  aliciAuthIdler: (string | null | undefined)[],
  baglam: PushBaglami = {}
): Promise<PushYayinSonucu> {
  const sonuc: PushYayinSonucu = {
    aliciSayisi: 0,
    abonelikSayisi: 0,
    gonderilen: 0,
    basarisiz: 0,
    abonelikOlu: 0,
    atlanan: 0,
  };
  try {
    const alicilar = [...new Set(aliciAuthIdler.filter((id): id is string => !!id))];
    sonuc.aliciSayisi = alicilar.length;
    if (alicilar.length === 0) return sonuc;

    const ayarlar = await ayarlariOku(adminSupabase, olayTuru);
    if (!ayarlar.olayAktifMi) return { ...sonuc, atlanan: alicilar.length, hataKodu: "PUSH_OLAY_KAPALI" };

    const kayitlar: {
      auth_user_id: string;
      olay_turu: PushOlayTuru;
      alici_rol: string;
      durum: PushGonderimDurumu;
    }[] = [];

    for (const alici of alicilar) {
      const rol = await rolCozucu(adminSupabase, alici);
      const yuk = icerikUret(olayTuru, rol, baglam);
      if (!yuk) {
        sonuc.atlanan += 1;
        continue; // rol bu olayı almaz (icerik.ts tek kaynak — K-P10)
      }

      const abonelikler = await aktifAbonelikleriGetir(adminSupabase, alici);
      sonuc.abonelikSayisi += abonelikler.length;
      for (const abonelik of abonelikler) {
        const durum = await pushGonder(adminSupabase, abonelik, yuk, ayarlar.ttlSaniye);
        sonuc[durum === "gonderildi" ? "gonderilen" : durum === "abonelik_olu" ? "abonelikOlu" : "basarisiz"] += 1;
        kayitlar.push({ auth_user_id: alici, olay_turu: olayTuru, alici_rol: rol, durum });
      }
    }

    if (kayitlar.length > 0) {
      const { error } = await adminSupabase.from("push_gonderim_kayitlari").insert(kayitlar);
      if (error) console.error("[lib/push/orkestrasyon] gönderim kaydı yazılamadı:", error.message);
    }
    return sonuc;
  } catch (hata) {
    // K-P3 — push asla iş akışını bozmaz.
    console.error("[lib/push/orkestrasyon] pushYayinla hatası:", hata);
    return { ...sonuc, hataKodu: "PUSH_ISLEM_HATASI" };
  }
}

export async function pushYayinla(
  adminSupabase: SupabaseClient,
  olayTuru: PushOlayTuru,
  aliciAuthIdler: (string | null | undefined)[],
  baglam: PushBaglami = {}
): Promise<void> {
  await pushYayinlaIsle(adminSupabase, olayTuru, aliciAuthIdler, baglam);
}

/** Kuyruk worker'larının teslimat sonucunu doğrulayabilmesi için özet döndürür. */
export function pushYayinlaSonuclu(
  adminSupabase: SupabaseClient,
  olayTuru: PushOlayTuru,
  aliciAuthIdler: (string | null | undefined)[],
  baglam: PushBaglami = {}
): Promise<PushYayinSonucu> {
  return pushYayinlaIsle(adminSupabase, olayTuru, aliciAuthIdler, baglam);
}

// ─────────────────────────────────────────────────────────────────────────
// after() sarmalayıcıları (K-P9): route yanıtını geciktirmeden, yanıt
// sonrası işin tamamlanmasını platforma garanti ettirir. Request scope
// dışında (script/cron) after() fırlatır — o durumda düz await'e düşülür
// (orada process zaten yaşamaya devam eder).
// ─────────────────────────────────────────────────────────────────────────

function arkada(is: () => Promise<void>): void {
  try {
    after(is);
  } catch {
    void is();
  }
}

/** pushYayinla'nın yanıt-sonrası (after) sarmalanmış hali — P6 çağıranların varsayılanı. */
export function pushYayinlaArkada(
  adminSupabase: SupabaseClient,
  olayTuru: PushOlayTuru,
  aliciAuthIdler: (string | null | undefined)[],
  baglam: PushBaglami = {}
): void {
  arkada(() => pushYayinla(adminSupabase, olayTuru, aliciAuthIdler, baglam));
}

/** E-Club kişi id'leriyle yayın: kisi_id → auth_user_id köprüsü içeride kurulur. */
export function pushYayinlaEclubKisilereArkada(
  adminSupabase: SupabaseClient,
  olayTuru: PushOlayTuru,
  kisiIdler: string[],
  baglam: PushBaglami = {}
): void {
  arkada(async () =>
    pushYayinla(adminSupabase, olayTuru, await eclubKisiAuthIdCoz(adminSupabase, kisiIdler), baglam)
  );
}

/** Eczanem müşteri id'leriyle yayın (K-P3 istisnası çağıranları için köprü). */
export function pushYayinlaEczanemMusterilereArkada(
  adminSupabase: SupabaseClient,
  olayTuru: PushOlayTuru,
  musteriIdler: string[],
  baglam: PushBaglami = {}
): void {
  arkada(async () =>
    pushYayinla(adminSupabase, olayTuru, await eczanemMusteriAuthIdCoz(adminSupabase, musteriIdler), baglam)
  );
}

/** Bir eczanenin aktif kişilerine (eczacı/teknisyen) yayın — sipariş onay bekliyor akışı. */
export function pushYayinlaEczaneKisilerineArkada(
  adminSupabase: SupabaseClient,
  olayTuru: PushOlayTuru,
  eczaneId: string
): void {
  arkada(async () =>
    pushYayinla(adminSupabase, olayTuru, await eczaneKisiAuthIdCoz(adminSupabase, eczaneId))
  );
}

/**
 * E-Club kişi id'lerini auth_user_id'ye çevirir (P6 — eclubBildirim köprüsü).
 * auth_user_id'si NULL olanlar (giriş kimliği kazanmamış kişiler) K-P2
 * kuralı gereği sessizce elenir.
 */
export async function eclubKisiAuthIdCoz(
  adminSupabase: SupabaseClient,
  kisiIdler: string[]
): Promise<string[]> {
  if (kisiIdler.length === 0) return [];

  const { data, error } = await adminSupabase
    .from("eclub_kisiler")
    .select("auth_user_id")
    .in("kisi_id", kisiIdler);

  if (error || !data) {
    if (error) console.error("[lib/push/orkestrasyon] eclub kişi çözümü hatası:", error.message);
    return [];
  }

  return data
    .map((k) => k.auth_user_id as string | null)
    .filter((id): id is string => !!id);
}

/**
 * Eczanem müşteri id'lerini auth_user_id'ye çevirir (K-P2 NULL kuralı geçerli).
 */
export async function eczanemMusteriAuthIdCoz(
  adminSupabase: SupabaseClient,
  musteriIdler: string[]
): Promise<string[]> {
  if (musteriIdler.length === 0) return [];

  const { data, error } = await adminSupabase
    .from("eczanem_musteriler")
    .select("auth_user_id")
    .in("musteri_id", musteriIdler);

  if (error || !data) {
    if (error) console.error("[lib/push/orkestrasyon] müşteri çözümü hatası:", error.message);
    return [];
  }

  return data
    .map((m) => m.auth_user_id as string | null)
    .filter((id): id is string => !!id);
}

/**
 * Bir eczanenin aktif kişilerinin (eczacı/teknisyen) auth_user_id'lerini döner.
 * eclub_kisi_eczane (aktif bağ) → eclub_kisiler.auth_user_id.
 */
export async function eczaneKisiAuthIdCoz(
  adminSupabase: SupabaseClient,
  eczaneId: string
): Promise<string[]> {
  const { data, error } = await adminSupabase
    .from("eclub_kisi_eczane")
    .select("eclub_kisiler(auth_user_id)")
    .eq("eczane_id", eczaneId)
    .eq("aktif_mi", true);

  if (error || !data) {
    if (error) console.error("[lib/push/orkestrasyon] eczane kişi çözümü hatası:", error.message);
    return [];
  }

  // Supabase join'i tekil ilişkide de dizi tipleyebilir — iki biçim de ele alınır.
  return data
    .flatMap((satir) => {
      const kisi = satir.eclub_kisiler as unknown;
      const liste = Array.isArray(kisi) ? kisi : kisi ? [kisi] : [];
      return liste.map((k) => (k as { auth_user_id: string | null }).auth_user_id);
    })
    .filter((id): id is string => !!id);
}
