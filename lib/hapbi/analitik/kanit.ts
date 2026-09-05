import type { HapbiAnalitikOlcut, HapbiAnalitikSonuc, HapbiAnalitikVarlik } from "@/lib/hapbi/analitik/sozlesme";
import { HapbiHata, nesne, type HapbiAracSonucu } from "@/lib/hapbi/sozlesme";

export interface HapbiAnalitikKanit {
  id: string;
  kaynak_id: string;
  tur: "satir" | "toplam";
  ozne: HapbiAnalitikVarlik | null;
  iliski: HapbiAnalitikOlcut;
  deger: number;
  baglam: Record<string, unknown>;
}

const sayi = (deger: unknown): number | null => typeof deger === "number" && Number.isFinite(deger) ? deger : null;

export function hapbiAnalitikKanitlariOlustur(sonuc: HapbiAnalitikSonuc, kaynakId: string): HapbiAnalitikKanit[] {
  const satirKanitlari = sonuc.olgular.flatMap((olgu, sira) => {
    const deger = sayi(olgu.deger);
    return deger === null ? [] : [{
      id: `${kaynakId}:satir:${olgu.ozne.tur}:${olgu.ozne.id}:${olgu.iliski}:${sira + 1}`,
      kaynak_id: kaynakId,
      tur: "satir" as const,
      ozne: olgu.ozne,
      iliski: olgu.iliski,
      deger,
      baglam: olgu.baglam as Record<string, unknown>,
    }];
  });
  const toplamKanitlari = Object.entries(sonuc.toplamlar).flatMap(([iliski, hamDeger]) => {
    const deger = sayi(hamDeger);
    return deger === null ? [] : [{
      id: `${kaynakId}:toplam:${iliski}`,
      kaynak_id: kaynakId,
      tur: "toplam" as const,
      ozne: null,
      iliski: iliski as HapbiAnalitikOlcut,
      deger,
      baglam: {},
    }];
  });
  return [...satirKanitlari, ...toplamKanitlari];
}

function kanitlariOku(sonuclar: HapbiAracSonucu[], kaynakIdleri: string[]): HapbiAnalitikKanit[] {
  return sonuclar.filter((sonuc) => sonuc.kaynak && kaynakIdleri.includes(sonuc.kaynak.id)).flatMap((sonuc) => {
    const veri = nesne(sonuc.veri ?? {});
    if (veri.surum !== "hapbi-analitik-v1" || !Array.isArray(veri.kanitlar)) return [];
    return veri.kanitlar.flatMap((ham): HapbiAnalitikKanit[] => {
      const k = nesne(ham);
      const ozne = k.ozne === null ? null : nesne(k.ozne);
      if (typeof k.id !== "string" || typeof k.kaynak_id !== "string" || !["satir", "toplam"].includes(String(k.tur))
        || typeof k.iliski !== "string" || typeof k.deger !== "number" || !Number.isFinite(k.deger)
        || (ozne && (typeof ozne.id !== "string" || typeof ozne.ad !== "string" || typeof ozne.tur !== "string"))) return [];
      return [{
        id: k.id,
        kaynak_id: k.kaynak_id,
        tur: k.tur as "satir" | "toplam",
        ozne: ozne ? { tur: ozne.tur, id: ozne.id, ad: ozne.ad, ...(typeof ozne.ust_varlik_id === "string" || ozne.ust_varlik_id === null ? { ust_varlik_id: ozne.ust_varlik_id } : {}) } as HapbiAnalitikVarlik : null,
        iliski: k.iliski as HapbiAnalitikOlcut,
        deger: k.deger,
        baglam: nesne(k.baglam ?? {}),
      }];
    });
  });
}

const OLÇÜT_DESENLERİ: Array<[HapbiAnalitikOlcut, RegExp]> = [
  ["ileri_sarma_kaybi", /ileri sarma/iu],
  ["yanlis_cevap_kaybi", /yanlış cevap/iu],
  ["oneri_kaybi", /öneri kayb/iu],
  ["challenge_kaybi", /challenge kayb/iu],
  ["kazanilan_puan", /kazan(?:ılan|dığı|ım).*puan|kazanım/iu],
  ["kaybedilen_puan", /kaybedilen puan|toplam kayıp/iu],
  ["izleme_puani", /izleme puan/iu],
  ["cevaplama_puani", /cevaplama puan/iu],
  ["oneri_puani", /öneri puan/iu],
  ["extra_puan", /extra puan/iu],
  ["challenge_puani", /challenge puan/iu],
  ["tamamlama_sayisi", /tamamlama/iu],
  ["benzersiz_yayin_sayisi", /benzersiz yayın/iu],
  ["izleme_sayisi", /izleme say/iu],
  ["gonderim_sayisi", /gönderim say/iu],
  ["cevap_sayisi", /cevap say/iu],
  ["dogru_cevap_sayisi", /doğru cevap say/iu],
  ["yanlis_cevap_sayisi", /yanlış cevap say/iu],
  ["yayin_sayisi", /yayın say/iu],
  ["gorev_sayisi", /görev say/iu],
  ["talep_sayisi", /talep say/iu],
  ["net_puan", /net puan|\bpuan\b/iu],
];

