// app/yayin-yonetimi/api/tekrar-secenekleri/route.ts
//
// Tekrar gönderim periyodu seçeneklerini döner (sistem_ayarlari — tek kaynak).
// Yayına alma formundaki dropdown bu listeden beslenir; POST /yayinlar da
// aynı listeye karşı doğrulama yapar (lib/tur/ayarlar.ts ortak okuyucu).

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, yetkiHatasi, rolHatasi, sunucuHatasi } from "@/lib/utils/hataIsle";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { tekrarPeriyotSecenekleri } from "@/lib/tur/ayarlar";
import { rolCozucu } from "@/lib/utils/rolCozucu";

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!URETICI_ROLLER.includes(rol)) return rolHatasi("Sadece yetkili roller erişebilir.");

    const secenekler = await tekrarPeriyotSecenekleri(adminSupabase);

    return NextResponse.json({ secenekler }, { status: 200 });

  } catch (err) {
    return hataYaniti(
      "Tekrar periyodu seçenekleri okunamadı.",
      "sistem_ayarlari SELECT — tekrar_periyot_secenekleri",
      err instanceof Error ? err.message : err
    ) ?? sunucuHatasi(err, "GET /yayin-yonetimi/api/tekrar-secenekleri");
  }
}