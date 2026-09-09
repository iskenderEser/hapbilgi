import type { OgrenmeAraciTuru } from "../ogrenmeAraci/tipler";
import type { HapbiIslemTuru } from "./islemTurleri";
import type { HapbiKirilim } from "./kirilimSozlesmesi";
import type { HapbiOlcut } from "./olcutSozlesmesi";
import type { HapbiKapsamDuzeyi, HapbiRol, HapbiVeriAlani } from "./roller";
import type { HapbiDegerKarsilastirmasi } from "./sozlesme";
import type { HapbiZamanSecimi } from "./zamanSozlesmesi";

export const HAPBI_ANLAMA_SOZLESMESI_SURUMU = "hapbi-anlama-v1" as const;

/** Ölçüt kataloğuyla ortak tür; tek başına çalıştırma izni vermez. */
export type HapbiAnlamaOlcutu = HapbiOlcut;

/** null: henüz anlaşılmadı; zamansiz: atanmış özellik, olay dönemi uygulanmaz. */
export type HapbiAnlamaZamani = HapbiZamanSecimi | "zamansiz" | null;

/** Model ad çıkarır. Gerçek kimliği ve erişim iznini sunucu çözer. */
export type HapbiAnlamaVarligi = Readonly<{
  kirilim: HapbiKirilim;
  ad: string;
}>;

export type HapbiAnlamaDegerFiltresi = Readonly<{
  olcut: HapbiAnlamaOlcutu;
  karsilastirma: HapbiDegerKarsilastirmasi;
  /** Kullanıcının belirttiği eşik; hesaplanmış sonuç değildir. */
  deger: number;
}>;

export type HapbiAnlamaKarsilastirmaTarafi = Readonly<{
  zaman: HapbiAnlamaZamani;
  varliklar: readonly HapbiAnlamaVarligi[];
}>;

/** Güvenilmeyen model taslağıdır; doğrudan HapbiSorgu veya SQL olarak çalıştırılmaz. */
export type HapbiAnlamaTaslagi = Readonly<{
  veriAlani: HapbiVeriAlani | null;
  /** Kullanıcının istediği kapsamdır; oturumdan gelen yetki kapsamı değildir. */
  istenenKapsam: Exclude<HapbiKapsamDuzeyi, "yok"> | null;
  olcut: HapbiAnlamaOlcutu | null;
  sonucOlcutu: HapbiAnlamaOlcutu | null;
  kirilim: HapbiKirilim | null;
  /** Video bir araç türüdür; yayın kimliğinin yerine geçmez. */
  aracTuru: OgrenmeAraciTuru | null;
  zaman: HapbiAnlamaZamani;
  islem: HapbiIslemTuru | null;
  varliklar: readonly HapbiAnlamaVarligi[];
  degerFiltreleri: readonly HapbiAnlamaDegerFiltresi[];
  siralama: Readonly<{
    olcut: HapbiAnlamaOlcutu;
    yon: "artan" | "azalan";
  }> | null;
  sonucSiniri: number | null;
  karsilastirma: Readonly<{
    sol: HapbiAnlamaKarsilastirmaTarafi;
    sag: HapbiAnlamaKarsilastirmaTarafi;
  }> | null;
  yorumIstegi: boolean;
}>;

export type HapbiAnlamaAlani =
  | "veriAlani" | "istenenKapsam" | "olcut" | "sonucOlcutu"
  | "kirilim" | "aracTuru" | "zaman" | "islem" | "varliklar"
  | "degerFiltreleri" | "siralama" | "sonucSiniri" | "karsilastirma";

export type HapbiAnlamaNetlestirmesi = Readonly<{
  alan: HapbiAnlamaAlani;
  soru: string;
}>;

export type HapbiAnlamaCiktisi = Readonly<{
  surum: typeof HAPBI_ANLAMA_SOZLESMESI_SURUMU;
  mesajIliskisi: "yeni_soru" | "tamamlama" | "duzeltme";
  taslak: HapbiAnlamaTaslagi;
}> & (
  | Readonly<{
    /** Yalnız modelin değerlendirmesi; sunucu doğrulamasının yerine geçmez. */
    durum: "hazir";
    netlestirme: null;
    desteklenmemeNedeni: null;
  }>
  | Readonly<{
    durum: "netlestirme";
    netlestirme: HapbiAnlamaNetlestirmesi;
    desteklenmemeNedeni: null;
  }>
  | Readonly<{
    durum: "desteklenmiyor";
    netlestirme: null;
    desteklenmemeNedeni: "istek" | "olcut" | "zaman" | "birlesim";
  }>
);

/** Sunucunun imzasını ve oturum sahibini doğruladığı önceki konuşma bağlamı. */
export type HapbiAnlamaSohbeti = Readonly<{
  ilkSoru: string;
  mesajlar: readonly Readonly<{ rol: "kullanici" | "hapbi"; metin: string }>[];
  sonTaslak: HapbiAnlamaTaslagi;
  bekleyenNetlestirme: HapbiAnlamaNetlestirmesi | null;
}>;

export type HapbiAnlamaGirdisi = Readonly<{
  soru: string;
  oncekiSohbet: HapbiAnlamaSohbeti | null;
  /** Sunucu hazırlar; kişisel veri kayıtları ve yetkili kimlik listeleri taşınmaz. */
  sunucuBaglami: Readonly<{
    rol: HapbiRol;
    veriAlanlari: readonly Readonly<{
      veriAlani: HapbiVeriAlani;
      kapsamDuzeyi: Exclude<HapbiKapsamDuzeyi, "yok">;
    }>[];
    /** Yalnız gerçekten uygulanmış ve bu oturumda kullanılabilir ölçütler. */
    olcutler: readonly Readonly<{
      olcut: HapbiAnlamaOlcutu;
      aciklama: string;
      zamanGereksinimi: "olay_donemi" | "zamansiz";
      veriAlanlari: readonly HapbiVeriAlani[];
      kirilimlar: readonly HapbiKirilim[];
    }>[];
  }>;
}>;
