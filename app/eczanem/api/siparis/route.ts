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

    const { data: siparislerRaw, error: sError } = await adminSupabase
      .from("eczanem_siparisler")
      .select("siparis_id, eczane_id, urun_id, adet, kullanilan_puan, indirim_tl, durum, islem_kodu, onay_tarihi, created_at")
      .eq("musteri_id", musteriId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (sError) return hataYaniti("Siparişler çekilemedi.", "eczanem_siparisler SELECT — musteri_id", sError);

    const rows = (siparislerRaw ?? []) as SiparisSatiri[];
    const urunIdler = [...new Set(rows.map((siparis) => siparis.urun_id))];
    const urunAd = new Map<string, string>();
    const izinliUrunIdler = new Set<string>();
    if (urunIdler.length > 0) {
      const { data: urunler } = await adminSupabase.from("urunler").select("urun_id, urun_adi, firma_id").in("urun_id", urunIdler);
      for (const urunRaw of urunler ?? []) {
        const urun = urunRaw as UrunSatiri;
        if (!kimlik.firmaIdler!.includes(urun.firma_id)) continue;
        urunAd.set(urun.urun_id, urun.urun_adi);
        izinliUrunIdler.add(urun.urun_id);
      }
    }
    const eczaneAd = new Map(eczaneler.map((e) => [e.eczane_id, e.eczane_adi]));

    const siparisler = rows.filter((siparis) => izinliUrunIdler.has(siparis.urun_id)).map((siparis) => ({
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

    const sonuc = await siparisOlustur(adminSupabase, musteriId, eczane_id, barkod, Number(adet ?? 1));
    if (!sonuc.ok) return isKuraluHatasi(sonuc.hata ?? "Sipariş oluşturulamadı.");

    return NextResponse.json({ ok: true, siparis_id: sonuc.siparis_id, mesaj: "Sipariş gönderildi — eczacı onayı bekleniyor." }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eczanem/api/siparis");
  }
}
