// lib/uretim/surec.ts
//
// Üretim sürecinin TEK kural yeri (Yol 2 / Plan B, Adım 2).
// Bir aşama onaylandığında sıradaki işin (kabuk) doğması ve ilgili İU'ya
// bildirim gitmesi burada yaşar. Durum kaydını çağıran uç yazar; bu modül
// yalnız "geçişte doğan işi" kurar. Kabuklar yeni modele göre doğar:
//   talep_id dolu, kaynak='iu', iu_id=null (sahip teslimde yazılır).
// SUNUCU TARAFI: adminSupabase ile çağrılır.

import { SupabaseClient } from "@supabase/supabase-js";
import { bildirimOlustur } from "@/lib/utils/bildirimOlustur";

export interface SurecSonuc {
  ok: boolean;
  hata?: string;
}

/**
 * Senaryo onaylandığında: video kabuğu doğar (kaynak='iu', iu_id=null) ve
 * senaryoyu yazan İU'ya "video yüklemeye hazır" bildirimi gider.
 */
export async function senaryoOnayindaVideoAc(
  adminSupabase: SupabaseClient,
  params: {
    senaryo_durum_id: string;
    talep_id: string;
    senaryo_iu_id: string | null;
    onaylayan_id: string;
    urun_adi: string;
  }
): Promise<SurecSonuc> {
  const { data: video, error } = await adminSupabase
    .from("videolar")
    .insert({
      senaryo_durum_id: params.senaryo_durum_id,
      talep_id: params.talep_id,
      kaynak: "iu",
      iu_id: null,
      video_url: "",
    })
    .select("video_id")
    .single();

  if (error || !video) return { ok: false, hata: error?.message ?? "Video kabuğu oluşturulamadı." };

  if (params.senaryo_iu_id) {
    await bildirimOlustur({
      adminSupabase,
      alici_id: params.senaryo_iu_id,
      gonderen_id: params.onaylayan_id,
      kayit_turu: "video",
      kayit_id: video.video_id,
      mesaj: `Senaryon onaylandı, video yüklemeye hazır: ${params.urun_adi}`,
    });
  }
  return { ok: true };
}

/**
 * Video onaylandığında: soru seti kabuğu doğar (kaynak='iu', iu_id=null) ve
 * videoyu üreten İU'ya "soru seti yazmaya hazır" bildirimi gider.
 */
export async function videoOnayindaSoruSetiAc(
  adminSupabase: SupabaseClient,
  params: {
    video_durum_id: string;
    talep_id: string;
    video_iu_id: string | null;
    onaylayan_id: string;
    urun_adi: string;
  }
): Promise<SurecSonuc> {
  const { data: set, error } = await adminSupabase
    .from("soru_setleri")
    .insert({
      video_durum_id: params.video_durum_id,
      talep_id: params.talep_id,
      kaynak: "iu",
      iu_id: null,
      sorular: [],
    })
    .select("soru_seti_id")
    .single();

  if (error || !set) return { ok: false, hata: error?.message ?? "Soru seti kabuğu oluşturulamadı." };

  if (params.video_iu_id) {
    await bildirimOlustur({
      adminSupabase,
      alici_id: params.video_iu_id,
      gonderen_id: params.onaylayan_id,
      kayit_turu: "soru_seti",
      kayit_id: set.soru_seti_id,
      mesaj: `Videon onaylandı, soru seti yazmaya hazır: ${params.urun_adi}`,
    });
  }
  return { ok: true };
}
