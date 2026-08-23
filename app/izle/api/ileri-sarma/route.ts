import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  hataYaniti,
  sunucuHatasi,
  yetkiHatasi,
  rolHatasi,
  validasyonHatasi,
  isKuraluHatasi,
} from "@/lib/utils/hataIsle";
import { ileriSarmaKaybiKaydet } from "@/lib/puan/kayit";
import { ileriSarmaKaybiHesapla } from "@/lib/izleme/karar";
import { olayIdGecerliMi } from "@/lib/izleme/baslat";
import { izlemePuanZamaniAktifMi } from "@/lib/izleme/puanZamani";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { TUKETICI_ROLLER } from "@/lib/utils/roller";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const rol = await rolCozucu(adminSupabase, user.id);
    if (!TUKETICI_ROLLER.includes(rol)) return rolHatasi("Sadece utt ve kd_utt izleyebilir.");

    const body = await request.json();
    const { izleme_id, olay_id, atlama_baslangic, atlama_bitis } = body;
    if (!izleme_id || !olayIdGecerliMi(olay_id)) {
      return validasyonHatasi("izleme_id ve geçerli olay_id zorunludur.", ["izleme_id", "olay_id"]);
    }
    if (
      typeof atlama_baslangic !== "number"
      || typeof atlama_bitis !== "number"
      || !Number.isFinite(atlama_baslangic)
      || !Number.isFinite(atlama_bitis)
    ) {
      return validasyonHatasi("Atlama konumları sonlu sayı olmalıdır.", ["atlama_baslangic", "atlama_bitis"]);
    }

    const baslangic = Math.round(atlama_baslangic);
    const bitis = Math.round(atlama_bitis);
    if (baslangic < 0 || bitis <= baslangic) {
      return validasyonHatasi("İleri sarma bitişi başlangıçtan büyük olmalıdır.", ["atlama_baslangic", "atlama_bitis"]);
    }

    // Aynı istemci olayı ağ tekrarıyla ikinci kayıp yazamaz.
    const { data: mevcutKayip, error: mevcutError } = await adminSupabase
      .from("ileri_sarma_kayitlari")
      .select("olay_id, izleme_id, kullanici_id, atlama_baslangic, atlama_bitis, kaybedilen_puan")
      .eq("olay_id", olay_id)
      .maybeSingle();
    if (mevcutError) {
      return hataYaniti("İleri sarma olayı doğrulanamadı.", "ileri_sarma_kayitlari SELECT — idempotency", mevcutError);
    }
    if (mevcutKayip) {
      if (
        mevcutKayip.kullanici_id !== user.id
        || mevcutKayip.izleme_id !== izleme_id
        || mevcutKayip.atlama_baslangic !== baslangic
        || mevcutKayip.atlama_bitis !== bitis
      ) {
        return isKuraluHatasi("İleri sarma olay kimliği farklı bir işlemde kullanılmış.");
      }
      return NextResponse.json({
        mesaj: "İleri sarma daha önce kaydedildi.",
        kaybedilen_puan: mevcutKayip.kaybedilen_puan,
        tekrar_istek: true,
      }, { status: 200 });
    }

    const { data: izleme, error: izlemeError } = await adminSupabase
      .from("izleme_kayitlari")
      .select("izleme_id, yayin_id, kullanici_id, tamamlandi_mi, gercek_oynatma_mi, video_suresi_saniye, izleme_baslangic")
      .eq("izleme_id", izleme_id)
      .single();
    if (izlemeError || !izleme) {
      return hataYaniti("İzleme kaydı bulunamadı.", "izleme_kayitlari SELECT — ileri sarma", izlemeError, 404);
    }
    if (izleme.kullanici_id !== user.id) return rolHatasi("Bu izleme kaydına erişim yetkiniz yok.");
    if (!izleme.gercek_oynatma_mi || izleme.tamamlandi_mi) {
      return isKuraluHatasi("İleri sarma yalnız devam eden gerçek izleme için kaydedilebilir.");
    }
    if (!izleme.video_suresi_saniye || bitis > izleme.video_suresi_saniye) {
      return validasyonHatasi("İleri sarma video süresi sınırlarını aşıyor.", ["atlama_bitis"]);
    }

    const { data: yayinDetay, error: puanError } = await adminSupabase
      .from("v_yayin_detay")
      .select("video_puani")
      .eq("yayin_id", izleme.yayin_id)
      .single();
    if (puanError || !yayinDetay) {
      return hataYaniti("Video puanı çözülemedi.", "v_yayin_detay SELECT — ileri sarma puanı", puanError);
    }

    const atlananSure = bitis - baslangic;
    const puanliZaman = await izlemePuanZamaniAktifMi(adminSupabase, new Date(izleme.izleme_baslangic));
    const kaybedilenPuan = ileriSarmaKaybiHesapla({
      videoPuani: yayinDetay.video_puani ?? 0,
      videoSuresi: izleme.video_suresi_saniye,
      atlananSure,
      puanliZaman,
    });

    // Puansız zamanda kayıp 0 olsa da seek kaydı tutulur: bu deneme ve sonraki
    // denemeler için soru hakkı kapanışının kanıtıdır.
    const sonuc = await ileriSarmaKaybiKaydet(adminSupabase, {
      kullanici_id: user.id,
      yayin_id: izleme.yayin_id,
      izleme_id,
      olay_id,
      atlama_baslangic: baslangic,
      atlama_bitis: bitis,
      atlanan_sure: atlananSure,
      kaybedilen_puan: kaybedilenPuan,
    });

    if (!sonuc.ok) {
      if (sonuc.errorCode === "23505") {
        const { data: kazanan } = await adminSupabase
          .from("ileri_sarma_kayitlari")
          .select("izleme_id, kullanici_id, atlama_baslangic, atlama_bitis, kaybedilen_puan")
          .eq("olay_id", olay_id)
          .maybeSingle();
        if (
          kazanan?.kullanici_id === user.id
          && kazanan.izleme_id === izleme_id
          && kazanan.atlama_baslangic === baslangic
          && kazanan.atlama_bitis === bitis
        ) {
          return NextResponse.json({
            mesaj: "İleri sarma daha önce kaydedildi.",
            kaybedilen_puan: kazanan.kaybedilen_puan,
            tekrar_istek: true,
          }, { status: 200 });
        }
      }
      return hataYaniti("İleri sarma kaydedilemedi.", "ileri_sarma_kayitlari tablosu INSERT", { message: sonuc.error ?? "bilinmeyen hata" });
    }

    return NextResponse.json({
      mesaj: "İleri sarma kaydedildi.",
      kaybedilen_puan: kaybedilenPuan,
      puanli_zaman: puanliZaman,
    }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "POST /izle/api/ileri-sarma");
  }
}
