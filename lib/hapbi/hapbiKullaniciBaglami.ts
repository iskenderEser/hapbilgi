// lib/hapbi/hapbiKullaniciBaglami.ts
//
// Hapbi AI Platform Danışmanı için 5 Boyutlu Canlı Kullanıcı, Lig, Video Kataloğu ve Performans Bağlam Toplayıcısı.

import { SupabaseClient } from "@supabase/supabase-js";
import { aktifPeriyot } from "@/lib/zaman/kontrol";
import { harcamaBakiyesi } from "@/lib/tclub/store/bakiye";

export interface OnerilenVideoBilgisi {
  urunAdi: string;
  teknikAdi?: string;
  kategori: string;
  puan: number;
  yayinTarihi: string;
  yeniMi: boolean;
}

export interface HapbiKullaniciBaglami {
  adSoyad: string;
  eposta: string;
  rol: string;
  firmaAdi: string | null;
  takimAdi: string | null;
  bolgeAdi: string | null;
  // Puan & Lig
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
  // Video İstatistikleri ve Detaylı Liste
  tamamlananVideoSayisi: number;
  izlenmeyenVideoSayisi: number;
  izlenmeyenVideolar: OnerilenVideoBilgisi[];
  tamamlananVideolarOzet: string[];
  // E-Club
  bagliEczaneSayisi: number;
  // Gemini'ye doğrudan iletilecek zengin metin
  canliVeriMetni: string;
}

export async function getHapbiKullaniciBaglami(
  supabase: SupabaseClient,
  userId: string
): Promise<HapbiKullaniciBaglami | null> {
  try {
    // 1. Kullanıcı profil detayları
    const { data: kullanici } = await supabase
      .from("v_kullanici_detay")
      .select("kullanici_id, ad, soyad, eposta, rol, firma_adi, takim_adi, bolge_adi, firma_id, bolge_id")
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
      // RPC yoksa sıralama tablosundan alınır
    }

    // 4. Sipariş / Cüzdan Bakiyesi
    let siparisPuani = 0;
    try {
      siparisPuani = await harcamaBakiyesi(supabase, userId);
    } catch {
      siparisPuani = 0;
    }

    // 5. İzleme Kayıtları ve Yayındaki Videolar
    const [
      { data: izlemeler },
      { data: yayinlar },
      { count: eczaneCount },
    ] = await Promise.all([
      supabase
        .from("izleme_kayitlari")
        .select("yayin_id, tamamlandi_mi, created_at")
        .eq("kullanici_id", userId),
      supabase
        .from("v_yayin_detay")
        .select("yayin_id, urun_adi, teknik_adi, video_puani, yayin_tarihi, icerik_turu, firma_adi")
        .eq("durum", "yayinda")
        .gt("video_suresi_saniye", 0)
        .order("yayin_tarihi", { ascending: false }),
      supabase
        .from("eclub_eczaneler")
        .select("eczane_id", { count: "exact", head: true }),
    ]);

    const izlenenYayinIdler = new Set(
      (izlemeler || []).filter((i) => i.tamamlandi_mi).map((i) => i.yayin_id)
    );

    const onDortGunOnce = new Date();
    onDortGunOnce.setDate(onDortGunOnce.getDate() - 14);

    const izlenmeyenVideolar: OnerilenVideoBilgisi[] = [];
    const tamamlananVideolarOzet: string[] = [];

    for (const y of yayinlar || []) {
      const isWatched = izlenenYayinIdler.has(y.yayin_id);
      const baslik = y.urun_adi || y.teknik_adi || "Eğitim Videosu";
      if (isWatched) {
        tamamlananVideolarOzet.push(`${baslik} (${y.icerik_turu || "genel"})`);
      } else {
        const yayinDate = y.yayin_tarihi ? new Date(y.yayin_tarihi) : new Date();
        izlenmeyenVideolar.push({
          urunAdi: y.urun_adi || baslik,
          teknikAdi: y.teknik_adi || undefined,
          kategori: y.icerik_turu || "genel",
          puan: y.video_puani || 40,
          yayinTarihi: y.yayin_tarihi || "",
          yeniMi: yayinDate >= onDortGunOnce,
        });
      }
    }

    const izlenmeyenVideoMetni = izlenmeyenVideolar.slice(0, 10).map((v) => {
      const yeniEtiketi = v.yeniMi ? " [YENİ YAYINDA]" : "";
      const teknik = v.teknikAdi ? ` - ${v.teknikAdi}` : "";
      return `• ${v.urunAdi}${teknik} | Kategori: ${v.kategori} | Değer: ${v.puan} Puan${yeniEtiketi}`;
    }).join("\n");

    const adSoyad = `${kullanici.ad ?? ""} ${kullanici.soyad ?? ""}`.trim();

    const canliVeriMetni = `
=== KULLANICININ ANLIK CANLI VERİTABANI TABLOSU ===
1. KİMLİK & TAKIM:
- Kullanıcı: ${adSoyad} (Hitap: ${kullanici.ad ?? "Kullanıcı"} Bey/Hanım)
- Rol: ${kullanici.rol?.toUpperCase() ?? "UTT"}
- Firma: ${kullanici.firma_adi ?? "Hepifarma"} | Takım: ${kullanici.takim_adi ?? "Bilinmiyor"} | Bölge: ${kullanici.bolge_adi ?? "Bilinmiyor"}

2. LİG & PUAN DURUMU:
- Toplam Lig Puanı: ${siralama?.toplam_puan ?? 0} Puan (Bu haftaki puanı: ${haftalikPuan || (siralama?.toplam_puan ?? 0)} Puan)
- Sıralamalar: Takımında ${siralama?.takim_sirasi ?? 1}. sıra | Firmasında ${siralama?.firma_sirasi ?? 1}. sıra | Bölgesinde ${siralama?.bolge_sirasi ?? 1}. sıra
- Puan Kaynakları: Video İzleme (+${siralama?.izleme_puani ?? 0} Puan) | Soru Cevaplama (+${siralama?.cevaplama_puani ?? 0} Puan) | Öneri (+${siralama?.oneri_puani ?? 0} Puan)
- Cezalar/Kayıplar: İleri Sarma Kaybı (-${siralama?.ileri_sarma_kaybi ?? 0} Puan) | Test Yanlış Cevap Kaybı (-${siralama?.yanlis_cevap_kaybi ?? 0} Puan)
- HBStore Cüzdan Bakiyesi: ${siparisPuani} Puan

3. VİDEO EĞİTİM DURUMU:
- Tamamlanan Video: ${tamamlananVideolarOzet.length} / Toplam: ${(yayinlar || []).length} (Kalan: ${izlenmeyenVideolar.length} Video)
- KULLANICININ HENÜZ İZLEMEDİĞİ ÖRNEK AKTİF VİDEOLAR (Tavsiye ederken bu gerçek başlıkları ve puanları kullan):
${izlenmeyenVideoMetni || "Tüm videolar tamamlandı."}

4. E-CLUB & SAHA AĞI:
- Takımındaki Bağlı Eczane Sayısı: ${eczaneCount ?? 0}
===================================================
`;

    return {
      adSoyad,
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
      tamamlananVideoSayisi: tamamlananVideolarOzet.length,
      izlenmeyenVideoSayisi: izlenmeyenVideolar.length,
      izlenmeyenVideolar,
      tamamlananVideolarOzet,
      bagliEczaneSayisi: eczaneCount ?? 0,
      canliVeriMetni,
    };
  } catch (error) {
    console.error("Hapbi kullanıcı bağlamı oluşturma hatası:", error);
    return null;
  }
}
