// app/videolar/api/bunny-yukleme-baslat/route.ts
//
// A1 — Bunny doğrudan yükleme başlatma ("vezne" ucu; docs/bunny_dogrudan_yukleme_is_plani.md).
// IU dosya yüklemek istediğinde: (1) kimlik + rol, (2) sıra kontrolü (bu videonun
// gerçekten yükleme sırası mı), (3) Bunny kaydını SİSTEM açar ve adı SİSTEM koyar,
// (4) tek videoya özel süreli TUS imzası döner. API anahtarı istemciye asla inmez.
// Uç, ekrandan bağımsız çağrılabilir — ileride yapay IU aynı sözleşmeyle kullanır.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { IU_ROLU } from "@/lib/utils/roller";
import { bunnyVideoSil, bunnyYuklemeBaslat, BUNNY_TUS_ENDPOINT } from "@/lib/video/bunnyYukleme";
import { talepBilgisiVideo } from "@/lib/utils/talepZinciri";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // 1) Kimlik + rol
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (rol !== IU_ROLU) return rolHatasi("Sadece IU video yükleme başlatabilir.");

    const body = await request.json();
    const { arac_id } = body;
    if (!arac_id) return validasyonHatasi("arac_id zorunludur.", ["arac_id"]);

    // 2) Sıra kontrolü — istemcideki iuGonderebilir kuralının sunucu karşılığı:
    // video_url boşsa (ilk yükleme) ya da son durum "revizyon bekleniyor" ise izin.
    const { data: video, error: videoError } = await adminSupabase
      .from("ogrenme_araclari")
      .select("arac_id, senaryo_durum_id, dosya_yolu, talep_id")
      .eq("arac_id", arac_id)
      .eq("arac_turu", "video")
      .single();

    const videoKontrol = veriKontrol(video, "ogrenme_araclari SELECT — arac_id", "Video kaydı bulunamadı.");
    if (!videoKontrol.gecerli) return videoKontrol.yanit;
    if (videoError) return hataYaniti("Video sorgulanamadı.", "ogrenme_araclari SELECT", videoError, 404);

    const { data: gorev, error: gorevError } = await adminSupabase
      .from("uretim_gorevleri")
      .select("gorev_id, atanan_iu_id, durum")
      .eq("arac_id", arac_id)
      .maybeSingle();
    if (gorevError) return hataYaniti("Video görevi sorgulanamadı.", "uretim_gorevleri SELECT — video sahipliği", gorevError);
    if (!gorev || gorev.atanan_iu_id !== user.id) return rolHatasi("Bu video görevi size atanmamış.");
    if (!['hazirlaniyor', 'revizyon_bekliyor'].includes(gorev.durum)) return validasyonHatasi("Bu videonun yükleme sırası değil.", ["arac_id"]);

    if (video.dosya_yolu) {
      const { data: sonDurum, error: durumError } = await adminSupabase
        .from("ogrenme_araci_durumu")
        .select("durum")
        .eq("arac_id", arac_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (durumError) return hataYaniti("Video durumu sorgulanamadı.", "ogrenme_araci_durumu SELECT", durumError);
      if (sonDurum?.durum !== "revizyon bekleniyor") {
        return validasyonHatasi("Bu videonun yükleme sırası değil — yalnız ilk yükleme ya da revizyon bekleyen video yüklenebilir.", ["arac_id"]);
      }
    }

    // 3) Ad üretimi — kütüphane düzeni sisteme aittir: ürün adı + versiyon no.
    // Ürün adı talepten gelir (talep_id doğrudan bağ — Adım 5; v_uretim_detay kalktı).
    const talepBilgisi = await talepBilgisiVideo(adminSupabase, arac_id);
    if (!talepBilgisi) return hataYaniti("Video talebi bulunamadı.", "talep-video bağı", null, 404);

    const { count } = await adminSupabase
      .from("ogrenme_araclari")
      .select("arac_id", { count: "exact", head: true })
      .eq("talep_id", video.talep_id)
      .eq("arac_turu", "video");

    const baslik = `${talepBilgisi?.urun_adi ?? "video"}_v${count ?? 1}`;

    // Kesilen aktarım devam ettirilmez. Eski geçici kayıt temizlenir ve her
    // kullanıcı denemesi yeni Bunny GUID'iyle sıfırdan başlar.
    const { data: eskiOturumlar, error: eskiOturumHatasi } = await adminSupabase
      .from("ogrenme_araci_video_yukleme_oturumlari")
      .select("yukleme_id, video_guid")
      .eq("kullanici_id", user.id)
      .eq("arac_id", arac_id);
    if (eskiOturumHatasi && !["42P01", "PGRST205"].includes(eskiOturumHatasi.code ?? "")) {
      return hataYaniti("Önceki video aktarımı denetlenemedi.", "video yükleme oturumu SELECT", eskiOturumHatasi);
    }
    for (const eski of eskiOturumlar ?? []) {
      if (!await bunnyVideoSil(eski.video_guid)) {
        return hataYaniti("Önceki video aktarımı temizlenemedi.", "yarım video temizliği", null, 502);
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
        kullanici_id: user.id,
        talep_id: talepBilgisi.talep_id,
        gorev_id: gorev.gorev_id,
        arac_id,
        kaynak: "iu",
        video_guid: kayit.videoGuid,
        embed_url: kayit.embedUrl,
        baslik,
        dosya_adi: body.dosya_adi,
        mime_type: body.mime_type || "video/mp4",
        dosya_boyutu: body.dosya_boyutu,
      }).select("yukleme_id").single();
      if (oturumSonucu.error && !["42P01", "PGRST205"].includes(oturumSonucu.error.code ?? "")) {
        await bunnyVideoSil(kayit.videoGuid);
        return hataYaniti("Video yükleme oturumu kaydedilemedi.", "yarım yükleme kaydı", oturumSonucu.error);
      }
      yuklemeId = oturumSonucu.data?.yukleme_id ?? null;
    }

    // Tutanak: kim, hangi video satırı, hangi Bunny kimliği, ne zaman.
    console.log(`[bunny-yukleme-baslat] iu=${user.id} arac_id=${arac_id} guid=${kayit.videoGuid} baslik="${baslik}"`);

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
    return sunucuHatasi(err, "POST /videolar/api/bunny-yukleme-baslat");
  }
}
