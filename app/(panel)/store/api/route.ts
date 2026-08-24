// app/store/api/route.ts
//
// HBStore vitrin endpoint'i.
//
// GET ?tip=urunler&kategori_id=X  → Aktif ürünler (opsiyonel kategori filtresi)
// GET ?tip=kategoriler            → Aktif kategoriler
// GET ?tip=bakiye                 → Kullanıcının harcanabilir puanı
// GET ?tip=urun&urun_id=X         → Tek ürün detayı (ürün detay sayfası için)
//
// Yetki: STORE_ALABILEN_ROLLER (utt, kd_utt, bm)
// Vitrin sadece alıcılar içindir; diğer roller /store/siparisler sayfasına yönlenir.
// Firma modül erişimi proxy.ts bekçisine ek olarak burada da doğrulanır; ürün
// listesi, kategori listesi ve detay firma bazlı ürün istisnasına uyar.

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
import { harcamaBakiyesi } from "@/lib/tclub/store/bakiye";
import {
  firmaKapaliUrunIdleri,
  hbstoreFirmaBaglami,
} from "@/lib/tclub/store/firmaUrun";
import { rolCozucu } from "@/lib/utils/rolCozucu";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    // 2. Rol kontrolü
    const adminSupabase = createAdminClient();
    const rol = await rolCozucu(adminSupabase, user.id);
    if (!STORE_ALABILEN_ROLLER.includes(rol)) {
      return rolHatasi("HBStore'a erişim yetkiniz yok.");
    }

    const firmaBaglami = await hbstoreFirmaBaglami(adminSupabase, user.id);
    if (firmaBaglami.hata) {
      return hataYaniti(
        "Firma bilgisi alınamadı.",
        "HBStore firma bağlamı",
        firmaBaglami.hata,
      );
    }
    if (!firmaBaglami.firmaId || !firmaBaglami.hbstoreAktif) {
      return rolHatasi("Firmanız için HBStore kullanıma açık değil.");
    }

    const { searchParams } = new URL(request.url);
    const tip = searchParams.get("tip") || "urunler";

    // ─── tip=urunler ───────────────────────────────────────────────────────
    if (tip === "urunler") {
      const kategori_id = searchParams.get("kategori_id");

      let query = adminSupabase
        .from("store_urunler")
        .select("urun_id, kategori_id, ad, aciklama, gorsel_url, puan_fiyati, stok, aktif_mi, created_at")
        .eq("aktif_mi", true)
        .order("created_at", { ascending: false });

      if (kategori_id) {
        query = query.eq("kategori_id", kategori_id);
      }

      const { data, error } = await query;

      if (error) {
        return hataYaniti("Ürünler çekilemedi.", "store_urunler SELECT", error);
      }

      const urunler = data ?? [];
      const { kapaliUrunIdleri, hata: ayarHatasi } = await firmaKapaliUrunIdleri(
        adminSupabase,
        firmaBaglami.firmaId,
        urunler.map((urun) => urun.urun_id),
      );
      if (ayarHatasi) {
        return hataYaniti(
          "Firma ürün ayarları alınamadı.",
          "store_urun_firma_ayarlari SELECT",
          ayarHatasi,
        );
      }

      return NextResponse.json(
        { urunler: urunler.filter((urun) => !kapaliUrunIdleri.has(urun.urun_id)) },
        { status: 200 },
      );
    }

    // ─── tip=kategoriler ───────────────────────────────────────────────────
    if (tip === "kategoriler") {
      const { data: kategoriler, error } = await adminSupabase
        .from("store_kategoriler")
        .select("kategori_id, ad, sira, aktif_mi")
        .eq("aktif_mi", true)
        .order("sira", { ascending: true });

      if (error) {
        return hataYaniti("Kategoriler çekilemedi.", "store_kategoriler SELECT", error);
      }

      const { data: aktifUrunler, error: urunError } = await adminSupabase
        .from("store_urunler")
        .select("urun_id, kategori_id")
        .eq("aktif_mi", true);

      if (urunError) {
        return hataYaniti("Kategori ürünleri çekilemedi.", "store_urunler SELECT — kategori görünürlüğü", urunError);
      }

      const { kapaliUrunIdleri, hata: ayarHatasi } = await firmaKapaliUrunIdleri(
        adminSupabase,
        firmaBaglami.firmaId,
        (aktifUrunler ?? []).map((urun) => urun.urun_id),
      );
      if (ayarHatasi) {
        return hataYaniti(
          "Firma ürün ayarları alınamadı.",
          "store_urun_firma_ayarlari SELECT — kategori görünürlüğü",
          ayarHatasi,
        );
      }

      const gorunenKategoriIdleri = new Set(
        (aktifUrunler ?? [])
          .filter((urun) => !kapaliUrunIdleri.has(urun.urun_id))
          .map((urun) => urun.kategori_id),
      );

      return NextResponse.json(
        { kategoriler: (kategoriler ?? []).filter((kategori) => gorunenKategoriIdleri.has(kategori.kategori_id)) },
        { status: 200 },
      );
    }

    // ─── tip=bakiye ────────────────────────────────────────────────────────
    if (tip === "bakiye") {
      const bakiye = await harcamaBakiyesi(adminSupabase, user.id);
      return NextResponse.json({ bakiye }, { status: 200 });
    }

    // ─── tip=urun (tek ürün detayı) ────────────────────────────────────────
    if (tip === "urun") {
      const urun_id = searchParams.get("urun_id");
      if (!urun_id) {
        return validasyonHatasi("urun_id zorunludur.", ["urun_id"]);
      }

      const { data: urun, error } = await adminSupabase
        .from("store_urunler")
        .select("urun_id, kategori_id, ad, aciklama, gorsel_url, puan_fiyati, stok, aktif_mi, created_at")
        .eq("urun_id", urun_id)
        .eq("aktif_mi", true)
        .maybeSingle();

      if (error) {
        return hataYaniti("Ürün çekilemedi.", "store_urunler SELECT", error);
      }
      if (!urun) {
        return NextResponse.json({ hata: "Ürün bulunamadı." }, { status: 404 });
      }

      const { kapaliUrunIdleri, hata: ayarHatasi } = await firmaKapaliUrunIdleri(
        adminSupabase,
        firmaBaglami.firmaId,
        [urun.urun_id],
      );
      if (ayarHatasi) {
        return hataYaniti(
          "Firma ürün ayarı alınamadı.",
          "store_urun_firma_ayarlari SELECT — ürün detayı",
          ayarHatasi,
        );
      }
      if (kapaliUrunIdleri.has(urun.urun_id)) {
        return NextResponse.json({ hata: "Ürün bulunamadı." }, { status: 404 });
      }

      // Kategori adını da getirelim
      const { data: kategori } = await adminSupabase
        .from("store_kategoriler")
        .select("ad")
        .eq("kategori_id", urun.kategori_id)
        .single();

      return NextResponse.json(
        { urun: { ...urun, kategori_adi: kategori?.ad ?? null } },
        { status: 200 }
      );
    }

    return validasyonHatasi(`Geçersiz tip parametresi: ${tip}`, ["tip"]);
  } catch (err) {
    return sunucuHatasi(err, "GET /store/api");
  }
}
