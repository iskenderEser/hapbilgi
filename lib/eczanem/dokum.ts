// lib/eczanem/dokum.ts
// U9 — Faz 5 görünürlük katmanlarının tek kaynağı (İP-§9.2, §10.1). SALT OKUMA.
//
// Kaynak: eczanem_siparisler (durum='onaylandi'); dönem süzgeci onay_tarihi.
// En granüler görünüm eczane × ürün toplamıdır (kutu + indirim TL):
//  - musteri_id hiçbir SELECT'e GİRMEZ (İP-§9.1/9.3) — kişi gizli, toplam görünür.
//  - İzlenme metriği hiçbir katmanda üretilmez (İP-§6.2) — bu bir eksik değil,
//    karardır; Eczanem izleme verisi rapor katmanlarına bilinçli BAĞLANMAZ.
//
// Katmanlar (İP-§9.2):
//  - eczaneDokumu   → eczacı: kendi eczanesinin ürün bazında dökümü
//  - uttDokumu      → UTT: listesindeki eczanelerin eczane×ürün toplamları
//                     (aylık mutabakatın sistem dayanağı — İP-§10.1)
//  - cascadeDokumu  → BM bölge / TM takım / yönetici firma kapsam daralması
//  - pmUrunDokumu   → PM: hiyerarşi değil ÜRÜN ekseni (Türkiye geneli +
//                     bölge→UTT→eczane kırılımı); başka takımın ürünü girmez

import { SupabaseClient } from "@supabase/supabase-js";
import { TUKETICI_ROLLER } from "@/lib/utils/roller";
import { eczaneAdMap } from "@/lib/eczanem/gonderim";

// ── Tipler ──────────────────────────────────────────────────────────────────

export interface UrunToplam {
  urun_id: string;
  urun_adi: string;
  kutu: number;
  indirim_tl: number;
}

export interface EczaneDokum {
  satirlar: UrunToplam[];
  toplam_kutu: number;
  toplam_tl: number;
}

export interface EczaneUrunSatir {
  eczane_id: string;
  eczane_adi: string;
  utt_adi: string | null; // cascade'de dolu (iç hiyerarşi verisi); UTT kendi dökümünde gereksiz
  urunler: UrunToplam[];
  toplam_kutu: number;
  toplam_tl: number;
}

export interface EczaneUrunDokum {
  eczaneler: EczaneUrunSatir[];
  toplam_kutu: number;
  toplam_tl: number;
}

export interface PmEczaneSatir { eczane_adi: string; kutu: number; indirim_tl: number; }
export interface PmUttSatir { utt_adi: string; kutu: number; indirim_tl: number; eczaneler: PmEczaneSatir[]; }
export interface PmBolgeSatir { bolge_adi: string; kutu: number; indirim_tl: number; uttler: PmUttSatir[]; }
export interface PmUrunSatir {
  urun_id: string;
  urun_adi: string;
  kutu: number;        // Türkiye geneli
  indirim_tl: number;  // Türkiye geneli
  bolgeler: PmBolgeSatir[];
}
export interface PmUrunDokum { urunler: PmUrunSatir[]; }

// Kapsam daralması (İP-§9.2): BM → bolge_id, TM → takim_id, yönetici → firma_id.
export type CascadeKapsam =
  | { alan: "bolge_id"; deger: string }
  | { alan: "takim_id"; deger: string }
  | { alan: "firma_id"; deger: string };

// ── İç yardımcılar ──────────────────────────────────────────────────────────

interface SiparisSatiri { eczane_id: string; urun_id: string; adet: number; indirim_tl: number; }

// Onaylı siparişler — dökümün tek veri kaynağı. musteri_id BİLİNÇLİ dışarıda.
async function onayliSiparisler(
  adminSupabase: SupabaseClient,
  filtre: { eczaneIdler?: string[]; urunIdler?: string[] },
  baslangic: string,
  bitis: string
): Promise<SiparisSatiri[]> {
  // Filtre listesi verilmiş ama boşsa kapsamda hiçbir şey yok demektir.
  if (filtre.eczaneIdler && filtre.eczaneIdler.length === 0) return [];
  if (filtre.urunIdler && filtre.urunIdler.length === 0) return [];

  let query = adminSupabase
    .from("eczanem_siparisler")
    .select("eczane_id, urun_id, adet, indirim_tl")
    .eq("durum", "onaylandi")
    .gte("onay_tarihi", baslangic)
    .lte("onay_tarihi", bitis);
  if (filtre.eczaneIdler) query = query.in("eczane_id", filtre.eczaneIdler);
  if (filtre.urunIdler) query = query.in("urun_id", filtre.urunIdler);

  const { data } = await query;
  return (data ?? []).map((s: any) => ({
    eczane_id: s.eczane_id,
    urun_id: s.urun_id,
    adet: Number(s.adet) || 0,
    indirim_tl: Number(s.indirim_tl) || 0,
  }));
}

