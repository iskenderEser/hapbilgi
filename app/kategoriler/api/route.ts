// app/kategoriler/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";

export async function GET(request: NextRequest) {
  try {
    const adminSupabase = createAdminClient();

    const { searchParams } = new URL(request.url);
    const firma_id = searchParams.get("firma_id");

    if (!firma_id) return validasyonHatasi("firma_id zorunludur.", ["firma_id"]);

    const { data: kategoriler, error } = await adminSupabase
      .from("kategoriler")
      .select("kategori_id, kategori_adi, firma_id, aktif_mi, created_at")
      .eq("firma_id", firma_id)
      .order("kategori_adi", { ascending: true });

    if (error) return hataYaniti("Kategoriler çekilemedi.", "kategoriler tablosu SELECT", error);

    return NextResponse.json({ kategoriler: kategoriler ?? [] }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /kategoriler/api");
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminSupabase = createAdminClient();

    const body = await request.json();
    const { firma_id, kategori_adi } = body;

    if (!firma_id) return validasyonHatasi("firma_id zorunludur.", ["firma_id"]);
    if (!kategori_adi || kategori_adi.trim().length === 0) return validasyonHatasi("Kategori adı zorunludur.", ["kategori_adi"]);

    const { data: mevcutKategori } = await adminSupabase
      .from("kategoriler")
      .select("kategori_id")
      .eq("firma_id", firma_id)
      .eq("kategori_adi", kategori_adi.trim())
      .maybeSingle();

    if (mevcutKategori) return NextResponse.json({ mesaj: "Bu kategori zaten mevcut.", kategori: mevcutKategori }, { status: 200 });

    const { data: yeniKategori, error } = await adminSupabase
      .from("kategoriler")
      .insert({ firma_id, kategori_adi: kategori_adi.trim() })
      .select("kategori_id, kategori_adi, firma_id, aktif_mi")
      .single();

    if (error) return hataYaniti("Kategori eklenemedi.", "kategoriler tablosu INSERT", error);

    return NextResponse.json({ mesaj: "Kategori eklendi.", kategori: yeniKategori }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /kategoriler/api");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const adminSupabase = createAdminClient();

    const body = await request.json();
    const { kategori_id, aktif_mi } = body;

    if (!kategori_id) return validasyonHatasi("kategori_id zorunludur.", ["kategori_id"]);
    if (typeof aktif_mi !== "boolean") return validasyonHatasi("aktif_mi boolean olmalıdır.", ["aktif_mi"]);

    const { data: guncellenen, error } = await adminSupabase
      .from("kategoriler")
      .update({ aktif_mi })
      .eq("kategori_id", kategori_id)
      .select("kategori_id, kategori_adi, aktif_mi")
      .single();

    if (error) return hataYaniti("Kategori güncellenemedi.", "kategoriler tablosu UPDATE", error);

    return NextResponse.json({ mesaj: "Kategori güncellendi.", kategori: guncellenen }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "PUT /kategoriler/api");
  }
}