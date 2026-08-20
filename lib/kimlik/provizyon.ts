// Supabase Auth ile uygulama tabloları tek transaction paylaşamaz. Bu yardımcı
// işlemi açık bir saga olarak izler: önce işlem kaydı, sonra Auth, ardından
// uygulama RPC'si; hata halinde Auth telafisinin sonucu mutlaka kayda yazılır.

import type { SupabaseClient } from "@supabase/supabase-js";

export type ProvizyonHedefi = "eclub_kisi" | "eczanem_musteri";

export async function provizyonBaslat(
  adminSupabase: SupabaseClient,
  hedef: ProvizyonHedefi,
): Promise<{ ok: boolean; islemId?: string; hata?: unknown }> {
  const { data, error } = await adminSupabase
    .from("kimlik_provizyon_islemleri")
    .insert({ hedef, durum: "baslatildi" })
    .select("islem_id")
    .single();
  if (error || !data) return { ok: false, hata: error };
  return { ok: true, islemId: data.islem_id };
}

export async function provizyonDurumuYaz(
  adminSupabase: SupabaseClient,
  islemId: string,
  durum: "auth_olustu" | "tamamlandi" | "basarisiz" | "geri_alindi" | "mudahale_gerekli",
  alanlar: { authUserId?: string | null; hedefKayitId?: string | null; hata?: string | null } = {},
): Promise<{ ok: boolean; hata?: unknown }> {
  const { error } = await adminSupabase
    .from("kimlik_provizyon_islemleri")
    .update({
      durum,
      ...(alanlar.authUserId !== undefined ? { auth_user_id: alanlar.authUserId } : {}),
      ...(alanlar.hedefKayitId !== undefined ? { hedef_kayit_id: alanlar.hedefKayitId } : {}),
      ...(alanlar.hata !== undefined ? { hata: alanlar.hata } : {}),
      tamamlandi_at: ["tamamlandi", "basarisiz", "geri_alindi", "mudahale_gerekli"].includes(durum)
        ? new Date().toISOString()
        : null,
    })
    .eq("islem_id", islemId);
  return error ? { ok: false, hata: error } : { ok: true };
}

export async function authTelafisiYap(
  adminSupabase: SupabaseClient,
  islemId: string,
  authUserId: string,
  asilHata: unknown,
): Promise<{ geriAlindi: boolean; hata?: unknown }> {
  const asilMesaj = asilHata instanceof Error
    ? asilHata.message
    : String((asilHata as { message?: string } | null)?.message ?? asilHata ?? "Bilinmeyen hata");
  const { error: silmeHatasi } = await adminSupabase.auth.admin.deleteUser(authUserId);
  const durum = silmeHatasi ? "mudahale_gerekli" : "geri_alindi";
  const kayit = await provizyonDurumuYaz(adminSupabase, islemId, durum, {
    authUserId,
    hata: silmeHatasi ? `${asilMesaj} | Auth telafisi: ${silmeHatasi.message}` : asilMesaj,
  });
  if (!kayit.ok) {
    console.error("[kimlik/provizyon] Telafi sonucu kaydedilemedi:", kayit.hata);
  }
  return silmeHatasi ? { geriAlindi: false, hata: silmeHatasi } : { geriAlindi: true };
}
