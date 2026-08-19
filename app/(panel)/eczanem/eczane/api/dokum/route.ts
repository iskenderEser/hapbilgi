// app/eczanem/eczane/api/dokum/route.ts
// Eczacı işlem dökümü (İP-§9.2): kendi eczanesinin ürün bazında toplam
// kutu + indirim TL'si — mutabakatın eczane tarafındaki karşılığı (İP-§10.1).
// İş mantığı lib/eczanem/dokum.ts; burada auth + rol + periyot.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi, yetkiHatasi, rolHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { ECLUB_TUKETICI_ROLLERI } from "@/lib/utils/roller";
import { tarihAraligi } from "@/lib/utils/tarihAraligi";
import { davetEdenEczanesi } from "@/lib/eczanem/davet";
import { eczaneDokumu } from "@/lib/eczanem/dokum";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!ECLUB_TUKETICI_ROLLERI.includes(rol)) return rolHatasi("Bu sayfaya yalnız eczacı/teknisyen erişebilir.");

    const eden = await davetEdenEczanesi(adminSupabase, user.id);
    if (!eden.ok) return isKuraluHatasi(eden.hata ?? "Eczane bağı bulunamadı.");

    const periyot = request.nextUrl.searchParams.get("periyot") || "bu_ay";
    const { baslangic, bitis } = tarihAraligi(periyot);

    const dokum = await eczaneDokumu(adminSupabase, eden.eczaneId!, baslangic, bitis);
    return NextResponse.json(dokum, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /eczanem/eczane/api/dokum");
  }
}
