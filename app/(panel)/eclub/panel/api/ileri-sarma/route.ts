import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ECLUB_TUKETICI_ROLLERI } from "@/lib/utils/roller";
import {
  hataYaniti,
  isKuraluHatasi,
  rolHatasi,
  sunucuHatasi,
  validasyonHatasi,
  yetkiHatasi,
} from "@/lib/utils/hataIsle";
import { olayIdGecerliMi } from "@/lib/izleme/baslat";
import { eclubIzlemeHaklari } from "@/lib/eclub/izlemeKurali";
import { eclubIleriSarmaKaybiHesapla, eclubIleriSarmaKonumuDogrula } from "@/lib/eclub/ileriSarma";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const { data: kisi, error: kisiError } = await adminSupabase
      .from("eclub_kisiler")
      .select("kisi_id, rol")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (kisiError) return hataYaniti("Kişi bilgisi alınamadı.", "eclub_kisiler SELECT — ileri sarma", kisiError);
    if (!kisi || !ECLUB_TUKETICI_ROLLERI.includes(kisi.rol)) {
      return rolHatasi("Bu işlem yalnız E-Club eczane çalışanlarına açıktır.");
    }

    const body = await request.json();
    const { izleme_id, olay_id, atlama_baslangic, atlama_bitis } = body;
    if (!olayIdGecerliMi(izleme_id) || !olayIdGecerliMi(olay_id)) {
      return validasyonHatasi("Geçerli izleme_id ve olay_id zorunludur.", ["izleme_id", "olay_id"]);
    }

    const { data: izleme, error: izlemeError } = await adminSupabase
      .from("eclub_izleme_kayitlari")
      .select("izleme_id, yayin_id, kisi_id, oneri_id, tamamlandi_mi")
      .eq("izleme_id", izleme_id)
      .single();
    if (izlemeError || !izleme) {
      return hataYaniti("İzleme kaydı bulunamadı.", "eclub_izleme_kayitlari SELECT — ileri sarma", izlemeError, 404);
    }
    if (izleme.kisi_id !== kisi.kisi_id) return rolHatasi("Bu izleme kaydına erişim yetkiniz yok.");
    if (izleme.tamamlandi_mi) return isKuraluHatasi("Tamamlanmış izlemeye ileri sarma kaybı yazılamaz.");
    if (!izleme.oneri_id) return isKuraluHatasi("İzleme geçerli bir E-Club önerisine bağlı değil.");

    const [{ data: oneri, error: oneriError }, { data: yayin, error: yayinError }] = await Promise.all([
      adminSupabase
        .from("eclub_oneri_kayitlari")
        .select("oneri_id, oneri_baslangic, oneri_bitis")
        .eq("oneri_id", izleme.oneri_id)
        .single(),
      adminSupabase
        .from("v_yayin_detay")
        .select("yayin_id, video_durum_id, video_url, video_puani")
        .eq("yayin_id", izleme.yayin_id)
        .single(),
    ]);
    if (oneriError || !oneri) return hataYaniti("Öneri kaydı doğrulanamadı.", "eclub_oneri_kayitlari SELECT — ileri sarma", oneriError, 404);
    if (yayinError || !yayin?.video_durum_id) return hataYaniti("Yayın videosu çözülemedi.", "v_yayin_detay SELECT — ileri sarma", yayinError, 404);

    const { data: videoDurum, error: videoDurumError } = await adminSupabase
      .from("video_durumu")
      .select("video_id")
      .eq("video_durum_id", yayin.video_durum_id)
      .single();
    if (videoDurumError || !videoDurum?.video_id) {
      return hataYaniti("Video kaydı çözülemedi.", "video_durumu SELECT — E-Club ileri sarma", videoDurumError, 404);
    }

    const { data: video, error: videoError } = await adminSupabase
      .from("videolar")
      .select("video_id, video_url, video_suresi_saniye")
      .eq("video_id", videoDurum.video_id)
      .single();
    if (videoError || !video) return hataYaniti("Video bulunamadı.", "videolar SELECT — E-Club ileri sarma", videoError, 404);

    // Tek yazıcı ilkesi (Faz 3): süreyi burada yazmıyoruz — garanti edilmiş olmalı.
    // Boşsa (beklenmez) yazmak yerine reddedilir.
    const videoSuresi = Number(video.video_suresi_saniye ?? 0);
    if (videoSuresi <= 0) {
      return isKuraluHatasi("Video henüz puanlı izlemeye hazır değil; süre doğrulanamadı.");
    }

    const konum = eclubIleriSarmaKonumuDogrula(atlama_baslangic, atlama_bitis, videoSuresi);
    if (!konum) {
      return validasyonHatasi("İleri sarma konumları video süresi içinde ve ileri yönde olmalıdır.", ["atlama_baslangic", "atlama_bitis"]);
    }

    const haklar = eclubIzlemeHaklari(oneri.oneri_baslangic, oneri.oneri_bitis);
    const hesaplananKayip = eclubIleriSarmaKaybiHesapla({
      videoPuani: Number(yayin.video_puani ?? 0),
      videoSuresi,
      atlananSure: konum.atlananSure,
      puanli: haklar.puanli,
    });

    const { data: satirlar, error: kayitError } = await adminSupabase.rpc("eclub_ileri_sarma_kaydet", {
      p_izleme_id: izleme_id,
      p_kisi_id: kisi.kisi_id,
      p_olay_id: olay_id,
      p_atlama_baslangic: konum.baslangic,
      p_atlama_bitis: konum.bitis,
      p_kaybedilen_puan: hesaplananKayip,
    });
    if (kayitError) return hataYaniti("İleri sarma kaydedilemedi.", "eclub_ileri_sarma_kaydet RPC", kayitError);

    const sonuc = satirlar?.[0] as { kaybedilen_puan: number; tekrar_istek: boolean } | undefined;
    if (!sonuc) return hataYaniti("İleri sarma kaydedildi ancak sonuç alınamadı.", "eclub_ileri_sarma_kaydet RPC — dönen veri", null);

    return NextResponse.json({
      mesaj: sonuc.tekrar_istek ? "İleri sarma daha önce kaydedildi." : "İleri sarma kaydedildi.",
      kaybedilen_puan: Number(sonuc.kaybedilen_puan ?? 0),
      tekrar_istek: sonuc.tekrar_istek,
    }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eclub/panel/api/ileri-sarma");
  }
}
