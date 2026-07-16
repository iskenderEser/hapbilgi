// lib/utils/bildirimOlustur.ts
import { SupabaseClient } from "@supabase/supabase-js";
import {
  talepBilgisiSenaryo,
  talepBilgisiVideo,
  talepBilgisiSoruSeti,
} from "./talepZinciri";
import { pushYayinlaArkada } from "@/lib/push/orkestrasyon";
import type { PushOlayTuru } from "@/lib/push/tipler";

type KayitTuru = "talep" | "senaryo" | "video" | "soru_seti" | "yayin" | "oneri" | "challenge";

// In-app bildirim türü → push olayı (P6, K-P3: push in-app yazımın yan
// etkisidir; alici_id = kullanici_id = auth id olduğundan doğrudan geçer).
const PUSH_OLAY_ESLEME: Record<KayitTuru, PushOlayTuru> = {
  talep: "uretim_durum_gecisi",
  senaryo: "uretim_durum_gecisi",
  video: "uretim_durum_gecisi",
  soru_seti: "uretim_durum_gecisi",
  yayin: "video_yayini",
  oneri: "video_onerisi",
  challenge: "challenge",
};

interface BildirimParams {
  adminSupabase: SupabaseClient;
  alici_id: string;
  gonderen_id?: string | null;
  kayit_turu: KayitTuru;
  kayit_id: string;
  mesaj: string;
}

/**
 * Verilen kayit_turu + kayit_id'den, bağlı olduğu talep_id'yi bulur.
 * Zincir yürüme işi talepZinciri.ts'e devredilmiştir.
 * 'oneri', 'yayin' ve 'challenge' için talep zinciri kullanılmaz, null döner.
 */
async function talepIdBul(
  adminSupabase: SupabaseClient,
  kayit_turu: KayitTuru,
  kayit_id: string
): Promise<string | null> {
  try {
    if (kayit_turu === "talep") return kayit_id;
    if (kayit_turu === "senaryo") {
      const b = await talepBilgisiSenaryo(adminSupabase, kayit_id);
      return b?.talep_id ?? null;
    }
    if (kayit_turu === "video") {
      const b = await talepBilgisiVideo(adminSupabase, kayit_id);
      return b?.talep_id ?? null;
    }
    if (kayit_turu === "soru_seti") {
      const b = await talepBilgisiSoruSeti(adminSupabase, kayit_id);
      return b?.talep_id ?? null;
    }
    return null;
  } catch (err) {
    console.error("[BİLDİRİM] talep_id bulunamadı:", { kayit_turu, kayit_id, err });
    return null;
  }
}

/**
 * Gönderen kullanıcının, belirli bir talep_id'ye bağlı tüm okunmamış
 * bildirimlerini (talep, senaryo, video, soru_seti, yayin — hepsi) okundu yapar.
 */
async function gonderenTalepBildirimleriOkunduYap(
  adminSupabase: SupabaseClient,
  gonderen_id: string,
  talep_id: string
): Promise<void> {
  try {
    const ilgili_idler: string[] = [talep_id];

    const { data: senaryolar } = await adminSupabase
      .from("senaryolar")
      .select("senaryo_id")
      .eq("talep_id", talep_id);
    const senaryo_idler = (senaryolar ?? []).map((s: any) => s.senaryo_id);
    ilgili_idler.push(...senaryo_idler);

    let senaryo_durum_idler: string[] = [];
    if (senaryo_idler.length > 0) {
      const { data: senaryoDurumlari } = await adminSupabase
        .from("senaryo_durumu")
        .select("senaryo_durum_id")
        .in("senaryo_id", senaryo_idler);
      senaryo_durum_idler = (senaryoDurumlari ?? []).map((s: any) => s.senaryo_durum_id);
    }

    let video_idler: string[] = [];
    if (senaryo_durum_idler.length > 0) {
      const { data: videolar } = await adminSupabase
        .from("videolar")
        .select("video_id")
        .in("senaryo_durum_id", senaryo_durum_idler);
      video_idler = (videolar ?? []).map((v: any) => v.video_id);
      ilgili_idler.push(...video_idler);
    }

    let video_durum_idler: string[] = [];
    if (video_idler.length > 0) {
      const { data: videoDurumlari } = await adminSupabase
        .from("video_durumu")
        .select("video_durum_id")
        .in("video_id", video_idler);
      video_durum_idler = (videoDurumlari ?? []).map((v: any) => v.video_durum_id);
    }

    let soru_seti_idler: string[] = [];
    if (video_durum_idler.length > 0) {
      const { data: soruSetleri } = await adminSupabase
        .from("soru_setleri")
        .select("soru_seti_id")
        .in("video_durum_id", video_durum_idler);
      soru_seti_idler = (soruSetleri ?? []).map((s: any) => s.soru_seti_id);
      ilgili_idler.push(...soru_seti_idler);
    }

    let soru_seti_durum_idler: string[] = [];
    if (soru_seti_idler.length > 0) {
      const { data: soruSetiDurumlari } = await adminSupabase
        .from("soru_seti_durumu")
        .select("soru_seti_durum_id")
        .in("soru_seti_id", soru_seti_idler);
      soru_seti_durum_idler = (soruSetiDurumlari ?? []).map((s: any) => s.soru_seti_durum_id);
    }

    if (soru_seti_durum_idler.length > 0) {
      const { data: yayinlar } = await adminSupabase
        .from("yayin_yonetimi")
        .select("yayin_id")
        .in("soru_seti_durum_id", soru_seti_durum_idler);
      const yayin_idler = (yayinlar ?? []).map((y: any) => y.yayin_id);
      ilgili_idler.push(...yayin_idler);
    }

    if (ilgili_idler.length === 0) return;

    const { error } = await adminSupabase
      .from("bildirimler")
      .update({ goruldu_mu: true })
      .eq("alici_id", gonderen_id)
      .in("kayit_id", ilgili_idler)
      .eq("goruldu_mu", false);

    if (error) {
      console.error("[BİLDİRİM] Gönderen bildirimleri okundu yapılamadı:", {
        gonderen_id,
        talep_id,
        hata: error.message,
      });
    }
  } catch (err) {
    console.error("[BİLDİRİM] gonderenTalepBildirimleriOkunduYap beklenmeyen hata:", err);
  }
}

