// app/admin/eclub-store/api/kategori/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { ADMIN_ROLLER } from "@/lib/utils/roller";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { adminGirisKontrol } from "@/lib/utils/adminGirisKontrol";

async function adminKontrol(_supabase: SupabaseClient): Promise<NextResponse | null> {
  // B-26: tek bekçi — adminGirisKontrol (yerel kopya kaldırıldı).
  const kontrol = await adminGirisKontrol();
  return kontrol.gecerli ? null : kontrol.yanit;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const guard = await adminKontrol(supabase);
    if (guard) return guard;

    const adminSupabase = createAdminClient();

    const { data: kategoriler, error } = await adminSupabase
      .from("eclub_store_kategoriler")
      .select("kategori_id, ad, sira, aktif_mi")
      .order("sira", { ascending: true });
    if (error) return hataYaniti("Kategoriler çekilemedi.", "eclub_store_kategoriler SELECT", error);

    const { data: urunler } = await adminSupabase
      .from("eclub_store_urunler")
      .select("kategori_id");
    const sayiMap = new Map<string, number>();
    for (const u of urunler ?? []) {
      const uu = u as { kategori_id: string | null };
      if (uu.kategori_id) sayiMap.set(uu.kategori_id, (sayiMap.get(uu.kategori_id) ?? 0) + 1);
    }

    const sonuc = (kategoriler ?? []).map((k) => {
      const kk = k as { kategori_id: string };
      return { ...k, urun_sayisi: sayiMap.get(kk.kategori_id) ?? 0 };
    });

    return NextResponse.json({ kategoriler: sonuc }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /admin/eclub-store/api/kategori");
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const guard = await adminKontrol(supabase);
    if (guard) return guard;

    const adminSupabase = createAdminClient();
    const body = await request.json();
    const { ad, sira, aktif_mi } = body;
    if (!ad || typeof ad !== "string") return validasyonHatasi("ad zorunludur.", ["ad"]);

    const { data, error } = await adminSupabase
      .from("eclub_store_kategoriler")
      .insert({ ad: ad.trim(), sira: Number(sira) || 0, aktif_mi: aktif_mi !== false })
      .select("kategori_id")
      .single();
    if (error || !data) return hataYaniti("Kategori eklenemedi.", "eclub_store_kategoriler INSERT", error);

    return NextResponse.json({ mesaj: "Kategori eklendi.", kategori_id: data.kategori_id }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /admin/eclub-store/api/kategori");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const guard = await adminKontrol(supabase);
    if (guard) return guard;

    const adminSupabase = createAdminClient();
    const body = await request.json();
    const { kategori_id, ad, sira, aktif_mi } = body;
    if (!kategori_id) return validasyonHatasi("kategori_id zorunludur.", ["kategori_id"]);
    if (!ad || typeof ad !== "string") return validasyonHatasi("ad zorunludur.", ["ad"]);

    const { error } = await adminSupabase
      .from("eclub_store_kategoriler")
      .update({ ad: ad.trim(), sira: Number(sira) || 0, aktif_mi: aktif_mi !== false })
      .eq("kategori_id", kategori_id);
    if (error) return hataYaniti("Kategori güncellenemedi.", "eclub_store_kategoriler UPDATE", error);

    return NextResponse.json({ mesaj: "Kategori güncellendi." }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "PUT /admin/eclub-store/api/kategori");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const guard = await adminKontrol(supabase);
    if (guard) return guard;

    const adminSupabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const kategori_id = searchParams.get("kategori_id");
    if (!kategori_id) return validasyonHatasi("kategori_id zorunludur.", ["kategori_id"]);

    const { data: urunler } = await adminSupabase
      .from("eclub_store_urunler")
      .select("urun_id")
      .eq("kategori_id", kategori_id)
      .limit(1);
    if ((urunler ?? []).length > 0) return isKuraluHatasi("Bu kategoride ürün var, önce ürünleri taşıyın/silin.");

    const { error } = await adminSupabase
      .from("eclub_store_kategoriler")
      .delete()
      .eq("kategori_id", kategori_id);
    if (error) return hataYaniti("Kategori silinemedi.", "eclub_store_kategoriler DELETE", error);

    return NextResponse.json({ mesaj: "Kategori silindi." }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "DELETE /admin/eclub-store/api/kategori");
  }
}