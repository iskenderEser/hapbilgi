// app/admin/api/test-verileri-sil/route.ts
//
// Test ortamında üretim/izleme/etkileşim kayıtlarını topluca siler.
// Yapısal veri korunur: firmalar, takimlar, bolgeler, kullanicilar,
// urunler, teknikler, kategoriler, silinmis_kullanicilar.
//
// Silme sırası FK ilişkilerine göre yavru → ata olacak şekilde dizilmiştir.
// Hata yönetimi: bir tablonun silinmesi başarısız olursa kalan tablolar
// denemeye devam eder; sonuç yanıtında her tablonun durumu listelenir.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi } from "@/lib/utils/hataIsle";

// FK sırasına göre: önce bağımlı kayıtlar, sonra üretim zinciri
const SILINECEK_TABLOLAR = [
  // Bağımlı/yavru kayıtlar
  "kazanilan_puanlar",
  "video_begeniler",
  "video_favoriler",
  "bildirimler",
  "ileri_sarma_kayitlari",
  "challenge_kayitlari",
  "soru_cevaplari",
  "izleme_kayitlari",
  "oneri_kayitlari",
  "hb_ligi",
  // Üretim zinciri (yavru → ata)
  "video_puanlari",
  "soru_seti_puanlari",
  "yayin_yonetimi",
  "soru_seti_durumu",
  "soru_setleri",
  "video_durumu",
  "videolar",
  "senaryo_durumu",
  "senaryolar",
  "talepler",
];

export async function POST() {
  try {
    const adminSupabase = createAdminClient();

    const sonuclar: { tablo: string; durum: "ok" | "hata"; detay?: string }[] = [];

    for (const tablo of SILINECEK_TABLOLAR) {
      // Tüm satırları sil. neq("id", "") gibi sahte filtre yerine,
      // Supabase'de "tüm satırları sil" için yaygın desen: var olmayan UUID ile NOT EQUAL.
      const { error } = await adminSupabase
        .from(tablo)
        .delete()
        .neq("created_at", "1970-01-01");

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