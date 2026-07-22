// lib/utils/talepZinciri.ts
// Senaryo, video veya soru seti ID'sinden talep bilgisine ulaşan merkezi utility.
//
// Adım 5 (22.07): Yol 2 sonrası video ve soru seti talebe DOĞRUDAN bağlı
// (`talep_id`). Eski zincir yürüme (video→senaryo_durumu→senaryolar→talep,
// set→video_durumu→...→talep) kaldırıldı — hem sadeleşti hem hazır kolu düzeltti
// (hazır videoda `senaryo_durum_id=null` olduğundan eski zincir null dönüyordu).
// Senaryo zaten talebe bağlıdır (tek hop). Dönüş şekli (TalepBilgisi) değişmedi.

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

// talepler embed'i için ortak alan listesi ve haritalama — üç giriş de aynı.
const TALEP_ALANLARI = `
  talep_id,
  uretici_id,
  egitim_turu,
  hedef_rol,
  dosya_urls,
  soru_seti_buyuklugu,
  video_basi_soru_sayisi,
  urunler ( urun_adi ),
  teknikler ( teknik_adi )
`;

function haritalaTalep(talep: any): TalepBilgisi {
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

// senaryolar → talep (senaryolar zaten talebe bağlı)
export async function talepBilgisiSenaryo(
  adminSupabase: SupabaseClient,
  senaryo_id: string
): Promise<TalepBilgisi | null> {
  const { data } = await adminSupabase
    .from("senaryolar")
    .select(`talep_id, talepler ( ${TALEP_ALANLARI} )`)
    .eq("senaryo_id", senaryo_id)
    .single();

  if (!data?.talepler) return null;
  return haritalaTalep(data.talepler);
}

// videolar → talep (doğrudan talep_id; hazır videoda da çalışır)
export async function talepBilgisiVideo(
  adminSupabase: SupabaseClient,
  video_id: string
): Promise<TalepBilgisi | null> {
  const { data } = await adminSupabase
    .from("videolar")
    .select(`talep_id, talepler ( ${TALEP_ALANLARI} )`)
    .eq("video_id", video_id)
    .single();

  if (!data?.talepler) return null;
  return haritalaTalep(data.talepler);
}

// soru_setleri → talep (doğrudan talep_id; hazır sette de çalışır)
export async function talepBilgisiSoruSeti(
  adminSupabase: SupabaseClient,
  soru_seti_id: string
): Promise<TalepBilgisi | null> {
  const { data } = await adminSupabase
    .from("soru_setleri")
    .select(`talep_id, talepler ( ${TALEP_ALANLARI} )`)
    .eq("soru_seti_id", soru_seti_id)
    .single();

  if (!data?.talepler) return null;
  return haritalaTalep(data.talepler);
}
