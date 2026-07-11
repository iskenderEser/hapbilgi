// app/eczanem/api/izleme/sorular/route.ts
// Müşteri izleme sonrası soruları döndürür (video başı N soru, rastgele).
// 'dogru' alanı client'a SIZDIRILMAZ. Ömür boyu bir kez cevaplanır.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { musteriKimligi } from "@/lib/eczanem/oturum";
import { kazanimVarMi } from "@/lib/eczanem/kazanim";
import { rastgeleSoruSec } from "@/lib/soru/secim";

const VARSAYILAN_SORU_SAYISI = 2;

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

    const { data: izleme, error: izlemeError } = await adminSupabase
      .from("eczanem_izleme_kayitlari")
      .select("izleme_id, yayin_id, musteri_id, tamamlandi_mi")
      .eq("izleme_id", izleme_id)
      .single();

    const izlemeKontrol = veriKontrol(izleme, "eczanem_izleme_kayitlari SELECT — izleme_id", "İzleme kaydı bulunamadı.");
    if (!izlemeKontrol.gecerli) return izlemeKontrol.yanit;
    if (izlemeError) return hataYaniti("İzleme sorgulanamadı.", "eczanem_izleme_kayitlari SELECT", izlemeError, 404);
    if (izleme.musteri_id !== musteriId) return rolHatasi("Bu izleme kaydına erişim yetkiniz yok.");
    if (!izleme.tamamlandi_mi) return isKuraluHatasi("Sorular ancak video tamamlandıktan sonra gösterilebilir.");

    // Bu yayının soruları ömür boyu bir kez cevaplanır (kazanım varsa bitti).
    if (await kazanimVarMi(adminSupabase, musteriId, izleme.yayin_id, "cevap")) {
      return isKuraluHatasi("Bu videonun soruları zaten cevaplandı.");
    }

    const { data: yayin, error: yayinError } = await adminSupabase
      .from("v_yayin_detay")
      .select("sorular, video_basi_soru_sayisi")
      .eq("yayin_id", izleme.yayin_id)
      .single();

    if (yayinError || !yayin) return hataYaniti("Yayın bilgisi alınamadı.", "v_yayin_detay SELECT", yayinError, 404);

    const videoBasiSoruSayisi = yayin.video_basi_soru_sayisi ?? VARSAYILAN_SORU_SAYISI;
    if (!yayin.sorular || yayin.sorular.length < videoBasiSoruSayisi) {
      return hataYaniti(
        `Soru setinde yeterli soru bulunamadı. Gerekli: ${videoBasiSoruSayisi}, mevcut: ${yayin.sorular?.length ?? 0}`,
        "v_yayin_detay — sorular kontrolü", null, 404
      );
    }

    const secilenler = rastgeleSoruSec(yayin.sorular as unknown[], videoBasiSoruSayisi);
    const secilenSorular = (secilenler as Array<{ orijinalIndex: number; soru_metni: string; secenekler: Array<{ harf: string; metin: string }> }>).map((s) => ({
      soru_index: s.orijinalIndex,
      soru_metni: s.soru_metni,
      secenekler: s.secenekler.map((se) => ({ harf: se.harf, metin: se.metin })),
    }));

    return NextResponse.json({ sorular: secilenSorular }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /eczanem/api/izleme/sorular");
  }
}
