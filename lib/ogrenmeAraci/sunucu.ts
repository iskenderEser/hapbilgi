import { randomUUID } from "node:crypto";
import { tamamlamaYeterliMi } from "@/lib/izleme/karar";
import { tamamlamaKanitiDogrula } from "@/lib/ogrenmeAraci/sozlesme";
import type {
  OgrenmeAraciKaydi,
  OgrenmeAraciSunucusu,
  OgrenmeAraciTuru,
  TamamlamaKaniti,
} from "@/lib/ogrenmeAraci/tipler";

export interface SureliAracIlerlemesi extends Record<string, unknown> {
  dogrulanmisSaniye: number;
  onayliAtlananSaniye: number;
  sonKonumSaniye: number;
  sonaUlasti: boolean;
}

export interface GorselIlerlemesi extends Record<string, unknown> {
  aktifIncelemeSaniye: number;
  kullaniciOnayi: boolean;
}

export interface FlipPdfIlerlemesi extends Record<string, unknown> {
  toplamSayfa: number;
  okunanSayfalar: number[];
  aktifSayfaSaniyeleri: Record<string, number>;
  sonSayfa: number;
  kuralSnapshot: { sayfaBasiSaniye: number; toplamSayfa: number };
}

abstract class TemelArac<TIlerleme extends Record<string, unknown>> implements OgrenmeAraciSunucusu<TIlerleme> {
  abstract readonly aracTuru: OgrenmeAraciTuru;
  abstract ilerlemeKaydet(onceki: TIlerleme | null, yeni: TIlerleme): Promise<TIlerleme>;
  abstract tamamlanabilirMi(arac: OgrenmeAraciKaydi, ilerleme: TIlerleme): Promise<boolean>;
  abstract tamamla(arac: OgrenmeAraciKaydi, ilerleme: TIlerleme): Promise<TamamlamaKaniti>;

  async baslat(arac: OgrenmeAraciKaydi, onceki: TIlerleme | null) {
    return { oturumId: randomUUID(), kaldigiYerden: onceki, metadata: arac.metadata };
  }

  async soruHakkiKaniti(kanit: TamamlamaKaniti): Promise<boolean> {
    return tamamlamaKanitiDogrula(this.aracTuru, kanit);
  }

  async kaldigiYerdenDevam(ilerleme: TIlerleme | null): Promise<TIlerleme | null> {
    return ilerleme;
  }

  async kapakVeMetadata(arac: OgrenmeAraciKaydi) {
    return { kapakYolu: arac.kapakYolu, metadata: arac.metadata };
  }

  protected kanit(veri: Record<string, unknown>): TamamlamaKaniti {
    return { aracTuru: this.aracTuru, surum: 1, olusturulmaTarihi: new Date().toISOString(), veri };
  }
}

class SureliArac extends TemelArac<SureliAracIlerlemesi> {
  readonly aracTuru: "video" | "podcast";

  constructor(aracTuru: "video" | "podcast") {
    super();
    this.aracTuru = aracTuru;
  }

  async ilerlemeKaydet(onceki: SureliAracIlerlemesi | null, yeni: SureliAracIlerlemesi) {
    return {
      dogrulanmisSaniye: Math.max(onceki?.dogrulanmisSaniye ?? 0, yeni.dogrulanmisSaniye),
      onayliAtlananSaniye: Math.max(onceki?.onayliAtlananSaniye ?? 0, yeni.onayliAtlananSaniye),
      sonKonumSaniye: Math.max(0, yeni.sonKonumSaniye),
      sonaUlasti: Boolean(onceki?.sonaUlasti || yeni.sonaUlasti),
    };
  }

  async tamamlanabilirMi(arac: OgrenmeAraciKaydi, ilerleme: SureliAracIlerlemesi) {
    return Boolean(ilerleme.sonaUlasti && arac.metadata.sureSaniye && tamamlamaYeterliMi({
      videoSuresi: arac.metadata.sureSaniye,
      gecenSure: ilerleme.dogrulanmisSaniye,
      onayliAtlananSure: ilerleme.onayliAtlananSaniye,
    }));
  }

