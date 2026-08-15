// app/oneriler/api/yayinlar/route.ts
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { getYayindakiVideolar } from "@/lib/video/yayindakiVideolar";

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (rol !== "bm") return rolHatasi("Sadece bm erişebilir.");

    const yayinlar = (await getYayindakiVideolar(user.id, rol, adminSupabase))
      .filter((yayin) => yayin.hedef_roller.includes("utt"));

    return NextResponse.json({ videolar: yayinlar }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /oneriler/api/yayinlar");
  }
}
