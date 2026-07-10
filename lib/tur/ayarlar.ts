// lib/tur/ayarlar.ts
// Tekrar gönderim (tur) modeli — sistem_ayarlari okuyucuları.
// Desen: lib/cc/sabitler.ts (DB değerleri sistem_ayarlari'ndan okunur, koda gömülmez).

import { SupabaseClient } from "@supabase/supabase-js";

/**
 * sistem_ayarlari.tekrar_periyot_secenekleri değerini okur (örn. [15, 30, 45, 60]).
 * Yayına alma route'u, üreticinin seçtiği periyodu bu listeye karşı doğrular.
 */
export async function tekrarPeriyotSecenekleri(
  adminSupabase: SupabaseClient
): Promise<number[]> {
  const { data, error } = await adminSupabase
    .from("sistem_ayarlari")
    .select("deger")
    .eq("anahtar", "tekrar_periyot_secenekleri")
    .single();

  if (error || !data) {
    throw new Error(
      `sistem_ayarlari'ndan tekrar_periyot_secenekleri okunamadı: ${error?.message ?? "kayıt yok"}`
    );
  }

  const secenekler = data.deger;
  if (!Array.isArray(secenekler) || secenekler.some((s) => typeof s !== "number")) {
    throw new Error("tekrar_periyot_secenekleri değeri sayı dizisi değil.");
  }

  return secenekler as number[];
}