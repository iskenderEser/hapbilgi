import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { TUKETICI_ROLLER } from "@/lib/utils/roller";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const rol = await rolCozucu(adminSupabase, user.id);
    if (!TUKETICI_ROLLER.includes(rol)) return rolHatasi("Sadece utt ve kd_utt soruları görebilir.");

    const { searchParams } = new URL(request.url);
    const izleme_id = searchParams.get("izleme_id");
    if (!izleme_id) return validasyonHatasi("izleme_id zorunludur.", ["izleme_id"]);

    const { data: izleme, error: izlemeError } = await adminSupabase
      .from("izleme_kayitlari")
      .select("izleme_id, yayin_id, kullanici_id, tamamlandi_mi, soru_hakki_var_mi, soru_hakki_nedeni, soru_indeksleri")
      .eq("izleme_id", izleme_id)
      .single();

    const izlemeKontrol = veriKontrol(izleme, "izleme_kayitlari tablosu SELECT — izleme_id kontrolü", "İzleme kaydı bulunamadı.");
    if (!izlemeKontrol.gecerli) return izlemeKontrol.yanit;
    if (izlemeError) return hataYaniti("İzleme kaydı sorgulanırken hata oluştu.", "izleme_kayitlari tablosu SELECT", izlemeError, 404);
    if (izleme.kullanici_id !== user.id) return rolHatasi("Bu izleme kaydına erişim yetkiniz yok.");
    if (!izleme.tamamlandi_mi) return isKuraluHatasi("Sorular ancak video tamamlandıktan sonra gösterilebilir.");
    if (!izleme.soru_hakki_var_mi) {
      return isKuraluHatasi(`Bu izleme için soru hakkı bulunmuyor (${izleme.soru_hakki_nedeni ?? "uygun_degil"}).`);
    }

    const soruIndeksleri = izleme.soru_indeksleri as number[] | null;
    if (!Array.isArray(soruIndeksleri) || soruIndeksleri.length === 0) {
      return hataYaniti("İzlemeye atanmış soru seti bulunamadı.", "izleme_kayitlari.soru_indeksleri", null);
    }

    const { data: oncekiCevap, error: cevapError } = await adminSupabase
      .from("soru_cevaplari")
      .select("soru_cevap_id")
      .eq("izleme_id", izleme_id)
      .limit(1);
    if (cevapError) return hataYaniti("Önceki cevaplar kontrol edilemedi.", "soru_cevaplari tablosu SELECT", cevapError);
    if ((oncekiCevap ?? []).length > 0) return isKuraluHatasi("Bu izleme için sorular zaten cevaplandı.");

    const { data: yayin, error: yayinError } = await adminSupabase
      .from("v_yayin_detay")
      .select("sorular")
      .eq("yayin_id", izleme.yayin_id)
      .single();
    if (yayinError || !yayin || !Array.isArray(yayin.sorular)) {
      return hataYaniti("Yayın soru seti alınamadı.", "v_yayin_detay SELECT — sabit sorular", yayinError, 404);
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
      return hataYaniti("Atanmış soru indekslerinden biri güncel soru setinde bulunamadı.", "izleme_kayitlari.soru_indeksleri", null);
    }

    return NextResponse.json({ sorular: secilenSorular }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /izle/api/sorular");
  }
}
