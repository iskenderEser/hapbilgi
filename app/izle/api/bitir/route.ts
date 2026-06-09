// app/izle/api/bitir/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { kazanilanPuanKaydet } from "@/lib/puan/kayit";

// İzleme tarihinin ait olduğu haftanın Pazartesi 00:00'ını döndürür
function haftaninBaslangici(tarih: Date): Date {
  const sonuc = new Date(tarih);
  const gun = sonuc.getDay(); // 0=Pazar, 1=Pazartesi, ..., 6=Cumartesi
  const pazartesiyeFark = gun === 0 ? -6 : 1 - gun;
  sonuc.setDate(sonuc.getDate() + pazartesiyeFark);
  sonuc.setHours(0, 0, 0, 0);
  return sonuc;
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
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

    const gun = baslangicTarihi.getDay();
    const dakikaCinsinden = baslangicTarihi.getHours() * 60 + baslangicTarihi.getMinutes();
    const puanKazanabilir = gun >= 1 && gun <= 5 && dakikaCinsinden >= 420 && dakikaCinsinden <= 1229;

    if (!puanKazanabilir) {
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

    // İzleme puanı her zaman TAM yazılır.
    // İleri sarma kaybı ayrı tabloda (ileri_sarma_kayitlari) tutulur; çift sayım önlenmiş olur.

    const { data: oncekiPuan, error: opError } = await adminSupabase
      .from("kazanilan_puanlar")
      .select("kazanilan_puan_id")
      .eq("yayin_id", izleme.yayin_id)
      .eq("kullanici_id", user.id)
      .eq("puan_turu", "izleme")
      .limit(1);

    if (opError) {
      console.error("[UYARI] Önceki puan kontrolü yapılamadı:", { yayin_id: izleme.yayin_id, hata: opError.message });
    }

    const kazanilanPuanlar = [];
    const ilkIzleme = (oncekiPuan ?? []).length === 0;

    if (ilkIzleme && video_puani > 0) {
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
    } else if (!ilkIzleme && !ileriSarildi && izleme.izleme_turu === "kendi_kendine") {
      // İlk izleme değilse ve kendi_kendine türündeyse izleme türünü 'extra' olarak işaretle
      await adminSupabase
        .from("izleme_kayitlari")
        .update({ izleme_turu: "extra" })
        .eq("izleme_id", izleme_id);

      const haftaBaslangic = haftaninBaslangici(baslangicTarihi);

      const { count: haftaIzlemeSayisi, error: hiError } = await adminSupabase
        .from("izleme_kayitlari")
        .select("izleme_id", { count: "exact", head: true })
        .eq("yayin_id", izleme.yayin_id)
        .eq("kullanici_id", user.id)
        .eq("tamamlandi_mi", true)
        .gte("izleme_baslangic", haftaBaslangic.toISOString());

      if (hiError) {
        console.error("[UYARI] Haftalık izleme sayısı kontrol edilemedi:", { hata: hiError.message });
      } else if ((haftaIzlemeSayisi ?? 0) === 4) {
        // Bu haftaya ait extra puan kaydı var mı? (mükerrer önleme)
        const { data: extraKayit, error: ekError } = await adminSupabase
          .from("kazanilan_puanlar")
          .select("kazanilan_puan_id")
          .eq("yayin_id", izleme.yayin_id)
          .eq("kullanici_id", user.id)
          .eq("puan_turu", "extra")
          .gte("created_at", haftaBaslangic.toISOString())
          .limit(1);

        if (ekError) {
          console.error("[UYARI] Extra puan kontrolü yapılamadı:", { hata: ekError.message });
        } else if ((extraKayit ?? []).length === 0) {
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
        const oneriBaslangic = new Date(oneri.oneri_baslangic);
        const oneriBitis = new Date(oneri.oneri_bitis);

        if (baslangicTarihi >= oneriBaslangic && baslangicTarihi <= oneriBitis) {
          // Öneri puanı kontrolü — bu yayın için aynı kullanıcıya daha önce öneri puanı verilmiş mi?
          const { data: oncekiOneriPuan, error: oopError } = await adminSupabase
            .from("kazanilan_puanlar")
            .select("kazanilan_puan_id")
            .eq("yayin_id", izleme.yayin_id)
            .eq("kullanici_id", user.id)
            .eq("puan_turu", "oneri")
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