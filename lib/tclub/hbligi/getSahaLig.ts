// Üst roller için HBLigi saha görünümü.
// Güvenlik ilkesi: kapsam, istemci filtresinden değil oturum kullanıcısının
// firma/takım/bölge kimliklerinden türetilir. RPC sistem genelini döndürse bile
// bu katmanın dışına yalnız yetkili karşılaştırma havuzu çıkar.

import type { SupabaseClient } from "@supabase/supabase-js";
import { ligRpcCagir, type LigPeriyot } from "@/lib/tclub/hbligi/ligRpcCagir";
import type { BmPerformansDetay } from "@/lib/rapor/paylasilan/bmPerformansTipleri";
import { aktifPeriyot, oncekiLigPeriyodu } from "@/lib/zaman/kontrol";

export type SahaGorunumu = "bm" | "tm" | "uretici" | "yonetici" | "admin";
export type SahaBirimTuru = "bolge" | "takim" | "firma";

export interface SahaLigKullanici {
  kullanici_id: string;
  ad: string;
  rol: string;
  firma_id: string | null;
  firma: string;
  takim_id: string | null;
  takim: string;
  bolge_id: string | null;
  bolge: string;
  fotograf_url?: string | null;
  izleme_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  extra_puani: number;
  eclub_puani?: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  toplam_puan: number;
  eksik_puan_alanlari: string[];
  genel_sira?: number;
  etkilesim_sayisi?: number;
  etkilesilen_yayin_sayisi?: number;
}

export interface SahaPuanOzeti {
  izleme_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  extra_puani: number;
  eclub_puani: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
}

export interface SahaAylikKursu {
  ay: number;
  yil: number;
  ay_adi: string;
  sirket_top3: Array<SahaLigKullanici & { sira: number; degisim: number | null }>;
}

export interface SahaLigSonuc {
  tip: "saha";
  gorunum: SahaGorunumu;
  kapsam_adi: string;
  kapsam_aciklamasi: string;
  ana_birim: SahaBirimTuru;
  odak_birim_id: string | null;
  lig: SahaLigKullanici[];
  yetki_kapsami?: "takim" | "firma";
  organizasyon?: {
    takimlar: Array<{ id: string; ad: string }>;
    bolgeler: Array<{ id: string; ad: string; takim_id: string | null }>;
  };
  bakis?: "genel" | "yayinlarim";
  firma_puan_ozeti?: SahaPuanOzeti;
  aylik_kursu?: SahaAylikKursu;
  // BM dışındaki iç roller: Raporlar ile aynı bm_id tabanlı BM→UTT yapısı.
  bm_performans?: BmPerformansDetay[];
}

export interface SahaLigKapsami {
  gorunum: SahaGorunumu;
  firma_id: string | null;
  takim_id: string | null;
  bolge_id: string | null;
}

function sayi(value: unknown): number {
  const sonuc = Number(value ?? 0);
  return Number.isFinite(sonuc) ? sonuc : 0;
}

const PUAN_ALANLARI = [
  "izleme_puani",
  "cevaplama_puani",
  "oneri_puani",
  "extra_puani",
  "ileri_sarma_kaybi",
  "yanlis_cevap_kaybi",
  "oneri_kaybi",
  "toplam_puan",
] as const;

function eksikPuanAlanlari(row: Record<string, unknown>): string[] {
  return PUAN_ALANLARI.filter((alan) => {
    const deger = row[alan];
    return deger === null || deger === undefined || deger === "" || !Number.isFinite(Number(deger));
  });
}

