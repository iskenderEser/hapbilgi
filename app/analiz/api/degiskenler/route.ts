// app/analiz/api/degiskenler/route.ts
//
// Paylaşımlı değişken listesi endpoint'i (rol bağımsız).
// Pill listesini oluşturmak için tüm değişkenleri kategoriye göre döner.
//
// GET ?kategori=uretim|tuketim
// Sonuc: { degiskenler: Degisken[] }

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  hataYaniti,
  sunucuHatasi,
  yetkiHatasi,
  rolHatasi,
  validasyonHatasi,
} from "@/lib/utils/hataIsle";
import { analizRolKategorisi } from "@/lib/utils/roller";
import { getDegiskenler, type Kategori } from "@/lib/analiz/paylasilan/kombinasyonlar";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!analizRolKategorisi(rol)) {
      return rolHatasi("Analiz sayfasına erişim yetkiniz yok.");
    }

    const kategoriParam = request.nextUrl.searchParams.get("kategori");
    if (!kategoriParam || (kategoriParam !== "uretim" && kategoriParam !== "tuketim")) {
      return validasyonHatasi(
        "kategori query parametresi 'uretim' veya 'tuketim' olmalıdır.",
        ["kategori"]
      );
    }

    let degiskenler;
    try {
      degiskenler = await getDegiskenler(kategoriParam as Kategori);
    } catch (err) {
      return hataYaniti(
        "Değişken listesi çekilirken hata oluştu.",
        "getDegiskenler",
        err instanceof Error ? { message: err.message } : { message: String(err) }
      );
    }

    return NextResponse.json({ degiskenler }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /analiz/api/degiskenler");
  }
}