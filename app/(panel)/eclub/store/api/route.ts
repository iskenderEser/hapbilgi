import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ECLUB_TUKETICI_ROLLERI } from "@/lib/utils/roller";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import { eclubKisiErisimi } from "@/lib/eclub/kisiErisim";
import { eclubStoreTakvimDurumu } from "@/lib/eclub/store/takvim";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("tip") === "takvim") {
      return NextResponse.json({ takvim: eclubStoreTakvimDurumu() }, { status: 200 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    const erisim = await eclubKisiErisimi(adminSupabase, user.id);
    if (!erisim.kisi) return rolHatasi("Bu işlem yalnız E-Club kişilerine açıktır.");
    if (!ECLUB_TUKETICI_ROLLERI.includes(erisim.kisi.rol)) return rolHatasi("Geçersiz kişi rolü.");
    const { data: ozetData, error: ozetError } = await adminSupabase
      .rpc("get_eclub_eczane_store_ozet", { p_kisi_id: erisim.kisi.kisi_id });
    if (ozetError) return hataYaniti("Hediye çeki özeti alınamadı.", "get_eclub_eczane_store_ozet RPC", ozetError);

    return NextResponse.json({
      takvim: eclubStoreTakvimDurumu(),
      cek_yayinlar: ozetData ?? [],
    }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/store/api");
  }
}
