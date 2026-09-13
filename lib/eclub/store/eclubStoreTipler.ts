import type { NextResponse } from "next/server";

export interface EclubStoreKategori {
  kategori_id: string;
  ad: string;
  sira: number;
  aktif_mi: boolean;
}

export interface EclubStoreUrun {
  urun_id: string;
  kategori_id: string | null;
  ad: string;
  aciklama: string | null;
  gorsel_url: string | null;
  puan_fiyat: number;
  stok: number;
  aktif_mi: boolean;
  kullanilabilir_puan?: number;
}

export interface EclubStoreAdres {
  adres_id: string;
  kisi_id: string;
  baslik: string | null;
  ad_soyad: string;
  eczane_adi?: string | null;
  telefon: string;
  il: string;
  ilce: string;
  acik_adres: string;
  varsayilan_mi: boolean;
}

export interface EclubStoreFirmaBakiye {
  firma_id: string;
  firma_adi: string;
  kazanilan: number;
  harcanan: number;
  bakiye: number;
}

export interface EclubStoreSiparis {
  siparis_id: string;
  kisi_id: string;
  urun_id: string;
  adres_id: string | null;
  adres_snapshot: unknown | null;
  adet: number;
  puan_birim_fiyat: number;
  toplam_puan: number;
  durum: string;
  kargo_firmasi: string | null;
  kargo_takip_no: string | null;
  iptal_sebebi: string | null;
  created_at: string;
  guncellenme_at: string;
  teslim_alma_at: string | null;
}

export interface EclubStoreSiparisFirmaPuan {
  id: string;
  siparis_id: string;
  firma_id: string;
  kullanilan_puan: number;
}

export interface EclubStoreSiparisOlusturParams {
  kisi_id: string;
  urun_id: string;
  adres_id: string;
  adet: number;
}

export interface EclubStoreSiparisOlusturSonuc {
  ok: boolean;
  siparis_id: string | null;
  hata: string | null;
}

export interface EclubStoreSiparisIptalParams {
  siparis_id: string;
  iptal_eden_kisi_id: string;
  is_admin: boolean;
  sebep: string | null;
}

export interface EclubStoreKayitSonuc {
  ok: boolean;
  error?: string;
}

export type EclubStoreApiYanit = NextResponse;

export type EclubStoreAdminSekme = "urunler" | "kategoriler" | "siparisler";

export interface EclubStoreKategoriForm {
  kategori_id?: string;
  ad: string;
  sira: number;
  aktif_mi: boolean;
}

export interface EclubStoreUrunForm {
  urun_id?: string;
  kategori_id: string | null;
  ad: string;
  aciklama: string;
  gorsel_url: string | null;
  puan_fiyat: number;
  stok: number;
  aktif_mi: boolean;
}

export interface EclubStoreKategoriDetay extends EclubStoreKategori {
  urun_sayisi: number;
}

export interface EclubStoreUrunDetay extends EclubStoreUrun {
  kategori_adi: string | null;
}

export interface EclubStoreAdminSiparis {
  siparis_id: string;
  kisi_id: string;
  kisi_ad_soyad: string;
  urun_adi: string;
  adet: number;
  toplam_puan: number;
  durum: string;
  kargo_firmasi: string | null;
  kargo_takip_no: string | null;
  adres_snapshot: unknown | null;
  iptal_sebebi: string | null;
  created_at: string;
}

export interface EclubStoreGorselSonuc {
  ok: boolean;
  url?: string;
  yol?: string;
  error?: string;
}

// ── Satış Şartlı / Serbest Siparişli Puan & Hediye Çeki Tipleri ─────────────

export type SatisSartiTipi = "satis_sartli" | "serbest_siparis";

export interface BaremSatiri {
  min_puan: number;
  max_puan: number;
  adet: number;
  mal_fazlasi: number;
}

export const VARSAYILAN_BAREM_TABLOSU: BaremSatiri[] = [
  { min_puan: 200, max_puan: 399, adet: 10, mal_fazlasi: 1 },
  { min_puan: 400, max_puan: 799, adet: 20, mal_fazlasi: 3 },
  { min_puan: 800, max_puan: 1000, adet: 50, mal_fazlasi: 25 },
];

export interface EclubEczaneStoreOzetItem {
  yayin_id: string;
  urun_id: string;
  urun_adi: string;
  firma_id: string;
  firma_adi: string;
  eczane_id: string;
  eczane_adi: string;
  toplanan_puan: number;
  havuz_toplam_puan?: number;
  satis_sarti_tipi: SatisSartiTipi;
  gizli_sart_katlama_orani: number;
  barem_tablosu: BaremSatiri[];
  karsilik_puan: number;
  karsilik_tl: number;
  uygun_adet: number;
  aktif_barem_adet?: number;
  aktif_barem_min_puan?: number;
  uygun_mal_fazlasi: number;
  aktif_barem_mal_fazlasi?: number;
  hak_edilen_cek_tl: number;
  baz_cek_tutari_tl?: number;
  katlanmis_cek_tl: number;
  katlanmis_cek_tutari_tl?: number;
  talep_durumu?: string | null;
  cek_tutari_tl?: number | null;
  cek_kodu?: string | null;
  donem_kodu?: string;
  donem_baslangic?: string;
  donem_bitis?: string;
  talep_penceresi_acik_mi?: boolean;
}

