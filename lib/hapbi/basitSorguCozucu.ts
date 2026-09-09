// lib/hapbi/basitSorguCozucu.ts
//
// LLM/Gemini olmadan doğrudan kural ve anahtar kelimelerle güvenli HapbiSorgu üreten deterministik çözücü.

import type { HapbiKapsami } from "./kapsam";
import type { HapbiKirilim } from "./kirilimSozlesmesi";
import type { HapbiOlcut } from "./olcutSozlesmesi";
import type { HapbiVeriAlani } from "./roller";
import {
  HAPBI_SORGU_SOZLESMESI_SURUMU,
  hapbiSorgusunuDogrula,
  type HapbiFiltre,
  type HapbiSorgu,
  type HapbiVarlikFiltresi,
} from "./sozlesme";
import { hapbiZamanAraligiOlustur } from "./zaman";
import type { HapbiZamanAraligi, HapbiZamanSecimi } from "./zamanSozlesmesi";

export type BasitIzinliVarlik = Readonly<{
  kirilim: HapbiKirilim;
  id: string;
  ad: string;
}>;

export type BasitSorguSonucu =
  | Readonly<{ basarili: true; sorgu: HapbiSorgu }>
  | Readonly<{ basarili: false; neden: string }>;

function normalizeEt(metin: string): string {
  return metin
    .normalize("NFKC")
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ç", "c")
    .replaceAll("ğ", "g")
    .replaceAll("ı", "i")
    .replaceAll("ö", "o")
    .replaceAll("ş", "s")
    .replaceAll("ü", "u")
    .replace(/[^a-z0-9\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function zamanBelirle(normSoru: string, varsayilanDonemMi = false): HapbiZamanSecimi {
  // 1. Yıl kontrolleri
  if (
    normSoru.includes("yil basindan") ||
    normSoru.includes("sene basindan") ||
    normSoru.includes("yilbasi") ||
    normSoru.includes("senebasi") ||
    normSoru.includes("bu yil") ||
    normSoru.includes("bu sene") ||
    normSoru.includes("tum yil") ||
    normSoru.includes("yillik")
  ) {
    return { tur: "yil", yonelim: "bu" };
  }
  if (
    normSoru.includes("son yil") ||
    normSoru.includes("gecen yil") ||
    normSoru.includes("gecen sene") ||
    normSoru.includes("onceki yil")
  ) {
    return { tur: "yil", yonelim: "son" };
  }

  // 2. Dönem (Çeyrek) kontrolleri
  if (
    normSoru.includes("bu donem") ||
    normSoru.includes("bu ceyrek") ||
    normSoru.includes("donemlik")
  ) {
    return { tur: "donem", yonelim: "bu" };
  }
  if (
    normSoru.includes("son donem") ||
    normSoru.includes("gecen donem") ||
    normSoru.includes("son ceyrek") ||
    normSoru.includes("gecen ceyrek") ||
    normSoru.includes("onceki donem")
  ) {
    return { tur: "donem", yonelim: "son" };
  }

  // 3. Hafta kontrolleri
  if (
    normSoru.includes("bu hafta") ||
    normSoru.includes("haftalik") ||
    normSoru.includes("bu haftaki")
  ) {
    return { tur: "hafta", yonelim: "bu" };
  }
  if (
    normSoru.includes("son hafta") ||
    normSoru.includes("gecen hafta") ||
    normSoru.includes("onceki hafta")
  ) {
    return { tur: "hafta", yonelim: "son" };
  }

  // 4. Ay kontrolleri
  if (
    normSoru.includes("bu ay") ||
    normSoru.includes("aylik") ||
    normSoru.includes("bu ayki")
  ) {
    return { tur: "ay", yonelim: "bu" };
  }
  if (
    normSoru.includes("son ay") ||
    normSoru.includes("gecen ay") ||
    normSoru.includes("onceki ay")
  ) {
    return { tur: "ay", yonelim: "son" };
  }

  // Sıralama veya genel hata analizi sorularında dönemsel (çeyrek) veri daha anlamlıdır
  if (varsayilanDonemMi) {
    return { tur: "donem", yonelim: "bu" };
  }

  // Varsayılan: Bu ay
  return { tur: "ay", yonelim: "bu" };
}

function olcutBelirle(normSoru: string): HapbiOlcut {
  if (normSoru.includes("yanlis") || normSoru.includes("hata")) return "yanlis_cevap_sayisi";
  if (normSoru.includes("dogru")) return "dogru_cevap_sayisi";
  if (normSoru.includes("tamamlanan")) return "tamamlanan_izleme_sayisi";
  if (normSoru.includes("izleme") || normSoru.includes("oynatma")) return "izleme_sayisi";
  if (normSoru.includes("begeni")) return "begeni_sayisi";
  if (normSoru.includes("favori")) return "favori_sayisi";
  if (normSoru.includes("ileri sarma") || normSoru.includes("atlanan")) return "ileri_sarilan_sure";
  if (normSoru.includes("kayip") || normSoru.includes("kaybedilen")) return "kaybedilen_puan";
  if (normSoru.includes("kazanc") || normSoru.includes("kazanilan")) return "kazanilan_puan";
  if (normSoru.includes("atanan") || normSoru.includes("atanmis")) return "atanmis_izleme_puani";
  return "net_puan";
}

export function hapbiBasitSorguyuCoz(
  soru: string,
  kapsam: HapbiKapsami,
  izinliVarliklar: readonly BasitIzinliVarlik[],
): BasitSorguSonucu {
  const normSoru = normalizeEt(soru);
  if (!normSoru) return { basarili: false, neden: "soru_bos" };

  // 1. Veri alanı seçimi
  const veriAlani: HapbiVeriAlani =
    (normSoru.includes("cclub") || normSoru.includes("c club") || normSoru.includes("challenge")) &&
    kapsam.veriAlanlari.cclub.duzey !== "yok"
      ? "cclub"
      : "tclub";

  if (kapsam.veriAlanlari[veriAlani].duzey === "yok") {
    return { basarili: false, neden: "veri_alani_kapsam_disinda" };
  }

  // 2. Ölçüt seçimi
  const olcut = olcutBelirle(normSoru);

  // 3. Zaman seçimi (Sıralama veya hata sorgularında varsayılan dönemdir)
  const urunVeyaHataSorusuMu =
    normSoru.includes("urun") ||
    normSoru.includes("en cok") ||
    normSoru.includes("en az") ||
    normSoru.includes("hata") ||
    normSoru.includes("yanlis");

  let zaman: HapbiZamanAraligi | null = null;
  if (olcut !== "atanmis_izleme_puani") {
    const secim = zamanBelirle(normSoru, urunVeyaHataSorusuMu);
    zaman = hapbiZamanAraligiOlustur(secim);
  }

  // 4. Soru içinde geçen izinli varlıkları tara
  const eslesenVarliklar: BasitIzinliVarlik[] = [];
  for (const varlik of izinliVarliklar) {
    const normVarlikAdi = normalizeEt(varlik.ad);
    if (normVarlikAdi.length >= 3 && normSoru.includes(normVarlikAdi)) {
      eslesenVarliklar.push(varlik);
    }
  }

  // 5. Kırılım, İşlem ve Filtreleri Rol ve Soru Tipine Göre Kur
  const filtreler: HapbiFiltre[] = [];

  // Senaryo A: Ürün Sıralaması ("en çok hata yapılan ürün", "en çok izlenen ürün", "ürün sıralaması")
  const urunSorusuMu =
    normSoru.includes("urun") ||
    normSoru.includes("en cok") ||
    normSoru.includes("en az") ||
    normSoru.includes("hangisi") ||
    normSoru.includes("sirala");

  if (urunSorusuMu) {
    const azalanMi = !normSoru.includes("en az") && !normSoru.includes("en dusuk");
    const sorgu: HapbiSorgu = {
      surum: HAPBI_SORGU_SOZLESMESI_SURUMU,
      kapsam,
      veriAlani,
      zaman,
      olcut,
      kirilim: "urun",
      islem: "siralama",
      filtreler: [],
      siralama: {
        olcut,
        yon: azalanMi ? "azalan" : "artan",
      },
      sonucSiniri: 5,
    };

    const dogrulama = hapbiSorgusunuDogrula(sorgu);
    return dogrulama.gecerli
      ? { basarili: true, sorgu: dogrulama.sorgu }
      : { basarili: false, neden: dogrulama.hata };
  }

  // Senaryo B: Belirli bir bölge veya ürün belirtilmişse (örn: "İzmir bölge toplam puanı")
  const bolgeVarligi = eslesenVarliklar.find((v) => v.kirilim === "bolge");
  const urunVarligi = eslesenVarliklar.find((v) => v.kirilim === "urun");

  if (bolgeVarligi) {
    const filtre: HapbiVarlikFiltresi = {
      tur: "varlik",
      kirilim: "bolge",
      kimlikler: [bolgeVarligi.id],
    };
    filtreler.push(filtre);

    const sorgu: HapbiSorgu = {
      surum: HAPBI_SORGU_SOZLESMESI_SURUMU,
      kapsam,
      veriAlani,
      zaman,
      olcut,
      kirilim: "bolge",
      islem: "toplam",
      filtreler,
    };

    const dogrulama = hapbiSorgusunuDogrula(sorgu);
    if (dogrulama.gecerli) return { basarili: true, sorgu: dogrulama.sorgu };
  }

  if (urunVarligi) {
    const filtre: HapbiVarlikFiltresi = {
      tur: "varlik",
      kirilim: "urun",
      kimlikler: [urunVarligi.id],
    };
    filtreler.push(filtre);

    const sorgu: HapbiSorgu = {
      surum: HAPBI_SORGU_SOZLESMESI_SURUMU,
      kapsam,
      veriAlani,
      zaman,
      olcut,
      kirilim: "urun",
      islem: "toplam",
      filtreler,
    };

    const dogrulama = hapbiSorgusunuDogrula(sorgu);
    if (dogrulama.gecerli) return { basarili: true, sorgu: dogrulama.sorgu };
  }

  // Senaryo C: Rol bazlı varsayılan soru ("puanım kaç", "toplam puan", "hata sayısı")
  if (kapsam.rol === "bm") {
    // BM için varsayılan: kendi bölgesinin toplamı
    if (kapsam.bolgeId) {
      filtreler.push({
        tur: "varlik",
        kirilim: "bolge",
        kimlikler: [kapsam.bolgeId],
      });
    }
    const sorgu: HapbiSorgu = {
      surum: HAPBI_SORGU_SOZLESMESI_SURUMU,
      kapsam,
      veriAlani,
      zaman,
      olcut,
      kirilim: "bolge",
      islem: "toplam",
      filtreler,
    };
    const dogrulama = hapbiSorgusunuDogrula(sorgu);
    if (dogrulama.gecerli) return { basarili: true, sorgu: dogrulama.sorgu };
  }

  if (kapsam.rol === "utt" || kapsam.rol === "kd_utt") {
    // UTT için varsayılan: kişisel puan
    filtreler.push({
      tur: "varlik",
      kirilim: "kullanici",
      kimlikler: [kapsam.kullaniciId],
    });
    const sorgu: HapbiSorgu = {
      surum: HAPBI_SORGU_SOZLESMESI_SURUMU,
      kapsam,
      veriAlani,
      zaman,
      olcut,
      kirilim: "kullanici",
      islem: "dogrudan_deger",
      filtreler,
    };
    const dogrulama = hapbiSorgusunuDogrula(sorgu);
    if (dogrulama.gecerli) return { basarili: true, sorgu: dogrulama.sorgu };
  }

  if (kapsam.rol === "tm") {
    // TM için varsayılan: takım toplamı
    if (kapsam.takimId) {
      filtreler.push({
        tur: "varlik",
        kirilim: "takim",
        kimlikler: [kapsam.takimId],
      });
    }
    const sorgu: HapbiSorgu = {
      surum: HAPBI_SORGU_SOZLESMESI_SURUMU,
      kapsam,
      veriAlani,
      zaman,
      olcut,
      kirilim: "takim",
      islem: "toplam",
      filtreler,
    };
    const dogrulama = hapbiSorgusunuDogrula(sorgu);
    if (dogrulama.gecerli) return { basarili: true, sorgu: dogrulama.sorgu };
  }

  // Genel Firma Rolleri:
  const firmaSorgusu: HapbiSorgu = {
    surum: HAPBI_SORGU_SOZLESMESI_SURUMU,
    kapsam,
    veriAlani,
    zaman,
    olcut,
    kirilim: "firma",
    islem: "toplam",
    filtreler: [{
      tur: "varlik",
      kirilim: "firma",
      kimlikler: [kapsam.firmaId],
    }],
  };
  const dogrulama = hapbiSorgusunuDogrula(firmaSorgusu);
  if (dogrulama.gecerli) return { basarili: true, sorgu: dogrulama.sorgu };

  return { basarili: false, neden: dogrulama.hata };
}
