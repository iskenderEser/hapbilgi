import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ECLUB_TUKETICI_ROLLERI } from "@/lib/utils/roller";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import { eclubStoreFirmaBakiye } from "@/lib/eclub/store/eclubStoreBakiye";
import { eclubKisiErisimi } from "@/lib/eclub/kisiErisim";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    const erisim = await eclubKisiErisimi(adminSupabase, user.id);
    if (!erisim.kisi) return rolHatasi("Bu işlem yalnız E-Club kişilerine açıktır.");
    if (!ECLUB_TUKETICI_ROLLERI.includes(erisim.kisi.rol)) return rolHatasi("Geçersiz kişi rolü.");
    const firmaIdler = erisim.firmalar
      .filter((firma) => firma.aktif !== false && firma.eclub_aktif === true && firma.eclub_store_aktif === true)
      .map((firma) => firma.firma_id);

    const { data: kategoriler } = await adminSupabase
      .from("eclub_store_kategoriler")
      .select("kategori_id, ad, sira, aktif_mi")
      .eq("aktif_mi", true)
      .order("sira", { ascending: true });

    const { data: urunler, error: urunError } = await adminSupabase
      .from("eclub_store_urunler")
      .select("urun_id, kategori_id, ad, aciklama, gorsel_url, puan_fiyat, stok, aktif_mi")
      .eq("aktif_mi", true)
      .order("created_at", { ascending: false });
    if (urunError) return hataYaniti("Ürünler alınamadı.", "eclub_store_urunler SELECT", urunError);

    const firmaBakiye = await eclubStoreFirmaBakiye(adminSupabase, erisim.kisi.kisi_id);
    const toplamBakiye = firmaBakiye.reduce((acc, f) => acc + (f.bakiye ?? 0), 0);
    const urunIdler = (urunler ?? []).map((urun) => urun.urun_id);
    const { data: kapaliAyarlar, error: ayarError } = firmaIdler.length > 0 && urunIdler.length > 0
      ? await adminSupabase
        .from("eclub_store_urun_firma_ayarlari")
        .select("urun_id, firma_id")
        .in("urun_id", urunIdler)
        .in("firma_id", firmaIdler)
        .eq("aktif_mi", false)
      : { data: [], error: null };
    if (ayarError) return hataYaniti("Ürün firma erişimleri alınamadı.", "eclub_store_urun_firma_ayarlari SELECT", ayarError);

    const kapali = new Set((kapaliAyarlar ?? []).map((ayar) => `${ayar.urun_id}:${ayar.firma_id}`));
    const gorunurUrunler = (urunler ?? []).flatMap((urun) => {
      const izinliFirmalar = firmaIdler.filter((firmaId) => !kapali.has(`${urun.urun_id}:${firmaId}`));
      if (izinliFirmalar.length === 0) return [];
      const kullanilabilirPuan = firmaBakiye
        .filter((bakiye) => izinliFirmalar.includes(bakiye.firma_id))
        .reduce((toplam, bakiye) => toplam + (bakiye.bakiye ?? 0), 0);
      return [{ ...urun, kullanilabilir_puan: kullanilabilirPuan }];
    });

    return NextResponse.json({
      kategoriler: kategoriler ?? [],
      urunler: gorunurUrunler,
      firma_bakiye: firmaBakiye,
      toplam_bakiye: toplamBakiye,
    }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/store/api");
  }
}
