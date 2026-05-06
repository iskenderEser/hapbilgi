// lib/utils/talepZinciri.ts
// Senaryo, video veya soru seti ID'sinden başlayarak
// talep zincirine ulaşan merkezi utility.
// Bu sayede durum route'larında tekrar eden 2-6 ardışık sorgu tek yerden yönetilir.

import { SupabaseClient } from "@supabase/supabase-js";

export interface TalepBilgisi {
  talep_id: string;
  pm_id: string | null;
  urun_adi: string;
  teknik_adi: string;
  egitim_turu: "urun_egitimi" | "genel_egitim";
  dosya_urls: any[] | null;
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
        pm_id,
        egitim_turu,
        dosya_urls,
        urunler ( urun_adi ),
        teknikler ( teknik_adi )
      )
    `)
    .eq("senaryo_id", senaryo_id)
    .single();

  if (!data?.talepler) return null;

  const talep = data.talepler as any;
  const egitimTuru = talep.egitim_turu ?? "urun_egitimi";

  return {
    talep_id: talep.talep_id,
    pm_id: talep.pm_id ?? null,
    urun_adi: egitimTuru === "genel_egitim" ? "Genel Eğitim" : (talep.urunler?.urun_adi ?? "-"),
    teknik_adi: egitimTuru === "genel_egitim" ? "-" : (talep.teknikler?.teknik_adi ?? "-"),
    egitim_turu: egitimTuru,
    dosya_urls: talep.dosya_urls ?? null,
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
            pm_id,
            egitim_turu,
            dosya_urls,
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
  const egitimTuru = talep.egitim_turu ?? "urun_egitimi";

  return {
    talep_id: talep.talep_id,
    pm_id: talep.pm_id ?? null,
    urun_adi: egitimTuru === "genel_egitim" ? "Genel Eğitim" : (talep.urunler?.urun_adi ?? "-"),
    teknik_adi: egitimTuru === "genel_egitim" ? "-" : (talep.teknikler?.teknik_adi ?? "-"),
    egitim_turu: egitimTuru,
    dosya_urls: talep.dosya_urls ?? null,
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
                pm_id,
                egitim_turu,
                dosya_urls,
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
  const egitimTuru = talep.egitim_turu ?? "urun_egitimi";

  return {
    talep_id: talep.talep_id,
    pm_id: talep.pm_id ?? null,
    urun_adi: egitimTuru === "genel_egitim" ? "Genel Eğitim" : (talep.urunler?.urun_adi ?? "-"),
    teknik_adi: egitimTuru === "genel_egitim" ? "-" : (talep.teknikler?.teknik_adi ?? "-"),
    egitim_turu: egitimTuru,
    dosya_urls: talep.dosya_urls ?? null,
  };
}