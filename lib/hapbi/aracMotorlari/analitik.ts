import {
  HAPBI_ANALITIK_BOYUTLARI,
  HAPBI_ANALITIK_ISLEMLERI,
  HAPBI_ANALITIK_OLCUTLERI,
  HAPBI_ANALITIK_SURUMU,
  HAPBI_VERI_ALANLARI,
  type HapbiAnalitikBoyut,
  type HapbiAnalitikDonem,
  type HapbiAnalitikIslem,
  type HapbiAnalitikOlcut,
  type HapbiAnalitikSorgu,
  type HapbiAnalitikVarlikFiltresi,
  type HapbiVeriAlani,
} from "@/lib/hapbi/analitik/sozlesme";
import { hapbiAnalitikKapsaminiCoz } from "@/lib/hapbi/analitik/kapsam";
import { hapbiTclubAnalitikOku } from "@/lib/hapbi/analitik/tclubOkuyucu";
import { hapbiCclubAnalitikOku } from "@/lib/hapbi/analitik/cclubOkuyucu";
import { hapbiEclubAnalitikOku } from "@/lib/hapbi/analitik/eclubOkuyucu";
import { hapbiUretimAnalitikOku } from "@/lib/hapbi/analitik/uretimOkuyucu";
import { hapbiAnalitikKanitlariOlustur } from "@/lib/hapbi/analitik/kanit";
import type { HapbiAlanCalistirici } from "@/lib/hapbi/aracMotorlari/ortak";
import { alanlariDogrula, HapbiHata, nesne } from "@/lib/hapbi/sozlesme";
import type { LigPeriyot } from "@/lib/tclub/hbligi/ligRpcCagir";

const ALANLAR = [
  "veri_alani", "periyot", "yil", "ay", "ceyrek", "hafta", "baslangic", "bitis",
  "olcutler", "boyutlar", "filtreler", "islem", "siralama_olcut", "siralama_yon", "limit",
];

function enumDegeri<T extends readonly string[]>(deger: unknown, degerler: T, ad: string): T[number] {
  if (typeof deger !== "string" || !degerler.includes(deger)) throw new HapbiHata("GECERSIZ_ANALITIK_ALAN", 400, `Geçersiz ${ad}.`);
  return deger as T[number];
}

function enumDizisi<T extends readonly string[]>(deger: unknown, degerler: T, ad: string): T[number][] {
  if (!Array.isArray(deger) || deger.length === 0) throw new HapbiHata("GECERSIZ_ANALITIK_ALAN", 400, `${ad} boş olamaz.`);
  return deger.map((oge) => enumDegeri(oge, degerler, ad));
}

function tamSayi(deger: unknown, ad: string, alt: number, ust: number): number {
  if (typeof deger !== "number" || !Number.isInteger(deger) || deger < alt || deger > ust) {
    throw new HapbiHata("GECERSIZ_ANALITIK_ALAN", 400, `Geçersiz ${ad}.`);
  }
  return deger;
}

function donemiCoz(a: Record<string, unknown>): HapbiAnalitikDonem {
  const tur = enumDegeri(a.periyot, ["hafta", "ay", "donem", "yil", "ozel"] as const, "periyot");
  if (tur === "ozel") {
    if (typeof a.baslangic !== "string" || typeof a.bitis !== "string") throw new HapbiHata("GECERSIZ_DONEM", 400, "Özel dönem için başlangıç ve bitiş zorunludur.");
    return { tur: "ozel", baslangic: a.baslangic, bitis: a.bitis };
  }
  const yil = tamSayi(a.yil, "yıl", 2000, 2100);
  if (tur === "hafta") return { tur, yil, hafta: tamSayi(a.hafta, "hafta", 1, 53) };
  if (tur === "ay") return { tur, yil, ay: tamSayi(a.ay, "ay", 1, 12) };
  if (tur === "donem") return { tur: "ceyrek", yil, ceyrek: tamSayi(a.ceyrek, "çeyrek", 1, 4) };
  return { tur: "yil", yil };
}

