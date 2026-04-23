// app/bildirimler/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";

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
      .order("created_at", { ascending: false });

    if (error) return hataYaniti("Bildirimler çekilemedi.", "bildirimler tablosu SELECT", error);

    // kayit_turu bazında sayılar
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