import type {
  IleriSarmaKaybiGirdisi,
  IzlemeKazanimGirdisi,
  SoruHakkiGirdisi,
  SoruHakkiNedeni,
  TamamlamaGirdisi,
} from "./tipler";

export function soruHakkiBelirle(
  girdi: SoruHakkiGirdisi
): { varMi: boolean; neden: SoruHakkiNedeni } {
  if (!girdi.tamamlandi) return { varMi: false, neden: "tamamlanmadi" };
  if (!girdi.puanliZaman) return { varMi: false, neden: "puan_disinda" };
  if (girdi.oncekiGercekDenemeVar) {
    return {
      varMi: false,
      neden: girdi.oncekiTamamlanmisDenemeVar ? "tekrar_izleme" : "yarim_deneme",
    };
  }
  if (girdi.mevcutDenemedeIleriSarmaVar) {
    return { varMi: false, neden: "ileri_sarma" };
  }
  return { varMi: true, neden: "uygun" };
}

export function izlemeKazanimKarariBelirle(
  girdi: IzlemeKazanimGirdisi
): { puanVer: boolean; puan: number } {
  const puan = Math.max(0, Math.round(girdi.videoPuani));
  if (!girdi.tamamlandi || !girdi.puanliZaman || girdi.dahaOnceIzlemePuaniVar || puan === 0) {
    return { puanVer: false, puan: 0 };
  }
  return { puanVer: true, puan };
}

export function ileriSarmaKaybiHesapla(girdi: IleriSarmaKaybiGirdisi): number {
  if (!girdi.puanliZaman) return 0;
  if (![girdi.videoPuani, girdi.videoSuresi, girdi.atlananSure].every(Number.isFinite)) {
    throw new Error("İleri sarma hesabı yalnız sonlu sayılarla yapılabilir.");
  }
  if (girdi.videoPuani <= 0 || girdi.videoSuresi <= 0 || girdi.atlananSure <= 0) return 0;
  return Math.max(1, Math.round((girdi.videoPuani / girdi.videoSuresi) * girdi.atlananSure));
}

export function tamamlamaYeterliMi(girdi: TamamlamaGirdisi): boolean {
  const tolerans = girdi.toleransSaniye ?? 2;
  if (![girdi.videoSuresi, girdi.gecenSure, girdi.onayliAtlananSure, tolerans].every(Number.isFinite)) {
    return false;
  }
  if (girdi.videoSuresi <= 0 || girdi.gecenSure < 0 || girdi.onayliAtlananSure < 0 || tolerans < 0) {
    return false;
  }
  return girdi.gecenSure + girdi.onayliAtlananSure >= Math.max(0, girdi.videoSuresi - tolerans);
}
