// app/eclub/oneriler/api/yayinlar/route.ts
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { ECLUB_HEDEF_ROLLER, TUKETICI_ROLLER } from "@/lib/utils/roller";
import { getYayindakiVideolar } from "@/lib/video/yayindakiVideolar";

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!TUKETICI_ROLLER.includes(rol)) return rolHatasi("Bu sayfaya yalnız UTT/KD_UTT erişebilir.");

    // BM'nin Yayındaki Videolar ekranıyla aynı katalog sözleşmesi kullanılır;
    // E-Club yalnız dış müşteri hedefli yayınları gösterir.
    const yayinlar = await getYayindakiVideolar(user.id, rol, adminSupabase);
    const eclubYayinlari = yayinlar.filter((yayin) =>
      (ECLUB_HEDEF_ROLLER as readonly string[]).includes(yayin.hedef_rol)
    );

    return NextResponse.json({ videolar: eclubYayinlari }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/oneriler/api/yayinlar");
  }
}
