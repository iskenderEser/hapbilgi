// app/admin/eclub-store/api/urun/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { ADMIN_ROLLER } from "@/lib/utils/roller";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rolCozucu } from "@/lib/utils/rolCozucu";

async function adminKontrol(supabase: SupabaseClient): Promise<NextResponse | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return yetkiHatasi();
  const adminSupabase = createAdminClient();
  const rol = await rolCozucu(adminSupabase, user.id);
  if (!ADMIN_ROLLER.includes(rol)) return rolHatasi("Bu işleme yalnızca admin erişebilir.");
  return null;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const guard = await adminKontrol(supabase);
    if (guard) return guard;

    const adminSupabase = createAdminClient();

    const { data: urunler, error } = await adminSupabase
      .from("eclub_store_urunler")
      .select("urun_id, kategori_id, ad, aciklama, gorsel_url, puan_fiyat, stok, aktif_mi")
      .order("created_at", { ascending: false });
    if (error) return hataYaniti("Ürünler çekilemedi.", "eclub_store_urunler SELECT", error);

    const { data: kategoriler } = await adminSupabase
      .from("eclub_store_kategoriler")
      .select("kategori_id, ad");
    const katMap = new Map<string, string>();
    for (const k of kategoriler ?? []) {
      const kk = k as { kategori_id: string; ad: string };
      katMap.set(kk.kategori_id, kk.ad);
    }

    const sonuc = (urunler ?? []).map((u) => {
      const uu = u as { kategori_id: string | null };
      return { ...u, kategori_adi: uu.kategori_id ? (katMap.get(uu.kategori_id) ?? null) : null };
    });

    return NextResponse.json({ urunler: sonuc }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /admin/eclub-store/api/urun");
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const guard = await adminKontrol(supabase);
    if (guard) return guard;

    const adminSupabase = createAdminClient();
    const body = await request.json();
    const { kategori_id, ad, aciklama, gorsel_url, puan_fiyat, stok, aktif_mi } = body;
    if (!ad || typeof ad !== "string") return validasyonHatasi("ad zorunludur.", ["ad"]);
    const puan = Number(puan_fiyat);
    if (!Number.isInteger(puan) || puan <= 0) return validasyonHatasi("puan_fiyat pozitif tam sayı olmalı.", ["puan_fiyat"]);
    const stokSayi = Number(stok);
    if (!Number.isInteger(stokSayi) || stokSayi < 0) return validasyonHatasi("stok 0 veya pozitif olmalı.", ["stok"]);

    const { data, error } = await adminSupabase
      .from("eclub_store_urunler")
      .insert({
        kategori_id: kategori_id || null,
        ad: ad.trim(),
        aciklama: aciklama ?? null,
        gorsel_url: gorsel_url ?? null,
        puan_fiyat: puan,
        stok: stokSayi,
        aktif_mi: aktif_mi !== false,
      })
      .select("urun_id")
      .single();
    if (error || !data) return hataYaniti("Ürün eklenemedi.", "eclub_store_urunler INSERT", error);

    return NextResponse.json({ mesaj: "Ürün eklendi.", urun_id: data.urun_id }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /admin/eclub-store/api/urun");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const guard = await adminKontrol(supabase);
    if (guard) return guard;

    const adminSupabase = createAdminClient();
    const body = await request.json();
    const { urun_id, kategori_id, ad, aciklama, gorsel_url, puan_fiyat, stok, aktif_mi } = body;
    if (!urun_id) return validasyonHatasi("urun_id zorunludur.", ["urun_id"]);
    if (!ad || typeof ad !== "string") return validasyonHatasi("ad zorunludur.", ["ad"]);
    const puan = Number(puan_fiyat);
    if (!Number.isInteger(puan) || puan <= 0) return validasyonHatasi("puan_fiyat pozitif tam sayı olmalı.", ["puan_fiyat"]);
    const stokSayi = Number(stok);
    if (!Number.isInteger(stokSayi) || stokSayi < 0) return validasyonHatasi("stok 0 veya pozitif olmalı.", ["stok"]);

    const { error } = await adminSupabase
      .from("eclub_store_urunler")
      .update({
        kategori_id: kategori_id || null,
        ad: ad.trim(),
        aciklama: aciklama ?? null,
        gorsel_url: gorsel_url ?? null,
        puan_fiyat: puan,
        stok: stokSayi,
        aktif_mi: aktif_mi !== false,
        guncellenme_at: new Date().toISOString(),
      })
      .eq("urun_id", urun_id);
    if (error) return hataYaniti("Ürün güncellenemedi.", "eclub_store_urunler UPDATE", error);

    return NextResponse.json({ mesaj: "Ürün güncellendi." }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "PUT /admin/eclub-store/api/urun");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const guard = await adminKontrol(supabase);
    if (guard) return guard;

    const adminSupabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const urun_id = searchParams.get("urun_id");
    if (!urun_id) return validasyonHatasi("urun_id zorunludur.", ["urun_id"]);

    const { data: siparisler } = await adminSupabase
      .from("eclub_store_siparisler")
      .select("siparis_id")
      .eq("urun_id", urun_id)
      .limit(1);

    if ((siparisler ?? []).length > 0) {
      const { error } = await adminSupabase
        .from("eclub_store_urunler")
        .update({ aktif_mi: false, guncellenme_at: new Date().toISOString() })
        .eq("urun_id", urun_id);
      if (error) return hataYaniti("Ürün pasife alınamadı.", "eclub_store_urunler UPDATE pasif", error);
      return NextResponse.json({ mesaj: "Ürünün siparişi olduğu için pasife alındı." }, { status: 200 });
    }

    const { error } = await adminSupabase
      .from("eclub_store_urunler")
      .delete()
      .eq("urun_id", urun_id);
    if (error) return hataYaniti("Ürün silinemedi.", "eclub_store_urunler DELETE", error);

    return NextResponse.json({ mesaj: "Ürün silindi." }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "DELETE /admin/eclub-store/api/urun");
  }
}