function filtreleriCoz(deger: unknown): HapbiAnalitikVarlikFiltresi[] {
  if (deger === undefined) return [];
  if (!Array.isArray(deger)) throw new HapbiHata("GECERSIZ_FILTRE", 400, "Analitik filtreler dizi olmalıdır.");
  return deger.map((ham) => {
    const f = nesne(ham);
    alanlariDogrula(f, ["boyut", "kimlikler"]);
    const boyut = enumDegeri(f.boyut, HAPBI_ANALITIK_BOYUTLARI.filter((b) => b !== "zaman"), "filtre boyutu") as Exclude<HapbiAnalitikBoyut, "zaman">;
    if (!Array.isArray(f.kimlikler) || !f.kimlikler.length || f.kimlikler.some((id) => typeof id !== "string" || !id.trim())) {
      throw new HapbiHata("GECERSIZ_FILTRE", 400, "Filtre kimlikleri boş olmayan metinlerden oluşmalıdır.");
    }
    return { boyut, kimlikler: f.kimlikler as string[] };
  });
}

const KAYNAKLAR: Record<HapbiVeriAlani, { baslik: string; url: string }> = {
  tclub: { baslik: "T-Club analitik sonucu", url: "/hbligi" },
  cclub: { baslik: "C-Club analitik sonucu", url: "/cc-ligi" },
  eclub: { baslik: "E-Club analitik sonucu", url: "/eclub/raporlar" },
  uretim: { baslik: "Üretim ve yayın analitik sonucu", url: "/raporlar/uretim" },
};

function kaynakPeriyodu(donem: HapbiAnalitikDonem): LigPeriyot | undefined {
  if (donem.tur === "ozel") return undefined;
  return {
    periyot: donem.tur === "ceyrek" ? "donem" : donem.tur,
    yil: donem.yil,
    ay: donem.tur === "ay" ? donem.ay : 1,
    ceyrek: donem.tur === "ceyrek" ? donem.ceyrek : 1,
    hafta: donem.tur === "hafta" ? donem.hafta : 1,
  };
}

const DESTEKLENEN_BOYUTLAR: Record<HapbiVeriAlani, readonly HapbiAnalitikBoyut[]> = {
  tclub: ["firma", "takim", "bm_kapsami", "kullanici", "urun", "kategori", "arac_turu", "yayin", "zaman"],
  cclub: ["firma", "takim", "bm_kapsami", "kullanici", "urun", "kategori", "arac_turu", "yayin", "zaman"],
  eclub: ["firma", "takim", "bm_kapsami", "kullanici", "eczane", "urun", "icerik", "zaman"],
  uretim: ["firma", "takim", "kullanici", "urun", "icerik", "kategori", "arac_turu", "yayin", "durum", "uretim_varyanti", "zaman"],
};

const PUAN_OLCUTLERI: readonly HapbiAnalitikOlcut[] = [
  "net_puan", "kazanilan_puan", "kaybedilen_puan", "izleme_puani", "cevaplama_puani",
  "oneri_puani", "extra_puan", "ileri_sarma_kaybi", "yanlis_cevap_kaybi", "oneri_kaybi",
  "challenge_puani", "challenge_kaybi", "tamamlama_sayisi", "benzersiz_yayin_sayisi",
  "gonderim_sayisi", "cevap_sayisi", "dogru_cevap_sayisi", "yanlis_cevap_sayisi", "yayin_sayisi",
];

const DESTEKLENEN_OLCUTLER: Record<HapbiVeriAlani, readonly HapbiAnalitikOlcut[]> = {
  tclub: PUAN_OLCUTLERI.filter((olcut) => olcut !== "challenge_puani" && olcut !== "challenge_kaybi"),
  cclub: PUAN_OLCUTLERI.filter((olcut) => olcut !== "oneri_puani" && olcut !== "oneri_kaybi"),
  eclub: ["net_puan", "kazanilan_puan", "kaybedilen_puan", "izleme_puani", "cevaplama_puani", "ileri_sarma_kaybi", "tamamlama_sayisi", "gonderim_sayisi", "cevap_sayisi", "dogru_cevap_sayisi", "yanlis_cevap_sayisi"],
  uretim: ["talep_sayisi", "gorev_sayisi", "yayin_sayisi"],
};

function veriAlaniUyumunuDogrula(
  veriAlani: HapbiVeriAlani,
  boyutlar: HapbiAnalitikBoyut[],
  olcutler: HapbiAnalitikOlcut[],
): void {
  const gecersizBoyut = boyutlar.find((boyut) => !DESTEKLENEN_BOYUTLAR[veriAlani].includes(boyut));
  if (gecersizBoyut) throw new HapbiHata("DESTEKLENMEYEN_BOYUT", 400, `${gecersizBoyut} ${veriAlani} alanında desteklenmiyor.`);
  const gecersizOlcut = olcutler.find((olcut) => !DESTEKLENEN_OLCUTLER[veriAlani].includes(olcut));
  if (gecersizOlcut) throw new HapbiHata("DESTEKLENMEYEN_OLCUT", 400, `${gecersizOlcut} ${veriAlani} alanında desteklenmiyor.`);
}

