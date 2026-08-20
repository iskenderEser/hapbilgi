// Eczanem müşteri izlemesi — BİTİR.
// Süre doğrulaması, tamamlama ve izleme puanı tek veritabanı işlemiyle yazılır.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { musteriKimligi } from "@/lib/eczanem/oturum";
import { olayIdGecerliMi } from "@/lib/izleme/baslat";
import { sabitSoruIndeksleri } from "@/lib/soru/secim";
import { aktifGonderimUyeliginiDogrula } from "@/lib/eczanem/aktifUyelik";

const VARSAYILAN_SORU_SAYISI = 2;

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const kimlik = await musteriKimligi(adminSupabase, user.id);
    if (!kimlik.ok) return rolHatasi(kimlik.hata ?? "Müşteri doğrulanamadı.");
    const musteriId = kimlik.musteriId!;

    const body = await request.json();
    const { izleme_id } = body;
    if (!izleme_id) return validasyonHatasi("izleme_id zorunludur.", ["izleme_id"]);
    if (!olayIdGecerliMi(izleme_id)) return validasyonHatasi("Geçersiz izleme kimliği gönderildi.", ["izleme_id"]);

    const { data: izleme, error: izlemeError } = await adminSupabase
      .from("eczanem_izleme_kayitlari")
      .select("izleme_id, yayin_id, musteri_id, gonderim_id")
      .eq("izleme_id", izleme_id)
      .single();
    if (izlemeError) return hataYaniti("İzleme sorgulanamadı.", "eczanem_izleme_kayitlari SELECT", izlemeError, 404);
    const izlemeKontrol = veriKontrol(izleme, "eczanem_izleme_kayitlari SELECT — izleme_id", "İzleme kaydı bulunamadı.");
    if (!izlemeKontrol.gecerli) return izlemeKontrol.yanit;
    if (izleme.musteri_id !== musteriId) return rolHatasi("Bu izleme kaydına erişim yetkiniz yok.");
    const uyelik = await aktifGonderimUyeliginiDogrula(adminSupabase, musteriId, izleme.gonderim_id);
    if (!uyelik.ok) return isKuraluHatasi(uyelik.hata ?? "Bu eczanedeki üyeliğiniz aktif değil.");

    const { data: yayinDetay, error: detayError } = await adminSupabase
      .from("v_yayin_detay")
      .select("sorular, video_basi_soru_sayisi")
      .eq("yayin_id", izleme.yayin_id)
      .single();
    if (detayError || !yayinDetay) {
      return hataYaniti("Yayın soru bilgisi alınamadı.", "v_yayin_detay SELECT — Eczanem izleme tamamlama", detayError, 404);
    }

    const sorular = Array.isArray(yayinDetay.sorular) ? yayinDetay.sorular : [];
    const soruSayisi = Math.max(0, yayinDetay.video_basi_soru_sayisi ?? VARSAYILAN_SORU_SAYISI);
    const soruIndeksleri = sabitSoruIndeksleri(sorular.length, soruSayisi, izleme_id);

    const { data: tamamlamaSatirlari, error: tamamlamaError } = await adminSupabase.rpc("eczanem_izleme_tamamla", {
      p_izleme_id: izleme_id,
      p_musteri_id: musteriId,
      p_soru_indeksleri: soruIndeksleri,
    });
    if (tamamlamaError?.code === "P0001") {
      return isKuraluHatasi(tamamlamaError.message || "Video henüz tamamlanabilecek kadar oynatılmadı.");
    }
    if (tamamlamaError?.code === "22023") {
      return validasyonHatasi(tamamlamaError.message || "İzleme doğrulanamadı.");
    }
    if (tamamlamaError) {
      return hataYaniti("İzleme tamamlanamadı.", "eczanem_izleme_tamamla RPC", tamamlamaError);
    }

    const tamamlama = tamamlamaSatirlari?.[0] as {
      yeni_tamamlandi: boolean;
      puan_kazanildi: boolean;
      izleme_puani: number;
      soru_gosterilecek: boolean;
    } | undefined;
    if (!tamamlama) {
      return hataYaniti("İzleme tamamlandı ancak sonuç alınamadı.", "eczanem_izleme_tamamla RPC — dönen veri", null);
    }

    return NextResponse.json({
      mesaj: tamamlama.yeni_tamamlandi ? "İzleme tamamlandı." : "Tamamlanmış izleme açıldı.",
      yeni_tamamlandi: tamamlama.yeni_tamamlandi,
      puan_kazanildi: tamamlama.puan_kazanildi,
      izleme_puani: tamamlama.izleme_puani,
      puan_uyarisi: null,
      soru_gosterilecek: tamamlama.soru_gosterilecek,
    }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "PUT /eczanem/api/izleme/bitir");
  }
}