async function urunAdMap(
  adminSupabase: SupabaseClient,
  urunIdler: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (urunIdler.length === 0) return map;
  const { data } = await adminSupabase
    .from("urunler")
    .select("urun_id, urun_adi")
    .in("urun_id", urunIdler);
  for (const u of data ?? []) map.set((u as any).urun_id, (u as any).urun_adi);
  return map;
}

// Sipariş satırlarını ürün bazında toplar (kutu = Σ adet; İP-§8.2 gereği
// indirim adetle çarpılmadan sipariş satırına yazılmıştır, burada yalnız toplanır).
function urunBazindaTopla(rows: SiparisSatiri[], adMap: Map<string, string>): UrunToplam[] {
  const grup = new Map<string, UrunToplam>();
  for (const r of rows) {
    const mevcut = grup.get(r.urun_id) ?? {
      urun_id: r.urun_id,
      urun_adi: adMap.get(r.urun_id) ?? "-",
      kutu: 0,
      indirim_tl: 0,
    };
    mevcut.kutu += r.adet;
    mevcut.indirim_tl += r.indirim_tl;
    grup.set(r.urun_id, mevcut);
  }
  return [...grup.values()].sort((a, b) => b.indirim_tl - a.indirim_tl);
}

// Eczane×ürün gruplaması — UTT ve cascade dökümlerinin ortak gövdesi.
async function eczaneUrunDokumu(
  adminSupabase: SupabaseClient,
  eczaneIdler: string[],
  uttAdiMap: Map<string, string> | null, // eczane_id → utt adı (cascade'de dolu)
  baslangic: string,
  bitis: string
): Promise<EczaneUrunDokum> {
  const rows = await onayliSiparisler(adminSupabase, { eczaneIdler }, baslangic, bitis);
  if (rows.length === 0) return { eczaneler: [], toplam_kutu: 0, toplam_tl: 0 };

  const satisliEczaneler = [...new Set(rows.map((r) => r.eczane_id))];
  const [adMap, uAdMap] = await Promise.all([
    eczaneAdMap(adminSupabase, satisliEczaneler),
    urunAdMap(adminSupabase, [...new Set(rows.map((r) => r.urun_id))]),
  ]);

  const eczaneler: EczaneUrunSatir[] = satisliEczaneler.map((ez) => {
    const urunler = urunBazindaTopla(rows.filter((r) => r.eczane_id === ez), uAdMap);
    return {
      eczane_id: ez,
      eczane_adi: adMap.get(ez) ?? "(isimsiz eczane)",
      utt_adi: uttAdiMap?.get(ez) ?? null,
      urunler,
      toplam_kutu: urunler.reduce((a, u) => a + u.kutu, 0),
      toplam_tl: urunler.reduce((a, u) => a + u.indirim_tl, 0),
    };
  }).sort((a, b) => b.toplam_tl - a.toplam_tl);

  return {
    eczaneler,
    toplam_kutu: eczaneler.reduce((a, e) => a + e.toplam_kutu, 0),
    toplam_tl: eczaneler.reduce((a, e) => a + e.toplam_tl, 0),
  };
}

// ── Katman 1: Eczane (eczacı/teknisyen) — İP-§9.2 ──────────────────────────

export async function eczaneDokumu(
  adminSupabase: SupabaseClient,
  eczaneId: string,
  baslangic: string,
  bitis: string
): Promise<EczaneDokum> {
  const rows = await onayliSiparisler(adminSupabase, { eczaneIdler: [eczaneId] }, baslangic, bitis);
  const adMap = await urunAdMap(adminSupabase, [...new Set(rows.map((r) => r.urun_id))]);
  const satirlar = urunBazindaTopla(rows, adMap);
  return {
    satirlar,
    toplam_kutu: satirlar.reduce((a, u) => a + u.kutu, 0),
    toplam_tl: satirlar.reduce((a, u) => a + u.indirim_tl, 0),
  };
}

