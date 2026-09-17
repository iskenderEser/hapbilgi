import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, hataYaniti, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { uuidGecerliMi, uretimRpcHataYaniti } from "@/lib/uretim/rpc";
import { pushYayinlaArkada } from "@/lib/push/orkestrasyon";
import { podcastRevizyondaTranskriptTalebiDogrula, podcastTranskriptTercihiCoz } from "@/lib/ogrenmeAraci/sozlesme";
import { bunnyVideoDurumu, embedUrlGuidCikar } from "@/lib/video/bunnyYukleme";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();
    const rol = await rolCozucu(adminSupabase, user.id);
    if (!URETICI_ROLLER.includes(rol)) return rolHatasi("Yalnız talebin üretici rolü karar verebilir.");

    const body = await request.json();
    const { gorev_id, karar, notlar, beklenen_surum, islem_anahtari, revizyonda_transkript_istendi } = body;
    if (!uuidGecerliMi(gorev_id)) return validasyonHatasi("gorev_id geçerli bir UUID olmalıdır.", ["gorev_id"]);
    if (!uuidGecerliMi(islem_anahtari)) return validasyonHatasi("islem_anahtari geçerli bir UUID olmalıdır.", ["islem_anahtari"]);
    if (!Number.isInteger(beklenen_surum) || beklenen_surum < 1) return validasyonHatasi("İşleminizi güncellemek için sayfanızı yenileyin", ["beklenen_surum"]);
    if (!["onaylandi", "revizyon bekleniyor", "Iptal Edildi"].includes(karar)) return validasyonHatasi("Geçersiz üretici kararı.", ["karar"]);
    if (karar === "revizyon bekleniyor" && (typeof notlar !== "string" || !notlar.trim())) return validasyonHatasi("Revizyon notu zorunludur.", ["notlar"]);
    if (revizyonda_transkript_istendi !== undefined && typeof revizyonda_transkript_istendi !== "boolean") {
      return validasyonHatasi("Revizyon transkript tercihi boolean olmalıdır.", ["revizyonda_transkript_istendi"]);
    }

    const { data: gorevBilgisi } = await adminSupabase.from("uretim_gorevleri").select("asama, talep_id, arac_id").eq("gorev_id", gorev_id).maybeSingle();
    const { data: talepBilgisi } = gorevBilgisi
      ? await adminSupabase.from("talepler").select("ogrenme_araci_turu, hazir_video, ogrenme_araci_tercihleri").eq("talep_id", gorevBilgisi.talep_id).maybeSingle()
      : { data: null };
    const aracTuru = talepBilgisi?.ogrenme_araci_turu;

    // TUS aktarımı bitmiş olsa da video henüz izlenebilir olmayabilir. Üretici
    // yalnız Bunny Ready + pozitif süre doğrulandıktan sonra onay verebilir.
    // Revizyon/iptal bu kapıdan geçmez; teknik hata revizyon hakkı tüketmez.
    if (karar === "onaylandi" && gorevBilgisi?.asama === "video" && aracTuru === "video") {
      const { data: video, error: videoError } = gorevBilgisi.arac_id
        ? await adminSupabase.from("ogrenme_araclari").select("dosya_yolu, metadata").eq("arac_id", gorevBilgisi.arac_id).eq("arac_turu", "video").maybeSingle()
        : { data: null, error: null };
      if (videoError) return hataYaniti("Video doğrulanamadı.", "ogrenme_araclari SELECT — üretici kararı", videoError);
      const guid = embedUrlGuidCikar(video?.dosya_yolu);
      if (!guid) return isKuraluHatasi("Video henüz incelenebilir durumda değil.");
      const bunnyDurumu = await bunnyVideoDurumu(guid);
      if (!bunnyDurumu.ok) {
        return hataYaniti(bunnyDurumu.hata, bunnyDurumu.adim, bunnyDurumu.detay ? { message: bunnyDurumu.detay } : null, 503);
      }
      if (bunnyDurumu.hatali) return isKuraluHatasi("Video işlenemediği için onaylanamaz.");
      if (!bunnyDurumu.hazir) return isKuraluHatasi("Video işleniyor. Hazır olduğunda onaylayabilirsiniz.");
      const { error: dogrulamaError } = await adminSupabase
        .from("ogrenme_araclari")
        .update({
          sure_saniye: bunnyDurumu.videoSuresiSaniye,
          metadata_dogrulandi: true,
          metadata: { ...((video?.metadata as Record<string, unknown> | null) ?? {}), video_dogrulandi: true },
          updated_at: new Date().toISOString(),
        })
        .eq("arac_id", gorevBilgisi.arac_id!);
      if (dogrulamaError) return hataYaniti("Video doğrulaması kaydedilemedi.", "ogrenme_araclari UPDATE — üretici kararı", dogrulamaError);
    }
    const revizyonTranskriptKarari = podcastRevizyondaTranskriptTalebiDogrula({
      aracTuru,
      asama: gorevBilgisi?.asama,
      karar,
      hazirPodcast: talepBilgisi?.hazir_video === true,
      mevcutTranskriptIstendi: podcastTranskriptTercihiCoz(talepBilgisi?.ogrenme_araci_tercihleri as Record<string, unknown> | null),
      revizyondaTranskriptIstendi: revizyonda_transkript_istendi === true,
    });
    if (!revizyonTranskriptKarari.ok) return validasyonHatasi(revizyonTranskriptKarari.hata, ["revizyonda_transkript_istendi"]);
    const ortakAracKarari = ["video", "podcast", "gorsel", "flip_pdf"].includes(aracTuru ?? "") && gorevBilgisi?.asama === "video";
    const rpcAdi = !ortakAracKarari ? "uretim_uretici_karar_ver" : aracTuru === "video" ? "uretim_video_uretici_karar_ver" : aracTuru === "gorsel" ? "uretim_gorsel_uretici_karar_ver" : aracTuru === "flip_pdf" ? "uretim_flip_pdf_uretici_karar_ver" : "uretim_podcast_uretici_karar_ver";
    const rpcParametreleri: Record<string, unknown> = {
      p_gorev_id: gorev_id,
      p_uretici_id: user.id,
      p_karar: karar,
      p_notlar: typeof notlar === "string" ? notlar : null,
      p_beklenen_surum: beklenen_surum,
      p_islem_anahtari: islem_anahtari,
    };
    if (aracTuru === "podcast" && gorevBilgisi?.asama === "video") {
      rpcParametreleri.p_revizyonda_transkript_istendi = revizyonda_transkript_istendi === true;
    } else if (revizyonda_transkript_istendi === true) {
      return validasyonHatasi("Transkript yalnız podcast üretim revizyonunda istenebilir.", ["revizyonda_transkript_istendi"]);
    }
    const { data: sonuc, error } = await adminSupabase.rpc(rpcAdi, rpcParametreleri);
    if (error?.code === "23514" && error.message?.includes("güncelliğini yitirdi")) {
      return validasyonHatasi("İşleminizi güncellemek için sayfanızı yenileyin", ["beklenen_surum"]);
    }
    if (error) return uretimRpcHataYaniti("Üretici kararı kaydedilemedi.", `${rpcAdi} RPC`, error);

    const sonucNesnesi = sonuc as { sonraki?: { atanan_iu_id?: string } | null } | null;
    let pushAlici: string | null = sonucNesnesi?.sonraki?.atanan_iu_id ?? null;
    if (!pushAlici && karar === "revizyon bekleniyor") {
      const { data: gorev } = await adminSupabase.from("uretim_gorevleri").select("atanan_iu_id").eq("gorev_id", gorev_id).maybeSingle();
      pushAlici = gorev?.atanan_iu_id ?? null;
    }
    if (pushAlici) pushYayinlaArkada(adminSupabase, "uretim_durum_gecisi", [pushAlici]);

    return NextResponse.json({ mesaj: "Üretici kararı kaydedildi.", sonuc }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /uretim/api/karar");
  }
}
