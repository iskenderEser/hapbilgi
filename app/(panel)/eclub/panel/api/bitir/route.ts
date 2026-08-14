// E-Club izleme — BİTİR.
// Tamamlama, izleme puanı, UTT GönderiPuanı ve soru hakkı tek DB işlemiyle yazılır.
// Süresi geçmiş öneri tamamlanır; puan ve soru hakkı doğurmaz.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ECLUB_TUKETICI_ROLLERI } from "@/lib/utils/roller";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { olayIdGecerliMi } from "@/lib/izleme/baslat";
import { eclubIzlemeHaklari, eclubSoruIndeksleri } from "@/lib/eclub/izlemeKurali";
import { gecerliTur } from "@/lib/tur/kayit";

const VARSAYILAN_SORU_SAYISI = 2;

export async function PUT(request: NextRequest) {
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

    const body = await request.json();
    const { izleme_id } = body;
    if (!izleme_id) return validasyonHatasi("izleme_id zorunludur.", ["izleme_id"]);
    if (!olayIdGecerliMi(izleme_id)) return validasyonHatasi("Geçersiz izleme kimliği gönderildi.", ["izleme_id"]);

    const { data: izleme, error: izlemeError } = await adminSupabase
      .from("eclub_izleme_kayitlari")
      .select("izleme_id, yayin_id, kisi_id, oneri_id")
      .eq("izleme_id", izleme_id)
      .single();

    if (izlemeError) return hataYaniti("İzleme sorgulanamadı.", "eclub_izleme_kayitlari SELECT", izlemeError, 404);
    const izlemeKontrol = veriKontrol(izleme, "eclub_izleme_kayitlari SELECT — izleme_id", "İzleme kaydı bulunamadı.");
    if (!izlemeKontrol.gecerli) return izlemeKontrol.yanit;
    if (izleme.kisi_id !== kisi.kisi_id) return rolHatasi("Bu izleme kaydına erişim yetkiniz yok.");
    if (!izleme.oneri_id) return hataYaniti("İzleme öneri kaydına bağlı değil.", "eclub_izleme_kayitlari.oneri_id", null);

    const { data: oneri, error: oneriError } = await adminSupabase
      .from("eclub_oneri_kayitlari")
      .select("oneri_baslangic, oneri_bitis")
      .eq("oneri_id", izleme.oneri_id)
      .single();
    if (oneriError || !oneri) return hataYaniti("Öneri kaydı doğrulanamadı.", "eclub_oneri_kayitlari SELECT — izleme tamamlama", oneriError, 404);

    const haklar = eclubIzlemeHaklari(oneri.oneri_baslangic, oneri.oneri_bitis);
    let soruIndeksleri: number[] = [];
    let turBaslangic = "2000-01-01T00:00:00Z";

    if (haklar.soruGoster) {
      const [{ data: yayinDetay, error: detayError }, turSonuc] = await Promise.all([
        adminSupabase
          .from("v_yayin_detay")
          .select("sorular, video_basi_soru_sayisi")
          .eq("yayin_id", izleme.yayin_id)
          .single(),
        gecerliTur(adminSupabase, izleme.yayin_id),
      ]);
      if (detayError || !yayinDetay) {
        return hataYaniti("Yayın soru bilgisi alınamadı.", "v_yayin_detay SELECT — E-Club izleme tamamlama", detayError, 404);
      }
      if (!turSonuc.ok) {
        console.error("[UYARI] E-Club geçerli tur çözülemedi; ömür boyu tekillik uygulanacak:", {
          yayin_id: izleme.yayin_id,
          hata: turSonuc.error,
        });
      }
      turBaslangic = turSonuc.tur?.baslangic_tarihi ?? turBaslangic;

      const sorular = Array.isArray(yayinDetay.sorular) ? yayinDetay.sorular : [];
      const soruSayisi = yayinDetay.video_basi_soru_sayisi ?? VARSAYILAN_SORU_SAYISI;
      if (soruSayisi > 0 && sorular.length >= soruSayisi) {
        soruIndeksleri = eclubSoruIndeksleri(sorular.length, soruSayisi, izleme_id);
      }
    }

    const { data: tamamlamaSatirlari, error: tamamlamaError } = await adminSupabase.rpc("eclub_izleme_tamamla", {
      p_izleme_id: izleme_id,
      p_kisi_id: kisi.kisi_id,
      p_tur_baslangic: turBaslangic,
      p_soru_indeksleri: soruIndeksleri,
    });
    if (tamamlamaError) return hataYaniti("İzleme tamamlanamadı.", "eclub_izleme_tamamla RPC", tamamlamaError);

    const tamamlama = tamamlamaSatirlari?.[0] as {
      yeni_tamamlandi: boolean;
      puan_kazanildi: boolean;
      izleme_puani: number;
      soru_gosterilecek: boolean;
      soru_hakki_nedeni: string;
    } | undefined;
    if (!tamamlama) return hataYaniti("İzleme tamamlandı ancak sonuç alınamadı.", "eclub_izleme_tamamla RPC — dönen veri", null);

    return NextResponse.json({
      mesaj: tamamlama.yeni_tamamlandi ? "İzleme tamamlandı." : "Tamamlanmış izleme açıldı.",
      puan_kazanildi: tamamlama.puan_kazanildi,
      izleme_puani: tamamlama.izleme_puani,
      puan_uyarisi: null,
      soru_gosterilecek: tamamlama.soru_gosterilecek,
      soru_hakki_nedeni: tamamlama.soru_hakki_nedeni,
    }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "PUT /eclub/panel/api/bitir");
  }
}