// ── Katman 2: UTT — eczane×ürün, mutabakat dayanağı (İP-§10.1) ─────────────

export async function uttDokumu(
  adminSupabase: SupabaseClient,
  uttAuthId: string,
  baslangic: string,
  bitis: string
): Promise<EczaneUrunDokum> {
  // UTT'nin aktif bağladığı eczaneler (U6 gonderim.ts deseni)
  const { data: baglar } = await adminSupabase
    .from("eclub_eczane_firma")
    .select("eczane_id")
    .eq("baglayan_utt_id", uttAuthId)
    .eq("aktif_mi", true);
  const eczaneIdler = [...new Set((baglar ?? []).map((b: any) => b.eczane_id))];
  return eczaneUrunDokumu(adminSupabase, eczaneIdler, null, baslangic, bitis);
}

// ── Katman 3: BM/TM/yönetici cascade — kapsam daralması (İP-§9.2) ──────────

export async function cascadeDokumu(
  adminSupabase: SupabaseClient,
  kapsam: CascadeKapsam,
  baslangic: string,
  bitis: string
): Promise<EczaneUrunDokum> {
  // Kapsamdaki UTT'ler — eczane bağı UTT üzerinden hiyerarşiye oturur
  const { data: uttler } = await adminSupabase
    .from("kullanicilar")
    .select("kullanici_id, ad, soyad")
    .in("rol", TUKETICI_ROLLER)
    .eq(kapsam.alan, kapsam.deger);
  const uttIdler = (uttler ?? []).map((u: any) => u.kullanici_id);
  if (uttIdler.length === 0) return { eczaneler: [], toplam_kutu: 0, toplam_tl: 0 };

  const uttAd = new Map<string, string>();
  for (const u of uttler ?? []) uttAd.set((u as any).kullanici_id, `${(u as any).ad} ${(u as any).soyad}`);

  const { data: baglar } = await adminSupabase
    .from("eclub_eczane_firma")
    .select("eczane_id, baglayan_utt_id")
    .in("baglayan_utt_id", uttIdler)
    .eq("aktif_mi", true);

  const eczaneUtt = new Map<string, string>(); // eczane_id → utt adı
  for (const b of baglar ?? []) {
    const ad = uttAd.get((b as any).baglayan_utt_id);
    if (ad) eczaneUtt.set((b as any).eczane_id, ad);
  }

  return eczaneUrunDokumu(adminSupabase, [...eczaneUtt.keys()], eczaneUtt, baslangic, bitis);
}

// ── Katman 4: PM — ürün ekseni (İP-§9.2, yeni desen) ────────────────────────
// PM'in ürünleri = urunler.takim_id (ürün sahipliği takım eksenindedir; başka
// takımın/PM'in ürünü süzgeçten yapısal olarak geçemez).

