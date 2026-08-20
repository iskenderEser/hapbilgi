// app/(panel)/eczanem/eczane/api/musteri-ekle/route.ts
// Eczacı/teknisyen — yeni müşteri kaydı veya mevcut müşteriyi eczaneye bağlama.
// Telefon sistemde varsa kimlik/auth yeniden oluşturulmaz; yalnız eczane üyeliği
// kurulur. Yeni müşteride Ad Soyad / Cep Tel / E-posta / Şifre zorunludur.
//
// UTT'nin eczacıyı kaydetme deseninin (auth.admin.createUser + kimlik + bağ,
// atomik geri alma) müşteri tarafına uygulanmış halidir. Gerçek e-posta ve
// şifre auth.users'da tutulur; eczanem_musteriler şeması değişmez.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, validasyonHatasi, yetkiHatasi, rolHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { ECLUB_TUKETICI_ROLLERI } from "@/lib/utils/roller";
import { eczaciAktifEczanesi } from "@/lib/eczanem/eczaci";
import { telefonNormalize } from "@/lib/eczanem/telefon";
import { ECLUB_UYESI_MUSTERI_OLAMAZ_MESAJI, eclubUyesiTelefonMu } from "@/lib/eczanem/eclubUyesiKontrol";
import { authTelafisiYap, provizyonBaslat, provizyonDurumuYaz } from "@/lib/kimlik/provizyon";

function epostaGecerliMi(eposta: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eposta);
}

