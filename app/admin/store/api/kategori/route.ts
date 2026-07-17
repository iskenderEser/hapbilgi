// app/admin/store/api/kategori/route.ts
//
// Admin için kategori CRUD endpoint'i.
//
// GET    → Tüm kategorileri (aktif + pasif) listeler
// POST   → Yeni kategori ekler. Body: { ad, sira?, aktif_mi? }
// PATCH  → Mevcut kategoriyi günceller. Body: { kategori_id, ad?, sira?, aktif_mi? }
// DELETE → Kategoriyi siler. Query: ?kategori_id=X
//          Kategori altında ürün varsa silinemez.
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
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { adminGirisKontrol } from "@/lib/utils/adminGirisKontrol";

// ─── Yardımcı: admin yetki kontrolü ──────────────────────────────────────────

async function yetkiAl(_request: NextRequest) {
  // B-26: tek bekçi — adminGirisKontrol (yerel kopya kaldırıldı).
  const kontrol = await adminGirisKontrol();
  if (!kontrol.gecerli) {
    return { hata: kontrol.yanit, user: undefined, rol: undefined, adminSupabase: undefined };
  }
  return { hata: undefined, user: { id: kontrol.kullaniciId }, rol: kontrol.rol, adminSupabase: createAdminClient() };
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const yetki = await yetkiAl(request);
    if (yetki.hata) return yetki.hata;
    const { adminSupabase } = yetki;

    const { data, error } = await adminSupabase
      .from("store_kategoriler")
      .select("kategori_id, ad, sira, aktif_mi, created_at")
      .order("sira", { ascending: true });

    if (error) {
      return hataYaniti("Kategoriler çekilemedi.", "store_kategoriler SELECT", error);
    }

    return NextResponse.json({ kategoriler: data ?? [] }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /admin/store/api/kategori");
  }
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const yetki = await yetkiAl(request);
    if (yetki.hata) return yetki.hata;
    const { adminSupabase } = yetki;

    const body = await request.json();
    const { ad, sira, aktif_mi } = body;

    if (!ad || typeof ad !== "string" || ad.trim() === "") {
      return validasyonHatasi("Kategori adı zorunludur.", ["ad"]);
    }

    const siraSayi = sira !== undefined ? Number(sira) : 0;
    if (!Number.isInteger(siraSayi) || siraSayi < 0) {
      return validasyonHatasi("Sıra non-negatif tam sayı olmalı.", ["sira"]);
    }

    const { error } = await adminSupabase
      .from("store_kategoriler")
      .insert({
        ad: ad.trim(),
        sira: siraSayi,
        aktif_mi: aktif_mi !== undefined ? Boolean(aktif_mi) : true,
      });

    if (error) {
      // UNIQUE constraint violation (aynı isimde kategori varsa)
      if (error.code === "23505") {
        return isKuraluHatasi("Bu isimde bir kategori zaten var.");
      }
      return hataYaniti("Kategori eklenemedi.", "store_kategoriler INSERT", error);
    }

    return NextResponse.json({ mesaj: "Kategori eklendi." }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /admin/store/api/kategori");
  }
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const yetki = await yetkiAl(request);
    if (yetki.hata) return yetki.hata;
    const { adminSupabase } = yetki;

    const body = await request.json();
    const { kategori_id, ad, sira, aktif_mi } = body;

    if (!kategori_id || typeof kategori_id !== "string") {
      return validasyonHatasi("kategori_id zorunludur.", ["kategori_id"]);
    }

    const guncellenecek: Record<string, any> = {};
    if (ad !== undefined) {
      if (typeof ad !== "string" || ad.trim() === "") {
        return validasyonHatasi("Kategori adı boş olamaz.", ["ad"]);
      }
      guncellenecek.ad = ad.trim();
    }
    if (sira !== undefined) {
      const siraSayi = Number(sira);
      if (!Number.isInteger(siraSayi) || siraSayi < 0) {
        return validasyonHatasi("Sıra non-negatif tam sayı olmalı.", ["sira"]);
      }
      guncellenecek.sira = siraSayi;
    }
    if (aktif_mi !== undefined) {
      guncellenecek.aktif_mi = Boolean(aktif_mi);
    }

    if (Object.keys(guncellenecek).length === 0) {
      return validasyonHatasi("Güncellenecek alan belirtilmedi.", []);
    }

    const { error } = await adminSupabase
      .from("store_kategoriler")
      .update(guncellenecek)
      .eq("kategori_id", kategori_id);

    if (error) {
      if (error.code === "23505") {
        return isKuraluHatasi("Bu isimde bir kategori zaten var.");
      }
      return hataYaniti("Kategori güncellenemedi.", "store_kategoriler UPDATE", error);
    }

    return NextResponse.json({ mesaj: "Kategori güncellendi." }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "PATCH /admin/store/api/kategori");
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const yetki = await yetkiAl(request);
    if (yetki.hata) return yetki.hata;
    const { adminSupabase } = yetki;

    const { searchParams } = new URL(request.url);
    const kategori_id = searchParams.get("kategori_id");

    if (!kategori_id) {
      return validasyonHatasi("kategori_id zorunludur.", ["kategori_id"]);
    }

    // Önce bu kategoride ürün var mı kontrol et
    const { count, error: countError } = await adminSupabase
      .from("store_urunler")
      .select("urun_id", { count: "exact", head: true })
      .eq("kategori_id", kategori_id);

    if (countError) {
      return hataYaniti("Kategori ürün kontrolü başarısız.", "store_urunler COUNT", countError);
    }

    if ((count ?? 0) > 0) {
      return isKuraluHatasi(
        `Bu kategoride ${count} ürün var. Önce ürünleri silmeli veya başka kategoriye taşımalısın.`
      );
    }

    // Sil
    const { error: deleteError } = await adminSupabase
      .from("store_kategoriler")
      .delete()
      .eq("kategori_id", kategori_id);

    if (deleteError) {
      return hataYaniti("Kategori silinemedi.", "store_kategoriler DELETE", deleteError);
    }

    return NextResponse.json({ mesaj: "Kategori silindi." }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "DELETE /admin/store/api/kategori");
  }
}