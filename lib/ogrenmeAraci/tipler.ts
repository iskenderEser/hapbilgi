export const OGRENME_ARACI_TURLERI = ["video", "podcast", "gorsel", "flip_pdf"] as const;
export type OgrenmeAraciTuru = (typeof OGRENME_ARACI_TURLERI)[number];

export const YENI_OGRENME_ARACI_TURLERI = ["podcast", "gorsel", "flip_pdf"] as const;
export type YeniOgrenmeAraciTuru = (typeof YENI_OGRENME_ARACI_TURLERI)[number];
export type OgrenmeAraciKaynagi = "iu" | "hazir";

export type OgrenmeAraciDurumu =
  | "yukleme_bekliyor"
  | "dogrulama_bekliyor"
  | "inceleme bekleniyor"
  | "revizyon bekleniyor"
  | "onaylandi"
  | "reddedildi"
  | "iptal";

export interface OgrenmeAraciMetadata {
  mimeType: string | null;
  dosyaBoyutu: number | null;
  checksumSha256: string | null;
  sureSaniye: number | null;
  sayfaSayisi: number | null;
  genislik: number | null;
  yukseklik: number | null;
  ek: Record<string, unknown>;
}

export interface OgrenmeAraciKaydi {
  aracId: string;
  talepId: string;
  aracTuru: OgrenmeAraciTuru;
  kaynak: OgrenmeAraciKaynagi;
  dosyaYolu: string | null;
  kapakYolu: string | null;
  metadataDogrulandi: boolean;
  metadata: OgrenmeAraciMetadata;
}

export interface TamamlamaKaniti {
  aracTuru: OgrenmeAraciTuru;
  surum: 1;
  olusturulmaTarihi: string;
  veri: Record<string, unknown>;
}

export interface OgrenmeBaslangici {
  oturumId: string;
  kaldigiYerden: Record<string, unknown> | null;
  metadata: OgrenmeAraciMetadata;
}

/**
 * T-Club, C-Club, E-Club ve Eczanem rol motorlarının altında kullanılan ortak
 * araç davranışı. Rol, puan ve ödül kararları bu arabirimin içine taşınmaz.
 */
export interface OgrenmeAraciSunucusu<TIlerleme extends Record<string, unknown>> {
  readonly aracTuru: OgrenmeAraciTuru;
  baslat(arac: OgrenmeAraciKaydi, onceki: TIlerleme | null): Promise<OgrenmeBaslangici>;
  ilerlemeKaydet(onceki: TIlerleme | null, yeni: TIlerleme): Promise<TIlerleme>;
  tamamlanabilirMi(arac: OgrenmeAraciKaydi, ilerleme: TIlerleme): Promise<boolean>;
  tamamla(arac: OgrenmeAraciKaydi, ilerleme: TIlerleme): Promise<TamamlamaKaniti>;
  soruHakkiKaniti(kanit: TamamlamaKaniti): Promise<boolean>;
  kaldigiYerdenDevam(ilerleme: TIlerleme | null): Promise<TIlerleme | null>;
  kapakVeMetadata(arac: OgrenmeAraciKaydi): Promise<{
    kapakYolu: string | null;
    metadata: OgrenmeAraciMetadata;
  }>;
}
