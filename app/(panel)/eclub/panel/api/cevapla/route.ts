// E-Club izleme — CEVAPLA.
// Yalnız izlemeye atanmış sabit soru kümesi kabul edilir. Doğru cevap puan kazandırır;
// yanlış cevap yalnız raporlanır (0 puan, 0 kayıp). Süresi geçmiş öneri cevaplanamaz.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ECLUB_TUKETICI_ROLLERI } from "@/lib/utils/roller";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { cevapDogruMu, type Soru } from "@/lib/soru/kontrol";
import { olayIdGecerliMi } from "@/lib/izleme/baslat";
import { cevaplarAtananSorularlaEslesiyorMu, eclubIzlemeHaklari } from "@/lib/eclub/izlemeKurali";

export async function POST(request: NextRequest) {
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
    const { izleme_id, cevaplar } = body;
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
    if (!izleme.tamamlandi_mi) return isKuraluHatasi("Cevaplar ancak video tamamlandıktan sonra gönderilebilir.");
    if (!izleme.soru_hakki_var_mi) {
      return isKuraluHatasi(`Bu izleme için soru hakkı bulunmuyor (${izleme.soru_hakki_nedeni ?? "uygun_degil"}).`);
    }

    const atananIndeksler = izleme.soru_indeksleri as number[] | null;
    if (!Array.isArray(atananIndeksler) || !cevaplarAtananSorularlaEslesiyorMu(cevaplar, atananIndeksler)) {
      return validasyonHatasi("Cevaplar, izlemeye atanmış soru kümesiyle birebir eşleşmelidir.", ["cevaplar"]);
    }

    const { data: oneri, error: oneriError } = await adminSupabase
      .from("eclub_oneri_kayitlari")
      .select("oneri_baslangic, oneri_bitis")
      .eq("oneri_id", izleme.oneri_id)
      .single();
    if (oneriError || !oneri) return hataYaniti("Öneri kaydı doğrulanamadı.", "eclub_oneri_kayitlari SELECT — cevaplama", oneriError, 404);
    if (!eclubIzlemeHaklari(oneri.oneri_baslangic, oneri.oneri_bitis).soruGoster) {
      return isKuraluHatasi("Süresi geçmiş öneride soru cevaplanamaz.");
    }

    const { data: yayinDetay, error: ydError } = await adminSupabase
      .from("v_yayin_detay")
      .select("sorular, soru_seti_durum_id")
      .eq("yayin_id", izleme.yayin_id)
      .single();
    if (ydError || !yayinDetay || !Array.isArray(yayinDetay.sorular)) {
      return hataYaniti("Yayın soru seti alınamadı.", "v_yayin_detay SELECT — E-Club cevaplama", ydError, 404);
    }

    const sorular = yayinDetay.sorular as unknown as Soru[];
    const soruPuanMap = new Map<number, number>();
    if (yayinDetay.soru_seti_durum_id) {
      const { data: soruPuanlari, error: puanError } = await adminSupabase
        .from("soru_seti_puanlari")
        .select("soru_index, soru_puani")
        .eq("soru_seti_durum_id", yayinDetay.soru_seti_durum_id);
      if (puanError) return hataYaniti("Soru puanları alınamadı.", "soru_seti_puanlari SELECT — E-Club cevaplama", puanError);
      for (const satir of soruPuanlari ?? []) {
        if (typeof satir.soru_index === "number" && typeof satir.soru_puani === "number") {
          soruPuanMap.set(satir.soru_index, satir.soru_puani);
        }
      }
    }

    const sonuclar = cevaplar.map((cevap) => {
      const soru = sorular[cevap.soru_index];
      if (!soru || !soru.secenekler.some((secenek) => secenek.harf === cevap.verilen_cevap)) return null;
      const kontrol = cevapDogruMu(soru, cevap.verilen_cevap);
      return {
        soru_index: cevap.soru_index,
        verilen_cevap: cevap.verilen_cevap,
        dogru_mu: kontrol.dogru_mu,
        dogru_cevap: kontrol.dogru_secenek,
        kazanilan_puan: kontrol.dogru_mu ? Math.max(0, soruPuanMap.get(cevap.soru_index) ?? 0) : 0,
      };
    });
    if (sonuclar.some((sonuc) => sonuc === null)) {
      return validasyonHatasi("Cevaplardan biri güncel soru setiyle eşleşmiyor.", ["cevaplar"]);
    }

    const rpcGirdisi = sonuclar.map((sonuc) => ({
      soru_index: sonuc!.soru_index,
      dogru_mu: sonuc!.dogru_mu,
      kazanilan_puan: sonuc!.kazanilan_puan,
    }));
    const { data: kayitSatirlari, error: kayitError } = await adminSupabase.rpc("eclub_cevaplari_kaydet", {
      p_izleme_id: izleme_id,
      p_kisi_id: kisi.kisi_id,
      p_sonuclar: rpcGirdisi,
    });
    if (kayitError?.code === "23505") return isKuraluHatasi("Bu izleme için sorular zaten cevaplandı.");
    if (kayitError) return hataYaniti("Cevaplar kaydedilemedi.", "eclub_cevaplari_kaydet RPC", kayitError);

    return NextResponse.json({
      mesaj: "Cevaplar kaydedildi.",
      sonuclar: sonuclar.map((sonuc) => ({
        soru_index: sonuc!.soru_index,
        verilen_cevap: sonuc!.verilen_cevap,
        dogru_mu: sonuc!.dogru_mu,
        dogru_cevap: sonuc!.dogru_cevap,
      })),
      kazanilan_puan: (kayitSatirlari?.[0] as { kazanilan_puan?: number } | undefined)?.kazanilan_puan ?? 0,
      puan_uyarisi: null,
      puanli: true,
    }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eclub/panel/api/cevapla");
  }
}
