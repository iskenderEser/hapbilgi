// app/admin/api/firmalar/[firma_id]/takimlar/[takim_id]/bolgeler/[bolge_id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ firma_id: string; takim_id: string; bolge_id: string }> }
) {
  try {
    const { firma_id, takim_id, bolge_id } = await params;
    if (!firma_id) return validasyonHatasi("firma_id zorunludur.", ["firma_id"]);
    if (!takim_id) return validasyonHatasi("takim_id zorunludur.", ["takim_id"]);
    if (!bolge_id) return validasyonHatasi("bolge_id zorunludur.", ["bolge_id"]);

    const adminSupabase = createAdminClient();

    const { data: bolge, error } = await adminSupabase
      .from("bolgeler")
      .select("bolge_id, takim_id, bolge_adi, created_at")
      .eq("bolge_id", bolge_id)
      .eq("takim_id", takim_id)
      .single();

    const bolgeKontrol = veriKontrol(bolge, "bolgeler tablosu SELECT — bolge_id kontrolü", "Bölge bulunamadı.");
    if (!bolgeKontrol.gecerli) return bolgeKontrol.yanit;
    if (error) return hataYaniti("Bölge sorgulanırken hata oluştu.", "bolgeler tablosu SELECT", error, 404);

    return NextResponse.json({ bolge }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /admin/api/firmalar/[firma_id]/takimlar/[takim_id]/bolgeler/[bolge_id]");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ firma_id: string; takim_id: string; bolge_id: string }> }
) {
  try {
    const { firma_id, takim_id, bolge_id } = await params;
    if (!firma_id) return validasyonHatasi("firma_id zorunludur.", ["firma_id"]);
    if (!takim_id) return validasyonHatasi("takim_id zorunludur.", ["takim_id"]);
    if (!bolge_id) return validasyonHatasi("bolge_id zorunludur.", ["bolge_id"]);

    const adminSupabase = createAdminClient();

    const body = await request.json();
    const { bolge_adi } = body;

    if (!bolge_adi || bolge_adi.trim() === "") {
      return validasyonHatasi("Bölge adı zorunludur.", ["bolge_adi"]);
    }

    // Aynı takımda aynı isimde başka bölge var mı kontrol et
    const { data: mevcutBolge, error: kontrolError } = await adminSupabase
      .from("bolgeler")
      .select("bolge_id")
      .eq("takim_id", takim_id)
      .eq("bolge_adi", bolge_adi.trim())
      .neq("bolge_id", bolge_id)
      .single();

    if (kontrolError && kontrolError.code !== "PGRST116") {
      return hataYaniti("Bölge adı kontrolü yapılamadı.", "bolgeler tablosu SELECT — tekrar kontrolü", kontrolError);
    }
    if (mevcutBolge) return hataYaniti("Bu takımda aynı isimde bölge zaten mevcut.", "bolgeler tablosu — tekrar kontrolü", null, 422);

    const { data: guncellenen, error } = await adminSupabase
      .from("bolgeler")
      .update({ bolge_adi: bolge_adi.trim() })
      .eq("bolge_id", bolge_id)
      .eq("takim_id", takim_id)
      .select("bolge_id, takim_id, bolge_adi, created_at")
      .single();

    if (error) return hataYaniti("Bölge güncellenemedi.", "bolgeler tablosu UPDATE", error);

    const guncellenenKontrol = veriKontrol(guncellenen, "bolgeler tablosu UPDATE — dönen veri", "Bölge güncellendi ancak veri döndürülemedi.");
    if (!guncellenenKontrol.gecerli) return guncellenenKontrol.yanit;

    return NextResponse.json({ mesaj: "Bölge güncellendi.", bolge: guncellenen }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "PUT /admin/api/firmalar/[firma_id]/takimlar/[takim_id]/bolgeler/[bolge_id]");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ firma_id: string; takim_id: string; bolge_id: string }> }
) {
  try {
    const { firma_id, takim_id, bolge_id } = await params;
    if (!firma_id) return validasyonHatasi("firma_id zorunludur.", ["firma_id"]);
    if (!takim_id) return validasyonHatasi("takim_id zorunludur.", ["takim_id"]);
    if (!bolge_id) return validasyonHatasi("bolge_id zorunludur.", ["bolge_id"]);

    const adminSupabase = createAdminClient();

    // Bölgeye bağlı kullanıcı var mı kontrol et
    const { count: kullaniciSayisi, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id", { count: "exact", head: true })
      .eq("bolge_id", bolge_id);

    if (kullaniciError) return hataYaniti("Kullanıcı kontrolü yapılamadı.", "kullanicilar tablosu COUNT — bolge_id kontrolü", kullaniciError);
    if ((kullaniciSayisi ?? 0) > 0) return hataYaniti(`Bu bölgeye bağlı ${kullaniciSayisi} kullanıcı var. Önce kullanıcıları kaldırın.`, "bolgeler tablosu DELETE — bağlı kullanıcı kontrolü", null, 422);

    const { error: deleteError } = await adminSupabase
      .from("bolgeler")
      .delete()
      .eq("bolge_id", bolge_id)
      .eq("takim_id", takim_id);

    if (deleteError) return hataYaniti("Bölge silinemedi.", "bolgeler tablosu DELETE", deleteError);

    return NextResponse.json({ mesaj: "Bölge silindi." }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "DELETE /admin/api/firmalar/[firma_id]/takimlar/[takim_id]/bolgeler/[bolge_id]");
  }
}