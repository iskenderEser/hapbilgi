// app/eczanem/utt/api/route.ts
// UTT Eczanem dağıtım ucu (İP-§5.1–5.3): GET ekran verisi (yayınlar +
// eczaneler + eşik + gönderim durumu), POST tek (yayın→eczane) gönderim.
// İş mantığı lib/eczanem/gonderim.ts'te; burada auth + rol + orkestrasyon.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi, hataYaniti } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { TUKETICI_ROLLER } from "@/lib/utils/roller";
import { uttEczanemVerisi, eczaneyeGonder } from "@/lib/eczanem/gonderim";
import { ECZANEM_KAPALI_MESAJI, uttEczanemErisimi } from "@/lib/eczanem/erisim";

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!TUKETICI_ROLLER.includes(rol)) return rolHatasi("Bu sayfaya yalnız UTT erişebilir.");

    const erisim = await uttEczanemErisimi(adminSupabase, user.id);
    if (!erisim.ok) return hataYaniti(erisim.hata ?? "Firma erişimi doğrulanamadı.", "Eczanem UTT firma kapısı", null);
    if (!erisim.acik) return rolHatasi(ECZANEM_KAPALI_MESAJI);

    const veri = await uttEczanemVerisi(adminSupabase, user.id, erisim.takimId ?? null);
    return NextResponse.json(veri, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /eczanem/utt/api");
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!TUKETICI_ROLLER.includes(rol)) return rolHatasi("Sadece UTT gönderim yapabilir.");
    const erisim = await uttEczanemErisimi(adminSupabase, user.id);
    if (!erisim.ok) return hataYaniti(erisim.hata ?? "Firma erişimi doğrulanamadı.", "Eczanem UTT firma kapısı", null);
    if (!erisim.acik) return rolHatasi(ECZANEM_KAPALI_MESAJI);

    const body = await request.json();
    const yayinId = body?.yayin_id;
    const eczaneId = body?.eczane_id;
    if (typeof yayinId !== "string" || typeof eczaneId !== "string" || !yayinId || !eczaneId) {
      return validasyonHatasi("yayin_id ve eczane_id zorunludur.", ["yayin_id", "eczane_id"]);
    }

    const sonuc = await eczaneyeGonder(adminSupabase, user.id, yayinId, eczaneId);
    if (!sonuc.ok) return isKuraluHatasi(sonuc.hata ?? "Gönderim başarısız.");

    return NextResponse.json({ ok: true, mesaj: "Video eczaneye gönderildi." }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eczanem/utt/api");
  }
}