  async tamamla(arac: OgrenmeAraciKaydi, ilerleme: SureliAracIlerlemesi) {
    if (!(await this.tamamlanabilirMi(arac, ilerleme))) throw new Error("Süreli öğrenme aracı henüz tamamlanamaz.");
    return this.kanit({ dogrulanmisSaniye: ilerleme.dogrulanmisSaniye, sonaUlasti: true });
  }
}

class GorselAraci extends TemelArac<GorselIlerlemesi> {
  readonly aracTuru = "gorsel" as const;
  async ilerlemeKaydet(onceki: GorselIlerlemesi | null, yeni: GorselIlerlemesi) {
    return {
      aktifIncelemeSaniye: Math.max(onceki?.aktifIncelemeSaniye ?? 0, yeni.aktifIncelemeSaniye),
      kullaniciOnayi: Boolean(onceki?.kullaniciOnayi || yeni.kullaniciOnayi),
    };
  }
  async tamamlanabilirMi(_arac: OgrenmeAraciKaydi, ilerleme: GorselIlerlemesi) {
    return ilerleme.aktifIncelemeSaniye > 0 && ilerleme.kullaniciOnayi;
  }
  async tamamla(arac: OgrenmeAraciKaydi, ilerleme: GorselIlerlemesi) {
    if (!(await this.tamamlanabilirMi(arac, ilerleme))) throw new Error("Görsel incelemesi henüz tamamlanamaz.");
    return this.kanit(ilerleme);
  }
}

class FlipPdfAraci extends TemelArac<FlipPdfIlerlemesi> {
  readonly aracTuru = "flip_pdf" as const;
  async ilerlemeKaydet(onceki: FlipPdfIlerlemesi | null, yeni: FlipPdfIlerlemesi) {
    return {
      toplamSayfa: yeni.toplamSayfa,
      okunanSayfalar: [...new Set([...(onceki?.okunanSayfalar ?? []), ...yeni.okunanSayfalar])].sort((a, b) => a - b),
      aktifSayfaSaniyeleri: Object.fromEntries(Object.entries({ ...(onceki?.aktifSayfaSaniyeleri ?? {}), ...yeni.aktifSayfaSaniyeleri }).map(([sayfa, sure]) => [sayfa, Math.max(Number(onceki?.aktifSayfaSaniyeleri?.[sayfa] ?? 0), Number(sure))])),
      sonSayfa: yeni.sonSayfa,
      kuralSnapshot: onceki?.kuralSnapshot ?? yeni.kuralSnapshot,
    };
  }
  async tamamlanabilirMi(arac: OgrenmeAraciKaydi, ilerleme: FlipPdfIlerlemesi) {
    const toplam = arac.metadata.sayfaSayisi ?? ilerleme.toplamSayfa;
    return toplam > 0 && new Set(ilerleme.okunanSayfalar).size >= toplam;
  }
  async tamamla(arac: OgrenmeAraciKaydi, ilerleme: FlipPdfIlerlemesi) {
    if (!(await this.tamamlanabilirMi(arac, ilerleme))) throw new Error("Flip PDF henüz tamamlanamaz.");
    return this.kanit({ toplamSayfa: arac.metadata.sayfaSayisi ?? ilerleme.toplamSayfa, okunanSayfalar: ilerleme.okunanSayfalar });
  }
}

export const VIDEO_ARACI = new SureliArac("video");
export const PODCAST_ARACI = new SureliArac("podcast");
export const GORSEL_ARACI = new GorselAraci();
export const FLIP_PDF_ARACI = new FlipPdfAraci();

export function ogrenmeAraciSunucusu(aracTuru: OgrenmeAraciTuru): OgrenmeAraciSunucusu<Record<string, unknown>> {
  if (aracTuru === "video") return VIDEO_ARACI;
  if (aracTuru === "podcast") return PODCAST_ARACI;
  if (aracTuru === "gorsel") return GORSEL_ARACI;
  return FLIP_PDF_ARACI;
}
