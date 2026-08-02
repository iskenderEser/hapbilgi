// app/analiz/api/bm/kapsam/route.ts
//
// BM rolü için analiz sayfasının "kapsam" endpoint'i.
// Filtre dropdown'larını dolduran veri.

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  hataYaniti,
  sunucuHatasi,
  yetkiHatasi,
  rolHatasi,
} from "@/lib/utils/hataIsle";
import { getBmKapsam } from "@/lib/analiz/bm/getBmAnalizData";
import { rolCozucu } from "@/lib/utils/rolCozucu";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const rol = await rolCozucu(adminSupabase, user.id);
    if (rol !== "bm") {
      return rolHatasi("Bu sayfa yalnızca BM rolü içindir.");
    }

    let kapsam;
    try {
      kapsam = await getBmKapsam(user.id);
    } catch (err) {
      return hataYaniti(
        "Kapsam verisi çekilirken hata oluştu.",
        "getBmKapsam",
        err instanceof Error ? { message: err.message } : { message: String(err) }
      );
    }

    return NextResponse.json({ kapsam }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /analiz/api/bm/kapsam");
  }
}