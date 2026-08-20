// Eczanem müşteri izlemesi — CEVAPLA.
// Yalnız izlemeye atanmış sabit soru kümesi kabul edilir; cevap durumu ve toplam
// kazanım tek veritabanı işlemiyle ve yalnız bir kez yazılır.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { musteriKimligi } from "@/lib/eczanem/oturum";
import { cevapDogruMu, cevaplarAtananSorularlaEslesiyorMu, type Soru } from "@/lib/soru/kontrol";
import { olayIdGecerliMi } from "@/lib/izleme/baslat";
import { aktifGonderimUyeliginiDogrula } from "@/lib/eczanem/aktifUyelik";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const kimlik = await musteriKimligi(adminSupabase, user.id);
    if (!kimlik.ok) return rolHatasi(kimlik.hata ?? "Müşteri doğrulanamadı.");
    const musteriId = kimlik.musteriId!;

    const body = await request.json();
    const { izleme_id, cevaplar } = body;
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
    if (!izleme.tamamlandi_mi) return isKuraluHatasi("Önce videoyu tamamlayın.");
    if (izleme.cevaplandi_mi) return isKuraluHatasi("Bu videonun soruları zaten cevaplandı.");

    const atananIndeksler = izleme.soru_indeksleri as number[] | null;
    if (!Array.isArray(atananIndeksler) || !cevaplarAtananSorularlaEslesiyorMu(cevaplar, atananIndeksler)) {
      return validasyonHatasi("Cevaplar, izlemeye atanmış soru kümesiyle birebir eşleşmelidir.", ["cevaplar"]);
    }

    const { data: yayinDetay, error: ydError } = await adminSupabase
      .from("v_yayin_detay")
      .select("sorular")
      .eq("yayin_id", izleme.yayin_id)
      .single();
    if (ydError || !yayinDetay || !Array.isArray(yayinDetay.sorular)) {
      return hataYaniti("Yayın soru seti alınamadı.", "v_yayin_detay SELECT — Eczanem cevaplama", ydError, 404);
    }

    const sorular = yayinDetay.sorular as unknown as Soru[];
    const sonuclar = cevaplar.map((cevap) => {
      const soru = sorular[cevap.soru_index];
      if (!soru || !Array.isArray(soru.secenekler)
          || !soru.secenekler.some((secenek) => secenek.harf === cevap.verilen_cevap)) return null;
      const kontrol = cevapDogruMu(soru, cevap.verilen_cevap);
      return {
        soru_index: cevap.soru_index,
        dogru_mu: kontrol.dogru_mu,
        dogru_secenek: kontrol.dogru_secenek,
      };
    });
    if (sonuclar.some((sonuc) => sonuc === null)) {
      return validasyonHatasi("Cevaplardan biri güncel soru setiyle eşleşmiyor.", ["cevaplar"]);
    }

    const { data: kayitSatirlari, error: kayitError } = await adminSupabase.rpc("eczanem_cevaplari_kaydet", {
      p_izleme_id: izleme_id,
      p_musteri_id: musteriId,
      p_sonuclar: sonuclar.map((sonuc) => ({
        soru_index: sonuc!.soru_index,
        dogru_mu: sonuc!.dogru_mu,
      })),
    });
    if (kayitError?.code === "23505") return isKuraluHatasi("Bu videonun soruları zaten cevaplandı.");
    if (kayitError?.code === "22023") return validasyonHatasi(kayitError.message || "Cevap kümesi doğrulanamadı.", ["cevaplar"]);
    if (kayitError?.code === "P0001") return isKuraluHatasi(kayitError.message);
    if (kayitError) return hataYaniti("Cevaplar kaydedilemedi.", "eczanem_cevaplari_kaydet RPC", kayitError);

    return NextResponse.json({
      mesaj: "Cevaplar değerlendirildi.",
      kazanilan_puan: (kayitSatirlari?.[0] as { kazanilan_puan?: number } | undefined)?.kazanilan_puan ?? 0,
      sonuclar,
      puan_uyarisi: null,
    }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eczanem/api/izleme/cevapla");
  }
}
