import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { cekTakipKapsaminiCoz } from "@/lib/eclub/hediyeTakip/cekTakipErisim";
import { siparisTakipFiltreleriniParseEt } from "@/lib/eclub/hediyeTakip/siparisTakipFiltreleri";
import { siparisTakipVerisiniGetir } from "@/lib/eclub/hediyeTakip/siparisTakipListesi";
import { hataYaniti, rolHatasi, sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";

export async function GET(request: NextRequest) {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return yetkiHatasi();
    const admin = createAdminClient();
    const erisim = await cekTakipKapsaminiCoz(admin, user.id);
    if (!erisim.ok) return erisim.kod === "veri_hatasi" ? hataYaniti(erisim.mesaj, "Sipariş Takip kapsamı", erisim.detay) : rolHatasi(erisim.mesaj);
    const filtre = siparisTakipFiltreleriniParseEt(request.nextUrl.searchParams);
    if (!filtre.ok) return validasyonHatasi(filtre.hata, filtre.alanlar);
    return NextResponse.json(await siparisTakipVerisiniGetir(admin, erisim.kapsam, filtre.filtreler));
  } catch (error) { return sunucuHatasi(error, "GET /eclub/hediye-takip/api/siparis-takip"); }
}
