// Satış şartlı / serbest siparişli puan ve hediye çeki tipleri.

export type SatisSartiTipi = "satis_sartli" | "serbest_siparis" | "siparissiz_cek";

export type EclubKazanimModeli = "yalniz_puan" | "siparissiz_cek" | "siparisle_artan_cek" | "siparis_zorunlu_cek";

export const ECLUB_KAZANIM_SECENEKLERI: ReadonlyArray<{ model: EclubKazanimModeli; baslik: string; aciklama: string }> = [
  { model: "yalniz_puan", baslik: "Yalnız puan", aciklama: "Puan E-Club Ligi'ne eklenir; hediye çeki yoktur." },
  { model: "siparissiz_cek", baslik: "Siparişsiz çek", aciklama: "Puan, belirlenen karşılıkla çeke dönüşür; sipariş istenmez." },
  { model: "siparisle_artan_cek", baslik: "Siparişle artan çek", aciklama: "Sipariş verilmezse normal çek, verilirse artırılmış çek alınır." },
  { model: "siparis_zorunlu_cek", baslik: "Sipariş zorunlu çek", aciklama: "Çek alınabilmesi için ürün siparişi gerekir." },
];

export function eclubKazanimKosullari(model: EclubKazanimModeli) {
  const satis_sarti_tipi: SatisSartiTipi | null =
    model === "siparissiz_cek" ? "siparissiz_cek"
      : model === "siparisle_artan_cek" ? "serbest_siparis"
        : model === "siparis_zorunlu_cek" ? "satis_sartli" : null;
  return {
    cek_karsiligi_var_mi: model !== "yalniz_puan",
    satis_sarti_tipi,
    siparis_secimi_var_mi: model === "siparisle_artan_cek" || model === "siparis_zorunlu_cek",
  };
}

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

export const CEK_TALEP_DURUMLARI = [
  "beklemede",
  "bm_onayinda",
  "tm_onayinda",
  "onaylandi",
  "teslimat_bekliyor",
  "cek_kodlari_gonderildi",
  "iptal",
] as const;

export type CekTalepDurumu = (typeof CEK_TALEP_DURUMLARI)[number];

export const CEK_TALEP_DURUM_META: Record<
  CekTalepDurumu,
  { etiket: string; metin: string; arka: string; kenar: string }
> = {
  beklemede: { etiket: "Beklemede (UTT)", metin: "#854d0e", arka: "#fefce8", kenar: "#fde68a" },
  bm_onayinda: { etiket: "BM Onayında", metin: "#1e40af", arka: "#eff6ff", kenar: "#bfdbfe" },
  tm_onayinda: { etiket: "TM Onayında", metin: "#6d28d9", arka: "#f5f3ff", kenar: "#ddd6fe" },
  onaylandi: { etiket: "TM Onayladı / Kod Bekliyor", metin: "#065f46", arka: "#ecfdf5", kenar: "#a7f3d0" },
  teslimat_bekliyor: { etiket: "Teslimat Kuyruğunda", metin: "#0f766e", arka: "#f0fdfa", kenar: "#99f6e4" },
  cek_kodlari_gonderildi: { etiket: "Çek Kodu Gönderildi", metin: "#15803d", arka: "#f0fdf4", kenar: "#86efac" },
  iptal: { etiket: "İptal Edildi", metin: "#bc2d0d", arka: "#fef2f2", kenar: "#fecaca" },
};

export const CEK_TALEP_ISLEMDE_DURUMLARI: readonly CekTalepDurumu[] = [
  "beklemede",
  "bm_onayinda",
  "tm_onayinda",
  "onaylandi",
  "teslimat_bekliyor",
];

export const CEK_TALEP_ADMIN_DURUMLARI: readonly CekTalepDurumu[] = [
  "onaylandi",
  "teslimat_bekliyor",
  "cek_kodlari_gonderildi",
];

export const CEK_KODU_GORUNUR_DURUMLARI: readonly CekTalepDurumu[] = [
  "teslimat_bekliyor",
  "cek_kodlari_gonderildi",
];

export function cekTalepDurumuMu(deger: unknown): deger is CekTalepDurumu {
  return typeof deger === "string" && CEK_TALEP_DURUMLARI.includes(deger as CekTalepDurumu);
}

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
  talep_durumu?: CekTalepDurumu | null;
  cek_tutari_tl?: number | null;
  cek_kodu?: string | null;
  donem_kodu?: string;
  donem_baslangic?: string;
  donem_bitis?: string;
  talep_penceresi_acik_mi?: boolean;
}

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
  siparis_okundu_at?: string | null;
  depo_sube_id?: string | null;
  depo_adi_snapshot?: string | null;
  depo_sube_adi_snapshot?: string | null;
  siparis_adet: number;
  siparis_mal_fazlasi: number;
  durum: CekTalepDurumu;
  utt_id?: string | null;
  utt_adi?: string | null;
  bm_id?: string | null;
  bm_adi?: string | null;
  bm_onay_tarihi?: string | null;
  tm_id?: string | null;
  tm_adi?: string | null;
  tm_onay_tarihi?: string | null;
  eposta_teslimat_durumu?: string | null;
  push_teslimat_durumu?: string | null;
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

  if ((satis_sarti_tipi === "satis_sartli" && !siparis_verildi) || (satis_sarti_tipi === "siparissiz_cek" && siparis_verildi)) {
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
