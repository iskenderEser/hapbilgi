// app/admin/api/firmalar/[firma_id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";

const FIRMA_KOLONLARI = "firma_id, firma_adi, hbstore_aktif, aktif, son_export_at, created_at";

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
      .select(FIRMA_KOLONLARI)
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
      .select(FIRMA_KOLONLARI)
      .single();

    if (error) return hataYaniti("Firma güncellenemedi.", "firmalar tablosu UPDATE", error);

    const guncellenenKontrol = veriKontrol(guncellenen, "firmalar tablosu UPDATE — dönen veri", "Firma güncellendi ancak veri döndürülemedi.");
    if (!guncellenenKontrol.gecerli) return guncellenenKontrol.yanit;

    return NextResponse.json({ mesaj: "Firma güncellendi.", firma: guncellenen }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "PUT /admin/api/firmalar/[firma_id]");
  }
}

// PATCH — firmanın durum bayraklarını günceller.
// Body (en az biri): { hbstore_aktif?: boolean, aktif?: boolean }
//   - hbstore_aktif: HBStore mağazası açık/kapalı
//   - aktif: firma sisteme erişimi açık/kapalı (pasif → kullanıcılar giriş yapamaz)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ firma_id: string }> }
) {
  try {
    const { firma_id } = await params;
    if (!firma_id) return validasyonHatasi("firma_id zorunludur.", ["firma_id"]);

    const adminSupabase = createAdminClient();

    const body = await request.json();
    const { hbstore_aktif, aktif } = body;

    // Güncellenecek alanları topla (yalnızca gönderilenler)
    const guncelleme: Record<string, boolean> = {};
    if (typeof hbstore_aktif === "boolean") guncelleme.hbstore_aktif = hbstore_aktif;
    if (typeof aktif === "boolean") guncelleme.aktif = aktif;

    if (Object.keys(guncelleme).length === 0) {
      return validasyonHatasi(
        "Güncellenecek alan yok. hbstore_aktif veya aktif (true/false) gönderin.",
        ["hbstore_aktif", "aktif"]
      );
    }

    const { data: guncellenen, error } = await adminSupabase
      .from("firmalar")
      .update(guncelleme)
      .eq("firma_id", firma_id)
      .select(FIRMA_KOLONLARI)
      .single();

    if (error) return hataYaniti("Firma durumu güncellenemedi.", "firmalar tablosu UPDATE — durum", error);

    const guncellenenKontrol = veriKontrol(guncellenen, "firmalar tablosu UPDATE — dönen veri", "Durum güncellendi ancak veri döndürülemedi.");
    if (!guncellenenKontrol.gecerli) return guncellenenKontrol.yanit;

    // Uygun mesajı belirle
    let mesaj = "Firma durumu güncellendi.";
    if ("aktif" in guncelleme && !("hbstore_aktif" in guncelleme)) {
      mesaj = guncelleme.aktif ? "Firma aktifleştirildi." : "Firma pasifleştirildi.";
    } else if ("hbstore_aktif" in guncelleme && !("aktif" in guncelleme)) {
      mesaj = guncelleme.hbstore_aktif ? "Mağaza açıldı." : "Mağaza kapatıldı.";
    }

    return NextResponse.json({ mesaj, firma: guncellenen }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "PATCH /admin/api/firmalar/[firma_id]");
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

    // Export koşulu — yalnızca firma talep üretmişse uygulanır.
    // Mantık: korunacak iş verisi (talep ve ona bağlı üretim zinciri) varsa,
    // firma silinmeden önce verisi dışa aktarılmış olmalıdır. Hiç talep
    // üretmemiş (boş) firma için export şartı aranmaz; doğrudan silinebilir.
    const { count: talepSayisi, error: talepError } = await adminSupabase
      .from("talepler")
      .select("firma_id", { count: "exact", head: true })
      .eq("firma_id", firma_id);

    if (talepError) return hataYaniti("Talep kontrolü yapılamadı.", "talepler tablosu COUNT — firma_id kontrolü", talepError);

    if ((talepSayisi ?? 0) > 0) {
      // Firma talep üretmiş → export şartı geçerli.
      const { data: firma, error: firmaError } = await adminSupabase
        .from("firmalar")
        .select("son_export_at")
        .eq("firma_id", firma_id)
        .single();

      const firmaKontrol = veriKontrol(firma, "firmalar tablosu SELECT — silme öncesi", "Firma bulunamadı.");
      if (!firmaKontrol.gecerli) return firmaKontrol.yanit;
      if (firmaError) return hataYaniti("Firma sorgulanamadı.", "firmalar tablosu SELECT — silme öncesi", firmaError);

      if (!firma!.son_export_at) {
        return hataYaniti(
          "Bu firma talep üretmiş; verileri henüz dışa aktarılmamış. Silmeden önce firma verilerini dışa aktarın.",
          "firmalar tablosu DELETE — export koşulu",
          null,
          422
        );
      }
    }

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