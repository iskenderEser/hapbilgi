// app/admin/api/test-verileri-sil/route.ts
//
// Test ortamında üretim/izleme/etkileşim kayıtlarını topluca siler.
// Yapısal veri korunur: firmalar, takimlar, bolgeler, kullanicilar,
// urunler, teknikler, kategoriler, silinmis_kullanicilar.
//
// Silme sırası FK ilişkilerine göre (information_schema'dan doğrulanarak)
// çocuk → ebeveyn olacak şekilde dizilmiştir. hb_ligi bir VIEW olduğu için
// listede yoktur (silinemez; kendi verisi yoktur).
//
// Tüm hedef tablolarda created_at kolonu mevcuttur (DB'den doğrulandı);
// "tüm satırları sil" için created_at >= epoch filtresi kullanılır.
//
// Hata yönetimi: bir tablonun silinmesi başarısız olursa kalan tablolar
// denemeye devam eder; sonuç yanıtında her tablonun durumu listelenir.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi } from "@/lib/utils/hataIsle";

// FK sırasına göre: çocuk kayıtlar önce, ebeveynler sonra.
// (information_schema FK çıktısından topolojik olarak hesaplandı.)
const SILINECEK_TABLOLAR = [
  // En derin çocuklar
  "bildirimler",
  "cc_ileri_sarma_kayitlari",
  "cc_kazanilan_puanlar",
  "cc_yanlis_cevap_kayitlari",
  "challenge_kayip_kayitlari",
  "ileri_sarma_kayitlari",
  "kazanilan_puanlar",
  "oneri_kayip_kayitlari",
  "soru_cevaplari",
  "soru_seti_puanlari",
  "video_begeniler",
  "video_favoriler",
  "video_puanlari",
  "yanlis_cevap_kayitlari",
  // Orta katman
  "cc_izleme_kayitlari",
  "izleme_kayitlari",
  "challenge_kayitlari",
  "oneri_kayitlari",
  "yayin_yonetimi",
  "soru_seti_durumu",
  "soru_setleri",
  "video_durumu",
  "videolar",
  "senaryo_durumu",
  "senaryolar",
  // En üst ebeveyn (test zincirinin tepesi)
  "talepler",
];

export async function POST() {
  try {
    const adminSupabase = createAdminClient();

    const sonuclar: { tablo: string; durum: "ok" | "hata"; detay?: string }[] = [];

    for (const tablo of SILINECEK_TABLOLAR) {
      // Tüm satırları sil: created_at her hedef tabloda mevcut (DB'den doğrulandı).
      const { error } = await adminSupabase
        .from(tablo)
        .delete()
        .gte("created_at", "1970-01-01");

      if (error) {
        sonuclar.push({ tablo, durum: "hata", detay: error.message });
      } else {
        sonuclar.push({ tablo, durum: "ok" });
      }
    }

    const basarili = sonuclar.filter(s => s.durum === "ok").length;
    const basarisiz = sonuclar.filter(s => s.durum === "hata").length;

    return NextResponse.json({
      mesaj: `Test verileri silindi. ${basarili} tablo temizlendi${basarisiz > 0 ? `, ${basarisiz} tabloda hata oluştu` : ""}.`,
      detay: sonuclar,
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "POST /admin/api/test-verileri-sil");
  }
}