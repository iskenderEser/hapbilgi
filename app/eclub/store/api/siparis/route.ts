import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { eclubStoreSiparisOlustur, eclubStoreSiparisIptal, eclubStoreTeslimAldim } from "@/lib/eclub/store/eclubStoreSiparis";

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

    const { searchParams } = new URL(request.url);
    const durum = searchParams.get("durum");

    let query = adminSupabase
      .from("eclub_store_siparisler")
      .select(`
        siparis_id, kisi_id, urun_id, adres_id, adres_snapshot, adet,
        puan_birim_fiyat, toplam_puan, durum, kargo_firmasi, kargo_takip_no,
        iptal_sebebi, created_at, guncellenme_at, teslim_alma_at,
        eclub_store_urunler ( ad, gorsel_url )
      `)
      .eq("kisi_id", kisi.kisi_id)
      .order("created_at", { ascending: false });

    if (durum) query = query.eq("durum", durum);

    const { data, error } = await query;
    if (error) return hataYaniti("Siparişler çekilemedi.", "eclub_store_siparisler SELECT", error);

    return NextResponse.json({ siparisler: data ?? [] }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/store/api/siparis");
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
    const { urun_id, adres_id, adet } = body;

    if (!urun_id || typeof urun_id !== "string") return validasyonHatasi("urun_id zorunludur.", ["urun_id"]);
    if (!adres_id || typeof adres_id !== "string") return validasyonHatasi("adres_id zorunludur.", ["adres_id"]);
    const adetSayi = Number(adet);
    if (!Number.isInteger(adetSayi) || adetSayi <= 0) return validasyonHatasi("adet pozitif tam sayı olmalı.", ["adet"]);

    const sonuc = await eclubStoreSiparisOlustur(adminSupabase, {
      kisi_id: kisi.kisi_id,
      urun_id,
      adres_id,
      adet: adetSayi,
    });

    if (!sonuc.ok) return isKuraluHatasi(sonuc.hata ?? "Sipariş oluşturulamadı.");

    return NextResponse.json({ mesaj: "Sipariş alındı.", siparis_id: sonuc.siparis_id }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eclub/store/api/siparis");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const kisi = await kisiCoz(adminSupabase, user.id);
    if (!kisi) return rolHatasi("Bu işlem yalnız E-Club kişilerine açıktır.");
    if (!ECLUB_KISI_ROLLERI.includes(kisi.rol)) return rolHatasi("Geçersiz kişi rolü.");

    const body = await request.json();
    const { siparis_id, action, sebep } = body;
    if (!siparis_id || typeof siparis_id !== "string") return validasyonHatasi("siparis_id zorunludur.", ["siparis_id"]);

    if (action === "iptal") {
      const sonuc = await eclubStoreSiparisIptal(adminSupabase, {
        siparis_id,
        iptal_eden_kisi_id: kisi.kisi_id,
        is_admin: false,
        sebep: sebep ?? null,
      });
      if (!sonuc.ok) return isKuraluHatasi(sonuc.error ?? "Sipariş iptal edilemedi.");
      return NextResponse.json({ mesaj: "Sipariş iptal edildi." }, { status: 200 });
    }

    if (action === "teslim_aldim") {
      const sonuc = await eclubStoreTeslimAldim(adminSupabase, siparis_id, kisi.kisi_id);
      if (!sonuc.ok) return isKuraluHatasi(sonuc.error ?? "Teslim onayı verilemedi.");
      return NextResponse.json({ mesaj: "Sipariş teslim alındı olarak işaretlendi." }, { status: 200 });
    }

    return validasyonHatasi(`Geçersiz action: ${action} (geçerli: 'iptal', 'teslim_aldim')`, ["action"]);
  } catch (err) {
    return sunucuHatasi(err, "PATCH /eclub/store/api/siparis");
  }
}