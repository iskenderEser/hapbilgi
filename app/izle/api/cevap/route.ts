// app/izle/api/cevap/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { kazanilanPuanKaydet, yanlisCevapKaybiKaydet } from "@/lib/tclub/puan/kayit";
import { cevapDogruMu } from "@/lib/soru/kontrol";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { TUKETICI_ROLLER } from "@/lib/utils/roller";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!TUKETICI_ROLLER.includes(rol)) return rolHatasi("Sadece utt ve kd_utt cevap verebilir.");

    const body = await request.json();
    const { izleme_id, cevaplar } = body;

    if (!izleme_id) return validasyonHatasi("izleme_id zorunludur.", ["izleme_id"]);
    if (!cevaplar || !Array.isArray(cevaplar) || cevaplar.length === 0) {
      return validasyonHatasi("cevaplar dizisi zorunludur ve en az 1 cevap içermelidir.", ["cevaplar"]);
    }

    const { data: izleme, error: izlemeError } = await adminSupabase
      .from("izleme_kayitlari")
      .select("izleme_id, yayin_id, kullanici_id, tamamlandi_mi, soru_hakki_var_mi, soru_hakki_nedeni, soru_indeksleri")
      .eq("izleme_id", izleme_id)
      .single();

    const izlemeKontrol = veriKontrol(izleme, "izleme_kayitlari tablosu SELECT — izleme_id kontrolü", "İzleme kaydı bulunamadı.");
    if (!izlemeKontrol.gecerli) return izlemeKontrol.yanit;
    if (izlemeError) return hataYaniti("İzleme kaydı sorgulanırken hata oluştu.", "izleme_kayitlari tablosu SELECT", izlemeError, 404);
    if (izleme.kullanici_id !== user.id) return rolHatasi("Bu izleme kaydına erişim yetkiniz yok.");
    if (!izleme.tamamlandi_mi) return isKuraluHatasi("Cevaplar ancak video tamamlandıktan sonra gönderilebilir.");
    if (!izleme.soru_hakki_var_mi) {
      return isKuraluHatasi(`Bu izleme için soru hakkı bulunmuyor (${izleme.soru_hakki_nedeni ?? "uygun_degil"}).`);
    }

    const atanmisIndeksler = izleme.soru_indeksleri as number[] | null;
    const gelenIndeksler = cevaplar.map((cevap: any) => cevap?.soru_index);
    const gelenBenzersiz = new Set(gelenIndeksler);
    if (
      !Array.isArray(atanmisIndeksler)
      || atanmisIndeksler.length === 0
      || gelenBenzersiz.size !== gelenIndeksler.length
      || gelenIndeksler.length !== atanmisIndeksler.length
      || gelenIndeksler.some((indeks: unknown) => typeof indeks !== "number" || !atanmisIndeksler.includes(indeks))
      || cevaplar.some((cevap: any) => typeof cevap?.verilen_cevap !== "string" || cevap.verilen_cevap.trim().length === 0)
    ) {
      return validasyonHatasi("Cevaplar, izlemeye atanmış soru kümesiyle birebir eşleşmelidir.", ["cevaplar"]);
    }

    const { data: oncekiCevap, error: ocError } = await adminSupabase
      .from("soru_cevaplari")
      .select("soru_cevap_id")
      .eq("izleme_id", izleme_id)
      .limit(1);

    if (ocError) return hataYaniti("Önceki cevaplar kontrol edilemedi.", "soru_cevaplari tablosu SELECT — izleme_id kontrolü", ocError);
    if ((oncekiCevap ?? []).length > 0) return isKuraluHatasi("Bu izleme için sorular zaten cevaplandı.");

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

    // Soru bazlı puanları topluca çek — soru_seti_puanlari her soru için ayrı satır tutar
    // (soru_index 0..N-1). Eski kod burada .single() kullanıyordu, PGRST116 fırlatıyordu (Bug 1).
    const { data: soruPuanlari, error: spError } = await adminSupabase
      .from("soru_seti_puanlari")
      .select("soru_index, soru_puani")
      .eq("soru_seti_durum_id", yayin.soru_seti_durum_id);

    if (spError) {
      console.error("[UYARI] Soru puanları çekilemedi:", { soru_seti_durum_id: yayin.soru_seti_durum_id, hata: spError.message });
    }

    const soruPuanMap = new Map<number, number>();
    for (const sp of soruPuanlari ?? []) {
      if (typeof sp.soru_index === "number" && typeof sp.soru_puani === "number") {
        soruPuanMap.set(sp.soru_index, sp.soru_puani);
      }
    }

    if (!Array.isArray(soruSeti.sorular)) {
      return hataYaniti("Soru seti geçerli değil.", "soru_setleri.sorular", null);
    }

    const cevapSonuclari = cevaplar.map((cevap: { soru_index: number; verilen_cevap: string }) => {
      const soru = soruSeti.sorular?.[cevap.soru_index];
      if (!soru) return null;
      const { dogru_mu, dogru_secenek } = cevapDogruMu(soru, cevap.verilen_cevap);
      return {
        soru_index: cevap.soru_index,
        verilen_cevap: cevap.verilen_cevap,
        dogru_mu,
        dogru_cevap: dogru_secenek,
      };
    });
    if (cevapSonuclari.some((sonuc) => sonuc === null)) {
      return validasyonHatasi("Atanmış sorulardan biri soru setinde bulunamadı.", ["cevaplar"]);
    }

    // Tüm cevaplar tek INSERT ifadesinde yazılır: bir satır hata verirse hiçbir
    // cevap kısmen kalmaz. Unique indeks aynı izleme+soruyu ikinci kez engeller.
    const { error: cevapYazmaError } = await adminSupabase
      .from("soru_cevaplari")
      .insert(cevapSonuclari.map((sonuc) => ({
        izleme_id,
        kullanici_id: user.id,
        soru_index: sonuc!.soru_index,
        verilen_cevap: sonuc!.verilen_cevap,
        dogru_mu: sonuc!.dogru_mu,
      })));
    if (cevapYazmaError) {
      if (cevapYazmaError.code === "23505") return isKuraluHatasi("Bu izleme için sorular zaten cevaplandı.");
      return hataYaniti("Cevaplar kaydedilemedi.", "soru_cevaplari toplu INSERT", cevapYazmaError);
    }

    let kazanilanPuan = 0;
    const puanUyarilari: string[] = [];

    for (const cevapSonucu of cevapSonuclari) {
      const { soru_index, dogru_mu } = cevapSonucu!;
      if (dogru_mu) {
        // Doğru cevap → cevaplama puanı. Bu sorunun kendi puanı (soru_puani).
        const o_soru_puani = soruPuanMap.get(soru_index) ?? 0;

        if (o_soru_puani > 0) {
          const sonuc = await kazanilanPuanKaydet(adminSupabase, {
            kullanici_id: user.id,
            yayin_id: izleme.yayin_id,
            izleme_id,
            puan_turu: "cevaplama",
            puan: o_soru_puani,
          });

          // B-08: puan yalnız yazım BAŞARILIYSA sayılır (önceden denemeden önce
          // ekleniyordu — başarısız puan kullanıcıya "kazanıldı" görünüyordu).
          if (sonuc.ok) {
            kazanilanPuan += o_soru_puani;
          } else {
            console.error("[UYARI] Cevaplama puanı kaydedilemedi:", { soru_index, hata: sonuc.error });
            puanUyarilari.push(`Soru ${soru_index + 1} cevap puanı kaydedilemedi.`);
          }
        }
      } else {
        // Yanlış cevap → kayıt anında ayrı tabloya. Rapor anında sadece SUM okunur.
        const o_soru_puani = soruPuanMap.get(soru_index) ?? 0;

        if (o_soru_puani > 0) {
          const sonuc = await yanlisCevapKaybiKaydet(adminSupabase, {
            kullanici_id: user.id,
            yayin_id: izleme.yayin_id,
            izleme_id,
            soru_index,
            kaybedilen_puan: o_soru_puani,
          });

          if (!sonuc.ok) {
            console.error("[UYARI] Yanlış cevap kaybı kaydedilemedi:", { soru_index, hata: sonuc.error });
            puanUyarilari.push(`Soru ${soru_index + 1} kayıt işlemi tamamlanamadı.`);
          }
        }
      }

    }

    return NextResponse.json({
      mesaj: "Cevaplar kaydedildi.",
      sonuclar: cevapSonuclari,
      kazanilan_puan: kazanilanPuan,
      puan_uyarisi: puanUyarilari.length > 0 ? puanUyarilari.join(" ") : null,
    }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /izle/api/cevap");
  }
}
