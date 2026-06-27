// app/analiz/api/tm/sorgu/route.ts
//
// TM rolü için analiz sayfasının "sorgu" endpoint'i.
// Tüketim metriklerini döndürür. (TM yapısal olarak yalnızca tüketim görür;
// üretim dallanması yok, kategori parametresi gerekmez.)
// Body: { degisken_idleri[], filtreler }
// Sonuc: { sonuclar: { [degisken_id]: number } }

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  hataYaniti,
  sunucuHatasi,
  yetkiHatasi,
  rolHatasi,
  validasyonHatasi,
} from "@/lib/utils/hataIsle";
import { getTmAnalizData, type TmFiltreleri } from "@/lib/analiz/tm/getTmAnalizData";

type Body = {
  degisken_idleri?: string[];
  filtreler?: TmFiltreleri;
};

export async function POST(request: NextRequest) {
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

    const body = (await request.json()) as Body;
    const { degisken_idleri, filtreler } = body;

    if (!Array.isArray(degisken_idleri) || degisken_idleri.length === 0) {
      return validasyonHatasi("degisken_idleri en az 1 elemanlı dizi olmalıdır.", ["degisken_idleri"]);
    }
    if (degisken_idleri.length > 3) {
      return validasyonHatasi("En fazla 3 değişken seçilebilir.", ["degisken_idleri"]);
    }

    const filt: TmFiltreleri = filtreler ?? {};

    let tuketim;
    try {
      tuketim = await getTmAnalizData(user.id, filt);
    } catch (err) {
      return hataYaniti(
        "Analiz verisi çekilirken hata oluştu.",
        "getTmAnalizData",
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
    return sunucuHatasi(err, "POST /analiz/api/tm/sorgu");
  }
}