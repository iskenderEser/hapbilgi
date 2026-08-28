// lib/utils/bildirimOlustur.ts
import { SupabaseClient } from "@supabase/supabase-js";
import {
  talepBilgisiSenaryo,
  talepBilgisiVideo,
  talepBilgisiSoruSeti,
} from "./talepZinciri";
import { pushYayinlaArkada } from "@/lib/push/orkestrasyon";
import type { PushOlayTuru } from "@/lib/push/tipler";
import type { PushBaglami } from "@/lib/push/tipler";

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

async function pushBaglamiBul(adminSupabase: SupabaseClient, kayitTuru: KayitTuru, kayitId: string): Promise<PushBaglami> {
  if (kayitTuru === "yayin") return { yayinId: kayitId };
  if (kayitTuru === "oneri") {
    const { data } = await adminSupabase.from("oneri_kayitlari").select("yayin_id").eq("oneri_id", kayitId).maybeSingle();
    return { yayinId: data?.yayin_id, bagId: kayitId };
  }
  if (kayitTuru === "challenge") {
    const { data } = await adminSupabase.from("challenge_kayitlari").select("yayin_id").eq("challenge_id", kayitId).maybeSingle();
    return { yayinId: data?.yayin_id, bagId: kayitId };
  }
  return {};
}

interface BildirimParams {
  adminSupabase: SupabaseClient;
  alici_id: string;
  gonderen_id?: string | null;
  kayit_turu: KayitTuru;
  kayit_id: string;
  talep_id?: string | null;
  gorev_id?: string | null;
  mesaj: string;
}

export type BildirimSonucu =
  | { ok: true }
  | { ok: false; hata: string };

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
    if (kayit_turu === "talep") {
      const { data: talep } = await adminSupabase
        .from("talepler")
        .select("talep_id")
        .eq("talep_id", kayit_id)
        .maybeSingle();
      if (talep?.talep_id) return talep.talep_id;

      // Tarihî üretim route'ları "talep" türüyle artifact kimliği yazıyordu.
      // Geçiş süresinde bu çağrıları da kanonik talebe çözer.
      const [senaryo, video, set] = await Promise.all([
        adminSupabase.from("senaryolar").select("talep_id").eq("senaryo_id", kayit_id).maybeSingle(),
        adminSupabase.from("videolar").select("talep_id").eq("video_id", kayit_id).maybeSingle(),
        adminSupabase.from("soru_setleri").select("talep_id").eq("soru_seti_id", kayit_id).maybeSingle(),
      ]);
      return senaryo.data?.talep_id ?? video.data?.talep_id ?? set.data?.talep_id ?? null;
    }
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
    const { error } = await adminSupabase
      .from("bildirimler")
      .update({ goruldu_mu: true })
      .eq("alici_id", gonderen_id)
      .eq("talep_id", talep_id)
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

export async function bildirimOlustur(params: BildirimParams): Promise<BildirimSonucu> {
  try {
    const { adminSupabase, alici_id, gonderen_id, kayit_turu, kayit_id, gorev_id, mesaj } = params;
    const talep_id = params.talep_id ?? await talepIdBul(adminSupabase, kayit_turu, kayit_id);
    const kanonikKayitId = kayit_turu === "talep" && talep_id ? talep_id : kayit_id;

    if (gonderen_id) {
      if (talep_id) await gonderenTalepBildirimleriOkunduYap(adminSupabase, gonderen_id, talep_id);
    }

    const { error } = talep_id
      ? await adminSupabase.rpc("uretim_bildirim_yaz", {
          p_alici_id: alici_id,
          p_gonderen_id: gonderen_id ?? null,
          p_kayit_turu: kayit_turu,
          p_kayit_id: kanonikKayitId,
          p_talep_id: talep_id,
          p_gorev_id: gorev_id ?? null,
          p_mesaj: mesaj,
        })
      : await adminSupabase
          .from("bildirimler")
          .insert({
            alici_id,
            gonderen_id: gonderen_id ?? null,
            kayit_turu,
            kayit_id: kanonikKayitId,
            talep_id: null,
            gorev_id: gorev_id ?? null,
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
      return { ok: false, hata: error.message }; // in-app yazılamadıysa push da gitmez
    }

    pushYayinlaArkada(adminSupabase, PUSH_OLAY_ESLEME[kayit_turu], [alici_id], await pushBaglamiBul(adminSupabase, kayit_turu, kanonikKayitId));
    return { ok: true };
  } catch (err) {
    console.error("[BİLDİRİM] Beklenmeyen hata:", err);
    return { ok: false, hata: err instanceof Error ? err.message : "Bilinmeyen bildirim hatası." };
  }
}

interface CokluBildirimParams {
  adminSupabase: SupabaseClient;
  alici_idler: string[];
  gonderen_id?: string | null;
  kayit_turu: KayitTuru;
  kayit_id: string;
  talep_id?: string | null;
  gorev_id?: string | null;
  mesaj: string;
}

export async function cokluBildirimOlustur(params: CokluBildirimParams): Promise<BildirimSonucu> {
  try {
    const { adminSupabase, alici_idler, gonderen_id, kayit_turu, kayit_id, gorev_id, mesaj } = params;

    if (alici_idler.length === 0) return { ok: true };

    const talep_id = params.talep_id ?? await talepIdBul(adminSupabase, kayit_turu, kayit_id);
    const kanonikKayitId = kayit_turu === "talep" && talep_id ? talep_id : kayit_id;

    if (gonderen_id) {
      if (talep_id) await gonderenTalepBildirimleriOkunduYap(adminSupabase, gonderen_id, talep_id);
    }

    const yazimSonuclari = talep_id
      ? await Promise.all(alici_idler.map((alici_id) => adminSupabase.rpc("uretim_bildirim_yaz", {
          p_alici_id: alici_id,
          p_gonderen_id: gonderen_id ?? null,
          p_kayit_turu: kayit_turu,
          p_kayit_id: kanonikKayitId,
          p_talep_id: talep_id,
          p_gorev_id: gorev_id ?? null,
          p_mesaj: mesaj,
        })))
      : [await adminSupabase
          .from("bildirimler")
          .insert(alici_idler.map((alici_id) => ({
            alici_id,
            gonderen_id: gonderen_id ?? null,
            kayit_turu,
            kayit_id: kanonikKayitId,
            talep_id: null,
            gorev_id: gorev_id ?? null,
            mesaj,
            goruldu_mu: false,
          })))];
    const error = yazimSonuclari.find((sonuc) => sonuc.error)?.error ?? null;

    if (error) {
      console.error("[BİLDİRİM] Çoklu bildirim oluşturulamadı:", {
        alici_sayisi: alici_idler.length,
        kayit_turu,
        kayit_id,
        hata: error.message,
      });
      return { ok: false, hata: error.message }; // in-app yazılamadıysa push da gitmez
    }

    pushYayinlaArkada(adminSupabase, PUSH_OLAY_ESLEME[kayit_turu], alici_idler, await pushBaglamiBul(adminSupabase, kayit_turu, kanonikKayitId));
    return { ok: true };
  } catch (err) {
    console.error("[BİLDİRİM] Beklenmeyen hata:", err);
    return { ok: false, hata: err instanceof Error ? err.message : "Bilinmeyen bildirim hatası." };
  }
}
