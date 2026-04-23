// app/izle/api/favori/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["utt", "kd_utt"].includes(rol)) return rolHatasi("Sadece utt ve kd_utt favori ekleyebilir.");

    const body = await request.json();
    const { yayin_id } = body;
    if (!yayin_id) return validasyonHatasi("yayin_id zorunludur.", ["yayin_id"]);

    const { data: mevcut } = await adminSupabase
      .from("video_favoriler")
      .select("favori_id")
      .eq("kullanici_id", user.id)
      .eq("yayin_id", yayin_id)
      .single();

    if (mevcut) {
      const { error: deleteError } = await adminSupabase
        .from("video_favoriler")
        .delete()
        .eq("favori_id", mevcut.favori_id);

      if (deleteError) return hataYaniti("Favori kaldırılamadı.", "video_favoriler tablosu DELETE", deleteError);
      return NextResponse.json({ favori_mi: false }, { status: 200 });
    } else {
      const { error: insertError } = await adminSupabase
        .from("video_favoriler")
        .insert({ kullanici_id: user.id, yayin_id });

      if (insertError) return hataYaniti("Favori kaydedilemedi.", "video_favoriler tablosu INSERT", insertError);
      return NextResponse.json({ favori_mi: true }, { status: 200 });
    }

  } catch (err) {
    return sunucuHatasi(err, "POST /izle/api/favori");
  }
}