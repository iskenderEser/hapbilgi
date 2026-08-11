import type { AnalizFiltreleri, AnalizRolKolu } from "@/lib/analiz/paylasilan/sorguYanit";

export type PuanDetayKarti = "kazanim" | "kayip";
export type HiyerarsiSeviyesi = "takim" | "bolge" | "utt";

export type PuanDagilimIstegi = {
  kart: PuanDetayKarti;
  seviye: HiyerarsiSeviyesi;
  filtreler?: AnalizFiltreleri;
};

export type PuanKaynakKalemi = {
  id: string;
  ad: string;
  deger: number;
  yuzde: number;
};

export type PuanHiyerarsiSatiri = {
  birim_id: string | null;
  birim_adi: string;
  seviye: HiyerarsiSeviyesi;
  takim_id: string | null;
  takim_adi: string | null;
  bolge_id: string | null;
  bolge_adi: string | null;
  toplam_utt: number;
  aktif_utt: number;
  izleme_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  extra_puani: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  challenge_kaybi: number;
  kazanilan_toplam: number;
  kaybedilen_toplam: number;
  kart_toplami: number;
  kapsam_payi: number;
};

export type PuanDagilimYaniti = {
  kart: PuanDetayKarti;
  seviye: HiyerarsiSeviyesi;
  baslangic_seviyesi: HiyerarsiSeviyesi;
  sonraki_seviye: HiyerarsiSeviyesi | null;
  rol_kolu: AnalizRolKolu;
  kart_toplami: number;
  kaynak_dagilimi: PuanKaynakKalemi[];
  hiyerarsi: PuanHiyerarsiSatiri[];
  mutabakat: {
    kart: number;
    satirlar: number;
    uyumlu: boolean;
  };
};

export const KAZANIM_KAYNAKLARI = [
  { id: "izleme_puani", ad: "İzleme" },
  { id: "cevaplama_puani", ad: "Cevaplama" },
  { id: "oneri_puani", ad: "Öneri" },
  { id: "extra_puani", ad: "Ekstra" },
] as const;

export const KAYIP_KAYNAKLARI = [
  { id: "ileri_sarma_kaybi", ad: "İleri Sarma" },
  { id: "yanlis_cevap_kaybi", ad: "Yanlış Cevap" },
  { id: "oneri_kaybi", ad: "Öneri Kaybı" },
  { id: "challenge_kaybi", ad: "Challenge" },
] as const;

export function sonrakiHiyerarsiSeviyesi(seviye: HiyerarsiSeviyesi): HiyerarsiSeviyesi | null {
  if (seviye === "takim") return "bolge";
  if (seviye === "bolge") return "utt";
  return null;
}
