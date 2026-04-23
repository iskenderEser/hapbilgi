// app/kullanicilar/api/[kullanici_id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ kullanici_id: string }> }
) {
  try {
    const { kullanici_id } = await params;
    if (!kullanici_id) return validasyonHatasi("kullanici_id zorunludur.", ["kullanici_id"]);

    const adminSupabase = createAdminClient();

    // v_kullanici_detay view'ından tek sorguda çek
    const { data: kullanici, error } = await adminSupabase
      .from("v_kullanici_detay")
      .select("kullanici_id, ad, soyad, eposta, rol, firma_id, firma_adi, takim_id, takim_adi, bolge_id, bolge_adi, aktif_mi, created_at")
      .eq("kullanici_id", kullanici_id)
      .single();

    const kullaniciKontrol = veriKontrol(kullanici, "v_kullanici_detay view SELECT — kullanici_id kontrolü", "Kullanıcı bulunamadı.");
    if (!kullaniciKontrol.gecerli) return kullaniciKontrol.yanit;
    if (error) return hataYaniti("Kullanıcı sorgulanırken hata oluştu.", "v_kullanici_detay view SELECT", error, 404);

    return NextResponse.json({ kullanici }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /kullanicilar/api/[kullanici_id]");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ kullanici_id: string }> }
) {
  try {
    const { kullanici_id } = await params;
    if (!kullanici_id) return validasyonHatasi("kullanici_id zorunludur.", ["kullanici_id"]);

    const adminSupabase = createAdminClient();

    const body = await request.json();
    const { ad, soyad, kullanici_rol, firma_id, takim_id, bolge_id, aktif_mi } = body;

    const guncellenecek: any = {};
    if (ad) guncellenecek.ad = ad.trim();
    if (soyad) guncellenecek.soyad = soyad.trim();
    if (kullanici_rol) guncellenecek.rol = kullanici_rol;
    if (firma_id) guncellenecek.firma_id = firma_id;
    if (takim_id !== undefined) guncellenecek.takim_id = takim_id;
    if (bolge_id !== undefined) guncellenecek.bolge_id = bolge_id;
    if (aktif_mi !== undefined) guncellenecek.aktif_mi = aktif_mi;

    if (Object.keys(guncellenecek).length === 0) {
      return validasyonHatasi("Güncellenecek en az bir alan belirtilmelidir.", []);
    }

    const { data: guncellenen, error: updateError } = await adminSupabase
      .from("kullanicilar")
      .update(guncellenecek)
      .eq("kullanici_id", kullanici_id)
      .select("kullanici_id, ad, soyad, eposta, rol, aktif_mi")
      .single();

    if (updateError) return hataYaniti("Kullanıcı güncellenemedi.", "kullanicilar tablosu UPDATE", updateError);

    const guncellenenKontrol = veriKontrol(guncellenen, "kullanicilar tablosu UPDATE — dönen veri", "Kullanıcı güncellendi ancak veri döndürülemedi.");
    if (!guncellenenKontrol.gecerli) return guncellenenKontrol.yanit;

    if (ad || soyad || kullanici_rol) {
      const { error: authUpdateError } = await adminSupabase.auth.admin.updateUserById(kullanici_id, {
        user_metadata: {
          rol: kullanici_rol ?? guncellenen.rol,
          ad: ad ?? guncellenen.ad,
          soyad: soyad ?? guncellenen.soyad,
        }
      });
      if (authUpdateError) {
        console.error("[UYARI] Auth metadata güncellenemedi:", { kullanici_id, hata: authUpdateError.message });
      }
    }

    return NextResponse.json({ mesaj: "Kullanıcı güncellendi.", kullanici: guncellenen }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "PUT /kullanicilar/api/[kullanici_id]");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ kullanici_id: string }> }
) {
  try {
    const { kullanici_id } = await params;
    if (!kullanici_id) return validasyonHatasi("kullanici_id zorunludur.", ["kullanici_id"]);

    const adminSupabase = createAdminClient();

    const { data: kullanici, error: getError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, aktif_mi")
      .eq("kullanici_id", kullanici_id)
      .single();

    const kullaniciKontrol = veriKontrol(kullanici, "kullanicilar tablosu SELECT — kullanici_id kontrolü", "Kullanıcı bulunamadı.");
    if (!kullaniciKontrol.gecerli) return kullaniciKontrol.yanit;
    if (getError) return hataYaniti("Kullanıcı sorgulanırken hata oluştu.", "kullanicilar tablosu SELECT", getError, 404);
    if (!kullanici.aktif_mi) return isKuraluHatasi("Bu kullanıcı zaten pasif durumda.");

    const { error: updateError } = await adminSupabase
      .from("kullanicilar")
      .update({ aktif_mi: false })
      .eq("kullanici_id", kullanici_id);

    if (updateError) return hataYaniti("Kullanıcı pasif yapılamadı.", "kullanicilar tablosu UPDATE — aktif_mi false", updateError);

    return NextResponse.json({ mesaj: "Kullanıcı pasif yapıldı." }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "DELETE /kullanicilar/api/[kullanici_id]");
  }
}