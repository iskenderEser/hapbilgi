// app/admin/api/firmalar/[firma_id]/takimlar/[takim_id]/bolgeler/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ firma_id: string; takim_id: string }> }
) {
  try {
    const { firma_id, takim_id } = await params;
    if (!firma_id) return validasyonHatasi("firma_id zorunludur.", ["firma_id"]);
    if (!takim_id) return validasyonHatasi("takim_id zorunludur.", ["takim_id"]);

    const adminSupabase = createAdminClient();

    // Takım var mı ve bu firmaya mı ait kontrol et
    const { data: takim, error: takimError } = await adminSupabase
      .from("takimlar")
      .select("takim_id")
      .eq("takim_id", takim_id)
      .eq("firma_id", firma_id)
      .single();

    const takimKontrol = veriKontrol(takim, "takimlar tablosu SELECT — takim_id kontrolü", "Takım bulunamadı.");
    if (!takimKontrol.gecerli) return takimKontrol.yanit;
    if (takimError) return hataYaniti("Takım sorgulanırken hata oluştu.", "takimlar tablosu SELECT", takimError, 404);

    const { data: bolgeler, error } = await adminSupabase
      .from("bolgeler")
      .select("bolge_id, takim_id, bolge_adi, created_at")
      .eq("takim_id", takim_id)
      .order("bolge_adi", { ascending: true });

    if (error) return hataYaniti("Bölgeler çekilemedi.", "bolgeler tablosu SELECT — takim_id filtresi", error);

    return NextResponse.json({ bolgeler: bolgeler ?? [] }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /admin/api/firmalar/[firma_id]/takimlar/[takim_id]/bolgeler");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ firma_id: string; takim_id: string }> }
) {
  try {
    const { firma_id, takim_id } = await params;
    if (!firma_id) return validasyonHatasi("firma_id zorunludur.", ["firma_id"]);
    if (!takim_id) return validasyonHatasi("takim_id zorunludur.", ["takim_id"]);

    const adminSupabase = createAdminClient();

    const body = await request.json();
    const { bolge_adi } = body;

    if (!bolge_adi || bolge_adi.trim() === "") {
      return validasyonHatasi("Bölge adı zorunludur.", ["bolge_adi"]);
    }

    // Takım var mı ve bu firmaya mı ait kontrol et
    const { data: takim, error: takimError } = await adminSupabase
      .from("takimlar")
      .select("takim_id")
      .eq("takim_id", takim_id)
      .eq("firma_id", firma_id)
      .single();

    const takimKontrol = veriKontrol(takim, "takimlar tablosu SELECT — takim_id kontrolü", "Takım bulunamadı.");
    if (!takimKontrol.gecerli) return takimKontrol.yanit;
    if (takimError) return hataYaniti("Takım sorgulanırken hata oluştu.", "takimlar tablosu SELECT", takimError, 404);

    // Aynı takımda aynı isimde bölge var mı kontrol et
    const { data: mevcutBolge, error: kontrolError } = await adminSupabase
      .from("bolgeler")
      .select("bolge_id")
      .eq("takim_id", takim_id)
      .eq("bolge_adi", bolge_adi.trim())
      .single();

    if (kontrolError && kontrolError.code !== "PGRST116") {
      return hataYaniti("Bölge adı kontrolü yapılamadı.", "bolgeler tablosu SELECT — tekrar kontrolü", kontrolError);
    }
    if (mevcutBolge) return hataYaniti("Bu takımda aynı isimde bölge zaten mevcut.", "bolgeler tablosu — tekrar kontrolü", null, 422);

    const { data: yeniBolge, error: insertError } = await adminSupabase
      .from("bolgeler")
      .insert({ takim_id, bolge_adi: bolge_adi.trim() })
      .select("bolge_id, takim_id, bolge_adi, created_at")
      .single();

    if (insertError) return hataYaniti("Bölge eklenemedi.", "bolgeler tablosu INSERT", insertError);

    const bolgeKontrol = veriKontrol(yeniBolge, "bolgeler tablosu INSERT — dönen veri", "Bölge eklendi ancak veri döndürülemedi.");
    if (!bolgeKontrol.gecerli) return bolgeKontrol.yanit;

    return NextResponse.json({ mesaj: "Bölge eklendi.", bolge: yeniBolge }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /admin/api/firmalar/[firma_id]/takimlar/[takim_id]/bolgeler");
  }
}