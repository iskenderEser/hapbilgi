// app/izle/api/sorular/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["utt", "kd_utt"].includes(rol)) return rolHatasi("Sadece utt ve kd_utt soruları görebilir.");

    const { searchParams } = new URL(request.url);
    const izleme_id = searchParams.get("izleme_id");

    if (!izleme_id) return validasyonHatasi("izleme_id zorunludur.", ["izleme_id"]);

    // İzleme kaydını kontrol et
    const { data: izleme, error: izlemeError } = await adminSupabase
      .from("izleme_kayitlari")
      .select("izleme_id, yayin_id, kullanici_id, tamamlandi_mi")
      .eq("izleme_id", izleme_id)
      .single();

    const izlemeKontrol = veriKontrol(izleme, "izleme_kayitlari tablosu SELECT — izleme_id kontrolü", "İzleme kaydı bulunamadı.");
    if (!izlemeKontrol.gecerli) return izlemeKontrol.yanit;
    if (izlemeError) return hataYaniti("İzleme kaydı sorgulanırken hata oluştu.", "izleme_kayitlari tablosu SELECT", izlemeError, 404);
    if (izleme.kullanici_id !== user.id) return rolHatasi("Bu izleme kaydına erişim yetkiniz yok.");
    if (!izleme.tamamlandi_mi) return isKuraluHatasi("Sorular ancak video tamamlandıktan sonra gösterilebilir.");

    // Daha önce cevap verildi mi?
    const { data: oncekiCevap, error: ocError } = await adminSupabase
      .from("soru_cevaplari")
      .select("soru_cevap_id")
      .eq("izleme_id", izleme_id)
      .limit(1);

    if (ocError) return hataYaniti("Önceki cevaplar kontrol edilemedi.", "soru_cevaplari tablosu SELECT", ocError);
    if ((oncekiCevap ?? []).length > 0) return isKuraluHatasi("Bu izleme için sorular zaten cevaplandı.");

    // v_yayin_detay ile tek sorguda sorular + video_basi_soru_sayisi — 5 sorgu → 1 sorgu
    const { data: yayin, error: yayinError } = await adminSupabase
      .from("v_yayin_detay")
      .select("sorular, video_basi_soru_sayisi")
      .eq("yayin_id", izleme.yayin_id)
      .single();

    if (yayinError || !yayin) return hataYaniti("Yayın bilgisi alınamadı.", "v_yayin_detay SELECT", yayinError, 404);

    const videoBasiSoruSayisi = yayin.video_basi_soru_sayisi ?? 2;

    if (!yayin.sorular || yayin.sorular.length < videoBasiSoruSayisi) {
      return hataYaniti(
        `Soru setinde yeterli soru bulunamadı. Gerekli: ${videoBasiSoruSayisi}, mevcut: ${yayin.sorular?.length ?? 0}`,
        "v_yayin_detay — sorular kontrolü",
        null,
        404
      );
    }

    // Orijinal index'i koru, SONRA karıştır — cevap doğrulaması sette doğru soruyu bulsun.
    // soru_index artık sette gerçek konumu işaret eder; doğru cevap (dogru) yine gizli kalır.
    const indeksli = (yayin.sorular as any[]).map((s: any, orijinalIndex: number) => ({ ...s, orijinalIndex }));
    const karisik = indeksli.sort(() => Math.random() - 0.5);
    const secilenSorular = karisik.slice(0, videoBasiSoruSayisi).map((s: any) => ({
      soru_index: s.orijinalIndex,
      soru_metni: s.soru_metni,
      secenekler: s.secenekler.map((se: any) => ({
        harf: se.harf,
        metin: se.metin,
      })),
    }));

    return NextResponse.json({ sorular: secilenSorular }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /izle/api/sorular");
  }
}