export const analitikAraciniCalistir: HapbiAlanCalistirici = async (baglam, ad, a) => {
  if (ad !== "analitik_sorgu") return { durum: "desteklenmiyor", aciklama: "Bu analitik araç mevcut değil." };
  alanlariDogrula(a, ALANLAR);

  const veriAlani = enumDegeri(a.veri_alani, HAPBI_VERI_ALANLARI, "veri alanı");
  const kapsam = hapbiAnalitikKapsaminiCoz(baglam.kullanici, veriAlani);
  if (kapsam.tur === "eclub_kisisel") {
    return {
      durum: "desteklenmiyor",
      aciklama: "E-Club kişisel durumu dönemli organizasyon analizi değildir; eclub_kisisel_durum aracını kullanın.",
    };
  }
  const olcutler = enumDizisi(a.olcutler, HAPBI_ANALITIK_OLCUTLERI, "ölçüt") as HapbiAnalitikOlcut[];
  const boyutlar = Array.isArray(a.boyutlar)
    ? a.boyutlar.map((boyut) => enumDegeri(boyut, HAPBI_ANALITIK_BOYUTLARI, "boyut")) as HapbiAnalitikBoyut[]
    : [];
  veriAlaniUyumunuDogrula(veriAlani, boyutlar, olcutler);
  const islem = enumDegeri(a.islem, HAPBI_ANALITIK_ISLEMLERI, "işlem") as HapbiAnalitikIslem;
  const siralamaOlcut = a.siralama_olcut === undefined ? undefined
    : enumDegeri(a.siralama_olcut, HAPBI_ANALITIK_OLCUTLERI, "sıralama ölçütü") as HapbiAnalitikOlcut;
  const siralamaYon = a.siralama_yon === undefined ? undefined
    : enumDegeri(a.siralama_yon, ["artan", "azalan"] as const, "sıralama yönü");
  if ((siralamaOlcut === undefined) !== (siralamaYon === undefined)) {
    throw new HapbiHata("GECERSIZ_SIRALAMA", 400, "Sıralama ölçütü ve yönü birlikte verilmelidir.");
  }

  const sorgu: HapbiAnalitikSorgu = {
    surum: HAPBI_ANALITIK_SURUMU,
    veri_alani: veriAlani,
    kapsam,
    donem: donemiCoz(a),
    olcutler,
    boyutlar,
    filtreler: filtreleriCoz(a.filtreler),
    islem,
    ...(siralamaOlcut && siralamaYon ? { siralama: { olcut: siralamaOlcut, yon: siralamaYon } } : {}),
    ...(a.limit === undefined ? {} : { limit: tamSayi(a.limit, "limit", 1, 100) }),
  };
  const kaynakBilgisi = KAYNAKLAR[veriAlani];
  const temelKaynak = baglam.kaynak(kaynakBilgisi.baslik, kaynakBilgisi.url, kaynakPeriyodu(sorgu.donem));
  const kaynak = sorgu.donem.tur === "ozel"
    ? { ...temelKaynak, donem: `${sorgu.donem.baslangic} / ${sorgu.donem.bitis}` }
    : temelKaynak;
  const sonuc = veriAlani === "tclub" ? await hapbiTclubAnalitikOku(baglam.db, sorgu, kaynak)
    : veriAlani === "cclub" ? await hapbiCclubAnalitikOku(baglam.db, sorgu, kaynak)
      : veriAlani === "eclub" ? await hapbiEclubAnalitikOku(baglam.db, sorgu, kaynak)
        : await hapbiUretimAnalitikOku(baglam.db, sorgu, kaynak);

  return {
    durum: sonuc.veri_durumu === "bos" ? "bos" : "ok",
    kaynak,
    veri: { ...sonuc, kanitlar: hapbiAnalitikKanitlariOlustur(sonuc, kaynak.id) },
    ...(!sonuc.tam_mi && sonuc.sinir_aciklamasi ? { aciklama: sonuc.sinir_aciklamasi } : {}),
  };
};
