// app/store/api/siparis/route.ts
//
// HBStore sipariş endpoint'i.
//
// POST   → Yeni sipariş oluştur. Body: { urun_id, adres_id, adet }
// PATCH  → Mevcut sipariş üzerinde işlem:
//          - { siparis_id, action: 'iptal', sebep? } — kullanıcı kendi siparişini iptal eder
//          - { siparis_id, action: 'teslim_aldim' } — kullanıcı teslim aldı onayı
//
// Tüm iş mantığı RPC'lerde:
//   - store_siparis_olustur (atomik stok + bakiye + sipariş + harcama)
//   - store_siparis_iptal (yetki + 12 saat + stok iade + puan iade)
//   - store_teslim_aldim (durum geçişi onayı)
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
  isKuraluHatasi,
} from "@/lib/utils/hataIsle";
import { STORE_ALABILEN_ROLLER } from "@/lib/utils/roller";
import {
  siparisOlustur,
  siparisIptal,
  teslimAldim,
} from "@/lib/store/siparis";

// ─── GET: Kullanıcının kendi siparişleri ─────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!STORE_ALABILEN_ROLLER.includes(rol)) {
      return rolHatasi("Sipariş geçmişi yetkiniz yok.");
    }

    const adminSupabase = createAdminClient();

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
        store_urunler ( ad, gorsel_url )
      `)
      .eq("kullanici_id", user.id)
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
    return sunucuHatasi(err, "GET /store/api/siparis");
  }
}

// ─── POST: Yeni sipariş ──────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!STORE_ALABILEN_ROLLER.includes(rol)) {
      return rolHatasi("Sipariş verme yetkiniz yok.");
    }

    const adminSupabase = createAdminClient();

    const body = await request.json();
    const { urun_id, adres_id, adet } = body;

    // Validasyon
    if (!urun_id || typeof urun_id !== "string") {
      return validasyonHatasi("urun_id zorunludur.", ["urun_id"]);
    }
    if (!adres_id || typeof adres_id !== "string") {
      return validasyonHatasi("adres_id zorunludur.", ["adres_id"]);
    }
    const adetSayi = Number(adet);
    if (!Number.isInteger(adetSayi) || adetSayi <= 0) {
      return validasyonHatasi("adet pozitif tam sayı olmalı.", ["adet"]);
    }

    // RPC çağrısı
    const sonuc = await siparisOlustur(adminSupabase, {
      kullanici_id: user.id,
      urun_id,
      adres_id,
      adet: adetSayi,
    });

    if (!sonuc.ok) {
      return isKuraluHatasi(sonuc.hata ?? "Sipariş oluşturulamadı.");
    }

    return NextResponse.json(
      {
        mesaj: "Sipariş alındı.",
        siparis_id: sonuc.siparis_id,
      },
      { status: 201 }
    );
  } catch (err) {
    return sunucuHatasi(err, "POST /store/api/siparis");
  }
}

// ─── PATCH: İptal veya Teslim Aldım ──────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!STORE_ALABILEN_ROLLER.includes(rol)) {
      return rolHatasi("Sipariş işlemi yetkiniz yok.");
    }

    const adminSupabase = createAdminClient();

    const body = await request.json();
    const { siparis_id, action, sebep } = body;

    if (!siparis_id || typeof siparis_id !== "string") {
      return validasyonHatasi("siparis_id zorunludur.", ["siparis_id"]);
    }

    if (action === "iptal") {
      const sonuc = await siparisIptal(adminSupabase, {
        siparis_id,
        iptal_eden_id: user.id,
        is_admin: false, // bu endpoint kullanıcı iptal akışı; admin için ayrı admin route'u olacak
        sebep: sebep ?? null,
      });

      if (!sonuc.ok) {
        return isKuraluHatasi(sonuc.error ?? "Sipariş iptal edilemedi.");
      }

      return NextResponse.json({ mesaj: "Sipariş iptal edildi." }, { status: 200 });
    }

    if (action === "teslim_aldim") {
      const sonuc = await teslimAldim(adminSupabase, siparis_id, user.id);

      if (!sonuc.ok) {
        return isKuraluHatasi(sonuc.error ?? "Teslim onayı verilemedi.");
      }

      return NextResponse.json({ mesaj: "Sipariş teslim alındı olarak işaretlendi." }, { status: 200 });
    }

    return validasyonHatasi(
      `Geçersiz action: ${action} (geçerli: 'iptal', 'teslim_aldim')`,
      ["action"]
    );
  } catch (err) {
    return sunucuHatasi(err, "PATCH /store/api/siparis");
  }
}