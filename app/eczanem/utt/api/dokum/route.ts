// app/eczanem/utt/api/dokum/route.ts
// UTT mutabakat dökümü (İP-§9.2, §10.1): listesindeki eczanelerin eczane×ürün
// toplamları (kutu + indirim TL) — aylık firma-eczane mutabakatının sistem
// dayanağı. Müşteri bilgisi (son-4-hane dahil) bu uçtan AKMAZ.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { TUKETICI_ROLLER } from "@/lib/utils/roller";
import { tarihAraligi } from "@/lib/utils/tarihAraligi";
import { uttDokumu } from "@/lib/eczanem/dokum";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!TUKETICI_ROLLER.includes(rol)) return rolHatasi("Bu sayfaya yalnız UTT erişebilir.");

    const periyot = request.nextUrl.searchParams.get("periyot") || "bu_ay";
    const { baslangic, bitis } = tarihAraligi(periyot);

    const dokum = await uttDokumu(adminSupabase, user.id, baslangic, bitis);
    return NextResponse.json(dokum, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /eczanem/utt/api/dokum");
  }
}
