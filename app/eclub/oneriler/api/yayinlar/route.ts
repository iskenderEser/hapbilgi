// app/eclub/oneriler/api/yayinlar/route.ts
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";

const ECLUB_UTT_ROLLERI = ["utt", "kd_utt"];
const ECLUB_HEDEF_ROLLER = ["eczaci", "eczane_teknisyeni"];

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!ECLUB_UTT_ROLLERI.includes(rol)) return rolHatasi("Bu sayfaya yalnız UTT/KD_UTT erişebilir.");

    const { data: yayinlar, error: yayinError } = await adminSupabase
      .from("v_yayin_detay")
      .select("yayin_id, urun_adi, teknik_adi, hedef_rol, video_url, thumbnail_url")
      .eq("durum", "yayinda")
      .in("hedef_rol", ECLUB_HEDEF_ROLLER)
      .order("yayin_tarihi", { ascending: false });

    if (yayinError) return hataYaniti("Yayınlar çekilemedi.", "v_yayin_detay view SELECT — eclub hedef_rol filtresi", yayinError);

    return NextResponse.json({ videolar: yayinlar ?? [] }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/oneriler/api/yayinlar");
  }
}