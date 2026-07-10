// lib/utils/anaSayfa/yonetici.ts
// Yönetici (gm, gm_yrd, drk, paz_md, blm_md, grp_pm, sm) ana sayfa verisi.
// (R0: lib/utils/anaSayfaVeri.ts'ten saf taşıma — davranış değişmedi.)

import { SupabaseClient } from "@supabase/supabase-js";

export async function getYoneticiAnaSayfaVeri(userId: string, adminSupabase: SupabaseClient) {
  const { data: kullanici, error: kullaniciError } = await adminSupabase
    .from("kullanicilar")
    .select("firma_id")
    .eq("kullanici_id", userId)
    .single();

  if (kullaniciError || !kullanici) throw new Error("Kullanıcı bilgisi alınamadı.");

  // Hafta başlangıcı (Pazartesi 00:00)
  const haftaBaslangic = new Date();
  haftaBaslangic.setDate(haftaBaslangic.getDate() - haftaBaslangic.getDay() + 1);
  haftaBaslangic.setHours(0, 0, 0, 0);
  const simdi = new Date().toISOString();

  // Paralel: anlık 6 stat + haftalık UTT puanları + UTT listesi (rol/foto için)
  const [
    { data: ozet, error: ozetError },
    { data: haftaUttler },
    { data: firmaUttler },
  ] = await Promise.all([
    adminSupabase.rpc("get_yonetici_ana_sayfa", { p_firma_id: kullanici.firma_id }),
    adminSupabase.rpc("get_kullanici_ozet", {
      p_baslangic: haftaBaslangic.toISOString(),
      p_bitis: simdi,
      p_firma_id: kullanici.firma_id,
    }),
    adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, fotograf_url")
      .eq("firma_id", kullanici.firma_id)
      .in("rol", ["utt", "kd_utt"])
      .eq("aktif_mi", true),
  ]);

  if (ozetError) throw new Error("Ana sayfa verisi alınamadı.");

  const stat = (ozet && ozet.length > 0) ? ozet[0] : null;

  const uttIdSet = new Set((firmaUttler ?? []).map((u: any) => u.kullanici_id));
  const fotoMap: Record<string, string | null> = {};
  for (const u of firmaUttler ?? []) fotoMap[u.kullanici_id] = u.fotograf_url;

  // Top 5 UTT (firma içi UTT/KD_UTT + puanı > 0, net puan DESC)
  const top5 = (haftaUttler ?? [])
    .filter((u: any) => uttIdSet.has(u.kullanici_id) && (u.toplam_net_puan ?? 0) > 0)
    .sort((a: any, b: any) => (b.toplam_net_puan ?? 0) - (a.toplam_net_puan ?? 0))
    .slice(0, 5);

  const haftanin_enleri = top5.map((u: any) => ({
    kullanici_id: u.kullanici_id,
    ad: u.ad,
    soyad: u.soyad,
    fotograf_url: fotoMap[u.kullanici_id] ?? null,
    toplam_puan: u.toplam_net_puan ?? 0,
  }));

  return {
    istatistikler: {
      yayinda_toplam_video: stat?.yayinda_toplam_video ?? 0,
      toplam_izleme_sayisi: stat?.toplam_izleme_sayisi ?? 0,
      en_cok_izlenen_video: stat?.en_cok_izlenen_video ?? null,
      en_cok_izleyen_takim: stat?.en_cok_izleyen_takim ?? null,
      en_cok_izleyen_bolge: stat?.en_cok_izleyen_bolge ?? null,
      en_cok_izleyen_utt: stat?.en_cok_izleyen_utt ?? null,
    },
    haftanin_enleri,
  };
}
