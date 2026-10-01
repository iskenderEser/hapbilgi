import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { cekTakipKapsaminiCoz } from "@/lib/eclub/hediyeTakip/cekTakipErisim";
import { cekTakipFiltreleriniParseEt } from "@/lib/eclub/hediyeTakip/cekTakipFiltreleri";
import { cekTakipFiltreSecenekleriniGetir } from "@/lib/eclub/hediyeTakip/cekTakipFiltreSecenekleri";
import { cekTakipTalepleriniGetir } from "@/lib/eclub/hediyeTakip/cekTakipListesi";
import { cekTakipStatlariniGetir } from "@/lib/eclub/hediyeTakip/cekTakipStatlari";
import { hataYaniti, rolHatasi, sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authHatasi } = await supabase.auth.getUser();
    if (authHatasi || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const erisim = await cekTakipKapsaminiCoz(adminSupabase, user.id);
    if (!erisim.ok) {
      if (erisim.kod === "veri_hatasi") {
        return hataYaniti(erisim.mesaj, "Çek Takip kapsamı", erisim.detay);
      }
      return rolHatasi(erisim.mesaj);
    }

    const filtreSonucu = cekTakipFiltreleriniParseEt(request.nextUrl.searchParams);
    if (!filtreSonucu.ok) return validasyonHatasi(filtreSonucu.hata, filtreSonucu.alanlar);

    const [statlar, filtre_secenekleri, liste] = await Promise.all([
      cekTakipStatlariniGetir(adminSupabase, erisim.kapsam),
      cekTakipFiltreSecenekleriniGetir(adminSupabase, erisim.kapsam),
      cekTakipTalepleriniGetir(adminSupabase, erisim.kapsam, filtreSonucu.filtreler),
    ]);

    return NextResponse.json({
      statlar,
      filtre_secenekleri,
      talepler: liste.talepler,
      sayfalama: liste.sayfalama,
    }, { status: 200 });
  } catch (error) {
    return sunucuHatasi(error, "GET /eclub/hediye-takip/api/cek-takip");
  }
}
