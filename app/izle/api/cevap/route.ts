// app/izle/api/cevap/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["utt", "kd_utt"].includes(rol)) return rolHatasi("Sadece utt ve kd_utt cevap verebilir.");

    const body = await request.json();
    const { izleme_id, cevaplar } = body;

    if (!izleme_id) return validasyonHatasi("izleme_id zorunludur.", ["izleme_id"]);
    if (!cevaplar || !Array.isArray(cevaplar) || cevaplar.length === 0) {
      return validasyonHatasi("cevaplar dizisi zorunludur ve en az 1 cevap içermelidir.", ["cevaplar"]);
    }

    // İzleme kaydını kontrol et
    const { data: izleme, error: izlemeError } = await adminSupabase
      .from("izleme_kayitlari")
      .select("izleme_id, yayin_id, kullanici_id, tamamlandi_mi")
      .eq("izleme_id", izleme_id)
      .single();

    const izlemeKontrol = veriKontrol(izleme, "izleme_kayitlari tablosu SELECT — izleme_id kontrolü", "İzleme kaydı bulunamadı.");
    if (!izlemeKontrol.gecerli) return izlemeKontrol.yanit;
    if (izlemeError) return hataYaniti("İzleme kaydı sorgulanırken hata oluştu.", "izleme_kayitlari tablosu SELECT", izlemeError, 404);
    if (izleme.kullanici_id !== user.id) return rolHatasi("Bu izleme kaydına erişim yetkiniz yok.");
    if (!izleme.tamamlandi_mi) return isKuraluHatasi("Cevaplar ancak video tamamlandıktan sonra gönderilebilir.");

    // Daha önce cevap verildi mi?
    const { data: oncekiCevap, error: ocError } = await adminSupabase
      .from("soru_cevaplari")
      .select("soru_cevap_id")
      .eq("izleme_id", izleme_id)
      .limit(1);

    if (ocError) return hataYaniti("Önceki cevaplar kontrol edilemedi.", "soru_cevaplari tablosu SELECT — izleme_id kontrolü", ocError);
    if ((oncekiCevap ?? []).length > 0) return isKuraluHatasi("Bu izleme için sorular zaten cevaplandı.");

    // Yayın → soru seti zinciri
    const { data: yayin, error: yayinError } = await adminSupabase
      .from("yayin_yonetimi")
      .select("soru_seti_durum_id")
      .eq("yayin_id", izleme.yayin_id)
      .single();

    const yayinKontrol = veriKontrol(yayin, "yayin_yonetimi tablosu SELECT — yayin_id kontrolü", "Yayın bulunamadı.");
    if (!yayinKontrol.gecerli) return yayinKontrol.yanit;
    if (yayinError) return hataYaniti("Yayın sorgulanırken hata oluştu.", "yayin_yonetimi tablosu SELECT", yayinError, 404);

    const { data: soruSetiDurum, error: ssdError } = await adminSupabase
      .from("soru_seti_durumu")
      .select("soru_seti_id")
      .eq("soru_seti_durum_id", yayin.soru_seti_durum_id)
      .single();

    const ssdKontrol = veriKontrol(soruSetiDurum, "soru_seti_durumu tablosu SELECT — soru_seti_durum_id kontrolü", "Soru seti durumu bulunamadı.");
    if (!ssdKontrol.gecerli) return ssdKontrol.yanit;
    if (ssdError) return hataYaniti("Soru seti durumu sorgulanırken hata oluştu.", "soru_seti_durumu tablosu SELECT", ssdError, 404);

    const { data: soruSeti, error: ssError } = await adminSupabase
      .from("soru_setleri")
      .select("sorular")
      .eq("soru_seti_id", soruSetiDurum.soru_seti_id)
      .single();

    const ssKontrol = veriKontrol(soruSeti, "soru_setleri tablosu SELECT — soru_seti_id kontrolü", "Soru seti bulunamadı.");
    if (!ssKontrol.gecerli) return ssKontrol.yanit;
    if (ssError) return hataYaniti("Soru seti sorgulanırken hata oluştu.", "soru_setleri tablosu SELECT", ssError, 404);

    // Soru puanı
    const { data: soruPuan, error: spError } = await adminSupabase
      .from("soru_seti_puanlari")
      .select("soru_puani")
      .eq("soru_seti_durum_id", yayin.soru_seti_durum_id)
      .single();

    if (spError && spError.code !== "PGRST116") {
      console.error("[UYARI] Soru puanı çekilemedi:", { soru_seti_durum_id: yayin.soru_seti_durum_id, hata: spError.message });
    }

    const soru_puani = soruPuan?.soru_puani ?? 0;

    // Her cevabı kaydet ve puanı hesapla
    let kazanilanPuan = 0;
    const cevapSonuclari = [];

    for (const cevap of cevaplar) {
      const { soru_index, verilen_cevap } = cevap;

      if (soru_index === undefined || soru_index === null) {
        console.error("[UYARI] Geçersiz soru_index:", { soru_index });
        continue;
      }

      const soru = soruSeti.sorular?.[soru_index];
      if (!soru) {
        console.error("[UYARI] Soru bulunamadı:", { soru_index, toplam_soru: soruSeti.sorular?.length });
        continue;
      }

      const dogruSecenek = soru.secenekler.find((s: any) => s.dogru);
      const dogru_mu = dogruSecenek?.harf === verilen_cevap;

      const { error: cevapError } = await adminSupabase
        .from("soru_cevaplari")
        .insert({
          izleme_id,
          kullanici_id: user.id,
          soru_index,
          verilen_cevap,
          dogru_mu,
        });

      if (cevapError) {
        console.error("[UYARI] Cevap kaydedilemedi:", { soru_index, hata: cevapError.message });
      }

      if (dogru_mu && soru_puani > 0) {
        kazanilanPuan += soru_puani;
        const { error: puanError } = await adminSupabase
          .from("kazanilan_puanlar")
          .insert({
            kullanici_id: user.id,
            yayin_id: izleme.yayin_id,
            izleme_id,
            puan_turu: "cevaplama",
            puan: soru_puani,
          });

        if (puanError) {
          console.error("[UYARI] Cevaplama puanı kaydedilemedi:", { soru_index, hata: puanError.message });
        }
      }

      cevapSonuclari.push({
        soru_index,
        verilen_cevap,
        dogru_mu,
        dogru_cevap: dogruSecenek?.harf,
      });
    }

    return NextResponse.json({
      mesaj: "Cevaplar kaydedildi.",
      sonuclar: cevapSonuclari,
      kazanilan_puan: kazanilanPuan,
    }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /izle/api/cevap");
  }
}