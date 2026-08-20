// Eczanem izleme sonrasında yalnız tamamlama anında sabitlenen soruları döndürür.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { musteriKimligi } from "@/lib/eczanem/oturum";
import { olayIdGecerliMi } from "@/lib/izleme/baslat";
import { aktifGonderimUyeliginiDogrula } from "@/lib/eczanem/aktifUyelik";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const kimlik = await musteriKimligi(adminSupabase, user.id);
    if (!kimlik.ok) return rolHatasi(kimlik.hata ?? "Müşteri doğrulanamadı.");
    const musteriId = kimlik.musteriId!;

    const { searchParams } = new URL(request.url);
    const izleme_id = searchParams.get("izleme_id");
    if (!izleme_id) return validasyonHatasi("izleme_id zorunludur.", ["izleme_id"]);
    if (!olayIdGecerliMi(izleme_id)) return validasyonHatasi("Geçersiz izleme kimliği gönderildi.", ["izleme_id"]);

    const { data: izleme, error: izlemeError } = await adminSupabase
      .from("eczanem_izleme_kayitlari")
      .select("izleme_id, yayin_id, musteri_id, gonderim_id, tamamlandi_mi, soru_indeksleri, cevaplandi_mi")
      .eq("izleme_id", izleme_id)
      .single();
    if (izlemeError) return hataYaniti("İzleme sorgulanamadı.", "eczanem_izleme_kayitlari SELECT", izlemeError, 404);
    const izlemeKontrol = veriKontrol(izleme, "eczanem_izleme_kayitlari SELECT — izleme_id", "İzleme kaydı bulunamadı.");
    if (!izlemeKontrol.gecerli) return izlemeKontrol.yanit;
    if (izleme.musteri_id !== musteriId) return rolHatasi("Bu izleme kaydına erişim yetkiniz yok.");
    const uyelik = await aktifGonderimUyeliginiDogrula(adminSupabase, musteriId, izleme.gonderim_id);
    if (!uyelik.ok) return isKuraluHatasi(uyelik.hata ?? "Bu eczanedeki üyeliğiniz aktif değil.");
    if (!izleme.tamamlandi_mi) return isKuraluHatasi("Sorular ancak video tamamlandıktan sonra gösterilebilir.");
    if (izleme.cevaplandi_mi) return isKuraluHatasi("Bu videonun soruları zaten cevaplandı.");

    const soruIndeksleri = izleme.soru_indeksleri as number[] | null;
    if (!Array.isArray(soruIndeksleri) || soruIndeksleri.length === 0) {
      return isKuraluHatasi("Bu video için cevaplanabilir soru bulunmuyor.");
    }

    const { data: yayin, error: yayinError } = await adminSupabase
      .from("v_yayin_detay")
      .select("sorular")
      .eq("yayin_id", izleme.yayin_id)
      .single();
    if (yayinError || !yayin || !Array.isArray(yayin.sorular)) {
      return hataYaniti("Yayın soru seti alınamadı.", "v_yayin_detay SELECT — sabit Eczanem soruları", yayinError, 404);
    }

    const secilenSorular = soruIndeksleri.map((soru_index) => {
      const soru = yayin.sorular?.[soru_index];
      if (!soru || !Array.isArray(soru.secenekler)) return null;
      return {
        soru_index,
        soru_metni: soru.soru_metni,
        secenekler: soru.secenekler.map((secenek: { harf: string; metin: string }) => ({
          harf: secenek.harf,
          metin: secenek.metin,
        })),
      };
    });
    if (secilenSorular.some((soru) => soru === null)) {
      return hataYaniti("Atanmış sorulardan biri güncel soru setinde bulunamadı.", "eczanem_izleme_kayitlari.soru_indeksleri", null);
    }

    return NextResponse.json({ sorular: secilenSorular }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /eczanem/api/izleme/sorular");
  }
}
