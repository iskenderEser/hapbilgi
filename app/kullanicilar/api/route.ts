// app/kullanicilar/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi } from "@/lib/utils/hataIsle";

export async function GET(request: NextRequest) {
  try {
    const adminSupabase = createAdminClient();

    const { searchParams } = new URL(request.url);
    const bolge_id = searchParams.get("bolge_id");
    const takim_id = searchParams.get("takim_id");
    const firma_id = searchParams.get("firma_id");
    const kullanici_rol = searchParams.get("rol");

    // v_kullanici_detay view'ından çek
    let query = adminSupabase
      .from("v_kullanici_detay")
      .select("kullanici_id, ad, soyad, eposta, rol, firma_id, firma_adi, takim_id, takim_adi, bolge_id, bolge_adi, aktif_mi, created_at")
      .order("created_at", { ascending: false });

    if (bolge_id) query = query.eq("bolge_id", bolge_id);
    if (takim_id) query = query.eq("takim_id", takim_id);
    if (firma_id) query = query.eq("firma_id", firma_id);
    if (kullanici_rol) query = query.eq("rol", kullanici_rol);

    const { data: kullanicilar, error } = await query;
    if (error) return hataYaniti("Kullanıcılar çekilemedi.", "v_kullanici_detay view SELECT", error);

    return NextResponse.json({ kullanicilar: kullanicilar ?? [] }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /kullanicilar/api");
  }
}