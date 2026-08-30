import { ureticiYetenegi } from "@/lib/uretici/yetenekler";

export interface UreticiUrunProfili {
  rol: string;
  firma_id: string | null;
  takim_id: string | null;
  aktif_mi: boolean | null;
}

export interface UreticiUrunKapsami {
  firma_id: string;
  takim_id: string | null;
}

/**
 * Ürün sözlüğünün firma/takım kapsamını istemci parametresinden değil,
 * doğrulanmış üretici profilinden türetir.
 */
export function ureticiUrunListeKapsami(
  profil: UreticiUrunProfili,
  istenenFirmaId: string,
  istenenTakimId: string | null,
): UreticiUrunKapsami | null {
  const yetenek = ureticiYetenegi(profil.rol);
  if (!yetenek || profil.aktif_mi !== true || !profil.firma_id || profil.firma_id !== istenenFirmaId) {
    return null;
  }

  if (yetenek.takimZorunlu) {
    if (!profil.takim_id || (istenenTakimId && istenenTakimId !== profil.takim_id)) return null;
    return { firma_id: profil.firma_id, takim_id: profil.takim_id };
  }

  return { firma_id: profil.firma_id, takim_id: istenenTakimId };
}

/** Yeni ürün her zaman doğrulanmış firma içindeki somut bir takıma bağlanır. */
export function ureticiUrunYazmaKapsami(
  profil: UreticiUrunProfili,
  istenenFirmaId: string,
  istenenTakimId: string | null,
): UreticiUrunKapsami | null {
  const kapsam = ureticiUrunListeKapsami(profil, istenenFirmaId, istenenTakimId);
  return kapsam?.takim_id ? kapsam : null;
}
