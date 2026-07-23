// app/yayindaki-videolar/api/route.ts
// "Yayındaki Videolar" sayfasının veri ucu. Yalnız YAYINDAKI_VIDEO_GORENLER
// (üretici + yönetici + tm/bm; iu ve tüketici roller hariç) erişebilir — bekçi
// proxy.ts'te de var, burada ikinci kez (savunma katmanı) uygulanır.
// Adım 2 (iskelet): şimdilik mevcut getAnaSayfaVideolari verisini döndürür;
// üreten/favori/beğeni alanları + klasör gruplaması sonraki adımlarda eklenir.

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import { YAYINDAKI_VIDEO_GORENLER } from "@/lib/utils/roller";
import { getAnaSayfaVideolari } from "@/lib/video/anaSayfaVideolari";
import { rolCozucu } from "@/lib/utils/rolCozucu";

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!YAYINDAKI_VIDEO_GORENLER.includes(rol)) {
      return rolHatasi("Bu sayfaya erişim yetkiniz yok.");
    }

    const videolar = await getAnaSayfaVideolari(user.id, rol, adminSupabase);
    return NextResponse.json({ videolar }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /yayindaki-videolar/api");
  }
}
