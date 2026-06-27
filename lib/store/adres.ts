// lib/store/adres.ts
// Kullanıcı adresleri yönetim katmanı.
//
// Önemli kural: Bir kullanıcının en fazla 1 varsayılan adresi olabilir.
// DB tarafında partial UNIQUE index var (idx_store_adresler_varsayilan_tek),
// ama yine de lib katmanında "yeni varsayılan eklenirse eskileri false yap"
// orchestrasyonu yapılır (UNIQUE çakışmasını önlemek için).
//
// 5 fonksiyon: listele, ekle, guncelle, sil, varsayilanYap

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Adres, AdresInput, KayitSonuc } from "@/lib/store/tipler";

// ─── 1. LİSTELE ──────────────────────────────────────────────────────────────

/**
 * Kullanıcının tüm adreslerini döndürür. Varsayılan önce, sonra eklenme tarihine göre.
 */
export async function adresleriListele(
  supabase: SupabaseClient,
  kullaniciId: string
): Promise<Adres[]> {
  const { data, error } = await supabase
    .from("store_adresler")
    .select("*")
    .eq("kullanici_id", kullaniciId)
    .order("varsayilan_mi", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[lib/store/adres] adresleriListele hatası:", error.message);
    return [];
  }

  return (data ?? []) as Adres[];
}

// ─── 2. EKLE ─────────────────────────────────────────────────────────────────

/**
 * Yeni adres ekler.
 * Eğer varsayilan_mi=true ise önce mevcut tüm varsayılanları false yapar
 * (UNIQUE partial index çakışmasını önlemek için).
 */
export async function adresEkle(
  supabase: SupabaseClient,
  kullaniciId: string,
  input: AdresInput
): Promise<KayitSonuc> {
  // Varsayılan eklenmek isteniyorsa önce eskileri temizle
  if (input.varsayilan_mi) {
    const { error: temizleError } = await supabase
      .from("store_adresler")
      .update({ varsayilan_mi: false })
      .eq("kullanici_id", kullaniciId)
      .eq("varsayilan_mi", true);

    if (temizleError) {
      console.error("[lib/store/adres] varsayilan temizleme hatası:", temizleError.message);
      return { ok: false, error: "Mevcut varsayılan adres güncellenemedi." };
    }
  }

  // Adresi ekle
  const { error: insertError } = await supabase
    .from("store_adresler")
    .insert({
      kullanici_id: kullaniciId,
      baslik: input.baslik,
      alici_adi: input.alici_adi,
      telefon: input.telefon,
      il: input.il,
      ilce: input.ilce,
      adres_detay: input.adres_detay,
      posta_kodu: input.posta_kodu ?? null,
      varsayilan_mi: input.varsayilan_mi ?? false,
    });

  if (insertError) {
    console.error("[lib/store/adres] adresEkle INSERT hatası:", insertError.message);
    return { ok: false, error: insertError.message };
  }

  return { ok: true };
}

// ─── 3. GÜNCELLE ─────────────────────────────────────────────────────────────

/**
 * Mevcut adresi günceller. Tüm alanlar opsiyonel.
 * Varsayılan değişiyorsa öncekileri false yapar.
 */
