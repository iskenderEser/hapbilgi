import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { hataYaniti, isKuraluHatasi, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { uuidGecerliMi, uretimRpcHataYaniti } from "@/lib/uretim/rpc";
import { bunnyVideoDurumu, bunnyVideoSil, embedUrlGuidCikar } from "@/lib/video/bunnyYukleme";
import { pushYayinlaArkada } from "@/lib/push/orkestrasyon";

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();
    if (!URETICI_ROLLER.includes(await rolCozucu(adminSupabase, user.id))) return rolHatasi("Yalnız talebin üreticisi hazır video kaydedebilir.");

    const body = await request.json();
    if (!uuidGecerliMi(body.talep_id)) return validasyonHatasi("talep_id geçerli bir UUID olmalıdır.", ["talep_id"]);
    if (!uuidGecerliMi(body.islem_anahtari)) return validasyonHatasi("islem_anahtari geçerli bir UUID olmalıdır.", ["islem_anahtari"]);
    const guid = typeof body.video_url === "string" ? embedUrlGuidCikar(body.video_url) : null;
    if (!guid) return validasyonHatasi("Video adresi kanonik Bunny embed adresi olmalıdır.", ["video_url"]);
    if (body.islem_anahtari !== guid) {
      return validasyonHatasi("İşlem anahtarı Bunny video kimliğiyle aynı olmalıdır.", ["islem_anahtari"]);
    }

    // TUS aktarımının tamamlanması videonun izlenebilir olduğu anlamına gelmez.
    // Önce Bunny bağlantısını talebe bağlarız; böylece tarayıcı kapansa bile webhook
    // hazır olduğunda aynı atomik üretim zincirini güvenle tamamlayabilir.
    const { data: talep, error: talepError } = await adminSupabase
      .from("talepler")
      .select("talep_id, uretici_id, hazir_video, hazir_video_url")
      .eq("talep_id", body.talep_id)
      .single();
    if (talepError || !talep) return hataYaniti("Talep bulunamadı.", "talepler SELECT — hazır video", talepError, 404);
    if (talep.uretici_id !== user.id) return rolHatasi("Hazır videoyu yalnız talebin üreticisi kaydedebilir.");
    if (talep.hazir_video !== true) return isKuraluHatasi("Bu talep hazır video talebi değil.");
    if (talep.hazir_video_url && talep.hazir_video_url !== body.video_url) {
      return isKuraluHatasi("Bu talebe başka bir video zaten bağlanmış.");
    }
    if (!talep.hazir_video_url) {
      const { data: baglanan, error: baglamaError } = await adminSupabase
        .from("talepler")
        .update({ hazir_video_url: body.video_url })
        .eq("talep_id", body.talep_id)
        .is("hazir_video_url", null)
        .select("talep_id")
        .maybeSingle();
      if (baglamaError) return hataYaniti("Video talebe bağlanamadı.", "talepler UPDATE — Bunny işleme kaydı", baglamaError);
      if (!baglanan) return isKuraluHatasi("Bu talebe başka bir video eş zamanlı olarak bağlanmış.");
    }

    // Tek otorite Bunny'dir: yalnız status=4 ve pozitif süre birlikteyse zincir açılır.
    const bunnyDurumu = await bunnyVideoDurumu(guid);
    if (!bunnyDurumu.ok) {
      return hataYaniti(bunnyDurumu.hata, bunnyDurumu.adim, bunnyDurumu.detay ? { message: bunnyDurumu.detay } : null, 503);
    }
    if (bunnyDurumu.hatali) {
      // Başarısız Bunny kaydı talebi kilitlemesin; talep ve hazır sorular korunur.
      const { error: ayirmaError } = await adminSupabase
        .from("talepler")
        .update({ hazir_video_url: null })
        .eq("talep_id", body.talep_id)
        .eq("hazir_video_url", body.video_url);
      if (ayirmaError) return hataYaniti("İşlenemeyen video talepten ayrılamadı.", "talepler UPDATE — Bunny hata telafisi", ayirmaError);
      await bunnyVideoSil(guid);
      return NextResponse.json({
        hata: "Video Bunny tarafından işlenemedi. Talep ve soru seti korundu; videoyu yeniden yükleyebilirsiniz.",
        adim: "Bunny video işleme",
        bunny_durum: bunnyDurumu.bunnyDurum,
      }, { status: 422 });
    }
    if (!bunnyDurumu.hazir || bunnyDurumu.videoSuresiSaniye == null || bunnyDurumu.videoSuresiSaniye <= 0) {
      return NextResponse.json({
        mesaj: "Video işleniyor",
        isleniyor: true,
        bunny_durum: bunnyDurumu.bunnyDurum,
      }, { status: 202 });
    }

    const { data: sonuc, error } = await adminSupabase.rpc("uretim_hazir_video_kaydet", {
      p_talep_id: body.talep_id,
      p_uretici_id: user.id,
      p_video_url: body.video_url,
      p_islem_anahtari: body.islem_anahtari,
    });
    if (error) return uretimRpcHataYaniti("Hazır video zinciri kurulamadı.", "uretim_hazir_video_kaydet RPC", error);

    const videoId = (sonuc as { video_id?: string } | null)?.video_id;
    if (!videoId) return hataYaniti("Hazır video zinciri video kimliği döndürmedi.", "uretim_hazir_video_kaydet RPC — dönen veri");
    const { error: sureError } = await adminSupabase
      .from("videolar")
      .update({ video_suresi_saniye: bunnyDurumu.videoSuresiSaniye })
      .eq("video_id", videoId);
    if (sureError) return hataYaniti("Doğrulanmış video süresi kaydedilemedi.", "videolar UPDATE — Bunny süresi", sureError);

    const alici = (sonuc as { sonraki?: { atanan_iu_id?: string } | null } | null)?.sonraki?.atanan_iu_id;
    if (alici) pushYayinlaArkada(adminSupabase, "uretim_durum_gecisi", [alici]);
    return NextResponse.json({ mesaj: "Hazır video kaydedildi.", sonuc }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "PUT /uretim/api/hazir-video");
  }
}
