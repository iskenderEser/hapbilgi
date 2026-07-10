// app/admin/store/api/urun/route.ts
//
// Admin için ürün CRUD endpoint'i.
//
// GET    → Tüm ürünleri (aktif + pasif) kategori adıyla listeler
// POST   → Yeni ürün ekler.
//          Body: { kategori_id, ad, aciklama?, gorsel_url?, puan_fiyati, stok?, aktif_mi? }
// PATCH  → Mevcut ürünü günceller.
//          Body: { urun_id, ...alanlar }
//          Görsel URL değişirse eski görsel Storage'dan silinir.
// DELETE → Ürünü siler. Query: ?urun_id=X
//          Aktif siparişte (beklemede/kargoda) varsa silinemez.
//          Görseli varsa Storage'dan da silinir.
//
// Yetki: ADMIN_ROLLER

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  hataYaniti,
  sunucuHatasi,
  yetkiHatasi,
  rolHatasi,
  validasyonHatasi,
  isKuraluHatasi,
} from "@/lib/utils/hataIsle";
import { ADMIN_ROLLER } from "@/lib/utils/roller";
import { gorselSil, urlDenYolCikar } from "@/lib/store/storage";
import { rolCozucu } from "@/lib/utils/rolCozucu";

// ─── Yardımcı: admin yetki kontrolü ──────────────────────────────────────────

