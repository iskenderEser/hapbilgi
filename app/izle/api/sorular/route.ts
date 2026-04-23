// app/izle/api/sorular/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

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

    if (ocError) return hataYaniti("Önceki cevaplar kontrol edilemedi.", "soru_cevaplari tablosu SELECT — izleme_id kontrolü", ocError);
    if ((oncekiCevap ?? []).length > 0) return isKuraluHatasi("Bu izleme için sorular zaten cevaplandı.");

    // Yayın → soru seti → sorular zinciri
    const { data: yayin, error: yayinError } = await adminSupabase
      .from("yayin_yonetimi")
      .select("soru_seti_durum_id")
      .eq("yayin_id", izleme.yayin_id)
      .single();

    const yayinKontrol = veriKontrol(yayin, "yayin_yonetimi tablosu SELECT — yayin_id kontrolü", "Yayın bulunamadı.");
    if (!yayinKontrol.gecerli) return yayinKontrol.yanit;
    if (yayinError) return hataYaniti("Yayın sorgulanırken hata oluştu.", "yayin_yonetimi tablosu SELECT", yayinError, 404);

    const { data: soruSetiDurum, error: ssdError } = await adminSupabase
      .from("soru_seti_durumu")
      .select("soru_seti_id")
      .eq("soru_seti_durum_id", yayin.soru_seti_durum_id)
      .single();

    const ssdKontrol = veriKontrol(soruSetiDurum, "soru_seti_durumu tablosu SELECT — soru_seti_durum_id kontrolü", "Soru seti durumu bulunamadı.");
    if (!ssdKontrol.gecerli) return ssdKontrol.yanit;
    if (ssdError) return hataYaniti("Soru seti durumu sorgulanırken hata oluştu.", "soru_seti_durumu tablosu SELECT", ssdError, 404);

    const { data: soruSeti, error: ssError } = await adminSupabase
      .from("soru_setleri")
      .select("sorular")
      .eq("soru_seti_id", soruSetiDurum.soru_seti_id)
      .single();

    const ssKontrol = veriKontrol(soruSeti, "soru_setleri tablosu SELECT — soru_seti_id kontrolü", "Soru seti bulunamadı.");
    if (!ssKontrol.gecerli) return ssKontrol.yanit;
    if (ssError) return hataYaniti("Soru seti sorgulanırken hata oluştu.", "soru_setleri tablosu SELECT", ssError, 404);

    if (!soruSeti.sorular || soruSeti.sorular.length < 2) {
      return hataYaniti("Soru setinde yeterli soru bulunamadı.", "soru_setleri — sorular kontrolü", null, 404);
    }

    // Randomize 2 soru seç
    const karisik = [...soruSeti.sorular].sort(() => Math.random() - 0.5);
    const secilenSorular = karisik.slice(0, 2).map((s: any, i: number) => ({
      soru_index: i,
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