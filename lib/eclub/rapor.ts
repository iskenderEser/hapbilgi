export interface EclubRaporHamSatir {
  eczane_id: string;
  gln: string | null;
  eczane_adi: string | null;
  kisi_id: string | null;
  kisi_ad: string | null;
  kisi_soyad: string | null;
  kisi_rol: string | null;
  icerik_anahtari: string | null;
  icerik_adi: string | null;
  gonderilen_sayisi: number | string | null;
  tamamlanan_izleme: number | string | null;
  dogru_cevap: number | string | null;
  yanlis_cevap: number | string | null;
  izleme_puani: number | string | null;
  cevaplama_puani: number | string | null;
}

export interface EclubRaporMetrikleri {
  gonderilen_sayisi: number;
  tamamlanan_izleme: number;
  dogru_cevap: number;
  yanlis_cevap: number;
  izleme_puani: number;
  cevaplama_puani: number;
  toplam_puan: number;
}

export interface EclubRaporKisi extends EclubRaporMetrikleri {
  kisi_id: string;
  ad: string;
  soyad: string;
  rol: string;
}

export interface EclubRaporEczane extends EclubRaporMetrikleri {
  eczane_id: string;
  gln: string | null;
  eczane_adi: string;
  kisiler: EclubRaporKisi[];
}

export interface EclubRaporIcerik extends EclubRaporMetrikleri {
  icerik_anahtari: string;
  icerik_adi: string;
}

export interface EclubRaporOzet extends EclubRaporMetrikleri {
  aktif_eczane: number;
  aktif_kisi: number;
  izleyen_kisi: number;
  katilim_orani: number;
  dogru_cevap_orani: number;
}

export interface EclubRaporSonuc {
  ozet: EclubRaporOzet;
  eczaneler: EclubRaporEczane[];
  icerikler: EclubRaporIcerik[];
}

export interface EclubLigIcerik extends EclubRaporMetrikleri {
  icerik_anahtari: string;
  icerik_adi: string;
}

export interface EclubLigSatiri extends EclubRaporMetrikleri {
  sira: number;
  kisi_id: string;
  ad: string;
  soyad: string;
  rol: string;
  eczane_id: string;
  eczane_adi: string;
  gln: string | null;
  icerikler: EclubLigIcerik[];
}

const sifirMetrik = (): EclubRaporMetrikleri => ({
  gonderilen_sayisi: 0,
  tamamlanan_izleme: 0,
  dogru_cevap: 0,
  yanlis_cevap: 0,
  izleme_puani: 0,
  cevaplama_puani: 0,
  toplam_puan: 0,
});

const sayi = (deger: number | string | null | undefined) => {
  const sonuc = Number(deger ?? 0);
  return Number.isFinite(sonuc) ? sonuc : 0;
};

const satirMetrigi = (satir: EclubRaporHamSatir): EclubRaporMetrikleri => {
  const izlemePuani = sayi(satir.izleme_puani);
  const cevaplamaPuani = sayi(satir.cevaplama_puani);
  return {
    gonderilen_sayisi: sayi(satir.gonderilen_sayisi),
    tamamlanan_izleme: sayi(satir.tamamlanan_izleme),
    dogru_cevap: sayi(satir.dogru_cevap),
    yanlis_cevap: sayi(satir.yanlis_cevap),
    izleme_puani: izlemePuani,
    cevaplama_puani: cevaplamaPuani,
    toplam_puan: izlemePuani + cevaplamaPuani,
  };
};

const metrikEkle = (hedef: EclubRaporMetrikleri, kaynak: EclubRaporMetrikleri) => {
  hedef.gonderilen_sayisi += kaynak.gonderilen_sayisi;
  hedef.tamamlanan_izleme += kaynak.tamamlanan_izleme;
  hedef.dogru_cevap += kaynak.dogru_cevap;
  hedef.yanlis_cevap += kaynak.yanlis_cevap;
  hedef.izleme_puani += kaynak.izleme_puani;
  hedef.cevaplama_puani += kaynak.cevaplama_puani;
  hedef.toplam_puan += kaynak.toplam_puan;
};

const yuzde = (pay: number, payda: number) => (
  payda > 0 ? Math.round((pay / payda) * 100) : 0
);

/**
 * RPC'nin kişi × içerik satırlarını arayüzün ihtiyaç duyduğu üç eksende toplar:
 * genel özet, eczane → kişi akordiyonu ve içerik dağılımı.
 */
