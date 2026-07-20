// lib/utils/senaryo/gonderimKarari.ts
//
// Ç-2/Ç-3 (docs/talep_senaryo_is_sureci_gelistirme_is_plani.md): IU "Gönder"e
// bastığında hedef satır kararı. Kalıcı bir istemci işaretçisine güvenilmez —
// sunucudaki gerçeğe bakılır: beklemedeki id ?? kendi durumsuz son satırı
// (reload sonrası öksüz kalan satır otomatik yeniden kullanılır) ?? yeni satır.

export interface SonSatirBilgisi {
  senaryo_id: string;
  iu_id: string;
  son_durum: string | null;
}

export type GonderimKarari =
  | { tur: "olustur" }
  | { tur: "guncelle"; senaryo_id: string };

export function gonderimKarari(
  beklemedekiSenaryoId: string | null,
  sonSatir: SonSatirBilgisi | null,
  kullaniciId: string
): GonderimKarari {
  if (beklemedekiSenaryoId) return { tur: "guncelle", senaryo_id: beklemedekiSenaryoId };
  if (sonSatir && sonSatir.son_durum === null && sonSatir.iu_id === kullaniciId) {
    return { tur: "guncelle", senaryo_id: sonSatir.senaryo_id };
  }
  return { tur: "olustur" };
}
