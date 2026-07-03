// app/eclub/panel/api/sorular/route.ts
// E-Club izleme sonrası soruları döndürür (video başı N soru, rastgele).
// Üretim izle/api/sorular deseni; kişi (eclub_kisiler) + eclub_izleme_kayitlari.
// 'dogru' alanı client'a SIZDIRILMAZ — sadece harf+metin döner.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { rastgeleSoruSec } from "@/lib/soru/secim";

const ECLUB_KISI_ROLLERI = ["eczaci", "eczane_teknisyeni"];
const VARSAYILAN_SORU_SAYISI = 2;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    // Kişi kimliği
    const { data: kisi, error: kisiError } = await adminSupabase
      .from("eclub_kisiler")
      .select("kisi_id, rol")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (kisiError) return hataYaniti("Kişi bilgisi alınamadı.", "eclub_kisiler SELECT — auth_user_id", kisiError);
    if (!kisi) return rolHatasi("Bu işlem yalnız E-Club kişilerine açıktır.");
    if (!ECLUB_KISI_ROLLERI.includes(kisi.rol)) return rolHatasi("Geçersiz kişi rolü.");

    const { searchParams } = new URL(request.url);
    const izleme_id = searchParams.get("izleme_id");
    if (!izleme_id) return validasyonHatasi("izleme_id zorunludur.", ["izleme_id"]);

    // İzleme kaydı (kişiye ait, tamamlanmış)
    const { data: izleme, error: izlemeError } = await adminSupabase
      .from("eclub_izleme_kayitlari")
      .select("izleme_id, yayin_id, kisi_id, tamamlandi_mi")
      .eq("izleme_id", izleme_id)
      .single();

    const izlemeKontrol = veriKontrol(izleme, "eclub_izleme_kayitlari SELECT — izleme_id", "İzleme kaydı bulunamadı.");
    if (!izlemeKontrol.gecerli) return izlemeKontrol.yanit;
    if (izlemeError) return hataYaniti("İzleme sorgulanamadı.", "eclub_izleme_kayitlari SELECT", izlemeError, 404);
    if (izleme.kisi_id !== kisi.kisi_id) return rolHatasi("Bu izleme kaydına erişim yetkiniz yok.");
    if (!izleme.tamamlandi_mi) return isKuraluHatasi("Sorular ancak video tamamlandıktan sonra gösterilebilir.");

    // Bu izleme için cevaplama zaten yapıldı mı?
    const { data: oncekiCevaplama } = await adminSupabase
      .from("eclub_kazanilan_puanlar")
      .select("kazanilan_puan_id")
      .eq("izleme_id", izleme_id)
      .eq("puan_turu", "cevaplama")
      .limit(1);

    if ((oncekiCevaplama ?? []).length > 0) return isKuraluHatasi("Bu izleme için sorular zaten cevaplandı.");

    // Sorular + video_basi_soru_sayisi → v_yayin_detay
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
        "v_yayin_detay — sorular kontrolü",
        null,
        404
      );
    }

    // Rastgele seçim (orijinalIndex → soru_index). 'dogru' alanı düşürülür.
    const secilenler = rastgeleSoruSec(yayin.sorular as unknown[], videoBasiSoruSayisi);

    const secilenSorular = (secilenler as Array<{ orijinalIndex: number; soru_metni: string; secenekler: Array<{ harf: string; metin: string }> }>).map((s) => ({
      soru_index: s.orijinalIndex,
      soru_metni: s.soru_metni,
      secenekler: s.secenekler.map((se) => ({ harf: se.harf, metin: se.metin })),
    }));

    return NextResponse.json({ sorular: secilenSorular }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/panel/api/sorular");
  }
}