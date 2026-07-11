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

// UTT'nin takımını çözer (kullanici_id = auth id).
async function uttTakimi(
  adminSupabase: ReturnType<typeof createAdminClient>,
  authUserId: string
): Promise<{ ok: boolean; takimId?: string | null; hata?: string }> {
  const { data: kullanici, error } = await adminSupabase
    .from("kullanicilar")
    .select("kullanici_id, takim_id")
    .eq("kullanici_id", authUserId)
    .maybeSingle();
  if (error || !kullanici) return { ok: false, hata: "Kullanıcı kaydınız bulunamadı." };
  return { ok: true, takimId: kullanici.takim_id ?? null };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!TUKETICI_ROLLER.includes(rol)) return rolHatasi("Bu sayfaya yalnız UTT erişebilir.");

    const takim = await uttTakimi(adminSupabase, user.id);
    if (!takim.ok) return hataYaniti(takim.hata ?? "Takım bulunamadı.", "kullanicilar SELECT — takim_id", null, 404);

    const veri = await uttEczanemVerisi(adminSupabase, user.id, takim.takimId ?? null);
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
