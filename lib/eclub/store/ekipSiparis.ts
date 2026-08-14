export const ECLUB_SIPARIS_DURUMLARI = [
  "beklemede",
  "hazirlaniyor",
  "kargoda",
  "teslim_edildi",
  "iptal",
] as const;

export type EclubSiparisDurum = (typeof ECLUB_SIPARIS_DURUMLARI)[number];

export const ECLUB_SIPARIS_DURUM_ETIKETLERI: Record<EclubSiparisDurum, string> = {
  beklemede: "Beklemede",
  hazirlaniyor: "Hazırlanıyor",
  kargoda: "Kargoda",
  teslim_edildi: "Teslim Edildi",
  iptal: "İptal Edildi",
};

export const ECLUB_SIPARIS_DURUM_RENKLERI: Record<
  EclubSiparisDurum,
  { metin: string; arka: string; kenar: string }
> = {
  beklemede: { metin: "#854d0e", arka: "#fefce8", kenar: "#fde68a" },
  hazirlaniyor: { metin: "#6d28d9", arka: "#f5f3ff", kenar: "#ddd6fe" },
  kargoda: { metin: "#1d4ed8", arka: "#e6f1fb", kenar: "#bfdbfe" },
  teslim_edildi: { metin: "#16865f", arka: "#effaf5", kenar: "#bbf7d0" },
  iptal: { metin: "#bc2d0d", arka: "#fef2f2", kenar: "#fecaca" },
};

export interface EclubSiparisAdresSnapshot {
  ad_soyad?: string;
  alici_adi?: string;
  telefon?: string;
  il?: string;
  ilce?: string;
  acik_adres?: string;
  adres_detay?: string;
}

export interface EclubEkipSiparisSatiri {
  utt_id?: string;
  utt_adi?: string;
  bm_adi?: string;
  takim_adi?: string;
  bolge_adi?: string;
  siparis_id: string;
  kisi_id: string;
  eczane_id: string;
  gln: string | null;
  eczane_adi: string;
  kisi_ad: string;
  kisi_soyad: string;
  kisi_rol: string;
  urun_id: string;
  urun_adi: string;
  urun_gorsel_url: string | null;
  adres_snapshot: EclubSiparisAdresSnapshot | null;
  adet: number;
  puan_birim_fiyat: number;
  siparis_toplam_puan: number;
  firma_kullanilan_puan: number;
  durum: EclubSiparisDurum;
  kargo_firmasi: string | null;
  kargo_takip_no: string | null;
  iptal_sebebi: string | null;
  created_at: string;
  guncellenme_at: string | null;
  teslim_alma_at: string | null;
}

export interface EclubSiparisKapsamEczane {
  eczane_id: string;
  eczane_adi: string;
  gln: string | null;
}

export interface EclubSiparisKapsamKisi {
  kisi_id: string;
  eczane_id: string;
  ad: string;
  soyad: string;
  rol: string;
}

export interface EclubSiparisOzet {
  toplam: number;
  islemde: number;
  kargoda: number;
  teslim_edildi: number;
  iptal: number;
  firma_kullanilan_puan: number;
}

export interface EclubSiparisApiData {
  siparisler: EclubEkipSiparisSatiri[];
  toplam: number;
  ozet: EclubSiparisOzet;
  kapsam: {
    eczaneler: EclubSiparisKapsamEczane[];
    kisiler: EclubSiparisKapsamKisi[];
  };
}

export interface EclubSiparisSorgusu {
  uttId: string | null;
  eczaneId: string | null;
  kisiId: string | null;
  durum: EclubSiparisDurum | null;
  tarihBaslangic: string | null;
  tarihBitis: string | null;
  offset: number;
  limit: number;
}

export type EclubSiparisSorguSonucu =
  | { ok: true; sorgu: EclubSiparisSorgusu }
  | { ok: false; hata: string; alanlar: string[] };

const UUID_DESENI = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GUN_DESENI = /^\d{4}-\d{2}-\d{2}$/;

function gecerliGun(deger: string): boolean {
  if (!GUN_DESENI.test(deger)) return false;
  const [yil, ay, gun] = deger.split("-").map(Number);
  const tarih = new Date(Date.UTC(yil, ay - 1, gun));
  return tarih.getUTCFullYear() === yil && tarih.getUTCMonth() === ay - 1 && tarih.getUTCDate() === gun;
}

function pozitifTamSayi(deger: string | null, varsayilan: number): number | null {
  if (deger === null) return varsayilan;
  if (!/^\d+$/.test(deger)) return null;
  return Number(deger);
}

export function eclubSiparisSorgusunuParse(searchParams: URLSearchParams): EclubSiparisSorguSonucu {
  const uttId = searchParams.get("utt_id") || null;
  const eczaneId = searchParams.get("eczane_id") || null;
  const kisiId = searchParams.get("kisi_id") || null;
  const durumHam = searchParams.get("durum") || null;
  const tarihBaslangic = searchParams.get("tarih_baslangic") || null;
  const tarihBitis = searchParams.get("tarih_bitis") || null;
  const offset = pozitifTamSayi(searchParams.get("offset"), 0);
  const limitHam = pozitifTamSayi(searchParams.get("limit"), 30);

  if (uttId && !UUID_DESENI.test(uttId)) return { ok: false, hata: "Geçersiz UTT.", alanlar: ["utt_id"] };
  if (eczaneId && !UUID_DESENI.test(eczaneId)) return { ok: false, hata: "Geçersiz eczane.", alanlar: ["eczane_id"] };
  if (kisiId && !UUID_DESENI.test(kisiId)) return { ok: false, hata: "Geçersiz kişi.", alanlar: ["kisi_id"] };
  if (durumHam && !ECLUB_SIPARIS_DURUMLARI.includes(durumHam as EclubSiparisDurum)) {
    return { ok: false, hata: "Geçersiz sipariş durumu.", alanlar: ["durum"] };
  }
  if (tarihBaslangic && !gecerliGun(tarihBaslangic)) {
    return { ok: false, hata: "Geçersiz başlangıç tarihi.", alanlar: ["tarih_baslangic"] };
  }
  if (tarihBitis && !gecerliGun(tarihBitis)) {
    return { ok: false, hata: "Geçersiz bitiş tarihi.", alanlar: ["tarih_bitis"] };
  }
  if (tarihBaslangic && tarihBitis && tarihBaslangic > tarihBitis) {
    return { ok: false, hata: "Başlangıç tarihi bitiş tarihinden sonra olamaz.", alanlar: ["tarih_baslangic", "tarih_bitis"] };
  }
  if (offset === null) return { ok: false, hata: "offset sıfır veya pozitif tam sayı olmalı.", alanlar: ["offset"] };
  if (limitHam === null || limitHam < 1) return { ok: false, hata: "limit pozitif tam sayı olmalı.", alanlar: ["limit"] };

  return {
    ok: true,
    sorgu: {
      uttId,
      eczaneId,
      kisiId,
      durum: durumHam as EclubSiparisDurum | null,
      tarihBaslangic,
      tarihBitis,
      offset,
      limit: Math.min(limitHam, 100),
    },
  };
}
