// app/admin/api/firmalar/[firma_id]/kullanicilar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { TUM_ROLLER } from "@/lib/utils/roller";
import { firmaYapisiYukle, kullaniciSatirDogrula, rolGecisiCoz } from "@/lib/admin/kullaniciDogrulama";

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

    // Tek join sorgusu ile takım ve bölge adlarını çek — N+1 giderildi
    const { data: kullanicilar, error } = await adminSupabase
      .from("kullanicilar")
      .select(`
        kullanici_id, ad, soyad, eposta, rol, firma_id,
        takim_id, bolge_id, aktif_mi,
        yetki_kullanici_yonetim, yetki_aktif_pasif, created_at,
        takimlar ( takim_adi ),
        bolgeler ( bolge_adi )
      `)
      .eq("firma_id", firma_id)
      .order("ad", { ascending: true });

    if (error) return hataYaniti("Kullanıcılar çekilemedi.", "kullanicilar tablosu SELECT — firma_id filtresi", error);

    const sonuc = (kullanicilar ?? []).map((k: any) => ({
      kullanici_id: k.kullanici_id,
      ad: k.ad,
      soyad: k.soyad,
      eposta: k.eposta,
      rol: k.rol,
      firma_id: k.firma_id,
      takim_id: k.takim_id,
      bolge_id: k.bolge_id,
      aktif_mi: k.aktif_mi,
      yetki_kullanici_yonetim: k.yetki_kullanici_yonetim,
      yetki_aktif_pasif: k.yetki_aktif_pasif,
      created_at: k.created_at,
      takim_adi: k.takimlar?.takim_adi ?? null,
      bolge_adi: k.bolgeler?.bolge_adi ?? null,
    }));

    return NextResponse.json({ kullanicilar: sonuc }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /admin/api/firmalar/[firma_id]/kullanicilar");
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

    const { data: firma, error: firmaError } = await adminSupabase
      .from("firmalar")
      .select("firma_id")
      .eq("firma_id", firma_id)
      .single();

    const firmaKontrol = veriKontrol(firma, "firmalar tablosu SELECT — firma_id kontrolü", "Firma bulunamadı.");
    if (!firmaKontrol.gecerli) return firmaKontrol.yanit;
    if (firmaError) return hataYaniti("Firma sorgulanırken hata oluştu.", "firmalar tablosu SELECT", firmaError, 404);

    const body = await request.json();
    const { yetki_kullanici_yonetim, yetki_aktif_pasif } = body;

    // Doğrulama kural kitabı TEK KAYNAK: lib/admin/kullaniciDogrulama (B-18/B-21).
    // Bölge çözümü firma kapsamına kilitli (B-22).
    const yapiSonuc = await firmaYapisiYukle(adminSupabase, firma_id);
    if (!yapiSonuc.ok) return hataYaniti(yapiSonuc.hata, "firmaYapisiYukle — kullanıcı ekleme", null);

    const dogrulama = kullaniciSatirDogrula(yapiSonuc.yapi, body);
    if (!dogrulama.ok) return validasyonHatasi(dogrulama.hata, dogrulama.alanlar);
    const kayit = dogrulama.kayit;

    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: kayit.eposta,
      password: kayit.sifre,
      user_metadata: { rol: kayit.rol, ad: kayit.ad, soyad: kayit.soyad },
      email_confirm: true,
    });

    if (authError || !authData.user) return hataYaniti("Kullanıcı Auth'a kaydedilemedi.", "auth.admin.createUser", authError);

    const { error: insertError } = await adminSupabase
      .from("kullanicilar")
      .insert({
        kullanici_id: authData.user.id,
        ad: kayit.ad,
        soyad: kayit.soyad,
        eposta: kayit.eposta,
        rol: kayit.rol,
        firma_id,
        takim_id: kayit.takim_id,
        bolge_id: kayit.bolge_id,
        aktif_mi: true,
        yetki_kullanici_yonetim: yetki_kullanici_yonetim === true,
        yetki_aktif_pasif: yetki_aktif_pasif === true,
      });

    if (insertError) {
      await adminSupabase.auth.admin.deleteUser(authData.user.id);
      return hataYaniti("Kullanıcı veritabanına kaydedilemedi.", "kullanicilar tablosu INSERT", insertError);
    }

    return NextResponse.json({ mesaj: "Kullanıcı başarıyla eklendi." }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /admin/api/firmalar/[firma_id]/kullanicilar");
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
    const { kullanici_id, rol, aktif_mi, yetki_kullanici_yonetim, yetki_aktif_pasif } = body;

    if (!kullanici_id) return validasyonHatasi("kullanici_id zorunludur.", ["kullanici_id"]);
    if (rol === undefined && aktif_mi === undefined && yetki_kullanici_yonetim === undefined && yetki_aktif_pasif === undefined)
      return validasyonHatasi("Güncellenecek alan zorunludur.", ["rol", "aktif_mi", "yetki_kullanici_yonetim", "yetki_aktif_pasif"]);

    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, rol, takim_id, bolge_id")
      .eq("kullanici_id", kullanici_id)
      .eq("firma_id", firma_id)
      .single();

    const kullaniciKontrol = veriKontrol(kullanici, "kullanicilar tablosu SELECT — kullanici_id kontrolü", "Kullanıcı bulunamadı.");
    if (!kullaniciKontrol.gecerli) return kullaniciKontrol.yanit;
    if (kullaniciError) return hataYaniti("Kullanıcı sorgulanırken hata oluştu.", "kullanicilar tablosu SELECT", kullaniciError, 404);

    const guncellenecek: Record<string, unknown> = {};

    if (rol !== undefined) {
      // B-23: rol tipi doğrulanır; rol değişiminde takım/bölge tutarlılığı
      // yeni rolün kurallarıyla (tek kaynak: lib/admin/kullaniciDogrulama) çözülür.
      if (typeof rol !== "string") return validasyonHatasi("Geçersiz rol.", ["rol"]);
      const rolTemiz = rol.trim().toLowerCase();
      if (!TUM_ROLLER.includes(rolTemiz)) return validasyonHatasi("Geçersiz rol.", ["rol"]);

      const yapiSonuc = await firmaYapisiYukle(adminSupabase, firma_id);
      if (!yapiSonuc.ok) return hataYaniti(yapiSonuc.hata, "firmaYapisiYukle — rol geçişi", null);

      const gecis = rolGecisiCoz(yapiSonuc.yapi, rolTemiz, {
        mevcut_takim_id: kullanici!.takim_id ?? null,
        mevcut_bolge_id: kullanici!.bolge_id ?? null,
        takim_id: body.takim_id,
        takim_adi: body.takim_adi,
        bolge_id: body.bolge_id,
        bolge_adi: body.bolge_adi,
      });
      if (!gecis.ok) return validasyonHatasi(gecis.hata, gecis.alanlar);

      guncellenecek.rol = rolTemiz;
      guncellenecek.takim_id = gecis.takim_id;
      guncellenecek.bolge_id = gecis.bolge_id;
    }

    if (aktif_mi !== undefined) guncellenecek.aktif_mi = aktif_mi;
    if (yetki_kullanici_yonetim !== undefined) guncellenecek.yetki_kullanici_yonetim = yetki_kullanici_yonetim;
    if (yetki_aktif_pasif !== undefined) guncellenecek.yetki_aktif_pasif = yetki_aktif_pasif;

    const { error: updateError } = await adminSupabase
      .from("kullanicilar")
      .update(guncellenecek)
      .eq("kullanici_id", kullanici_id)
      .eq("firma_id", firma_id);

    if (updateError) return hataYaniti("Kullanıcı güncellenemedi.", "kullanicilar tablosu UPDATE", updateError);

    return NextResponse.json({ mesaj: "Kullanıcı başarıyla güncellendi." }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "PUT /admin/api/firmalar/[firma_id]/kullanicilar");
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
    const { kullanici_id } = body;

    if (!kullanici_id) return validasyonHatasi("kullanici_id zorunludur.", ["kullanici_id"]);

    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, ad, soyad, eposta, rol, firma_id, takim_id, bolge_id")
      .eq("kullanici_id", kullanici_id)
      .eq("firma_id", firma_id)
      .single();

    const kullaniciKontrol = veriKontrol(kullanici, "kullanicilar tablosu SELECT — silme öncesi kontrol", "Kullanıcı bulunamadı.");
    if (!kullaniciKontrol.gecerli) return kullaniciKontrol.yanit;
    if (kullaniciError) return hataYaniti("Kullanıcı sorgulanırken hata oluştu.", "kullanicilar tablosu SELECT", kullaniciError, 404);

    // Arşivle
    const { error: arsivError } = await adminSupabase
      .from("silinmis_kullanicilar")
      .insert({
        kullanici_id: kullanici.kullanici_id,
        ad: kullanici.ad,
        soyad: kullanici.soyad,
        eposta: kullanici.eposta,
        rol: kullanici.rol,
        firma_id: kullanici.firma_id,
        takim_id: kullanici.takim_id,
        bolge_id: kullanici.bolge_id,
        silinme_tarihi: new Date().toISOString(),
      });

    if (arsivError) return hataYaniti("Kullanıcı arşivlenemedi, silme iptal edildi.", "silinmis_kullanicilar tablosu INSERT", arsivError);

    // Önce Auth'tan sil — başarısız olursa DB'ye dokunma
    const { error: authError } = await adminSupabase.auth.admin.deleteUser(kullanici_id);
    if (authError) return hataYaniti("Kullanıcı Auth'tan silinemedi, işlem iptal edildi.", "auth.admin.deleteUser", authError);

    // Auth başarılıysa DB'den sil
    const { error: deleteError } = await adminSupabase
      .from("kullanicilar")
      .delete()
      .eq("kullanici_id", kullanici_id)
      .eq("firma_id", firma_id);

    if (deleteError) return hataYaniti("Kullanıcı tablodan silinemedi.", "kullanicilar tablosu DELETE", deleteError);

    return NextResponse.json({ mesaj: "Kullanıcı başarıyla silindi." }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "DELETE /admin/api/firmalar/[firma_id]/kullanicilar");
  }
}