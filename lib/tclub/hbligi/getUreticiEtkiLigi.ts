import type { SupabaseClient } from "@supabase/supabase-js";
import type { LigPeriyot } from "@/lib/tclub/hbligi/ligRpcCagir";
import type { SahaLigKullanici, SahaLigSonuc } from "@/lib/tclub/hbligi/getSahaLig";
import { TUKETICI_ROLLER } from "@/lib/utils/roller";

type KazanimSatiri = {
  kullanici_id: string;
  puan_turu: string;
  puan: number;
};

type KayipSatiri = {
  kullanici_id: string;
  kaybedilen_puan: number;
};

type EtkilesimSatiri = {
  aktor_id: string;
  yayin_id: string;
  adet: number;
};

type SorguYaniti<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

const SAYFA_BOYUTU = 1000;
const YAYIN_PARCA_BOYUTU = 100;

async function tumSayfalariOku<T>(
  sorgu: (baslangic: number, bitis: number) => PromiseLike<SorguYaniti<T>>,
): Promise<T[]> {
  const tumu: T[] = [];
  for (let baslangic = 0; ; baslangic += SAYFA_BOYUTU) {
    const yanit = await sorgu(baslangic, baslangic + SAYFA_BOYUTU - 1);
    if (yanit.error) throw new Error(yanit.error.message);
    const sayfa = yanit.data ?? [];
    tumu.push(...sayfa);
    if (sayfa.length < SAYFA_BOYUTU) return tumu;
  }
}

function parcalaraAyir<T>(degerler: T[], boyut: number): T[][] {
  const parcalar: T[][] = [];
  for (let i = 0; i < degerler.length; i += boyut) parcalar.push(degerler.slice(i, i + boyut));
  return parcalar;
}

function tarihMetni(tarih: Date): string {
  const yil = tarih.getUTCFullYear();
  const ay = String(tarih.getUTCMonth() + 1).padStart(2, "0");
  const gun = String(tarih.getUTCDate()).padStart(2, "0");
  return `${yil}-${ay}-${gun}T00:00:00+03:00`;
}

function periyotAraligi(periyot: LigPeriyot): { baslangic: string; bitis: string } {
  let baslangic: Date;
  let bitis: Date;

  if (periyot.periyot === "ay") {
    baslangic = new Date(Date.UTC(periyot.yil, periyot.ay - 1, 1));
    bitis = new Date(Date.UTC(periyot.yil, periyot.ay, 1));
  } else if (periyot.periyot === "donem") {
    const ilkAy = (periyot.ceyrek - 1) * 3;
    baslangic = new Date(Date.UTC(periyot.yil, ilkAy, 1));
    bitis = new Date(Date.UTC(periyot.yil, ilkAy + 3, 1));
  } else if (periyot.periyot === "yil") {
    baslangic = new Date(Date.UTC(periyot.yil, 0, 1));
    bitis = new Date(Date.UTC(periyot.yil + 1, 0, 1));
  } else {
    const yilBasi = new Date(Date.UTC(periyot.yil, 0, 1));
    const pazartesiyeFark = (yilBasi.getUTCDay() + 6) % 7;
    baslangic = new Date(yilBasi);
    baslangic.setUTCDate(yilBasi.getUTCDate() - pazartesiyeFark + (periyot.hafta - 1) * 7);
    bitis = new Date(baslangic);
    bitis.setUTCDate(baslangic.getUTCDate() + 7);
  }

  return { baslangic: tarihMetni(baslangic), bitis: tarihMetni(bitis) };
}

function bosEtkiSatiri(satir: SahaLigKullanici): SahaLigKullanici {
  return {
    ...satir,
    izleme_puani: 0,
    cevaplama_puani: 0,
    oneri_puani: 0,
    extra_puani: 0,
    eclub_puani: 0,
    ileri_sarma_kaybi: 0,
    yanlis_cevap_kaybi: 0,
    oneri_kaybi: 0,
    toplam_puan: 0,
    etkilesim_sayisi: 0,
    etkilesilen_yayin_sayisi: 0,
  };
}

function genelSiralar(satirlar: SahaLigKullanici[]): Map<string, number> {
  const puanSirasi = new Map(
    [...new Set(satirlar.map((satir) => satir.toplam_puan))]
      .sort((a, b) => b - a)
      .map((puan, index) => [puan, index + 1]),
  );
  return new Map(satirlar.map((satir) => [satir.kullanici_id, puanSirasi.get(satir.toplam_puan) ?? 0]));
}

