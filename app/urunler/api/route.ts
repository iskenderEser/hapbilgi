// app/urunler/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["pm", "jr_pm", "kd_pm", "iu"].includes(rol)) return rolHatasi("Sadece PM ve IU ürün listesine erişebilir.");

    const { searchParams } = new URL(request.url);
    const firma_id = searchParams.get("firma_id");
    const takim_id = searchParams.get("takim_id");

    if (!firma_id) return validasyonHatasi("firma_id zorunludur.", ["firma_id"]);

    let query = adminSupabase
      .from("urunler")
      .select("urun_id, urun_adi, firma_id, takim_id, created_at")
      .eq("firma_id", firma_id)
      .order("urun_adi", { ascending: true });

    if (takim_id) {
      query = query.or(`takim_id.eq.${takim_id},takim_id.is.null`);
    }

    const { data: urunler, error } = await query;
    if (error) return hataYaniti("Ürünler çekilemedi.", "urunler tablosu SELECT", error);

    return NextResponse.json({ urunler: urunler ?? [] }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /urunler/api");
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["pm", "jr_pm", "kd_pm"].includes(rol)) return rolHatasi("Sadece PM ürün ekleyebilir.");

    const body = await request.json();
    const { firma_id, takim_id, urun_adi } = body;

    if (!firma_id) return validasyonHatasi("firma_id zorunludur.", ["firma_id"]);
    if (!urun_adi || urun_adi.trim().length === 0) return validasyonHatasi("Ürün adı zorunludur.", ["urun_adi"]);

    // Aynı firmada aynı isimde ürün var mı?
    const { data: mevcutUrun } = await adminSupabase
      .from("urunler")
      .select("urun_id")
      .eq("firma_id", firma_id)
      .eq("urun_adi", urun_adi.trim())
      .maybeSingle();

    if (mevcutUrun) return NextResponse.json({ mesaj: "Bu ürün zaten mevcut.", urun: mevcutUrun }, { status: 200 });

    const { data: yeniUrun, error } = await adminSupabase
      .from("urunler")
      .insert({ firma_id, takim_id: takim_id ?? null, urun_adi: urun_adi.trim() })
      .select("urun_id, urun_adi, firma_id, takim_id")
      .single();

    if (error) return hataYaniti("Ürün eklenemedi.", "urunler tablosu INSERT", error);

    return NextResponse.json({ mesaj: "Ürün eklendi.", urun: yeniUrun }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /urunler/api");
  }
}