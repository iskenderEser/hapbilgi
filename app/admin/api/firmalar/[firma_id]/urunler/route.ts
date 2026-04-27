// app/admin/api/firmalar/[firma_id]/urunler/route.ts
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

    const { searchParams } = new URL(request.url);
    const takim_id = searchParams.get("takim_id");

    const adminSupabase = createAdminClient();

    let query = adminSupabase
      .from("urunler")
      .select("urun_id, urun_adi, takim_id, created_at")
      .eq("firma_id", firma_id)
      .order("urun_adi", { ascending: true });

    if (takim_id) query = query.eq("takim_id", takim_id);

    const { data: urunler, error } = await query;

    if (error) return hataYaniti("Ürünler çekilemedi.", "urunler tablosu SELECT — firma_id filtresi", error);

    return NextResponse.json({ urunler: urunler ?? [] }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /admin/api/firmalar/[firma_id]/urunler");
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
    const { urun_adi, takim_id } = body;

    if (!urun_adi || urun_adi.trim() === "") {
      return validasyonHatasi("Ürün adı zorunludur.", ["urun_adi"]);
    }
    if (!takim_id) {
      return validasyonHatasi("takim_id zorunludur.", ["takim_id"]);
    }

    const { data: mevcut, error: kontrolError } = await adminSupabase
      .from("urunler")
      .select("urun_id")
      .eq("takim_id", takim_id)
      .eq("urun_adi", urun_adi.trim())
      .single();

    if (kontrolError && kontrolError.code !== "PGRST116") {
      return hataYaniti("Ürün adı kontrolü yapılamadı.", "urunler tablosu SELECT — tekrar kontrolü", kontrolError);
    }
    if (mevcut) return hataYaniti("Bu takımda aynı isimde ürün zaten mevcut.", "urunler tablosu — tekrar kontrolü", null, 422);

    const { data: yeniUrun, error: insertError } = await adminSupabase
      .from("urunler")
      .insert({ firma_id, takim_id, urun_adi: urun_adi.trim() })
      .select("urun_id, urun_adi, takim_id, created_at")
      .single();

    if (insertError) return hataYaniti("Ürün eklenemedi.", "urunler tablosu INSERT", insertError);

    const kontrol = veriKontrol(yeniUrun, "urunler tablosu INSERT — dönen veri", "Ürün eklendi ancak veri döndürülemedi.");
    if (!kontrol.gecerli) return kontrol.yanit;

    return NextResponse.json({ mesaj: "Ürün eklendi.", urun: yeniUrun }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /admin/api/firmalar/[firma_id]/urunler");
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
    const { urun_id } = body;

    if (!urun_id) return validasyonHatasi("urun_id zorunludur.", ["urun_id"]);

    const { data: urun, error: kontrolError } = await adminSupabase
      .from("urunler")
      .select("urun_id")
      .eq("urun_id", urun_id)
      .eq("firma_id", firma_id)
      .single();

    if (kontrolError || !urun) {
      return hataYaniti("Ürün bulunamadı.", "urunler tablosu SELECT — urun_id + firma_id kontrolü", kontrolError, 404);
    }

    const { error: deleteError } = await adminSupabase
      .from("urunler")
      .delete()
      .eq("urun_id", urun_id);

    if (deleteError) return hataYaniti("Ürün silinemedi.", "urunler tablosu DELETE", deleteError);

    return NextResponse.json({ mesaj: "Ürün silindi." }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "DELETE /admin/api/firmalar/[firma_id]/urunler");
  }
}