export async function getUreticiEtkiLigi(
  db: SupabaseClient,
  genelLig: SahaLigSonuc,
  ureticiId: string,
  periyot: LigPeriyot,
): Promise<SahaLigSonuc> {
  const { baslangic, bitis } = periyotAraligi(periyot);
  const yayinSatirlari = await tumSayfalariOku<{ yayin_id: string }>((ilk, son) =>
    db.from("v_yayin_kunye")
      .select("yayin_id")
      .eq("uretici_id", ureticiId)
      .range(ilk, son),
  );
  const yayinIds = [...new Set(yayinSatirlari.map((satir) => satir.yayin_id))];
  const siralar = genelSiralar(genelLig.lig);
  const etkiLig = genelLig.lig.map((satir) => ({ ...bosEtkiSatiri(satir), genel_sira: siralar.get(satir.kullanici_id) }));

  if (yayinIds.length === 0) {
    return {
      ...genelLig,
      bakis: "yayinlarim",
      kapsam_aciklamasi: "Yayınlarınızın sahada oluşturduğu UTT sıralaması",
      lig: etkiLig,
    };
  }

  const parcalar = parcalaraAyir(yayinIds, YAYIN_PARCA_BOYUTU);
  const [kazanimlar, ileriSarma, yanlisCevap, oneriKaybi, etkilesimler] = await Promise.all([
    Promise.all(parcalar.map((ids) => tumSayfalariOku<KazanimSatiri>((ilk, son) =>
      db.from("kazanilan_puanlar")
        .select("kullanici_id,puan_turu,puan")
        .in("yayin_id", ids)
        .gte("created_at", baslangic)
        .lt("created_at", bitis)
        .range(ilk, son),
    ))).then((sonuclar) => sonuclar.flat()),
    Promise.all(parcalar.map((ids) => tumSayfalariOku<KayipSatiri>((ilk, son) =>
      db.from("ileri_sarma_kayitlari")
        .select("kullanici_id,kaybedilen_puan")
        .in("yayin_id", ids)
        .gte("created_at", baslangic)
        .lt("created_at", bitis)
        .range(ilk, son),
    ))).then((sonuclar) => sonuclar.flat()),
    Promise.all(parcalar.map((ids) => tumSayfalariOku<KayipSatiri>((ilk, son) =>
      db.from("yanlis_cevap_kayitlari")
        .select("kullanici_id,kaybedilen_puan")
        .in("yayin_id", ids)
        .gte("created_at", baslangic)
        .lt("created_at", bitis)
        .range(ilk, son),
    ))).then((sonuclar) => sonuclar.flat()),
    Promise.all(parcalar.map((ids) => tumSayfalariOku<KayipSatiri>((ilk, son) =>
      db.from("oneri_kayip_kayitlari")
        .select("kullanici_id,kaybedilen_puan")
        .in("yayin_id", ids)
        .gte("created_at", baslangic)
        .lt("created_at", bitis)
        .range(ilk, son),
    ))).then((sonuclar) => sonuclar.flat()),
    Promise.all(parcalar.map((ids) => tumSayfalariOku<EtkilesimSatiri>((ilk, son) =>
      db.from("v_rapor_arac_turu_olaylari")
        .select("aktor_id,yayin_id,adet")
        .in("yayin_id", ids)
        .in("rol", [...TUKETICI_ROLLER])
        .gte("olay_tarihi", baslangic)
        .lt("olay_tarihi", bitis)
        .range(ilk, son),
    ))).then((sonuclar) => sonuclar.flat()),
  ]);

  const satirMap = new Map(etkiLig.map((satir) => [satir.kullanici_id, satir]));
  for (const kazanim of kazanimlar) {
    const satir = satirMap.get(kazanim.kullanici_id);
    if (!satir) continue;
    const puan = Number(kazanim.puan ?? 0);
    if (kazanim.puan_turu === "izleme") satir.izleme_puani += puan;
    else if (kazanim.puan_turu === "cevaplama") satir.cevaplama_puani += puan;
    else if (kazanim.puan_turu === "oneri") satir.oneri_puani += puan;
    else if (kazanim.puan_turu === "extra") satir.extra_puani += puan;
    else if (kazanim.puan_turu === "eclub") satir.eclub_puani = (satir.eclub_puani ?? 0) + puan;
  }
  for (const kayip of ileriSarma) {
    const satir = satirMap.get(kayip.kullanici_id);
    if (satir) satir.ileri_sarma_kaybi += Number(kayip.kaybedilen_puan ?? 0);
  }
  for (const kayip of yanlisCevap) {
    const satir = satirMap.get(kayip.kullanici_id);
    if (satir) satir.yanlis_cevap_kaybi += Number(kayip.kaybedilen_puan ?? 0);
  }
  for (const kayip of oneriKaybi) {
    const satir = satirMap.get(kayip.kullanici_id);
    if (satir) satir.oneri_kaybi += Number(kayip.kaybedilen_puan ?? 0);
  }

  const yayinSetleri = new Map<string, Set<string>>();
  for (const etkilesim of etkilesimler) {
    const satir = satirMap.get(etkilesim.aktor_id);
    if (!satir) continue;
    satir.etkilesim_sayisi = (satir.etkilesim_sayisi ?? 0) + Number(etkilesim.adet ?? 0);
    const set = yayinSetleri.get(etkilesim.aktor_id) ?? new Set<string>();
    set.add(etkilesim.yayin_id);
    yayinSetleri.set(etkilesim.aktor_id, set);
  }

  for (const satir of etkiLig) {
    satir.etkilesilen_yayin_sayisi = yayinSetleri.get(satir.kullanici_id)?.size ?? 0;
    const kazanc = satir.izleme_puani + satir.cevaplama_puani + satir.oneri_puani
      + satir.extra_puani + (satir.eclub_puani ?? 0);
    const kayip = satir.ileri_sarma_kaybi + satir.yanlis_cevap_kaybi + satir.oneri_kaybi;
    satir.toplam_puan = kazanc - kayip;
  }

  return {
    ...genelLig,
    bakis: "yayinlarim",
    kapsam_aciklamasi: "Yayınlarınızın sahada oluşturduğu UTT sıralaması",
    lig: etkiLig,
  };
}
