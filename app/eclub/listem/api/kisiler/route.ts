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
import { hataYaniti, veriKontrol, sunucuHatasi, validasyonHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import type { SupabaseClient } from "@supabase/supabase-js";

const ECLUB_UTT_ROLLERI = ["utt", "kd_utt"];
const ECLUB_KISI_ROLLERI = ["eczaci", "eczane_teknisyeni"];

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

async function uttKontrol(adminSupabase: SupabaseClient, userId: string): Promise<UttKontrolSonuc> {
  const { data: kullanici, error } = await adminSupabase
    .from("kullanicilar")
    .select("rol, firma_id")
    .eq("kullanici_id", userId)
    .single();
  if (error || !kullanici) return { hata: hataYaniti("Kullanıcı sorgulanamadı.", "kullanicilar SELECT", error, 404) };
  const rolKucu = (kullanici.rol ?? "").toLowerCase();
  if (!ECLUB_UTT_ROLLERI.includes(rolKucu)) return { hata: rolHatasi("Bu sayfaya yalnız UTT/KD_UTT erişebilir.") };
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
      .select("eczane_id, eclub_eczaneler ( eczane_adi )")
      .eq("baglayan_utt_id", user.id)
      .eq("aktif_mi", true);

    if (iliskiError) return hataYaniti("Eczaneler çekilemedi.", "eclub_eczane_firma SELECT — baglayan_utt_id", iliskiError);

    const eczaneIdler: string[] = [];
    const eczaneAdiMap = new Map<string, string>();
    type EczaneAd = { eczane_adi: string };
    for (const il of iliskiler ?? []) {
      const eczane_id = (il as { eczane_id: string }).eczane_id;
      eczaneIdler.push(eczane_id);
      const eRaw = (il as { eclub_eczaneler?: EczaneAd | EczaneAd[] }).eclub_eczaneler;
      const e = Array.isArray(eRaw) ? eRaw[0] : eRaw;
      if (e) eczaneAdiMap.set(eczane_id, e.eczane_adi);
    }

    if (eczaneIdler.length === 0) return NextResponse.json({ kisiler: [] }, { status: 200 });

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

    return NextResponse.json({ kisiler: sonuc }, { status: 200 });

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
    if (!ECLUB_KISI_ROLLERI.includes(rolTemiz)) return validasyonHatasi("Geçersiz rol.", ["rol"]);

    const epostaTemiz = eposta.trim().toLowerCase();
    if (!epostaGecerliMi(epostaTemiz)) return validasyonHatasi("Geçerli bir e-posta adresi giriniz.", ["eposta"]);

    const telefonTemiz = telefon.trim();
    if (!telefonGecerliMi(telefonTemiz)) return validasyonHatasi("Telefon 11 haneli sayı olmalıdır.", ["telefon"]);

    // Sahiplik: UTT bu eczaneyi listesine almış mı?
    if (!(await uttEczaneSahipMi(adminSupabase, user.id, eczane_id)))
      return rolHatasi("Bu eczane listenizde değil, kişi ekleyemezsiniz.");

    // Eczacı ise: bu eczanede zaten aktif eczacı var mı? (tek eczacı kuralı)
    if (rolTemiz === "eczaci") {
      const { data: mevcutBaglar } = await adminSupabase
        .from("eclub_kisi_eczane")
        .select("kisi_id, eclub_kisiler ( rol )")
        .eq("eczane_id", eczane_id)
        .eq("aktif_mi", true);
      const eczaciVar = (mevcutBaglar ?? []).some((b) => {
        const kRaw = (b as { eclub_kisiler?: { rol: string } | { rol: string }[] }).eclub_kisiler;
        const kk = Array.isArray(kRaw) ? kRaw[0] : kRaw;
        return kk?.rol === "eczaci";
      });
      if (eczaciVar) return validasyonHatasi("Bu eczanede zaten aktif bir eczacı kayıtlı.", ["rol"]);
    }

    // Kişi havuzda var mı (eposta veya telefon)?
    const { data: mevcutKisi } = await adminSupabase
      .from("eclub_kisiler")
      .select("kisi_id, rol")
      .or(`eposta.eq.${epostaTemiz},telefon.eq.${telefonTemiz}`)
      .maybeSingle();

    let kisi_id: string;

    if (mevcutKisi) {
      // Havuzda var → kimlik yaratma. Rol uyumu kontrolü.
      if (mevcutKisi.rol !== rolTemiz)
        return validasyonHatasi(`Bu kişi sistemde farklı bir rolle (${mevcutKisi.rol}) kayıtlı.`, ["rol"]);

      // Tek aktif GLN kuralı: başka eczanede aktif bağı var mı?
      const { data: aktifBag } = await adminSupabase
        .from("eclub_kisi_eczane")
        .select("eczane_id, eclub_eczaneler ( eczane_adi )")
        .eq("kisi_id", mevcutKisi.kisi_id)
        .eq("aktif_mi", true)
        .maybeSingle();

      if (aktifBag) {
        if (aktifBag.eczane_id === eczane_id)
          return validasyonHatasi("Bu kişi zaten bu eczanede kayıtlı.", ["eposta"]);
        const eRaw = (aktifBag as { eclub_eczaneler?: { eczane_adi: string } | { eczane_adi: string }[] }).eclub_eczaneler;
        const e = Array.isArray(eRaw) ? eRaw[0] : eRaw;
        const eczaneAdi = e?.eczane_adi ?? "başka bir eczane";
        return validasyonHatasi(
          `${ad.trim()} ${soyad.trim()} zaten ${eczaneAdi}'nde kayıtlı. Önce admin oradan çıkarmalı.`,
          ["eposta"]
        );
      }

      kisi_id = mevcutKisi.kisi_id;
    } else {
      // Havuzda yok → yeni kimlik. Önce Supabase auth hesabı, sonra eclub_kisiler.
      // Şifre yalnızca yeni kişi için zorunlu (mevcut kişide auth zaten var).
      if (!sifre || typeof sifre !== "string" || sifre.length < 6)
        return validasyonHatasi("Yeni kişi için en az 6 karakter şifre zorunludur.", ["sifre"]);

      const { data: authData, error: authInsertError } = await adminSupabase.auth.admin.createUser({
        email: epostaTemiz,
        password: sifre,
        user_metadata: { rol: rolTemiz, ad: ad.trim(), soyad: soyad.trim(), eclub_kisi: true },
        email_confirm: true,
      });

      if (authInsertError || !authData.user) {
        const benzersiz = benzersizlikHatasi(authInsertError);
        if (benzersiz) return validasyonHatasi(benzersiz.mesaj, [benzersiz.alan]);
        return hataYaniti("Kişi auth hesabı oluşturulamadı.", "auth.admin.createUser — eclub kişi", authInsertError);
      }

      const authUserId = authData.user.id;

      const { data: yeniKisi, error: kisiInsertError } = await adminSupabase
        .from("eclub_kisiler")
        .insert({ rol: rolTemiz, ad: ad.trim(), soyad: soyad.trim(), eposta: epostaTemiz, telefon: telefonTemiz, auth_user_id: authUserId })
        .select("kisi_id")
        .single();

      if (kisiInsertError || !yeniKisi) {
        // Rollback: kimlik yazılamadıysa auth kaydını geri al (yetim auth kalmasın).
        await adminSupabase.auth.admin.deleteUser(authUserId);
        const benzersiz = benzersizlikHatasi(kisiInsertError);
        if (benzersiz) return validasyonHatasi(benzersiz.mesaj, [benzersiz.alan]);
        return hataYaniti("Kişi kaydedilemedi.", "eclub_kisiler INSERT", kisiInsertError);
      }
      kisi_id = yeniKisi.kisi_id;

      // Kişi-eczane bağı oluştur (aktif). Başarısızsa hem kimlik hem auth geri alınır.
      const { error: yeniBagError } = await adminSupabase
        .from("eclub_kisi_eczane")
        .insert({ kisi_id, eczane_id, aktif_mi: true });

      if (yeniBagError) {
        await adminSupabase.from("eclub_kisiler").delete().eq("kisi_id", kisi_id);
        await adminSupabase.auth.admin.deleteUser(authUserId);
        return hataYaniti("Kişi eczaneye bağlanamadı.", "eclub_kisi_eczane INSERT — yeni kişi", yeniBagError);
      }

      return NextResponse.json({ mesaj: "Kişi başarıyla eklendi.", kisi_id }, { status: 201 });
    }

    // Mevcut kişi (havuzda vardı) → sadece yeni eczane bağı oluştur.
    const { error: bagError } = await adminSupabase
      .from("eclub_kisi_eczane")
      .insert({ kisi_id, eczane_id, aktif_mi: true });

    if (bagError) return hataYaniti("Kişi eczaneye bağlanamadı.", "eclub_kisi_eczane INSERT", bagError);

    return NextResponse.json({ mesaj: "Kişi başarıyla eklendi.", kisi_id }, { status: 201 });

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

    // ─── PASİFE AL (bağ soft delete) ───────────────────────────────────
    if (islem === "pasife_al") {
      const { data: bag, error: bagError } = await adminSupabase
        .from("eclub_kisi_eczane")
        .select("id")
        .eq("kisi_id", kisi_id)
        .eq("eczane_id", eczane_id)
        .eq("aktif_mi", true)
        .maybeSingle();

      const bagKontrol = veriKontrol(bag, "eclub_kisi_eczane SELECT — bağ kontrolü", "Aktif bağ bulunamadı.");
      if (!bagKontrol.gecerli) return bagKontrol.yanit;
      if (bagError) return hataYaniti("Bağ sorgulanamadı.", "eclub_kisi_eczane SELECT", bagError, 404);

      const { error: updateError } = await adminSupabase
        .from("eclub_kisi_eczane")
        .update({ aktif_mi: false, bitis_tarihi: new Date().toISOString() })
        .eq("id", (bag as { id: string }).id);

      if (updateError) return hataYaniti("Kişi pasife alınamadı.", "eclub_kisi_eczane UPDATE — pasif", updateError);
      return NextResponse.json({ mesaj: "Kişi pasife alındı." }, { status: 200 });
    }

    // ─── BİLGİ GÜNCELLE (kimlik) ────────────────────────────────────────
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
      guncellenecek.telefon = telefonTemiz;
    }

    if (Object.keys(guncellenecek).length === 0)
      return validasyonHatasi("Güncellenecek alan zorunludur.", ["ad", "soyad", "eposta", "telefon", "islem"]);

    const { error: updateError } = await adminSupabase
      .from("eclub_kisiler")
      .update(guncellenecek)
      .eq("kisi_id", kisi_id);

    if (updateError) {
      const benzersiz = benzersizlikHatasi(updateError);
      if (benzersiz) return validasyonHatasi(benzersiz.mesaj, [benzersiz.alan]);
      return hataYaniti("Kişi güncellenemedi.", "eclub_kisiler UPDATE", updateError);
    }

    return NextResponse.json({ mesaj: "Kişi başarıyla güncellendi." }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "PUT /eclub/listem/api/kisiler");
  }
}