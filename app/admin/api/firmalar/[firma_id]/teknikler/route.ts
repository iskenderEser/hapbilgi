// app/admin/api/firmalar/[firma_id]/teknikler/route.ts
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

    const { data: teknikler, error } = await adminSupabase
      .from("teknikler")
      .select("teknik_id, teknik_adi, created_at")
      .eq("firma_id", firma_id)
      .order("teknik_adi", { ascending: true });

    if (error) return hataYaniti("Teknikler çekilemedi.", "teknikler tablosu SELECT — firma_id filtresi", error);

    return NextResponse.json({ teknikler: teknikler ?? [] }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /admin/api/firmalar/[firma_id]/teknikler");
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
    const { teknik_adi } = body;

    if (!teknik_adi || teknik_adi.trim() === "") {
      return validasyonHatasi("Teknik adı zorunludur.", ["teknik_adi"]);
    }

    const { data: mevcut, error: kontrolError } = await adminSupabase
      .from("teknikler")
      .select("teknik_id")
      .eq("firma_id", firma_id)
      .eq("teknik_adi", teknik_adi.trim())
      .single();

    if (kontrolError && kontrolError.code !== "PGRST116") {
      return hataYaniti("Teknik adı kontrolü yapılamadı.", "teknikler tablosu SELECT — tekrar kontrolü", kontrolError);
    }
    if (mevcut) return hataYaniti("Bu firmada aynı isimde teknik zaten mevcut.", "teknikler tablosu — tekrar kontrolü", null, 422);

    const { data: yeniTeknik, error: insertError } = await adminSupabase
      .from("teknikler")
      .insert({ firma_id, teknik_adi: teknik_adi.trim() })
      .select("teknik_id, teknik_adi, created_at")
      .single();

    if (insertError) return hataYaniti("Teknik eklenemedi.", "teknikler tablosu INSERT", insertError);

    const kontrol = veriKontrol(yeniTeknik, "teknikler tablosu INSERT — dönen veri", "Teknik eklendi ancak veri döndürülemedi.");
    if (!kontrol.gecerli) return kontrol.yanit;

    return NextResponse.json({ mesaj: "Teknik eklendi.", teknik: yeniTeknik }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /admin/api/firmalar/[firma_id]/teknikler");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ firma_id: string }> }
) {
  try {
    const { firma_id } = await params;
    if (!firma_id) return validasyonHatasi("firma_id zorunludur.", ["firma_id"]);

    const adminSupabase = createAdminClient();
    const body = await request.json();
    const { teknik_id } = body;

    if (!teknik_id) return validasyonHatasi("teknik_id zorunludur.", ["teknik_id"]);

    const { data: teknik, error: kontrolError } = await adminSupabase
      .from("teknikler")
      .select("teknik_id")
      .eq("teknik_id", teknik_id)
      .eq("firma_id", firma_id)
      .single();

    if (kontrolError || !teknik) {
      return hataYaniti("Teknik bulunamadı.", "teknikler tablosu SELECT — teknik_id + firma_id kontrolü", kontrolError, 404);
    }

    const { error: deleteError } = await adminSupabase
      .from("teknikler")
      .delete()
      .eq("teknik_id", teknik_id);

    if (deleteError) return hataYaniti("Teknik silinemedi.", "teknikler tablosu DELETE", deleteError);

    return NextResponse.json({ mesaj: "Teknik silindi." }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "DELETE /admin/api/firmalar/[firma_id]/teknikler");
  }
}