export async function adresGuncelle(
  supabase: SupabaseClient,
  adresId: string,
  kullaniciId: string,
  input: Partial<AdresInput>
): Promise<KayitSonuc> {
  // Sahiplik kontrolü
  const { data: adres, error: sahipError } = await supabase
    .from("store_adresler")
    .select("kullanici_id")
    .eq("adres_id", adresId)
    .single();

  if (sahipError || !adres) {
    return { ok: false, error: "Adres bulunamadı." };
  }
  if (adres.kullanici_id !== kullaniciId) {
    return { ok: false, error: "Bu adresi güncelleme yetkiniz yok." };
  }

  // Varsayılan yapılıyorsa önce eskileri temizle
  if (input.varsayilan_mi === true) {
    const { error: temizleError } = await supabase
      .from("store_adresler")
      .update({ varsayilan_mi: false })
      .eq("kullanici_id", kullaniciId)
      .eq("varsayilan_mi", true)
      .neq("adres_id", adresId);

    if (temizleError) {
      console.error("[lib/store/adres] varsayilan temizleme hatası:", temizleError.message);
      return { ok: false, error: "Mevcut varsayılan adres güncellenemedi." };
    }
  }

  // Güncelle
  const guncellenecek: Partial<AdresInput> = {};
  if (input.baslik !== undefined) guncellenecek.baslik = input.baslik;
  if (input.alici_adi !== undefined) guncellenecek.alici_adi = input.alici_adi;
  if (input.telefon !== undefined) guncellenecek.telefon = input.telefon;
  if (input.il !== undefined) guncellenecek.il = input.il;
  if (input.ilce !== undefined) guncellenecek.ilce = input.ilce;
  if (input.adres_detay !== undefined) guncellenecek.adres_detay = input.adres_detay;
  if (input.posta_kodu !== undefined) guncellenecek.posta_kodu = input.posta_kodu;
  if (input.varsayilan_mi !== undefined) guncellenecek.varsayilan_mi = input.varsayilan_mi;

  const { error: updateError } = await supabase
    .from("store_adresler")
    .update(guncellenecek)
    .eq("adres_id", adresId);

  if (updateError) {
    console.error("[lib/store/adres] adresGuncelle UPDATE hatası:", updateError.message);
    return { ok: false, error: updateError.message };
  }

  return { ok: true };
}

// ─── 4. SİL ──────────────────────────────────────────────────────────────────

/**
 * Adres siler. Sahiplik kontrolü yapılır.
 * Eğer adres aktif siparişlerde kullanılmışsa, sipariş kaydındaki adres_id NULL'a
 * çevrilir (ON DELETE SET NULL), adres_snapshot zaten dondurulmuş.
 */
export async function adresSil(
  supabase: SupabaseClient,
  adresId: string,
  kullaniciId: string
): Promise<KayitSonuc> {
  // Sahiplik kontrolü
  const { data: adres, error: sahipError } = await supabase
    .from("store_adresler")
    .select("kullanici_id")
    .eq("adres_id", adresId)
    .single();

  if (sahipError || !adres) {
    return { ok: false, error: "Adres bulunamadı." };
  }
  if (adres.kullanici_id !== kullaniciId) {
    return { ok: false, error: "Bu adresi silme yetkiniz yok." };
  }

  const { error: deleteError } = await supabase
    .from("store_adresler")
    .delete()
    .eq("adres_id", adresId);

  if (deleteError) {
    console.error("[lib/store/adres] adresSil DELETE hatası:", deleteError.message);
    return { ok: false, error: deleteError.message };
  }

  return { ok: true };
}

// ─── 5. VARSAYILAN YAP ───────────────────────────────────────────────────────

/**
 * Belirli bir adresi varsayılan yapar. Önce eskileri false yapar.
 * Sahiplik kontrolü yapılır.
 */
export async function varsayilanYap(
  supabase: SupabaseClient,
  adresId: string,
  kullaniciId: string
): Promise<KayitSonuc> {
  // Sahiplik kontrolü
  const { data: adres, error: sahipError } = await supabase
    .from("store_adresler")
    .select("kullanici_id")
    .eq("adres_id", adresId)
    .single();

  if (sahipError || !adres) {
    return { ok: false, error: "Adres bulunamadı." };
  }
  if (adres.kullanici_id !== kullaniciId) {
    return { ok: false, error: "Bu adresi güncelleme yetkiniz yok." };
  }

  // Önce mevcut varsayılanları temizle
  const { error: temizleError } = await supabase
    .from("store_adresler")
    .update({ varsayilan_mi: false })
    .eq("kullanici_id", kullaniciId)
    .eq("varsayilan_mi", true);

  if (temizleError) {
    console.error("[lib/store/adres] varsayilan temizleme hatası:", temizleError.message);
    return { ok: false, error: "Mevcut varsayılan adres güncellenemedi." };
  }

  // Yeni varsayılanı işaretle
  const { error: updateError } = await supabase
    .from("store_adresler")
    .update({ varsayilan_mi: true })
    .eq("adres_id", adresId);

  if (updateError) {
    console.error("[lib/store/adres] varsayilanYap UPDATE hatası:", updateError.message);
    return { ok: false, error: updateError.message };
  }

  return { ok: true };
}