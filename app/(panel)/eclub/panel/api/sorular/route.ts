// E-Club izleme sonrası, tamamlama anında izlemeye atanmış sabit soruları döndürür.
// Süresi geçmiş öneri için bu uç hiçbir koşulda soru açmaz.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ECLUB_TUKETICI_ROLLERI } from "@/lib/utils/roller";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { olayIdGecerliMi } from "@/lib/izleme/baslat";
import { eclubIzlemeHaklari } from "@/lib/eclub/izlemeKurali";
import { eclubAktifYayinYetkisi } from "@/lib/eclub/aktifYayinYetkisi";

export async function GET(request: NextRequest) {
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

    if (kisiError) return hataYaniti("Kişi bilgisi alınamadı.", "eclub_kisiler SELECT — auth_user_id", kisiError);
    if (!kisi) return rolHatasi("Bu işlem yalnız E-Club kişilerine açıktır.");
    if (!ECLUB_TUKETICI_ROLLERI.includes(kisi.rol)) return rolHatasi("Geçersiz kişi rolü.");

    const { searchParams } = new URL(request.url);
    const izleme_id = searchParams.get("izleme_id");
    if (!izleme_id) return validasyonHatasi("izleme_id zorunludur.", ["izleme_id"]);
    if (!olayIdGecerliMi(izleme_id)) return validasyonHatasi("Geçersiz izleme kimliği gönderildi.", ["izleme_id"]);

    const { data: izleme, error: izlemeError } = await adminSupabase
      .from("eclub_izleme_kayitlari")
      .select("izleme_id, yayin_id, kisi_id, oneri_id, tamamlandi_mi, soru_hakki_var_mi, soru_hakki_nedeni, soru_indeksleri")
      .eq("izleme_id", izleme_id)
      .single();

    if (izlemeError) return hataYaniti("İzleme sorgulanamadı.", "eclub_izleme_kayitlari SELECT", izlemeError, 404);
    const izlemeKontrol = veriKontrol(izleme, "eclub_izleme_kayitlari SELECT — izleme_id", "İzleme kaydı bulunamadı.");
    if (!izlemeKontrol.gecerli) return izlemeKontrol.yanit;
    if (izleme.kisi_id !== kisi.kisi_id) return rolHatasi("Bu izleme kaydına erişim yetkiniz yok.");
    if (!(await eclubAktifYayinYetkisi(adminSupabase, user.id, izleme.yayin_id))) return rolHatasi("Aktif E-Club firma bağlantısı bulunamadı.");
    if (!izleme.tamamlandi_mi) return isKuraluHatasi("Sorular ancak video tamamlandıktan sonra gösterilebilir.");
    if (!izleme.soru_hakki_var_mi) {
      return isKuraluHatasi(`Bu izleme için soru hakkı bulunmuyor (${izleme.soru_hakki_nedeni ?? "uygun_degil"}).`);
    }

    const soruIndeksleri = izleme.soru_indeksleri as number[] | null;
    if (!Array.isArray(soruIndeksleri) || soruIndeksleri.length === 0) {
      return hataYaniti("İzlemeye atanmış soru seti bulunamadı.", "eclub_izleme_kayitlari.soru_indeksleri", null);
    }

    const { data: oneri, error: oneriError } = await adminSupabase
      .from("eclub_oneri_kayitlari")
      .select("oneri_baslangic, oneri_bitis")
      .eq("oneri_id", izleme.oneri_id)
      .single();
    if (oneriError || !oneri) return hataYaniti("Öneri kaydı doğrulanamadı.", "eclub_oneri_kayitlari SELECT — soru hakkı", oneriError, 404);
    if (!eclubIzlemeHaklari(oneri.oneri_baslangic, oneri.oneri_bitis).soruGoster) {
      return isKuraluHatasi("Süresi geçmiş öneride soru gösterilmez.");
    }

    const [{ data: oncekiDogru, error: dogruError }, { data: oncekiYanlis, error: yanlisError }] = await Promise.all([
      adminSupabase.from("eclub_dogru_cevap_kayitlari").select("kayit_id").eq("izleme_id", izleme_id).limit(1),
      adminSupabase.from("eclub_yanlis_cevap_kayitlari").select("kayit_id").eq("izleme_id", izleme_id).limit(1),
    ]);
    if (dogruError || yanlisError) return hataYaniti("Önceki cevaplar kontrol edilemedi.", "E-Club cevap kayıtları SELECT", dogruError ?? yanlisError);
    if ((oncekiDogru?.length ?? 0) > 0 || (oncekiYanlis?.length ?? 0) > 0) {
      return isKuraluHatasi("Bu izleme için sorular zaten cevaplandı.");
    }

    const { data: yayin, error: yayinError } = await adminSupabase
      .from("v_yayin_detay")
      .select("sorular")
      .eq("yayin_id", izleme.yayin_id)
      .single();
    if (yayinError || !yayin || !Array.isArray(yayin.sorular)) {
      return hataYaniti("Yayın soru seti alınamadı.", "v_yayin_detay SELECT — sabit E-Club soruları", yayinError, 404);
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
      return hataYaniti("Atanmış sorulardan biri güncel soru setinde bulunamadı.", "eclub_izleme_kayitlari.soru_indeksleri", null);
    }

    return NextResponse.json({ sorular: secilenSorular }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/panel/api/sorular");
  }
}
