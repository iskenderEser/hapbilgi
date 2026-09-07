import type { HapbiKapsami } from "../kapsam";
import { HAPBI_KIRILIM_KATALOGU } from "../kirilimlar";
import type { HapbiKirilim } from "../kirilimSozlesmesi";
import { HAPBI_OLCUT_KATALOGU, hapbiOlcutKaynaginiBul } from "../olcutler";
import type {
  HapbiOlcut,
  HapbiOlcutFiltresi,
  HapbiOlcutHesaplamaYontemi,
  HapbiOlcutKaynakRolu,
} from "../olcutSozlesmesi";
import type { HapbiVeriAlani } from "../roller";
import {
  hapbiSorgusunuDogrula,
  type HapbiFiltre,
  type HapbiSorgu,
} from "../sozlesme";
import type { HapbiIslemTuru } from "../islemTurleri";
import type { HapbiZamanAraligi } from "../zamanSozlesmesi";

export type HapbiKaynakKapsamYolu =
  | "dogrudan_kullanici"
  | "dogrudan_bm"
  | "dogrudan_utt"
  | "izleme_uzerinden_kullanici"
  | "izleme_uzerinden_bm"
  | "oneri_uzerinden_utt"
  | "eclub_izleme_uzerinden_utt"
  | "eclub_kisi_uzerinden_utt";

export type HapbiKaynakPlani = Readonly<{
  veriAlani: HapbiVeriAlani;
  tablo: string;
  secilecekAlanlar: readonly string[];
  degerAlani: string;
  zamanAlani: string;
  hesaplama: Exclude<HapbiOlcutHesaplamaYontemi, "kazanim_eksi_kayip">;
  hesaplamadakiRolu: HapbiOlcutKaynakRolu;
  sabitFiltreler: readonly HapbiOlcutFiltresi[];
  kapsamYolu: HapbiKaynakKapsamYolu;
  kapsamKullaniciIdleri: readonly string[];
  kapsamYayinIdleri: readonly string[];
}>;

export type HapbiOlcutPlani = Readonly<{
  olcut: HapbiOlcut;
  hesaplama: HapbiOlcutHesaplamaYontemi;
  kaynaklar: readonly HapbiKaynakPlani[];
}>;

export type HapbiSorguTarafiPlani = Readonly<{
  ad: "ana" | "sol" | "sag";
  kapsam: HapbiKapsami;
  zaman: HapbiZamanAraligi;
  filtreler: readonly HapbiFiltre[];
}>;

export type HapbiSorguPlani = Readonly<{
  veriAlani: HapbiVeriAlani;
  islem: HapbiIslemTuru;
  kirilim: HapbiKirilim;
  kirilimKimlikKaynagi: string;
  kirilimKimlikAlani: string;
  kirilimAdKaynagi: string;
  kirilimAdAlanlari: readonly string[];
  secimOlcutu: HapbiOlcutPlani;
  sonucOlcutu: HapbiOlcutPlani;
  taraflar: readonly HapbiSorguTarafiPlani[];
  siralama: Readonly<{ olcut: HapbiOlcut; yon: "artan" | "azalan" }> | null;
  sonucSiniri: number | null;
}>;

export type HapbiSorguPlaniSonucu =
  | Readonly<{ basarili: true; plan: HapbiSorguPlani }>
  | Readonly<{
    basarili: false;
    neden:
      | "sorgu_gecersiz"
      | "olcut_kaynagi_bulunamadi"
      | "sonuc_olcutu_kaynagi_bulunamadi"
      | "kaynak_kapsam_yolu_bulunamadi";
    ayrinti?: string;
  }>;

const KAYNAK_KAPSAM_YOLLARI: Readonly<Record<string, HapbiKaynakKapsamYolu>> = {
  "tclub:kazanilan_puanlar": "dogrudan_kullanici",
  "tclub:ileri_sarma_kayitlari": "dogrudan_kullanici",
  "tclub:yanlis_cevap_kayitlari": "dogrudan_kullanici",
  "tclub:oneri_kayip_kayitlari": "dogrudan_kullanici",
  "tclub:izleme_kayitlari": "dogrudan_kullanici",
  "tclub:soru_cevaplari": "dogrudan_kullanici",
  "tclub:video_begeniler": "dogrudan_kullanici",
  "tclub:video_favoriler": "dogrudan_kullanici",
  "cclub:cc_kazanilan_puanlar": "dogrudan_bm",
  "cclub:cc_ileri_sarma_kayitlari": "dogrudan_bm",
  "cclub:cc_yanlis_cevap_kayitlari": "dogrudan_bm",
  "cclub:cc_izleme_kayitlari": "dogrudan_bm",
  "eclub:eclub_kazanilan_puanlar": "eclub_izleme_uzerinden_utt",
  "eclub:eclub_ileri_sarma_kayitlari": "eclub_izleme_uzerinden_utt",
  "eclub:eclub_oneri_kayip_kayitlari": "oneri_uzerinden_utt",
  "eclub:eclub_izleme_kayitlari": "oneri_uzerinden_utt",
  "eclub:eclub_dogru_cevap_kayitlari": "eclub_izleme_uzerinden_utt",
  "eclub:eclub_yanlis_cevap_kayitlari": "eclub_izleme_uzerinden_utt",
  "eclub:eclub_utt_puanlari": "dogrudan_utt",
  "eclub:eclub_video_begeniler": "eclub_kisi_uzerinden_utt",
  "eclub:eclub_video_favoriler": "eclub_kisi_uzerinden_utt",
};

