// lib/cc/puan/kazanim.ts
// CC ekosistemindeki tüm kazanım puanlarını cc_kazanilan_puanlar tablosuna yazan fonksiyonlar.
//
// Sorumluluk:
//   - cc_kazanilan_puanlar tablosuna INSERT atmak
//   - Her kazanım türü için ayrı fonksiyon
//   - İş kuralları (puan kazanma saatleri, ileri sarma kontrolü, vs) ÇAĞIRAN katmanda yapılır.
//     Bu dosya sadece kaydeder.
//
// Yan etki yok: bildirim göndermez, başka tablo güncellemez.
// Yan etkiler (bildirim, challenge_kayitlari.izlendi_mi update vs) çağıran katmanın sorumluluğunda.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { KayitSonuc } from "@/lib/cc/tipler";
import { ccGondermePuani, ccReferralPuani } from "@/lib/cc/sabitler";

// ─── 1. İZLEME PUANI ─────────────────────────────────────────────────────────

/**
 * Video tamamlandığında video puanını yazar.
 *
 * @param puan - Video puanı (yayın seviyesinde tanımlı, çağıran tarafça verilir)
 */
export async function izlemePuaniKaydet(
  supabase: SupabaseClient,
  params: {
    bm_id: string;
    yayin_id: string;
    izleme_id: string;
    puan: number;
  }
): Promise<KayitSonuc> {
  const { error } = await supabase.from("cc_kazanilan_puanlar").insert({
    bm_id: params.bm_id,
    yayin_id: params.yayin_id,
    izleme_id: params.izleme_id,
    puan_turu: "izleme",
    puan: params.puan,
  });

  if (error) {
    console.error("[lib/cc/puan/kazanim] izlemePuaniKaydet hatası:", error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

// ─── 2. CEVAP PUANI ──────────────────────────────────────────────────────────

/**
 * Doğru bir cevap için soru puanını yazar.
 * Her doğru cevap ayrı çağrı, ayrı satır olarak yazılır.
 *
 * @param puan - Soru puanı (soru seviyesinde tanımlı, çağıran tarafça verilir)
 */
export async function cevapPuaniKaydet(
  supabase: SupabaseClient,
  params: {
    bm_id: string;
    yayin_id: string;
    izleme_id: string;
    puan: number;
  }
): Promise<KayitSonuc> {
  const { error } = await supabase.from("cc_kazanilan_puanlar").insert({
    bm_id: params.bm_id,
    yayin_id: params.yayin_id,
    izleme_id: params.izleme_id,
    puan_turu: "cevaplama",
    puan: params.puan,
  });

  if (error) {
    console.error("[lib/cc/puan/kazanim] cevapPuaniKaydet hatası:", error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

// ─── 3. EXTRA PUANI ──────────────────────────────────────────────────────────

/**
 * Extra izleme tamamlandığında extra puanını yazar.
 * Tetikleyici: izleme_turu='extra' ile başlayan izleme tamamlanması.
 *
 * @param puan - Extra puan değeri (yayın seviyesinde tanımlı, çağıran tarafça verilir)
 */
export async function extraPuaniKaydet(
  supabase: SupabaseClient,
  params: {
    bm_id: string;
    yayin_id: string;
    izleme_id: string;
    puan: number;
  }
): Promise<KayitSonuc> {
  const { error } = await supabase.from("cc_kazanilan_puanlar").insert({
    bm_id: params.bm_id,
    yayin_id: params.yayin_id,
    izleme_id: params.izleme_id,
    puan_turu: "extra",
    puan: params.puan,
  });

  if (error) {
    console.error("[lib/cc/puan/kazanim] extraPuaniKaydet hatası:", error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

// ─── 4. CC GÖNDERME PUANI ────────────────────────────────────────────────────

/**
 * Challenge gönderildiğinde gönderene +cc_gonderme_puani (sistem_ayarlari) yazar.
 * Puan değeri sistem_ayarlari'ndan okunur (mevcut lib/cc/sabitler.ts'teki ccGondermePuani fonksiyonu).
 */
export async function ccGondermePuaniKaydet(
  supabase: SupabaseClient,
  params: {
    bm_id: string;
    yayin_id: string;
    challenge_id: string;
  }
): Promise<KayitSonuc> {
  const puanDegeri = await ccGondermePuani(supabase);

  const { error } = await supabase.from("cc_kazanilan_puanlar").insert({
    bm_id: params.bm_id,
    yayin_id: params.yayin_id,
    challenge_id: params.challenge_id,
    puan_turu: "cc_gonderme",
    puan: puanDegeri,
  });

  if (error) {
    console.error("[lib/cc/puan/kazanim] ccGondermePuaniKaydet hatası:", error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

// ─── 5. CC REFERRAL PUANI ────────────────────────────────────────────────────

/**
 * Gönderilen challenge alıcı tarafından TAMAMLANDIĞINDA (sorular cevaplandığında)
 * gönderene +cc_referral_puani (sistem_ayarlari) yazar.
 * Tetikleyici: lib/cc/soru/cevapIsle, izleme_turu='challenge' için.
 *
 * @param gonderen_bm_id - Challenge'ı gönderen BM (puanı alacak kişi)
 * @param izleme_id - Alıcının izlemesi (kayıt için referans)
 */
export async function ccReferralPuaniKaydet(
  supabase: SupabaseClient,
  params: {
    gonderen_bm_id: string;
    yayin_id: string;
    challenge_id: string;
    izleme_id: string;
  }
): Promise<KayitSonuc> {
  const puanDegeri = await ccReferralPuani(supabase);

  const { error } = await supabase.from("cc_kazanilan_puanlar").insert({
    bm_id: params.gonderen_bm_id,
    yayin_id: params.yayin_id,
    challenge_id: params.challenge_id,
    izleme_id: params.izleme_id,
    puan_turu: "cc_referral",
    puan: puanDegeri,
  });

  if (error) {
    console.error("[lib/cc/puan/kazanim] ccReferralPuaniKaydet hatası:", error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}