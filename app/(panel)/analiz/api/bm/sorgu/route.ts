// app/analiz/api/bm/sorgu/route.ts
//
// BM rolü için analiz sayfasının "sorgu" endpoint'i.
// Tüketim metriklerini döndürür. (BM yapısal olarak yalnızca tüketim görür;
// üretim dallanması yok, kategori parametresi gerekmez.)
// Body: { degisken_idleri[], filtreler }
// Sonuc: { sonuclar: { [degisken_id]: number } }

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  hataYaniti,
  sunucuHatasi,
  yetkiHatasi,
  rolHatasi,
  validasyonHatasi,
} from "@/lib/utils/hataIsle";
import { getBmAnalizData, type BmFiltreleri } from "@/lib/analiz/bm/getBmAnalizData";
import { rolCozucu } from "@/lib/utils/rolCozucu";

type Body = {
  degisken_idleri?: string[];
  filtreler?: BmFiltreleri;
};

export async function POST(request: NextRequest) {
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

    const body = (await request.json()) as Body;
    const { degisken_idleri, filtreler } = body;

    if (!Array.isArray(degisken_idleri) || degisken_idleri.length === 0) {
      return validasyonHatasi("degisken_idleri en az 1 elemanlı dizi olmalıdır.", ["degisken_idleri"]);
    }
    if (degisken_idleri.length > 3) {
      return validasyonHatasi("En fazla 3 değişken seçilebilir.", ["degisken_idleri"]);
    }

    const filt: BmFiltreleri = filtreler ?? {};

    let tuketim;
    try {
      tuketim = await getBmAnalizData(user.id, filt);
    } catch (err) {
      return hataYaniti(
        "Analiz verisi çekilirken hata oluştu.",
        "getBmAnalizData",
        err instanceof Error ? { message: err.message } : { message: String(err) }
      );
    }

    const kaynak = tuketim as unknown as Record<string, number>;
    const sonuclar: Record<string, number> = {};
    for (const id of degisken_idleri) {
      sonuclar[id] = Number(kaynak[id] ?? 0);
    }

    return NextResponse.json({ sonuclar }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "POST /analiz/api/bm/sorgu");
  }
}