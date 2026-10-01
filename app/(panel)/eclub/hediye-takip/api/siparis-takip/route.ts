import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { cekTakipKapsaminiCoz } from "@/lib/eclub/hediyeTakip/cekTakipErisim";
import { siparisTakipFiltreleriniParseEt } from "@/lib/eclub/hediyeTakip/siparisTakipFiltreleri";
import { siparisTakipVerisiniGetir } from "@/lib/eclub/hediyeTakip/siparisTakipListesi";
import { hataYaniti, rolHatasi, sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authHatasi } = await supabase.auth.getUser();
    if (authHatasi || !user) return yetkiHatasi();
    const admin = createAdminClient();
    const erisim = await cekTakipKapsaminiCoz(admin, user.id);
    if (!erisim.ok) {
      if (erisim.kod === "veri_hatasi") return hataYaniti(erisim.mesaj, "Sipariş Takip kapsamı", erisim.detay);
      return rolHatasi(erisim.mesaj);
    }
    const filtre = siparisTakipFiltreleriniParseEt(request.nextUrl.searchParams);
    if (!filtre.ok) return validasyonHatasi(filtre.hata, filtre.alanlar);
    const veri = await siparisTakipVerisiniGetir(admin, erisim.kapsam, filtre.filtreler);
    return NextResponse.json(veri, { status: 200 });
  } catch (error) {
    return sunucuHatasi(error, "GET /eclub/hediye-takip/api/siparis-takip");
  }
}
