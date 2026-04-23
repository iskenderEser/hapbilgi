// app/admin/api/firmalar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";

export async function GET() {
  try {
    const adminSupabase = createAdminClient();

    const { data: firmalar, error } = await adminSupabase
      .from("firmalar")
      .select("firma_id, firma_adi, created_at")
      .order("firma_adi", { ascending: true });

    if (error) return hataYaniti("Firmalar çekilemedi.", "firmalar tablosu SELECT", error);

    return NextResponse.json({ firmalar: firmalar ?? [] }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /admin/api/firmalar");
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminSupabase = createAdminClient();

    const body = await request.json();
    const { firma_adi } = body;

    if (!firma_adi || firma_adi.trim() === "") {
      return validasyonHatasi("Firma adı zorunludur.", ["firma_adi"]);
    }

    // Aynı isimde firma var mı kontrol et
    const { data: mevcutFirma, error: mevcutError } = await adminSupabase
      .from("firmalar")
      .select("firma_id")
      .eq("firma_adi", firma_adi.trim())
      .single();

    if (mevcutError && mevcutError.code !== "PGRST116") {
      return hataYaniti("Firma kontrolü yapılamadı.", "firmalar tablosu SELECT — tekrar kontrolü", mevcutError);
    }

    if (mevcutFirma) {
      return hataYaniti("Bu isimde bir firma zaten mevcut.", "firmalar tablosu SELECT — tekrar kontrolü", null, 422);
    }

    const { data: yeniFirma, error } = await adminSupabase
      .from("firmalar")
      .insert({ firma_adi: firma_adi.trim() })
      .select("firma_id, firma_adi, created_at")
      .single();

    if (error) return hataYaniti("Firma eklenemedi.", "firmalar tablosu INSERT", error);

    return NextResponse.json({ mesaj: "Firma eklendi.", firma: yeniFirma }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /admin/api/firmalar");
  }
}