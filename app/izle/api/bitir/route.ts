import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  hataYaniti,
  veriKontrol,
  sunucuHatasi,
  yetkiHatasi,
  rolHatasi,
  validasyonHatasi,
  isKuraluHatasi,
} from "@/lib/utils/hataIsle";
import { kazanilanPuanKaydet } from "@/lib/tclub/puan/kayit";
import { izlemePuanZamaniAktifMi } from "@/lib/izleme/puanZamani";
import { extraPuanEsikKarsilandi } from "@/lib/tclub/puan/strateji";
import { tamTekrarSayisi } from "@/lib/tclub/puan/tekrarSayim";
import { oneriPenceresiAcik } from "@/lib/tclub/oneri/pencereKontrol";
import { gecerliTur } from "@/lib/tclub/tur/kayit";
import { izlemeKazanimKarariBelirle, soruHakkiBelirle } from "@/lib/izleme/karar";
import { rastgeleSoruSec } from "@/lib/soru/secim";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { TUKETICI_ROLLER } from "@/lib/utils/roller";
import { tamamlamaKanitiDogrula } from "@/lib/ogrenmeAraci/sozlesme";
import { yayinAraciKullanimaAcikMi } from "@/lib/ogrenmeAraci/bayraklar";

const VARSAYILAN_SORU_SAYISI = 2;

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const rol = await rolCozucu(adminSupabase, user.id);
    if (!TUKETICI_ROLLER.includes(rol)) return rolHatasi("Sadece utt ve kd_utt izleyebilir.");

    const body = await request.json();
    const { izleme_id } = body;
    if (!izleme_id) return validasyonHatasi("izleme_id zorunludur.", ["izleme_id"]);

    const { data: izleme, error: izlemeError } = await adminSupabase
      .from("izleme_kayitlari")
      .select("izleme_id, yayin_id, kullanici_id, izleme_turu, oneri_id, tamamlandi_mi, gercek_oynatma_mi, izleme_baslangic, video_suresi_saniye, soru_hakki_var_mi, soru_hakki_nedeni, soru_indeksleri, tamamlama_kaniti")
      .eq("izleme_id", izleme_id)
      .single();

    const izlemeKontrol = veriKontrol(izleme, "izleme_kayitlari tablosu SELECT — izleme_id kontrolü", "İzleme kaydı bulunamadı.");
    if (!izlemeKontrol.gecerli) return izlemeKontrol.yanit;
    if (izlemeError) return hataYaniti("İzleme kaydı sorgulanırken hata oluştu.", "izleme_kayitlari tablosu SELECT", izlemeError, 404);
    if (izleme.kullanici_id !== user.id) return rolHatasi("Bu izleme kaydına erişim yetkiniz yok.");
    if (!izleme.gercek_oynatma_mi) return isKuraluHatasi("Gerçek oynatma başlamadan izleme tamamlanamaz.");

    const baslangicTarihi = new Date(izleme.izleme_baslangic);
    const puanliZaman = await izlemePuanZamaniAktifMi(adminSupabase, baslangicTarihi);

    const { data: yayin, error: yayinError } = await adminSupabase
      .from("yayin_yonetimi")
      .select("soru_seti_durum_id, extra_puan, durum")
      .eq("yayin_id", izleme.yayin_id)
      .single();
    if (yayinError || !yayin) {
      return hataYaniti("Yayın bilgisi alınamadı.", "yayin_yonetimi SELECT — izleme tamamlama", yayinError, 404);
    }
    if (yayin.durum !== "yayinda") return isKuraluHatasi("Yayın artık aktif değil.");

    const { data: yayinDetay, error: detayError } = await adminSupabase
      .from("v_yayin_detay")
      .select("video_puani, sorular, video_basi_soru_sayisi, arac_turu")
      .eq("yayin_id", izleme.yayin_id)
      .single();
    if (detayError || !yayinDetay) {
      return hataYaniti("Yayın puan ve soru bilgisi alınamadı.", "v_yayin_detay SELECT — izleme tamamlama", detayError, 404);
    }
    if (!yayinAraciKullanimaAcikMi(yayinDetay.arac_turu)) return isKuraluHatasi("Bu öğrenme aracı kullanıma kapalı.");
    if (yayinDetay.arac_turu === "podcast" && !tamamlamaKanitiDogrula("podcast", izleme.tamamlama_kaniti)) return isKuraluHatasi("Podcast tamamlanma kanıtı doğrulanamadı.");
    if (yayinDetay.arac_turu === "gorsel" && !tamamlamaKanitiDogrula("gorsel", izleme.tamamlama_kaniti)) return isKuraluHatasi("Görsel tamamlanma kanıtı doğrulanamadı.");
    if (yayinDetay.arac_turu === "flip_pdf" && !tamamlamaKanitiDogrula("flip_pdf", izleme.tamamlama_kaniti)) return isKuraluHatasi("Flip PDF tamamlanma kanıtı doğrulanamadı.");

    const turSonuc = await gecerliTur(adminSupabase, izleme.yayin_id);
    if (!turSonuc.ok) {
      console.error("[UYARI] Geçerli tur çözülemedi, ömür boyu tekillik uygulanacak:", {
        yayin_id: izleme.yayin_id,
        hata: turSonuc.error,
      });
    }
    const turBaslangic = new Date(turSonuc.tur?.baslangic_tarihi ?? "2000-01-01T00:00:00Z");

    const { data: ileriSarmalar, error: ileriSarmaError } = await adminSupabase
      .from("ileri_sarma_kayitlari")
      .select("kayit_id, atlanan_sure")
      .eq("izleme_id", izleme_id);
    if (ileriSarmaError) {
      return hataYaniti("İleri sarma kayıtları doğrulanamadı.", "ileri_sarma_kayitlari SELECT — izleme tamamlama", ileriSarmaError);
    }
    const ileriSarildi = (ileriSarmalar ?? []).length > 0;

    let soruHakkiVarMi = izleme.soru_hakki_var_mi ?? false;
    let soruHakkiNedeni = izleme.soru_hakki_nedeni ?? "tamamlanmadi";
    let soruIndeksleri = (izleme.soru_indeksleri as number[] | null) ?? null;

    if (!izleme.tamamlandi_mi) {
      const { data: oncekiDenemeler, error: oncekiDenemeError } = await adminSupabase
        .from("izleme_kayitlari")
        .select("izleme_id, tamamlandi_mi")
        .eq("yayin_id", izleme.yayin_id)
        .eq("kullanici_id", user.id)
        .eq("gercek_oynatma_mi", true)
        .gte("izleme_baslangic", turBaslangic.toISOString())
        .lt("izleme_baslangic", izleme.izleme_baslangic)
        .neq("izleme_id", izleme_id);
      if (oncekiDenemeError) {
        return hataYaniti("Önceki izleme denemeleri doğrulanamadı.", "izleme_kayitlari SELECT — soru hakkı", oncekiDenemeError);
      }

      const soruKarari = soruHakkiBelirle({
        tamamlandi: true,
        puanliZaman,
        oncekiGercekDenemeVar: (oncekiDenemeler ?? []).length > 0,
        oncekiTamamlanmisDenemeVar: (oncekiDenemeler ?? []).some((d) => d.tamamlandi_mi === true),
        mevcutDenemedeIleriSarmaVar: ileriSarildi,
      });
      soruHakkiVarMi = soruKarari.varMi;
      soruHakkiNedeni = soruKarari.neden;

      if (soruHakkiVarMi) {
        const sorular = Array.isArray(yayinDetay.sorular) ? yayinDetay.sorular : [];
        const soruSayisi = yayinDetay.video_basi_soru_sayisi ?? VARSAYILAN_SORU_SAYISI;
        if (soruSayisi <= 0 || sorular.length < soruSayisi) {
          return hataYaniti(
            `Soru setinde yeterli soru bulunamadı. Gerekli: ${soruSayisi}, mevcut: ${sorular.length}`,
            "v_yayin_detay — tamamlama soru seçimi",
            null
          );
        }
        soruIndeksleri = rastgeleSoruSec(sorular, soruSayisi).map((s) => s.orijinalIndex);
      }
    }

    const { data: tamamlamaSatirlari, error: tamamlamaError } = await adminSupabase.rpc("utt_izleme_tamamla", {
      p_izleme_id: izleme_id,
      p_kullanici_id: user.id,
      p_soru_hakki_var_mi: soruHakkiVarMi,
      p_soru_hakki_nedeni: soruHakkiNedeni,
      p_soru_indeksleri: soruIndeksleri,
    });
    if (tamamlamaError) {
      if (tamamlamaError.code === "P0001") {
        return isKuraluHatasi("Video henüz tamamlanabilecek kadar oynatılmadı.");
      }
      return hataYaniti("İzleme tamamlanamadı.", "utt_izleme_tamamla RPC", tamamlamaError);
    }
    const tamamlama = tamamlamaSatirlari?.[0];
    if (!tamamlama?.tamamlandi_mi) {
      return hataYaniti("İzleme tamamlanamadı.", "utt_izleme_tamamla RPC — dönen veri", null);
    }

    soruHakkiVarMi = tamamlama.soru_hakki_var_mi === true;
    soruHakkiNedeni = tamamlama.soru_hakki_nedeni ?? "tamamlanmadi";

    const { data: turIzlemePuanlari, error: oncekiPuanError } = await adminSupabase
      .from("kazanilan_puanlar")
      .select("kazanilan_puan_id, izleme_id, puan_turu, puan")
      .eq("yayin_id", izleme.yayin_id)
      .eq("kullanici_id", user.id)
      .eq("puan_turu", "izleme")
      .gte("created_at", turBaslangic.toISOString());
    if (oncekiPuanError) {
      return hataYaniti("Önceki izleme puanı doğrulanamadı.", "kazanilan_puanlar SELECT — geçerli tur", oncekiPuanError);
    }

    const buIzlemeninPuaniVar = (turIzlemePuanlari ?? []).some((p) => p.izleme_id === izleme_id);
    const baskaIzlemePuaniVar = (turIzlemePuanlari ?? []).some((p) => p.izleme_id !== izleme_id);
    const puanUyarilari: string[] = [];

    const izlemeKazanimKarari = izlemeKazanimKarariBelirle({
      tamamlandi: true,
      puanliZaman,
      dahaOnceIzlemePuaniVar: buIzlemeninPuaniVar || baskaIzlemePuaniVar,
      videoPuani: yayinDetay.video_puani ?? 0,
    });
    if (izlemeKazanimKarari.puanVer) {
      const sonuc = await kazanilanPuanKaydet(adminSupabase, {
        kullanici_id: user.id,
        yayin_id: izleme.yayin_id,
        izleme_id,
        puan_turu: "izleme",
        puan: izlemeKazanimKarari.puan,
      });
      if (!sonuc.ok && sonuc.errorCode !== "23505") {
        puanUyarilari.push("İzleme puanı kaydedilemedi; aynı tamamlamayı yeniden deneyebilirsiniz.");
      }
    }

    // İlk puan daha önce kazanılmışsa temiz kendi-kendine tekrar, extra sayımına girer.
    if (
      puanliZaman
      && !ileriSarildi
      && baskaIzlemePuaniVar
      && !buIzlemeninPuaniVar
      && izleme.izleme_turu === "kendi_kendine"
    ) {
      const { error: turError } = await adminSupabase
        .from("izleme_kayitlari")
        .update({ izleme_turu: "extra" })
        .eq("izleme_id", izleme_id);
      if (turError) {
        puanUyarilari.push("Tekrar izleme kaydı extra sayımına alınamadı.");
      } else {
        const sayim = await tamTekrarSayisi(adminSupabase, user.id, izleme.yayin_id, turBaslangic);
        if (sayim.ok && extraPuanEsikKarsilandi(sayim.sayi) && (yayin.extra_puan ?? 0) > 0) {
          const sonuc = await kazanilanPuanKaydet(adminSupabase, {
            kullanici_id: user.id,
            yayin_id: izleme.yayin_id,
            izleme_id,
            puan_turu: "extra",
            puan: yayin.extra_puan ?? 0,
          });
          if (!sonuc.ok && sonuc.errorCode !== "23505") puanUyarilari.push("Extra puan kaydedilemedi.");
        } else if (!sayim.ok) {
          puanUyarilari.push("Extra tekrar sayısı doğrulanamadı.");
        }
      }
    }

    // Öneri ödülü yalnız temiz tamamlamada; kayıp kayıtları ayrı defterde kalır.
    if (puanliZaman && !ileriSarildi && izleme.izleme_turu === "oneri" && izleme.oneri_id) {
      const { data: oneri, error: oneriError } = await adminSupabase
        .from("oneri_kayitlari")
        .select("oneri_id, oneri_baslangic, oneri_bitis, izlendi_mi")
        .eq("oneri_id", izleme.oneri_id)
        .single();
      if (oneriError || !oneri) {
        puanUyarilari.push("Öneri kaydı doğrulanamadı.");
      } else if (oneriPenceresiAcik(oneri.oneri_baslangic, oneri.oneri_bitis, baslangicTarihi).acik) {
        const { data: oncekiOneriPuani, error: oneriPuanError } = await adminSupabase
          .from("kazanilan_puanlar")
          .select("kazanilan_puan_id")
          .eq("yayin_id", izleme.yayin_id)
          .eq("kullanici_id", user.id)
          .eq("puan_turu", "oneri")
          .gte("created_at", turBaslangic.toISOString())
          .limit(1);

        if (oneriPuanError) {
          puanUyarilari.push("Öneri puanı geçmişi doğrulanamadı.");
        } else if ((oncekiOneriPuani ?? []).length === 0) {
          const { data: ayar, error: ayarError } = await adminSupabase
            .from("sistem_ayarlari")
            .select("deger")
            .eq("anahtar", "oneri_puani")
            .single();
          const oneriPuani = Number(ayar?.deger ?? 0);
          if (ayarError) {
            puanUyarilari.push("Öneri puanı ayarı okunamadı.");
          } else if (oneriPuani > 0) {
            const sonuc = await kazanilanPuanKaydet(adminSupabase, {
              kullanici_id: user.id,
              yayin_id: izleme.yayin_id,
              izleme_id,
              puan_turu: "oneri",
              puan: oneriPuani,
            });
            if (!sonuc.ok && sonuc.errorCode !== "23505") puanUyarilari.push("Öneri puanı kaydedilemedi.");
          }
        }

        if (!oneri.izlendi_mi) {
          await adminSupabase.from("oneri_kayitlari").update({ izlendi_mi: true }).eq("oneri_id", oneri.oneri_id);
        }
        await adminSupabase
          .from("bildirimler")
          .update({ goruldu_mu: true })
          .eq("kayit_turu", "oneri")
          .eq("kayit_id", oneri.oneri_id)
          .eq("alici_id", user.id);
      }
    }

    // İdempotent yanıt: bu çağrıda veya önceki ağ denemesinde yazılan kalemler.
    const { data: mevcutKazanclar, error: mevcutKazancError } = await adminSupabase
      .from("kazanilan_puanlar")
      .select("puan_turu, puan")
      .eq("izleme_id", izleme_id)
      .in("puan_turu", ["izleme", "extra", "oneri"]);
    if (mevcutKazancError) {
      return hataYaniti("Tamamlama puanları okunamadı.", "kazanilan_puanlar SELECT — idempotent yanıt", mevcutKazancError);
    }
    const kazanilanPuanlar = (mevcutKazanclar ?? []).map((p) => ({ tur: p.puan_turu, puan: p.puan }));

    return NextResponse.json({
      mesaj: puanliZaman
        ? "İzleme tamamlandı."
        : "İzleme tamamlandı. Puan kazanma saatleri dışında olduğu için puan verilmedi.",
      puan_kazanildi: kazanilanPuanlar.length > 0,
      kazanilan_puanlar: kazanilanPuanlar,
      puan_uyarisi: puanUyarilari.length > 0 ? puanUyarilari.join(" ") : null,
      soru_gosterilecek: soruHakkiVarMi,
      soru_hakki_nedeni: soruHakkiNedeni,
      ileri_sarildi: ileriSarildi,
      tekrar_istek: tamamlama.yeni_tamamlandi !== true,
    }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "PUT /izle/api/bitir");
  }
}
