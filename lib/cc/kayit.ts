// lib/cc/kayit.ts
// Challenge Club kayıt orkestrasyonu.
//
// 3 fonksiyon:
//   1) challengeOlustur   — challenge_kayitlari INSERT + cc_gonderme puanı + bildirim
//   2) referralPuaniKaydet — alıcı izlediğinde gönderene cc_referral puanı + bildirim
//   3) challengeKaybiKaydet — 5 iş günü dolan challenge için kayıp + bildirim
//
// CC EKOSISTEMI: Puan kazanımları CC'nin kendi tablosuna (cc_kazanilan_puanlar)
// yazılır. UTT'in lib/puan/kayit.ts katmanı kullanılmaz.
//
// 5 İŞ GÜNÜ KAYBI burada (lib/cc/puan/kayip.ts değil) çünkü kayıp izleme
// oturumuna bağlı değil — challenge yaşam döngüsüne bağlı. İzleme oturumu hiç
// başlamadığı için kayıt-anı simetrisi kuralı dışında kalır. pg_cron job
// (challenge_kaybi_tara) bu fonksiyona paralel olarak doğrudan INSERT atar;
// route veya manuel test senaryolar için bu fonksiyon de tutulur.
//
// İlgili dokümantasyon: Karar Belgesi 3-5.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ChallengeOlusturParams,
  ReferralPuaniParams,
  ChallengeKayipParams,
  KayitSonuc,
} from "@/lib/cc/tipler";
import { ccReferralPuaniKaydet } from "@/lib/cc/puan/kazanim";
import { bildirimOlustur } from "@/lib/utils/bildirimOlustur";
import { ccReferralPuani, IS_GUNU_SURE } from "@/lib/cc/sabitler";
import { isGunuEkle } from "@/lib/zaman/kontrol";
import {
  challengeGeldiMesaji,
  challengeIzlendiMesaji,
  challengeSuresiDolduMesaji,
} from "@/lib/cc/bildirimMesajlari";

// ─── 1. CHALLENGE OLUŞTUR ────────────────────────────────────────────────────

/**
 * challenge_kayitlari'a INSERT, gönderene cc_gonderme puanı (cc_kazanilan_puanlar'a),
 * alıcıya bildirim.
 *
 * Challenge ve gönderme puanı cc_challenge_gonder RPC'sinde tek transaction
 * içinde yazılır. Bildirim bu işlemin ardından non-critical yan etki olarak oluşur.
 */
export async function challengeOlustur(
  supabase: SupabaseClient,
  params: ChallengeOlusturParams,
  meta: {
    gonderenAdi: string;     // bildirim mesajı için
    videoAdi: string;        // bildirim mesajı için (urun_adi veya teknik_adi)
  }
): Promise<KayitSonuc> {
  // 1. Tüm kuralları doğrula; challenge + puanı atomik yaz.
  const { data: satirlar, error: rpcError } = await supabase.rpc("cc_challenge_gonder", {
    p_gonderen_id: params.gonderen_id,
    p_alan_id: params.alan_id,
    p_yayin_id: params.yayin_id,
  });
  const challenge = (satirlar?.[0] ?? null) as { challenge_id: string } | null;
  if (rpcError || !challenge) {
    console.error("[lib/cc/kayit] cc_challenge_gonder hatası:", rpcError?.message);
    return {
      ok: false,
      error: rpcError?.message ?? "Challenge oluşturulamadı.",
      code: rpcError?.code,
    };
  }

  // 2. Alıcıya bildirim oluştur (non-critical)
  await bildirimOlustur({
    adminSupabase: supabase,
    alici_id: params.alan_id,
    gonderen_id: params.gonderen_id,
    kayit_turu: "challenge",
    kayit_id: challenge.challenge_id,
    mesaj: challengeGeldiMesaji(meta.gonderenAdi, meta.videoAdi),
  });

  return { ok: true };
}

// ─── 2. REFERRAL PUANI KAYDET ────────────────────────────────────────────────

/**
 * Alıcı BM gönderilen challenge'ı izleyip soruları cevapladığında gönderene
 * cc_referral puanı yazar (cc_kazanilan_puanlar'a). Gönderene bildirim atılır.
 *
 * Arayan kod (lib/cc/soru/cevapIsle) tüm cevapları işledikten sonra çağırır.
 * challenge_kayitlari.izlendi_mi=true güncellemesi çağıran katmanın sorumluluğu.
 */
