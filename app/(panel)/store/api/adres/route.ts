// app/store/api/adres/route.ts
//
// Kullanıcı adres yönetimi endpoint'i.
//
// GET    → kullanıcının tüm adreslerini döner
// POST   → yeni adres ekler (body: AdresInput)
// PATCH  → mevcut adresi günceller (body: { adres_id, ...AdresInput partial })
//         veya varsayılan yapar (body: { adres_id, sadece_varsayilan_yap: true })
// DELETE → adresi siler (query: adres_id)
//
// Yetki: STORE_ALABILEN_ROLLER (utt, kd_utt, bm)
// Her endpoint kullanıcının kendi adresleri üzerinde çalışır;
// lib/store/adres.ts içinde sahiplik kontrolü yapılır.
//
// Firma erişim kontrolü (hbstore_aktif) proxy.ts HBStore bekçisinde merkezi
// olarak yapılır — /store yolu kapalı firmada zaten 403 döner.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  hataYaniti,
  sunucuHatasi,
  yetkiHatasi,
  rolHatasi,
  validasyonHatasi,
} from "@/lib/utils/hataIsle";
import { STORE_ALABILEN_ROLLER } from "@/lib/utils/roller";
import {
  adresleriListele,
  adresEkle,
  adresGuncelle,
  adresSil,
  varsayilanYap,
} from "@/lib/tclub/store/adres";
import type { AdresInput } from "@/lib/tclub/store/tipler";
import { rolCozucu } from "@/lib/utils/rolCozucu";

// ─── Yardımcı: rol kontrolü ──────────────────────────────────────────────────

async function yetkiAl(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { hata: yetkiHatasi() };

  const adminSupabase = createAdminClient();
  const rol = await rolCozucu(adminSupabase, user.id);
  if (!STORE_ALABILEN_ROLLER.includes(rol)) {
    return { hata: rolHatasi("Bu işleme yetkiniz yok.") };
  }


  return { user, rol, adminSupabase };
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const yetki = await yetkiAl(request);
    if (yetki.hata) return yetki.hata;
    const { user, adminSupabase } = yetki;

    const adresler = await adresleriListele(adminSupabase, user.id);
    return NextResponse.json({ adresler }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /store/api/adres");
  }
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const yetki = await yetkiAl(request);
    if (yetki.hata) return yetki.hata;
    const { user, adminSupabase } = yetki;

    const body = await request.json();

    // Zorunlu alan kontrolü
    const zorunlular: (keyof AdresInput)[] = [
      "baslik",
      "telefon",
      "il",
      "ilce",
      "adres_detay",
    ];
    for (const alan of zorunlular) {
      if (!body[alan] || typeof body[alan] !== "string" || body[alan].trim() === "") {
        return validasyonHatasi(`${alan} alanı zorunludur.`, [alan]);
      }
    }

    // Kimlik doğrulaması: Alıcı adı profil tablosundan doğrulanır
    const { data: profilKullanici, error: profilHata } = await adminSupabase
      .from("kullanicilar")
      .select("ad, soyad")
      .eq("kullanici_id", user.id)
      .single();

    if (profilHata || !profilKullanici) {
      return hataYaniti("Kullanıcı profil bilgileri doğrulanamadı.", "profilDogrula", profilHata);
    }

    const dogrulanmisAdSoyad = [profilKullanici.ad, profilKullanici.soyad]
      .filter((parca): parca is string => typeof parca === "string" && parca.trim().length > 0)
      .map((parca) => parca.trim())
      .join(" ");

    if (!dogrulanmisAdSoyad) {
      return validasyonHatasi("Profilinizde kayıtlı ad soyad bulunamadı. Lütfen önce profilinizi güncelleyin.", ["alici_adi"]);
    }

    if (body.alici_adi && typeof body.alici_adi === "string" && body.alici_adi.trim() !== dogrulanmisAdSoyad) {
      return validasyonHatasi("Alıcı adı soyadı profilinizdeki bilgilerle eşleşmiyor.", ["alici_adi"]);
    }

    const input: AdresInput = {
      baslik: body.baslik.trim(),
      alici_adi: dogrulanmisAdSoyad,
      telefon: body.telefon.trim(),
      il: body.il.trim(),
      ilce: body.ilce.trim(),
      adres_detay: body.adres_detay.trim(),
      posta_kodu: body.posta_kodu?.trim() ?? null,
      varsayilan_mi: Boolean(body.varsayilan_mi),
    };

    const sonuc = await adresEkle(adminSupabase, user.id, input);
    if (!sonuc.ok) {
      return hataYaniti(sonuc.error ?? "Adres eklenemedi.", "adresEkle", null);
    }

    return NextResponse.json({ mesaj: "Adres eklendi." }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /store/api/adres");
  }
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const yetki = await yetkiAl(request);
    if (yetki.hata) return yetki.hata;
    const { user, adminSupabase } = yetki;

    const body = await request.json();
    const { adres_id, sadece_varsayilan_yap, ...guncellenecek } = body;

    if (!adres_id || typeof adres_id !== "string") {
      return validasyonHatasi("adres_id zorunludur.", ["adres_id"]);
    }

    // Hızlı yol: sadece varsayılan yap
    if (sadece_varsayilan_yap === true) {
      const sonuc = await varsayilanYap(adminSupabase, adres_id, user.id);
      if (!sonuc.ok) {
        return hataYaniti(sonuc.error ?? "Varsayılan adres ayarlanamadı.", "varsayilanYap", null);
      }
      return NextResponse.json({ mesaj: "Varsayılan adres güncellendi." }, { status: 200 });
    }

    // Kimlik doğrulaması: alici_adi güncellenmek isteniyorsa profille doğrulanır
    if (guncellenecek.alici_adi !== undefined) {
      const { data: profilKullanici, error: profilHata } = await adminSupabase
        .from("kullanicilar")
        .select("ad, soyad")
        .eq("kullanici_id", user.id)
        .single();

      if (profilHata || !profilKullanici) {
        return hataYaniti("Kullanıcı profil bilgileri doğrulanamadı.", "profilDogrula", profilHata);
      }

      const dogrulanmisAdSoyad = [profilKullanici.ad, profilKullanici.soyad]
        .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
        .map((p) => p.trim())
        .join(" ");

      if (guncellenecek.alici_adi.trim() !== dogrulanmisAdSoyad) {
        return validasyonHatasi("Alıcı adı soyadı profilinizdeki bilgilerle eşleşmiyor.", ["alici_adi"]);
      }
      guncellenecek.alici_adi = dogrulanmisAdSoyad;
    }

    // Genel güncelleme
    const sonuc = await adresGuncelle(adminSupabase, adres_id, user.id, guncellenecek);
    if (!sonuc.ok) {
      return hataYaniti(sonuc.error ?? "Adres güncellenemedi.", "adresGuncelle", null);
    }

    return NextResponse.json({ mesaj: "Adres güncellendi." }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "PATCH /store/api/adres");
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const yetki = await yetkiAl(request);
    if (yetki.hata) return yetki.hata;
    const { user, adminSupabase } = yetki;

    const { searchParams } = new URL(request.url);
    const adres_id = searchParams.get("adres_id");

    if (!adres_id) {
      return validasyonHatasi("adres_id zorunludur.", ["adres_id"]);
    }

    const sonuc = await adresSil(adminSupabase, adres_id, user.id);
    if (!sonuc.ok) {
      return hataYaniti(sonuc.error ?? "Adres silinemedi.", "adresSil", null);
    }

    return NextResponse.json({ mesaj: "Adres silindi." }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "DELETE /store/api/adres");
  }
}