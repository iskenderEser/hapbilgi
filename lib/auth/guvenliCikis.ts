"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

export function supabaseAuthCookieOnEki(supabaseUrl: string): string | null {
  try {
    const projeRef = new URL(supabaseUrl).hostname.split(".")[0];
    return projeRef ? `sb-${projeRef}-auth-token` : null;
  } catch {
    return null;
  }
}

function yerelSupabaseOturumunuTemizle(): void {
  if (typeof window === "undefined") return;
  const onEk = supabaseAuthCookieOnEki(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  if (!onEk) return;

  for (const parca of document.cookie.split(";")) {
    const ad = parca.split("=")[0]?.trim();
    if (!ad) continue;
    if (ad === onEk || ad.startsWith(`${onEk}.`) || ad === `${onEk}-code-verifier`) {
      document.cookie = `${ad}=; path=/; max-age=0; SameSite=Lax`;
    }
  }

  try {
    localStorage.removeItem(onEk);
    localStorage.removeItem(`${onEk}-code-verifier`);
  } catch {
    // Tarayıcı depolaması kapalıysa çerez temizliği yeterlidir.
  }
}

/** Uzak çıkış başarısız olsa bile tarayıcı oturumunu güvenli biçimde kapatır. */
export async function guvenliCikisYap(supabase: SupabaseClient): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut();
    if (!error) return;
  } catch {
    // Ağ kesintisinde Supabase fetch hatası kullanıcı arayüzüne taşınmaz.
  }

  supabase.auth.stopAutoRefresh();
  yerelSupabaseOturumunuTemizle();
}
