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
// Firma guard: firmasında hbstore_aktif=false ise erişim 403.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  hataYaniti,
  veriKontrol,
  sunucuHatasi,
  yetkiHatasi,
  rolHatasi,
  validasyonHatasi,
} from "@/lib/utils/hataIsle";
import { STORE_ALABILEN_ROLLER } from "@/lib/utils/roller";
import { harcamaBakiyesi } from "@/lib/store/bakiye";
import { storeFirmaGuard } from "@/lib/store/firmaGuard";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    // 2. Rol kontrolü
    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!STORE_ALABILEN_ROLLER.includes(rol)) {
      return rolHatasi("HBStore'a erişim yetkiniz yok.");
    }

    const adminSupabase = createAdminClient();

    // 3. Firma guard — firmasında HBStore kapalıysa 403
    const guard = await storeFirmaGuard(adminSupabase, user.id);
    if (!guard.acik) return guard.yanit!;

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

      return NextResponse.json({ urunler: data ?? [] }, { status: 200 });
    }

    // ─── tip=kategoriler ───────────────────────────────────────────────────
    if (tip === "kategoriler") {
      const { data, error } = await adminSupabase
        .from("store_kategoriler")
        .select("kategori_id, ad, sira, aktif_mi")
        .eq("aktif_mi", true)
        .order("sira", { ascending: true });

      if (error) {
        return hataYaniti("Kategoriler çekilemedi.", "store_kategoriler SELECT", error);
      }

      return NextResponse.json({ kategoriler: data ?? [] }, { status: 200 });
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
        .single();

      const kontrol = veriKontrol(
        urun,
        "store_urunler SELECT — urun_id kontrolü",
        "Ürün bulunamadı."
      );
      if (!kontrol.gecerli) return kontrol.yanit;
      if (error) {
        return hataYaniti("Ürün çekilemedi.", "store_urunler SELECT", error);
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