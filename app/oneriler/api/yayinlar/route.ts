// app/oneriler/api/yayinlar/route.ts
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["tm", "bm"].includes(rol)) return rolHatasi("Sadece tm ve bm erişebilir.");

    const { data: yayinlar, error: yayinError } = await adminSupabase
      .from("v_yayin_detay")
      .select("yayin_id, urun_adi, teknik_adi, video_url, thumbnail_url")
      .eq("durum", "Yayinda")
      .order("yayin_tarihi", { ascending: false });

    if (yayinError) return hataYaniti("Yayınlar çekilemedi.", "v_yayin_detay view SELECT — Yayinda filtresi", yayinError);

    return NextResponse.json({ videolar: yayinlar ?? [] }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /oneriler/api/yayinlar");
  }
}