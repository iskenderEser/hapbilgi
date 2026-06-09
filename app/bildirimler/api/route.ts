// app/bildirimler/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";

const GECERLI_KAYIT_TURLERI = ["talep", "senaryo", "video", "soru_seti", "yayin", "oneri"];

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const { data: bildirimler, error } = await adminSupabase
      .from("bildirimler")
      .select("bildirim_id, kayit_turu, kayit_id, mesaj, goruldu_mu, created_at")
      .eq("alici_id", user.id)
      .eq("goruldu_mu", false)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return hataYaniti("Bildirimler çekilemedi.", "bildirimler tablosu SELECT", error);

    const sayilar: Record<string, number> = {};
    for (const b of bildirimler ?? []) {
      sayilar[b.kayit_turu] = (sayilar[b.kayit_turu] ?? 0) + 1;
    }

    return NextResponse.json({
      bildirimler: bildirimler ?? [],
      sayilar,
      toplam: bildirimler?.length ?? 0,
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /bildirimler/api");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const body = await request.json();
    const { kayit_turu } = body;

    if (kayit_turu !== undefined) {
      if (typeof kayit_turu !== "string") return validasyonHatasi("kayit_turu metin tipinde olmalıdır.", ["kayit_turu"]);
      if (!GECERLI_KAYIT_TURLERI.includes(kayit_turu)) return validasyonHatasi(`Geçersiz kayit_turu. Geçerli değerler: ${GECERLI_KAYIT_TURLERI.join(", ")}`, ["kayit_turu"]);
    }

    let query = adminSupabase
      .from("bildirimler")
      .update({ goruldu_mu: true })
      .eq("alici_id", user.id)
      .eq("goruldu_mu", false);

    if (kayit_turu) {
      query = query.eq("kayit_turu", kayit_turu);
    }

    const { error } = await query;
    if (error) return hataYaniti("Bildirimler güncellenemedi.", "bildirimler tablosu UPDATE", error);

    return NextResponse.json({ mesaj: "Bildirimler okundu olarak işaretlendi." }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "PUT /bildirimler/api");
  }
}