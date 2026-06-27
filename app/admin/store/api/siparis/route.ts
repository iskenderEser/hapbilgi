// app/admin/store/api/siparis/route.ts
//
// Admin için sipariş yönetim endpoint'i.
//
// GET    → Tüm siparişleri (her firmadan) listele, durum filtresi opsiyonel
//          Query: ?durum=beklemede (opsiyonel)
//
// PATCH  → Sipariş üzerinde admin işlemi:
//          action='kargola' → kargo firması + takip no gir (durum: beklemede → kargoda)
//            Body: { siparis_id, action: 'kargola', kargo_firmasi, kargo_takip_no }
//          action='iptal' → Manuel iptal (admin her durumda iptal edebilir, teslim_edildi hariç)
//            Body: { siparis_id, action: 'iptal', sebep }
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
import { siparisIptal } from "@/lib/store/siparis";
import { KARGO_FIRMA_ADLARI } from "@/lib/store/kargo";

// ─── Yardımcı: admin yetki kontrolü ──────────────────────────────────────────

async function yetkiAl(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { hata: yetkiHatasi() };

  const rol = (user.user_metadata?.rol ?? "").toLowerCase();
  if (!ADMIN_ROLLER.includes(rol)) {
    return { hata: rolHatasi("Bu işleme yalnızca admin erişebilir.") };
  }

  return { user, rol, adminSupabase: createAdminClient() };
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const yetki = await yetkiAl(request);
    if (yetki.hata) return yetki.hata;
    const { adminSupabase } = yetki;

    const { searchParams } = new URL(request.url);
    const durum = searchParams.get("durum");

    let query = adminSupabase
      .from("store_siparisler")
      .select(`
        siparis_id,
        kullanici_id,
        urun_id,
        adres_id,
        adres_snapshot,
        adet,
        puan_birim_fiyat,
        toplam_puan,
        durum,
        kargo_firmasi,
        kargo_takip_no,
        iptal_sebebi,
        created_at,
        guncellenme_at,
        teslim_alma_at,
        store_urunler ( ad, gorsel_url ),
        kullanicilar ( ad, soyad, eposta, rol )
      `)
      .order("created_at", { ascending: false });

    if (durum) {
      query = query.eq("durum", durum);
    }

    const { data, error } = await query;

    if (error) {
      return hataYaniti("Siparişler çekilemedi.", "store_siparisler SELECT", error);
    }

    return NextResponse.json({ siparisler: data ?? [] }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /admin/store/api/siparis");
  }
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const yetki = await yetkiAl(request);
    if (yetki.hata) return yetki.hata;
    const { user, adminSupabase } = yetki;

    const body = await request.json();
    const { siparis_id, action } = body;

    if (!siparis_id || typeof siparis_id !== "string") {
      return validasyonHatasi("siparis_id zorunludur.", ["siparis_id"]);
    }

    // ─── action=kargola ─────────────────────────────────────────────────────
    if (action === "kargola") {
      const { kargo_firmasi, kargo_takip_no } = body;

      if (!kargo_firmasi || typeof kargo_firmasi !== "string") {
        return validasyonHatasi("kargo_firmasi zorunludur.", ["kargo_firmasi"]);
      }
      if (!KARGO_FIRMA_ADLARI.includes(kargo_firmasi)) {
        return validasyonHatasi(
          `Geçersiz kargo firması. Geçerli: ${KARGO_FIRMA_ADLARI.join(", ")}`,
          ["kargo_firmasi"]
        );
      }
      if (!kargo_takip_no || typeof kargo_takip_no !== "string" || kargo_takip_no.trim() === "") {
        return validasyonHatasi("kargo_takip_no zorunludur.", ["kargo_takip_no"]);
      }

      // Sipariş kontrol — sadece beklemede durumda kargolanabilir
      const { data: siparis, error: siparisError } = await adminSupabase
        .from("store_siparisler")
        .select("durum")
        .eq("siparis_id", siparis_id)
        .single();

      if (siparisError || !siparis) {
        return isKuraluHatasi("Sipariş bulunamadı.");
      }

      if (siparis.durum !== "beklemede") {
        return isKuraluHatasi(
          `Sadece "Beklemede" durumdaki siparişler kargoya verilebilir. Mevcut durum: ${siparis.durum}`
        );
      }

      // Güncelle
      const { error: updateError } = await adminSupabase
        .from("store_siparisler")
        .update({
          durum: "kargoda",
          kargo_firmasi: kargo_firmasi,
          kargo_takip_no: kargo_takip_no.trim(),
          guncellenme_at: new Date().toISOString(),
        })
        .eq("siparis_id", siparis_id);

      if (updateError) {
        return hataYaniti("Sipariş güncellenemedi.", "store_siparisler UPDATE", updateError);
      }

      return NextResponse.json({ mesaj: "Sipariş kargoya verildi." }, { status: 200 });
    }

    // ─── action=iptal (admin manuel iptal) ──────────────────────────────────
    if (action === "iptal") {
      const { sebep } = body;

      if (!sebep || typeof sebep !== "string" || sebep.trim() === "") {
        return validasyonHatasi("İptal sebebi zorunludur.", ["sebep"]);
      }

      const sonuc = await siparisIptal(adminSupabase, {
        siparis_id,
        iptal_eden_id: user.id,
        is_admin: true,
        sebep: sebep.trim(),
      });

      if (!sonuc.ok) {
        return isKuraluHatasi(sonuc.error ?? "Sipariş iptal edilemedi.");
      }

      return NextResponse.json({ mesaj: "Sipariş iptal edildi. Puan ve stok iade edildi." }, { status: 200 });
    }

    return validasyonHatasi(
      `Geçersiz action: ${action} (geçerli: 'kargola', 'iptal')`,
      ["action"]
    );
  } catch (err) {
    return sunucuHatasi(err, "PATCH /admin/store/api/siparis");
  }
}