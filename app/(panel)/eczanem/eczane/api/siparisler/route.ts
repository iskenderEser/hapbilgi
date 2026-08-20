// app/eczanem/eczane/api/siparisler/route.ts
// Eczacı kasa ucu (İP-§8.1.4): GET onay kuyruğu (bekliyor) + geçmiş,
// POST onayla (atomik FIFO RPC) / reddet (düşür). Müşteri yalnız son-4-hane
// (İP-§9.2). İş mantığı lib/eczanem/kasa.ts.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { ECLUB_TUKETICI_ROLLERI } from "@/lib/utils/roller";
import { eczaciAktifEczanesi } from "@/lib/eczanem/eczaci";
import { siparisOnayla, siparisReddet } from "@/lib/eczanem/kasa";

interface SiparisSatiri {
  siparis_id: string;
  musteri_id: string | null;
  musteri_etiket: string | null;
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
interface MusteriSatiri { musteri_id: string; telefon: string; }

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!ECLUB_TUKETICI_ROLLERI.includes(rol)) return rolHatasi("Bu sayfaya yalnız eczacı/teknisyen erişebilir.");

    const eden = await eczaciAktifEczanesi(adminSupabase, user.id);
    if (!eden.ok) return isKuraluHatasi(eden.hata ?? "Eczane bağı bulunamadı.");

    const { data: rows, error } = await adminSupabase
      .from("eczanem_siparisler")
      .select("siparis_id, musteri_id, musteri_etiket, urun_id, adet, kullanilan_puan, indirim_tl, durum, islem_kodu, onay_tarihi, created_at")
      .eq("eczane_id", eden.eczaneId!)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return hataYaniti("Siparişler çekilemedi.", "eczanem_siparisler SELECT — eczane_id", error);
    const siparisler = (rows ?? []) as SiparisSatiri[];

    // Ürün adları
    const urunIdler = [...new Set(siparisler.map((siparis) => siparis.urun_id))];
    const urunAd = new Map<string, string>();
    const izinliUrunIdler = new Set<string>();
    if (urunIdler.length > 0) {
      const { data: urunler } = await adminSupabase.from("urunler").select("urun_id, urun_adi, firma_id").in("urun_id", urunIdler);
      for (const urunRaw of urunler ?? []) {
        const urun = urunRaw as UrunSatiri;
        if (!eden.firmaIdler!.includes(urun.firma_id)) continue;
        urunAd.set(urun.urun_id, urun.urun_adi);
        izinliUrunIdler.add(urun.urun_id);
      }
    }

    // Müşteri son-4-hane (İP-§9.2: ad-soyad ASLA; yalnız maske). Silinmişse musteri_etiket.
    const musteriIdler = [...new Set(siparisler.map((siparis) => siparis.musteri_id).filter((id): id is string => Boolean(id)))];
    const musteriTel = new Map<string, string>();
    if (musteriIdler.length > 0) {
      const { data: musteriler } = await adminSupabase.from("eczanem_musteriler").select("musteri_id, telefon").in("musteri_id", musteriIdler);
      for (const musteriRaw of musteriler ?? []) {
        const musteri = musteriRaw as MusteriSatiri;
        musteriTel.set(musteri.musteri_id, musteri.telefon);
      }
    }

    const sonuc = siparisler.filter((siparis) => izinliUrunIdler.has(siparis.urun_id)).map((siparis) => ({
      siparis_id: siparis.siparis_id,
      musteri_maskeli: siparis.musteri_id
        ? `••• ••• ${(musteriTel.get(siparis.musteri_id) ?? "").slice(-4)}`
        : (siparis.musteri_etiket ?? "Silinmiş müşteri"),
      urun_adi: urunAd.get(siparis.urun_id) ?? "-",
      adet: siparis.adet,
      kullanilan_puan: siparis.kullanilan_puan,
      indirim_tl: Number(siparis.indirim_tl),
      durum: siparis.durum,
      islem_kodu: siparis.islem_kodu,
      onay_tarihi: siparis.onay_tarihi,
      created_at: siparis.created_at,
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

    const eden = await eczaciAktifEczanesi(adminSupabase, user.id);
    if (!eden.ok) return isKuraluHatasi(eden.hata ?? "Eczane bağı bulunamadı.");

    const body = await request.json();
    const { siparis_id, aksiyon } = body;
    if (typeof siparis_id !== "string" || !siparis_id) return validasyonHatasi("siparis_id zorunludur.", ["siparis_id"]);
    if (aksiyon !== "onayla" && aksiyon !== "reddet") return validasyonHatasi("aksiyon 'onayla' veya 'reddet' olmalı.", ["aksiyon"]);

    // Sipariş bu eczaneye mi ait?
    const { data: siparis } = await adminSupabase
      .from("eczanem_siparisler")
      .select("siparis_id, eczane_id, urun_id, durum")
      .eq("siparis_id", siparis_id)
      .maybeSingle();
    if (!siparis) return hataYaniti("Sipariş bulunamadı.", "eczanem_siparisler SELECT — siparis_id", null, 404);
    if (siparis.eczane_id !== eden.eczaneId) return rolHatasi("Bu sipariş sizin eczanenize ait değil.");

    if (aksiyon === "reddet") {
      const r = await siparisReddet(adminSupabase, siparis_id);
      if (!r.ok) return isKuraluHatasi(r.hata ?? "Reddedilemedi.");
      return NextResponse.json({ ok: true, mesaj: "Sipariş düşürüldü." }, { status: 200 });
    }

    const { data: urun } = await adminSupabase
      .from("urunler")
      .select("firma_id")
      .eq("urun_id", siparis.urun_id)
      .maybeSingle();
    if (!urun?.firma_id || !eden.firmaIdler!.includes(urun.firma_id)) {
      return rolHatasi("Bu siparişin firması için Eczanem kapalıdır.");
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
