// app/eclub/store/api/adres/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";

const ECLUB_KISI_ROLLERI = ["eczaci", "eczane_teknisyeni"];

async function kisiCoz(adminSupabase: ReturnType<typeof createAdminClient>, authUserId: string) {
  const { data } = await adminSupabase
    .from("eclub_kisiler")
    .select("kisi_id, rol")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  return data;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const kisi = await kisiCoz(adminSupabase, user.id);
    if (!kisi) return rolHatasi("Bu işlem yalnız E-Club kişilerine açıktır.");
    if (!ECLUB_KISI_ROLLERI.includes(kisi.rol)) return rolHatasi("Geçersiz kişi rolü.");

    const { data, error } = await adminSupabase
      .from("eclub_store_adresler")
      .select("adres_id, kisi_id, baslik, ad_soyad, telefon, il, ilce, acik_adres, varsayilan_mi")
      .eq("kisi_id", kisi.kisi_id)
      .order("varsayilan_mi", { ascending: false });

    if (error) return hataYaniti("Adresler çekilemedi.", "eclub_store_adresler SELECT", error);

    return NextResponse.json({ adresler: data ?? [] }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/store/api/adres");
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const kisi = await kisiCoz(adminSupabase, user.id);
    if (!kisi) return rolHatasi("Bu işlem yalnız E-Club kişilerine açıktır.");
    if (!ECLUB_KISI_ROLLERI.includes(kisi.rol)) return rolHatasi("Geçersiz kişi rolü.");

    const body = await request.json();
    const { baslik, ad_soyad, telefon, il, ilce, acik_adres, varsayilan_mi } = body;

    const eksik: string[] = [];
    if (!ad_soyad) eksik.push("ad_soyad");
    if (!telefon) eksik.push("telefon");
    if (!il) eksik.push("il");
    if (!ilce) eksik.push("ilce");
    if (!acik_adres) eksik.push("acik_adres");
    if (eksik.length > 0) return validasyonHatasi("Zorunlu alanlar eksik.", eksik);

    if (varsayilan_mi === true) {
      await adminSupabase.from("eclub_store_adresler")
        .update({ varsayilan_mi: false }).eq("kisi_id", kisi.kisi_id);
    }

    const { data, error } = await adminSupabase
      .from("eclub_store_adresler")
      .insert({
        kisi_id: kisi.kisi_id,
        baslik: baslik ?? null,
        ad_soyad, telefon, il, ilce, acik_adres,
        varsayilan_mi: varsayilan_mi === true,
      })
      .select("adres_id")
      .single();

    if (error || !data) return hataYaniti("Adres kaydedilemedi.", "eclub_store_adresler INSERT", error);

    return NextResponse.json({ mesaj: "Adres eklendi.", adres_id: data.adres_id }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eclub/store/api/adres");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const kisi = await kisiCoz(adminSupabase, user.id);
    if (!kisi) return rolHatasi("Bu işlem yalnız E-Club kişilerine açıktır.");
    if (!ECLUB_KISI_ROLLERI.includes(kisi.rol)) return rolHatasi("Geçersiz kişi rolü.");

    const { searchParams } = new URL(request.url);
    const adres_id = searchParams.get("adres_id");
    if (!adres_id) return validasyonHatasi("adres_id zorunludur.", ["adres_id"]);

    const { error } = await adminSupabase
      .from("eclub_store_adresler")
      .delete()
      .eq("adres_id", adres_id)
      .eq("kisi_id", kisi.kisi_id);

    if (error) return hataYaniti("Adres silinemedi.", "eclub_store_adresler DELETE", error);

    return NextResponse.json({ mesaj: "Adres silindi." }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "DELETE /eclub/store/api/adres");
  }
}