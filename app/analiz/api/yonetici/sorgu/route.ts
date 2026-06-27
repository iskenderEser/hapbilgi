// app/analiz/api/yonetici/sorgu/route.ts
//
// Yönetici rolü için analiz sayfasının "sorgu" endpoint'i.
// Tek POST: filtre + seçilen pill'ler → metrik sonuçları.
//
// Body: { kategori, degisken_idleri[], filtreler }
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
import { ANALIZ_YONETICI_ROLLERI } from "@/lib/utils/roller";
import {
  getYoneticiAnalizData,
  type AnalizFiltreleri,
} from "@/lib/analiz/yonetici/getYoneticiAnalizData";

type Body = {
  kategori?: "uretim" | "tuketim";
  degisken_idleri?: string[];
  filtreler?: AnalizFiltreleri;
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
    if (!ANALIZ_YONETICI_ROLLERI.includes(rol)) {
      return rolHatasi("Bu sayfa yalnızca yönetici roller içindir.");
    }

    const body = (await request.json()) as Body;
    const { kategori, degisken_idleri, filtreler } = body;

    if (!kategori || (kategori !== "uretim" && kategori !== "tuketim")) {
      return validasyonHatasi("kategori 'uretim' veya 'tuketim' olmalıdır.", ["kategori"]);
    }
    if (!Array.isArray(degisken_idleri) || degisken_idleri.length === 0) {
      return validasyonHatasi("degisken_idleri en az 1 elemanlı dizi olmalıdır.", ["degisken_idleri"]);
    }
    if (degisken_idleri.length > 3) {
      return validasyonHatasi("En fazla 3 değişken seçilebilir.", ["degisken_idleri"]);
    }

    const filt: AnalizFiltreleri = filtreler ?? {};

    let analiz;
    try {
      analiz = await getYoneticiAnalizData(user.id, filt);
    } catch (err) {
      return hataYaniti(
        "Analiz verisi çekilirken hata oluştu.",
        "getYoneticiAnalizData",
        err instanceof Error ? { message: err.message } : { message: String(err) }
      );
    }

    const kaynak: Record<string, number> =
      kategori === "uretim"
        ? (analiz.uretim as unknown as Record<string, number>)
        : (analiz.tuketim as unknown as Record<string, number>);

    const sonuclar: Record<string, number> = {};
    for (const id of degisken_idleri) {
      sonuclar[id] = Number(kaynak[id] ?? 0);
    }

    return NextResponse.json({ sonuclar }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "POST /analiz/api/yonetici/sorgu");
  }
}