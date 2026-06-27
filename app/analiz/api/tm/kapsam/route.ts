// app/analiz/api/tm/kapsam/route.ts
//
// TM rolü için analiz sayfasının "kapsam" endpoint'i.
// Filtre dropdown'larını dolduran veri.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  hataYaniti,
  sunucuHatasi,
  yetkiHatasi,
  rolHatasi,
} from "@/lib/utils/hataIsle";
import { getTmKapsam } from "@/lib/analiz/tm/getTmAnalizData";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (rol !== "tm") {
      return rolHatasi("Bu sayfa yalnızca TM rolü içindir.");
    }

    let kapsam;
    try {
      kapsam = await getTmKapsam(user.id);
    } catch (err) {
      return hataYaniti(
        "Kapsam verisi çekilirken hata oluştu.",
        "getTmKapsam",
        err instanceof Error ? { message: err.message } : { message: String(err) }
      );
    }

    return NextResponse.json({ kapsam }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /analiz/api/tm/kapsam");
  }
}