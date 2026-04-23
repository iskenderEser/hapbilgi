// app/izle/api/bitir/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";

async function videoDuresiGetir(video_url: string): Promise<number> {
  try {
    const videoId = video_url.match(/\/([0-9a-f-]{36})\/?(?:\?.*)?$/)?.[1];
    if (!videoId) return 0;

    const res = await fetch(`https://video.bunnycdn.com/library/${process.env.BUNNY_LIBRARY_ID}/videos/${videoId}`, {
      headers: {
        AccessKey: process.env.BUNNY_API_KEY ?? "",
        accept: "application/json",
      },
    });

    if (!res.ok) return 0;
    const data = await res.json();
    return data.length ?? 0;
  } catch {
    return 0;
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["utt", "kd_utt"].includes(rol)) return rolHatasi("Sadece utt ve kd_utt izleyebilir.");

    const body = await request.json();
    const { izleme_id, ileri_sarilan_sure } = body;

    if (!izleme_id) return validasyonHatasi("izleme_id zorunludur.", ["izleme_id"]);

    const ileriSarilanSure = Math.round(ileri_sarilan_sure ?? 0);

    // İzleme kaydını çek
    const { data: izleme, error: izlemeError } = await adminSupabase
      .from("izleme_kayitlari")
      .select("izleme_id, yayin_id, kullanici_id, izleme_turu, tamamlandi_mi, izleme_baslangic")
      .eq("izleme_id", izleme_id)
      .single();

    const izlemeKontrol = veriKontrol(izleme, "izleme_kayitlari tablosu SELECT — izleme_id kontrolü", "İzleme kaydı bulunamadı.");
    if (!izlemeKontrol.gecerli) return izlemeKontrol.yanit;
    if (izlemeError) return hataYaniti("İzleme kaydı sorgulanırken hata oluştu.", "izleme_kayitlari tablosu SELECT", izlemeError, 404);
    if (izleme.kullanici_id !== user.id) return rolHatasi("Bu izleme kaydına erişim yetkiniz yok.");
    if (izleme.tamamlandi_mi) return isKuraluHatasi("Bu izleme zaten tamamlanmış.");

    const bitisTarihi = new Date();
    const baslangicTarihi = new Date(izleme.izleme_baslangic);

    // İzlemeyi tamamla
    const { error: updateError } = await adminSupabase
      .from("izleme_kayitlari")
      .update({ tamamlandi_mi: true, izleme_bitis: bitisTarihi.toISOString() })
      .eq("izleme_id", izleme_id);

    if (updateError) return hataYaniti("İzleme tamamlanamadı.", "izleme_kayitlari tablosu UPDATE — tamamlandi_mi", updateError);

    // Puan kazanma zaman kontrolü
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

    // Yayın bilgisi — ileri_sarma_acik dahil
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

    // Video puanı zinciri
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

    // İleri sarma varsa puan hesapla
    let kazanilacakIzlemePuani = video_puani;
    if (ileriSarildi && video_puani > 0) {
      // Video süresi Bunny.net'ten çek
      const { data: videoKayit } = await adminSupabase
        .from("videolar")
        .select("video_url")
        .eq("video_durum_id", soruSeti.video_durum_id)
        .single();

      const videoSuresi = videoKayit?.video_url ? await videoDuresiGetir(videoKayit.video_url) : 0;

      if (videoSuresi > 0) {
        const saniyeBasiPuan = video_puani / videoSuresi;
        const kayipPuan = Math.round(saniyeBasiPuan * ileriSarilanSure);
        kazanilacakIzlemePuani = Math.max(0, video_puani - kayipPuan);
      }
    }

    // Daha önce bu videodan puan aldı mı?
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

    if (ilkIzleme && kazanilacakIzlemePuani > 0) {
      const { error: pError } = await adminSupabase
        .from("kazanilan_puanlar")
        .insert({ kullanici_id: user.id, yayin_id: izleme.yayin_id, izleme_id, puan_turu: "izleme", puan: kazanilacakIzlemePuani });

      if (pError) {
        console.error("[UYARI] İzleme puanı kaydedilemedi:", { izleme_id, hata: pError.message });
      } else {
        kazanilanPuanlar.push({ tur: "izleme", puan: kazanilacakIzlemePuani });
      }
    } else if (!ilkIzleme && !ileriSarildi && !ileriSarmaAcik) {
      // Tekrar izleme, ileri sarma kapalı video — extra puan kontrolü
      const haftaBaslangic = new Date(baslangicTarihi);
      haftaBaslangic.setDate(baslangicTarihi.getDate() - baslangicTarihi.getDay() + 1);
      haftaBaslangic.setHours(0, 0, 0, 0);

      const { count: haftaIzlemeSayisi, error: hiError } = await adminSupabase
        .from("izleme_kayitlari")
        .select("izleme_id", { count: "exact", head: true })
        .eq("yayin_id", izleme.yayin_id)
        .eq("kullanici_id", user.id)
        .eq("tamamlandi_mi", true)
        .gte("izleme_baslangic", haftaBaslangic.toISOString());

      if (hiError) {
        console.error("[UYARI] Haftalık izleme sayısı kontrol edilemedi:", { hata: hiError.message });
      } else if ((haftaIzlemeSayisi ?? 0) === 3) {
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
            const { error: epError } = await adminSupabase
              .from("kazanilan_puanlar")
              .insert({ kullanici_id: user.id, yayin_id: izleme.yayin_id, izleme_id, puan_turu: "extra", puan: extraPuanDegeri });

            if (epError) {
              console.error("[UYARI] Extra puan kaydedilemedi:", { izleme_id, hata: epError.message });
            } else {
              kazanilanPuanlar.push({ tur: "extra", puan: extraPuanDegeri });
            }
          }
        }
      }
    }

    // Öneri puanı — ileri sarma yoksa
    if (!ileriSarildi && izleme.izleme_turu === "oneri") {
      const { data: oneri, error: oneriError } = await adminSupabase
        .from("oneri_kayitlari")
        .select("oneri_id, oneri_baslangic, oneri_bitis")
        .eq("yayin_id", izleme.yayin_id)
        .eq("kullanici_id", user.id)
        .eq("izlendi_mi", false)
        .single();

      if (oneriError && oneriError.code !== "PGRST116") {
        console.error("[UYARI] Öneri kaydı sorgulanırken hata:", { hata: oneriError.message });
      } else if (oneri) {
        const oneriBaslangic = new Date(oneri.oneri_baslangic);
        const oneriBitis = new Date(oneri.oneri_bitis);

        if (baslangicTarihi >= oneriBaslangic && baslangicTarihi <= oneriBitis) {
          const { data: sPuan } = await adminSupabase
            .from("soru_seti_puanlari")
            .select("soru_puani")
            .eq("soru_seti_durum_id", yayin.soru_seti_durum_id)
            .single();

          const oneriPuani = sPuan?.soru_puani ?? 0;

          const { error: opInsertError } = await adminSupabase
            .from("kazanilan_puanlar")
            .insert({ kullanici_id: user.id, yayin_id: izleme.yayin_id, izleme_id, puan_turu: "oneri", puan: oneriPuani });

          if (opInsertError) {
            console.error("[UYARI] Öneri puanı kaydedilemedi:", { izleme_id, hata: opInsertError.message });
          } else {
            kazanilanPuanlar.push({ tur: "oneri", puan: oneriPuani });
          }

          await adminSupabase
            .from("oneri_kayitlari")
            .update({ izlendi_mi: true })
            .eq("oneri_id", oneri.oneri_id);
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