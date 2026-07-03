import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";

const UTT_ROLLER = ["utt", "kd_utt"];

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    const { data, error } = await adminSupabase
      .from("eclub_takim_adlari")
      .select("takim_adi")
      .eq("utt_id", user.id)
      .maybeSingle();

    if (error) return hataYaniti("Takım adı okunamadı.", "eclub_takim_adlari SELECT", error);

    return NextResponse.json({ takim_adi: data?.takim_adi ?? null }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/ligi/api/takim-adi");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    const { data: ben, error: benError } = await adminSupabase
      .from("kullanicilar")
      .select("rol")
      .eq("kullanici_id", user.id)
      .single();
    if (benError || !ben) return hataYaniti("Kullanıcı bulunamadı.", "kullanicilar SELECT", benError, 404);
    if (!UTT_ROLLER.includes((ben.rol ?? "").toLowerCase())) return rolHatasi("Sadece UTT takım adı belirleyebilir.");

    const body = await request.json();
    const takimAdi = typeof body.takim_adi === "string" ? body.takim_adi.trim() : "";
    if (!takimAdi) return validasyonHatasi("takim_adi zorunludur.", ["takim_adi"]);
    if (takimAdi.length > 100) return validasyonHatasi("Takım adı en fazla 100 karakter olabilir.", ["takim_adi"]);

    const { error } = await adminSupabase
      .from("eclub_takim_adlari")
      .upsert({ utt_id: user.id, takim_adi: takimAdi, updated_at: new Date().toISOString() }, { onConflict: "utt_id" });

    if (error) return hataYaniti("Takım adı kaydedilemedi.", "eclub_takim_adlari UPSERT", error);

    return NextResponse.json({ mesaj: "Takım adı kaydedildi.", takim_adi: takimAdi }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "PUT /eclub/ligi/api/takim-adi");
  }
}