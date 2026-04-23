// app/izle/api/begeni/route.ts
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
    if (!["utt", "kd_utt"].includes(rol)) return rolHatasi("Sadece utt ve kd_utt beğeni yapabilir.");

    const body = await request.json();
    const { yayin_id } = body;
    if (!yayin_id) return validasyonHatasi("yayin_id zorunludur.", ["yayin_id"]);

    const { data: mevcut } = await adminSupabase
      .from("video_begeniler")
      .select("begeni_id")
      .eq("kullanici_id", user.id)
      .eq("yayin_id", yayin_id)
      .single();

    if (mevcut) {
      const { error: deleteError } = await adminSupabase
        .from("video_begeniler")
        .delete()
        .eq("begeni_id", mevcut.begeni_id);

      if (deleteError) return hataYaniti("Beğeni kaldırılamadı.", "video_begeniler tablosu DELETE", deleteError);
      return NextResponse.json({ begeni_mi: false }, { status: 200 });
    } else {
      const { error: insertError } = await adminSupabase
        .from("video_begeniler")
        .insert({ kullanici_id: user.id, yayin_id });

      if (insertError) return hataYaniti("Beğeni kaydedilemedi.", "video_begeniler tablosu INSERT", insertError);
      return NextResponse.json({ begeni_mi: true }, { status: 200 });
    }

  } catch (err) {
    return sunucuHatasi(err, "POST /izle/api/begeni");
  }
}