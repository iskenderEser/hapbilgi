// Müşterinin Puanlarım sayfası: aktif bakiye eczane → ürün kırılımında;
// onaylanan kullanımlar ayrı ve salt okunur geçmişte. TL değeri ürünün güncel
// Karşılık tarifesinden üretilir, talep POST'unda sunucu yeniden hesaplar.

import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { eczaneAdMap } from "@/lib/eczanem/gonderim";
import { indirimHesapla, puanOmruGun } from "@/lib/eczanem/kasa";
import { musteriKimligi } from "@/lib/eczanem/oturum";
import { hataYaniti, rolHatasi, sunucuHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";

interface PuanKaydi { eczane_id: string; firma_id: string; urun_id: string; puan_turu: string; kalan_puan: number; created_at: string; }
interface UrunSatiri { urun_id: string; urun_adi: string; barkod: string | null; }
interface TarifeSatiri { urun_id: string; puan: number; tl: number | string; gecerlilik_baslangic: string; }
interface SiparisSatiri {
  siparis_id: string; eczane_id: string; urun_id: string; kullanilan_puan: number;
  indirim_tl: number | string; durum: string; islem_kodu: string | null;
  islem_yapan_kisi_id: string | null; onay_tarihi: string | null;
  karar_tarihi: string | null; created_at: string;
}
interface UrunOzeti {
  urun_id: string; urun_adi: string; barkod: string | null; kullanilabilir_puan: number;
  izleme_puani: number; cevap_puani: number; indirim_tl: number | null;
  en_yakin_son_kullanim: string | null;
  bekleyen_talep: { siparis_id: string; kullanilan_puan: number; indirim_tl: number; created_at: string } | null;
  son_talep_durumu: "onaylanmadi" | "iptal_edildi" | null;
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
    if (eczaneIdler.length === 0) return NextResponse.json({ eczaneler: [], kullanilan_puanlar: [], puan_omru_gun: omurGun }, { status: 200 });

    const [puanSonucu, eczaneFirmaSonucu, siparisSonucu, eczaneAdlari] = await Promise.all([
      adminSupabase.from("eczanem_puan_kayitlari").select("eczane_id, firma_id, urun_id, puan_turu, kalan_puan, created_at")
        .eq("musteri_id", musteriId).in("eczane_id", eczaneIdler).gte("created_at", altSinir).order("created_at", { ascending: true }),
      firmaIdler.length > 0
        ? adminSupabase.from("eclub_eczane_firma").select("eczane_id, firma_id").in("eczane_id", eczaneIdler).in("firma_id", firmaIdler).eq("aktif_mi", true)
        : Promise.resolve({ data: [], error: null }),
      adminSupabase.from("eczanem_siparisler")
        .select("siparis_id, eczane_id, urun_id, kullanilan_puan, indirim_tl, durum, islem_kodu, islem_yapan_kisi_id, onay_tarihi, karar_tarihi, created_at")
        .eq("musteri_id", musteriId).in("eczane_id", eczaneIdler).order("created_at", { ascending: false }),
      eczaneAdMap(adminSupabase, eczaneIdler),
    ]);
    if (puanSonucu.error) return hataYaniti("Puanlarınız alınamadı.", "eczanem_puan_kayitlari SELECT — Puanlarım", puanSonucu.error);
    if (eczaneFirmaSonucu.error) return hataYaniti("Eczane puan kapsamı alınamadı.", "eclub_eczane_firma SELECT — Puanlarım", eczaneFirmaSonucu.error);
    if (siparisSonucu.error) return hataYaniti("İndirim talepleriniz alınamadı.", "eczanem_siparisler SELECT — Puanlarım", siparisSonucu.error);

    const izinliEczaneFirma = new Set((eczaneFirmaSonucu.data ?? []).map((bag) => grupAnahtari(bag.eczane_id, bag.firma_id)));
    const puanlar = ((puanSonucu.data ?? []) as PuanKaydi[]).filter((puan) => izinliEczaneFirma.has(grupAnahtari(puan.eczane_id, puan.firma_id)));
    const siparisler = (siparisSonucu.data ?? []) as SiparisSatiri[];
    const urunIdler = [...new Set([...puanlar.map((puan) => puan.urun_id), ...siparisler.map((siparis) => siparis.urun_id)])];
    if (urunIdler.length === 0) return NextResponse.json({ eczaneler: [], kullanilan_puanlar: [], puan_omru_gun: omurGun }, { status: 200 });

    const simdi = new Date().toISOString();
    const [urunSonucu, tarifeSonucu] = await Promise.all([
      adminSupabase.from("urunler").select("urun_id, urun_adi, barkod").in("urun_id", urunIdler),
      adminSupabase.from("eczanem_urun_tarifeleri").select("urun_id, puan, tl, gecerlilik_baslangic")
        .in("urun_id", urunIdler).lte("gecerlilik_baslangic", simdi).order("gecerlilik_baslangic", { ascending: false }),
    ]);
    if (urunSonucu.error) return hataYaniti("Puan ürünleri alınamadı.", "urunler SELECT — Puanlarım", urunSonucu.error);
    if (tarifeSonucu.error) return hataYaniti("İndirim karşılıkları alınamadı.", "eczanem_urun_tarifeleri SELECT — Puanlarım", tarifeSonucu.error);

    const urunler = new Map<string, UrunSatiri>();
    for (const hamUrun of urunSonucu.data ?? []) { const urun = hamUrun as UrunSatiri; urunler.set(urun.urun_id, urun); }
    const tarifeler = new Map<string, TarifeSatiri>();
    for (const hamTarife of tarifeSonucu.data ?? []) { const tarife = hamTarife as TarifeSatiri; if (!tarifeler.has(tarife.urun_id)) tarifeler.set(tarife.urun_id, tarife); }

    const bekleyenler = new Map<string, SiparisSatiri>();
    const sonuclananlar = new Map<string, SiparisSatiri>();
    for (const siparis of siparisler) {
      const anahtar = grupAnahtari(siparis.eczane_id, siparis.urun_id);
      if (siparis.durum === "bekliyor" && !bekleyenler.has(anahtar)) bekleyenler.set(anahtar, siparis);
      if (siparis.durum === "dustu" && !sonuclananlar.has(anahtar)) sonuclananlar.set(anahtar, siparis);
    }

    const ozetler = new Map<string, UrunOzeti & { eczane_id: string; sonKullanimMs: number | null }>();
    for (const puan of puanlar) {
      const urun = urunler.get(puan.urun_id); if (!urun) continue;
      const anahtar = grupAnahtari(puan.eczane_id, puan.urun_id);
      const kalan = Math.max(0, Number(puan.kalan_puan ?? 0));
      const mevcut = ozetler.get(anahtar) ?? {
        eczane_id: puan.eczane_id, urun_id: puan.urun_id, urun_adi: urun.urun_adi,
        barkod: urun.barkod, kullanilabilir_puan: 0, izleme_puani: 0, cevap_puani: 0,
        indirim_tl: null, en_yakin_son_kullanim: null, sonKullanimMs: null,
        bekleyen_talep: null, son_talep_durumu: null,
      };
      mevcut.kullanilabilir_puan += kalan;
      if (puan.puan_turu === "izleme") mevcut.izleme_puani += kalan;
      if (puan.puan_turu === "cevap") mevcut.cevap_puani += kalan;
      if (kalan > 0) {
        const sonKullanimMs = new Date(puan.created_at).getTime() + omurGun * 24 * 60 * 60 * 1000;
        if (mevcut.sonKullanimMs == null || sonKullanimMs < mevcut.sonKullanimMs) {
          mevcut.sonKullanimMs = sonKullanimMs; mevcut.en_yakin_son_kullanim = new Date(sonKullanimMs).toISOString();
        }
      }
      ozetler.set(anahtar, mevcut);
    }

    // Talep oluşturulduktan sonra puan ömrü dolsa bile bekleyen işlem müşteri
    // tarafından görülmeye ve iptal edilebilmeye devam etmelidir.
    for (const siparis of siparisler) {
      if (siparis.durum !== "bekliyor") continue;
      const urun = urunler.get(siparis.urun_id); if (!urun) continue;
      const anahtar = grupAnahtari(siparis.eczane_id, siparis.urun_id);
      if (!ozetler.has(anahtar)) {
        ozetler.set(anahtar, {
          eczane_id: siparis.eczane_id, urun_id: siparis.urun_id,
          urun_adi: urun.urun_adi, barkod: urun.barkod,
          kullanilabilir_puan: 0, izleme_puani: 0, cevap_puani: 0,
          indirim_tl: null, en_yakin_son_kullanim: null, sonKullanimMs: null,
          bekleyen_talep: null, son_talep_durumu: null,
        });
      }
    }

    for (const [anahtar, ozet] of ozetler) {
      const tarife = tarifeler.get(ozet.urun_id);
      if (tarife) ozet.indirim_tl = indirimHesapla(ozet.kullanilabilir_puan, Number(tarife.puan), Number(tarife.tl));
      const bekleyen = bekleyenler.get(anahtar);
      if (bekleyen) ozet.bekleyen_talep = { siparis_id: bekleyen.siparis_id, kullanilan_puan: Number(bekleyen.kullanilan_puan), indirim_tl: Number(bekleyen.indirim_tl), created_at: bekleyen.created_at };
      const sonuclanan = sonuclananlar.get(anahtar);
      if (sonuclanan) ozet.son_talep_durumu = sonuclanan.islem_yapan_kisi_id ? "onaylanmadi" : "iptal_edildi";
    }

    const eczaneGruplari = new Map<string, { eczane_id: string; eczane_adi: string; urunler: UrunOzeti[] }>();
    for (const ozet of ozetler.values()) {
      if (ozet.kullanilabilir_puan <= 0 && !ozet.bekleyen_talep) continue;
      const eczane = eczaneGruplari.get(ozet.eczane_id) ?? { eczane_id: ozet.eczane_id, eczane_adi: eczaneAdlari.get(ozet.eczane_id) ?? "Eczane", urunler: [] };
      eczane.urunler.push({
        urun_id: ozet.urun_id, urun_adi: ozet.urun_adi, barkod: ozet.barkod,
        kullanilabilir_puan: ozet.kullanilabilir_puan, izleme_puani: ozet.izleme_puani,
        cevap_puani: ozet.cevap_puani, indirim_tl: ozet.indirim_tl,
        en_yakin_son_kullanim: ozet.en_yakin_son_kullanim,
        bekleyen_talep: ozet.bekleyen_talep, son_talep_durumu: ozet.son_talep_durumu,
      });
      eczaneGruplari.set(ozet.eczane_id, eczane);
    }
    const eczaneler = [...eczaneGruplari.values()].map((eczane) => ({ ...eczane, urunler: eczane.urunler.sort((a, b) => b.kullanilabilir_puan - a.kullanilabilir_puan || a.urun_adi.localeCompare(b.urun_adi, "tr")) })).sort((a, b) => a.eczane_adi.localeCompare(b.eczane_adi, "tr"));

    const kullanilan_puanlar = siparisler.filter((siparis) => siparis.durum === "onaylandi").map((siparis) => ({
      siparis_id: siparis.siparis_id, eczane_id: siparis.eczane_id,
      eczane_adi: eczaneAdlari.get(siparis.eczane_id) ?? "Eczane",
      urun_id: siparis.urun_id, urun_adi: urunler.get(siparis.urun_id)?.urun_adi ?? "Ürün",
      barkod: urunler.get(siparis.urun_id)?.barkod ?? null,
      kullanilan_puan: Number(siparis.kullanilan_puan), indirim_tl: Number(siparis.indirim_tl),
      islem_kodu: siparis.islem_kodu, onay_tarihi: siparis.onay_tarihi ?? siparis.karar_tarihi ?? siparis.created_at,
    }));

    return NextResponse.json({ eczaneler, kullanilan_puanlar, puan_omru_gun: omurGun }, { status: 200 });
  } catch (error) {
    return sunucuHatasi(error, "GET /eczanem/api/puanlar");
  }
}