async function gonderenBildirimleriOkunduYap(
  adminSupabase: SupabaseClient,
  gonderen_id: string,
  kayit_turu: KayitTuru,
  kayit_id: string
): Promise<void> {
  const talep_id = await talepIdBul(adminSupabase, kayit_turu, kayit_id);
  if (!talep_id) return;
  await gonderenTalepBildirimleriOkunduYap(adminSupabase, gonderen_id, talep_id);
}

/**
 * Bir kullanıcının (gönderen), verilen kayıt zincirine bağlı tüm okunmamış
 * bildirimlerini okundu yapar — yeni bir bildirim oluşturmadan.
 * Onaylandı / İptal Edildi gibi alıcısız durum geçişlerinde, işlemi yapan
 * kişinin kendi "incele" badge'ini kapatmak için kullanılır.
 */
export async function gonderenBildirimleriOkunduIsaretle(
  adminSupabase: SupabaseClient,
  gonderen_id: string,
  kayit_turu: KayitTuru,
  kayit_id: string
): Promise<void> {
  await gonderenBildirimleriOkunduYap(adminSupabase, gonderen_id, kayit_turu, kayit_id);
}

export async function bildirimOlustur(params: BildirimParams): Promise<void> {
  try {
    const { adminSupabase, alici_id, gonderen_id, kayit_turu, kayit_id, mesaj } = params;

    if (gonderen_id) {
      await gonderenBildirimleriOkunduYap(adminSupabase, gonderen_id, kayit_turu, kayit_id);
    }

    const { error } = await adminSupabase
      .from("bildirimler")
      .insert({
        alici_id,
        gonderen_id: gonderen_id ?? null,
        kayit_turu,
        kayit_id,
        mesaj,
        goruldu_mu: false,
      });

    if (error) {
      console.error("[BİLDİRİM] Bildirim oluşturulamadı:", {
        alici_id,
        kayit_turu,
        kayit_id,
        hata: error.message,
      });
      return; // in-app yazılamadıysa push da gitmez (K-P3 — in-app asıl kayıt)
    }

    pushYayinlaArkada(adminSupabase, PUSH_OLAY_ESLEME[kayit_turu], [alici_id]);
  } catch (err) {
    console.error("[BİLDİRİM] Beklenmeyen hata:", err);
  }
}

interface CokluBildirimParams {
  adminSupabase: SupabaseClient;
  alici_idler: string[];
  gonderen_id?: string | null;
  kayit_turu: KayitTuru;
  kayit_id: string;
  mesaj: string;
}

export async function cokluBildirimOlustur(params: CokluBildirimParams): Promise<void> {
  try {
    const { adminSupabase, alici_idler, gonderen_id, kayit_turu, kayit_id, mesaj } = params;

    if (alici_idler.length === 0) return;

    if (gonderen_id) {
      await gonderenBildirimleriOkunduYap(adminSupabase, gonderen_id, kayit_turu, kayit_id);
    }

    const kayitlar = alici_idler.map(alici_id => ({
      alici_id,
      gonderen_id: gonderen_id ?? null,
      kayit_turu,
      kayit_id,
      mesaj,
      goruldu_mu: false,
    }));

    const { error } = await adminSupabase
      .from("bildirimler")
      .insert(kayitlar);

    if (error) {
      console.error("[BİLDİRİM] Çoklu bildirim oluşturulamadı:", {
        alici_sayisi: alici_idler.length,
        kayit_turu,
        kayit_id,
        hata: error.message,
      });
      return; // in-app yazılamadıysa push da gitmez (K-P3)
    }

    pushYayinlaArkada(adminSupabase, PUSH_OLAY_ESLEME[kayit_turu], alici_idler);
  } catch (err) {
    console.error("[BİLDİRİM] Beklenmeyen hata:", err);
  }
}