export function eclubRaporunuTopla(satirlar: EclubRaporHamSatir[]): EclubRaporSonuc {
  const eczaneMap = new Map<string, EclubRaporEczane>();
  const kisiMap = new Map<string, EclubRaporKisi>();
  const icerikMap = new Map<string, EclubRaporIcerik>();

  for (const satir of satirlar) {
    let eczane = eczaneMap.get(satir.eczane_id);
    if (!eczane) {
      eczane = {
        eczane_id: satir.eczane_id,
        gln: satir.gln,
        eczane_adi: satir.eczane_adi?.trim() || "Adsız Eczane",
        kisiler: [],
        ...sifirMetrik(),
      };
      eczaneMap.set(satir.eczane_id, eczane);
    }

    const metrik = satirMetrigi(satir);
    metrikEkle(eczane, metrik);

    if (satir.kisi_id) {
      let kisi = kisiMap.get(satir.kisi_id);
      if (!kisi) {
        kisi = {
          kisi_id: satir.kisi_id,
          ad: satir.kisi_ad?.trim() || "—",
          soyad: satir.kisi_soyad?.trim() || "",
          rol: satir.kisi_rol ?? "—",
          ...sifirMetrik(),
        };
        kisiMap.set(satir.kisi_id, kisi);
        eczane.kisiler.push(kisi);
      }
      metrikEkle(kisi, metrik);
    }

    if (satir.icerik_anahtari && satir.icerik_adi) {
      let icerik = icerikMap.get(satir.icerik_anahtari);
      if (!icerik) {
        icerik = {
          icerik_anahtari: satir.icerik_anahtari,
          icerik_adi: satir.icerik_adi,
          ...sifirMetrik(),
        };
        icerikMap.set(satir.icerik_anahtari, icerik);
      }
      metrikEkle(icerik, metrik);
    }
  }

  const eczaneler = [...eczaneMap.values()]
    .map((eczane) => ({
      ...eczane,
      kisiler: [...eczane.kisiler].sort((a, b) => (
        b.tamamlanan_izleme - a.tamamlanan_izleme
        || `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`, "tr")
      )),
    }))
    .sort((a, b) => (
      b.tamamlanan_izleme - a.tamamlanan_izleme
      || a.eczane_adi.localeCompare(b.eczane_adi, "tr")
    ));

  const icerikler = [...icerikMap.values()].sort((a, b) => (
    b.tamamlanan_izleme - a.tamamlanan_izleme
    || a.icerik_adi.localeCompare(b.icerik_adi, "tr")
  ));

  const toplam = eczaneler.reduce<EclubRaporMetrikleri>((birikim, eczane) => {
    metrikEkle(birikim, eczane);
    return birikim;
  }, sifirMetrik());
  const tumKisiler = eczaneler.flatMap((eczane) => eczane.kisiler);
  const izleyenKisi = tumKisiler.filter((kisi) => kisi.tamamlanan_izleme > 0).length;
  const toplamCevap = toplam.dogru_cevap + toplam.yanlis_cevap;

  return {
    ozet: {
      ...toplam,
      aktif_eczane: eczaneler.length,
      aktif_kisi: tumKisiler.length,
      izleyen_kisi: izleyenKisi,
      katilim_orani: yuzde(izleyenKisi, tumKisiler.length),
      dogru_cevap_orani: yuzde(toplam.dogru_cevap, toplamCevap),
    },
    eczaneler,
    icerikler,
  };
}

