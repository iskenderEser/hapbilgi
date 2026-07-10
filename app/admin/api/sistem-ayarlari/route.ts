// app/admin/api/sistem-ayarlari/route.ts
//
// Admin — Sistem Ayarları (sistem_ayarlari tablosu, tek kaynak).
//   GET → tüm ayarlar (anahtar, deger, aciklama, updated_at)
//   PUT { anahtar, deger } → mevcut anahtarın değerini günceller
//
// Kurallar:
//   - Yalnızca admin (adminKontrol — kullanicilar.rol, user_metadata DEĞİL).
//   - PUT yalnızca MEVCUT anahtarı günceller; yeni anahtar eklemek migration işidir.
//   - deger jsonb: sayı ya da sayı dizisi kabul edilir (mevcut anahtarların tümü böyle).

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, validasyonHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import type { SupabaseClient } from "@supabase/supabase-js";

async function adminKontrol(supabase: SupabaseClient, adminSupabase: SupabaseClient): Promise<NextResponse | null> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return yetkiHatasi();
  const { data: kullanici, error } = await adminSupabase
    .from("kullanicilar")
    .select("rol")
    .eq("kullanici_id", user.id)
    .single();
  if (error || !kullanici) return hataYaniti("Kullanıcı sorgulanamadı.", "kullanicilar SELECT", error, 404);
  if ((kullanici.rol ?? "").toLowerCase() !== "admin") return rolHatasi("Bu işlem yalnız admin tarafından yapılabilir.");
  return null;
}

/** deger doğrulaması: pozitif sayı ya da pozitif sayılardan oluşan boş olmayan dizi. */
function degerGecerliMi(deger: unknown): boolean {
  if (typeof deger === "number") return Number.isFinite(deger) && deger > 0;
  if (Array.isArray(deger)) {
    return deger.length > 0 && deger.every((d) => typeof d === "number" && Number.isFinite(d) && d > 0);
  }
  return false;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const guard = await adminKontrol(supabase, adminSupabase);
    if (guard) return guard;

    const { data: ayarlar, error } = await adminSupabase
      .from("sistem_ayarlari")
      .select("anahtar, deger, aciklama, updated_at")
      .order("anahtar", { ascending: true });

    if (error) return hataYaniti("Ayarlar çekilemedi.", "sistem_ayarlari SELECT", error);

    return NextResponse.json({ ayarlar: ayarlar ?? [] }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /admin/api/sistem-ayarlari");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const guard = await adminKontrol(supabase, adminSupabase);
    if (guard) return guard;

    const body = await request.json();
    const { anahtar, deger } = body;

    if (!anahtar || typeof anahtar !== "string") return validasyonHatasi("anahtar zorunludur.", ["anahtar"]);
    if (!degerGecerliMi(deger)) {
      return validasyonHatasi("deger pozitif bir sayı ya da pozitif sayılardan oluşan bir dizi olmalıdır.", ["deger"]);
    }

    // Yalnızca mevcut anahtar güncellenir (yeni anahtar = migration işi).
    const { data: mevcut, error: mevcutError } = await adminSupabase
      .from("sistem_ayarlari")
      .select("anahtar")
      .eq("anahtar", anahtar)
      .maybeSingle();

    if (mevcutError) return hataYaniti("Ayar sorgulanamadı.", "sistem_ayarlari SELECT — anahtar", mevcutError);
    if (!mevcut) return validasyonHatasi(`Böyle bir ayar yok: ${anahtar}. Yeni anahtar eklemek migration işidir.`, ["anahtar"]);

    const { error: updateError } = await adminSupabase
      .from("sistem_ayarlari")
      .update({ deger, updated_at: new Date().toISOString() })
      .eq("anahtar", anahtar);

    if (updateError) return hataYaniti("Ayar güncellenemedi.", "sistem_ayarlari UPDATE — deger", updateError);

    return NextResponse.json({ mesaj: "Ayar güncellendi.", anahtar, deger }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "PUT /admin/api/sistem-ayarlari");
  }
}