// app/analiz/api/degiskenler/route.ts
//
// Paylaşımlı değişken listesi endpoint'i (rol bağımsız).
// Pill listesini oluşturmak için tüm değişkenleri kategoriye göre döner.
//
// GET ?kategori=uretim|tuketim
// Sonuc: { degiskenler: Degisken[] }

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  hataYaniti,
  sunucuHatasi,
  yetkiHatasi,
  rolHatasi,
  validasyonHatasi,
} from "@/lib/utils/hataIsle";
import { analizRolKategorisi } from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const rol = await rolCozucu(adminSupabase, user.id);
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

    const tablo = kategoriParam === "uretim"
      ? "analiz_uretim_degiskenleri"
      : "analiz_tuketim_degiskenleri";
    let sorgu = adminSupabase.from(tablo).select("*").order("sira", { ascending: true });
    if (kategoriParam === "uretim") {
      sorgu = sorgu.neq("degisken_id", "ileri_sarma_izinli_video_sayisi");
    }
    const { data: degiskenler, error: degiskenHatasi } = await sorgu;
    if (degiskenHatasi) {
      return hataYaniti(
        "Değişken listesi çekilirken hata oluştu.",
        tablo,
        degiskenHatasi,
      );
    }

    return NextResponse.json({ degiskenler }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /analiz/api/degiskenler");
  }
}
