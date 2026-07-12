// app/eczanem/api/izleme/bitir/route.ts
// Müşteri izleme — BİTİR. İzlemeyi tamamlar + (ömür boyu ilk izlemeyse ve
// video_puani>0) izleme kazanımı yazar. Kayıpsız: ileri sarma yok, süre yok.
// Ömür boyu teklik — tur yok (İP-§5.5): aynı yayından yalnız bir kez izleme puanı.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { musteriKimligi } from "@/lib/eczanem/oturum";
import { kazanimKaydet, kazanimVarMi } from "@/lib/eczanem/kazanim";

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const kimlik = await musteriKimligi(adminSupabase, user.id);
    if (!kimlik.ok) return rolHatasi(kimlik.hata ?? "Müşteri doğrulanamadı.");
    const musteriId = kimlik.musteriId!;

    const body = await request.json();
    const { izleme_id } = body;
    if (!izleme_id) return validasyonHatasi("izleme_id zorunludur.", ["izleme_id"]);

    // İzleme kaydı (müşteriye ait, gönderim bağı için gonderim_id de gerekir)
    const { data: izleme, error: izlemeError } = await adminSupabase
      .from("eczanem_izleme_kayitlari")
      .select("izleme_id, yayin_id, musteri_id, gonderim_id, tamamlandi_mi")
      .eq("izleme_id", izleme_id)
      .single();

    const izlemeKontrol = veriKontrol(izleme, "eczanem_izleme_kayitlari SELECT — izleme_id", "İzleme kaydı bulunamadı.");
    if (!izlemeKontrol.gecerli) return izlemeKontrol.yanit;
    if (izlemeError) return hataYaniti("İzleme sorgulanamadı.", "eczanem_izleme_kayitlari SELECT", izlemeError, 404);
    if (izleme.musteri_id !== musteriId) return rolHatasi("Bu izleme kaydına erişim yetkiniz yok.");
    if (izleme.tamamlandi_mi) return isKuraluHatasi("Bu izleme zaten tamamlanmış.");

    // Tamamla
    const { error: updateError } = await adminSupabase
      .from("eczanem_izleme_kayitlari")
      .update({ tamamlandi_mi: true, izleme_bitis: new Date().toISOString() })
      .eq("izleme_id", izleme_id);

    if (updateError) return hataYaniti("İzleme tamamlanamadı.", "eczanem_izleme_kayitlari UPDATE — tamamlandi_mi", updateError);

    // Eczane ekseni: izlemenin bağlı olduğu gönderimden
    const { data: gonderim } = await adminSupabase
      .from("eczanem_gonderimler")
      .select("eczane_id")
      .eq("gonderim_id", izleme.gonderim_id)
      .maybeSingle();

    let puanVerildi = false;
    let puanUyarisi: string | null = null;
    let puanDegeri = 0;

    // Ömür boyu ilk izleme + video_puani>0 → izleme kazanımı
    const zatenKazanildi = await kazanimVarMi(adminSupabase, musteriId, izleme.yayin_id, "izleme");
    if (!zatenKazanildi && gonderim?.eczane_id) {
      const { data: yayinDetay } = await adminSupabase
        .from("v_yayin_detay")
        .select("video_puani")
        .eq("yayin_id", izleme.yayin_id)
        .single();

      const video_puani = yayinDetay?.video_puani ?? 0;
      if (video_puani > 0) {
        const sonuc = await kazanimKaydet(adminSupabase, {
          musteri_id: musteriId,
          eczane_id: gonderim.eczane_id,
          yayin_id: izleme.yayin_id,
          izleme_id,
          puan_turu: "izleme",
          puan: video_puani,
        });
        if (sonuc.ok) { puanVerildi = true; puanDegeri = video_puani; }
        else {
          console.error("[UYARI] Eczanem izleme kazanımı yazılamadı:", { izleme_id, hata: sonuc.error });
          // B-08: yazım hatası yutulmaz — yanıtta kullanıcıya bildirilir.
          puanUyarisi = "Puan kaydedilemedi. Videoyu yeniden izlerseniz puan yeniden değerlendirilir.";
        }
      }
    }

    return NextResponse.json({
      mesaj: "İzleme tamamlandı.",
      puan_kazanildi: puanVerildi,
      izleme_puani: puanDegeri,
      puan_uyarisi: puanUyarisi,
      soru_gosterilecek: true,
    }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "PUT /eczanem/api/izleme/bitir");
  }
}
