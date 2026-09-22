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
  benim: boolean;
}

export interface UttHaftalikKonumSatiri extends UttLigSatiri {
  degisim: number | null;
}

export interface UttHaftalikKonumOzeti {
  sira: number | null;
  toplam: number;
  degisim: number | null;
}

export interface UttHaftalikKonum {
  bolge: UttHaftalikKonumOzeti;
  takim: UttHaftalikKonumOzeti;
  sirket: UttHaftalikKonumOzeti;
  bolge_ligi: UttHaftalikKonumSatiri[];
  takim_ligi: UttHaftalikKonumSatiri[];
  sirket_ligi: UttHaftalikKonumSatiri[];
}

export const AY_ADLARI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

export interface UttAylikKursu {
  ay: number;
  yil: number;
  ay_adi: string;
  bolge_top3: UttHaftalikKonumSatiri[];
  takim_top3: UttHaftalikKonumSatiri[];
  sirket_top3: UttHaftalikKonumSatiri[];
}

export interface UttLigSonuc {
  tip: "utt";
  lig: UttLigSatiri[];
  haftalik_konum: UttHaftalikKonum;
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

function konumOzeti(
  mevcutLig: UttLigSatiri[],
  oncekiLig: UttLigSatiri[],
  kullanici_id: string,
): UttHaftalikKonumOzeti {
  const mevcut = mevcutLig.find((satir) => satir.kullanici_id === kullanici_id);
  const onceki = oncekiLig.find((satir) => satir.kullanici_id === kullanici_id);
  return {
    sira: mevcut?.sira ?? null,
    toplam: mevcutLig.length,
    degisim: mevcut && onceki ? onceki.sira - mevcut.sira : null,
  };
}

/**
 * UTT/KD_UTT için kendi bölgesindeki UTT lig sıralamasını döner.
 *
 * @param supabase Admin client
 * @param kullanici_id Giriş yapan kullanıcının ID'si
 * @param bolge_id Kullanıcının bölgesi
 * @param periyot Periyot + tarih bilgisi (ay/donem/yil/hafta)
 * @throws Hata mesajı string olarak fırlatır; çağıran endpoint hataYaniti ile sarar
 */
export async function getUttLig(
  supabase: SupabaseClient,
  kullanici_id: string,
  bolge_id: string,
  periyot: LigPeriyot,
  simdi: Date = new Date(),
): Promise<UttLigSonuc> {
  const aktif = aktifPeriyot(simdi);
  const buHafta: LigPeriyot = { periyot: "hafta", ...aktif };
  const oncekiHafta = oncekiLigPeriyodu(buHafta);

  // Kürsü her ayın 1'inde bir önceki ayın ilk 3'ünü gösterir
  const buAy: LigPeriyot = { periyot: "ay", ...aktif };
  const oncekiAy = oncekiLigPeriyodu(buAy);
  const ikiOncekiAy = oncekiLigPeriyodu(oncekiAy);

  const [tumUttler, buHaftaUttleri, oncekiHaftaUttleri, oncekiAyUttleri, ikiOncekiAyUttleri] = await Promise.all([
    ligRpcCagir(supabase, periyot),
    ligRpcCagir(supabase, buHafta),
    ligRpcCagir(supabase, oncekiHafta),
    ligRpcCagir(supabase, oncekiAy),
    ligRpcCagir(supabase, ikiOncekiAy),
  ]);

  const tumKullaniciIdler = Array.from(
    new Set([
      ...tumUttler,
      ...buHaftaUttleri,
      ...oncekiHaftaUttleri,
      ...oncekiAyUttleri,
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

  const bolgeKapsami = (satir: Awaited<ReturnType<typeof ligRpcCagir>>[number]) => satir.bolge_id === bolge_id;
  const kullaniciSatiri = buHaftaUttleri.find((satir) => satir.kullanici_id === kullanici_id)
    ?? tumUttler.find((satir) => satir.kullanici_id === kullanici_id);
  const takimId = kullaniciSatiri?.takim_id;
  const firmaId = kullaniciSatiri?.firma_id;
  const takimKapsami = (satir: Awaited<ReturnType<typeof ligRpcCagir>>[number]) => Boolean(takimId) && satir.takim_id === takimId;
  const sirketKapsami = (satir: Awaited<ReturnType<typeof ligRpcCagir>>[number]) => Boolean(firmaId) && satir.firma_id === firmaId;

  const lig = ligOlustur(tumUttler, kullanici_id, bolgeKapsami, false, fotoMap);
  const bolgeLigi = ligOlustur(buHaftaUttleri, kullanici_id, bolgeKapsami, true, fotoMap);
  const oncekiBolgeLigi = ligOlustur(oncekiHaftaUttleri, kullanici_id, bolgeKapsami, true, fotoMap);
  const takimLigi = ligOlustur(buHaftaUttleri, kullanici_id, takimKapsami, true, fotoMap);
  const oncekiTakimLigi = ligOlustur(oncekiHaftaUttleri, kullanici_id, takimKapsami, true, fotoMap);
  const sirketLigi = ligOlustur(buHaftaUttleri, kullanici_id, sirketKapsami, true, fotoMap);
  const oncekiSirketLigi = ligOlustur(oncekiHaftaUttleri, kullanici_id, sirketKapsami, true, fotoMap);

  const oncekiBolgeSiralar = new Map(oncekiBolgeLigi.map((satir) => [satir.kullanici_id, satir.sira]));
  const bolge_ligi = bolgeLigi.map((satir): UttHaftalikKonumSatiri => {
    const oncekiSira = oncekiBolgeSiralar.get(satir.kullanici_id);
    return {
      ...satir,
      degisim: oncekiSira === undefined ? null : oncekiSira - satir.sira,
    };
  });

  const oncekiTakimSiralar = new Map(oncekiTakimLigi.map((satir) => [satir.kullanici_id, satir.sira]));
  const takim_ligi = takimLigi.map((satir): UttHaftalikKonumSatiri => {
    const oncekiSira = oncekiTakimSiralar.get(satir.kullanici_id);
    return {
      ...satir,
      degisim: oncekiSira === undefined ? null : oncekiSira - satir.sira,
    };
  });

  const oncekiSirketSiralar = new Map(oncekiSirketLigi.map((satir) => [satir.kullanici_id, satir.sira]));
  const sirket_ligi = sirketLigi.map((satir): UttHaftalikKonumSatiri => {
    const oncekiSira = oncekiSirketSiralar.get(satir.kullanici_id);
    return {
      ...satir,
      degisim: oncekiSira === undefined ? null : oncekiSira - satir.sira,
    };
  });

  const haftalik_konum: UttHaftalikKonum = {
    bolge: konumOzeti(bolgeLigi, oncekiBolgeLigi, kullanici_id),
    takim: konumOzeti(takimLigi, oncekiTakimLigi, kullanici_id),
    sirket: konumOzeti(sirketLigi, oncekiSirketLigi, kullanici_id),
    bolge_ligi,
    takim_ligi,
    sirket_ligi,
  };

  // Bir önceki tamamlanan ayın kürsü ligleri ve sıralama değişimleri
  const oncekiAyBolgeLigi = ligOlustur(oncekiAyUttleri, kullanici_id, bolgeKapsami, true, fotoMap);
  const ikiOncekiAyBolgeLigi = ligOlustur(ikiOncekiAyUttleri, kullanici_id, bolgeKapsami, true, fotoMap);
  const oncekiAyTakimLigi = ligOlustur(oncekiAyUttleri, kullanici_id, takimKapsami, true, fotoMap);
  const ikiOncekiAyTakimLigi = ligOlustur(ikiOncekiAyUttleri, kullanici_id, takimKapsami, true, fotoMap);
  const oncekiAySirketLigi = ligOlustur(oncekiAyUttleri, kullanici_id, sirketKapsami, true, fotoMap);
  const ikiOncekiAySirketLigi = ligOlustur(ikiOncekiAyUttleri, kullanici_id, sirketKapsami, true, fotoMap);

  const ikiOncekiBolgeSiralar = new Map(ikiOncekiAyBolgeLigi.map((satir) => [satir.kullanici_id, satir.sira]));
  const aylik_bolge_top3: UttHaftalikKonumSatiri[] = oncekiAyBolgeLigi.slice(0, 3).map((satir) => {
    const oncekiSira = ikiOncekiBolgeSiralar.get(satir.kullanici_id);
    return {
      ...satir,
      degisim: oncekiSira === undefined ? null : oncekiSira - satir.sira,
    };
  });

  const ikiOncekiTakimSiralar = new Map(ikiOncekiAyTakimLigi.map((satir) => [satir.kullanici_id, satir.sira]));
  const aylik_takim_top3: UttHaftalikKonumSatiri[] = oncekiAyTakimLigi.slice(0, 3).map((satir) => {
    const oncekiSira = ikiOncekiTakimSiralar.get(satir.kullanici_id);
    return {
      ...satir,
      degisim: oncekiSira === undefined ? null : oncekiSira - satir.sira,
    };
  });

  const ikiOncekiSirketSiralar = new Map(ikiOncekiAySirketLigi.map((satir) => [satir.kullanici_id, satir.sira]));
  const aylik_sirket_top3: UttHaftalikKonumSatiri[] = oncekiAySirketLigi.slice(0, 3).map((satir) => {
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
    bolge_top3: aylik_bolge_top3,
    takim_top3: aylik_takim_top3,
    sirket_top3: aylik_sirket_top3,
  };

  return { tip: "utt", lig, haftalik_konum, aylik_kursu };
}
