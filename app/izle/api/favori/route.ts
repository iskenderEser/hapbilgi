// app/izle/api/favori/route.ts
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
    // BM, Challenge Club kartlarında favori ekleyebilir; UTT/KD_UTT ile aynı iç
    // izleyici tablosuna (video_favoriler) yazar.
    const iciIzleyici = TUKETICI_ROLLER.includes(rol) || rol === "bm";
    const eclubKisisiMi = !iciIzleyici && ECLUB_TUKETICI_ROLLERI.includes(eclubKisi?.rol ?? "");
    if (!iciIzleyici && !eclubKisisiMi) {
      return rolHatasi("Bu kullanıcı favori ekleyemez.");
    }
    const tablo = eclubKisisiMi ? "eclub_video_favoriler" : "video_favoriler";
    const kimlikKolonu = eclubKisisiMi ? "kisi_id" : "kullanici_id";
    const kimlikId = eclubKisisiMi ? eclubKisi!.kisi_id : user.id;

    const body = await request.json();
    const { yayin_id } = body;
    if (!yayin_id) return validasyonHatasi("yayin_id zorunludur.", ["yayin_id"]);

    const { data: mevcut } = await adminSupabase
      .from(tablo)
      .select("favori_id")
      .eq(kimlikKolonu, kimlikId)
      .eq("yayin_id", yayin_id)
      .single();

    if (mevcut) {
      const { error: deleteError } = await adminSupabase
        .from(tablo)
        .delete()
        .eq("favori_id", mevcut.favori_id);

      if (deleteError) return hataYaniti("Favori kaldırılamadı.", "video_favoriler tablosu DELETE", deleteError);
      return NextResponse.json({ favori_mi: false }, { status: 200 });
    } else {
      const { error: insertError } = await adminSupabase
        .from(tablo)
        .insert({ [kimlikKolonu]: kimlikId, yayin_id });

      if (insertError) return hataYaniti("Favori kaydedilemedi.", "video_favoriler tablosu INSERT", insertError);
      return NextResponse.json({ favori_mi: true }, { status: 200 });
    }

  } catch (err) {
    return sunucuHatasi(err, "POST /izle/api/favori");
  }
}
