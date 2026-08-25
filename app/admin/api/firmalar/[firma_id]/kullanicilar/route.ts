// app/admin/api/firmalar/[firma_id]/kullanicilar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { TUM_ROLLER } from "@/lib/utils/roller";
import { firmaYapisiYukle, kullaniciEksikMi, kullaniciSatirDogrula, rolCoz, rolGecisiCoz, telefonNormalize } from "@/lib/admin/kullaniciDogrulama";
import { adminGirisKontrol } from "@/lib/utils/adminGirisKontrol";
import { adSoyadBicimle } from "@/lib/utils/adSoyadBicimle";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ firma_id: string }> }
) {
  try {
    const kontrol = await adminGirisKontrol();
    if (!kontrol.gecerli) return kontrol.yanit;

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
        kullanici_id, ad, soyad, eposta, telefon, rol, firma_id,
        takim_id, bolge_id, aktif_mi,
        yetki_kullanici_yonetim, yetki_aktif_pasif, created_at,
        takimlar ( takim_adi ),
        bolgeler ( bolge_adi )
      `)
      .eq("firma_id", firma_id)
      .order("ad", { ascending: true });

    interface AdminKullaniciRow {
      kullanici_id: string;
      ad: string;
      soyad: string;
      eposta: string;
      telefon?: string | null;
      rol: string;
      firma_id: string;
      takim_id?: string | null;
      bolge_id?: string | null;
      aktif_mi: boolean;
      yetki_kullanici_yonetim?: boolean | null;
      yetki_aktif_pasif?: boolean | null;
      created_at?: string | null;
      takimlar?: { takim_adi?: string | null } | Array<{ takim_adi?: string | null }> | null;
      bolgeler?: { bolge_adi?: string | null } | Array<{ bolge_adi?: string | null }> | null;
    }

    const sonuc = ((kullanicilar as unknown as AdminKullaniciRow[] | null) ?? []).map(k => {
      const takimObj = Array.isArray(k.takimlar) ? k.takimlar[0] : k.takimlar;
      const bolgeObj = Array.isArray(k.bolgeler) ? k.bolgeler[0] : k.bolgeler;
      return {
        kullanici_id: k.kullanici_id,
        ad: k.ad,
        soyad: k.soyad,
        eposta: k.eposta,
        telefon: k.telefon ?? null,
        rol: k.rol,
        firma_id: k.firma_id,
        takim_id: k.takim_id,
        bolge_id: k.bolge_id,
        aktif_mi: k.aktif_mi,
        yetki_kullanici_yonetim: k.yetki_kullanici_yonetim,
        yetki_aktif_pasif: k.yetki_aktif_pasif,
        created_at: k.created_at,
        takim_adi: takimObj?.takim_adi ?? null,
        bolge_adi: bolgeObj?.bolge_adi ?? null,
      };
    });

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
    const kontrol = await adminGirisKontrol();
    if (!kontrol.gecerli) return kontrol.yanit;

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
    // K-A6 — eksik kabul: takım/bölge çözülememişse kayıt yine açılır,
    // eksiklik yanıtta görünür şekilde raporlanır.
    const eksikMi = dogrulama.eksikAlanlar.length > 0;

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
        telefon: kayit.telefon,
        rol: kayit.rol,
        firma_id,
        takim_id: kayit.takim_id,
        bolge_id: kayit.bolge_id,
        // T-7: eksik bilgili kullanıcı PASİF doğar; eksiği kapanınca otomatik aktifleşir.
        aktif_mi: !eksikMi,
        yetki_kullanici_yonetim: yetki_kullanici_yonetim === true,
        yetki_aktif_pasif: yetki_aktif_pasif === true,
      });

    if (insertError) {
      await adminSupabase.auth.admin.deleteUser(authData.user.id);
      // 23505 = benzersizlik ihlali; telefon index'i Türkçe mesajla raporlanır.
      if (insertError.code === "23505" && insertError.message.includes("telefon")) {
        return validasyonHatasi(`Bu telefon numarası başka bir kullanıcıda kayıtlı (${kayit.telefon}).`, ["telefon"]);
      }
      return hataYaniti("Kullanıcı veritabanına kaydedilemedi.", "kullanicilar tablosu INSERT", insertError);
    }

    return NextResponse.json({
      mesaj: eksikMi
        ? `Kullanıcı eklendi — EKSİK BİLGİLİ (${dogrulama.eksikAlanlar.join(", ")} atanmadı), PASİF doğdu; eksiği tamamlanınca aktifleşir.${dogrulama.uyari ? ` ${dogrulama.uyari}` : ""}`
        : "Kullanıcı başarıyla eklendi.",
      eksik: eksikMi,
      eksikAlanlar: dogrulama.eksikAlanlar,
    }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /admin/api/firmalar/[firma_id]/kullanicilar");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ firma_id: string }> }
) {
  try {
    const kontrol = await adminGirisKontrol();
    if (!kontrol.gecerli) return kontrol.yanit;

    const { firma_id } = await params;
    if (!firma_id) return validasyonHatasi("firma_id zorunludur.", ["firma_id"]);

    const adminSupabase = createAdminClient();
    const body = await request.json();
    const { kullanici_id, rol, aktif_mi, yetki_kullanici_yonetim, yetki_aktif_pasif } = body;

    if (!kullanici_id) return validasyonHatasi("kullanici_id zorunludur.", ["kullanici_id"]);
    // K-A6 tamamlama akışı: rol değişmeden yalnız takım/bölge ataması ya da
    // telefon eklenmesi/düzeltilmesi de geçerli istektir.
    const atamaVar = body.takim_id !== undefined || body.takim_adi !== undefined
      || body.bolge_id !== undefined || body.bolge_adi !== undefined;
    // Kimlik düzenleme (25.07): admin ad/soyad/e-posta/şifre de değiştirebilir.
    const kimlikVar = body.ad !== undefined || body.soyad !== undefined
      || body.eposta !== undefined || body.sifre !== undefined;
    if (rol === undefined && aktif_mi === undefined && yetki_kullanici_yonetim === undefined && yetki_aktif_pasif === undefined && !atamaVar && !kimlikVar && body.telefon === undefined)
      return validasyonHatasi("Güncellenecek alan zorunludur.", ["ad", "soyad", "eposta", "sifre", "rol", "aktif_mi", "yetki_kullanici_yonetim", "yetki_aktif_pasif", "takim_id", "bolge_id", "telefon"]);

    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, rol, takim_id, bolge_id, telefon, aktif_mi, ad, soyad, eposta")
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
      // T-4: rol girdisi tekli/topluyla aynı çözümden geçer (rolCoz — insan adı
      // da kabul); çözülemeyen girdiyi TUM_ROLLER kontrolü reddeder.
      if (typeof rol !== "string") return validasyonHatasi("Geçersiz rol.", ["rol"]);
      const rolTemiz = rolCoz(rol);
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

    if (rol === undefined && atamaVar) {
      // K-A6 tamamlama: MEVCUT rolün kurallarıyla takım/bölge çözülür —
      // rol geçişiyle aynı tek kaynaktan (rolGecisiCoz), ayrı kural yazılmaz.
      const yapiSonuc = await firmaYapisiYukle(adminSupabase, firma_id);
      if (!yapiSonuc.ok) return hataYaniti(yapiSonuc.hata, "firmaYapisiYukle — eksik tamamlama", null);

      const cozum = rolGecisiCoz(yapiSonuc.yapi, kullanici!.rol, {
        mevcut_takim_id: kullanici!.takim_id ?? null,
        mevcut_bolge_id: kullanici!.bolge_id ?? null,
        takim_id: body.takim_id,
        takim_adi: body.takim_adi,
        bolge_id: body.bolge_id,
        bolge_adi: body.bolge_adi,
      });
      if (!cozum.ok) return validasyonHatasi(cozum.hata, cozum.alanlar);

      guncellenecek.takim_id = cozum.takim_id;
      guncellenecek.bolge_id = cozum.bolge_id;
    }

    if (body.telefon !== undefined) {
      // Tekil telefon ekleme/düzeltme: toplu yüklemeyle aynı normalize kuralı.
      const telefonSonuc = telefonNormalize(body.telefon);
      if (!telefonSonuc.ok) return validasyonHatasi(telefonSonuc.hata, ["telefon"]);
      guncellenecek.telefon = telefonSonuc.telefon;
    }

    // ── Kimlik alanları (25.07: admin düzenleme) ─────────────────────────────
    // kullanici_id DEĞİŞMEZ; bu yüzden kullanıcının ürettiği her şey (puanlar,
    // talepler, izlemeler, senaryo/video/soru seti sahipliği) olduğu gibi kalır —
    // yalnız künye güncellenir, eski bilginin üstüne yazılır.
    if (body.ad !== undefined) {
      const ad = adSoyadBicimle(String(body.ad ?? ""));
      if (ad.length < 2) return validasyonHatasi("Ad en az 2 karakter olmalıdır.", ["ad"]);
      guncellenecek.ad = ad;
    }
    if (body.soyad !== undefined) {
      const soyad = adSoyadBicimle(String(body.soyad ?? ""));
      if (soyad.length < 2) return validasyonHatasi("Soyad en az 2 karakter olmalıdır.", ["soyad"]);
      guncellenecek.soyad = soyad;
    }

    const yeniEposta = body.eposta !== undefined ? String(body.eposta).trim().toLowerCase() : undefined;
    if (yeniEposta !== undefined) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(yeniEposta)) return validasyonHatasi("Geçerli bir e-posta adresi girin.", ["eposta"]);
      guncellenecek.eposta = yeniEposta;
    }

    const yeniSifre = body.sifre !== undefined && String(body.sifre).length > 0 ? String(body.sifre) : undefined;
    if (yeniSifre !== undefined && yeniSifre.length < 6) {
      return validasyonHatasi("Şifre en az 6 karakter olmalıdır.", ["sifre"]);
    }

    // E-posta giriş kimliğidir: Auth ile tablo ayrışırsa kullanıcı giremez.
    // Bu yüzden ÖNCE Auth güncellenir — başarısızsa tabloya hiç dokunulmaz.
    const epostaDegisti = yeniEposta !== undefined && yeniEposta !== (kullanici!.eposta ?? "").toLowerCase();
    if (epostaDegisti || yeniSifre !== undefined || body.ad !== undefined || body.soyad !== undefined) {
      const { error: authError } = await adminSupabase.auth.admin.updateUserById(kullanici_id, {
        ...(epostaDegisti ? { email: yeniEposta, email_confirm: true } : {}),
        ...(yeniSifre !== undefined ? { password: yeniSifre } : {}),
        user_metadata: {
          rol: (guncellenecek.rol as string | undefined) ?? kullanici!.rol,
          ad: (guncellenecek.ad as string | undefined) ?? kullanici!.ad,
          soyad: (guncellenecek.soyad as string | undefined) ?? kullanici!.soyad,
        },
      });
      if (authError) {
        const mesaj = /already|registered|exists/i.test(authError.message)
          ? `Bu e-posta başka bir kullanıcıda kayıtlı (${yeniEposta}).`
          : "Giriş bilgileri güncellenemedi.";
        return validasyonHatasi(mesaj, epostaDegisti ? ["eposta"] : ["sifre"]);
      }
    }

    if (aktif_mi !== undefined) guncellenecek.aktif_mi = aktif_mi;
    if (yetki_kullanici_yonetim !== undefined) guncellenecek.yetki_kullanici_yonetim = yetki_kullanici_yonetim;
    if (yetki_aktif_pasif !== undefined) guncellenecek.yetki_aktif_pasif = yetki_aktif_pasif;

    // T-7: eksiği BU istekle kapanan pasif kullanıcı otomatik aktifleşir.
    // Açık aktif_mi isteği (admin toggle'ı) her zaman önceliklidir; bilinçli
    // pasife alınmış (eksiksiz) kullanıcıya kural dokunmaz.
    let otomatikAktif = false;
    if (aktif_mi === undefined && !kullanici!.aktif_mi) {
      const onceEksik = kullaniciEksikMi(kullanici!.rol, kullanici!.takim_id ?? null, kullanici!.bolge_id ?? null, kullanici!.telefon ?? null).eksik;
      const sonRol = (guncellenecek.rol as string | undefined) ?? kullanici!.rol;
      const sonTakim = guncellenecek.takim_id !== undefined ? (guncellenecek.takim_id as string | null) : (kullanici!.takim_id ?? null);
      const sonBolge = guncellenecek.bolge_id !== undefined ? (guncellenecek.bolge_id as string | null) : (kullanici!.bolge_id ?? null);
      const sonTelefon = (guncellenecek.telefon as string | undefined) ?? kullanici!.telefon ?? null;
      const sonraEksik = kullaniciEksikMi(sonRol, sonTakim, sonBolge, sonTelefon).eksik;
      if (onceEksik && !sonraEksik) {
        guncellenecek.aktif_mi = true;
        otomatikAktif = true;
      }
    }

    const { error: updateError } = await adminSupabase
      .from("kullanicilar")
      .update(guncellenecek)
      .eq("kullanici_id", kullanici_id)
      .eq("firma_id", firma_id);

    if (updateError) {
      // Auth zaten değişmişse geri alınır — giriş kimliği tabloyla ayrışmasın.
      if (epostaDegisti) {
        await adminSupabase.auth.admin.updateUserById(kullanici_id, { email: kullanici!.eposta, email_confirm: true });
      }
      // 23505 = benzersizlik ihlali; telefon index'i Türkçe mesajla raporlanır.
      if (updateError.code === "23505" && updateError.message.includes("telefon")) {
        return validasyonHatasi(`Bu telefon numarası başka bir kullanıcıda kayıtlı (${guncellenecek.telefon}).`, ["telefon"]);
      }
      if (updateError.code === "23505" && updateError.message.includes("eposta")) {
        return validasyonHatasi(`Bu e-posta başka bir kullanıcıda kayıtlı (${guncellenecek.eposta}).`, ["eposta"]);
      }
      return hataYaniti("Kullanıcı güncellenemedi.", "kullanicilar tablosu UPDATE", updateError);
    }

    return NextResponse.json({
      mesaj: otomatikAktif
        ? "Kullanıcı güncellendi — eksik bilgisi tamamlandı, aktifleşti."
        : "Kullanıcı başarıyla güncellendi.",
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "PUT /admin/api/firmalar/[firma_id]/kullanicilar");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ firma_id: string }> }
) {
  try {
    const kontrol = await adminGirisKontrol();
    if (!kontrol.gecerli) return kontrol.yanit;

    const { firma_id } = await params;
    if (!firma_id) return validasyonHatasi("firma_id zorunludur.", ["firma_id"]);

    const adminSupabase = createAdminClient();
    const body = await request.json();
    const { kullanici_id } = body;

    if (!kullanici_id) return validasyonHatasi("kullanici_id zorunludur.", ["kullanici_id"]);

    // Silme sırası (B-24): arşiv → DB delete → Auth delete.
    // Eski sıra (Auth önce) geri alınamaz yarım durum bırakabiliyordu:
    // Auth silinip DB delete FK'ya takılınca girişsiz yetim satır kalıyordu.
    // Yeni sırada her adımın telafisi var: DB delete düşerse arşiv geri alınır;
    // Auth delete düşerse satır arşivdeki kopyadan geri yazılır.
    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, ad, soyad, eposta, rol, firma_id, takim_id, bolge_id, aktif_mi, yetki_kullanici_yonetim, yetki_aktif_pasif, fotograf_url")
      .eq("kullanici_id", kullanici_id)
      .eq("firma_id", firma_id)
      .single();

    const kullaniciKontrol = veriKontrol(kullanici, "kullanicilar tablosu SELECT — silme öncesi kontrol", "Kullanıcı bulunamadı.");
    if (!kullaniciKontrol.gecerli) return kullaniciKontrol.yanit;
    if (kullaniciError) return hataYaniti("Kullanıcı sorgulanırken hata oluştu.", "kullanicilar tablosu SELECT", kullaniciError, 404);

    // 1) Arşivle
    const silinmeTarihi = new Date().toISOString();
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
        silinme_tarihi: silinmeTarihi,
      });

    if (arsivError) return hataYaniti("Kullanıcı arşivlenemedi, silme iptal edildi.", "silinmis_kullanicilar tablosu INSERT", arsivError);

    const arsiviGeriAl = async () => {
      await adminSupabase
        .from("silinmis_kullanicilar")
        .delete()
        .eq("kullanici_id", kullanici_id)
        .eq("silinme_tarihi", silinmeTarihi);
    };

    // 2) DB'den sil — düşerse (örn. FK) arşiv geri alınır, Auth'a hiç dokunulmamıştır.
    const { error: deleteError } = await adminSupabase
      .from("kullanicilar")
      .delete()
      .eq("kullanici_id", kullanici_id)
      .eq("firma_id", firma_id);

    if (deleteError) {
      await arsiviGeriAl();
      return hataYaniti("Kullanıcı tablodan silinemedi; işlem geri alındı.", "kullanicilar tablosu DELETE", deleteError);
    }

    // 3) Auth'tan sil — düşerse satır elimizdeki kopyadan geri yazılır (telafi).
    const { error: authError } = await adminSupabase.auth.admin.deleteUser(kullanici_id);
    if (authError) {
      const { error: geriYazError } = await adminSupabase
        .from("kullanicilar")
        .insert({
          kullanici_id: kullanici.kullanici_id,
          ad: kullanici.ad,
          soyad: kullanici.soyad,
          eposta: kullanici.eposta,
          rol: kullanici.rol,
          firma_id: kullanici.firma_id,
          takim_id: kullanici.takim_id,
          bolge_id: kullanici.bolge_id,
          aktif_mi: kullanici.aktif_mi,
          yetki_kullanici_yonetim: kullanici.yetki_kullanici_yonetim,
          yetki_aktif_pasif: kullanici.yetki_aktif_pasif,
          fotograf_url: kullanici.fotograf_url,
        });
      await arsiviGeriAl();
      if (geriYazError) {
        // Telafi de düştü — yarım durum loglanır (nadir; elle müdahale gerekir).
        console.error("[kullanici DELETE] Auth silinemedi ve satır geri yazılamadı:", geriYazError.message);
        return hataYaniti("Auth silinemedi; kullanıcı satırı geri yazılamadı — elle kontrol gerekir.", "auth.admin.deleteUser + geri yazım", authError);
      }
      return hataYaniti("Kullanıcı Auth'tan silinemedi; işlem geri alındı.", "auth.admin.deleteUser", authError);
    }

    return NextResponse.json({ mesaj: "Kullanıcı başarıyla silindi." }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "DELETE /admin/api/firmalar/[firma_id]/kullanicilar");
  }
}