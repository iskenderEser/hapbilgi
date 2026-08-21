// app/eczanem/api/siparis/route.ts
// Müşteri kasa ucu (İP-§8): GET eczane listesi + sipariş/fiş geçmişi,
// POST yeni sipariş (puan DÜŞMEZ — bekliyor). İş mantığı lib/eczanem/kasa.ts.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { musteriKimligi } from "@/lib/eczanem/oturum";
import { musteriEczaneleri, siparisOlustur } from "@/lib/eczanem/kasa";

interface SiparisSatiri {
  siparis_id: string;
  eczane_id: string;
  urun_id: string;
  adet: number;
  kullanilan_puan: number;
  indirim_tl: number | string;
  durum: string;
  islem_kodu: string | null;
  onay_tarihi: string | null;
  created_at: string;
}

interface UrunSatiri { urun_id: string; urun_adi: string; firma_id: string; }

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const kimlik = await musteriKimligi(adminSupabase, user.id);
    if (!kimlik.ok) return rolHatasi(kimlik.hata ?? "Müşteri doğrulanamadı.");
    const musteriId = kimlik.musteriId!;

    const eczaneler = await musteriEczaneleri(adminSupabase, musteriId, kimlik.eczaneIdler);

    // Sayfalama/limit uygulanmadan önce geçerli firma ve eczane kapsamını sipariş
    // sorgusuna taşı. Sonradan süzme eski/pasif kayıtların güncel fişleri gizlemesine
    // ve hata halinde eksik listenin başarılı görünmesine neden oluyordu.
    const { data: urunler, error: urunError } = await adminSupabase
      .from("urunler")
      .select("urun_id, urun_adi, firma_id")
      .in("firma_id", kimlik.firmaIdler!);
    if (urunError) return hataYaniti("Sipariş ürünleri çekilemedi.", "urunler SELECT — müşteri sipariş kapsamı", urunError);

    const urunAd = new Map<string, string>();
    const izinliUrunIdler: string[] = [];
    for (const urunRaw of urunler ?? []) {
      const urun = urunRaw as UrunSatiri;
      urunAd.set(urun.urun_id, urun.urun_adi);
      izinliUrunIdler.push(urun.urun_id);
    }
    if (izinliUrunIdler.length === 0 || kimlik.eczaneIdler!.length === 0) {
      return NextResponse.json({ eczaneler, siparisler: [] }, { status: 200 });
    }

    const { data: siparislerRaw, error: sError } = await adminSupabase
      .from("eczanem_siparisler")
      .select("siparis_id, eczane_id, urun_id, adet, kullanilan_puan, indirim_tl, durum, islem_kodu, onay_tarihi, created_at")
      .eq("musteri_id", musteriId)
      .in("eczane_id", kimlik.eczaneIdler!)
      .in("urun_id", izinliUrunIdler)
      .order("created_at", { ascending: false })
      .limit(50);

    if (sError) return hataYaniti("Siparişler çekilemedi.", "eczanem_siparisler SELECT — musteri_id", sError);

    const rows = (siparislerRaw ?? []) as SiparisSatiri[];
    const eczaneAd = new Map(eczaneler.map((e) => [e.eczane_id, e.eczane_adi]));

    const siparisler = rows.map((siparis) => ({
      siparis_id: siparis.siparis_id,
      urun_adi: urunAd.get(siparis.urun_id) ?? "-",
      eczane_adi: eczaneAd.get(siparis.eczane_id) ?? "-",
      adet: siparis.adet,
      kullanilan_puan: siparis.kullanilan_puan,
      indirim_tl: Number(siparis.indirim_tl),
      durum: siparis.durum,
      islem_kodu: siparis.islem_kodu,
      onay_tarihi: siparis.onay_tarihi,
      created_at: siparis.created_at,
    }));

    return NextResponse.json({ eczaneler, siparisler }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /eczanem/api/siparis");
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const kimlik = await musteriKimligi(adminSupabase, user.id);
    if (!kimlik.ok) return rolHatasi(kimlik.hata ?? "Müşteri doğrulanamadı.");
    const musteriId = kimlik.musteriId!;

    const body = await request.json();
    const { eczane_id, barkod, adet } = body;
    if (typeof eczane_id !== "string" || !eczane_id) return validasyonHatasi("eczane_id zorunludur.", ["eczane_id"]);
    if (typeof barkod !== "string" || !barkod.trim()) return validasyonHatasi("barkod zorunludur.", ["barkod"]);
    if (!kimlik.eczaneIdler!.includes(eczane_id)) return rolHatasi("Bu eczanede aktif üyeliğiniz bulunmuyor.");

    const sonuc = await siparisOlustur(adminSupabase, musteriId, eczane_id, barkod, Number(adet ?? 1));
    if (!sonuc.ok) return isKuraluHatasi(sonuc.hata ?? "Sipariş oluşturulamadı.");

    return NextResponse.json({ ok: true, siparis_id: sonuc.siparis_id, mesaj: "İndirim talebi gönderildi — eczane onayı bekleniyor." }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eczanem/api/siparis");
  }
}
