// app/eclub/listem/api/kisiler/route.ts
//
// Üç katmanlı havuz modeli — kişi tarafı:
//   Katman 1 (kimlik):   eclub_kisiler (eposta/telefon UNIQUE, aktif_mi YOK)
//   Katman 2 (kişi-bağ): eclub_kisi_eczane (aktif_mi, tek aktif GLN kuralı)
//
// GET  → UTT'nin aktif ilişkili eczanelerindeki aktif kişiler
// POST → kişi ekle: havuzda varsa bağ oluştur (tek aktif GLN kontrolü), yoksa kimlik+bağ
// PUT  → kişi güncelle (bilgi) / pasife al (bağ aktif_mi=false, soft)

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ECLUB_TUKETICI_ROLLERI, ECLUB_GOREN_ROLLER } from "@/lib/utils/roller";
import { hataYaniti, veriKontrol, sunucuHatasi, validasyonHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ECZANEM_MUSTERISI_ECLUB_UYESI_OLAMAZ_MESAJI,
  eczanemMusterisiBul,
  eczanemMusterisiTelefonMu,
} from "@/lib/eczanem/eclubUyesiKontrol";
import { authTelafisiYap, provizyonBaslat, provizyonDurumuYaz } from "@/lib/kimlik/provizyon";

function epostaGecerliMi(eposta: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eposta);
}
function telefonGecerliMi(telefon: string): boolean {
  return /^\d{11}$/.test(telefon);
}

// Postgres UNIQUE ihlali (23505) → eposta mı telefon mu çakıştı.
function benzersizlikHatasi(err: unknown): { alan: string; mesaj: string } | null {
  if (!err) return null;
  const e = err as { code?: string; message?: string; details?: string };
  const kod = e.code ?? "";
  const metin = `${e.code ?? ""} ${e.message ?? ""} ${e.details ?? ""}`.toLowerCase();
  if (kod === "23505" || metin.includes("duplicate") || metin.includes("unique")) {
    if (metin.includes("eposta")) return { alan: "eposta", mesaj: "Bu e-posta zaten kayıtlı." };
    if (metin.includes("telefon")) return { alan: "telefon", mesaj: "Bu telefon numarası zaten kayıtlı." };
    return { alan: "eposta", mesaj: "Bu e-posta veya telefon zaten kayıtlı." };
  }
  return null;
}

interface UttKontrolBasari { firma_id: string; }
interface UttKontrolHata { hata: NextResponse; }
type UttKontrolSonuc = UttKontrolBasari | UttKontrolHata;

interface EclubKisiKimlik {
  kisi_id: string;
  rol: string;
  ad: string;
  soyad: string;
  eposta: string;
  telefon: string;
  auth_user_id: string | null;
}

async function uttKontrol(adminSupabase: SupabaseClient, userId: string): Promise<UttKontrolSonuc> {
  const { data: kullanici, error } = await adminSupabase
    .from("kullanicilar")
    .select("rol, firma_id")
    .eq("kullanici_id", userId)
    .single();
  if (error || !kullanici) return { hata: hataYaniti("Kullanıcı sorgulanamadı.", "kullanicilar SELECT", error, 404) };
  const rolKucu = (kullanici.rol ?? "").toLowerCase();
  if (!ECLUB_GOREN_ROLLER.includes(rolKucu)) return { hata: rolHatasi("Bu sayfaya yalnız UTT/KD_UTT erişebilir.") };
  if (!kullanici.firma_id) return { hata: validasyonHatasi("Firma bilgisi bulunamadı.", ["firma_id"]) };
  return { firma_id: kullanici.firma_id as string };
}

