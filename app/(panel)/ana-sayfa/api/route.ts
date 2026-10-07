// app/ana-sayfa/api/route.ts
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { IU_ROLU, TUKETICI_ROLLER, URETICI_ROLLER, YONETICI_ROLLER } from "@/lib/utils/roller";
import { getBmAnaSayfaIstatistikleri, type BmStatSecimi } from "@/lib/utils/anaSayfa/bm";
import { OGRENME_ARACI_TURLERI } from "@/lib/ogrenmeAraci/tipler";
import { PERIYOTLAR } from "@/lib/utils/raporUtils";
import { getUttAnaSayfaVeri } from "@/lib/utils/anaSayfa/utt";
import { getTmAnaSayfaIstatistikleri, type TmStatSecimi } from "@/lib/utils/anaSayfa/tm";
import { getIuAnaSayfaVeri } from "@/lib/utils/anaSayfa/iu";
import { getUreticiAnaSayfaVeri } from "@/lib/utils/anaSayfa/uretici";
import { getYoneticiAnaSayfaVeri } from "@/lib/utils/anaSayfa/yonetici";
import { getAnaSayfaVideolari, getSahaAnaSayfaVideolari, getTmAnaSayfaYayinlari } from "@/lib/video/anaSayfaVideolari";
import { rolCozucu } from "@/lib/utils/rolCozucu";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);

    let veriSozu: Promise<Record<string, unknown>>;

    if (rol === "bm") {
      const parametreler = new URL(request.url).searchParams;
      const periyot = parametreler.get("periyot") ?? "bu_hafta";
      const aracTuru = parametreler.get("arac_turu") ?? "tumu";
      if (parametreler.getAll("periyot").length > 1
        || !PERIYOTLAR.some((deger) => deger.key === periyot)) {
        return validasyonHatasi("Geçersiz zaman seçimi.", ["periyot"]);
      }
      if (parametreler.getAll("arac_turu").length > 1
        || (aracTuru !== "tumu" && !OGRENME_ARACI_TURLERI.some((deger) => deger === aracTuru))) {
        return validasyonHatasi("Geçersiz yayın türü seçimi.", ["arac_turu"]);
      }
      const secim: BmStatSecimi = {
        periyot: periyot as BmStatSecimi["periyot"],
        aracTuru: aracTuru as BmStatSecimi["aracTuru"],
      };
      veriSozu = getBmAnaSayfaIstatistikleri(user.id, adminSupabase, secim);
    } else if (rol === "tm") {
      const parametreler = new URL(request.url).searchParams;
      const periyot = parametreler.get("periyot") ?? "bu_hafta";
      const aracTuru = parametreler.get("arac_turu") ?? "tumu";
      if (parametreler.getAll("periyot").length > 1
        || !PERIYOTLAR.some((deger) => deger.key === periyot)) {
        return validasyonHatasi("Geçersiz zaman seçimi.", ["periyot"]);
      }
      if (parametreler.getAll("arac_turu").length > 1
        || (aracTuru !== "tumu" && !OGRENME_ARACI_TURLERI.some((deger) => deger === aracTuru))) {
        return validasyonHatasi("Geçersiz yayın türü seçimi.", ["arac_turu"]);
      }
      const secim: TmStatSecimi = {
        periyot: periyot as TmStatSecimi["periyot"],
        aracTuru: aracTuru as TmStatSecimi["aracTuru"],
      };
      veriSozu = getTmAnaSayfaIstatistikleri(user.id, adminSupabase, secim);
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

    if (rol === "tm") {
      const [anaVeri, yayinlar] = await Promise.all([
        veriSozu,
        getTmAnaSayfaYayinlari(user.id, adminSupabase),
      ]);
      return NextResponse.json({ ...anaVeri, yayinlar }, { status: 200 });
    }

    // Yalnız-izleme rolleri için ana sayfa video listesini ekle.
    // UTT/KD_UTT kendi video verisini (getUttAnaSayfaVeri) kullanmaya devam eder.
    // getAnaSayfaVideolari, video görmeyen roller (İK, IU) için boş dizi döndürür → bölüm çıkmaz.
    const videoSozu = !TUKETICI_ROLLER.includes(rol)
      ? rol === "bm"
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
