// app/senaryolar/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["pm", "jr_pm", "kd_pm", "iu"].includes(rol)) return rolHatasi("Sadece PM ve IU senaryolara erişebilir.");

    const { searchParams } = new URL(request.url);
    const talep_id = searchParams.get("talep_id");

    let query = adminSupabase
      .from("senaryolar")
      .select("senaryo_id, talep_id, iu_id, senaryo_metni, created_at")
      .order("created_at", { ascending: false });

    if (talep_id) {
      query = query.eq("talep_id", talep_id);
    } else if (["pm", "jr_pm", "kd_pm"].includes(rol)) {
      // PM sadece kendi taleplerinin senaryolarını görür
      const { data: talepler, error: talepError } = await adminSupabase
        .from("talepler")
        .select("talep_id")
        .eq("pm_id", user.id);

      if (talepError) return hataYaniti("PM'in talepleri çekilemedi.", "talepler tablosu SELECT — pm_id filtresi", talepError);

      const talepIdler = (talepler ?? []).map((t: any) => t.talep_id);
      if (talepIdler.length === 0) return NextResponse.json({ senaryolar: [] }, { status: 200 });

      query = query.in("talep_id", talepIdler);
    }

    const { data: senaryolar, error } = await query;
    if (error) return hataYaniti("Senaryolar çekilemedi.", "senaryolar tablosu SELECT", error);

    return NextResponse.json({ senaryolar: senaryolar ?? [] }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /senaryolar/api");
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (rol !== "iu") return rolHatasi("Sadece IU senaryo oluşturabilir.");

    const body = await request.json();
    const { talep_id, senaryo_metni } = body;

    if (!talep_id) return validasyonHatasi("talep_id zorunludur.", ["talep_id"]);
    if (!senaryo_metni || senaryo_metni.trim() === "") return validasyonHatasi("Senaryo metni zorunludur.", ["senaryo_metni"]);

    // Talep var mı kontrol et
    const { data: talep, error: talepError } = await adminSupabase
      .from("talepler")
      .select("talep_id")
      .eq("talep_id", talep_id)
      .single();

    if (talepError || !talep) return hataYaniti("Talep bulunamadı.", "talepler tablosu SELECT — talep_id kontrolü", talepError, 404);

    const { data: yeniSenaryo, error } = await adminSupabase
      .from("senaryolar")
      .insert({
        talep_id,
        iu_id: user.id,
        senaryo_metni: senaryo_metni.trim(),
      })
      .select("senaryo_id, talep_id, senaryo_metni, created_at")
      .single();

    if (error) return hataYaniti("Senaryo oluşturulamadı.", "senaryolar tablosu INSERT", error);

    return NextResponse.json({ mesaj: "Senaryo oluşturuldu.", senaryo: yeniSenaryo }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /senaryolar/api");
  }
}