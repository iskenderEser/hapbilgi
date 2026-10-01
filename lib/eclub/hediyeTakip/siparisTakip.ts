import type { EclubKisiRol } from "@/lib/utils/roller";

export const SIPARIS_TAKIP_SAYFA_LIMITI = 30;
export const SIPARIS_TAKIP_DURUMLARI = ["onay_bekliyor", "depo_surecinde", "teslimat_bekliyor", "tamamlandi", "iptal"] as const;
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

export interface SiparisTakipSecenegi { id: string; etiket: string; }
export interface SiparisTakipStatlari {
  toplam: number;
  onay_bekliyor: number;
  depo_surecinde: number;
  teslimat_bekliyor: number;
  tamamlandi: number;
}

export interface SiparisTakipTalebi {
  talep_id: string;
  created_at: string;
  eczane: { eczane_id: string; eczane_adi: string };
  uye: { ad_soyad: string; rol: EclubKisiRol };
  urun: { urun_id: string; urun_adi: string };
  utt_adi: string;
  siparis: { adet: number; mal_fazlasi: number };
  durum: SiparisTakipDurumu;
  depo_tercihleri: Array<{ depo_sube_id: string; etiket: string }>;
  izin_verilen_islemler: string[];
}

export interface SiparisTakipApiYaniti {
  statlar: SiparisTakipStatlari;
  filtre_secenekleri: { eczaneler: SiparisTakipSecenegi[]; urunler: SiparisTakipSecenegi[] };
  talepler: SiparisTakipTalebi[];
  sayfalama: { toplam: number; offset: number; limit: number; sonraki_kayit_var_mi: boolean };
}

export function siparisTakipDurumunuCoz(durum: string): SiparisTakipDurumu {
  if (durum === "iptal") return "iptal";
  if (durum === "cek_kodlari_gonderildi") return "tamamlandi";
  if (durum === "onaylandi" || durum === "teslimat_bekliyor") return "teslimat_bekliyor";
  if (durum === "bm_onayinda" || durum === "tm_onayinda") return "depo_surecinde";
  return "onay_bekliyor";
}

export function siparisTakipStatlariniHesapla(durumlar: readonly SiparisTakipDurumu[]): SiparisTakipStatlari {
  const statlar: SiparisTakipStatlari = { toplam: durumlar.length, onay_bekliyor: 0, depo_surecinde: 0, teslimat_bekliyor: 0, tamamlandi: 0 };
  for (const durum of durumlar) if (durum !== "iptal") statlar[durum] += 1;
  return statlar;
}