export async function referralPuaniKaydet(
  supabase: SupabaseClient,
  params: ReferralPuaniParams,
  meta: {
    alanAdi: string;       // bildirim mesajı için
    challenge_id: string;  // bildirim kayit_id'si için
  }
): Promise<KayitSonuc> {
  // Tip kontrolü: izleme_id zorunlu (referral akışında her zaman var olmalı)
  if (!params.izleme_id) {
    return { ok: false, error: "izleme_id zorunludur (referral kaydı izleme oturumuna bağlanır)." };
  }

  // 1. Gönderene cc_referral puanı yaz (CC ekosistemi)
  const puanSonuc = await ccReferralPuaniKaydet(supabase, {
    gonderen_bm_id: params.gonderen_id,
    yayin_id: params.yayin_id,
    challenge_id: meta.challenge_id,
    izleme_id: params.izleme_id,
  });

  if (!puanSonuc.ok) {
    console.error("[lib/cc/kayit] referralPuaniKaydet puan hatası:", puanSonuc.error);
    return { ok: false, error: puanSonuc.error ?? "Referral puanı yazılamadı." };
  }

  // 2. Bildirim için puan değerini DB'den oku
  const puanDegeri = await ccReferralPuani(supabase);

  // 3. Gönderene bildirim (non-critical)
  await bildirimOlustur({
    adminSupabase: supabase,
    alici_id: params.gonderen_id,
    gonderen_id: null,
    kayit_turu: "challenge",
    kayit_id: meta.challenge_id,
    mesaj: challengeIzlendiMesaji(meta.alanAdi, puanDegeri),
  });

  return { ok: true };
}

// ─── 3. CHALLENGE KAYBI KAYDET ───────────────────────────────────────────────

/**
 * Alıcı BM 5 iş günü içinde izlemediğinde kayıp yazar.
 * pg_cron job (challenge_kaybi_tara) zaten içeride INSERT atıyor; bu fonksiyon
 * route veya test senaryolar için lib'de paralel kullanım sağlar.
 *
 * urun_id get_urun_from_yayin RPC'siyle çekilir (denormalizasyon için).
 *
 * @param meta - bildirim mesajı için video adı gerekli
 */
export async function challengeKaybiKaydet(
  supabase: SupabaseClient,
  params: ChallengeKayipParams,
  meta: {
    videoAdi: string; // bildirim mesajı için
  }
): Promise<KayitSonuc> {
  // 1. urun_id çek — BOŞ DÖNMESİ HATA DEĞİLDİR (05.08.2026).
  // Puan yayına aittir; ürün, yayının varsa taşıdığı etikettir. Ürünsüz içerik
  // (medikal, İK) meşrudur ve kayıp yazar; o kayıtlarda urun_id boş kalır.
  const { data: urunIdData, error: urunIdError } = await supabase.rpc(
    "get_urun_from_yayin",
    { p_yayin_id: params.yayin_id }
  );

  if (urunIdError) {
    console.error("[lib/cc/kayit] challengeKaybiKaydet urun_id hatası:", urunIdError.message);
  }

  const urun_id = (urunIdData as string | null) ?? null;

  // 2. challenge_kayip_kayitlari'a INSERT
  const { error: insertError } = await supabase
    .from("challenge_kayip_kayitlari")
    .insert({
      kullanici_id: params.kullanici_id,
      yayin_id: params.yayin_id,
      challenge_id: params.challenge_id,
      urun_id,
      kaybedilen_puan: params.kaybedilen_puan,
    });

  if (insertError) {
    // UNIQUE constraint çakışması (zaten kayıp yazılmış) — kabul et, başarı say
    const message = insertError.message ?? "";
    if (message.includes("duplicate key") || message.includes("unique constraint")) {
      return { ok: true };
    }
    console.error("[lib/cc/kayit] challengeKaybiKaydet INSERT hatası:", message);
    return { ok: false, error: message };
  }

  // 3. Alıcıya bildirim (non-critical)
  await bildirimOlustur({
    adminSupabase: supabase,
    alici_id: params.kullanici_id,
    gonderen_id: null,
    kayit_turu: "challenge",
    kayit_id: params.challenge_id,
    mesaj: challengeSuresiDolduMesaji(meta.videoAdi, params.kaybedilen_puan),
  });

  return { ok: true };
}
