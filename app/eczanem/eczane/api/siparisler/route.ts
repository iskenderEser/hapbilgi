// app/eczanem/eczane/api/siparisler/route.ts
// Eczacı kasa ucu (İP-§8.1.4): GET onay kuyruğu (bekliyor) + geçmiş,
// POST onayla (atomik FIFO RPC) / reddet (düşür). Müşteri yalnız son-4-hane
// (İP-§9.2). İş mantığı lib/eczanem/kasa.ts.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { ECLUB_TUKETICI_ROLLERI } from "@/lib/utils/roller";
import { davetEdenEczanesi } from "@/lib/eczanem/davet";
import { siparisOnayla, siparisReddet } from "@/lib/eczanem/kasa";

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!ECLUB_TUKETICI_ROLLERI.includes(rol)) return rolHatasi("Bu sayfaya yalnız eczacı/teknisyen erişebilir.");

    const eden = await davetEdenEczanesi(adminSupabase, user.id);
    if (!eden.ok) return isKuraluHatasi(eden.hata ?? "Eczane bağı bulunamadı.");

    const { data: rows, error } = await adminSupabase
      .from("eczanem_siparisler")
      .select("siparis_id, musteri_id, musteri_etiket, urun_id, adet, kullanilan_puan, indirim_tl, durum, islem_kodu, onay_tarihi, created_at")
      .eq("eczane_id", eden.eczaneId!)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return hataYaniti("Siparişler çekilemedi.", "eczanem_siparisler SELECT — eczane_id", error);
    const siparisler = rows ?? [];

    // Ürün adları
    const urunIdler = [...new Set(siparisler.map((s: any) => s.urun_id))];
    const urunAd = new Map<string, string>();
    if (urunIdler.length > 0) {
      const { data: urunler } = await adminSupabase.from("urunler").select("urun_id, urun_adi").in("urun_id", urunIdler);
      for (const u of urunler ?? []) urunAd.set((u as any).urun_id, (u as any).urun_adi);
    }

    // Müşteri son-4-hane (İP-§9.2: ad-soyad ASLA; yalnız maske). Silinmişse musteri_etiket.
    const musteriIdler = [...new Set(siparisler.map((s: any) => s.musteri_id).filter(Boolean))];
    const musteriTel = new Map<string, string>();
    if (musteriIdler.length > 0) {
      const { data: musteriler } = await adminSupabase.from("eczanem_musteriler").select("musteri_id, telefon").in("musteri_id", musteriIdler);
      for (const m of musteriler ?? []) musteriTel.set((m as any).musteri_id, (m as any).telefon);
    }

    const sonuc = siparisler.map((s: any) => ({
      siparis_id: s.siparis_id,
      musteri_maskeli: s.musteri_id
        ? `••• ••• ${(musteriTel.get(s.musteri_id) ?? "").slice(-4)}`
        : (s.musteri_etiket ?? "Silinmiş müşteri"),
      urun_adi: urunAd.get(s.urun_id) ?? "-",
      adet: s.adet,
      kullanilan_puan: s.kullanilan_puan,
      indirim_tl: Number(s.indirim_tl),
      durum: s.durum,
      islem_kodu: s.islem_kodu,
      onay_tarihi: s.onay_tarihi,
      created_at: s.created_at,
    }));

    return NextResponse.json({ siparisler: sonuc }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /eczanem/eczane/api/siparisler");
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!ECLUB_TUKETICI_ROLLERI.includes(rol)) return rolHatasi("Sadece eczacı/teknisyen işlem yapabilir.");

    const eden = await davetEdenEczanesi(adminSupabase, user.id);
    if (!eden.ok) return isKuraluHatasi(eden.hata ?? "Eczane bağı bulunamadı.");

    const body = await request.json();
    const { siparis_id, aksiyon } = body;
    if (typeof siparis_id !== "string" || !siparis_id) return validasyonHatasi("siparis_id zorunludur.", ["siparis_id"]);
    if (aksiyon !== "onayla" && aksiyon !== "reddet") return validasyonHatasi("aksiyon 'onayla' veya 'reddet' olmalı.", ["aksiyon"]);

    // Sipariş bu eczaneye mi ait?
    const { data: siparis } = await adminSupabase
      .from("eczanem_siparisler")
      .select("siparis_id, eczane_id, durum")
      .eq("siparis_id", siparis_id)
      .maybeSingle();
    if (!siparis) return hataYaniti("Sipariş bulunamadı.", "eczanem_siparisler SELECT — siparis_id", null, 404);
    if (siparis.eczane_id !== eden.eczaneId) return rolHatasi("Bu sipariş sizin eczanenize ait değil.");

    if (aksiyon === "reddet") {
      const r = await siparisReddet(adminSupabase, siparis_id);
      if (!r.ok) return isKuraluHatasi(r.hata ?? "Reddedilemedi.");
      return NextResponse.json({ ok: true, mesaj: "Sipariş düşürüldü." }, { status: 200 });
    }

    // onayla — atomik FIFO düşüm RPC'si
    const onay = await siparisOnayla(adminSupabase, siparis_id);
    if (!onay.ok) return isKuraluHatasi(onay.hata ?? "Onaylanamadı.");
    return NextResponse.json({
      ok: true,
      mesaj: "Sipariş onaylandı.",
      islem_kodu: onay.islem_kodu,
      indirim_tl: onay.indirim_tl,
      kullanilan_puan: onay.kullanilan_puan,
    }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eczanem/eczane/api/siparisler");
  }
}
