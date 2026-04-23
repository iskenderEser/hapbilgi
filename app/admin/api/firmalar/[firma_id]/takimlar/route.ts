// app/admin/api/firmalar/[firma_id]/takimlar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ firma_id: string }> }
) {
  try {
    const { firma_id } = await params;
    if (!firma_id) return validasyonHatasi("firma_id zorunludur.", ["firma_id"]);

    const adminSupabase = createAdminClient();

    const { data: firma, error: firmaError } = await adminSupabase
      .from("firmalar")
      .select("firma_id")
      .eq("firma_id", firma_id)
      .single();

    const firmaKontrol = veriKontrol(firma, "firmalar tablosu SELECT — firma_id kontrolü", "Firma bulunamadı.");
    if (!firmaKontrol.gecerli) return firmaKontrol.yanit;
    if (firmaError) return hataYaniti("Firma sorgulanırken hata oluştu.", "firmalar tablosu SELECT", firmaError, 404);

    const { data: takimlar, error } = await adminSupabase
      .from("takimlar")
      .select("takim_id, firma_id, takim_adi, created_at")
      .eq("firma_id", firma_id)
      .order("takim_adi", { ascending: true });

    if (error) return hataYaniti("Takımlar çekilemedi.", "takimlar tablosu SELECT — firma_id filtresi", error);

    return NextResponse.json({ takimlar: takimlar ?? [] }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /admin/api/firmalar/[firma_id]/takimlar");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ firma_id: string }> }
) {
  try {
    const { firma_id } = await params;
    if (!firma_id) return validasyonHatasi("firma_id zorunludur.", ["firma_id"]);

    const adminSupabase = createAdminClient();

    const body = await request.json();
    const { takim_adi } = body;

    if (!takim_adi || takim_adi.trim() === "") {
      return validasyonHatasi("Takım adı zorunludur.", ["takim_adi"]);
    }

    const { data: firma, error: firmaError } = await adminSupabase
      .from("firmalar")
      .select("firma_id")
      .eq("firma_id", firma_id)
      .single();

    const firmaKontrol = veriKontrol(firma, "firmalar tablosu SELECT — firma_id kontrolü", "Firma bulunamadı.");
    if (!firmaKontrol.gecerli) return firmaKontrol.yanit;
    if (firmaError) return hataYaniti("Firma sorgulanırken hata oluştu.", "firmalar tablosu SELECT", firmaError, 404);

    const { data: mevcutTakim, error: kontrolError } = await adminSupabase
      .from("takimlar")
      .select("takim_id")
      .eq("firma_id", firma_id)
      .eq("takim_adi", takim_adi.trim())
      .single();

    if (kontrolError && kontrolError.code !== "PGRST116") {
      return hataYaniti("Takım adı kontrolü yapılamadı.", "takimlar tablosu SELECT — tekrar kontrolü", kontrolError);
    }
    if (mevcutTakim) return hataYaniti("Bu firmada aynı isimde takım zaten mevcut.", "takimlar tablosu — tekrar kontrolü", null, 422);

    const { data: yeniTakim, error: insertError } = await adminSupabase
      .from("takimlar")
      .insert({ firma_id, takim_adi: takim_adi.trim() })
      .select("takim_id, firma_id, takim_adi, created_at")
      .single();

    if (insertError) return hataYaniti("Takım eklenemedi.", "takimlar tablosu INSERT", insertError);

    const takimKontrol = veriKontrol(yeniTakim, "takimlar tablosu INSERT — dönen veri", "Takım eklendi ancak veri döndürülemedi.");
    if (!takimKontrol.gecerli) return takimKontrol.yanit;

    return NextResponse.json({ mesaj: "Takım eklendi.", takim: yeniTakim }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /admin/api/firmalar/[firma_id]/takimlar");
  }
}