function satiraCevir(row: Record<string, unknown>, fotoMap: Map<string, string | null>): SahaLigKullanici {
  const kullaniciId = String(row.kullanici_id);
  return {
    kullanici_id: kullaniciId,
    ad: `${String(row.ad ?? "")} ${String(row.soyad ?? "")}`.trim(),
    rol: String(row.rol ?? "utt"),
    firma_id: row.firma_id ? String(row.firma_id) : null,
    firma: String(row.firma_adi ?? "-"),
    takim_id: row.takim_id ? String(row.takim_id) : null,
    takim: String(row.takim_adi ?? "-"),
    bolge_id: row.bolge_id ? String(row.bolge_id) : null,
    bolge: String(row.bolge_adi ?? "-"),
    fotograf_url: fotoMap.get(kullaniciId) ?? null,
    izleme_puani: sayi(row.izleme_puani),
    cevaplama_puani: sayi(row.cevaplama_puani),
    oneri_puani: sayi(row.oneri_puani),
    extra_puani: sayi(row.extra_puani),
    eclub_puani: sayi(row.eclub_puani),
    ileri_sarma_kaybi: sayi(row.ileri_sarma_kaybi),
    yanlis_cevap_kaybi: sayi(row.yanlis_cevap_kaybi),
    oneri_kaybi: sayi(row.oneri_kaybi),
    toplam_puan: sayi(row.toplam_puan),
    eksik_puan_alanlari: eksikPuanAlanlari(row),
  };
}

function ilkAd(satirlar: SahaLigKullanici[], alan: "firma" | "takim" | "bolge", fallback: string): string {
  const ad = satirlar.find((satir) => satir[alan] && satir[alan] !== "-")?.[alan];
  return ad || fallback;
}

function organizasyonOlustur(satirlar: SahaLigKullanici[]): NonNullable<SahaLigSonuc["organizasyon"]> {
  const takimlar = new Map<string, string>();
  const bolgeler = new Map<string, { id: string; ad: string; takim_id: string | null }>();

  for (const satir of satirlar) {
    if (satir.takim_id) takimlar.set(satir.takim_id, satir.takim);
    if (satir.bolge_id) {
      bolgeler.set(satir.bolge_id, {
        id: satir.bolge_id,
        ad: satir.bolge,
        takim_id: satir.takim_id,
      });
    }
  }

  return {
    takimlar: [...takimlar].map(([id, ad]) => ({ id, ad })).sort((a, b) => a.ad.localeCompare(b.ad, "tr")),
    bolgeler: [...bolgeler.values()].sort((a, b) => a.ad.localeCompare(b.ad, "tr")),
  };
}

function puanOzetiOlustur(satirlar: SahaLigKullanici[]): SahaPuanOzeti {
  return satirlar.reduce<SahaPuanOzeti>((ozet, satir) => ({
    izleme_puani: ozet.izleme_puani + satir.izleme_puani,
    cevaplama_puani: ozet.cevaplama_puani + satir.cevaplama_puani,
    oneri_puani: ozet.oneri_puani + satir.oneri_puani,
    extra_puani: ozet.extra_puani + satir.extra_puani,
    eclub_puani: ozet.eclub_puani + (satir.eclub_puani ?? 0),
    ileri_sarma_kaybi: ozet.ileri_sarma_kaybi + satir.ileri_sarma_kaybi,
    yanlis_cevap_kaybi: ozet.yanlis_cevap_kaybi + satir.yanlis_cevap_kaybi,
    oneri_kaybi: ozet.oneri_kaybi + satir.oneri_kaybi,
  }), {
    izleme_puani: 0,
    cevaplama_puani: 0,
    oneri_puani: 0,
    extra_puani: 0,
    eclub_puani: 0,
    ileri_sarma_kaybi: 0,
    yanlis_cevap_kaybi: 0,
    oneri_kaybi: 0,
  });
}

const AY_ADLARI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function puanHareketiVar(satir: SahaLigKullanici): boolean {
  return satir.izleme_puani + satir.cevaplama_puani + satir.oneri_puani + satir.extra_puani
    + (satir.eclub_puani ?? 0) + satir.ileri_sarma_kaybi + satir.yanlis_cevap_kaybi + satir.oneri_kaybi > 0;
}

