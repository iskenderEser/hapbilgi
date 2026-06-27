// app/analiz/api/uretici/kapsam/route.ts
//
// Üretici rolü için analiz sayfasının "kapsam" endpoint'i.
// Filtre dropdown'larını dolduran veri.
//
// GET: query param yok.
// Sonuc: { kapsam: { takim_bagi, takimlar, bolgeler, urunler, utt_listesi, egitim_turleri } }

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  hataYaniti,
  sunucuHatasi,
  yetkiHatasi,
  rolHatasi,
} from "@/lib/utils/hataIsle";
import { ANALIZ_URETICI_ROLLERI } from "@/lib/utils/roller";
import { getUreticiKapsam } from "@/lib/analiz/uretici/getUreticiAnalizData";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!ANALIZ_URETICI_ROLLERI.includes(rol)) {
      return rolHatasi("Bu sayfa yalnızca üretici roller içindir.");
    }

    let kapsam;
    try {
      kapsam = await getUreticiKapsam(user.id);
    } catch (err) {
      return hataYaniti(
        "Kapsam verisi çekilirken hata oluştu.",
        "getUreticiKapsam",
        err instanceof Error ? { message: err.message } : { message: String(err) }
      );
    }

    return NextResponse.json({ kapsam }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /analiz/api/uretici/kapsam");
  }
}