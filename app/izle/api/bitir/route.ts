// app/izle/api/bitir/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { kazanilanPuanKaydet } from "@/lib/puan/kayit";
import { puanKazanilabilirMi } from "@/lib/zaman/kontrol";
import { izlemeKarariBelirle, extraPuanEsikKarsilandi } from "@/lib/puan/strateji";
import { tamTekrarSayisi } from "@/lib/puan/tekrarSayim";
import { oneriPenceresiAcik } from "@/lib/oneri/pencereKontrol";
import { gecerliTur } from "@/lib/tur/kayit";
import { rolCozucu } from "@/lib/utils/rolCozucu";

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!["utt", "kd_utt"].includes(rol)) return rolHatasi("Sadece utt ve kd_utt izleyebilir.");

    const body = await request.json();
    const { izleme_id, ileri_sarilan_sure } = body;

    if (!izleme_id) return validasyonHatasi("izleme_id zorunludur.", ["izleme_id"]);

    const ileriSarilanSure = Math.round(ileri_sarilan_sure ?? 0);

    const { data: izleme, error: izlemeError } = await adminSupabase
      .from("izleme_kayitlari")
      .select("izleme_id, yayin_id, kullanici_id, izleme_turu, oneri_id, tamamlandi_mi, izleme_baslangic")
      .eq("izleme_id", izleme_id)
      .single();

    const izlemeKontrol = veriKontrol(izleme, "izleme_kayitlari tablosu SELECT — izleme_id kontrolü", "İzleme kaydı bulunamadı.");
    if (!izlemeKontrol.gecerli) return izlemeKontrol.yanit;
    if (izlemeError) return hataYaniti("İzleme kaydı sorgulanırken hata oluştu.", "izleme_kayitlari tablosu SELECT", izlemeError, 404);
    if (izleme.kullanici_id !== user.id) return rolHatasi("Bu izleme kaydına erişim yetkiniz yok.");
    if (izleme.tamamlandi_mi) return isKuraluHatasi("Bu izleme zaten tamamlanmış.");

    const bitisTarihi = new Date();
    const baslangicTarihi = new Date(izleme.izleme_baslangic);

    const { error: updateError } = await adminSupabase
      .from("izleme_kayitlari")
      .update({ tamamlandi_mi: true, izleme_bitis: bitisTarihi.toISOString() })
      .eq("izleme_id", izleme_id);

    if (updateError) return hataYaniti("İzleme tamamlanamadı.", "izleme_kayitlari tablosu UPDATE — tamamlandi_mi", updateError);

    // Puansız zaman kontrolü — izleme başlangıç anına göre.
    // Cmt-Paz tüm gün + Pzt-Cum 20:30-06:59 puansızdır.
    // Bu zamanda: puan yok, kayıp yok, extra sayımı yok, soru yok.
    if (!puanKazanilabilirMi(baslangicTarihi)) {
      return NextResponse.json({
        mesaj: "İzleme tamamlandı. Puan kazanma saatleri (Pzt-Cuma 07:00-20:29) dışında izlendiği için puan verilmedi.",
        puan_kazanildi: false,
        soru_gosterilecek: false,
      }, { status: 200 });
    }

    const { data: yayin, error: yayinError } = await adminSupabase
      .from("yayin_yonetimi")
      .select("soru_seti_durum_id, ileri_sarma_acik, extra_puan")
      .eq("yayin_id", izleme.yayin_id)
      .single();

    if (yayinError || !yayin) {
      console.error("[UYARI] Yayın bilgisi çekilemedi:", { yayin_id: izleme.yayin_id, hata: yayinError?.message });
      return NextResponse.json({ mesaj: "İzleme tamamlandı.", puan_kazanildi: false, soru_gosterilecek: false }, { status: 200 });
    }

    // Geçerli tur — tüm tekillik sorgularının alt sınırı (tur bazlı tekillik).
    // Periyot dolmuşsa gecerliTur yeni turu burada açar (otomatik mekanizma).
    // Başarısızlıkta güvenli geri düşüş: epoch alt sınırı = eski (ömür boyu) davranış;
    // puan fazla verilmez, yalnızca tekrar kazanımı o çağrıda işlemez.
    const turSonuc = await gecerliTur(adminSupabase, izleme.yayin_id);
    if (!turSonuc.ok) {
      console.error("[UYARI] Geçerli tur çözülemedi, ömür boyu tekillik uygulanacak:", { yayin_id: izleme.yayin_id, hata: turSonuc.error });
    }
    const turBaslangic = new Date(turSonuc.tur?.baslangic_tarihi ?? "2000-01-01T00:00:00Z");

    const ileriSarmaAcik = yayin.ileri_sarma_acik ?? false;
    const ileriSarildi = ileriSarmaAcik && ileriSarilanSure > 0;

    const { data: soruSetiDurum, error: ssdError } = await adminSupabase
      .from("soru_seti_durumu")
      .select("soru_seti_id")
      .eq("soru_seti_durum_id", yayin.soru_seti_durum_id)
      .single();

    if (ssdError || !soruSetiDurum) {
      console.error("[UYARI] Soru seti durumu çekilemedi:", { soru_seti_durum_id: yayin.soru_seti_durum_id, hata: ssdError?.message });
      return NextResponse.json({ mesaj: "İzleme tamamlandı.", puan_kazanildi: false, soru_gosterilecek: false }, { status: 200 });
    }

    const { data: soruSeti, error: ssError } = await adminSupabase
      .from("soru_setleri")
      .select("video_durum_id")
      .eq("soru_seti_id", soruSetiDurum.soru_seti_id)
      .single();

    if (ssError || !soruSeti) {
      console.error("[UYARI] Soru seti çekilemedi:", { soru_seti_id: soruSetiDurum.soru_seti_id, hata: ssError?.message });
      return NextResponse.json({ mesaj: "İzleme tamamlandı.", puan_kazanildi: false, soru_gosterilecek: false }, { status: 200 });
    }

    const { data: vPuan } = await adminSupabase
      .from("video_puanlari")
      .select("video_puani")
      .eq("video_durum_id", soruSeti.video_durum_id)
      .single();

    const video_puani = vPuan?.video_puani ?? 0;

    // İlk izleme kontrolü — TUR BAZLI: bu turda kullanıcının 'izleme' puanı var mı?
    // (Önceki turların kayıtları sayılmaz; yeni turda izleme puanı yeniden doğar.)
    const { data: oncekiPuan, error: opError } = await adminSupabase
      .from("kazanilan_puanlar")
      .select("kazanilan_puan_id")
      .eq("yayin_id", izleme.yayin_id)
      .eq("kullanici_id", user.id)
      .eq("puan_turu", "izleme")
      .gte("created_at", turBaslangic.toISOString())
      .limit(1);

    if (opError) {
      console.error("[UYARI] Önceki puan kontrolü yapılamadı:", { yayin_id: izleme.yayin_id, hata: opError.message });
    }

    const ilkIzleme = (oncekiPuan ?? []).length === 0;
    const kazanilanPuanlar: { tur: string; puan: number }[] = [];

    // İzleme karar mantığı — lib/puan/strateji.ts içinde
    const karar = izlemeKarariBelirle(ilkIzleme, ileriSarildi, izleme.izleme_turu);

    if (karar.tur === "ilk_izleme" && video_puani > 0) {
      // İzleme puanı her zaman TAM yazılır.
      // İleri sarma kaybı ayrı tabloda (ileri_sarma_kayitlari) tutulur; çift sayım önlenmiş olur.
      const sonuc = await kazanilanPuanKaydet(adminSupabase, {
        kullanici_id: user.id,
        yayin_id: izleme.yayin_id,
        izleme_id,
        puan_turu: "izleme",
        puan: video_puani,
      });

      if (!sonuc.ok) {
        console.error("[UYARI] İzleme puanı kaydedilemedi:", { izleme_id, hata: sonuc.error });
      } else {
        kazanilanPuanlar.push({ tur: "izleme", puan: video_puani });
      }
    } else if (karar.tur === "extra_aday") {
      // İlk izleme değil + ileri sarılmamış + kendi_kendine → izleme türünü 'extra' işaretle
      await adminSupabase
        .from("izleme_kayitlari")
        .update({ izleme_turu: "extra" })
        .eq("izleme_id", izleme_id);

      // Extra sayım alt sınırı — AY + TUR KESİŞİMLİ (TB2, 09.07.2026):
      // takvim ayı içinde 3. tam tekrarın sonunda TEK extra; ilk izleme sayılmaz
      // (yalnızca 'extra' işaretli, tamamlanmış izlemeler sayılır); her yeni ayda
      // hak yenilenir. Yeni tur ay ortasında açıldıysa önceki turun tekrarları
      // sayılmaz (§9.4). Mükerrer yapısal olarak imkânsız: puan yalnızca
      // sayı === eşik anında düşer (4.+ tekrarlarda koşul bir daha tutmaz),
      // ayrı mükerrer sorgusu bu nedenle kaldırıldı.
      // Sayım TEK KAYNAK'tan (lib/puan/tekrarSayim.ts) — alt sınır max(ay başı, tur başı)
      // fonksiyonun içinde hesaplanır. Ekstra İzlediklerim bölümü de aynı fonksiyon
      // ailesinin toplu imzasını kullanır; iki ekranın farklı sayması yapısal olarak imkânsız.
      const sayim = await tamTekrarSayisi(adminSupabase, user.id, izleme.yayin_id, turBaslangic);

      if (!sayim.ok) {
        console.error("[UYARI] Aylık tam tekrar sayısı kontrol edilemedi:", { hata: sayim.error });
      } else if (extraPuanEsikKarsilandi(sayim.sayi)) {
        const extraPuanDegeri = yayin.extra_puan ?? 0;
        if (extraPuanDegeri > 0) {
          const sonuc = await kazanilanPuanKaydet(adminSupabase, {
            kullanici_id: user.id,
            yayin_id: izleme.yayin_id,
            izleme_id,
            puan_turu: "extra",
            puan: extraPuanDegeri,
          });

          if (!sonuc.ok) {
            console.error("[UYARI] Extra puan kaydedilemedi:", { izleme_id, hata: sonuc.error });
          } else {
            kazanilanPuanlar.push({ tur: "extra", puan: extraPuanDegeri });
          }
        }
      }
    }

    // Öneri puanı bloğu — izleme_turu='oneri' ve ileri sarılmamış izlemeler için
    if (!ileriSarildi && izleme.izleme_turu === "oneri" && izleme.oneri_id) {
      const { data: oneri, error: oneriError } = await adminSupabase
        .from("oneri_kayitlari")
        .select("oneri_id, oneri_baslangic, oneri_bitis, izlendi_mi")
        .eq("oneri_id", izleme.oneri_id)
        .single();

      if (oneriError) {
        console.error("[UYARI] Öneri kaydı sorgulanırken hata:", { oneri_id: izleme.oneri_id, hata: oneriError.message });
      } else if (oneri) {
        // Öneri penceresi kontrolü — izleme başlangıç anı öneri penceresinde mi?
        const pencere = oneriPenceresiAcik(oneri.oneri_baslangic, oneri.oneri_bitis, baslangicTarihi);

        if (pencere.acik) {
          // Öneri puanı kontrolü — TUR BAZLI: bu turda öneri puanı verilmiş mi?
          // ("Yayın-kullanıcı çifti için tek defa" kuralı "tur başına tek defa" olur.)
          const { data: oncekiOneriPuan, error: oopError } = await adminSupabase
            .from("kazanilan_puanlar")
            .select("kazanilan_puan_id")
            .eq("yayin_id", izleme.yayin_id)
            .eq("kullanici_id", user.id)
            .eq("puan_turu", "oneri")
            .gte("created_at", turBaslangic.toISOString())
            .limit(1);

          if (oopError) {
            console.error("[UYARI] Önceki öneri puanı kontrolü yapılamadı:", { hata: oopError.message });
          } else if ((oncekiOneriPuan ?? []).length === 0) {
            // Öneri puanı — sistem_ayarlari tablosundan okunuyor
            const { data: ayar, error: ayarError } = await adminSupabase
              .from("sistem_ayarlari")
              .select("deger")
              .eq("anahtar", "oneri_puani")
              .single();

            if (ayarError || !ayar) {
              console.error("[UYARI] sistem_ayarlari'ndan oneri_puani okunamadı:", { hata: ayarError?.message });
            } else {
              const oneriPuani = Number(ayar.deger);
              if (oneriPuani > 0) {
                const sonuc = await kazanilanPuanKaydet(adminSupabase, {
                  kullanici_id: user.id,
                  yayin_id: izleme.yayin_id,
                  izleme_id,
                  puan_turu: "oneri",
                  puan: oneriPuani,
                });

                if (!sonuc.ok) {
                  console.error("[UYARI] Öneri puanı kaydedilemedi:", { izleme_id, hata: sonuc.error });
                } else {
                  kazanilanPuanlar.push({ tur: "oneri", puan: oneriPuani });
                }
              }
            }
          }

          // Öneri'yi izlendi olarak işaretle
          if (!oneri.izlendi_mi) {
            await adminSupabase
              .from("oneri_kayitlari")
              .update({ izlendi_mi: true })
              .eq("oneri_id", oneri.oneri_id);
          }
          // İlgili bildirimi okundu işaretle — Öneriler pill badge'inin düşmesi için
          await adminSupabase
            .from("bildirimler")
            .update({ goruldu_mu: true })
            .eq("kayit_turu", "oneri")
            .eq("kayit_id", oneri.oneri_id)
            .eq("alici_id", user.id);
        }
      }
    }

    return NextResponse.json({
      mesaj: "İzleme tamamlandı.",
      puan_kazanildi: kazanilanPuanlar.length > 0,
      kazanilan_puanlar: kazanilanPuanlar,
      soru_gosterilecek: ilkIzleme && !ileriSarildi,
      ileri_sarildi: ileriSarildi,
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "PUT /izle/api/bitir");
  }
}