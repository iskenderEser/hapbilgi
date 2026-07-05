import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import { eclubStoreFirmaBakiye } from "@/lib/eclub/store/eclubStoreBakiye";

const ECLUB_KISI_ROLLERI = ["eczaci", "eczane_teknisyeni"];

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    const { data: kisi, error: kisiError } = await adminSupabase
      .from("eclub_kisiler")
      .select("kisi_id, rol")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (kisiError) return hataYaniti("Kişi bilgisi alınamadı.", "eclub_kisiler SELECT", kisiError);
    if (!kisi) return rolHatasi("Bu işlem yalnız E-Club kişilerine açıktır.");
    if (!ECLUB_KISI_ROLLERI.includes(kisi.rol)) return rolHatasi("Geçersiz kişi rolü.");

    const { data: kategoriler } = await adminSupabase
      .from("eclub_store_kategoriler")
      .select("kategori_id, ad, sira, aktif_mi")
      .eq("aktif_mi", true)
      .order("sira", { ascending: true });

    const { data: urunler } = await adminSupabase
      .from("eclub_store_urunler")
      .select("urun_id, kategori_id, ad, aciklama, gorsel_url, puan_fiyat, stok, aktif_mi")
      .eq("aktif_mi", true)
      .order("created_at", { ascending: false });

    const firmaBakiye = await eclubStoreFirmaBakiye(adminSupabase, kisi.kisi_id);
    const toplamBakiye = firmaBakiye.reduce((acc, f) => acc + (f.bakiye ?? 0), 0);

    return NextResponse.json({
      kategoriler: kategoriler ?? [],
      urunler: urunler ?? [],
      firma_bakiye: firmaBakiye,
      toplam_bakiye: toplamBakiye,
    }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/store/api");
  }
}