function metindekiSayilar(metin: string): number[] {
  return [...metin.matchAll(/-?\d+(?:[.,]\d+)*/gu)].flatMap((eslesme) => {
    const deger = Number(eslesme[0].replace(",", "."));
    const baslangic = Math.max(0, (eslesme.index ?? 0) - 16);
    const bitis = Math.min(metin.length, (eslesme.index ?? 0) + eslesme[0].length + 16);
    const yakin = metin.slice(baslangic, bitis);
    const takvimVeyaSira = Number.isInteger(deger) && deger >= 2000 && deger <= 2100
      || /çeyrek|ceyrek|hafta|\bay\b|\byıl|dönem|donem|\bsıra|\bilk\b/iu.test(yakin);
    return Number.isFinite(deger) && !takvimVeyaSira ? [deger] : [];
  });
}

function iliskiyiCoz(metin: string): HapbiAnalitikOlcut | null {
  return OLÇÜT_DESENLERİ.find(([, desen]) => desen.test(metin))?.[0] ?? null;
}

function kanitVarliklari(kanit: HapbiAnalitikKanit): HapbiAnalitikVarlik[] {
  const adaylar = [kanit.ozne, ...Object.values(kanit.baglam)].flatMap((deger): HapbiAnalitikVarlik[] => {
    if (!deger || typeof deger !== "object" || Array.isArray(deger)) return [];
    const v = deger as Record<string, unknown>;
    return typeof v.id === "string" && typeof v.ad === "string" && typeof v.tur === "string"
      ? [v as unknown as HapbiAnalitikVarlik]
      : [];
  });
  return [...new Map(adaylar.map((varlik) => [`${varlik.tur}:${varlik.id}`, varlik])).values()];
}

export function hapbiAnalitikYanitiDogrula(
  cevap: string,
  kaynakIdleri: string[],
  hamKanitIdleri: unknown,
  sonuclar: HapbiAracSonucu[],
): number[] | null {
  const tumKanitlar = kanitlariOku(sonuclar, kaynakIdleri);
  if (!tumKanitlar.length) return null;
  if (!Array.isArray(hamKanitIdleri) || !hamKanitIdleri.length || hamKanitIdleri.length > 40
    || hamKanitIdleri.some((id) => typeof id !== "string")) {
    throw new HapbiHata("ANALITIK_KANIT", 502, "Analitik yanıtın olgu kanıtları seçilmedi.");
  }
  const kanitHaritasi = new Map(tumKanitlar.map((kanit) => [kanit.id, kanit]));
  const secilenler = [...new Set(hamKanitIdleri)].map((id) => kanitHaritasi.get(id as string));
  if (secilenler.some((kanit) => !kanit)) throw new HapbiHata("ANALITIK_KANIT", 502, "Analitik yanıt bilinmeyen bir olgu kanıtına dayandırıldı.");
  const secili = secilenler as HapbiAnalitikKanit[];

  const tumVarliklar = new Map(tumKanitlar.flatMap((kanit) => kanitVarliklari(kanit).map((varlik) => [`${varlik.tur}:${varlik.id}`, varlik] as const)));
  const varliklariBul = (metin: string) => [...tumVarliklar.values()].filter((varlik) => metin.toLocaleLowerCase("tr-TR").includes(varlik.ad.toLocaleLowerCase("tr-TR")));
  for (const cumle of cevap.split(/[.!?;]+/u)) {
    const gecenVarliklar = varliklariBul(cumle);
    if (!gecenVarliklar.length) continue;
    if (new Set(gecenVarliklar.map((varlik) => varlik.tur)).size > 1) {
      const birlikteKanitlandi = secili.some((kanit) => {
        const kimlikler = new Set(kanitVarliklari(kanit).map((varlik) => `${varlik.tur}:${varlik.id}`));
        return gecenVarliklar.every((varlik) => kimlikler.has(`${varlik.tur}:${varlik.id}`));
      });
      if (!birlikteKanitlandi) throw new HapbiHata("ANALITIK_ILISKI", 502, "Cevaptaki varlıklar aynı analitik olguda ilişkilendirilemedi.");
    }
    for (const varlik of gecenVarliklar) {
      const varlikKanitlari = secili.filter((kanit) => kanitVarliklari(kanit).some((aday) => aday.tur === varlik.tur && aday.id === varlik.id));
      if (!varlikKanitlari.length) throw new HapbiHata("ANALITIK_ILISKI", 502, `${varlik.ad} için seçilmiş analitik olgu bulunamadı.`);
    }
    for (const parca of cumle.split(/,+/u)) {
      const parcaVarliklari = varliklariBul(parca);
      if (parcaVarliklari.length !== 1) continue;
      const varlik = parcaVarliklari[0];
      const varlikKanitlari = secili.filter((kanit) => kanitVarliklari(kanit).some((aday) => aday.tur === varlik.tur && aday.id === varlik.id));
      const iliski = iliskiyiCoz(parca);
      for (const deger of metindekiSayilar(parca)) {
        const eslesme = varlikKanitlari.some((kanit) => kanit.deger === deger && (!iliski || kanit.iliski === iliski));
        if (!eslesme) throw new HapbiHata("ANALITIK_ILISKI", 502, `${varlik.ad} ile ölçüm ilişkisi doğrulanamadı.`);
      }
    }
  }
  return secili.map((kanit) => kanit.deger);
}
