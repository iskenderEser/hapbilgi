// app/admin/eclub-store/api/siparis/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { ADMIN_ROLLER } from "@/lib/utils/roller";
import { eclubStoreSiparisIptal } from "@/lib/eclub/store/eclubStoreSiparis";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rolCozucu } from "@/lib/utils/rolCozucu";

const GECERLI_DURUMLAR = ["beklemede", "hazirlaniyor", "kargoda", "teslim_edildi"];

async function adminKontrol(supabase: SupabaseClient): Promise<NextResponse | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return yetkiHatasi();
  const adminSupabase = createAdminClient();
  const rol = await rolCozucu(adminSupabase, user.id);
  if (!ADMIN_ROLLER.includes(rol)) return rolHatasi("Bu işleme yalnızca admin erişebilir.");
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const guard = await adminKontrol(supabase);
    if (guard) return guard;

    const adminSupabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const durum = searchParams.get("durum");

    let query = adminSupabase
      .from("eclub_store_siparisler")
      .select("siparis_id, kisi_id, urun_id, adet, toplam_puan, durum, kargo_firmasi, kargo_takip_no, adres_snapshot, iptal_sebebi, created_at, eclub_store_urunler ( ad )")
      .order("created_at", { ascending: false });
    if (durum) query = query.eq("durum", durum);

    const { data: siparisler, error } = await query;
    if (error) return hataYaniti("Siparişler çekilemedi.", "eclub_store_siparisler SELECT", error);

    const kisiIdler = [...new Set((siparisler ?? []).map((s) => (s as { kisi_id: string }).kisi_id))];
    const kisiMap = new Map<string, string>();
    if (kisiIdler.length > 0) {
      const { data: kisiler } = await adminSupabase
        .from("eclub_kisiler")
        .select("kisi_id, ad, soyad")
        .in("kisi_id", kisiIdler);
      for (const k of kisiler ?? []) {
        const kk = k as { kisi_id: string; ad: string; soyad: string };
        kisiMap.set(kk.kisi_id, `${kk.ad} ${kk.soyad}`);
      }
    }

    const sonuc = (siparisler ?? []).map((s) => {
      const ss = s as unknown as { siparis_id: string; kisi_id: string; urun_id: string; adet: number; toplam_puan: number; durum: string; kargo_firmasi: string | null; kargo_takip_no: string | null; adres_snapshot: unknown; iptal_sebebi: string | null; created_at: string; eclub_store_urunler: { ad: string } | { ad: string }[] | null };
      const urun = Array.isArray(ss.eclub_store_urunler) ? ss.eclub_store_urunler[0] : ss.eclub_store_urunler;
      return {
        siparis_id: ss.siparis_id,
        kisi_id: ss.kisi_id,
        kisi_ad_soyad: kisiMap.get(ss.kisi_id) ?? "-",
        urun_adi: urun?.ad ?? "-",
        adet: ss.adet,
        toplam_puan: ss.toplam_puan,
        durum: ss.durum,
        kargo_firmasi: ss.kargo_firmasi,
        kargo_takip_no: ss.kargo_takip_no,
        adres_snapshot: ss.adres_snapshot,
        iptal_sebebi: ss.iptal_sebebi,
        created_at: ss.created_at,
      };
    });

    return NextResponse.json({ siparisler: sonuc }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /admin/eclub-store/api/siparis");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const guard = await adminKontrol(supabase);
    if (guard) return guard;

    const { data: { user } } = await supabase.auth.getUser();
    const adminSupabase = createAdminClient();
    const body = await request.json();
    const { siparis_id, action } = body;
    if (!siparis_id) return validasyonHatasi("siparis_id zorunludur.", ["siparis_id"]);

    if (action === "durum") {
      const { durum, kargo_firmasi, kargo_takip_no } = body;
      if (!GECERLI_DURUMLAR.includes(durum)) return validasyonHatasi(`Geçersiz durum: ${durum}`, ["durum"]);

      const guncelle: Record<string, unknown> = { durum, guncellenme_at: new Date().toISOString() };
      if (durum === "kargoda") {
        if (!kargo_firmasi || !kargo_takip_no) return validasyonHatasi("Kargo için firma ve takip no zorunludur.", ["kargo_firmasi", "kargo_takip_no"]);
        guncelle.kargo_firmasi = kargo_firmasi;
        guncelle.kargo_takip_no = kargo_takip_no;
      }

      const { error } = await adminSupabase
        .from("eclub_store_siparisler")
        .update(guncelle)
        .eq("siparis_id", siparis_id);
      if (error) return hataYaniti("Durum güncellenemedi.", "eclub_store_siparisler UPDATE durum", error);

      return NextResponse.json({ mesaj: "Sipariş durumu güncellendi." }, { status: 200 });
    }

    if (action === "iptal") {
      const sonuc = await eclubStoreSiparisIptal(adminSupabase, {
        siparis_id,
        iptal_eden_kisi_id: user?.id ?? "",
        is_admin: true,
        sebep: body.sebep ?? "Admin tarafından iptal edildi.",
      });
      if (!sonuc.ok) return isKuraluHatasi(sonuc.error ?? "Sipariş iptal edilemedi.");
      return NextResponse.json({ mesaj: "Sipariş iptal edildi (puan iade)." }, { status: 200 });
    }

    return validasyonHatasi(`Geçersiz action: ${action} (geçerli: 'durum', 'iptal')`, ["action"]);
  } catch (err) {
    return sunucuHatasi(err, "PATCH /admin/eclub-store/api/siparis");
  }
}