export type CekTalepDurumu =
  | "beklemede"
  | "bm_onayinda"
  | "onaylandi"
  | "cek_kodlari_gonderildi"
  | "iptal";

export interface EclubStoreCekTalebiSatiri {
  talep_id: string;
  eczane_id: string;
  eczane_adi?: string;
  gln?: string | null;
  eczane_tel?: string | null;
  firma_id: string;
  firma_adi?: string;
  takim_adi?: string;
  bolge_adi?: string;
  yayin_id: string;
  urun_adi?: string;
  talep_eden_kisi_id: string;
  talep_eden_ad_soyad?: string;
  talep_eden_rol?: string;
  talep_eden_tel?: string;
  eczaci_ad_soyad?: string;
  eczaci_tel?: string;
  teknisyen_ad_soyad?: string;
  teknisyen_tel?: string;
  toplanan_puan: number;
  talep_edilen_cek_tl: number;
  siparis_tipi: SatisSartiTipi;
  siparis_verildi_mi: boolean;
  siparis_adet: number;
  siparis_mal_fazlasi: number;
  durum: CekTalepDurumu;
  utt_id?: string | null;
  utt_adi?: string | null;
  bm_id?: string | null;
  bm_adi?: string | null;
  bm_onay_tarihi?: string | null;
  cek_kodu?: string | null;
  cek_gonderim_tarihi?: string | null;
  devreden_puan?: number;
  created_at: string;
}

export function baremBul(puan: number, baremler: BaremSatiri[] = VARSAYILAN_BAREM_TABLOSU): BaremSatiri | null {
  const sirali = [...baremler].sort((a, b) => a.min_puan - b.min_puan);
  for (const b of sirali) {
    if (puan >= b.min_puan && puan <= b.max_puan) {
      return b;
    }
  }
  const sonBarem = sirali.at(-1);
  if (sonBarem && puan > sonBarem.max_puan) {
    return sonBarem;
  }
  return null;
}

export function baremTablosuDogrula(baremler: BaremSatiri[]): string | null {
  if (!Array.isArray(baremler) || baremler.length === 0) return "En az bir barem satırı zorunludur.";
  if (baremler.length > 20) return "En fazla 20 barem satırı girilebilir.";

  const sirali = [...baremler].sort((a, b) => a.min_puan - b.min_puan);
  for (let i = 0; i < sirali.length; i += 1) {
    const satir = sirali[i];
    if (![satir.min_puan, satir.max_puan, satir.adet, satir.mal_fazlasi].every(Number.isInteger)) {
      return "Barem değerleri tam sayı olmalıdır.";
    }
    if (satir.min_puan < 0 || satir.max_puan < satir.min_puan || satir.adet < 0 || satir.mal_fazlasi < 0) {
      return "Barem aralıkları ve sipariş değerleri geçersizdir.";
    }
    if (i > 0 && satir.min_puan !== sirali[i - 1].max_puan + 1) {
      return "Barem aralıkları boşluksuz ve çakışmasız ilerlemelidir.";
    }
  }
  return null;
}

export function cekTutariHesapla(params: {
  puan: number;
  satis_sarti_tipi: SatisSartiTipi;
  siparis_verildi: boolean;
  katlama_orani?: number;
  karsilik_puan?: number;
  karsilik_tl?: number;
  baremler?: BaremSatiri[];
}): {
  kullanilan_puan: number;
  devreden_puan: number;
  cek_tutari_tl: number;
  siparis_zorunlu_mu: boolean;
} {
  const {
    puan,
    satis_sarti_tipi,
    siparis_verildi,
    katlama_orani = 20,
    karsilik_puan = 1,
    karsilik_tl = 1,
    baremler = VARSAYILAN_BAREM_TABLOSU,
  } = params;

  const siraliBaremler = [...baremler].sort((a, b) => a.min_puan - b.min_puan);
  const tabanPuan = siraliBaremler[0]?.min_puan ?? 0;
  const tavanPuan = siraliBaremler.at(-1)?.max_puan ?? 0;

  if (puan < tabanPuan || tavanPuan <= 0) {
    return {
      kullanilan_puan: 0,
      devreden_puan: Math.max(0, puan),
      cek_tutari_tl: 0,
      siparis_zorunlu_mu: satis_sarti_tipi === "satis_sartli",
    };
  }

  if (satis_sarti_tipi === "satis_sartli" && !siparis_verildi) {
    return {
      kullanilan_puan: 0,
      devreden_puan: puan,
      cek_tutari_tl: 0,
      siparis_zorunlu_mu: true,
    };
  }

  let donusturulecekPuan = puan;
  let devir = 0;

  if (puan > tavanPuan) {
    donusturulecekPuan = tavanPuan;
    devir = puan - tavanPuan;
  }

  let cekTl = Math.round(((donusturulecekPuan * karsilik_tl) / Math.max(1, karsilik_puan)) * 100) / 100;

  if (satis_sarti_tipi === "serbest_siparis" && siparis_verildi) {
    cekTl = Math.round((cekTl * (1.0 + katlama_orani / 100.0)) * 100) / 100;
  }

  return {
    kullanilan_puan: donusturulecekPuan,
    devreden_puan: devir,
    cek_tutari_tl: cekTl,
    siparis_zorunlu_mu: satis_sarti_tipi === "satis_sartli",
  };
}
