// lib/hbligi/getUttLig.ts
//
// UTT/KD_UTT rolü için HBLigi verisi.
// Kullanıcının kendi bölgesindeki UTT'leri toplam puana göre sıralı döner.
// Dönem: çağıran tarafından geçilen periyot (ay/donem/yil/hafta) — ligRpcCagir helper'ı.

import type { SupabaseClient } from "@supabase/supabase-js";
import { ligRpcCagir, type LigPeriyot } from "@/lib/tclub/hbligi/ligRpcCagir";
import { esitPuanEsitSira } from "@/lib/tclub/hbligi/siralama";
import { aktifPeriyot, oncekiLigPeriyodu } from "@/lib/zaman/kontrol";

export interface UttLigSatiri {
  sira: number;
  kullanici_id: string;
  ad: string;
  rol: string;
  bolge: string;
  takim: string;
  fotograf_url?: string | null;
  izleme_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  eclub_puani?: number;
  extra_puani: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  toplam_puan: number;
  toplam_kazanc?: number;
  toplam_kayip?: number;
  detay_gorulebilir?: boolean;
  benim: boolean;
}

export interface UttKursuSatiri extends UttLigSatiri {
  degisim: number | null;
}

export interface UttOrganizasyonKapsami {
  bolge_id: string;
  takim_id: string | null;
  firma_id: string | null;
}

export const AY_ADLARI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

export interface UttAylikKursu {
  ay: number;
  yil: number;
  ay_adi: string;
  bolge_top3: UttKursuSatiri[];
  takim_top3: UttKursuSatiri[];
  sirket_top3: UttKursuSatiri[];
}

export interface UttLigSonuc {
  tip: "utt";
  lig: UttLigSatiri[];
  ligler: {
    bolge: UttLigSatiri[];
    takim: UttLigSatiri[];
    firma: UttLigSatiri[];
  };
  aylik_kursu: UttAylikKursu;
}

function puanHareketiVar(satir: Awaited<ReturnType<typeof ligRpcCagir>>[number]): boolean {
  return satir.izleme_puani
    + satir.cevaplama_puani
    + satir.oneri_puani
    + satir.extra_puani
    + (satir.eclub_puani ?? 0)
    + satir.ileri_sarma_kaybi
    + satir.yanlis_cevap_kaybi
    + satir.oneri_kaybi > 0;
}

function ligOlustur(
  tumUttler: Awaited<ReturnType<typeof ligRpcCagir>>,
  kullanici_id: string,
  kapsam: (satir: Awaited<ReturnType<typeof ligRpcCagir>>[number]) => boolean,
  yalnizPuanHareketi: boolean,
  fotoMap?: Map<string, string | null>,
): UttLigSatiri[] {
  const satirlar: UttLigSatiri[] = tumUttler
    .filter((satir) => kapsam(satir) && (!yalnizPuanHareketi || puanHareketiVar(satir)))
    .map((satir) => ({
      sira: 0,
      kullanici_id: satir.kullanici_id,
      ad: `${satir.ad} ${satir.soyad ?? ""}`.trim(),
      rol: satir.rol,
      bolge: satir.bolge_adi ?? "-",
      takim: satir.takim_adi ?? "-",
      fotograf_url: fotoMap?.get(satir.kullanici_id) ?? null,
      izleme_puani: satir.izleme_puani,
      cevaplama_puani: satir.cevaplama_puani,
      oneri_puani: satir.oneri_puani,
      extra_puani: satir.extra_puani,
      eclub_puani: satir.eclub_puani ?? 0,
      ileri_sarma_kaybi: satir.ileri_sarma_kaybi,
      yanlis_cevap_kaybi: satir.yanlis_cevap_kaybi,
      oneri_kaybi: satir.oneri_kaybi,
      toplam_puan: satir.toplam_puan,
      benim: satir.kullanici_id === kullanici_id,
    }));

  const kimligeGore = new Map(satirlar.map((satir) => [satir.kullanici_id, satir]));
  return esitPuanEsitSira(satirlar.map((satir) => ({
    kullanici_id: satir.kullanici_id,
    ad: satir.ad,
    net: satir.toplam_puan,
  }))).map((sirali) => ({
    ...kimligeGore.get(sirali.kullanici_id)!,
    sira: sirali.sira,
  }));
}

