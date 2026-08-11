import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { hataYaniti, rolHatasi, sunucuHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import {
  ANALIZ_URETICI_ROLLERI,
  ANALIZ_YONETICI_ROLLERI,
} from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import type { AnalizRolKolu } from "@/lib/analiz/paylasilan/sorguYanit";

const KAPSAM_RPC: Record<AnalizRolKolu, string> = {
  yonetici: "get_analiz_yonetici_kapsam",
  uretici: "get_analiz_uretici_kapsam",
  tm: "get_analiz_tm_kapsam",
  bm: "get_analiz_bm_kapsam",
};

function roleIzinVarMi(rolKolu: AnalizRolKolu, rol: string): boolean {
  if (rolKolu === "yonetici") return ANALIZ_YONETICI_ROLLERI.includes(rol);
  if (rolKolu === "uretici") return ANALIZ_URETICI_ROLLERI.includes(rol);
  return rol === rolKolu;
}

export async function analizKapsamYanit(rolKolu: AnalizRolKolu): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const rol = await rolCozucu(adminSupabase, user.id);
    if (!roleIzinVarMi(rolKolu, rol)) {
      return rolHatasi("Analiz kapsamına erişim yetkiniz yok.");
    }

    const rpc = KAPSAM_RPC[rolKolu];
    const { data, error } = await adminSupabase.rpc(rpc, { p_kullanici_id: user.id });
    if (error) return hataYaniti("Kapsam verisi çekilirken hata oluştu.", rpc, error);

    return NextResponse.json({ kapsam: data }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, `GET /analiz/api/${rolKolu}/kapsam`);
  }
}
