// lib/hapbi/hapbiKullaniciBaglami.ts
//
// Hapbi AI Platform Danışmanı için canlı kullanıcı, puan, lig ve performans bağlam toplayıcısı.

import { SupabaseClient } from "@supabase/supabase-js";
import { aktifPeriyot } from "@/lib/zaman/kontrol";
import { harcamaBakiyesi } from "@/lib/tclub/store/bakiye";

export interface HapbiKullaniciBaglami {
  adSoyad: string;
  eposta: string;
  rol: string;
  firmaAdi: string | null;
  takimAdi: string | null;
  bolgeAdi: string | null;
  // Puan ve Lig
  haftalikPuan: number;
  toplamPuan: number;
  takimSirasi: number | null;
  firmaSirasi: number | null;
  bolgeSirasi: number | null;
  izlemePuani: number;
  cevaplamaPuani: number;
  oneriPuani: number;
  ileriSarmaKaybi: number;
  yanlisCevapKaybi: number;
  siparisPuani: number;
  // Video & Eğitim
  tamamlananVideoSayisi: number;
  toplamVideoSayisi: number;
  // E-Club
  bagliEczaneSayisi: number;
}

export async function getHapbiKullaniciBaglami(
  supabase: SupabaseClient,
  userId: string
): Promise<HapbiKullaniciBaglami | null> {
  try {
    // 1. Kullanıcı profil detayları
    const { data: kullanici } = await supabase
      .from("v_kullanici_detay")
      .select("kullanici_id, ad, soyad, eposta, rol, firma_adi, takim_adi, bolge_adi")
      .eq("kullanici_id", userId)
      .maybeSingle();

    if (!kullanici) return null;

    // 2. Sıralama ve Puan Dağılımı (v_hbligi_sirali_v2)
    const { data: siralama } = await supabase
      .from("v_hbligi_sirali_v2")
      .select("*")
      .eq("kullanici_id", userId)
      .maybeSingle();

    // 3. Haftalık Lig Puanı
    const { yil, hafta } = aktifPeriyot();
    let haftalikPuan = 0;
    try {
      const { data: haftalikLig } = await supabase.rpc("get_hb_ligi_haftalik_v2", {
        p_yil: yil,
        p_hafta: hafta,
      });
      if (Array.isArray(haftalikLig)) {
        const row = haftalikLig.find((r: { kullanici_id: string }) => r.kullanici_id === userId);
        if (row) haftalikPuan = row.toplam_puan ?? 0;
      }
    } catch {
      // RPC yoksa siralama tablosu puanı kullanılır
    }

    // 4. Sipariş / Cüzdan Bakiyesi
    let siparisPuani = 0;
    try {
      siparisPuani = await harcamaBakiyesi(supabase, userId);
    } catch {
      siparisPuani = 0;
    }

    // 5. Video İstatistikleri
    const { count: tamamlananVideo } = await supabase
      .from("izleme_kayitlari")
      .select("izleme_id", { count: "exact", head: true })
      .eq("kullanici_id", userId)
      .eq("tamamlandi_mi", true);

    const { count: toplamVideo } = await supabase
      .from("videolar")
      .select("video_id", { count: "exact", head: true });

    // 6. E-Club Eczane Sayısı (Eğer rol UTT veya yönetici ise)
    let bagliEczaneSayisi = 0;
    try {
      const { count: eczaneCount } = await supabase
        .from("eclub_eczaneler")
        .select("eczane_id", { count: "exact", head: true });
      bagliEczaneSayisi = eczaneCount ?? 0;
    } catch {
      bagliEczaneSayisi = 0;
    }

    return {
      adSoyad: `${kullanici.ad ?? ""} ${kullanici.soyad ?? ""}`.trim(),
      eposta: kullanici.eposta,
      rol: kullanici.rol ?? "utt",
      firmaAdi: kullanici.firma_adi ?? null,
      takimAdi: kullanici.takim_adi ?? null,
      bolgeAdi: kullanici.bolge_adi ?? null,
      haftalikPuan: haftalikPuan || (siralama?.toplam_puan ?? 0),
      toplamPuan: siralama?.toplam_puan ?? 0,
      takimSirasi: siralama?.takim_sirasi ?? 1,
      firmaSirasi: siralama?.firma_sirasi ?? 1,
      bolgeSirasi: siralama?.bolge_sirasi ?? 1,
      izlemePuani: siralama?.izleme_puani ?? 0,
      cevaplamaPuani: siralama?.cevaplama_puani ?? 0,
      oneriPuani: siralama?.oneri_puani ?? 0,
      ileriSarmaKaybi: siralama?.ileri_sarma_kaybi ?? 0,
      yanlisCevapKaybi: siralama?.yanlis_cevap_kaybi ?? 0,
      siparisPuani: siparisPuani,
      tamamlananVideoSayisi: tamamlananVideo ?? 0,
      toplamVideoSayisi: toplamVideo ?? 0,
      bagliEczaneSayisi: bagliEczaneSayisi,
    };
  } catch (error) {
    console.error("Hapbi kullanıcı bağlamı oluşturma hatası:", error);
    return null;
  }
}
