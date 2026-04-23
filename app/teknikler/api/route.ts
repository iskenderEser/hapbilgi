// app/teknikler/api/route.ts
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
    if (!["pm", "jr_pm", "kd_pm", "iu"].includes(rol)) return rolHatasi("Sadece PM ve IU teknik listesine erişebilir.");

    const { searchParams } = new URL(request.url);
    const firma_id = searchParams.get("firma_id");

    if (!firma_id) return validasyonHatasi("firma_id zorunludur.", ["firma_id"]);

    const { data: teknikler, error } = await adminSupabase
      .from("teknikler")
      .select("teknik_id, teknik_adi, firma_id, created_at")
      .eq("firma_id", firma_id)
      .order("teknik_adi", { ascending: true });

    if (error) return hataYaniti("Teknikler çekilemedi.", "teknikler tablosu SELECT", error);

    return NextResponse.json({ teknikler: teknikler ?? [] }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /teknikler/api");
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["pm", "jr_pm", "kd_pm"].includes(rol)) return rolHatasi("Sadece PM teknik ekleyebilir.");

    const body = await request.json();
    const { firma_id, teknik_adi } = body;

    if (!firma_id) return validasyonHatasi("firma_id zorunludur.", ["firma_id"]);
    if (!teknik_adi || teknik_adi.trim().length === 0) return validasyonHatasi("Teknik adı zorunludur.", ["teknik_adi"]);

    // Aynı firmada aynı isimde teknik var mı?
    const { data: mevcutTeknik } = await adminSupabase
      .from("teknikler")
      .select("teknik_id")
      .eq("firma_id", firma_id)
      .eq("teknik_adi", teknik_adi.trim())
      .maybeSingle();

    if (mevcutTeknik) return NextResponse.json({ mesaj: "Bu teknik zaten mevcut.", teknik: mevcutTeknik }, { status: 200 });

    const { data: yeniTeknik, error } = await adminSupabase
      .from("teknikler")
      .insert({ firma_id, teknik_adi: teknik_adi.trim() })
      .select("teknik_id, teknik_adi, firma_id")
      .single();

    if (error) return hataYaniti("Teknik eklenemedi.", "teknikler tablosu INSERT", error);

    return NextResponse.json({ mesaj: "Teknik eklendi.", teknik: yeniTeknik }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /teknikler/api");
  }
}