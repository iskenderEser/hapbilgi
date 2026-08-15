import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { uuidGecerliMi, uretimRpcHataYaniti } from "@/lib/uretim/rpc";
import { pushYayinlaArkada } from "@/lib/push/orkestrasyon";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();
    if (!URETICI_ROLLER.includes(await rolCozucu(adminSupabase, user.id))) return rolHatasi("Yalnız talebin üreticisi üretim görevini başlatabilir.");

    const body = await request.json();
    if (!uuidGecerliMi(body.talep_id)) return validasyonHatasi("talep_id geçerli bir UUID olmalıdır.", ["talep_id"]);
    if (!uuidGecerliMi(body.islem_anahtari)) return validasyonHatasi("islem_anahtari geçerli bir UUID olmalıdır.", ["islem_anahtari"]);

    const { data: sonuc, error } = await adminSupabase.rpc("uretim_talep_ilk_gorevini_ac", {
      p_talep_id: body.talep_id,
      p_uretici_id: user.id,
      p_islem_anahtari: body.islem_anahtari,
    });
    if (error) return uretimRpcHataYaniti("Talebin ilk görevi açılamadı.", "uretim_talep_ilk_gorevini_ac RPC", error);

    const alici = (sonuc as { atanan_iu_id?: string } | null)?.atanan_iu_id;
    if (alici) pushYayinlaArkada(adminSupabase, "uretim_durum_gecisi", [alici]);
    return NextResponse.json({ mesaj: "Üretim görevi başlatıldı.", sonuc }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /uretim/api/talep-baslat");
  }
}

