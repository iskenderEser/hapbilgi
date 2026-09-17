// app/api/bunny/webhook/route.ts
//
// Bunny Stream encode-complete webhook (hazır olma + süre terfi tetikleyicisi).
// Video encode'u bitince Bunny buraya POST eder; biz süreyi PAYLOAD'a GÜVENMEDEN
// Bunny API'sinden otoritatif çekeriz. Hazır üretici videosu Processing durumunda
// talebe bağlı bekliyorsa atomik üretim zincirini burada tamamlarız; böylece
// tarayıcının açık kalması doğruluğun şartı değildir.
//
// GÜVENLİK: Bunny webhook imzalamaz → URL/başlıkta gizli token ile doğrularız.
// Bunny panelinde webhook URL'i:
//   https://<host>/api/bunny/webhook?secret=<BUNNY_WEBHOOK_SECRET>
// (Ya da "x-bunny-secret" başlığı.) BUNNY_WEBHOOK_SECRET .env.local'a eklenir.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { bunnyVideoDurumu, bunnyVideoSil } from "@/lib/video/bunnyYukleme";
import { hazirVideoTamamla } from "@/lib/video/hazirVideoTamamla";
import { pushYayinlaArkada } from "@/lib/push/orkestrasyon";

export async function POST(request: NextRequest) {
  try {
    const beklenenGizli = process.env.BUNNY_WEBHOOK_SECRET;
    if (!beklenenGizli) {
      // Yapılandırılmadan çalışmaz — sessizce dış dünyaya açık kalmasın.
      return NextResponse.json({ hata: "Webhook yapılandırılmamış (BUNNY_WEBHOOK_SECRET yok)." }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const gelenGizli = searchParams.get("secret") ?? request.headers.get("x-bunny-secret") ?? "";
    if (gelenGizli !== beklenenGizli) {
      return NextResponse.json({ hata: "Yetkisiz." }, { status: 401 });
    }

    const govde = await request.json().catch(() => ({} as Record<string, unknown>));
    const guid = String(govde.VideoGuid ?? govde.videoGuid ?? govde.guid ?? "").trim();
    if (!guid) {
      return NextResponse.json({ hata: "VideoGuid bulunamadı." }, { status: 400 });
    }

    // Süreyi otoritatif kaynaktan (Bunny API) çek — bildirim payload'ına güvenme.
    const durum = await bunnyVideoDurumu(guid);
    if (!durum.ok) {
      // 5xx Bunny'nin webhook'u tekrar denemesini sağlar; geçici erişim sorunu
      // videoyu sessizce bekleyen durumda bırakmaz.
      return NextResponse.json({ hata: "Bunny video durumu doğrulanamadı.", detay: durum.detay }, { status: 503 });
    }
    if (!durum.hazir && !durum.hatali && durum.bunnyDurum !== 4) {
      // Normal Processing bildirimi: sonraki durum değişimini bekle.
      return NextResponse.json({ mesaj: "Video henüz hazır değil; atlandı.", hazir: false }, { status: 200 });
    }

    const adminSupabase = createAdminClient();

    // TUS sonrası talebe bağlanmış fakat henüz videolar zinciri açılmamış hazır
    // videoları, GUID'i idempotent işlem anahtarı yaparak yalnız bir kez tamamla.
    const { data: bekleyenTalepler, error: bekleyenError } = await adminSupabase
      .from("talepler")
      .select("talep_id, uretici_id, hazir_video_url")
      .eq("hazir_video", true)
      .ilike("hazir_video_url", `%${guid}%`);
    if (bekleyenError) {
      return NextResponse.json({ hata: "İşlenen videonun talebi sorgulanamadı.", detay: bekleyenError.message }, { status: 500 });
    }
    if ((bekleyenTalepler?.length ?? 0) > 1) {
      return NextResponse.json({ hata: "Bunny video kimliği birden fazla talebe bağlı; zincir güvenli biçimde durduruldu." }, { status: 409 });
    }

    if (durum.hatali) {
      await adminSupabase
        .from("ogrenme_araci_video_yukleme_oturumlari")
        .update({ durum: "iptal_hatasi", son_hata: "Bunny video işleme hatası", updated_at: new Date().toISOString() })
        .eq("kaynak", "iu")
        .eq("video_guid", guid)
        .eq("durum", "dogrulama_bekliyor");
      // İşleme hatası tarayıcı kapandıktan sonra gelmişse de talep kilitli kalmaz.
      // Tamamlanmış/eski video kayıtlarına dokunulmaz; yalnız bekleyen bağlantı çözülür.
      for (const talep of bekleyenTalepler ?? []) {
        const { data: mevcutVideo, error: mevcutVideoError } = await adminSupabase
          .from("ogrenme_araclari")
          .select("arac_id, metadata_dogrulandi")
          .eq("talep_id", talep.talep_id)
          .eq("kaynak", "hazir")
          .eq("arac_turu", "video")
          .limit(1)
          .maybeSingle();
        if (mevcutVideoError) {
          return NextResponse.json({ hata: "Hazır video kaydı sorgulanamadı.", detay: mevcutVideoError.message }, { status: 500 });
        }
        if (mevcutVideo?.metadata_dogrulandi === true) continue;
        const { error: ayirmaError } = await adminSupabase
          .from("talepler")
          .update({ hazir_video_url: null })
          .eq("talep_id", talep.talep_id)
          .eq("hazir_video_url", talep.hazir_video_url);
        if (ayirmaError) {
          return NextResponse.json({ hata: "İşlenemeyen video talepten ayrılamadı.", detay: ayirmaError.message }, { status: 500 });
        }
      }
      await bunnyVideoSil(guid);
      return NextResponse.json({ mesaj: "İşlenemeyen Bunny kaydı kaldırıldı; talep yeniden yüklemeye açıldı.", hazir: false }, { status: 200 });
    }

    if (durum.videoSuresiSaniye == null || durum.videoSuresiSaniye <= 0) {
      return NextResponse.json({ hata: "Bunny Ready bildirdi ancak doğrulanmış video süresi bulunamadı." }, { status: 503 });
    }

    // İÜ'nün V1/V3 video teslimi de encode süresini beklemez. Kalıcı yükleme
    // oturumu, tarayıcı kapansa bile teslimi doğru kullanıcı ve göreve bağlar.
    const { data: iuOturumlar, error: iuOturumError } = await adminSupabase
      .from("ogrenme_araci_video_yukleme_oturumlari")
      .select("yukleme_id, kullanici_id, gorev_id, arac_id, embed_url")
      .eq("kaynak", "iu")
      .eq("durum", "dogrulama_bekliyor")
      .eq("video_guid", guid);
    if (iuOturumError) {
      return NextResponse.json({ hata: "İÜ video teslim oturumu sorgulanamadı.", detay: iuOturumError.message }, { status: 500 });
    }
    if ((iuOturumlar?.length ?? 0) > 1) {
      return NextResponse.json({ hata: "Bunny video kimliği birden fazla İÜ teslimine bağlı." }, { status: 409 });
    }
    for (const oturum of iuOturumlar ?? []) {
      if (!oturum.gorev_id || !oturum.arac_id) continue;
      const { data: sonuc, error: teslimError } = await adminSupabase.rpc("uretim_video_teslim_et", {
        p_gorev_id: oturum.gorev_id,
        p_iu_id: oturum.kullanici_id,
        p_video_url: oturum.embed_url,
        p_thumbnail_url: null,
        p_islem_anahtari: guid,
      });
      if (teslimError) return NextResponse.json({ hata: "İÜ video teslimi tamamlanamadı.", detay: teslimError.message }, { status: 500 });
      const { error: iuSureError } = await adminSupabase.from("ogrenme_araclari")
        .update({ sure_saniye: durum.videoSuresiSaniye, metadata_dogrulandi: true })
        .eq("arac_id", oturum.arac_id).eq("arac_turu", "video");
      if (iuSureError) return NextResponse.json({ hata: "İÜ videosunun süresi yazılamadı.", detay: iuSureError.message }, { status: 500 });
      await adminSupabase.from("ogrenme_araci_video_yukleme_oturumlari").delete().eq("yukleme_id", oturum.yukleme_id);
      const talepId = (sonuc as { talep_id?: string } | null)?.talep_id;
      if (talepId) {
        const { data: talep } = await adminSupabase.from("talepler").select("uretici_id").eq("talep_id", talepId).maybeSingle();
        if (talep?.uretici_id) pushYayinlaArkada(adminSupabase, "uretim_durum_gecisi", [talep.uretici_id]);
      }
    }

    let tamamlananTalep = 0;
    for (const talep of bekleyenTalepler ?? []) {
      // RPC idempotenttir ve veznenin önceden açtığı doğrulanmamış kabuğu
      // tamamlar; kabuğun varlığı webhook'u durdurmamalıdır.
      const sonuc = await hazirVideoTamamla(adminSupabase, {
        talep_id: talep.talep_id, uretici_id: talep.uretici_id,
        video_url: talep.hazir_video_url, guid,
      }, durum.videoSuresiSaniye);

      const alici = (sonuc as { sonraki?: { atanan_iu_id?: string } | null } | null)?.sonraki?.atanan_iu_id;
      if (alici) pushYayinlaArkada(adminSupabase, "uretim_durum_gecisi", [alici]);
      tamamlananTalep += 1;
    }

    // Diğer video akışlarında ve daha önce açılmış kayıtta süreyi otoritatif
    // değerle eşitle. Yayın kapısı ayrıca Bunny durumunu her seferinde doğrular.
    const { error } = await adminSupabase
      .from("ogrenme_araclari")
      .update({ sure_saniye: durum.videoSuresiSaniye, metadata_dogrulandi: true })
      .eq("arac_turu", "video")
      .ilike("dosya_yolu", `%${guid}%`);

    if (error) {
      return NextResponse.json({ hata: "Süre yazılamadı.", detay: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { mesaj: "Video hazırlandı.", guid, video_suresi_saniye: durum.videoSuresiSaniye, tamamlanan_talep: tamamlananTalep },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      { hata: "Webhook işlenemedi.", detay: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