async function yetkiAl(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { hata: yetkiHatasi() };

  const adminSupabase = createAdminClient();
  const rol = await rolCozucu(adminSupabase, user.id);
  if (!ADMIN_ROLLER.includes(rol)) {
    return { hata: rolHatasi("Bu işleme yalnızca admin erişebilir.") };
  }

  return { user, rol, adminSupabase };
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const yetki = await yetkiAl(request);
    if (yetki.hata) return yetki.hata;
    const { adminSupabase } = yetki;

    const { data, error } = await adminSupabase
      .from("store_urunler")
      .select(`
        urun_id,
        kategori_id,
        ad,
        aciklama,
        gorsel_url,
        puan_fiyati,
        stok,
        aktif_mi,
        created_at,
        updated_at,
        store_kategoriler ( ad )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      return hataYaniti("Ürünler çekilemedi.", "store_urunler SELECT", error);
    }

    return NextResponse.json({ urunler: data ?? [] }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /admin/store/api/urun");
  }
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const yetki = await yetkiAl(request);
    if (yetki.hata) return yetki.hata;
    const { adminSupabase } = yetki;

    const body = await request.json();
    const { kategori_id, ad, aciklama, gorsel_url, puan_fiyati, stok, aktif_mi } = body;

    // Zorunlu alanlar
    if (!kategori_id || typeof kategori_id !== "string") {
      return validasyonHatasi("kategori_id zorunludur.", ["kategori_id"]);
    }
    if (!ad || typeof ad !== "string" || ad.trim() === "") {
      return validasyonHatasi("Ürün adı zorunludur.", ["ad"]);
    }

    const fiyatSayi = Number(puan_fiyati);
    if (!Number.isInteger(fiyatSayi) || fiyatSayi <= 0) {
      return validasyonHatasi("puan_fiyati pozitif tam sayı olmalı.", ["puan_fiyati"]);
    }

    const stokSayi = stok !== undefined ? Number(stok) : 0;
    if (!Number.isInteger(stokSayi) || stokSayi < 0) {
      return validasyonHatasi("stok non-negatif tam sayı olmalı.", ["stok"]);
    }

    // Kategori var mı kontrol
    const { data: kategoriVar, error: katError } = await adminSupabase
      .from("store_kategoriler")
      .select("kategori_id")
      .eq("kategori_id", kategori_id)
      .single();

    if (katError || !kategoriVar) {
      return isKuraluHatasi("Geçersiz kategori.");
    }

    const { error } = await adminSupabase
      .from("store_urunler")
      .insert({
        kategori_id,
        ad: ad.trim(),
        aciklama: aciklama?.trim() ?? null,
        gorsel_url: gorsel_url?.trim() ?? null,
        puan_fiyati: fiyatSayi,
        stok: stokSayi,
        aktif_mi: aktif_mi !== undefined ? Boolean(aktif_mi) : true,
      });

    if (error) {
      return hataYaniti("Ürün eklenemedi.", "store_urunler INSERT", error);
    }

    return NextResponse.json({ mesaj: "Ürün eklendi." }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /admin/store/api/urun");
  }
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const yetki = await yetkiAl(request);
    if (yetki.hata) return yetki.hata;
    const { adminSupabase } = yetki;

    const body = await request.json();
    const { urun_id, kategori_id, ad, aciklama, gorsel_url, puan_fiyati, stok, aktif_mi } = body;

    if (!urun_id || typeof urun_id !== "string") {
      return validasyonHatasi("urun_id zorunludur.", ["urun_id"]);
    }

    // Mevcut ürünü al (eski görsel URL'i için)
    const { data: mevcutUrun, error: mevcutError } = await adminSupabase
      .from("store_urunler")
      .select("gorsel_url")
      .eq("urun_id", urun_id)
      .single();

    if (mevcutError || !mevcutUrun) {
      return isKuraluHatasi("Ürün bulunamadı.");
    }

    const guncellenecek: Record<string, any> = {};
    if (kategori_id !== undefined) guncellenecek.kategori_id = kategori_id;
    if (ad !== undefined) {
      if (typeof ad !== "string" || ad.trim() === "") {
        return validasyonHatasi("Ürün adı boş olamaz.", ["ad"]);
      }
      guncellenecek.ad = ad.trim();
    }
    if (aciklama !== undefined) {
      guncellenecek.aciklama = aciklama?.trim() ?? null;
    }
    if (gorsel_url !== undefined) {
      guncellenecek.gorsel_url = gorsel_url?.trim() ?? null;
    }
    if (puan_fiyati !== undefined) {
      const fiyatSayi = Number(puan_fiyati);
      if (!Number.isInteger(fiyatSayi) || fiyatSayi <= 0) {
        return validasyonHatasi("puan_fiyati pozitif tam sayı olmalı.", ["puan_fiyati"]);
      }
      guncellenecek.puan_fiyati = fiyatSayi;
    }
    if (stok !== undefined) {
      const stokSayi = Number(stok);
      if (!Number.isInteger(stokSayi) || stokSayi < 0) {
        return validasyonHatasi("stok non-negatif tam sayı olmalı.", ["stok"]);
      }
      guncellenecek.stok = stokSayi;
    }
    if (aktif_mi !== undefined) {
      guncellenecek.aktif_mi = Boolean(aktif_mi);
    }

    if (Object.keys(guncellenecek).length === 0) {
      return validasyonHatasi("Güncellenecek alan belirtilmedi.", []);
    }

    guncellenecek.updated_at = new Date().toISOString();

    const { error } = await adminSupabase
      .from("store_urunler")
      .update(guncellenecek)
      .eq("urun_id", urun_id);

    if (error) {
      return hataYaniti("Ürün güncellenemedi.", "store_urunler UPDATE", error);
    }

    // Görsel URL değişti mi? Eski görseli Storage'dan sil.
    if (
      gorsel_url !== undefined &&
      mevcutUrun.gorsel_url &&
      mevcutUrun.gorsel_url !== gorsel_url
    ) {
      const eskiYol = urlDenYolCikar(mevcutUrun.gorsel_url);
      if (eskiYol) {
        const silSonuc = await gorselSil(adminSupabase, eskiYol);
        if (!silSonuc.ok) {
          console.warn(
            "[urun PATCH] Eski görsel Storage'dan silinemedi:",
            silSonuc.error
          );
          // Ürün zaten güncellendiği için hata fırlatmıyoruz, sadece logluyoruz
        }
      }
    }

    return NextResponse.json({ mesaj: "Ürün güncellendi." }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "PATCH /admin/store/api/urun");
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const yetki = await yetkiAl(request);
    if (yetki.hata) return yetki.hata;
    const { adminSupabase } = yetki;

    const { searchParams } = new URL(request.url);
    const urun_id = searchParams.get("urun_id");

    if (!urun_id) {
      return validasyonHatasi("urun_id zorunludur.", ["urun_id"]);
    }

    // Aktif siparişlerde var mı kontrol (beklemede veya kargoda)
    const { count, error: countError } = await adminSupabase
      .from("store_siparisler")
      .select("siparis_id", { count: "exact", head: true })
      .eq("urun_id", urun_id)
      .in("durum", ["beklemede", "kargoda"]);

    if (countError) {
      return hataYaniti("Sipariş kontrolü başarısız.", "store_siparisler COUNT", countError);
    }

    if ((count ?? 0) > 0) {
      return isKuraluHatasi(
        `Bu ürün ${count} aktif siparişte var. Silmek yerine "aktif değil" yapabilirsin.`
      );
    }

    // Önce görsel URL'i al
    const { data: urun, error: urunError } = await adminSupabase
      .from("store_urunler")
      .select("gorsel_url")
      .eq("urun_id", urun_id)
      .single();

    if (urunError || !urun) {
      return isKuraluHatasi("Ürün bulunamadı.");
    }

    // Ürünü sil
    const { error: deleteError } = await adminSupabase
      .from("store_urunler")
      .delete()
      .eq("urun_id", urun_id);

    if (deleteError) {
      return hataYaniti("Ürün silinemedi.", "store_urunler DELETE", deleteError);
    }

    // Görseli Storage'dan sil (varsa)
    if (urun.gorsel_url) {
      const yol = urlDenYolCikar(urun.gorsel_url);
      if (yol) {
        const silSonuc = await gorselSil(adminSupabase, yol);
        if (!silSonuc.ok) {
          console.warn(
            "[urun DELETE] Görsel Storage'dan silinemedi:",
            silSonuc.error
          );
          // Ürün zaten silindi, hata fırlatmıyoruz
        }
      }
    }

    return NextResponse.json({ mesaj: "Ürün silindi." }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "DELETE /admin/store/api/urun");
  }
}