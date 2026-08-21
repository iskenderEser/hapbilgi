// Müşterinin kullanılabilir Eczanem puanları: eczane → ürün → kazanım türü.
// Puanlar birleştirilmez; her satır kendi eczane ve ürün kilidinde gösterilir.

import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { eczaneAdMap } from "@/lib/eczanem/gonderim";
import { musteriKimligi } from "@/lib/eczanem/oturum";
import { puanOmruGun } from "@/lib/eczanem/kasa";
import { hataYaniti, rolHatasi, sunucuHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";

interface PuanKaydi {
  eczane_id: string;
  firma_id: string;
  urun_id: string;
  puan_turu: string;
  kalan_puan: number;
  created_at: string;
}

interface UrunSatiri {
  urun_id: string;
  urun_adi: string;
}

interface BekleyenSiparis {
  eczane_id: string;
  urun_id: string;
  kullanilan_puan: number;
  created_at: string;
}

interface UrunOzeti {
  urun_id: string;
  urun_adi: string;
  kullanilabilir_puan: number;
  izleme_puani: number;
  cevap_puani: number;
  en_yakin_son_kullanim: string | null;
  bekleyen_talep: { kullanilan_puan: number; created_at: string } | null;
}

const grupAnahtari = (eczaneId: string, urunId: string) => `${eczaneId}:${urunId}`;

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const kimlik = await musteriKimligi(adminSupabase, user.id);
    if (!kimlik.ok) return rolHatasi(kimlik.hata ?? "Müşteri doğrulanamadı.");

    const eczaneIdler = kimlik.eczaneIdler ?? [];
    const firmaIdler = kimlik.firmaIdler ?? [];
    const musteriId = kimlik.musteriId!;
    const omurGun = await puanOmruGun(adminSupabase);
    const altSinir = new Date(Date.now() - omurGun * 24 * 60 * 60 * 1000).toISOString();

    if (eczaneIdler.length === 0 || firmaIdler.length === 0) {
      return NextResponse.json({ eczaneler: [], puan_omru_gun: omurGun }, { status: 200 });
    }

    const [puanSonucu, eczaneFirmaSonucu] = await Promise.all([
      adminSupabase
        .from("eczanem_puan_kayitlari")
        .select("eczane_id, firma_id, urun_id, puan_turu, kalan_puan, created_at")
        .eq("musteri_id", musteriId)
        .in("eczane_id", eczaneIdler)
        .in("firma_id", firmaIdler)
        .gte("created_at", altSinir)
        .order("created_at", { ascending: true }),
      adminSupabase
        .from("eclub_eczane_firma")
        .select("eczane_id, firma_id")
        .in("eczane_id", eczaneIdler)
        .in("firma_id", firmaIdler)
        .eq("aktif_mi", true),
    ]);
    const { data: puanlarRaw, error: puanError } = puanSonucu;
    if (puanError) return hataYaniti("Puanlarınız alınamadı.", "eczanem_puan_kayitlari SELECT — müşteri puan özeti", puanError);
    if (eczaneFirmaSonucu.error) return hataYaniti("Eczane puan kapsamı alınamadı.", "eclub_eczane_firma SELECT — müşteri puan özeti", eczaneFirmaSonucu.error);

    const izinliEczaneFirma = new Set((eczaneFirmaSonucu.data ?? []).map((bag) => grupAnahtari(bag.eczane_id, bag.firma_id)));
    const puanlar = ((puanlarRaw ?? []) as PuanKaydi[])
      .filter((puan) => izinliEczaneFirma.has(grupAnahtari(puan.eczane_id, puan.firma_id)));
    const urunIdler = [...new Set(puanlar.map((puan) => puan.urun_id))];
    if (urunIdler.length === 0) {
      return NextResponse.json({ eczaneler: [], puan_omru_gun: omurGun }, { status: 200 });
    }

    const [urunSonucu, bekleyenSonucu, eczaneAdlari] = await Promise.all([
      adminSupabase
        .from("urunler")
        .select("urun_id, urun_adi")
        .in("urun_id", urunIdler)
        .in("firma_id", firmaIdler),
      adminSupabase
        .from("eczanem_siparisler")
        .select("eczane_id, urun_id, kullanilan_puan, created_at")
        .eq("musteri_id", musteriId)
        .eq("durum", "bekliyor")
        .in("eczane_id", eczaneIdler)
        .in("urun_id", urunIdler),
      eczaneAdMap(adminSupabase, eczaneIdler),
    ]);
    if (urunSonucu.error) return hataYaniti("Puan ürünleri alınamadı.", "urunler SELECT — müşteri puan özeti", urunSonucu.error);
    if (bekleyenSonucu.error) return hataYaniti("Bekleyen indirim talepleri alınamadı.", "eczanem_siparisler SELECT — müşteri puan özeti", bekleyenSonucu.error);

    const urunAdlari = new Map((urunSonucu.data ?? []).map((urunRaw) => {
      const urun = urunRaw as UrunSatiri;
      return [urun.urun_id, urun.urun_adi] as const;
    }));
    const bekleyenler = new Map((bekleyenSonucu.data ?? []).map((siparisRaw) => {
      const siparis = siparisRaw as BekleyenSiparis;
      return [grupAnahtari(siparis.eczane_id, siparis.urun_id), siparis] as const;
    }));

    const urunOzetleri = new Map<string, UrunOzeti & { eczane_id: string; sonKullanimMs: number | null }>();
    for (const puan of puanlar) {
      if (!urunAdlari.has(puan.urun_id)) continue;
      const anahtar = grupAnahtari(puan.eczane_id, puan.urun_id);
      const kalan = Math.max(0, Number(puan.kalan_puan ?? 0));
      const mevcut = urunOzetleri.get(anahtar) ?? {
        eczane_id: puan.eczane_id,
        urun_id: puan.urun_id,
        urun_adi: urunAdlari.get(puan.urun_id) ?? "Ürün",
        kullanilabilir_puan: 0,
        izleme_puani: 0,
        cevap_puani: 0,
        en_yakin_son_kullanim: null,
        sonKullanimMs: null,
        bekleyen_talep: null,
      };
      mevcut.kullanilabilir_puan += kalan;
      if (puan.puan_turu === "izleme") mevcut.izleme_puani += kalan;
      if (puan.puan_turu === "cevap") mevcut.cevap_puani += kalan;
      if (kalan > 0) {
        const sonKullanimMs = new Date(puan.created_at).getTime() + omurGun * 24 * 60 * 60 * 1000;
        if (mevcut.sonKullanimMs == null || sonKullanimMs < mevcut.sonKullanimMs) {
          mevcut.sonKullanimMs = sonKullanimMs;
          mevcut.en_yakin_son_kullanim = new Date(sonKullanimMs).toISOString();
        }
      }
      urunOzetleri.set(anahtar, mevcut);
    }

    for (const [anahtar, siparis] of bekleyenler) {
      const ozet = urunOzetleri.get(anahtar);
      if (ozet) ozet.bekleyen_talep = { kullanilan_puan: Number(siparis.kullanilan_puan), created_at: siparis.created_at };
    }

    const eczaneGruplari = new Map<string, { eczane_id: string; eczane_adi: string; urunler: UrunOzeti[] }>();
    for (const ozet of urunOzetleri.values()) {
      if (ozet.kullanilabilir_puan <= 0 && !ozet.bekleyen_talep) continue;
      const eczane = eczaneGruplari.get(ozet.eczane_id) ?? {
        eczane_id: ozet.eczane_id,
        eczane_adi: eczaneAdlari.get(ozet.eczane_id) ?? "Eczane",
        urunler: [],
      };
      eczane.urunler.push({
        urun_id: ozet.urun_id,
        urun_adi: ozet.urun_adi,
        kullanilabilir_puan: ozet.kullanilabilir_puan,
        izleme_puani: ozet.izleme_puani,
        cevap_puani: ozet.cevap_puani,
        en_yakin_son_kullanim: ozet.en_yakin_son_kullanim,
        bekleyen_talep: ozet.bekleyen_talep,
      });
      eczaneGruplari.set(ozet.eczane_id, eczane);
    }

    const eczaneler = [...eczaneGruplari.values()]
      .map((eczane) => ({
        ...eczane,
        urunler: eczane.urunler.sort((a, b) => b.kullanilabilir_puan - a.kullanilabilir_puan || a.urun_adi.localeCompare(b.urun_adi, "tr")),
      }))
      .sort((a, b) => a.eczane_adi.localeCompare(b.eczane_adi, "tr"));

    return NextResponse.json({ eczaneler, puan_omru_gun: omurGun }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /eczanem/api/puanlar");
  }
}
