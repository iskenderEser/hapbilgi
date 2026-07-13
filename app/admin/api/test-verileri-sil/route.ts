// app/admin/api/test-verileri-sil/route.ts
//
// Test ortamında üretim/izleme/etkileşim kayıtlarını topluca siler.
// Kapsam (12.07.2026 genişletmesi — kalite kontrol sonrası): iç müşteri +
// Challenge Club + E-Club + Eczanem + HBStore işlem kayıtları.
//
// Yapısal ve KİMLİK verisi korunur: firmalar, takimlar, bolgeler,
// kullanicilar, urunler, teknikler, kategoriler, silinmis_kullanicilar,
// eclub_kisiler, eclub_eczaneler (+master/firma/kisi_eczane bağları),
// eclub_takim_adlari, eczanem_musteriler, eczanem_uyelikler,
// eczanem_urun_tarifeleri, store/eclub-store ürün-kategori katalogları,
// sistem_ayarlari, analiz_* yapılandırması. Kimlik tabloları bilinçli
// korunur: satırları silinirse bağlı auth kullanıcıları sahipsiz kalır
// (denetim:tutarlilik td10 ihlali — B-15 emsali).
//
// STOK İADESİ: siparişler silinmeden önce, iptal edilmemiş siparişlerin
// düşürdüğü stok ürünlere geri eklenir (iptal akışı stoğu zaten iade
// ettiğinden 'iptal' durumundakiler hariç). Eczanem'de stok kavramı yoktur.
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
import { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi } from "@/lib/utils/hataIsle";

// FK sırasına göre: çocuk kayıtlar önce, ebeveynler sonra.
// (information_schema FK çıktısından topolojik olarak hesaplandı, 12.07.2026.)
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
  // E-Club (çocuk → ebeveyn; kisiler/eczaneler KORUNUR)
  "eclub_store_siparis_firma_puan",
  "eclub_store_siparisler",
  "eclub_store_adresler",
  "eclub_kazanilan_puanlar",
  "eclub_yanlis_cevap_kayitlari",
  "eclub_dogru_cevap_kayitlari",
  "eclub_utt_puanlari",
  "eclub_oneri_kayip_kayitlari",
  "eclub_bildirimler",
  "eclub_izleme_kayitlari",
  "eclub_oneri_kayitlari",
  // Eczanem (çocuk → ebeveyn; musteriler/uyelikler/tarifeler KORUNUR)
  "eczanem_harcama_kayitlari",
  "eczanem_siparisler",
  "eczanem_puan_kayitlari",
  "eczanem_izleme_kayitlari",
  "eczanem_gonderimler",
  "eczanem_eczane_gonderimleri",
  "eczanem_giris_otp",
  "eczanem_davetler",
  // HBStore (çocuk → ebeveyn; urunler/kategoriler KORUNUR)
  "store_puan_harcamalari",
  "store_siparisler",
  "store_adresler",
  // Orta katman
  "cc_izleme_kayitlari",
  "izleme_kayitlari",
  "challenge_kayitlari",
  "oneri_kayitlari",
  "yayin_tekrar_kayitlari",
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

type IslemSonucu = { tablo: string; durum: "ok" | "hata"; detay?: string };

// İptal edilmemiş siparişlerin düşürdüğü stoğu ürünlere geri ekler.
// Siparişler hemen ardından silineceği için iade hesabı basittir:
// ürün başına SUM(adet), durum <> 'iptal'.
async function stokIadeEt(
  adminSupabase: SupabaseClient,
  siparisTablosu: "store_siparisler" | "eclub_store_siparisler",
  urunTablosu: "store_urunler" | "eclub_store_urunler",
): Promise<IslemSonucu> {
  const etiket = `${urunTablosu} stok iadesi`;

  const { data: siparisler, error } = await adminSupabase
    .from(siparisTablosu)
    .select("urun_id, adet")
    .neq("durum", "iptal");
  if (error) return { tablo: etiket, durum: "hata", detay: error.message };

  const toplamlar = new Map<string, number>();
  for (const s of siparisler ?? []) {
    toplamlar.set(s.urun_id, (toplamlar.get(s.urun_id) ?? 0) + (s.adet ?? 0));
  }

  for (const [urunId, adet] of toplamlar) {
    if (adet <= 0) continue;
    const { data: urun, error: uError } = await adminSupabase
      .from(urunTablosu)
      .select("stok")
      .eq("urun_id", urunId)
      .single();
    if (uError || !urun) {
      return { tablo: etiket, durum: "hata", detay: `urun_id ${urunId}: ${uError?.message ?? "ürün bulunamadı"}` };
    }
    const { error: gError } = await adminSupabase
      .from(urunTablosu)
      .update({ stok: (urun.stok ?? 0) + adet })
      .eq("urun_id", urunId);
    if (gError) {
      return { tablo: etiket, durum: "hata", detay: `urun_id ${urunId}: ${gError.message}` };
    }
  }

  return { tablo: `${etiket} (${toplamlar.size} ürün)`, durum: "ok" };
}

export async function POST() {
  try {
    const adminSupabase = createAdminClient();

    const sonuclar: IslemSonucu[] = [];

    // 1) Stok iadesi — siparişler silinmeden ÖNCE (iki store; Eczanem'de stok yok).
    sonuclar.push(await stokIadeEt(adminSupabase, "store_siparisler", "store_urunler"));
    sonuclar.push(await stokIadeEt(adminSupabase, "eclub_store_siparisler", "eclub_store_urunler"));

    // 2) Silme — FK sırasıyla.
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