function firmaLiginiSirala(satirlar: SahaLigKullanici[], firmaId: string) {
  const firmaSatirlari = satirlar
    .filter((satir) => satir.firma_id === firmaId && puanHareketiVar(satir))
    .sort((a, b) => b.toplam_puan - a.toplam_puan || a.ad.localeCompare(b.ad, "tr"));
  const puanSirasi = new Map(
    [...new Set(firmaSatirlari.map((satir) => satir.toplam_puan))]
      .sort((a, b) => b - a)
      .map((puan, index) => [puan, index + 1]),
  );
  return firmaSatirlari.map((satir) => ({ ...satir, sira: puanSirasi.get(satir.toplam_puan) ?? 0 }));
}

function aylikKursuOlustur(
  oncekiAySatirlari: SahaLigKullanici[],
  ikiOncekiAySatirlari: SahaLigKullanici[],
  firmaId: string,
  oncekiAy: LigPeriyot,
): SahaAylikKursu {
  const oncekiAyLigi = firmaLiginiSirala(oncekiAySatirlari, firmaId);
  const ikiOncekiAySiralar = new Map(
    firmaLiginiSirala(ikiOncekiAySatirlari, firmaId).map((satir) => [satir.kullanici_id, satir.sira]),
  );
  return {
    ay: oncekiAy.ay,
    yil: oncekiAy.yil,
    ay_adi: AY_ADLARI[oncekiAy.ay - 1] ?? `${oncekiAy.ay}. Ay`,
    sirket_top3: oncekiAyLigi.slice(0, 3).map((satir) => {
      const ikiOncekiSira = ikiOncekiAySiralar.get(satir.kullanici_id);
      return {
        ...satir,
        degisim: ikiOncekiSira === undefined ? null : ikiOncekiSira - satir.sira,
      };
    }),
  };
}

/**
 * Rolün yetkili karşılaştırma havuzunu döndürür.
 * - BM: takım havuzu; varsayılan odak kendi bölgesi.
 * - TM: firma havuzu; varsayılan odak kendi takımı.
 * - Üretici: takım bağlantısı varsa yalnız o takım; yoksa kendi firması.
 * - Yönetici: yalnız kendi firma havuzu.
 * - Admin: sistem geneli; firma kırılımı.
 */
