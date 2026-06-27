// lib/cc/soru/cevapIsle.ts
// CC izleme sonrası verilen cevap listesini işler.
//
// Sorumluluk:
//   - Her cevap için doğru/yanlış değerlendirme yapar
//   - Doğru cevap → cc_kazanilan_puanlar'a puan yazar
//   - Yanlış cevap → cc_yanlis_cevap_kayitlari'na kayıp yazar
//   - İzleme türü 'challenge' ise: cc_referral puanı yazar, izlendi_mi=true UPDATE,
//     gönderene bildirim atar
//
// İleri sarılmış izlemede sorular gösterilmediği için cevap işleme yapılmaz, erken çıkış.

import type { SupabaseClient } from "@supabase/supabase-js";
import { cevapPuaniKaydet, ccReferralPuaniKaydet } from "@/lib/cc/puan/kazanim";
import { yanlisCevapKaybiKaydet } from "@/lib/cc/puan/kayip";
import { bildirimOlustur } from "@/lib/utils/bildirimOlustur";
import { challengeIzlendiMesaji } from "@/lib/cc/bildirimMesajlari";
import { ccReferralPuani } from "@/lib/cc/sabitler";

interface CevapGirisi {
  soru_index: number;
  verilen_cevap: string;
}

interface CevapSonucu {
  soru_index: number;
  verilen_cevap: string;
  dogru_cevap: string;
  dogru_mu: boolean;
  kazanilan_puan: number;
  kaybedilen_puan: number;
}

interface CevapIsleSonuc {
  ok: boolean;
  sonuclar: CevapSonucu[];
  toplam_kazanim: number;
  toplam_kayip: number;
  error?: string;
}

interface Secenek {
  harf: string;
  metin: string;
  dogru: boolean;
}

interface Soru {
  soru_metni: string;
  secenekler: Secenek[];
}

/**
 * Cevap listesini sırayla işler:
 *   1. İzleme kaydını çek
 *   2. İleri sarılmışsa erken çıkış
 *   3. Yayını çek (sorular + soru_seti_durum_id)
 *   4. Soru puanlarını çek (soru_index → soru_puani)
 *   5. Her cevap için doğru/yanlış değerlendir, kazanım veya kayıp yaz
 *   6. İzleme türü 'challenge' ise: referral puanı + izlendi_mi UPDATE + bildirim
 */
