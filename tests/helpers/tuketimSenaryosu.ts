import type { OgrenmeAraciTuru } from "../../lib/ogrenmeAraci/tipler.ts";
import type { HedefRol } from "../../lib/utils/roller.ts";

export const TUKETIM_ARACLARI = ["video", "podcast", "gorsel", "flip_pdf"] as const satisfies readonly OgrenmeAraciTuru[];
export const TUKETIM_HEDEFLERI = ["utt", "bm", "eczaci", "eczane_teknisyeni", "eczanem"] as const satisfies readonly HedefRol[];

export type TuketiciKimlikTuru = "kullanici" | "eclub_kisi" | "eczanem_musteri";

export interface TuketiciFixture {
  anahtar: string;
  kimlikTuru: TuketiciKimlikTuru;
  rol: "utt" | "kd_utt" | "bm" | "eczaci" | "ikinci_eczaci" | "yardimci_eczaci" | "eczane_teknisyeni" | "musteri";
  hedefRol: HedefRol;
  authUserId: string;
  firmaId: string;
  takimId: string | null;
  bolgeId: string | null;
  eczaneId: string | null;
}

export const TUKETICI_FIXTURELARI: readonly TuketiciFixture[] = [
  { anahtar: "utt", kimlikTuru: "kullanici", rol: "utt", hedefRol: "utt", authUserId: "10000000-0000-4000-8000-000000000001", firmaId: "firma-test", takimId: "takim-test", bolgeId: "bolge-test", eczaneId: null },
  { anahtar: "kd_utt", kimlikTuru: "kullanici", rol: "kd_utt", hedefRol: "utt", authUserId: "10000000-0000-4000-8000-000000000002", firmaId: "firma-test", takimId: "takim-test", bolgeId: "bolge-test", eczaneId: null },
  { anahtar: "bm", kimlikTuru: "kullanici", rol: "bm", hedefRol: "bm", authUserId: "10000000-0000-4000-8000-000000000003", firmaId: "firma-test", takimId: "takim-test", bolgeId: "bolge-test", eczaneId: null },
  { anahtar: "eczaci", kimlikTuru: "eclub_kisi", rol: "eczaci", hedefRol: "eczaci", authUserId: "10000000-0000-4000-8000-000000000004", firmaId: "firma-test", takimId: null, bolgeId: null, eczaneId: "eczane-test" },
  { anahtar: "ikinci_eczaci", kimlikTuru: "eclub_kisi", rol: "ikinci_eczaci", hedefRol: "eczaci", authUserId: "10000000-0000-4000-8000-000000000005", firmaId: "firma-test", takimId: null, bolgeId: null, eczaneId: "eczane-test" },
  { anahtar: "yardimci_eczaci", kimlikTuru: "eclub_kisi", rol: "yardimci_eczaci", hedefRol: "eczaci", authUserId: "10000000-0000-4000-8000-000000000006", firmaId: "firma-test", takimId: null, bolgeId: null, eczaneId: "eczane-test" },
  { anahtar: "eczane_teknisyeni", kimlikTuru: "eclub_kisi", rol: "eczane_teknisyeni", hedefRol: "eczane_teknisyeni", authUserId: "10000000-0000-4000-8000-000000000007", firmaId: "firma-test", takimId: null, bolgeId: null, eczaneId: "eczane-test" },
  { anahtar: "musteri", kimlikTuru: "eczanem_musteri", rol: "musteri", hedefRol: "eczanem", authUserId: "10000000-0000-4000-8000-000000000008", firmaId: "firma-test", takimId: null, bolgeId: null, eczaneId: "eczane-test" },
] as const;

export interface YayinFixture {
  yayin_id: string;
  arac_id: string;
  arac_turu: OgrenmeAraciTuru;
  hedef_roller: HedefRol[];
  durum: "yayinda";
  firma_id: string;
  takim_id: string | null;
  urun_adi: string;
  yayin_tarihi: string;
  durdurma_tarihi: null;
  video_url: string | null;
  thumbnail_url: string | null;
  arac_dosya_yolu: string;
  arac_kapak_yolu: string | null;
  arac_metadata: Record<string, unknown>;
}

const ARAC_DOSYASI: Record<OgrenmeAraciTuru, string> = {
  video: "test/video/ana.mp4",
  podcast: "test/podcast/ana.m4a",
  gorsel: "test/gorsel/ana.webp",
  flip_pdf: "test/literatur/ana.pdf",
};

export function yayinFixture(aracTuru: OgrenmeAraciTuru, hedefRol: HedefRol): YayinFixture {
  const ayirtEdici = `${aracTuru}-${hedefRol}`;
  return {
    yayin_id: `yayin-${ayirtEdici}`,
    arac_id: `arac-${ayirtEdici}`,
    arac_turu: aracTuru,
    hedef_roller: [hedefRol],
    durum: "yayinda",
    firma_id: "firma-test",
    takim_id: hedefRol === "utt" ? "takim-test" : null,
    urun_adi: `Test ${ayirtEdici}`,
    yayin_tarihi: "2026-09-17T06:00:00.000Z",
    durdurma_tarihi: null,
    video_url: aracTuru === "video" ? "https://video.test/embed/test-video" : null,
    thumbnail_url: aracTuru === "video" ? "https://cdn.test/video-thumbnail.webp" : null,
    arac_dosya_yolu: ARAC_DOSYASI[aracTuru],
    arac_kapak_yolu: aracTuru === "podcast" || aracTuru === "flip_pdf" ? `test/${aracTuru}/kapak.webp` : null,
    arac_metadata: aracTuru === "podcast" || aracTuru === "flip_pdf"
      ? { kapak_dogrulandi: true }
      : {},
  };
}

export function aracHedefMatrisi(): YayinFixture[] {
  return TUKETIM_ARACLARI.flatMap((arac) => TUKETIM_HEDEFLERI.map((hedef) => yayinFixture(arac, hedef)));
}
