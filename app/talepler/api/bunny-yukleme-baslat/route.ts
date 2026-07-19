// app/talepler/api/bunny-yukleme-baslat/route.ts
//
// A4 — hazır videonun vezne ucu (docs/bunny_dogrudan_yukleme_is_plani.md).
// Hazır video artık PM'in talep formundan DOĞRUDAN Bunny'ye gider (Supabase
// storage'a hiç girmez); IU'nun indir-yeniden-yükle adımı kalktı. Vezne kuralları
// A1 ile aynı: kimlik + sıra kontrolü, kaydı sistem açar adı sistem koyar,
// istemciye tek videoya özel süreli TUS imzası iner; API anahtarı asla inmez.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { bunnyYuklemeBaslat, hazirVideoBaslik, BUNNY_TUS_ENDPOINT } from "@/lib/video/bunnyYukleme";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // 1) Kimlik + rol
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!["pm", "jr_pm", "kd_pm"].includes(rol)) return rolHatasi("Sadece PM hazır video yüklemesi başlatabilir.");

    const body = await request.json();
    const { talep_id } = body;
    if (!talep_id) return validasyonHatasi("talep_id zorunludur.", ["talep_id"]);

    // 2) Sıra kontrolü: talep hazır video talebi mi, üretici bu PM mi, video hâlâ boş mu
    // (ilk yükleme ya da red sonrası — reddet hazir_video_url'yi sıfırlar).
    const { data: talep, error: talepError } = await adminSupabase
      .from("talepler")
      .select("talep_id, uretici_id, hazir_video, hazir_video_url, urunler(urun_adi), teknikler(teknik_adi)")
      .eq("talep_id", talep_id)
      .single();

    if (talepError || !talep) return hataYaniti("Talep bulunamadı.", "talepler tablosu SELECT — talep_id", talepError, 404);
    if (!talep.hazir_video) return isKuraluHatasi("Bu talep hazır video talebi değil.");
    if (talep.uretici_id !== user.id) return rolHatasi("Yalnız talebin üreticisi video yükleyebilir.");
    if (talep.hazir_video_url) return isKuraluHatasi("Bu talepte video zaten yüklü — yenisi ancak red sonrası yüklenebilir.");

    // 3) Ad üretimi — kütüphane düzeni sisteme aittir.
    const baslik = hazirVideoBaslik((talep as any).urunler?.urun_adi, (talep as any).teknikler?.teknik_adi);

    // 4) Bunny kaydı + süreli imza
    const kayit = await bunnyYuklemeBaslat(baslik);
    if (!kayit.ok) return hataYaniti(kayit.hata, kayit.adim, kayit.detay ? { message: kayit.detay } : null);

    // Tutanak: kim, hangi talep, hangi Bunny kimliği, ne zaman.
    console.log(`[talep-bunny-yukleme-baslat] pm=${user.id} talep_id=${talep_id} guid=${kayit.videoGuid} baslik="${baslik}"`);

    return NextResponse.json({
      video_guid: kayit.videoGuid,
      library_id: kayit.libraryId,
      imza: kayit.imza,
      son_kullanma: kayit.sonKullanma,
      tus_endpoint: BUNNY_TUS_ENDPOINT,
      embed_url: kayit.embedUrl,
      baslik,
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "POST /talepler/api/bunny-yukleme-baslat");
  }
}
