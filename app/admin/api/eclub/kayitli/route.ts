// app/admin/api/eclub/kayitli/route.ts
//
// Admin — kayıtlı firma/eczane/kişi görünümü + kişi pasife alma (taşıma müdahalesi).
//   GET (parametresiz) → E-Club'lı firmalar (firmalar tablosu)
//   GET ?firma_id=     → o firmadaki aktif eczaneler (eclub_eczane_firma → eclub_eczaneler → master)
//   GET ?eczane_id=    → o eczanedeki kişiler (eclub_kisi_eczane → eclub_kisiler)
//   PUT { kisi_id, eczane_id } → eclub_kisi_eczane.aktif_mi=false (pasife al)

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, validasyonHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminGirisKontrol } from "@/lib/utils/adminGirisKontrol";

async function adminKontrol(_supabase: SupabaseClient, _adminSupabase: SupabaseClient): Promise<NextResponse | null> {
  // B-26: tek bekçi — adminGirisKontrol (yerel kopya kaldırıldı).
  const kontrol = await adminGirisKontrol();
  return kontrol.gecerli ? null : kontrol.yanit;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const guard = await adminKontrol(supabase, adminSupabase);
    if (guard) return guard;

    const { searchParams } = new URL(request.url);
    const firma_id = searchParams.get("firma_id");
    const eczane_id = searchParams.get("eczane_id");

    // --- Kişiler: ?eczane_id ---
    if (eczane_id) {
      const { data: baglar, error: bagError } = await adminSupabase
        .from("eclub_kisi_eczane")
        .select("kisi_id, aktif_mi")
        .eq("eczane_id", eczane_id);
      if (bagError) return hataYaniti("Kişi bağları çekilemedi.", "eclub_kisi_eczane SELECT — eczane_id", bagError);

      const kisiIdler = [...new Set((baglar ?? []).map((b) => (b as { kisi_id: string }).kisi_id))];
      const aktifMap = new Map<string, boolean>();
      for (const b of baglar ?? []) {
        const bb = b as { kisi_id: string; aktif_mi: boolean };
        aktifMap.set(bb.kisi_id, bb.aktif_mi);
      }

      const kisiMap = new Map<string, { ad: string; soyad: string; rol: string }>();
      if (kisiIdler.length > 0) {
        const { data: kisiler } = await adminSupabase
          .from("eclub_kisiler")
          .select("kisi_id, ad, soyad, rol")
          .in("kisi_id", kisiIdler);
        for (const k of kisiler ?? []) {
          const kk = k as { kisi_id: string; ad: string; soyad: string; rol: string };
          kisiMap.set(kk.kisi_id, { ad: kk.ad, soyad: kk.soyad, rol: kk.rol });
        }
      }

      const kisilerSonuc = kisiIdler.map((kid) => {
        const k = kisiMap.get(kid);
        return {
          kisi_id: kid,
          ad: k?.ad ?? "-",
          soyad: k?.soyad ?? "",
          rol: k?.rol ?? "-",
          aktif_mi: aktifMap.get(kid) ?? false,
        };
      });

      return NextResponse.json({ kisiler: kisilerSonuc }, { status: 200 });
    }

    // --- Eczaneler: ?firma_id ---
    if (firma_id) {
      const { data: baglar, error: bagError } = await adminSupabase
        .from("eclub_eczane_firma")
        .select("eczane_id")
        .eq("firma_id", firma_id)
        .eq("aktif_mi", true);
      if (bagError) return hataYaniti("Firma eczaneleri çekilemedi.", "eclub_eczane_firma SELECT — firma_id", bagError);

      const eczaneIdler = [...new Set((baglar ?? []).map((b) => (b as { eczane_id: string }).eczane_id))];
      if (eczaneIdler.length === 0) return NextResponse.json({ eczaneler: [] }, { status: 200 });

      // eczane_id → gln
      const { data: eczaneler } = await adminSupabase
        .from("eclub_eczaneler")
        .select("eczane_id, gln")
        .in("eczane_id", eczaneIdler);

      const glnler = [...new Set((eczaneler ?? []).map((e) => (e as { gln: string }).gln))];
      const masterMap = new Map<string, { eczane_adi: string; il: string; ilce: string | null }>();
      if (glnler.length > 0) {
        const { data: masterlar } = await adminSupabase
          .from("eclub_eczane_master")
          .select("gln, eczane_adi, il, ilce")
          .in("gln", glnler);
        for (const m of masterlar ?? []) {
          const mm = m as { gln: string; eczane_adi: string; il: string; ilce: string | null };
          masterMap.set(mm.gln, { eczane_adi: mm.eczane_adi, il: mm.il, ilce: mm.ilce });
        }
      }

      // aktif kişi sayısı (eczane başına)
      const { data: kisiBaglar } = await adminSupabase
        .from("eclub_kisi_eczane")
        .select("eczane_id, aktif_mi")
        .in("eczane_id", eczaneIdler)
        .eq("aktif_mi", true);
      const kisiSayiMap = new Map<string, number>();
      for (const kb of kisiBaglar ?? []) {
        const k = kb as { eczane_id: string };
        kisiSayiMap.set(k.eczane_id, (kisiSayiMap.get(k.eczane_id) ?? 0) + 1);
      }

      const eczanelerSonuc = (eczaneler ?? []).map((e) => {
        const ee = e as { eczane_id: string; gln: string };
        const m = masterMap.get(ee.gln);
        return {
          eczane_id: ee.eczane_id,
          gln: ee.gln,
          eczane_adi: m?.eczane_adi ?? "-",
          il: m?.il ?? "-",
          ilce: m?.ilce ?? null,
          aktif_kisi_sayisi: kisiSayiMap.get(ee.eczane_id) ?? 0,
        };
      });

      return NextResponse.json({ eczaneler: eczanelerSonuc }, { status: 200 });
    }

    // --- Firmalar (parametresiz) ---
    const { data: firmalar, error: firmaError } = await adminSupabase
      .from("firmalar")
      .select("firma_id, firma_adi, eclub_aktif")
      .eq("aktif", true)
      .order("firma_adi", { ascending: true });
    if (firmaError) return hataYaniti("Firmalar çekilemedi.", "firmalar SELECT", firmaError);

    return NextResponse.json({ firmalar: firmalar ?? [] }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /admin/api/eclub/kayitli");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const guard = await adminKontrol(supabase, adminSupabase);
    if (guard) return guard;

    const body = await request.json();
    const { kisi_id, eczane_id } = body;

    if (!kisi_id || typeof kisi_id !== "string") return validasyonHatasi("kisi_id zorunludur.", ["kisi_id"]);
    if (!eczane_id || typeof eczane_id !== "string") return validasyonHatasi("eczane_id zorunludur.", ["eczane_id"]);

    const { error: updateError } = await adminSupabase
      .from("eclub_kisi_eczane")
      .update({ aktif_mi: false, bitis_tarihi: new Date().toISOString() })
      .eq("kisi_id", kisi_id)
      .eq("eczane_id", eczane_id);

    if (updateError) return hataYaniti("Kişi pasife alınamadı.", "eclub_kisi_eczane UPDATE — aktif_mi=false", updateError);

    return NextResponse.json({ mesaj: "Kişi bu eczaneden pasife alındı." }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "PUT /admin/api/eclub/kayitli");
  }
}