export async function getSahaLig(
  supabase: SupabaseClient,
  kapsam: SahaLigKapsami,
  periyot: LigPeriyot,
  simdi: Date = new Date(),
): Promise<SahaLigSonuc> {
  const hamSatirlar = await ligRpcCagir(supabase, periyot);
  let oncekiAy: LigPeriyot | null = null;
  let oncekiAyHamSatirlar: Awaited<ReturnType<typeof ligRpcCagir>> = [];
  let ikiOncekiAyHamSatirlar: Awaited<ReturnType<typeof ligRpcCagir>> = [];
  if (kapsam.gorunum === "uretici") {
    const buAy: LigPeriyot = { periyot: "ay", ...aktifPeriyot(simdi) };
    oncekiAy = oncekiLigPeriyodu(buAy);
    const ikiOncekiAy = oncekiLigPeriyodu(oncekiAy);
    [oncekiAyHamSatirlar, ikiOncekiAyHamSatirlar] = await Promise.all([
      ligRpcCagir(supabase, oncekiAy),
      ligRpcCagir(supabase, ikiOncekiAy),
    ]);
  }
  let fotoMap = new Map<string, string | null>();
  const kullaniciIdler = [...new Set([
    ...hamSatirlar,
    ...oncekiAyHamSatirlar,
    ...ikiOncekiAyHamSatirlar,
  ].map((satir) => satir.kullanici_id))];
  if (kullaniciIdler.length > 0 && typeof supabase.from === "function") {
    const { data: fotolar } = await supabase
      .from("kullanicilar")
      .select("kullanici_id, fotograf_url")
      .in("kullanici_id", kullaniciIdler);
    if (fotolar) {
      fotoMap = new Map(fotolar.map((foto) => [foto.kullanici_id, foto.fotograf_url]));
    }
  }
  const tumSatirlar = hamSatirlar.map((row) => satiraCevir(row, fotoMap));
  const oncekiAySatirlari = oncekiAyHamSatirlar.map((row) => satiraCevir(row, fotoMap));
  const ikiOncekiAySatirlari = ikiOncekiAyHamSatirlar.map((row) => satiraCevir(row, fotoMap));

  if (kapsam.gorunum === "admin") {
    return {
      tip: "saha",
      gorunum: "admin",
      kapsam_adi: "Tüm firmalar",
      kapsam_aciklamasi: "Firmalar arası saha performansı",
      ana_birim: "firma",
      odak_birim_id: null,
      lig: tumSatirlar,
    };
  }

  if (!kapsam.firma_id) {
    throw new Error("HBLigi saha görünümü için firma ataması gerekli.");
  }

  const firmaSatirlari = tumSatirlar.filter((satir) => satir.firma_id === kapsam.firma_id);
  const ureticiAylikKursu = kapsam.gorunum === "uretici" && oncekiAy
    ? aylikKursuOlustur(oncekiAySatirlari, ikiOncekiAySatirlari, kapsam.firma_id, oncekiAy)
    : undefined;
  const takimSatirlari = kapsam.takim_id
    ? firmaSatirlari.filter((satir) => satir.takim_id === kapsam.takim_id)
    : [];
  const bolgeSatirlari = kapsam.bolge_id
    ? takimSatirlari.filter((satir) => satir.bolge_id === kapsam.bolge_id)
    : [];

  if (kapsam.gorunum === "yonetici") {
    return {
      tip: "saha",
      gorunum: "yonetici",
      kapsam_adi: ilkAd(firmaSatirlari, "firma", "Firma sahası"),
      kapsam_aciklamasi: "Firma genelinde takım ve UTT performansı",
      ana_birim: "takim",
      odak_birim_id: null,
      lig: firmaSatirlari,
    };
  }

  if (kapsam.gorunum === "uretici" && !kapsam.takim_id) {
    return {
      tip: "saha",
      gorunum: "uretici",
      kapsam_adi: ilkAd(firmaSatirlari, "firma", "Firma sahası"),
      kapsam_aciklamasi: "Üretilen içeriğin firma sahasındaki karşılığı",
      ana_birim: "takim",
      odak_birim_id: null,
      lig: firmaSatirlari,
      yetki_kapsami: "firma",
      organizasyon: organizasyonOlustur(firmaSatirlari),
      firma_puan_ozeti: puanOzetiOlustur(firmaSatirlari),
      aylik_kursu: ureticiAylikKursu,
    };
  }

  if (!kapsam.takim_id) {
    throw new Error("HBLigi saha görünümü için takım ataması gerekli.");
  }

  if (kapsam.gorunum === "tm") {
    return {
      tip: "saha",
      gorunum: "tm",
      kapsam_adi: ilkAd(takimSatirlari, "takim", "Takım sahası"),
      kapsam_aciklamasi: "Firma takımları içinde kendi takımının konumu",
      ana_birim: "takim",
      odak_birim_id: kapsam.takim_id,
      lig: firmaSatirlari,
    };
  }

  if (kapsam.gorunum === "uretici") {
    return {
      tip: "saha",
      gorunum: "uretici",
      kapsam_adi: ilkAd(takimSatirlari, "takim", "Takım sahası"),
      kapsam_aciklamasi: "Üretilen içeriğin takım sahasındaki karşılığı",
      ana_birim: "bolge",
      odak_birim_id: null,
      lig: takimSatirlari,
      yetki_kapsami: "takim",
      organizasyon: organizasyonOlustur(takimSatirlari),
      firma_puan_ozeti: puanOzetiOlustur(firmaSatirlari),
      aylik_kursu: ureticiAylikKursu,
    };
  }

  if (!kapsam.bolge_id) {
    throw new Error("BM HBLigi görünümü için bölge ataması gerekli.");
  }

  return {
    tip: "saha",
    gorunum: "bm",
    kapsam_adi: ilkAd(bolgeSatirlari, "bolge", "Bölge sahası"),
    kapsam_aciklamasi: "Takım bölgeleri içinde kendi bölgesinin konumu",
    ana_birim: "bolge",
    odak_birim_id: kapsam.bolge_id,
    lig: takimSatirlari,
  };
}
