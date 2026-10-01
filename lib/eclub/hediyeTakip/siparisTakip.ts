import type { SatisSartiTipi } from "@/lib/eclub/store/eclubStoreTipler";

export const SIPARIS_TAKIP_SAYFA_LIMITI = 30;
export const SIPARIS_TAKIP_DURUMLARI = ["inceleme_bekliyor", "utt_onayladi", "talep_iptal"] as const;
export type SiparisTakipDurumu = (typeof SIPARIS_TAKIP_DURUMLARI)[number];

export interface SiparisTakipFiltreleri {
  eczane_id: string | null;
  urun_id: string | null;
  durum: SiparisTakipDurumu | null;
  baslangic: string | null;
  bitis: string | null;
  offset: number;
  limit: number;
}

export interface SiparisTakipTalebi {
  talep_id: string;
  created_at: string;
  donem_kodu: string;
  eczane: { eczane_id: string; eczane_adi: string; gln: string | null };
  uye: { ad_soyad: string; rol: string };
  urun: { urun_id: string; urun_adi: string; yayin_id: string };
  siparis: {
    tipi: SatisSartiTipi;
    adet: number;
    mal_fazlasi: number;
    kullanilan_puan: number;
    cek_tutari_tl: number;
  };
  depo_tercihleri: string[];
  depo_tercihleri_onay_anlik_mi: boolean;
  durum: SiparisTakipDurumu;
  utt_onay_tarihi: string | null;
  onaylanabilir_mi: boolean;
}

export interface SiparisTakipStatlari {
  toplam: number;
  inceleme_bekliyor: number;
  utt_onayladi: number;
  talep_iptal: number;
}

export interface SiparisTakipApiYaniti {
  statlar: SiparisTakipStatlari;
  filtre_secenekleri: {
    eczaneler: Array<{ id: string; etiket: string }>;
    urunler: Array<{ id: string; etiket: string }>;
  };
  talepler: SiparisTakipTalebi[];
  sayfalama: { toplam: number; offset: number; limit: number; sonraki_kayit_var_mi: boolean };
}

export function siparisTakipDurumu(cekTalepDurumu: string, onayTarihi: string | null): SiparisTakipDurumu {
  if (cekTalepDurumu === "iptal") return "talep_iptal";
  return onayTarihi ? "utt_onayladi" : "inceleme_bekliyor";
}

export function siparisTakipStatlariniHesapla(durumlar: readonly SiparisTakipDurumu[]): SiparisTakipStatlari {
  const sonuc: SiparisTakipStatlari = {
    toplam: durumlar.length,
    inceleme_bekliyor: 0,
    utt_onayladi: 0,
    talep_iptal: 0,
  };
  for (const durum of durumlar) sonuc[durum] += 1;
  return sonuc;
}