export async function cevaplariIsle(
  supabase: SupabaseClient,
  izleme_id: string,
  cevaplar: CevapGirisi[]
): Promise<CevapIsleSonuc> {
  // 1. İzleme kaydını çek
  const { data: izleme, error: izlemeError } = await supabase
    .from("cc_izleme_kayitlari")
    .select("bm_id, yayin_id, izleme_turu, challenge_id, ileri_sarildi_mi, tamamlandi_mi")
    .eq("izleme_id", izleme_id)
    .single();

  if (izlemeError || !izleme) {
    return {
      ok: false,
      sonuclar: [],
      toplam_kazanim: 0,
      toplam_kayip: 0,
      error: izlemeError?.message ?? "İzleme bulunamadı.",
    };
  }

  // 2. İleri sarılmışsa sorular gösterilmedi, cevap işleme yapılmaz
  if (izleme.ileri_sarildi_mi) {
    return {
      ok: true,
      sonuclar: [],
      toplam_kazanim: 0,
      toplam_kayip: 0,
    };
  }

  // 3. Yayını çek (sorular + soru_seti_durum_id)
  const { data: yayin, error: yayinError } = await supabase
    .from("v_yayin_detay")
    .select("sorular, soru_seti_durum_id, urun_adi")
    .eq("yayin_id", izleme.yayin_id)
    .single();

  if (yayinError || !yayin || !yayin.sorular) {
    return {
      ok: false,
      sonuclar: [],
      toplam_kazanim: 0,
      toplam_kayip: 0,
      error: yayinError?.message ?? "Yayın veya soruları bulunamadı.",
    };
  }

  const sorular = yayin.sorular as Soru[];

  // 4. Soru puanlarını çek (soru_index → soru_puani map)
  const { data: puanlar, error: puanError } = await supabase
    .from("soru_seti_puanlari")
    .select("soru_index, soru_puani")
    .eq("soru_seti_durum_id", yayin.soru_seti_durum_id);

  if (puanError) {
    return {
      ok: false,
      sonuclar: [],
      toplam_kazanim: 0,
      toplam_kayip: 0,
      error: puanError.message,
    };
  }

  const puanMap: Record<number, number> = {};
  for (const p of puanlar ?? []) {
    puanMap[p.soru_index] = p.soru_puani;
  }

  // 5. Her cevap için doğru/yanlış değerlendir
  const sonuclar: CevapSonucu[] = [];
  let toplam_kazanim = 0;
  let toplam_kayip = 0;

  for (const cevap of cevaplar) {
    const soru = sorular[cevap.soru_index];
    if (!soru) continue; // soru bulunamazsa atla

    const dogruSecenek = soru.secenekler.find((s) => s.dogru === true);
    const dogru_cevap = dogruSecenek?.harf ?? "";
    const soru_puani = puanMap[cevap.soru_index] ?? 0;

    const dogru_mu = cevap.verilen_cevap === dogru_cevap;

    if (dogru_mu) {
      // Doğru cevap → kazanım
      await cevapPuaniKaydet(supabase, {
        bm_id: izleme.bm_id,
        yayin_id: izleme.yayin_id,
        izleme_id,
        puan: soru_puani,
      });
      toplam_kazanim += soru_puani;

      sonuclar.push({
        soru_index: cevap.soru_index,
        verilen_cevap: cevap.verilen_cevap,
        dogru_cevap,
        dogru_mu: true,
        kazanilan_puan: soru_puani,
        kaybedilen_puan: 0,
      });
    } else {
      // Yanlış cevap → kayıp
      await yanlisCevapKaybiKaydet(supabase, {
        bm_id: izleme.bm_id,
        yayin_id: izleme.yayin_id,
        izleme_id,
        soru_index: cevap.soru_index,
        verilen_cevap: cevap.verilen_cevap,
        dogru_cevap,
        kaybedilen_puan: soru_puani,
      });
      toplam_kayip += soru_puani;

      sonuclar.push({
        soru_index: cevap.soru_index,
        verilen_cevap: cevap.verilen_cevap,
        dogru_cevap,
        dogru_mu: false,
        kazanilan_puan: 0,
        kaybedilen_puan: soru_puani,
      });
    }
  }

  // 6. İzleme türü 'challenge' ise gönderene referral akışı
  if (izleme.izleme_turu === "challenge" && izleme.challenge_id) {
    // 6a. Challenge'ı çek, gönderen bilgisi al
    const { data: challenge, error: challengeError } = await supabase
      .from("challenge_kayitlari")
      .select("gonderen_id, alan_id, izlendi_mi")
      .eq("challenge_id", izleme.challenge_id)
      .single();

    if (!challengeError && challenge && !challenge.izlendi_mi) {
      // 6b. Gönderene cc_referral puanı yaz
      await ccReferralPuaniKaydet(supabase, {
        gonderen_bm_id: challenge.gonderen_id,
        yayin_id: izleme.yayin_id,
        challenge_id: izleme.challenge_id,
        izleme_id,
      });

      // 6c. challenge_kayitlari.izlendi_mi = true UPDATE
      await supabase
        .from("challenge_kayitlari")
        .update({ izlendi_mi: true })
        .eq("challenge_id", izleme.challenge_id);

      // 6d. Alıcının adını al, bildirim mesajı için
      const { data: alanKullanici } = await supabase
        .from("kullanicilar")
        .select("ad, soyad")
        .eq("kullanici_id", challenge.alan_id)
        .single();

      const alanAdi = alanKullanici
        ? `${alanKullanici.ad} ${alanKullanici.soyad}`
        : "Alıcı BM";

      // 6e. Gönderene bildirim
      const referralPuanDegeri = await ccReferralPuani(supabase);
      await bildirimOlustur({
        adminSupabase: supabase,
        alici_id: challenge.gonderen_id,
        gonderen_id: null,
        kayit_turu: "challenge",
        kayit_id: izleme.challenge_id,
        mesaj: challengeIzlendiMesaji(alanAdi, referralPuanDegeri),
      });
    }
  }

  return {
    ok: true,
    sonuclar,
    toplam_kazanim,
    toplam_kayip,
  };
}