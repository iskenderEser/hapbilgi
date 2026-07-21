// app/talepler/api/hazir-video/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { embedUrlGuidCikar } from "@/lib/video/bunnyYukleme";
import { hazirZinciriKur, hazirZincirVideoBul } from "@/lib/hazirVideoSoruSeti/zincir";

// PUT: kanonik embed adresini sistem yazar (A4 — yükleme üreticinin formundan doğrudan
// Bunny'ye gider; adres vezneden döner, istemci URL kurmaz. IU'nun URL girme yolu kalktı.)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    // İskender kararı (19.07): hazır akışı TÜM üretici roller aynı şekilde kullanır.
    const rol = await rolCozucu(adminSupabase, user.id);
    if (!URETICI_ROLLER.includes(rol)) return rolHatasi("Sadece talebin üreticisi video adresi kaydedebilir.");

    const body = await request.json();
    const { talep_id, hazir_video_url } = body;

    if (!talep_id) return validasyonHatasi("talep_id zorunludur.", ["talep_id"]);
    if (!hazir_video_url) return validasyonHatasi("hazir_video_url zorunludur.", ["hazir_video_url"]);
    // Adres vezneden dönen kanonik embed olmalı — elle URL taşıma kavramı bitti.
    if (!embedUrlGuidCikar(hazir_video_url)) {
      return validasyonHatasi("Video adresi kanonik Bunny embed adresi olmalıdır.", ["hazir_video_url"]);
    }

    const { data: talep, error: talepError } = await adminSupabase
      .from("talepler")
      .select("talep_id, uretici_id, hazir_video, hazir_soru_seti, hazir_soru_seti_verisi, soru_seti_buyuklugu, video_basi_soru_sayisi, urunler(urun_adi), teknikler(teknik_adi)")
      .eq("talep_id", talep_id)
      .single();

    if (talepError || !talep) return hataYaniti("Talep bulunamadı.", "talepler tablosu SELECT — talep_id", talepError);
    if (!talep.hazir_video) return isKuraluHatasi("Bu talep hazır video talebi değil.");
    if (talep.uretici_id !== user.id) return rolHatasi("Yalnız talebin üreticisi video adresi kaydedebilir.");

    const { error: updateError } = await adminSupabase
      .from("talepler")
      .update({ hazir_video_url: hazir_video_url.trim() })
      .eq("talep_id", talep_id);

    if (updateError) return hataYaniti("Video URL kaydedilemedi.", "talepler tablosu UPDATE — hazir_video_url", updateError);

    // V1-5/V1-6 kök çözüm (İskender kararı, 21.07 — fiziksel test): PM'in ayrı
    // "video onayı" ara adımı kalktı. Zincir, yükleme tamamlanır tamamlanmaz
    // burada kurulur — soru seti işi ve IU bildirimi bu anda doğar. Zincir zaten
    // kuruluysa (işlenemeyen video sonrası yeniden yükleme) yalnızca zincirdeki
    // video adresi güncellenir; mükerrer zincir/bildirim oluşmaz.
    const mevcutVideoId = await hazirZincirVideoBul(adminSupabase, talep_id);
    if (mevcutVideoId) {
      const { error: videoGuncelleError } = await adminSupabase
        .from("videolar")
        .update({ video_url: hazir_video_url.trim() })
        .eq("video_id", mevcutVideoId);
      if (videoGuncelleError) return hataYaniti("Zincirdeki video adresi güncellenemedi.", "videolar tablosu UPDATE — video_url", videoGuncelleError);
      return NextResponse.json({ mesaj: "Video güncellendi." }, { status: 200 });
    }

    const zincir = await hazirZinciriKur(adminSupabase, {
      talep_id: talep.talep_id,
      hazir_video_url: hazir_video_url.trim(),
      hazir_soru_seti: talep.hazir_soru_seti ?? false,
      hazir_soru_seti_verisi: talep.hazir_soru_seti_verisi ?? null,
      soru_seti_buyuklugu: talep.soru_seti_buyuklugu ?? null,
      video_basi_soru_sayisi: talep.video_basi_soru_sayisi ?? null,
      urun_adi: (talep as any).urunler?.urun_adi ?? (talep as any).teknikler?.teknik_adi ?? null,
    }, user.id);

    if (!zincir.ok) {
      // Telafi: zincir kurulamadıysa URL geri alınır — üretici yeniden yükleyip
      // zincir kurulumunu yeniden tetikleyebilir (yarım kalmış gönderim kalmaz).
      await adminSupabase.from("talepler").update({ hazir_video_url: null }).eq("talep_id", talep_id);
      return hataYaniti(zincir.hata, zincir.adim, zincir.detay ?? null);
    }

    return NextResponse.json({
      mesaj: zincir.soruSetiIslendi
        ? "Video gönderildi; hazır soru seti otomatik işlendi ve onaylandı."
        : "Video gönderildi. Soru seti içerik üreticisine yönlendirildi.",
      soru_seti_id: zincir.soru_seti_id,
      video_durum_id: zincir.video_durum_id,
      soru_seti_islendi: zincir.soruSetiIslendi,
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "PUT /talepler/api/hazir-video");
  }
}
