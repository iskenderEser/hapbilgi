import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { hataYaniti, rolHatasi, sunucuHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { IU_ROLU } from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";

export async function GET() {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return yetkiHatasi();
    if (await rolCozucu(admin, user.id) !== IU_ROLU) return rolHatasi("Bu liste yalnız içerik üreticisine açıktır.");

    const [senaryo, arac, set] = await Promise.all([
      admin.from("senaryo_durumu").select("senaryo_durum_id, created_at, senaryolar(talep_id, senaryo_metni)").eq("durum", "onaylandi").order("created_at", { ascending: false }),
      admin.from("ogrenme_araci_durumu").select("arac_durum_id, ogrenme_araclari!inner(dosya_yolu, senaryo_durum_id, arac_turu)").eq("durum", "onaylandi").eq("ogrenme_araclari.arac_turu", "video"),
      admin.from("soru_seti_durumu").select("soru_setleri(arac_durum_id, sorular)").eq("durum", "onaylandi"),
    ]);
    const ilkHata = senaryo.error ?? arac.error ?? set.error;
    if (ilkHata) return hataYaniti("Onaylanan içerikler yüklenemedi.", "ortak öğrenme aracı zinciri SELECT", ilkHata);
    return NextResponse.json({ senaryoOnaylari: senaryo.data ?? [], videoOnaylari: arac.data ?? [], setOnaylari: set.data ?? [] });
  } catch (error) {
    return sunucuHatasi(error, "GET /onaylanan-talepler/api");
  }
}