function uttAyrintisiniSinirla<T extends UttLigSatiri>(satir: T, kullaniciId: string): T {
  const toplam_kazanc = satir.izleme_puani + satir.cevaplama_puani + satir.oneri_puani
    + satir.extra_puani + (satir.eclub_puani ?? 0);
  const toplam_kayip = satir.ileri_sarma_kaybi + satir.yanlis_cevap_kaybi + satir.oneri_kaybi;
  const kendiSatiri = satir.kullanici_id === kullaniciId;

  if (kendiSatiri) {
    return { ...satir, toplam_kazanc, toplam_kayip, detay_gorulebilir: true };
  }

  return {
    ...satir,
    toplam_kazanc,
    toplam_kayip,
    detay_gorulebilir: false,
    izleme_puani: 0,
    cevaplama_puani: 0,
    oneri_puani: 0,
    extra_puani: 0,
    eclub_puani: 0,
    ileri_sarma_kaybi: 0,
    yanlis_cevap_kaybi: 0,
    oneri_kaybi: 0,
  };
}

function uttListesiniSinirla<T extends UttLigSatiri>(satirlar: T[], kullaniciId: string): T[] {
  return satirlar.map((satir) => uttAyrintisiniSinirla(satir, kullaniciId));
}

/**
 * UTT/KD_UTT için kendi bölgesindeki UTT lig sıralamasını döner.
 *
 * @param supabase Admin client
 * @param kullanici_id Giriş yapan kullanıcının ID'si
 * @param organizasyon Kullanıcının güncel bölge, takım ve firma kapsamı
 * @param periyot Periyot + tarih bilgisi (ay/donem/yil/hafta)
 * @throws Hata mesajı string olarak fırlatır; çağıran endpoint hataYaniti ile sarar
 */
