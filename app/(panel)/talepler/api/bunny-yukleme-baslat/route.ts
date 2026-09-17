// app/talepler/api/bunny-yukleme-baslat/route.ts
//
// A4 — hazır videonun vezne ucu (docs/bunny_dogrudan_yukleme_is_plani.md).
// Hazır video artık üreticinin talep formundan DOĞRUDAN Bunny'ye gider (Supabase
// storage'a hiç girmez); IU'nun indir-yeniden-yükle adımı kalktı. Vezne kuralları
// A1 ile aynı: kimlik + sıra kontrolü, kaydı sistem açar adı sistem koyar,
// istemciye tek videoya özel süreli TUS imzası iner; API anahtarı asla inmez.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { bunnyVideoSil, bunnyYuklemeBaslat, hazirVideoBaslik, BUNNY_TUS_ENDPOINT } from "@/lib/video/bunnyYukleme";
import { TALEP_ALANLARI, haritalaTalep } from "@/lib/utils/talepZinciri";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // 1) Kimlik + rol
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    // İskender kararı (19.07): hazır akışı TÜM üretici roller aynı şekilde kullanır.
    const rol = await rolCozucu(adminSupabase, user.id);
    if (!URETICI_ROLLER.includes(rol)) return rolHatasi("Sadece üretici roller hazır video yüklemesi başlatabilir.");

    const body = await request.json();
    const { talep_id } = body;
    if (!talep_id) return validasyonHatasi("talep_id zorunludur.", ["talep_id"]);

    // 2) Sıra kontrolü: talep hazır video talebi mi, üretici bu PM mi, video hâlâ boş mu
    // (ilk yükleme ya da red sonrası — reddet hazir_video_url'yi sıfırlar).
    const { data: talep, error: talepError } = await adminSupabase
      .from("talepler")
      .select(`${TALEP_ALANLARI}, hazir_video_url`)
      .eq("talep_id", talep_id)
      .single();

    if (talepError || !talep) return hataYaniti("Talep bulunamadı.", "talepler tablosu SELECT — talep_id", talepError, 404);
    if (!talep.hazir_video) return isKuraluHatasi("Bu talep hazır video talebi değil.");
    if (talep.uretici_id !== user.id) return rolHatasi("Yalnız talebin üreticisi video yükleyebilir.");
    if (talep.hazir_video_url) return isKuraluHatasi("Bu talepte video zaten yüklü — yenisi ancak red sonrası yüklenebilir.");

    // 3) Ad üretimi — kütüphane düzeni sisteme aittir.
    // Dosya adı künyeden (25.07, Aşama 3): ürünsüz eğitimlerde ad serbest alandadır.
    // Bunny'ye giden başlık kalıcıdır — yanlış yazılırsa sonradan düzelmez.
    const kunye = haritalaTalep(talep);
    const baslik = hazirVideoBaslik(kunye.urun_adi !== "-" ? kunye.urun_adi : null, kunye.teknik_adi);

    // Kesilen aktarım devam ettirilmez. Yeni kullanıcı denemesinden önce eski
    // geçici Bunny kaydı ve oturumu temizlenir; ardından daima yeni GUID açılır.
    const { data: eskiOturumlar, error: eskiOturumHatasi } = await adminSupabase
      .from("ogrenme_araci_video_yukleme_oturumlari")
      .select("yukleme_id, video_guid")
      .eq("kullanici_id", user.id)
      .eq("talep_id", talep_id);
    if (eskiOturumHatasi && !["42P01", "PGRST205"].includes(eskiOturumHatasi.code ?? "")) {
      return hataYaniti("Önceki video aktarımı denetlenemedi.", "video yükleme oturumu SELECT", eskiOturumHatasi);
    }
    for (const eski of eskiOturumlar ?? []) {
      if (!await bunnyVideoSil(eski.video_guid)) {
        return hataYaniti("Önceki video aktarımı temizlenemedi.", "Bunny yarım video temizliği", null, 502);
      }
      const { error: silmeHatasi } = await adminSupabase
        .from("ogrenme_araci_video_yukleme_oturumlari")
        .delete().eq("yukleme_id", eski.yukleme_id).eq("kullanici_id", user.id);
      if (silmeHatasi) return hataYaniti("Önceki video aktarım kaydı temizlenemedi.", "video yükleme oturumu DELETE", silmeHatasi);
    }

    // 4) Bunny kaydı + süreli imza
    const kayit = await bunnyYuklemeBaslat(baslik);
    if (!kayit.ok) return hataYaniti(kayit.hata, kayit.adim, kayit.detay ? { message: kayit.detay } : null);

    let yuklemeId: string | null = null;
    if (typeof body.dosya_adi === "string" && typeof body.mime_type === "string" && Number.isSafeInteger(body.dosya_boyutu) && body.dosya_boyutu > 0) {
      const oturumSonucu = await adminSupabase.from("ogrenme_araci_video_yukleme_oturumlari").insert({
        kullanici_id: user.id, talep_id, gorev_id: null, arac_id: null, kaynak: "hazir",
        video_guid: kayit.videoGuid, embed_url: kayit.embedUrl, baslik,
        dosya_adi: body.dosya_adi, mime_type: body.mime_type || "video/mp4", dosya_boyutu: body.dosya_boyutu,
      }).select("yukleme_id").single();
      if (oturumSonucu.error && !["42P01", "PGRST205"].includes(oturumSonucu.error.code ?? "")) {
        await bunnyVideoSil(kayit.videoGuid);
        return hataYaniti("Video yükleme oturumu kaydedilemedi.", "yarım yükleme kaydı", oturumSonucu.error);
      }
      yuklemeId = oturumSonucu.data?.yukleme_id ?? null;
    }

    // Tutanak: kim, hangi talep, hangi Bunny kimliği, ne zaman.
    console.log(`[talep-bunny-yukleme-baslat] uretici=${user.id} rol=${rol} talep_id=${talep_id} guid=${kayit.videoGuid} baslik="${baslik}"`);

    return NextResponse.json({
      yukleme_id: yuklemeId,
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
