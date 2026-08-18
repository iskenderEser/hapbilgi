// app/izle/api/begeni/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { ECLUB_TUKETICI_ROLLERI, TUKETICI_ROLLER } from "@/lib/utils/roller";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    const rol = await rolCozucu(adminSupabase, user.id);
    const { data: eclubKisi } = await adminSupabase
      .from("eclub_kisiler")
      .select("kisi_id, rol")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    const eclubKisisiMi = !TUKETICI_ROLLER.includes(rol) && ECLUB_TUKETICI_ROLLERI.includes(eclubKisi?.rol ?? "");
    if (!TUKETICI_ROLLER.includes(rol) && !eclubKisisiMi) {
      return rolHatasi("Bu kullanıcı beğeni yapamaz.");
    }
    const tablo = eclubKisisiMi ? "eclub_video_begeniler" : "video_begeniler";
    const kimlikKolonu = eclubKisisiMi ? "kisi_id" : "kullanici_id";
    const kimlikId = eclubKisisiMi ? eclubKisi!.kisi_id : user.id;

    const body = await request.json();
    const { yayin_id } = body;
    if (!yayin_id) return validasyonHatasi("yayin_id zorunludur.", ["yayin_id"]);

    const { data: mevcut } = await adminSupabase
      .from(tablo)
      .select("begeni_id")
      .eq(kimlikKolonu, kimlikId)
      .eq("yayin_id", yayin_id)
      .single();

    if (mevcut) {
      const { error: deleteError } = await adminSupabase
        .from(tablo)
        .delete()
        .eq("begeni_id", mevcut.begeni_id);

      if (deleteError) return hataYaniti("Beğeni kaldırılamadı.", "video_begeniler tablosu DELETE", deleteError);
      return NextResponse.json({ begeni_mi: false }, { status: 200 });
    } else {
      const { error: insertError } = await adminSupabase
        .from(tablo)
        .insert({ [kimlikKolonu]: kimlikId, yayin_id });

      if (insertError) return hataYaniti("Beğeni kaydedilemedi.", "video_begeniler tablosu INSERT", insertError);
      return NextResponse.json({ begeni_mi: true }, { status: 200 });
    }

  } catch (err) {
    return sunucuHatasi(err, "POST /izle/api/begeni");
  }
}
