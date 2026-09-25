// app/ana-sayfa/api/route.ts
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import { IU_ROLU, TUKETICI_ROLLER, URETICI_ROLLER, YONETICI_ROLLER } from "@/lib/utils/roller";
import { getBmAnaSayfaVeri } from "@/lib/utils/anaSayfa/bm";
import { getUttAnaSayfaVeri } from "@/lib/utils/anaSayfa/utt";
import { getTmAnaSayfaVeri } from "@/lib/utils/anaSayfa/tm";
import { getIuAnaSayfaVeri } from "@/lib/utils/anaSayfa/iu";
import { getUreticiAnaSayfaVeri } from "@/lib/utils/anaSayfa/uretici";
import { getYoneticiAnaSayfaVeri } from "@/lib/utils/anaSayfa/yonetici";
import { getAnaSayfaVideolari, getSahaAnaSayfaVideolari } from "@/lib/video/anaSayfaVideolari";
import { rolCozucu } from "@/lib/utils/rolCozucu";

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);

    let veriSozu: Promise<Record<string, unknown>>;

    if (rol === "bm") {
      veriSozu = getBmAnaSayfaVeri(user.id, adminSupabase);
    } else if (rol === "tm") {
      veriSozu = getTmAnaSayfaVeri(user.id, adminSupabase);
    } else if (TUKETICI_ROLLER.includes(rol)) {
      veriSozu = getUttAnaSayfaVeri(user.id, adminSupabase);
    } else if (rol === IU_ROLU) {
      veriSozu = getIuAnaSayfaVeri(user.id, adminSupabase) as unknown as Promise<Record<string, unknown>>;
    } else if (URETICI_ROLLER.includes(rol)) {
      veriSozu = getUreticiAnaSayfaVeri(user.id, adminSupabase);
    } else if (YONETICI_ROLLER.includes(rol)) {
      veriSozu = getYoneticiAnaSayfaVeri(user.id, adminSupabase);
    } else {
      return rolHatasi("Bu role ait ana sayfa verisi tanımlanmamış.");
    }

    // Yalnız-izleme rolleri için ana sayfa video listesini ekle.
    // UTT/KD_UTT kendi video verisini (getUttAnaSayfaVeri) kullanmaya devam eder.
    // getAnaSayfaVideolari, video görmeyen roller (İK, IU) için boş dizi döndürür → bölüm çıkmaz.
    const videoSozu = !TUKETICI_ROLLER.includes(rol)
      ? rol === "bm" || rol === "tm"
        ? getSahaAnaSayfaVideolari(user.id, rol, adminSupabase)
        : getAnaSayfaVideolari(user.id, rol, adminSupabase)
      : Promise.resolve(null);

    // Ana ekran verisi ve video listesi bağımsız sorgulardır; ardışık bekletilmez.
    const [anaVeri, videolar] = await Promise.all([veriSozu, videoSozu]);
    const veri = videolar === null ? anaVeri : { ...anaVeri, videolar };

    return NextResponse.json(veri, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /ana-sayfa/api");
  }
}