// UTT'nin bu eczaneyle aktif ilişkisi var mı (sahiplik)?
async function uttEczaneSahipMi(adminSupabase: SupabaseClient, userId: string, eczane_id: string): Promise<boolean> {
  const { data } = await adminSupabase
    .from("eclub_eczane_firma")
    .select("id")
    .eq("eczane_id", eczane_id)
    .eq("baglayan_utt_id", userId)
    .eq("aktif_mi", true)
    .maybeSingle();
  return !!data;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const k = await uttKontrol(adminSupabase, user.id);
    if ("hata" in k) return k.hata;

    // UTT'nin aktif ilişkili eczaneleri
    const { data: iliskiler, error: iliskiError } = await adminSupabase
      .from("eclub_eczane_firma")
      .select("eczane_id, eclub_eczaneler ( eclub_eczane_master ( eczane_adi ) )")
      .eq("baglayan_utt_id", user.id)
      .eq("aktif_mi", true);

    if (iliskiError) return hataYaniti("Eczaneler çekilemedi.", "eclub_eczane_firma SELECT — baglayan_utt_id", iliskiError);

    const eczaneIdler: string[] = [];
    const eczaneAdiMap = new Map<string, string>();
    // eczane_adi eclub_eczaneler'de değil, bir katman derindeki eclub_eczane_master'da
    // (eclub_eczaneler.gln → eclub_eczane_master.gln FK üzerinden).
    type Master = { eczane_adi: string };
    type Eczane = { eclub_eczane_master?: Master | Master[] };
    for (const il of iliskiler ?? []) {
      const eczane_id = (il as { eczane_id: string }).eczane_id;
      eczaneIdler.push(eczane_id);
      const eRaw = (il as { eclub_eczaneler?: Eczane | Eczane[] }).eclub_eczaneler;
      const e = Array.isArray(eRaw) ? eRaw[0] : eRaw;
      const mRaw = e?.eclub_eczane_master;
      const m = Array.isArray(mRaw) ? mRaw[0] : mRaw;
      if (m) eczaneAdiMap.set(eczane_id, m.eczane_adi);
    }

    if (eczaneIdler.length === 0) return NextResponse.json({ kisiler: [], gecis_talepleri: [] }, { status: 200 });

    // Bu eczanelerdeki aktif kişi bağları + kimlik
    const { data: baglar, error: bagError } = await adminSupabase
      .from("eclub_kisi_eczane")
      .select("kisi_id, eczane_id, aktif_mi, created_at, eclub_kisiler ( kisi_id, rol, ad, soyad, eposta, telefon, auth_user_id )")
      .in("eczane_id", eczaneIdler)
      .eq("aktif_mi", true)
      .order("created_at", { ascending: false });

    if (bagError) return hataYaniti("Kişiler çekilemedi.", "eclub_kisi_eczane SELECT — eczane_id filtresi", bagError);

    interface KimlikRaw {
      kisi_id: string; rol: string; ad: string; soyad: string;
      eposta: string; telefon: string; auth_user_id: string | null;
    }
    const sonuc = [];
    for (const b of baglar ?? []) {
      const eczane_id = (b as { eczane_id: string }).eczane_id;
      const kRaw = (b as { eclub_kisiler?: KimlikRaw | KimlikRaw[] }).eclub_kisiler;
      const k2 = Array.isArray(kRaw) ? kRaw[0] : kRaw;
      if (!k2) continue;
      sonuc.push({
        kisi_id: k2.kisi_id,
        eczane_id,
        eczane_adi: eczaneAdiMap.get(eczane_id) ?? null,
        rol: k2.rol,
        ad: k2.ad,
        soyad: k2.soyad,
        eposta: k2.eposta,
        telefon: k2.telefon,
        auth_user_id: k2.auth_user_id,
        aktif_mi: true,
        created_at: (b as { created_at: string }).created_at,
      });
    }

    const { data: gecisTalepleri, error: gecisHatasi } = await adminSupabase
      .from("eczanem_eclub_gecis_talepleri")
      .select("gecis_id, eczane_id, rol, ad, soyad, eposta, telefon, durum, created_at")
      .in("eczane_id", eczaneIdler)
      .order("created_at", { ascending: false });
    if (gecisHatasi && gecisHatasi.code !== "42P01") {
      return hataYaniti("E-Club geçiş talepleri çekilemedi.", "eczanem_eclub_gecis_talepleri SELECT", gecisHatasi);
    }

    return NextResponse.json({ kisiler: sonuc, gecis_talepleri: gecisTalepleri ?? [] }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/listem/api/kisiler");
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const k = await uttKontrol(adminSupabase, user.id);
    if ("hata" in k) return k.hata;

    const body = await request.json();
    const { eczane_id, rol, ad, soyad, eposta, telefon, sifre } = body;

    if (!eczane_id) return validasyonHatasi("Eczane seçimi zorunludur.", ["eczane_id"]);
    if (!rol || typeof rol !== "string") return validasyonHatasi("Rol zorunludur.", ["rol"]);
    if (!ad || typeof ad !== "string" || ad.trim().length === 0) return validasyonHatasi("Ad zorunludur.", ["ad"]);
    if (!soyad || typeof soyad !== "string" || soyad.trim().length === 0) return validasyonHatasi("Soyad zorunludur.", ["soyad"]);
    if (!eposta || typeof eposta !== "string" || eposta.trim().length === 0) return validasyonHatasi("E-posta zorunludur.", ["eposta"]);
    if (!telefon || typeof telefon !== "string" || telefon.trim().length === 0) return validasyonHatasi("Telefon zorunludur.", ["telefon"]);

    if (ad.length > 200) return validasyonHatasi("Ad 200 karakterden uzun olamaz.", ["ad"]);
    if (soyad.length > 200) return validasyonHatasi("Soyad 200 karakterden uzun olamaz.", ["soyad"]);
    if (eposta.length > 200) return validasyonHatasi("E-posta 200 karakterden uzun olamaz.", ["eposta"]);

    const rolTemiz = rol.trim().toLowerCase();
    if (!ECLUB_TUKETICI_ROLLERI.includes(rolTemiz)) return validasyonHatasi("Geçersiz rol.", ["rol"]);

    const epostaTemiz = eposta.trim().toLowerCase();
    if (!epostaGecerliMi(epostaTemiz)) return validasyonHatasi("Geçerli bir e-posta adresi giriniz.", ["eposta"]);

    const telefonTemiz = telefon.trim();
    if (!telefonGecerliMi(telefonTemiz)) return validasyonHatasi("Telefon 11 haneli sayı olmalıdır.", ["telefon"]);

    // Sahiplik: UTT bu eczaneyi listesine almış mı?
    if (!(await uttEczaneSahipMi(adminSupabase, user.id, eczane_id)))
      return rolHatasi("Bu eczane listenizde değil, kişi ekleyemezsiniz.");

    // Eczacı ise: bu eczanede zaten aktif eczacı var mı? (tek eczacı kuralı)
    if (rolTemiz === "eczaci") {
      const { data: mevcutBaglar, error: mevcutBaglarError } = await adminSupabase
        .from("eclub_kisi_eczane")
        .select("kisi_id, eclub_kisiler ( rol )")
        .eq("eczane_id", eczane_id)
        .eq("aktif_mi", true);
      if (mevcutBaglarError)
        return hataYaniti("Eczanedeki kişiler sorgulanamadı.", "eclub_kisi_eczane SELECT — eczacı kontrolü", mevcutBaglarError);
      const eczaciVar = (mevcutBaglar ?? []).some((b) => {
        const kRaw = (b as { eclub_kisiler?: { rol: string } | { rol: string }[] }).eclub_kisiler;
        const kk = Array.isArray(kRaw) ? kRaw[0] : kRaw;
        return kk?.rol === "eczaci";
      });
      if (eczaciVar) return validasyonHatasi("Bu eczanede zaten aktif bir eczacı kayıtlı.", ["rol"]);
    }

    // Eczanem müşterisi artık körlemesine reddedilmez. Müşterinin açık kararı
    // beklenen kontrollü geçiş talebi açılır; o ana kadar E-Club kimliği ve
    // eczane bağı oluşmaz, mevcut Auth hesabı korunur.
    const musteriKontrol = await eczanemMusterisiBul(adminSupabase, telefonTemiz);
    if (!musteriKontrol.ok) {
      return hataYaniti("Eczanem müşteri kimliği doğrulanamadı.", "eczanem_musteriler SELECT — E-Club telefon kontrolü", musteriKontrol.hata);
    }
    if (musteriKontrol.musteri) {
      if (!musteriKontrol.musteri.aktif_mi || !musteriKontrol.musteri.auth_user_id) {
        return validasyonHatasi("Müşterinin aktif giriş hesabı olmadığı için E-Club geçişi başlatılamaz.", ["telefon"]);
      }

      const { data: gecisSonucu, error: gecisHatasi } = await adminSupabase.rpc("eczanem_eclub_gecis_talebi_olustur", {
        p_musteri_id: musteriKontrol.musteri.musteri_id,
        p_auth_user_id: musteriKontrol.musteri.auth_user_id,
        p_eczane_id: eczane_id,
        p_rol: rolTemiz,
        p_ad: ad.trim(),
        p_soyad: soyad.trim(),
        p_eposta: epostaTemiz,
        p_telefon: telefonTemiz,
        p_talep_eden_utt_id: user.id,
      });
      if (gecisHatasi) {
        if (gecisHatasi.code === "P0001" || gecisHatasi.code === "23505") {
          return validasyonHatasi(gecisHatasi.message, ["telefon", "eposta"]);
        }
        return hataYaniti("E-Club geçiş talebi oluşturulamadı.", "eczanem_eclub_gecis_talebi_olustur RPC", gecisHatasi);
      }
      return NextResponse.json({
        mesaj: "Eczanem müşterisine E-Club geçiş talebi gönderildi. Müşteri puan kararını verdiğinde üyelik tamamlanacak.",
        gecis_bekliyor: true,
        gecis_id: (gecisSonucu as { gecis_id?: string } | null)?.gecis_id ?? null,
      }, { status: 202 });
    }

    // E-posta ve telefon ayrı aranır: iki alan farklı kişilere aitse kimlikler
    // sessizce birleştirilmez. Ayrıca dinamik `.or(...)` filtresine kullanıcı
    // girdisi taşınmamış olur.
    const [epostaSonucu, telefonSonucu] = await Promise.all([
      adminSupabase
        .from("eclub_kisiler")
        .select("kisi_id, rol, ad, soyad, eposta, telefon, auth_user_id")
        .eq("eposta", epostaTemiz)
        .maybeSingle(),
      adminSupabase
        .from("eclub_kisiler")
        .select("kisi_id, rol, ad, soyad, eposta, telefon, auth_user_id")
        .eq("telefon", telefonTemiz)
        .maybeSingle(),
    ]);

    if (epostaSonucu.error)
      return hataYaniti("Kişi e-posta bilgisi sorgulanamadı.", "eclub_kisiler SELECT — eposta", epostaSonucu.error);
    if (telefonSonucu.error)
      return hataYaniti("Kişi telefon bilgisi sorgulanamadı.", "eclub_kisiler SELECT — telefon", telefonSonucu.error);

    const epostaKisi = epostaSonucu.data as EclubKisiKimlik | null;
    const telefonKisi = telefonSonucu.data as EclubKisiKimlik | null;
    if (epostaKisi && telefonKisi && epostaKisi.kisi_id !== telefonKisi.kisi_id) {
      return validasyonHatasi(
        "Girilen e-posta ve telefon farklı kişilere kayıtlı. Bilgileri kontrol ediniz.",
        ["eposta", "telefon"]
      );
    }
    const mevcutKisi = epostaKisi ?? telefonKisi;

    let kisi_id: string;

    if (mevcutKisi) {
      // Havuzda var → rol uyumu ve tek aktif GLN kontrolü.
      if (mevcutKisi.rol !== rolTemiz)
        return validasyonHatasi(`Bu kişi sistemde farklı bir rolle (${mevcutKisi.rol}) kayıtlı.`, ["rol"]);

      // Tek aktif GLN kuralı: başka eczanede aktif bağı var mı?
      const { data: aktifBag, error: aktifBagError } = await adminSupabase
        .from("eclub_kisi_eczane")
        .select("eczane_id, eclub_eczaneler ( eclub_eczane_master ( eczane_adi ) )")
        .eq("kisi_id", mevcutKisi.kisi_id)
        .eq("aktif_mi", true)
        .maybeSingle();

      if (aktifBagError)
        return hataYaniti("Kişinin aktif eczane bağı sorgulanamadı.", "eclub_kisi_eczane SELECT — aktif bağ", aktifBagError);

      if (aktifBag) {
        if (aktifBag.eczane_id === eczane_id)
          return validasyonHatasi("Bu kişi zaten bu eczanede kayıtlı.", ["eposta"]);
        // eczane_adi bir katman derinde: eclub_eczaneler → eclub_eczane_master
        type Master = { eczane_adi: string };
        type Eczane = { eclub_eczane_master?: Master | Master[] };
        const eRaw = (aktifBag as { eclub_eczaneler?: Eczane | Eczane[] }).eclub_eczaneler;
        const e = Array.isArray(eRaw) ? eRaw[0] : eRaw;
        const mRaw = e?.eclub_eczane_master;
        const m = Array.isArray(mRaw) ? mRaw[0] : mRaw;
        const eczaneAdi = m?.eczane_adi ?? "başka bir eczane";
        return validasyonHatasi(
          `${ad.trim()} ${soyad.trim()} zaten ${eczaneAdi}'nde kayıtlı. Önce admin oradan çıkarmalı.`,
          ["eposta"]
        );
      }

      kisi_id = mevcutKisi.kisi_id;

      // Eski/yarım kalmış kayıtta Auth bağı yoksa Auth dış kaynağı ile kimlik+bağ
      // RPC'si izlenen saga olarak çalışır. RPC içindeki iki DB yazımı atomiktir;
      // başarısızlıkta Auth telafisinin sonucu provizyon günlüğüne kaydedilir.
      if (!mevcutKisi.auth_user_id) {
        if (!sifre || typeof sifre !== "string" || sifre.length < 6)
          return validasyonHatasi("Giriş hesabı olmayan kişi için en az 6 karakter şifre zorunludur.", ["sifre"]);

        const provizyon = await provizyonBaslat(adminSupabase, "eclub_kisi");
        if (!provizyon.ok || !provizyon.islemId) {
          return hataYaniti("Kişi oluşturma işlemi başlatılamadı.", "kimlik_provizyon_islemleri INSERT", provizyon.hata);
        }

        const { data: authData, error: authInsertError } = await adminSupabase.auth.admin.createUser({
          email: mevcutKisi.eposta,
          password: sifre,
          user_metadata: {
            rol: mevcutKisi.rol,
            ad: mevcutKisi.ad,
            soyad: mevcutKisi.soyad,
            eclub_kisi: true,
          },
          email_confirm: true,
        });

        if (authInsertError || !authData.user) {
          await provizyonDurumuYaz(adminSupabase, provizyon.islemId, "basarisiz", { hata: authInsertError?.message ?? "Auth kullanıcısı oluşmadı." });
          const benzersiz = benzersizlikHatasi(authInsertError);
          if (benzersiz) return validasyonHatasi(benzersiz.mesaj, [benzersiz.alan]);
          return hataYaniti("Kişi giriş hesabı oluşturulamadı.", "auth.admin.createUser — mevcut eclub kişi", authInsertError);
        }

        const olusturulanAuthUserId = authData.user.id;
        const authKaydi = await provizyonDurumuYaz(adminSupabase, provizyon.islemId, "auth_olustu", { authUserId: olusturulanAuthUserId });
        if (!authKaydi.ok) {
          await authTelafisiYap(adminSupabase, provizyon.islemId, olusturulanAuthUserId, authKaydi.hata);
          return hataYaniti("Kişi oluşturma işlemi kaydedilemedi.", "kimlik_provizyon_islemleri UPDATE — auth_olustu", authKaydi.hata);
        }

        const { data: baglananKisiId, error: provizyonError } = await adminSupabase.rpc("eclub_mevcut_kisi_provizyonu", {
          p_kisi_id: mevcutKisi.kisi_id,
          p_auth_user_id: olusturulanAuthUserId,
          p_eczane_id: eczane_id,
        });
        if (provizyonError || !baglananKisiId) {
          const telafi = await authTelafisiYap(
            adminSupabase,
            provizyon.islemId,
            olusturulanAuthUserId,
            provizyonError ?? new Error("Kişi provizyonu sonuç döndürmedi."),
          );
          return hataYaniti(
            telafi.geriAlindi
              ? "Kişi giriş hesabı kimliğe bağlanamadı; oluşturulan giriş hesabı geri alındı."
              : "Kişi giriş hesabı kimliğe bağlanamadı; yönetici kontrolü gerekir.",
            "eclub_mevcut_kisi_provizyonu RPC",
            telafi.hata ?? provizyonError,
          );
        }

        await provizyonDurumuYaz(adminSupabase, provizyon.islemId, "tamamlandi", {
          authUserId: olusturulanAuthUserId,
          hedefKayitId: String(baglananKisiId),
        });
        return NextResponse.json({ mesaj: "Kişi başarıyla eklendi.", kisi_id }, { status: 201 });
      }

      // Mevcut kişi için yeni eczane bağı oluştur.
      const { error: bagError } = await adminSupabase
        .from("eclub_kisi_eczane")
        .insert({ kisi_id, eczane_id, aktif_mi: true });

      if (bagError) return hataYaniti("Kişi eczaneye bağlanamadı.", "eclub_kisi_eczane INSERT", bagError);

      return NextResponse.json({ mesaj: "Kişi başarıyla eklendi.", kisi_id }, { status: 201 });
    } else {
      // Havuzda yok → Auth dış kaynağı + atomik kimlik/bağ RPC'si.
      if (!sifre || typeof sifre !== "string" || sifre.length < 6)
        return validasyonHatasi("Yeni kişi için en az 6 karakter şifre zorunludur.", ["sifre"]);

      const provizyon = await provizyonBaslat(adminSupabase, "eclub_kisi");
      if (!provizyon.ok || !provizyon.islemId) {
        return hataYaniti("Kişi oluşturma işlemi başlatılamadı.", "kimlik_provizyon_islemleri INSERT", provizyon.hata);
      }

      const { data: authData, error: authInsertError } = await adminSupabase.auth.admin.createUser({
        email: epostaTemiz,
        password: sifre,
        user_metadata: { rol: rolTemiz, ad: ad.trim(), soyad: soyad.trim(), eclub_kisi: true },
        email_confirm: true,
      });

      if (authInsertError || !authData.user) {
        await provizyonDurumuYaz(adminSupabase, provizyon.islemId, "basarisiz", { hata: authInsertError?.message ?? "Auth kullanıcısı oluşmadı." });
        const benzersiz = benzersizlikHatasi(authInsertError);
        if (benzersiz) return validasyonHatasi(benzersiz.mesaj, [benzersiz.alan]);
        return hataYaniti("Kişi auth hesabı oluşturulamadı.", "auth.admin.createUser — eclub kişi", authInsertError);
      }

      const authUserId = authData.user.id;
      const authKaydi = await provizyonDurumuYaz(adminSupabase, provizyon.islemId, "auth_olustu", { authUserId });
      if (!authKaydi.ok) {
        await authTelafisiYap(adminSupabase, provizyon.islemId, authUserId, authKaydi.hata);
        return hataYaniti("Kişi oluşturma işlemi kaydedilemedi.", "kimlik_provizyon_islemleri UPDATE — auth_olustu", authKaydi.hata);
      }

      const { data: yeniKisiId, error: kisiInsertError } = await adminSupabase.rpc("eclub_yeni_kisi_provizyonu", {
        p_rol: rolTemiz,
        p_ad: ad.trim(),
        p_soyad: soyad.trim(),
        p_eposta: epostaTemiz,
        p_telefon: telefonTemiz,
        p_auth_user_id: authUserId,
        p_eczane_id: eczane_id,
      });
      if (kisiInsertError || !yeniKisiId) {
        const telafi = await authTelafisiYap(adminSupabase, provizyon.islemId, authUserId, kisiInsertError ?? new Error("Kişi provizyonu sonuç döndürmedi."));
        if (telafi.geriAlindi && kisiInsertError?.message?.includes("Eczanem müşterisi")) {
          return validasyonHatasi(ECZANEM_MUSTERISI_ECLUB_UYESI_OLAMAZ_MESAJI, ["telefon"]);
        }
        const benzersiz = benzersizlikHatasi(kisiInsertError);
        if (benzersiz && telafi.geriAlindi) return validasyonHatasi(benzersiz.mesaj, [benzersiz.alan]);
        return hataYaniti(
          telafi.geriAlindi ? "Kişi kaydedilemedi; oluşturulan giriş hesabı geri alındı." : "Kişi kaydedilemedi; yönetici kontrolü gerekir.",
          "eclub_yeni_kisi_provizyonu RPC",
          telafi.hata ?? kisiInsertError,
        );
      }
      kisi_id = String(yeniKisiId);
      await provizyonDurumuYaz(adminSupabase, provizyon.islemId, "tamamlandi", { authUserId, hedefKayitId: kisi_id });

      return NextResponse.json({ mesaj: "Kişi başarıyla eklendi.", kisi_id }, { status: 201 });
    }

  } catch (err) {
    return sunucuHatasi(err, "POST /eclub/listem/api/kisiler");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const k = await uttKontrol(adminSupabase, user.id);
    if ("hata" in k) return k.hata;

    const body = await request.json();
    const { kisi_id, eczane_id, islem, ad, soyad, eposta, telefon } = body;

    if (!kisi_id) return validasyonHatasi("kisi_id zorunludur.", ["kisi_id"]);
    if (!eczane_id) return validasyonHatasi("eczane_id zorunludur.", ["eczane_id"]);

    // Sahiplik: UTT bu eczaneyi listesine almış mı?
    if (!(await uttEczaneSahipMi(adminSupabase, user.id, eczane_id)))
      return rolHatasi("Bu eczane listenizde değil, işlem yapamazsınız.");

    // Kişi üzerinde işlem yapabilmek için kişinin de seçilen eczanede aktif
    // olması gerekir; yalnız eczane sahipliği başka bir kişinin id'sini
    // güncelleme yetkisi vermez.
    const { data: bag, error: bagError } = await adminSupabase
      .from("eclub_kisi_eczane")
      .select("id")
      .eq("kisi_id", kisi_id)
      .eq("eczane_id", eczane_id)
      .eq("aktif_mi", true)
      .maybeSingle();

    if (bagError) return hataYaniti("Kişi bağı sorgulanamadı.", "eclub_kisi_eczane SELECT — bağ kontrolü", bagError);
    const bagKontrol = veriKontrol(bag, "eclub_kisi_eczane SELECT — bağ kontrolü", "Aktif bağ bulunamadı.");
    if (!bagKontrol.gecerli) return bagKontrol.yanit;

    // ─── PASİFE AL (bağ soft delete) ───────────────────────────────────
    if (islem === "pasife_al") {
      const { error: updateError } = await adminSupabase
        .from("eclub_kisi_eczane")
        .update({ aktif_mi: false, bitis_tarihi: new Date().toISOString() })
        .eq("id", (bag as { id: string }).id);

      if (updateError) return hataYaniti("Kişi pasife alınamadı.", "eclub_kisi_eczane UPDATE — pasif", updateError);
      return NextResponse.json({ mesaj: "Kişi pasife alındı." }, { status: 200 });
    }

    // ─── BİLGİ GÜNCELLE (kimlik) ────────────────────────────────────────
    const { data: mevcutKisi, error: mevcutKisiError } = await adminSupabase
      .from("eclub_kisiler")
      .select("kisi_id, rol, ad, soyad, eposta, telefon, auth_user_id")
      .eq("kisi_id", kisi_id)
      .maybeSingle();

    if (mevcutKisiError)
      return hataYaniti("Kişi bilgisi sorgulanamadı.", "eclub_kisiler SELECT — güncelleme öncesi", mevcutKisiError);
    const kisiKontrol = veriKontrol(
      mevcutKisi as EclubKisiKimlik | null,
      "eclub_kisiler SELECT — güncelleme öncesi",
      "Kişi bulunamadı."
    );
    if (!kisiKontrol.gecerli) return kisiKontrol.yanit;
    const eskiKisi = kisiKontrol.veri;

    const guncellenecek: Record<string, unknown> = {};
    if (ad !== undefined) {
      if (typeof ad !== "string" || ad.trim().length === 0) return validasyonHatasi("Ad zorunludur.", ["ad"]);
      if (ad.length > 200) return validasyonHatasi("Ad 200 karakterden uzun olamaz.", ["ad"]);
      guncellenecek.ad = ad.trim();
    }
    if (soyad !== undefined) {
      if (typeof soyad !== "string" || soyad.trim().length === 0) return validasyonHatasi("Soyad zorunludur.", ["soyad"]);
      if (soyad.length > 200) return validasyonHatasi("Soyad 200 karakterden uzun olamaz.", ["soyad"]);
      guncellenecek.soyad = soyad.trim();
    }
    if (eposta !== undefined) {
      if (typeof eposta !== "string" || eposta.trim().length === 0) return validasyonHatasi("E-posta zorunludur.", ["eposta"]);
      if (eposta.length > 200) return validasyonHatasi("E-posta 200 karakterden uzun olamaz.", ["eposta"]);
      const epostaTemiz = eposta.trim().toLowerCase();
      if (!epostaGecerliMi(epostaTemiz)) return validasyonHatasi("Geçerli bir e-posta adresi giriniz.", ["eposta"]);
      guncellenecek.eposta = epostaTemiz;
    }
    if (telefon !== undefined) {
      if (typeof telefon !== "string" || telefon.trim().length === 0) return validasyonHatasi("Telefon zorunludur.", ["telefon"]);
      const telefonTemiz = telefon.trim();
      if (!telefonGecerliMi(telefonTemiz)) return validasyonHatasi("Telefon 11 haneli sayı olmalıdır.", ["telefon"]);
      const musteriKontrol = await eczanemMusterisiTelefonMu(adminSupabase, telefonTemiz);
      if (!musteriKontrol.ok) {
        return hataYaniti("Eczanem müşteri kimliği doğrulanamadı.", "eczanem_musteriler SELECT — E-Club telefon güncelleme kontrolü", musteriKontrol.hata);
      }
      if (musteriKontrol.musteriMi) {
        return validasyonHatasi(ECZANEM_MUSTERISI_ECLUB_UYESI_OLAMAZ_MESAJI, ["telefon"]);
      }
      guncellenecek.telefon = telefonTemiz;
    }

    if (Object.keys(guncellenecek).length === 0)
      return validasyonHatasi("Güncellenecek alan zorunludur.", ["ad", "soyad", "eposta", "telefon", "islem"]);

    const epostaDegisti = typeof guncellenecek.eposta === "string"
      && guncellenecek.eposta !== eskiKisi.eposta.toLowerCase();
    const adDegisti = typeof guncellenecek.ad === "string" && guncellenecek.ad !== eskiKisi.ad;
    const soyadDegisti = typeof guncellenecek.soyad === "string" && guncellenecek.soyad !== eskiKisi.soyad;
    const authDegisecek = !!eskiKisi.auth_user_id && (epostaDegisti || adDegisti || soyadDegisti);

    let eskiAuthEposta: string | undefined;
    let eskiAuthMetadata: Record<string, unknown> | undefined;
    if (authDegisecek && eskiKisi.auth_user_id) {
      const { data: authData, error: authOkumaError } = await adminSupabase.auth.admin.getUserById(eskiKisi.auth_user_id);
      if (authOkumaError || !authData.user) {
        return hataYaniti(
          "Kişinin giriş hesabı doğrulanamadığı için bilgi güncellenmedi.",
          "auth.admin.getUserById — eclub kişi",
          authOkumaError
        );
      }

      eskiAuthEposta = authData.user.email;
      eskiAuthMetadata = authData.user.user_metadata;
      const { error: authGuncellemeError } = await adminSupabase.auth.admin.updateUserById(eskiKisi.auth_user_id, {
        ...(epostaDegisti ? { email: guncellenecek.eposta as string, email_confirm: true } : {}),
        user_metadata: {
          ...eskiAuthMetadata,
          rol: eskiKisi.rol,
          ad: (guncellenecek.ad as string | undefined) ?? eskiKisi.ad,
          soyad: (guncellenecek.soyad as string | undefined) ?? eskiKisi.soyad,
          eclub_kisi: true,
        },
      });

      if (authGuncellemeError) {
        const mesaj = /already|registered|exists/i.test(authGuncellemeError.message)
          ? "Bu e-posta başka bir giriş hesabında kayıtlı."
          : "Kişinin giriş bilgileri güncellenemedi.";
        return validasyonHatasi(mesaj, epostaDegisti ? ["eposta"] : ["ad", "soyad"]);
      }
    }

    const { data: guncellenenKisi, error: updateError } = await adminSupabase
      .from("eclub_kisiler")
      .update(guncellenecek)
      .eq("kisi_id", kisi_id)
      .select("kisi_id")
      .maybeSingle();

    if (updateError || !guncellenenKisi) {
      if (authDegisecek && eskiKisi.auth_user_id) {
        const { error: authGeriAlmaError } = await adminSupabase.auth.admin.updateUserById(eskiKisi.auth_user_id, {
          ...(eskiAuthEposta ? { email: eskiAuthEposta, email_confirm: true } : {}),
          ...(eskiAuthMetadata ? { user_metadata: eskiAuthMetadata } : {}),
        });
        if (authGeriAlmaError) {
          return hataYaniti(
            "Kişi bilgisi güncellenemedi ve giriş bilgileri geri alınamadı; yönetici kontrolü gerekir.",
            "eclub_kisiler UPDATE + Auth geri alma",
            authGeriAlmaError
          );
        }
      }
      const benzersiz = benzersizlikHatasi(updateError);
      if (benzersiz) return validasyonHatasi(benzersiz.mesaj, [benzersiz.alan]);
      return hataYaniti(
        "Kişi güncellenemedi.",
        "eclub_kisiler UPDATE",
        updateError ?? new Error("Güncellenecek kişi bulunamadı.")
      );
    }

    return NextResponse.json({ mesaj: "Kişi başarıyla güncellendi." }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "PUT /eclub/listem/api/kisiler");
  }
}
