// app/challenge-club/izle/api/cevap/route.ts
// CC izleme sonrası verilen cevapları işler.
// İş mantığı tamamen lib/cc/soru/cevapIsle'ye delege edilir (ince orchestration).

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, isKuraluHatasi, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { cevapDogruMu, cevaplarAtananSorularlaEslesiyorMu, type Soru } from "@/lib/soru/kontrol";
import { bildirimOlustur } from "@/lib/utils/bildirimOlustur";
import { challengeIzlendiMesaji } from "@/lib/cclub/bildirimMesajlari";

interface CevapGirisi {
  soru_index: number;
  verilen_cevap: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Auth kontrolü
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    // 2. Rol kontrolü — sadece BM
    const rol = await rolCozucu(adminSupabase, user.id);
    if (rol !== "bm") {
      return rolHatasi("Sadece BM rolü Challenge Club cevaplarını gönderebilir.");
    }

    // 3. Body parametreleri
    const body = await request.json();
    const { izleme_id, cevaplar } = body;

    if (!izleme_id) {
      return validasyonHatasi("izleme_id zorunludur.", ["izleme_id"]);
    }
    if (!Array.isArray(cevaplar) || cevaplar.length === 0) {
      return validasyonHatasi(
        "cevaplar boş olmayan bir dizi olmalıdır.",
        ["cevaplar"]
      );
    }

    // 4. İzleme, sahiplik ve sabit soru kümesi kontrolü
    const { data: izleme, error: izlemeError } = await adminSupabase
      .from("cc_izleme_kayitlari")
      .select("izleme_id, bm_id, yayin_id, challenge_id, tamamlandi_mi, ileri_sarildi_mi, soru_indeksleri, cevaplandi_mi")
      .eq("izleme_id", izleme_id)
      .single();
    if (izlemeError || !izleme) return hataYaniti("İzleme kaydı bulunamadı.", "cc_izleme_kayitlari SELECT — CC cevap", izlemeError, 404);
    if (izleme.bm_id !== user.id) {
      return rolHatasi("Bu izleme size ait değil.");
    }
    if (!izleme.tamamlandi_mi) return isKuraluHatasi("Cevaplar ancak video tamamlandıktan sonra gönderilebilir.");
    if (izleme.ileri_sarildi_mi) return isKuraluHatasi("İleri sarılmış izlemede cevap gönderilemez.");
    if (izleme.cevaplandi_mi) return isKuraluHatasi("Bu izleme için sorular zaten cevaplandı.");

    const soruIndeksleri = izleme.soru_indeksleri as number[] | null;
    if (!Array.isArray(soruIndeksleri)
        || !cevaplarAtananSorularlaEslesiyorMu(cevaplar, soruIndeksleri)) {
      return validasyonHatasi("Cevaplar, izlemeye atanmış soru kümesiyle birebir eşleşmelidir.", ["cevaplar"]);
    }

    const { data: yayin, error: yayinError } = await adminSupabase
      .from("v_yayin_detay")
      .select("sorular, soru_seti_durum_id")
      .eq("yayin_id", izleme.yayin_id)
      .single();
    if (yayinError || !yayin || !Array.isArray(yayin.sorular)) {
      return hataYaniti("Yayın soru seti alınamadı.", "v_yayin_detay SELECT — CC cevap", yayinError, 404);
    }

    const puanMap = new Map<number, number>();
    const { data: puanlar, error: puanError } = await adminSupabase
      .from("soru_seti_puanlari")
      .select("soru_index, soru_puani")
      .eq("soru_seti_durum_id", yayin.soru_seti_durum_id);
    if (puanError) return hataYaniti("Soru puanları alınamadı.", "soru_seti_puanlari SELECT — CC cevap", puanError);
    for (const satir of puanlar ?? []) puanMap.set(satir.soru_index, Math.max(0, satir.soru_puani ?? 0));

    const sorular = yayin.sorular as unknown as Soru[];
    const sonuclar = (cevaplar as CevapGirisi[]).map((cevap) => {
      const soru = sorular[cevap.soru_index];
      if (!soru || !soru.secenekler.some((secenek) => secenek.harf === cevap.verilen_cevap)) return null;
      const kontrol = cevapDogruMu(soru, cevap.verilen_cevap);
      const puan = puanMap.get(cevap.soru_index) ?? 0;
      return {
        soru_index: cevap.soru_index,
        verilen_cevap: cevap.verilen_cevap,
        dogru_cevap: kontrol.dogru_secenek ?? "",
        dogru_mu: kontrol.dogru_mu,
        kazanilan_puan: kontrol.dogru_mu ? puan : 0,
        kaybedilen_puan: kontrol.dogru_mu ? 0 : puan,
      };
    });
    if (sonuclar.some((sonuc) => sonuc === null)) {
      return validasyonHatasi("Cevaplardan biri güncel soru setiyle eşleşmiyor.", ["cevaplar"]);
    }

    // Cevap puanı/kaybı ile challenge tamamlama/referral tek DB işlemidir.
    const { data: kayitSatirlari, error: kayitError } = await adminSupabase.rpc("cc_cevaplari_kaydet", {
      p_izleme_id: izleme_id,
      p_bm_id: user.id,
      p_cevaplar: cevaplar,
    });
    if (kayitError?.code === "23505") return isKuraluHatasi("Bu izleme için sorular zaten cevaplandı.");
    if (kayitError?.code === "P0001" || kayitError?.code === "22023") return isKuraluHatasi(kayitError.message);
    if (kayitError) return hataYaniti("Cevaplar kaydedilemedi.", "cc_cevaplari_kaydet RPC", kayitError);

    const kayit = (kayitSatirlari?.[0] ?? null) as {
      toplam_kazanim: number;
      toplam_kayip: number;
      referral_yazildi: boolean;
      referral_gonderen_id: string | null;
      referral_puani: number;
    } | null;
    if (!kayit) return hataYaniti("Cevaplar kaydedildi ancak sonuç alınamadı.", "cc_cevaplari_kaydet RPC", null);

    if (kayit.referral_yazildi && kayit.referral_gonderen_id) {
      const { data: alan } = await adminSupabase
        .from("kullanicilar")
        .select("ad, soyad")
        .eq("kullanici_id", user.id)
        .maybeSingle();
      await bildirimOlustur({
        adminSupabase,
        alici_id: kayit.referral_gonderen_id,
        gonderen_id: null,
        kayit_turu: "challenge",
        kayit_id: izleme.challenge_id ?? izleme_id,
        mesaj: challengeIzlendiMesaji(
          alan ? `${alan.ad} ${alan.soyad}`.trim() : "Alıcı BM",
          kayit.referral_puani
        ),
      });
    }

    return NextResponse.json(
      {
        mesaj: "Cevaplar işlendi.",
        sonuclar,
        toplam_kazanim: kayit.toplam_kazanim,
        toplam_kayip: kayit.toplam_kayip,
        net: kayit.toplam_kazanim - kayit.toplam_kayip,
      },
      { status: 200 }
    );
  } catch (err) {
    return sunucuHatasi(err, "POST /challenge-club/izle/api/cevap");
  }
}
