// app/admin/api/firmalar/[firma_id]/route.ts
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

    const { data: firma, error } = await adminSupabase
      .from("firmalar")
      .select("firma_id, firma_adi, created_at")
      .eq("firma_id", firma_id)
      .single();

    const firmaKontrol = veriKontrol(firma, "firmalar tablosu SELECT — firma_id kontrolü", "Firma bulunamadı.");
    if (!firmaKontrol.gecerli) return firmaKontrol.yanit;
    if (error) return hataYaniti("Firma sorgulanırken hata oluştu.", "firmalar tablosu SELECT", error, 404);

    return NextResponse.json({ firma }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /admin/api/firmalar/[firma_id]");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ firma_id: string }> }
) {
  try {
    const { firma_id } = await params;
    if (!firma_id) return validasyonHatasi("firma_id zorunludur.", ["firma_id"]);

    const adminSupabase = createAdminClient();

    const body = await request.json();
    const { firma_adi } = body;

    if (!firma_adi || firma_adi.trim() === "") {
      return validasyonHatasi("Firma adı zorunludur.", ["firma_adi"]);
    }

    const { data: guncellenen, error } = await adminSupabase
      .from("firmalar")
      .update({ firma_adi: firma_adi.trim() })
      .eq("firma_id", firma_id)
      .select("firma_id, firma_adi, created_at")
      .single();

    if (error) return hataYaniti("Firma güncellenemedi.", "firmalar tablosu UPDATE", error);

    const guncellenenKontrol = veriKontrol(guncellenen, "firmalar tablosu UPDATE — dönen veri", "Firma güncellendi ancak veri döndürülemedi.");
    if (!guncellenenKontrol.gecerli) return guncellenenKontrol.yanit;

    return NextResponse.json({ mesaj: "Firma güncellendi.", firma: guncellenen }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "PUT /admin/api/firmalar/[firma_id]");
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

    // Firmaya bağlı takım var mı kontrol et
    const { count: takimSayisi, error: takimError } = await adminSupabase
      .from("takimlar")
      .select("takim_id", { count: "exact", head: true })
      .eq("firma_id", firma_id);

    if (takimError) return hataYaniti("Takım kontrolü yapılamadı.", "takimlar tablosu COUNT — firma_id kontrolü", takimError);
    if ((takimSayisi ?? 0) > 0) return hataYaniti(`Bu firmaya bağlı ${takimSayisi} takım var. Önce takımları silin.`, "firmalar tablosu DELETE — bağlı takım kontrolü", null, 422);

    // Firmaya bağlı kullanıcı var mı kontrol et
    const { count: kullaniciSayisi, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id", { count: "exact", head: true })
      .eq("firma_id", firma_id);

    if (kullaniciError) return hataYaniti("Kullanıcı kontrolü yapılamadı.", "kullanicilar tablosu COUNT — firma_id kontrolü", kullaniciError);
    if ((kullaniciSayisi ?? 0) > 0) return hataYaniti(`Bu firmaya bağlı ${kullaniciSayisi} kullanıcı var. Önce kullanıcıları kaldırın.`, "firmalar tablosu DELETE — bağlı kullanıcı kontrolü", null, 422);

    const { error: deleteError } = await adminSupabase
      .from("firmalar")
      .delete()
      .eq("firma_id", firma_id);

    if (deleteError) return hataYaniti("Firma silinemedi.", "firmalar tablosu DELETE", deleteError);

    return NextResponse.json({ mesaj: "Firma silindi." }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "DELETE /admin/api/firmalar/[firma_id]");
  }
}