export async function getUttLig(
  supabase: SupabaseClient,
  kullanici_id: string,
  organizasyon: UttOrganizasyonKapsami,
  periyot: LigPeriyot,
  simdi: Date = new Date(),
): Promise<UttLigSonuc> {
  const aktif = aktifPeriyot(simdi);
  // Kürsü her ayın 1'inde bir önceki ayın ilk 3'ünü gösterir
  const buAy: LigPeriyot = { periyot: "ay", ...aktif };
  const oncekiAy = oncekiLigPeriyodu(buAy);
  const ikiOncekiAy = oncekiLigPeriyodu(oncekiAy);

  const [tumUttler, oncekiAyUttleri, ikiOncekiAyUttleri] = await Promise.all([
    ligRpcCagir(supabase, periyot),
    ligRpcCagir(supabase, oncekiAy),
    ligRpcCagir(supabase, ikiOncekiAy),
  ]);

  const tumKullaniciIdler = Array.from(
    new Set([
      ...tumUttler,
      ...oncekiAyUttleri,
      ...ikiOncekiAyUttleri,
    ].map((satir) => satir.kullanici_id))
  );
  let fotoMap = new Map<string, string | null>();
  if (tumKullaniciIdler.length > 0 && typeof supabase.from === "function") {
    const { data: fotolar } = await supabase
      .from("kullanicilar")
      .select("kullanici_id, fotograf_url")
      .in("kullanici_id", tumKullaniciIdler);
    if (fotolar) {
      fotoMap = new Map(fotolar.map((f) => [f.kullanici_id, f.fotograf_url]));
    }
  }

  const bolgeKapsami = (satir: Awaited<ReturnType<typeof ligRpcCagir>>[number]) => satir.bolge_id === organizasyon.bolge_id;
  const takimId = organizasyon.takim_id;
  const firmaId = organizasyon.firma_id;
  const takimKapsami = (satir: Awaited<ReturnType<typeof ligRpcCagir>>[number]) => Boolean(takimId) && satir.takim_id === takimId;
  const sirketKapsami = (satir: Awaited<ReturnType<typeof ligRpcCagir>>[number]) => Boolean(firmaId) && satir.firma_id === firmaId;

  const lig = ligOlustur(tumUttler, kullanici_id, bolgeKapsami, false, fotoMap);
  const seciliDonemTakimLigi = ligOlustur(tumUttler, kullanici_id, takimKapsami, false, fotoMap);
  const seciliDonemFirmaLigi = ligOlustur(tumUttler, kullanici_id, sirketKapsami, false, fotoMap);

  // Bir önceki tamamlanan ayın kürsü ligleri ve sıralama değişimleri
  const oncekiAyBolgeLigi = ligOlustur(oncekiAyUttleri, kullanici_id, bolgeKapsami, true, fotoMap);
  const ikiOncekiAyBolgeLigi = ligOlustur(ikiOncekiAyUttleri, kullanici_id, bolgeKapsami, true, fotoMap);
  const oncekiAyTakimLigi = ligOlustur(oncekiAyUttleri, kullanici_id, takimKapsami, true, fotoMap);
  const ikiOncekiAyTakimLigi = ligOlustur(ikiOncekiAyUttleri, kullanici_id, takimKapsami, true, fotoMap);
  const oncekiAySirketLigi = ligOlustur(oncekiAyUttleri, kullanici_id, sirketKapsami, true, fotoMap);
  const ikiOncekiAySirketLigi = ligOlustur(ikiOncekiAyUttleri, kullanici_id, sirketKapsami, true, fotoMap);

  const ikiOncekiBolgeSiralar = new Map(ikiOncekiAyBolgeLigi.map((satir) => [satir.kullanici_id, satir.sira]));
  const aylik_bolge_top3: UttKursuSatiri[] = oncekiAyBolgeLigi.slice(0, 3).map((satir) => {
    const oncekiSira = ikiOncekiBolgeSiralar.get(satir.kullanici_id);
    return {
      ...satir,
      degisim: oncekiSira === undefined ? null : oncekiSira - satir.sira,
    };
  });

  const ikiOncekiTakimSiralar = new Map(ikiOncekiAyTakimLigi.map((satir) => [satir.kullanici_id, satir.sira]));
  const aylik_takim_top3: UttKursuSatiri[] = oncekiAyTakimLigi.slice(0, 3).map((satir) => {
    const oncekiSira = ikiOncekiTakimSiralar.get(satir.kullanici_id);
    return {
      ...satir,
      degisim: oncekiSira === undefined ? null : oncekiSira - satir.sira,
    };
  });

  const ikiOncekiSirketSiralar = new Map(ikiOncekiAySirketLigi.map((satir) => [satir.kullanici_id, satir.sira]));
  const aylik_sirket_top3: UttKursuSatiri[] = oncekiAySirketLigi.slice(0, 3).map((satir) => {
    const oncekiSira = ikiOncekiSirketSiralar.get(satir.kullanici_id);
    return {
      ...satir,
      degisim: oncekiSira === undefined ? null : oncekiSira - satir.sira,
    };
  });

  const aylik_kursu: UttAylikKursu = {
    ay: oncekiAy.ay,
    yil: oncekiAy.yil,
    ay_adi: AY_ADLARI[oncekiAy.ay - 1] ?? `${oncekiAy.ay}. Ay`,
    bolge_top3: uttListesiniSinirla(aylik_bolge_top3, kullanici_id),
    takim_top3: uttListesiniSinirla(aylik_takim_top3, kullanici_id),
    sirket_top3: uttListesiniSinirla(aylik_sirket_top3, kullanici_id),
  };

  const sinirliBolgeLigi = uttListesiniSinirla(lig, kullanici_id);

  return {
    tip: "utt",
    lig: sinirliBolgeLigi,
    ligler: {
      bolge: sinirliBolgeLigi,
      takim: uttListesiniSinirla(seciliDonemTakimLigi, kullanici_id),
      firma: uttListesiniSinirla(seciliDonemFirmaLigi, kullanici_id),
    },
    aylik_kursu,
  };
}
