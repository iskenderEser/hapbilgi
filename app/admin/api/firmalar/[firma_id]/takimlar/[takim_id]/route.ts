// app/admin/api/firmalar/[firma_id]/takimlar/[takim_id]/route.ts
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

    const { data: takim, error } = await adminSupabase
      .from("takimlar")
      .select("takim_id, firma_id, takim_adi, created_at")
      .eq("takim_id", takim_id)
      .eq("firma_id", firma_id)
      .single();

    const takimKontrol = veriKontrol(takim, "takimlar tablosu SELECT — takim_id kontrolü", "Takım bulunamadı.");
    if (!takimKontrol.gecerli) return takimKontrol.yanit;
    if (error) return hataYaniti("Takım sorgulanırken hata oluştu.", "takimlar tablosu SELECT", error, 404);

    return NextResponse.json({ takim }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /admin/api/firmalar/[firma_id]/takimlar/[takim_id]");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ firma_id: string; takim_id: string }> }
) {
  try {
    const { firma_id, takim_id } = await params;
    if (!firma_id) return validasyonHatasi("firma_id zorunludur.", ["firma_id"]);
    if (!takim_id) return validasyonHatasi("takim_id zorunludur.", ["takim_id"]);

    const adminSupabase = createAdminClient();

    const body = await request.json();
    const { takim_adi } = body;

    if (!takim_adi || takim_adi.trim() === "") {
      return validasyonHatasi("Takım adı zorunludur.", ["takim_adi"]);
    }

    const { data: mevcutTakim, error: kontrolError } = await adminSupabase
      .from("takimlar")
      .select("takim_id")
      .eq("firma_id", firma_id)
      .eq("takim_adi", takim_adi.trim())
      .neq("takim_id", takim_id)
      .single();

    if (kontrolError && kontrolError.code !== "PGRST116") {
      return hataYaniti("Takım adı kontrolü yapılamadı.", "takimlar tablosu SELECT — tekrar kontrolü", kontrolError);
    }
    if (mevcutTakim) return hataYaniti("Bu firmada aynı isimde takım zaten mevcut.", "takimlar tablosu — tekrar kontrolü", null, 422);

    const { data: guncellenen, error } = await adminSupabase
      .from("takimlar")
      .update({ takim_adi: takim_adi.trim() })
      .eq("takim_id", takim_id)
      .eq("firma_id", firma_id)
      .select("takim_id, firma_id, takim_adi, created_at")
      .single();

    if (error) return hataYaniti("Takım güncellenemedi.", "takimlar tablosu UPDATE", error);

    const guncellenenKontrol = veriKontrol(guncellenen, "takimlar tablosu UPDATE — dönen veri", "Takım güncellendi ancak veri döndürülemedi.");
    if (!guncellenenKontrol.gecerli) return guncellenenKontrol.yanit;

    return NextResponse.json({ mesaj: "Takım güncellendi.", takim: guncellenen }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "PUT /admin/api/firmalar/[firma_id]/takimlar/[takim_id]");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ firma_id: string; takim_id: string }> }
) {
  try {
    const { firma_id, takim_id } = await params;
    if (!firma_id) return validasyonHatasi("firma_id zorunludur.", ["firma_id"]);
    if (!takim_id) return validasyonHatasi("takim_id zorunludur.", ["takim_id"]);

    const adminSupabase = createAdminClient();

    const { count: bolgeSayisi, error: bolgeError } = await adminSupabase
      .from("bolgeler")
      .select("bolge_id", { count: "exact", head: true })
      .eq("takim_id", takim_id);

    if (bolgeError) return hataYaniti("Bölge kontrolü yapılamadı.", "bolgeler tablosu COUNT — takim_id kontrolü", bolgeError);
    if ((bolgeSayisi ?? 0) > 0) return hataYaniti(`Bu takıma bağlı ${bolgeSayisi} bölge var. Önce bölgeleri silin.`, "takimlar tablosu DELETE — bağlı bölge kontrolü", null, 422);

    const { count: kullaniciSayisi, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id", { count: "exact", head: true })
      .eq("takim_id", takim_id);

    if (kullaniciError) return hataYaniti("Kullanıcı kontrolü yapılamadı.", "kullanicilar tablosu COUNT — takim_id kontrolü", kullaniciError);
    if ((kullaniciSayisi ?? 0) > 0) return hataYaniti(`Bu takıma bağlı ${kullaniciSayisi} kullanıcı var. Önce kullanıcıları kaldırın.`, "takimlar tablosu DELETE — bağlı kullanıcı kontrolü", null, 422);

    const { error: deleteError } = await adminSupabase
      .from("takimlar")
      .delete()
      .eq("takim_id", takim_id)
      .eq("firma_id", firma_id);

    if (deleteError) return hataYaniti("Takım silinemedi.", "takimlar tablosu DELETE", deleteError);

    return NextResponse.json({ mesaj: "Takım silindi." }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "DELETE /admin/api/firmalar/[firma_id]/takimlar/[takim_id]");
  }
}