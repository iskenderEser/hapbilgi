// app/eclub/panel/api/bitir/route.ts
// E-Club izleme — BİTİR. İzlemeyi tamamlar + izleme puanı yazar.
// Kural: öneri süresi (oneri_bitis > now) geçmişse PUAN yok (izleme yine tamamlanır).
// TUR BAZLI ilk izleme: geçerli turda tamamlanan ilk izleme + video_puani>0 ise
// eclub_kazanilan_puanlar'a 'izleme' puanı; UTT +10 da aynı koşulda yeniden doğar.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { eclubPuanKaydet, eclubUttPuanKaydet } from "@/lib/puan/eclubKayit";
import { gecerliTur } from "@/lib/tur/kayit";

const ECLUB_KISI_ROLLERI = ["eczaci", "eczane_teknisyeni"];

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    // Kişi kimliği
    const { data: kisi, error: kisiError } = await adminSupabase
      .from("eclub_kisiler")
      .select("kisi_id, rol")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (kisiError) return hataYaniti("Kişi bilgisi alınamadı.", "eclub_kisiler SELECT — auth_user_id", kisiError);
    if (!kisi) return rolHatasi("Bu işlem yalnız E-Club kişilerine açıktır.");
    if (!ECLUB_KISI_ROLLERI.includes(kisi.rol)) return rolHatasi("Geçersiz kişi rolü.");

    const body = await request.json();
    const { izleme_id } = body;
    if (!izleme_id) return validasyonHatasi("izleme_id zorunludur.", ["izleme_id"]);

    // İzleme kaydını bul (kişiye ait, tamamlanmamış)
    const { data: izleme, error: izlemeError } = await adminSupabase
      .from("eclub_izleme_kayitlari")
      .select("izleme_id, yayin_id, kisi_id, oneri_id, tamamlandi_mi")
      .eq("izleme_id", izleme_id)
      .single();

    const izlemeKontrol = veriKontrol(izleme, "eclub_izleme_kayitlari SELECT — izleme_id", "İzleme kaydı bulunamadı.");
    if (!izlemeKontrol.gecerli) return izlemeKontrol.yanit;
    if (izlemeError) return hataYaniti("İzleme sorgulanamadı.", "eclub_izleme_kayitlari SELECT", izlemeError, 404);
    if (izleme.kisi_id !== kisi.kisi_id) return rolHatasi("Bu izleme kaydına erişim yetkiniz yok.");
    if (izleme.tamamlandi_mi) return isKuraluHatasi("Bu izleme zaten tamamlanmış.");

    // İzlemeyi tamamla
    const { error: updateError } = await adminSupabase
      .from("eclub_izleme_kayitlari")
      .update({ tamamlandi_mi: true, izleme_bitis: new Date().toISOString() })
      .eq("izleme_id", izleme_id);

    if (updateError) return hataYaniti("İzleme tamamlanamadı.", "eclub_izleme_kayitlari UPDATE — tamamlandi_mi", updateError);

    // Süre kontrolü: öneri hâlâ geçerli mi (oneri_bitis > now)? Geçmişse puan YOK.
    let puanVerildi = false;
    // B-08: puan yazım hataları yutulmaz — loglanır VE yanıtta bildirilir.
    const puanUyarilari: string[] = [];
    let puanDegeri = 0;

    if (izleme.oneri_id) {
      const { data: oneri } = await adminSupabase
        .from("eclub_oneri_kayitlari")
        .select("oneri_id, oneri_bitis, izlendi_mi, oneren_id")
        .eq("oneri_id", izleme.oneri_id)
        .maybeSingle();

      const simdi = new Date();
      const sureGecerli = !!oneri && new Date(oneri.oneri_bitis) > simdi;

      if (sureGecerli) {
        // Geçerli tur — ilk izleme tekilliğinin alt sınırı (tur bazlı tekillik).
        // Periyot dolmuşsa gecerliTur yeni turu burada açar (otomatik mekanizma).
        // Başarısızlıkta güvenli geri düşüş: epoch alt sınırı = eski (ömür boyu) davranış.
        const turSonuc = await gecerliTur(adminSupabase, izleme.yayin_id);
        if (!turSonuc.ok) {
          console.error("[UYARI] Geçerli tur çözülemedi, ömür boyu tekillik uygulanacak:", { yayin_id: izleme.yayin_id, hata: turSonuc.error });
        }
        const turBaslangic = turSonuc.tur?.baslangic_tarihi ?? "2000-01-01T00:00:00Z";

        // İlk izleme puanı mı? — TUR BAZLI: bu turda 'izleme' türünde puan var mı?
        const { data: oncekiPuan } = await adminSupabase
          .from("eclub_kazanilan_puanlar")
          .select("kazanilan_puan_id")
          .eq("yayin_id", izleme.yayin_id)
          .eq("kisi_id", kisi.kisi_id)
          .eq("puan_turu", "izleme")
          .gte("created_at", turBaslangic)
          .limit(1);

        const ilkIzleme = (oncekiPuan ?? []).length === 0;

        if (ilkIzleme) {
          // video_puani → v_yayin_detay
          const { data: yayinDetay } = await adminSupabase
            .from("v_yayin_detay")
            .select("video_puani")
            .eq("yayin_id", izleme.yayin_id)
            .single();

          const video_puani = yayinDetay?.video_puani ?? 0;

          if (video_puani > 0) {
            const sonuc = await eclubPuanKaydet(adminSupabase, {
              kisi_id: kisi.kisi_id,
              yayin_id: izleme.yayin_id,
              izleme_id,
              puan_turu: "izleme",
              puan: video_puani,
            });
            if (sonuc.ok) {
              puanVerildi = true;
              puanDegeri = video_puani;
            } else {
              console.error("[UYARI] E-Club izleme puanı kaydedilemedi:", { izleme_id, hata: sonuc.error });
              puanUyarilari.push("İzleme puanı kaydedilemedi. Videoyu yeniden izlerseniz puan yeniden değerlendirilir.");
            }
          }

          // UTT +10 (GönderiPuanı): takım üyesi izleyince öneriyi gönderen UTT'ye.
          // Tur bazlı ilk izleme + süre geçerli koşulunda — yeni turda yeniden doğar.
          if (oneri.oneren_id) {
            const uttSonuc = await eclubUttPuanKaydet(adminSupabase, {
              utt_id: oneri.oneren_id,
              kisi_id: kisi.kisi_id,
              yayin_id: izleme.yayin_id,
              izleme_id,
              oneri_id: oneri.oneri_id,
            });
            if (!uttSonuc.ok) {
              console.error("[UYARI] E-Club UTT +10 kaydedilemedi:", { izleme_id, hata: uttSonuc.error });
              puanUyarilari.push("Öneriyi gönderen temsilcinin puanı kaydedilemedi.");
            }
          }
        }
      }

      // Öneriyi izlendi işaretle (süre geçmiş olsa da izleme gerçekleşti)
      if (oneri && !oneri.izlendi_mi) {
        await adminSupabase
          .from("eclub_oneri_kayitlari")
          .update({ izlendi_mi: true })
          .eq("oneri_id", oneri.oneri_id);
      }
    }

    return NextResponse.json({
      mesaj: "İzleme tamamlandı.",
      puan_kazanildi: puanVerildi,
      izleme_puani: puanDegeri,
      puan_uyarisi: puanUyarilari.length > 0 ? puanUyarilari.join(" ") : null,
      soru_gosterilecek: true,
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "PUT /eclub/panel/api/bitir");
  }
}