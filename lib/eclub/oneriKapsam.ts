// E-Club önerisinde UTT'nin görebileceği yayın kapsamı.
// Dar saha rolü yalnız kendi firmasındaki takım içeriğini ve firma-geneli
// (takim_id = null) içeriği kullanabilir.

export interface EclubUttYayinKapsami {
  firma_id: string;
  takim_id: string | null;
}

export interface EclubYayinKapsami {
  firma_id: string | null;
  takim_id: string | null;
}

export function eclubYayinKapsamindaMi(
  utt: EclubUttYayinKapsami,
  yayin: EclubYayinKapsami,
): boolean {
  if (!yayin.firma_id || yayin.firma_id !== utt.firma_id) return false;
  return yayin.takim_id === null || yayin.takim_id === utt.takim_id;
}