export async function pmUrunDokumu(
  adminSupabase: SupabaseClient,
  takimId: string,
  baslangic: string,
  bitis: string
): Promise<PmUrunDokum> {
  const { data: urunler } = await adminSupabase
    .from("urunler")
    .select("urun_id, urun_adi, firma_id")
    .eq("takim_id", takimId);
  const urunListesi = urunler ?? [];
  if (urunListesi.length === 0) return { urunler: [] };

  const rows = await onayliSiparisler(
    adminSupabase,
    { urunIdler: urunListesi.map((u: any) => u.urun_id) },
    baslangic,
    bitis
  );
  if (rows.length === 0) return { urunler: [] };

  // Kırılım tesisatı: eczane → UTT (ürünün firması üzerinden aktif bağ),
  // UTT → bölge. Bağı çözülemeyen eczane '—' düğümünde toplanır (veri kaybolmaz).
  const eczaneIdler = [...new Set(rows.map((r) => r.eczane_id))];
  const firmaId = (urunListesi[0] as any).firma_id; // tek takım = tek firma

  const [{ data: baglar }, ezAdMap] = await Promise.all([
    adminSupabase
      .from("eclub_eczane_firma")
      .select("eczane_id, baglayan_utt_id")
      .in("eczane_id", eczaneIdler)
      .eq("firma_id", firmaId)
      .eq("aktif_mi", true),
    eczaneAdMap(adminSupabase, eczaneIdler),
  ]);

  const eczaneUttId = new Map<string, string>();
  for (const b of baglar ?? []) eczaneUttId.set((b as any).eczane_id, (b as any).baglayan_utt_id);

  const uttIdler = [...new Set([...eczaneUttId.values()])];
  const uttBilgi = new Map<string, { ad: string; bolge_id: string | null }>();
  if (uttIdler.length > 0) {
    const { data: uttler } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, ad, soyad, bolge_id")
      .in("kullanici_id", uttIdler);
    for (const u of uttler ?? []) {
      uttBilgi.set((u as any).kullanici_id, {
        ad: `${(u as any).ad} ${(u as any).soyad}`,
        bolge_id: (u as any).bolge_id ?? null,
      });
    }
  }

  const bolgeIdler = [...new Set([...uttBilgi.values()].map((u) => u.bolge_id).filter(Boolean))] as string[];
  const bolgeAd = new Map<string, string>();
  if (bolgeIdler.length > 0) {
    const { data: bolgeler } = await adminSupabase
      .from("bolgeler")
      .select("bolge_id, bolge_adi")
      .in("bolge_id", bolgeIdler);
    for (const b of bolgeler ?? []) bolgeAd.set((b as any).bolge_id, (b as any).bolge_adi);
  }

  // urun → bolge → utt → eczane toplama (tek geçiş, Map ağacı)
  const sonuc: PmUrunSatir[] = [];
  for (const u of urunListesi) {
    const urunRows = rows.filter((r) => r.urun_id === (u as any).urun_id);
    if (urunRows.length === 0) continue;

    // bolgeAdi → uttAdi → eczaneAdi → {kutu, tl}
    const agac = new Map<string, Map<string, Map<string, { kutu: number; tl: number }>>>();
    let urunKutu = 0;
    let urunTl = 0;

    for (const r of urunRows) {
      const uttId = eczaneUttId.get(r.eczane_id);
      const utt = uttId ? uttBilgi.get(uttId) : undefined;
      const bolgeAdi = utt?.bolge_id ? (bolgeAd.get(utt.bolge_id) ?? "—") : "—";
      const uttAdi = utt?.ad ?? "—";
      const eczaneAdi = ezAdMap.get(r.eczane_id) ?? "(isimsiz eczane)";

      const bolgeDali = agac.get(bolgeAdi) ?? new Map();
      const uttDali = bolgeDali.get(uttAdi) ?? new Map();
      const hucre = uttDali.get(eczaneAdi) ?? { kutu: 0, tl: 0 };
      hucre.kutu += r.adet;
      hucre.tl += r.indirim_tl;
      uttDali.set(eczaneAdi, hucre);
      bolgeDali.set(uttAdi, uttDali);
      agac.set(bolgeAdi, bolgeDali);

      urunKutu += r.adet;
      urunTl += r.indirim_tl;
    }

    const bolgeler: PmBolgeSatir[] = [...agac.entries()].map(([bolgeAdi, uttMap]) => {
      const uttler: PmUttSatir[] = [...uttMap.entries()].map(([uttAdi, ezMap]) => {
        const eczaneler: PmEczaneSatir[] = [...ezMap.entries()]
          .map(([eczaneAdi, h]) => ({ eczane_adi: eczaneAdi, kutu: h.kutu, indirim_tl: h.tl }))
          .sort((a, b) => b.indirim_tl - a.indirim_tl);
        return {
          utt_adi: uttAdi,
          kutu: eczaneler.reduce((a, e) => a + e.kutu, 0),
          indirim_tl: eczaneler.reduce((a, e) => a + e.indirim_tl, 0),
          eczaneler,
        };
      }).sort((a, b) => b.indirim_tl - a.indirim_tl);
      return {
        bolge_adi: bolgeAdi,
        kutu: uttler.reduce((a, u2) => a + u2.kutu, 0),
        indirim_tl: uttler.reduce((a, u2) => a + u2.indirim_tl, 0),
        uttler,
      };
    }).sort((a, b) => b.indirim_tl - a.indirim_tl);

    sonuc.push({
      urun_id: (u as any).urun_id,
      urun_adi: (u as any).urun_adi,
      kutu: urunKutu,
      indirim_tl: urunTl,
      bolgeler,
    });
  }

  return { urunler: sonuc.sort((a, b) => b.indirim_tl - a.indirim_tl) };
}
