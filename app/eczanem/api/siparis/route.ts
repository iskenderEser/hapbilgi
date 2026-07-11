// app/eczanem/api/siparis/route.ts
// Müşteri kasa ucu (İP-§8): GET eczane listesi + sipariş/fiş geçmişi,
// POST yeni sipariş (puan DÜŞMEZ — bekliyor). İş mantığı lib/eczanem/kasa.ts.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { musteriKimligi } from "@/lib/eczanem/oturum";
import { musteriEczaneleri, siparisOlustur } from "@/lib/eczanem/kasa";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const kimlik = await musteriKimligi(adminSupabase, user.id);
    if (!kimlik.ok) return rolHatasi(kimlik.hata ?? "Müşteri doğrulanamadı.");
    const musteriId = kimlik.musteriId!;

    const eczaneler = await musteriEczaneleri(adminSupabase, musteriId);

    const { data: siparislerRaw, error: sError } = await adminSupabase
      .from("eczanem_siparisler")
      .select("siparis_id, eczane_id, urun_id, adet, kullanilan_puan, indirim_tl, durum, islem_kodu, onay_tarihi, created_at")
      .eq("musteri_id", musteriId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (sError) return hataYaniti("Siparişler çekilemedi.", "eczanem_siparisler SELECT — musteri_id", sError);

    const rows = siparislerRaw ?? [];
    const urunIdler = [...new Set(rows.map((s: any) => s.urun_id))];
    const urunAd = new Map<string, string>();
    if (urunIdler.length > 0) {
      const { data: urunler } = await adminSupabase.from("urunler").select("urun_id, urun_adi").in("urun_id", urunIdler);
      for (const u of urunler ?? []) urunAd.set((u as any).urun_id, (u as any).urun_adi);
    }
    const eczaneAd = new Map(eczaneler.map((e) => [e.eczane_id, e.eczane_adi]));

    const siparisler = rows.map((s: any) => ({
      siparis_id: s.siparis_id,
      urun_adi: urunAd.get(s.urun_id) ?? "-",
      eczane_adi: eczaneAd.get(s.eczane_id) ?? "-",
      adet: s.adet,
      kullanilan_puan: s.kullanilan_puan,
      indirim_tl: Number(s.indirim_tl),
      durum: s.durum,
      islem_kodu: s.islem_kodu,
      onay_tarihi: s.onay_tarihi,
      created_at: s.created_at,
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
