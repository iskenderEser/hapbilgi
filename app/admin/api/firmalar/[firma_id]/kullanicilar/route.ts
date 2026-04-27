// app/admin/api/firmalar/[firma_id]/kullanicilar/route.ts
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

    const { data: kullanicilar, error } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, ad, soyad, eposta, rol, firma_id, takim_id, bolge_id, aktif_mi, yetki_kullanici_yonetim, yetki_aktif_pasif, created_at")
      .eq("firma_id", firma_id)
      .order("ad", { ascending: true });

    if (error) return hataYaniti("Kullanıcılar çekilemedi.", "kullanicilar tablosu SELECT — firma_id filtresi", error);

    const sonuc = await Promise.all(
      (kullanicilar ?? []).map(async (k) => {
        let takim_adi = null;
        let bolge_adi = null;

        if (k.takim_id) {
          const { data: takim, error: takimError } = await adminSupabase
            .from("takimlar")
            .select("takim_adi")
            .eq("takim_id", k.takim_id)
            .single();
          if (takimError) console.error("[UYARI] Takım adı çekilemedi:", { takim_id: k.takim_id, hata: takimError.message });
          takim_adi = takim?.takim_adi ?? null;
        }

        if (k.bolge_id) {
          const { data: bolge, error: bolgeError } = await adminSupabase
            .from("bolgeler")
            .select("bolge_adi")
            .eq("bolge_id", k.bolge_id)
            .single();
          if (bolgeError) console.error("[UYARI] Bölge adı çekilemedi:", { bolge_id: k.bolge_id, hata: bolgeError.message });
          bolge_adi = bolge?.bolge_adi ?? null;
        }

        return { ...k, takim_adi, bolge_adi };
      })
    );

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
    const { ad, soyad, eposta, sifre, rol, takim_adi, bolge_adi, takim_id: bodyTakimId, bolge_id: bodyBolgeId, yetki_kullanici_yonetim, yetki_aktif_pasif } = body;

    if (!ad || typeof ad !== "string" || ad.trim().length === 0) return validasyonHatasi("Ad zorunludur.", ["ad"]);
    if (!soyad || typeof soyad !== "string" || soyad.trim().length === 0) return validasyonHatasi("Soyad zorunludur.", ["soyad"]);
    if (!eposta || typeof eposta !== "string" || !eposta.includes("@")) return validasyonHatasi("Geçerli bir e-posta adresi giriniz.", ["eposta"]);
    if (!sifre || typeof sifre !== "string" || sifre.trim().length === 0) return validasyonHatasi("Şifre zorunludur.", ["sifre"]);
    if (!rol || typeof rol !== "string" || rol.trim().length === 0) return validasyonHatasi("Rol zorunludur.", ["rol"]);

    if (ad.length > 200) return validasyonHatasi("Ad 200 karakterden uzun olamaz.", ["ad"]);
    if (soyad.length > 200) return validasyonHatasi("Soyad 200 karakterden uzun olamaz.", ["soyad"]);
    if (eposta.length > 200) return validasyonHatasi("E-posta 200 karakterden uzun olamaz.", ["eposta"]);
    if (sifre.length > 200) return validasyonHatasi("Şifre 200 karakterden uzun olamaz.", ["sifre"]);

    const gecerliRoller = ["pm", "jr_pm", "kd_pm", "iu", "tm", "bm", "utt", "kd_utt", "gm", "gm_yrd", "drk", "paz_md", "blm_md", "med_md", "grp_pm", "sm", "egt_md", "egt_yrd_md", "egt_yon", "egt_uz"];
    const rolTemiz = rol.trim().toLowerCase();
    if (!gecerliRoller.includes(rolTemiz)) return validasyonHatasi("Geçersiz rol.", ["rol"]);

    const adTemiz = ad.trim();
    const soyadTemiz = soyad.trim();
    const epostaTemiz = eposta.trim().toLowerCase();
    const sifreTemiz = sifre.trim();

    let takim_id: string | null = null;
    let bolge_id: string | null = null;

    if (["pm", "jr_pm", "kd_pm", "tm"].includes(rolTemiz)) {
      if (bodyTakimId) {
        const { data: takim, error: takimError } = await adminSupabase
          .from("takimlar")
          .select("takim_id")
          .eq("takim_id", bodyTakimId)
          .eq("firma_id", firma_id)
          .single();
        if (takimError || !takim) return hataYaniti("Takım bulunamadı.", "takimlar tablosu SELECT — takim_id kontrolü", takimError, 404);
        takim_id = takim.takim_id;
      } else if (takim_adi) {
        const takimAdiTemiz = String(takim_adi).trim();
        if (!takimAdiTemiz) return validasyonHatasi(`${rolTemiz} rolü için takım adı zorunludur.`, ["takim_adi"]);
        const { data: takim, error: takimError } = await adminSupabase
          .from("takimlar")
          .select("takim_id")
          .eq("firma_id", firma_id)
          .ilike("takim_adi", takimAdiTemiz)
          .single();
        if (takimError || !takim) return hataYaniti(`"${takimAdiTemiz}" adında takım bulunamadı.`, "takimlar tablosu SELECT — takim_adi kontrolü", takimError, 404);
        takim_id = takim.takim_id;
      } else {
        return validasyonHatasi(`${rolTemiz} rolü için takım zorunludur.`, ["takim_adi"]);
      }
    } else if (["bm", "utt", "kd_utt"].includes(rolTemiz)) {
      if (bodyBolgeId) {
        const { data: bolge, error: bolgeError } = await adminSupabase
          .from("bolgeler")
          .select("bolge_id, takim_id")
          .eq("bolge_id", bodyBolgeId)
          .single();
        if (bolgeError || !bolge) return hataYaniti("Bölge bulunamadı.", "bolgeler tablosu SELECT — bolge_id kontrolü", bolgeError, 404);
        bolge_id = bolge.bolge_id;
        takim_id = bolge.takim_id;
      } else if (bolge_adi) {
        const bolgeAdiTemiz = String(bolge_adi).trim();
        if (!bolgeAdiTemiz) return validasyonHatasi(`${rolTemiz} rolü için bölge adı zorunludur.`, ["bolge_adi"]);
        const { data: bolge, error: bolgeError } = await adminSupabase
          .from("bolgeler")
          .select("bolge_id, takim_id")
          .ilike("bolge_adi", bolgeAdiTemiz)
          .single();
        if (bolgeError || !bolge) return hataYaniti(`"${bolgeAdiTemiz}" adında bölge bulunamadı.`, "bolgeler tablosu SELECT — bolge_adi kontrolü", bolgeError, 404);
        bolge_id = bolge.bolge_id;
        takim_id = bolge.takim_id;
      } else {
        return validasyonHatasi(`${rolTemiz} rolü için bölge zorunludur.`, ["bolge_adi"]);
      }
    }

    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: epostaTemiz,
      password: sifreTemiz,
      user_metadata: { rol: rolTemiz, ad: adTemiz, soyad: soyadTemiz },
      email_confirm: true,
    });

    if (authError || !authData.user) return hataYaniti("Kullanıcı Auth'a kaydedilemedi.", "auth.admin.createUser", authError);

    const { error: insertError } = await adminSupabase
      .from("kullanicilar")
      .insert({
        kullanici_id: authData.user.id,
        ad: adTemiz,
        soyad: soyadTemiz,
        eposta: epostaTemiz,
        rol: rolTemiz,
        firma_id,
        takim_id,
        bolge_id,
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
      .select("kullanici_id")
      .eq("kullanici_id", kullanici_id)
      .eq("firma_id", firma_id)
      .single();

    const kullaniciKontrol = veriKontrol(kullanici, "kullanicilar tablosu SELECT — kullanici_id kontrolü", "Kullanıcı bulunamadı.");
    if (!kullaniciKontrol.gecerli) return kullaniciKontrol.yanit;
    if (kullaniciError) return hataYaniti("Kullanıcı sorgulanırken hata oluştu.", "kullanicilar tablosu SELECT", kullaniciError, 404);

    if (rol !== undefined) {
      const gecerliRoller = ["pm", "jr_pm", "kd_pm", "iu", "tm", "bm", "utt", "kd_utt", "gm", "gm_yrd", "drk", "paz_md", "blm_md", "med_md", "grp_pm", "sm", "egt_md", "egt_yrd_md", "egt_yon", "egt_uz"];
      const rolTemiz = rol.trim().toLowerCase();
      if (!gecerliRoller.includes(rolTemiz)) return validasyonHatasi("Geçersiz rol.", ["rol"]);
    }

    const guncellenecek: Record<string, unknown> = {};
    if (rol !== undefined) guncellenecek.rol = rol.trim().toLowerCase();
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

    const { error: deleteError } = await adminSupabase
      .from("kullanicilar")
      .delete()
      .eq("kullanici_id", kullanici_id)
      .eq("firma_id", firma_id);

    if (deleteError) return hataYaniti("Kullanıcı tablodan silinemedi.", "kullanicilar tablosu DELETE", deleteError);

    const { error: authError } = await adminSupabase.auth.admin.deleteUser(kullanici_id);
    if (authError) console.error("[UYARI] Kullanıcı Auth'tan silinemedi:", { kullanici_id, hata: authError.message });

    return NextResponse.json({ mesaj: "Kullanıcı başarıyla silindi." }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "DELETE /admin/api/firmalar/[firma_id]/kullanicilar");
  }
}