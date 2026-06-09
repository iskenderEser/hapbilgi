// app/takimlar/api/route.ts
//
// /takimlar/api — GET: firma_id'ye göre takım listesi.
// Madde 4 Aşama 2B: kullaniciTakimId === null rolleri için (med_md, egt_*) yeni ürün eklerken
// takım dropdown'unu bu endpoint besler.
// kategoriler/api/route.ts'in GET-only kuzeni; aynı auth + hata + dönüş deseni.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  hataYaniti,
  sunucuHatasi,
  yetkiHatasi,
  rolHatasi,
  validasyonHatasi,
} from "@/lib/utils/hataIsle";
import { URETICI_ROLLER } from "@/lib/utils/roller";

const TAKIM_GORUNTULEME_ROLLERI = [...URETICI_ROLLER, "iu", "admin"];

async function rolGetir(userId: string): Promise<string> {
  const adminSupabase = createAdminClient();
  const { data } = await adminSupabase
    .from("kullanicilar")
    .select("rol")
    .eq("kullanici_id", userId)
    .single();
  return (data?.rol ?? "").toLowerCase();
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolGetir(user.id);
    if (!TAKIM_GORUNTULEME_ROLLERI.includes(rol)) {
      return rolHatasi("Bu veriye erişim yetkiniz bulunmamaktadır.");
    }

    const { searchParams } = new URL(request.url);
    const firma_id = searchParams.get("firma_id");

    if (!firma_id) return validasyonHatasi("firma_id zorunludur.", ["firma_id"]);

    const { data: takimlar, error } = await adminSupabase
      .from("takimlar")
      .select("takim_id, takim_adi, firma_id, created_at")
      .eq("firma_id", firma_id)
      .order("takim_adi", { ascending: true });

    if (error) return hataYaniti("Takımlar çekilemedi.", "takimlar tablosu SELECT", error);

    return NextResponse.json({ takimlar: takimlar ?? [] }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /takimlar/api");
  }
}