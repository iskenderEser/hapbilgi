// app/ana-sayfa/api/route.ts
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import { URETICI_ROLLER, YONETICI_ROLLER } from "@/lib/utils/roller";
import {
  getBmAnaSayfaVeri,
  getUttAnaSayfaVeri,
  getTmAnaSayfaVeri,
  getIuAnaSayfaVeri,
  getPmAnaSayfaVeri,
  getYoneticiAnaSayfaVeri,
} from "@/lib/utils/anaSayfaVeri";

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();

    let veri: any;

    if (rol === "bm") {
      veri = await getBmAnaSayfaVeri(user.id, adminSupabase);
    } else if (rol === "tm") {
      veri = await getTmAnaSayfaVeri(user.id, adminSupabase);
    } else if (["utt", "kd_utt"].includes(rol)) {
      veri = await getUttAnaSayfaVeri(user.id, adminSupabase);
    } else if (rol === "iu") {
      veri = await getIuAnaSayfaVeri(user.id, adminSupabase);
    } else if (URETICI_ROLLER.includes(rol)) {
      veri = await getPmAnaSayfaVeri(user.id, adminSupabase);
    } else if (YONETICI_ROLLER.includes(rol)) {
      veri = await getYoneticiAnaSayfaVeri(user.id, adminSupabase);
    } else {
      return rolHatasi("Bu role ait ana sayfa verisi tanımlanmamış.");
    }

    return NextResponse.json(veri, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /ana-sayfa/api");
  }
}