/** UTT'nin aktif E-Club ekibini gerçek kişi kimlikleriyle puana göre sıralar. */
export function eclubLiginiOlustur(satirlar: EclubRaporHamSatir[]): EclubLigSatiri[] {
  const kisiMap = new Map<string, Omit<EclubLigSatiri, "sira"> & { icerikMap: Map<string, EclubLigIcerik> }>();

  for (const satir of satirlar) {
    if (!satir.kisi_id) continue;
    let kisi = kisiMap.get(satir.kisi_id);
    if (!kisi) {
      kisi = {
        kisi_id: satir.kisi_id,
        ad: satir.kisi_ad?.trim() || "—",
        soyad: satir.kisi_soyad?.trim() || "",
        rol: satir.kisi_rol ?? "—",
        eczane_id: satir.eczane_id,
        eczane_adi: satir.eczane_adi?.trim() || "Adsız Eczane",
        gln: satir.gln,
        icerikler: [],
        icerikMap: new Map(),
        ...sifirMetrik(),
      };
      kisiMap.set(satir.kisi_id, kisi);
    }

    const metrik = satirMetrigi(satir);
    metrikEkle(kisi, metrik);

    if (satir.icerik_anahtari && satir.icerik_adi) {
      let icerik = kisi.icerikMap.get(satir.icerik_anahtari);
      if (!icerik) {
        icerik = {
          icerik_anahtari: satir.icerik_anahtari,
          icerik_adi: satir.icerik_adi,
          ...sifirMetrik(),
        };
        kisi.icerikMap.set(satir.icerik_anahtari, icerik);
        kisi.icerikler.push(icerik);
      }
      metrikEkle(icerik, metrik);
    }
  }

  const sirali = [...kisiMap.values()]
    .map((kisi) => ({
      kisi_id: kisi.kisi_id,
      ad: kisi.ad,
      soyad: kisi.soyad,
      rol: kisi.rol,
      eczane_id: kisi.eczane_id,
      eczane_adi: kisi.eczane_adi,
      gln: kisi.gln,
      gonderilen_sayisi: kisi.gonderilen_sayisi,
      tamamlanan_izleme: kisi.tamamlanan_izleme,
      dogru_cevap: kisi.dogru_cevap,
      yanlis_cevap: kisi.yanlis_cevap,
      izleme_puani: kisi.izleme_puani,
      cevaplama_puani: kisi.cevaplama_puani,
      toplam_puan: kisi.toplam_puan,
      icerikler: [...kisi.icerikler].sort((a, b) => (
        b.toplam_puan - a.toplam_puan || a.icerik_adi.localeCompare(b.icerik_adi, "tr")
      )),
    }))
    .sort((a, b) => (
      b.toplam_puan - a.toplam_puan
      || b.tamamlanan_izleme - a.tamamlanan_izleme
      || `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`, "tr")
    ));

  let sira = 0;
  let sonPuan: number | null = null;
  return sirali.map((kisi) => {
    if (kisi.toplam_puan <= 0) return { ...kisi, sira: 0 };
    if (sonPuan === null || kisi.toplam_puan !== sonPuan) {
      sira += 1;
      sonPuan = kisi.toplam_puan;
    }
    return { ...kisi, sira };
  });
}

export interface EclubTakimLigSatiri extends EclubRaporMetrikleri {
  sira: number;
  utt_id: string;
  utt_adi: string;
  takim_adi: string;
  bolge_adi: string;
  takim_id: string | null;
  uye_sayisi: number;
  aktif_uye: number;
  dogru_cevap_orani: number;
  benim_takimim?: boolean;
}

export interface EclubTakimGirdi {
  utt_id: string;
  utt_adi: string;
  takim_adi?: string | null;
  bolge_adi: string;
  takim_id?: string | null;
  satirlar: EclubRaporHamSatir[];
}

/** Firma genelindeki tüm UTT E-Club takımlarını puanlarına göre lig sıralamasına koyar. */
export function eclubTakimlarLiginiOlustur(takimlar: EclubTakimGirdi[], aktifUttId?: string): EclubTakimLigSatiri[] {
  const sirasiz = takimlar.map((takim) => {
    const rapor = eclubRaporunuTopla(takim.satirlar);
    const toplamCevap = rapor.ozet.dogru_cevap + rapor.ozet.yanlis_cevap;
    return {
      utt_id: takim.utt_id,
      utt_adi: takim.utt_adi,
      takim_adi: takim.takim_adi?.trim() || `${takim.utt_adi} Takımı`,
      bolge_adi: takim.bolge_adi,
      takim_id: takim.takim_id ?? null,
      uye_sayisi: rapor.ozet.aktif_kisi,
      aktif_uye: rapor.ozet.izleyen_kisi,
      gonderilen_sayisi: rapor.ozet.gonderilen_sayisi,
      tamamlanan_izleme: rapor.ozet.tamamlanan_izleme,
      dogru_cevap: rapor.ozet.dogru_cevap,
      yanlis_cevap: rapor.ozet.yanlis_cevap,
      izleme_puani: rapor.ozet.izleme_puani,
      cevaplama_puani: rapor.ozet.cevaplama_puani,
      toplam_puan: rapor.ozet.toplam_puan,
      dogru_cevap_orani: toplamCevap > 0 ? Math.round((rapor.ozet.dogru_cevap / toplamCevap) * 100) : 0,
      benim_takimim: aktifUttId ? takim.utt_id === aktifUttId : false,
      sira: 0,
    };
  });

  const sirali = sirasiz.sort((a, b) => (
    b.toplam_puan - a.toplam_puan
    || b.tamamlanan_izleme - a.tamamlanan_izleme
    || b.aktif_uye - a.aktif_uye
    || a.takim_adi.localeCompare(b.takim_adi, "tr")
  ));

  let sira = 0;
  let sonPuan: number | null = null;
  return sirali.map((takim) => {
    if (takim.toplam_puan <= 0) return { ...takim, sira: 0 };
    if (sonPuan === null || takim.toplam_puan !== sonPuan) {
      sira += 1;
      sonPuan = takim.toplam_puan;
    }
    return { ...takim, sira };
  });
}

