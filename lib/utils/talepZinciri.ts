// lib/utils/talepZinciri.ts
// Senaryo, video veya soru seti ID'sinden başlayarak
// talep zincirine ulaşan merkezi utility.
// Bu sayede durum route'larında tekrar eden 2-6 ardışık sorgu tek yerden yönetilir.

import { SupabaseClient } from "@supabase/supabase-js";
import type { TalepTuru } from "@/lib/uretici/yetenekler";
import type { HedefRol } from "@/lib/utils/roller";

export interface TalepBilgisi {
  talep_id: string;
  uretici_id: string | null;
  urun_adi: string;
  teknik_adi: string;
  egitim_turu: TalepTuru;
  hedef_rol: HedefRol;
  dosya_urls: any[] | null;
  soru_seti_buyuklugu: number;
  video_basi_soru_sayisi: number;
}

// senaryolar tablosundan başla: senaryo_id → talepler
export async function talepBilgisiSenaryo(
  adminSupabase: SupabaseClient,
  senaryo_id: string
): Promise<TalepBilgisi | null> {
  const { data } = await adminSupabase
    .from("senaryolar")
    .select(`
      talep_id,
      talepler (
        talep_id,
        uretici_id,
        egitim_turu,
        hedef_rol,
        dosya_urls,
        soru_seti_buyuklugu,
        video_basi_soru_sayisi,
        urunler ( urun_adi ),
        teknikler ( teknik_adi )
      )
    `)
    .eq("senaryo_id", senaryo_id)
    .single();

  if (!data?.talepler) return null;

  const talep = data.talepler as any;

  return {
    talep_id: talep.talep_id,
    uretici_id: talep.uretici_id ?? null,
    urun_adi: talep.urunler?.urun_adi ?? "-",
    teknik_adi: talep.teknikler?.teknik_adi ?? "-",
    egitim_turu: (talep.egitim_turu ?? "urun_egitimi") as TalepTuru,
    hedef_rol: (talep.hedef_rol ?? "utt") as HedefRol,
    dosya_urls: talep.dosya_urls ?? null,
    soru_seti_buyuklugu: talep.soru_seti_buyuklugu ?? 25,
    video_basi_soru_sayisi: talep.video_basi_soru_sayisi ?? 2,
  };
}

// videolar tablosundan başla: video_id → senaryo_durumu → senaryolar → talepler
export async function talepBilgisiVideo(
  adminSupabase: SupabaseClient,
  video_id: string
): Promise<TalepBilgisi | null> {
  const { data } = await adminSupabase
    .from("videolar")
    .select(`
      senaryo_durum_id,
      senaryo_durumu (
        senaryo_id,
        senaryolar (
          talep_id,
          talepler (
            talep_id,
            uretici_id,
            egitim_turu,
            hedef_rol,
            dosya_urls,
            soru_seti_buyuklugu,
            video_basi_soru_sayisi,
            urunler ( urun_adi ),
            teknikler ( teknik_adi )
          )
        )
      )
    `)
    .eq("video_id", video_id)
    .single();

  if (!data?.senaryo_durumu) return null;

  const senaryo = (data.senaryo_durumu as any)?.senaryolar;
  if (!senaryo?.talepler) return null;

  const talep = senaryo.talepler as any;

  return {
    talep_id: talep.talep_id,
    uretici_id: talep.uretici_id ?? null,
    urun_adi: talep.urunler?.urun_adi ?? "-",
    teknik_adi: talep.teknikler?.teknik_adi ?? "-",
    egitim_turu: (talep.egitim_turu ?? "urun_egitimi") as TalepTuru,
    hedef_rol: (talep.hedef_rol ?? "utt") as HedefRol,
    dosya_urls: talep.dosya_urls ?? null,
    soru_seti_buyuklugu: talep.soru_seti_buyuklugu ?? 25,
    video_basi_soru_sayisi: talep.video_basi_soru_sayisi ?? 2,
  };
}

// soru_setleri tablosundan başla: soru_seti_id → video_durumu → videolar → senaryo_durumu → senaryolar → talepler
export async function talepBilgisiSoruSeti(
  adminSupabase: SupabaseClient,
  soru_seti_id: string
): Promise<TalepBilgisi | null> {
  const { data } = await adminSupabase
    .from("soru_setleri")
    .select(`
      video_durum_id,
      video_durumu (
        video_id,
        videolar (
          video_id,
          senaryo_durum_id,
          senaryo_durumu (
            senaryo_id,
            senaryolar (
              talep_id,
              talepler (
                talep_id,
                uretici_id,
                egitim_turu,
                hedef_rol,
                dosya_urls,
                soru_seti_buyuklugu,
                video_basi_soru_sayisi,
                urunler ( urun_adi ),
                teknikler ( teknik_adi )
              )
            )
          )
        )
      )
    `)
    .eq("soru_seti_id", soru_seti_id)
    .single();
    
  if (!data?.video_durumu) return null;

  const video = (data.video_durumu as any)?.videolar;
  const senaryo = video?.senaryo_durumu?.senaryolar;
  if (!senaryo?.talepler) return null;

  const talep = senaryo.talepler as any;

  return {
    talep_id: talep.talep_id,
    uretici_id: talep.uretici_id ?? null,
    urun_adi: talep.urunler?.urun_adi ?? "-",
    teknik_adi: talep.teknikler?.teknik_adi ?? "-",
    egitim_turu: (talep.egitim_turu ?? "urun_egitimi") as TalepTuru,
    hedef_rol: (talep.hedef_rol ?? "utt") as HedefRol,
    dosya_urls: talep.dosya_urls ?? null,
    soru_seti_buyuklugu: talep.soru_seti_buyuklugu ?? 25,
    video_basi_soru_sayisi: talep.video_basi_soru_sayisi ?? 2,
  };
}