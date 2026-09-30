import type { DepoKonumu } from "./depo";
import type { CekTalepDurumu } from "./store/eclubStoreTipler";

export interface OdulSiparis {
  talep_id: string;
  eczane_id: string;
  eczane_adi: string;
  kisi_adi: string;
  urun_adi: string;
  utt_id: string;
  utt_adi: string;
  siparis_adet: number;
  siparis_mal_fazlasi: number;
  durum: CekTalepDurumu;
  created_at: string;
  depo_sube_id: string | null;
  depo_adi_snapshot: string | null;
  depo_sube_adi_snapshot: string | null;
  depo_il_snapshot: string | null;
  depo_ilce_snapshot: string | null;
  depo_adres_snapshot: string | null;
  siparis_okundu_at: string | null;
  siparis_okuyan_utt_id: string | null;
  okuyan_adi: string | null;
  tercihler: DepoKonumu[];
  eposta_durumu: string | null;
  push_durumu: string | null;
}