const KAPSAM_YOLU_ALANLARI: Readonly<Record<HapbiKaynakKapsamYolu, readonly string[]>> = {
  dogrudan_kullanici: ["kullanici_id"],
  dogrudan_bm: ["bm_id"],
  dogrudan_utt: ["utt_id"],
  izleme_uzerinden_kullanici: ["izleme_id"],
  izleme_uzerinden_bm: ["izleme_id"],
  oneri_uzerinden_utt: ["oneri_id"],
  eclub_izleme_uzerinden_utt: ["izleme_id"],
  eclub_kisi_uzerinden_utt: ["kisi_id"],
};

function benzersizAlanlar(alanlar: readonly string[]): string[] {
  return [...new Set(alanlar.filter(Boolean))];
}

function olcutPlaniOlustur(
  olcut: HapbiOlcut,
  veriAlani: HapbiVeriAlani,
  kapsam: HapbiKapsami,
): HapbiOlcutPlani | null {
  const kaynaklar = hapbiOlcutKaynaginiBul(olcut, veriAlani);
  if (kaynaklar.length === 0) return null;

  const alanKapsami = kapsam.veriAlanlari[veriAlani];
  const planKaynaklari: HapbiKaynakPlani[] = [];

  for (const kaynak of kaynaklar) {
    const kapsamYolu = KAYNAK_KAPSAM_YOLLARI[`${veriAlani}:${kaynak.tablo}`];
    if (!kapsamYolu) return null;

    planKaynaklari.push({
      veriAlani,
      tablo: kaynak.tablo,
      secilecekAlanlar: benzersizAlanlar([
        kaynak.degerAlani,
        kaynak.zamanAlani,
        ...kaynak.iliskiAlanlari,
        ...KAPSAM_YOLU_ALANLARI[kapsamYolu],
      ]),
      degerAlani: kaynak.degerAlani,
      zamanAlani: kaynak.zamanAlani,
      hesaplama: kaynak.hesaplama,
      hesaplamadakiRolu: kaynak.hesaplamadakiRolu,
      sabitFiltreler: kaynak.filtreler,
      kapsamYolu,
      kapsamKullaniciIdleri: alanKapsami.kullaniciIdleri,
      kapsamYayinIdleri: alanKapsami.yayinIdleri,
    });
  }

  return {
    olcut,
    hesaplama: HAPBI_OLCUT_KATALOGU[olcut].hesaplama,
    kaynaklar: planKaynaklari,
  };
}

function sorguTaraflariniOlustur(sorgu: HapbiSorgu): HapbiSorguTarafiPlani[] {
  if (!sorgu.karsilastirma) {
    return [{
      ad: "ana",
      kapsam: sorgu.kapsam,
      zaman: sorgu.zaman,
      filtreler: sorgu.filtreler,
    }];
  }

  return [
    {
      ad: "sol",
      kapsam: sorgu.karsilastirma.sol.kapsam,
      zaman: sorgu.karsilastirma.sol.zaman,
      filtreler: sorgu.karsilastirma.sol.filtreler,
    },
    {
      ad: "sag",
      kapsam: sorgu.karsilastirma.sag.kapsam,
      zaman: sorgu.karsilastirma.sag.zaman,
      filtreler: sorgu.karsilastirma.sag.filtreler,
    },
  ];
}

export function hapbiSorguPlaniOlustur(sorgu: HapbiSorgu): HapbiSorguPlaniSonucu {
  const dogrulama = hapbiSorgusunuDogrula(sorgu);
  if (!dogrulama.gecerli) {
    return {
      basarili: false,
      neden: "sorgu_gecersiz",
      ayrinti: dogrulama.hata,
    };
  }

  const secimOlcutu = olcutPlaniOlustur(sorgu.olcut, sorgu.veriAlani, sorgu.kapsam);
  if (!secimOlcutu) {
    return { basarili: false, neden: "olcut_kaynagi_bulunamadi" };
  }

  const sonucOlcutuAdi = sorgu.sonucOlcutu ?? sorgu.olcut;
  const sonucOlcutu = sonucOlcutuAdi === sorgu.olcut
    ? secimOlcutu
    : olcutPlaniOlustur(sonucOlcutuAdi, sorgu.veriAlani, sorgu.kapsam);
  if (!sonucOlcutu) {
    return { basarili: false, neden: "sonuc_olcutu_kaynagi_bulunamadi" };
  }

  const kirilimTanimi = HAPBI_KIRILIM_KATALOGU[sorgu.kirilim];

  return {
    basarili: true,
    plan: {
      veriAlani: sorgu.veriAlani,
      islem: sorgu.islem,
      kirilim: sorgu.kirilim,
      kirilimKimlikKaynagi: kirilimTanimi.kimlikKaynagi,
      kirilimKimlikAlani: kirilimTanimi.kimlikAlani,
      kirilimAdKaynagi: kirilimTanimi.adKaynagi,
      kirilimAdAlanlari: kirilimTanimi.adAlanlari,
      secimOlcutu,
      sonucOlcutu,
      taraflar: sorguTaraflariniOlustur(sorgu),
      siralama: sorgu.siralama ?? null,
      sonucSiniri: sorgu.sonucSiniri ?? null,
    },
  };
}