function epostaCakismasiMi(mesaj?: string): boolean {
  return /already|registered|exists|duplicate/i.test(mesaj ?? "");
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!ECLUB_TUKETICI_ROLLERI.includes(rol))
      return rolHatasi("Müşteri kaydı yalnızca eczacı/teknisyen tarafından yapılabilir.");

    const eden = await eczaciAktifEczanesi(adminSupabase, user.id);
    if (!eden.ok) return isKuraluHatasi(eden.hata ?? "Aktif eczane bağınız bulunamadı.");

    const body = await request.json();
    const telefon = telefonNormalize(body?.telefon ?? "");
    if (!telefon) return validasyonHatasi("Geçerli bir cep telefonu girin.", ["telefon"]);

    // E-Club kimliği ile Eczanem müşteri kimliği global olarak ayrıdır.
    // Kontrol eczane bağına değil telefona bakar; başka eczanedeki E-Club
    // üyesi de bu eczaneye müşteri olarak kaydedilemez.
    const eclubKontrol = await eclubUyesiTelefonMu(adminSupabase, telefon);
    if (!eclubKontrol.ok) {
      return sunucuHatasi(eclubKontrol.hata, "eclub_kisiler SELECT — Eczanem müşteri telefon kontrolü");
    }
    if (eclubKontrol.uyeMi) return isKuraluHatasi(ECLUB_UYESI_MUSTERI_OLAMAZ_MESAJI);

    const islem = body?.islem === "bagla" ? "bagla" : "kaydet";

    // Telefon = tek kimlik, eczane bağı = çoklu (REDBOOK §5.1). Mevcut
    // müşterinin auth hesabına ve kimlik bilgilerine ikinci eczane dokunamaz.
    const { data: mevcut, error: mevcutHatasi } = await adminSupabase
      .from("eczanem_musteriler")
      .select("musteri_id, aktif_mi, auth_user_id")
      .eq("telefon", telefon)
      .maybeSingle();
    if (mevcutHatasi) return sunucuHatasi(mevcutHatasi, "eczanem_musteriler SELECT — telefon");

    if (islem === "bagla") {
      if (!mevcut) return validasyonHatasi("Bu telefonla kayıtlı bir müşteri bulunamadı.", ["telefon"]);
      if (!mevcut.aktif_mi || !mevcut.auth_user_id) {
        return isKuraluHatasi("Müşterinin genel hesabı aktif değil; eczane üyeliği kurulamadı.");
      }

      const { data: mevcutUyelik, error: mevcutUyelikHatasi } = await adminSupabase
        .from("eczanem_uyelikler")
        .select("uyelik_id, aktif_mi")
        .eq("musteri_id", mevcut.musteri_id)
        .eq("eczane_id", eden.eczaneId!)
        .maybeSingle();
      if (mevcutUyelikHatasi) return sunucuHatasi(mevcutUyelikHatasi, "eczanem_uyelikler SELECT — mevcut bağ");
      if (mevcutUyelik?.aktif_mi) {
        return validasyonHatasi("Bu müşteri zaten eczanenizin aktif üyesi.", ["telefon"]);
      }

      // Pasif bağı yeniden açar; bağ yoksa oluşturur. UNIQUE(musteri_id,
      // eczane_id) üzerinden upsert, eşzamanlı iki isteği de tek satırda tutar.
      const { error: bagHatasi } = await adminSupabase
        .from("eczanem_uyelikler")
        .upsert(
          { musteri_id: mevcut.musteri_id, eczane_id: eden.eczaneId!, aktif_mi: true },
          { onConflict: "musteri_id,eczane_id" },
        );
      if (bagHatasi) return sunucuHatasi(bagHatasi, "eczanem_uyelikler UPSERT — mevcut müşteri bağı");

      return NextResponse.json({
        ok: true,
        mevcut_musteri: true,
        mesaj: mevcutUyelik ? "Müşterinin eczane üyeliği yeniden aktifleştirildi." : "Kayıtlı müşteri eczanenize bağlandı.",
      }, { status: 200 });
    }

    if (mevcut) {
      return validasyonHatasi("Bu telefon sistemde kayıtlı. Kısa yoldan 'Kayıtlı Müşteriyi Bağla' işlemini kullanın.", ["telefon"]);
    }

    const adSoyad = String(body?.ad_soyad ?? "").trim();
    if (adSoyad.length < 3) return validasyonHatasi("Ad soyad girin.", ["ad_soyad"]);
    if (adSoyad.length > 200) return validasyonHatasi("Ad soyad 200 karakterden uzun olamaz.", ["ad_soyad"]);

    const eposta = String(body?.eposta ?? "").trim().toLowerCase();
    if (!eposta) return validasyonHatasi("E-posta zorunludur.", ["eposta"]);
    if (eposta.length > 200) return validasyonHatasi("E-posta 200 karakterden uzun olamaz.", ["eposta"]);
    if (!epostaGecerliMi(eposta)) return validasyonHatasi("Geçerli bir e-posta adresi giriniz.", ["eposta"]);

    const sifre = String(body?.sifre ?? "");
    if (sifre.length < 6) return validasyonHatasi("Şifre en az 6 karakter olmalıdır.", ["sifre"]);

    // Auth dış kaynağı ile müşteri+üyelik RPC'si izlenen saga olarak çalışır.
    // RPC içindeki iki uygulama yazımı atomiktir; başarısızlıkta Auth telafisinin
    // sonucu provizyon günlüğüne kaydedilir ve sahipsiz hesap sessiz kalmaz.
    const provizyon = await provizyonBaslat(adminSupabase, "eczanem_musteri");
    if (!provizyon.ok || !provizyon.islemId) {
      return hataYaniti("Müşteri oluşturma işlemi başlatılamadı.", "kimlik_provizyon_islemleri INSERT", provizyon.hata);
    }

    const { data: authData, error: authInsertHatasi } = await adminSupabase.auth.admin.createUser({
      email: eposta,
      password: sifre,
      email_confirm: true,
      user_metadata: { kimlik: "eczanem_musteri", ad_soyad: adSoyad },
    });
    if (authInsertHatasi || !authData?.user) {
      await provizyonDurumuYaz(adminSupabase, provizyon.islemId, "basarisiz", { hata: authInsertHatasi?.message ?? "Auth kullanıcısı oluşmadı." });
      if (epostaCakismasiMi(authInsertHatasi?.message)) return validasyonHatasi("Bu e-posta zaten kayıtlı.", ["eposta"]);
      return sunucuHatasi(authInsertHatasi, "auth.admin.createUser — müşteri");
    }
    const authUserId = authData.user.id;
    const authKaydi = await provizyonDurumuYaz(adminSupabase, provizyon.islemId, "auth_olustu", { authUserId });
    if (!authKaydi.ok) {
      await authTelafisiYap(adminSupabase, provizyon.islemId, authUserId, authKaydi.hata);
      return hataYaniti("Müşteri oluşturma işlemi kaydedilemedi.", "kimlik_provizyon_islemleri UPDATE — auth_olustu", authKaydi.hata);
    }

    const { data: yeniMusteriId, error: musteriHatasi } = await adminSupabase.rpc("eczanem_yeni_musteri_provizyonu", {
      p_telefon: telefon,
      p_ad_soyad: adSoyad,
      p_auth_user_id: authUserId,
      p_eczane_id: eden.eczaneId!,
    });
    if (musteriHatasi || !yeniMusteriId) {
      const telafi = await authTelafisiYap(
        adminSupabase,
        provizyon.islemId,
        authUserId,
        musteriHatasi ?? new Error("Müşteri provizyonu sonuç döndürmedi."),
      );
      if (telafi.geriAlindi && musteriHatasi?.message?.includes("E-Club üyesi")) {
        return isKuraluHatasi(ECLUB_UYESI_MUSTERI_OLAMAZ_MESAJI);
      }
      if (musteriHatasi?.code === "23505" && telafi.geriAlindi) {
        return validasyonHatasi("Bu numara zaten kayıtlı.", ["telefon"]);
      }
      return hataYaniti(
        telafi.geriAlindi
          ? "Müşteri kaydedilemedi; oluşturulan giriş hesabı geri alındı."
          : "Müşteri kaydedilemedi; yönetici kontrolü gerekir.",
        "eczanem_yeni_musteri_provizyonu RPC",
        telafi.hata ?? musteriHatasi,
      );
    }
    await provizyonDurumuYaz(adminSupabase, provizyon.islemId, "tamamlandi", {
      authUserId,
      hedefKayitId: String(yeniMusteriId),
    });

    return NextResponse.json({ ok: true, mesaj: "Müşteri kaydedildi." }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eczanem/eczane/api/musteri-ekle");
  }
}
