// app/talepler/api/hazir-video/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { embedUrlGuidCikar } from "@/lib/video/bunnyYukleme";
import { hazirZinciriKur } from "@/lib/hazirVideoSoruSeti/zincir";

// PUT: kanonik embed adresini sistem yazar (A4 — yükleme PM formundan doğrudan
// Bunny'ye gider; adres vezneden döner, istemci URL kurmaz. IU'nun URL girme yolu kalktı.)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!["pm", "jr_pm", "kd_pm"].includes(rol)) return rolHatasi("Sadece talebin üreticisi (PM) video adresi kaydedebilir.");

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
      .select("talep_id, uretici_id, hazir_video")
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

    return NextResponse.json({ mesaj: "Video URL kaydedildi." }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "PUT /talepler/api/hazir-video");
  }
}

// POST: PM onayla veya reddet
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!["pm", "jr_pm", "kd_pm"].includes(rol)) return rolHatasi("Sadece PM onaylayabilir.");

    const body = await request.json();
    const { talep_id, karar } = body;

    if (!talep_id) return validasyonHatasi("talep_id zorunludur.", ["talep_id"]);
    if (!["onayla", "reddet"].includes(karar)) return validasyonHatasi("karar 'onayla' veya 'reddet' olmalıdır.", ["karar"]);

    const { data: talep, error: talepError } = await adminSupabase
      .from("talepler")
      .select("talep_id, uretici_id, hazir_video, hazir_video_url, hazir_soru_seti, hazir_soru_seti_verisi, soru_seti_buyuklugu, video_basi_soru_sayisi")
      .eq("talep_id", talep_id)
      .single();

    if (talepError || !talep) return hataYaniti("Talep bulunamadı.", "talepler tablosu SELECT — talep_id", talepError);
    if (!talep.hazir_video) return isKuraluHatasi("Bu talep hazır video talebi değil.");
    if (talep.uretici_id !== user.id) return rolHatasi("Bu talebi onaylama yetkiniz yok.");
    if (!talep.hazir_video_url) return isKuraluHatasi("Henüz video yüklenmemiş.");

    if (karar === "reddet") {
      const { error: resetError } = await adminSupabase
        .from("talepler")
        .update({ hazir_video_url: null })
        .eq("talep_id", talep_id);

      if (resetError) return hataYaniti("Red işlemi gerçekleştirilemedi.", "talepler tablosu UPDATE — hazir_video_url reset", resetError);
      return NextResponse.json({ mesaj: "Video reddedildi. Yeni video yüklenebilir." }, { status: 200 });
    }

    // Onaylama — zincir kurulumu hazır kolun kendi modülünde (lib/hazirVideoSoruSeti):
    // senaryo → video → soru seti; hazır soru seti varsa sorular otomatik işlenir
    // ve "onaylandı" durumuyla yayın bekleyenlerine düşer (IU'nun elle işleme adımı kalktı).
    const zincir = await hazirZinciriKur(adminSupabase, {
      talep_id: talep.talep_id,
      hazir_video_url: talep.hazir_video_url,
      hazir_soru_seti: talep.hazir_soru_seti ?? false,
      hazir_soru_seti_verisi: talep.hazir_soru_seti_verisi ?? null,
      soru_seti_buyuklugu: talep.soru_seti_buyuklugu ?? null,
      video_basi_soru_sayisi: talep.video_basi_soru_sayisi ?? null,
    }, user.id);

    if (!zincir.ok) return hataYaniti(zincir.hata, zincir.adim, zincir.detay ?? null);

    return NextResponse.json({
      mesaj: zincir.soruSetiIslendi
        ? "Video onaylandı; hazır soru seti otomatik işlendi ve onaylandı."
        : "Video onaylandı. Soru seti yazım süreci başlayabilir.",
      soru_seti_id: zincir.soru_seti_id,
      video_durum_id: zincir.video_durum_id,
      soru_seti_islendi: zincir.soruSetiIslendi,
    }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /talepler/api/hazir-video");
  }
}