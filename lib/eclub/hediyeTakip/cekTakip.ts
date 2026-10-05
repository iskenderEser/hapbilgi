import type { EclubKisiRol } from "@/lib/utils/roller";
import type { CekTalepDurumu, SatisSartiTipi } from "@/lib/eclub/store/eclubStoreTipler";
import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";

export const CEK_TAKIP_SAYFA_LIMITI = 30;

export const CEK_TAKIP_ISLEMLERI = [
  "bm_onayina_gonder",
  "bm_onayla",
  "tm_onayla",
] as const;

export type CekTakipIslemi = (typeof CEK_TAKIP_ISLEMLERI)[number];

export const CEK_TAKIP_TESLIMAT_DURUMLARI = [
  "yok",
  "bekliyor",
  "isleniyor",
  "kismen_tamamlandi",
  "tamamlandi",
  "basarisiz",
] as const;

export type CekTakipTeslimatDurumu = (typeof CEK_TAKIP_TESLIMAT_DURUMLARI)[number];

export interface CekTakipStatlari {
  toplam: number;
  onay_surecinde: number;
  teslimat_surecinde: number;
  tamamlanan: number;
}

export interface CekTakipEczaneSecenegi {
  eczane_id: string;
  eczane_adi: string;
  gln: string | null;
}

export interface CekTakipUyeSecenegi {
  kisi_id: string;
  eczane_id: string;
  ad_soyad: string;
  rol: EclubKisiRol;
}

export interface CekTakipUrunSecenegi {
  urun_id: string;
  urun_adi: string;
}

export interface CekTakipFiltreSecenekleri {
  eczaneler: CekTakipEczaneSecenegi[];
  uyeler: CekTakipUyeSecenegi[];
  urunler: CekTakipUrunSecenegi[];
}

export interface CekTakipFiltreleri {
  eczane_id: string | null;
  kisi_id: string | null;
  urun_id: string | null;
  durum: CekTalepDurumu | null;
  baslangic: string | null;
  bitis: string | null;
  offset: number;
  limit: number;
}

export interface CekTakipOnayAdimi {
  kullanici_id: string | null;
  ad_soyad: string | null;
  tarih: string | null;
}

export interface CekTakipTeslimatKanali {
  durum: CekTakipTeslimatDurumu;
  toplam: number;
  bekliyor: number;
  isleniyor: number;
  tamamlanan: number;
  basarisiz: number;
}

export interface CekTakipTalebi {
  utt?: { utt_id: string; utt_adi: string };
  talep_id: string;
  created_at: string;
  guncellenme_at: string;
  durum: CekTalepDurumu;
  eczane: {
    eczane_id: string;
    eczane_adi: string;
    gln: string | null;
  };
  uye: {
    kisi_id: string;
    ad_soyad: string;
    rol: EclubKisiRol;
  };
  urun: {
    yayin_id: string;
    urun_id: string;
    urun_adi: string;
    gorunen_urun_id: string;
  };
  ogrenme_araci: {
    tur: OgrenmeAraciTuru;
    gorunen_talep_id: string | null;
  };
  odul_kosulu: {
    siparis_tipi: SatisSartiTipi;
    siparis_verildi_mi: boolean;
    siparis_adet: number;
    siparis_mal_fazlasi: number;
  };
  puan: {
    kullanilan: number;
    devreden: number;
  };
  cek: {
    tutar_tl: number;
  };
  onay: {
    utt: CekTakipOnayAdimi;
    bm: CekTakipOnayAdimi;
    tm: CekTakipOnayAdimi;
  };
  teslimat: {
    eposta: CekTakipTeslimatKanali;
    push: CekTakipTeslimatKanali;
    basarili_eposta: {
      tamamlanma_tarihi: string;
      alici_ad_soyad: string;
      alici_eposta: string;
    } | null;
  };
  izin_verilen_islemler: CekTakipIslemi[];
}

export function cekTakipTeslimatiTamamlandiMi(
  talep: Pick<CekTakipTalebi, "durum" | "teslimat">,
): boolean {
  return talep.durum === "cek_kodlari_gonderildi"
    && talep.teslimat.eposta.toplam === 1
    && talep.teslimat.eposta.tamamlanan === 1
    && Boolean(talep.teslimat.basarili_eposta?.tamamlanma_tarihi)
    && talep.teslimat.push.toplam > 0
    && talep.teslimat.push.tamamlanan === talep.teslimat.push.toplam;
}

export interface CekTakipSayfalama {
  toplam: number;
  offset: number;
  limit: number;
  sonraki_kayit_var_mi: boolean;
}

export interface CekTakipApiYaniti {
  statlar: CekTakipStatlari;
  filtre_secenekleri: CekTakipFiltreSecenekleri;
  talepler: CekTakipTalebi[];
  sayfalama: CekTakipSayfalama;
}
