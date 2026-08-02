// app/analiz/api/yonetici/kapsam/route.ts
//
// Yönetici rolü için analiz sayfasının "kapsam" endpoint'i.
// Filtre dropdown'larını dolduran veriyi döner: takım, bölge, ürün, UTT, eğitim türleri.
//
// GET: query param yok.
// Sonuc: { kapsam: { takimlar, bolgeler, urunler, utt_listesi, egitim_turleri } }

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  hataYaniti,
  sunucuHatasi,
  yetkiHatasi,
  rolHatasi,
} from "@/lib/utils/hataIsle";
import { ANALIZ_YONETICI_ROLLERI } from "@/lib/utils/roller";
import { getYoneticiKapsam } from "@/lib/analiz/yonetici/getYoneticiAnalizData";
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
    if (!ANALIZ_YONETICI_ROLLERI.includes(rol)) {
      return rolHatasi("Bu sayfa yalnızca yönetici roller içindir.");
    }

    let kapsam;
    try {
      kapsam = await getYoneticiKapsam(user.id);
    } catch (err) {
      return hataYaniti(
        "Kapsam verisi çekilirken hata oluştu.",
        "getYoneticiKapsam",
        err instanceof Error ? { message: err.message } : { message: String(err) }
      );
    }

    return NextResponse.json({ kapsam }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /analiz/api/yonetici/kapsam");
  }
}