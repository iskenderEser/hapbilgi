import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { uuidGecerliMi, uretimRpcHataYaniti } from "@/lib/uretim/rpc";
import { embedUrlGuidCikar } from "@/lib/video/bunnyYukleme";
import { pushYayinlaArkada } from "@/lib/push/orkestrasyon";

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();
    if (!URETICI_ROLLER.includes(await rolCozucu(adminSupabase, user.id))) return rolHatasi("Yalnız talebin üreticisi hazır video kaydedebilir.");

    const body = await request.json();
    if (!uuidGecerliMi(body.talep_id)) return validasyonHatasi("talep_id geçerli bir UUID olmalıdır.", ["talep_id"]);
    if (!uuidGecerliMi(body.islem_anahtari)) return validasyonHatasi("islem_anahtari geçerli bir UUID olmalıdır.", ["islem_anahtari"]);
    if (typeof body.video_url !== "string" || !embedUrlGuidCikar(body.video_url)) return validasyonHatasi("Video adresi kanonik Bunny embed adresi olmalıdır.", ["video_url"]);

    const { data: sonuc, error } = await adminSupabase.rpc("uretim_hazir_video_kaydet", {
      p_talep_id: body.talep_id,
      p_uretici_id: user.id,
      p_video_url: body.video_url,
      p_islem_anahtari: body.islem_anahtari,
    });
    if (error) return uretimRpcHataYaniti("Hazır video zinciri kurulamadı.", "uretim_hazir_video_kaydet RPC", error);

    const alici = (sonuc as { sonraki?: { atanan_iu_id?: string } | null } | null)?.sonraki?.atanan_iu_id;
    if (alici) pushYayinlaArkada(adminSupabase, "uretim_durum_gecisi", [alici]);
    return NextResponse.json({ mesaj: "Hazır video kaydedildi.", sonuc }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "PUT /uretim/api/hazir-video");
  }
}
