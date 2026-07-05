// app/eclub/store/rapor/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";

const FIRMA_YETKILI_ROLLER = ["utt", "kd_utt", "bm", "tm"];

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    const { data: ben, error: benError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, rol, firma_id")
      .eq("kullanici_id", user.id)
      .single();
    if (benError || !ben) return hataYaniti("Kullanıcı bulunamadı.", "kullanicilar SELECT", benError, 404);

    const rol = (ben.rol ?? "").toLowerCase();
    const adminMi = rol === "admin";
    if (!adminMi && !FIRMA_YETKILI_ROLLER.includes(rol)) {
      return rolHatasi("Bu raporu görme yetkiniz yok.");
    }

    // Firma yetkilisi → sadece kendi firmasının katkı satırları; admin → tümü
    let sfpQuery = adminSupabase
      .from("eclub_store_siparis_firma_puan")
      .select("id, siparis_id, firma_id, kullanilan_puan, created_at")
      .order("created_at", { ascending: false });

    if (!adminMi) {
      if (!ben.firma_id) return NextResponse.json({ rol, satirlar: [] }, { status: 200 });
      sfpQuery = sfpQuery.eq("firma_id", ben.firma_id);
    }

    const { data: sfpler, error: sfpError } = await sfpQuery;
    if (sfpError) return hataYaniti("Rapor verisi çekilemedi.", "eclub_store_siparis_firma_puan SELECT", sfpError);

    const siparisIdler = [...new Set((sfpler ?? []).map((s) => (s as { siparis_id: string }).siparis_id))];
    if (siparisIdler.length === 0) return NextResponse.json({ rol, satirlar: [] }, { status: 200 });

    // Sipariş bilgisi (toplam tutar, kişi, ürün, durum)
    const { data: siparisler } = await adminSupabase
      .from("eclub_store_siparisler")
      .select("siparis_id, kisi_id, urun_id, toplam_puan, durum, created_at, eclub_store_urunler ( ad )")
      .in("siparis_id", siparisIdler);

    const siparisMap = new Map<string, { kisi_id: string; urun_adi: string; toplam_puan: number; durum: string; created_at: string }>();
    for (const s of siparisler ?? []) {
      const ss = s as unknown as { siparis_id: string; kisi_id: string; toplam_puan: number; durum: string; created_at: string; eclub_store_urunler: { ad: string } | { ad: string }[] | null };
      const urun = Array.isArray(ss.eclub_store_urunler) ? ss.eclub_store_urunler[0] : ss.eclub_store_urunler;
      siparisMap.set(ss.siparis_id, {
        kisi_id: ss.kisi_id,
        urun_adi: urun?.ad ?? "-",
        toplam_puan: ss.toplam_puan,
        durum: ss.durum,
        created_at: ss.created_at,
      });
    }

    // Kişi + eczane bilgisi
    const kisiIdler = [...new Set(Array.from(siparisMap.values()).map((s) => s.kisi_id))];
    const kisiMap = new Map<string, { ad_soyad: string; eczane_adi: string }>();
    if (kisiIdler.length > 0) {
      const { data: kisiler } = await adminSupabase
        .from("eclub_kisiler")
        .select("kisi_id, ad, soyad")
        .in("kisi_id", kisiIdler);
      const kisiAdMap = new Map<string, string>();
      for (const k of kisiler ?? []) {
        const kk = k as { kisi_id: string; ad: string; soyad: string };
        kisiAdMap.set(kk.kisi_id, `${kk.ad} ${kk.soyad}`);
      }

      // eczane: aktif kisi_eczane → eczane → master
      const { data: baglar } = await adminSupabase
        .from("eclub_kisi_eczane")
        .select("kisi_id, eczane_id")
        .in("kisi_id", kisiIdler)
        .eq("aktif_mi", true);
      const kisiEczaneId = new Map<string, string>();
      for (const b of baglar ?? []) {
        const bb = b as { kisi_id: string; eczane_id: string };
        if (!kisiEczaneId.has(bb.kisi_id)) kisiEczaneId.set(bb.kisi_id, bb.eczane_id);
      }
      const eczaneIdler = [...new Set(Array.from(kisiEczaneId.values()))];
      const eczaneGln = new Map<string, string>();
      if (eczaneIdler.length > 0) {
        const { data: eczaneler } = await adminSupabase
          .from("eclub_eczaneler")
          .select("eczane_id, gln")
          .in("eczane_id", eczaneIdler);
        for (const e of eczaneler ?? []) {
          const ee = e as { eczane_id: string; gln: string };
          eczaneGln.set(ee.eczane_id, ee.gln);
        }
      }
      const glnler = [...new Set(Array.from(eczaneGln.values()))];
      const glnAd = new Map<string, string>();
      if (glnler.length > 0) {
        const { data: masterlar } = await adminSupabase
          .from("eclub_eczane_master")
          .select("gln, eczane_adi")
          .in("gln", glnler);
        for (const m of masterlar ?? []) {
          const mm = m as { gln: string; eczane_adi: string };
          glnAd.set(mm.gln, mm.eczane_adi);
        }
      }

      for (const kid of kisiIdler) {
        const eczaneId = kisiEczaneId.get(kid);
        const gln = eczaneId ? eczaneGln.get(eczaneId) : undefined;
        const eczaneAdi = gln ? (glnAd.get(gln) ?? "-") : "-";
        kisiMap.set(kid, { ad_soyad: kisiAdMap.get(kid) ?? "-", eczane_adi: eczaneAdi });
      }
    }

    const satirlar = (sfpler ?? []).map((sfp) => {
      const s = sfp as { siparis_id: string; firma_id: string; kullanilan_puan: number };
      const sip = siparisMap.get(s.siparis_id);
      const kisi = sip ? kisiMap.get(sip.kisi_id) : undefined;
      return {
        siparis_id: s.siparis_id,
        firma_id: s.firma_id,
        kullanilan_puan: s.kullanilan_puan,
        ad_soyad: kisi?.ad_soyad ?? "-",
        eczane_adi: kisi?.eczane_adi ?? "-",
        urun_adi: sip?.urun_adi ?? "-",
        siparis_toplam: sip?.toplam_puan ?? 0,
        durum: sip?.durum ?? "-",
        tarih: sip?.created_at ?? null,
      };
    });

    return NextResponse.json({ rol, admin: adminMi, satirlar }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/store/rapor/api");
  }
}