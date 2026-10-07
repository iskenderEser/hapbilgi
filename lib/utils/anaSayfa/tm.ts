// TM ana sayfa stat kartları — takım kapsamında zaman ve araç türü filtreli özet.

import type { SupabaseClient } from "@supabase/supabase-js";
import { tarihAraligi } from "@/lib/utils/tarihAraligi";

import { TUKETICI_ROLLER } from "@/lib/utils/roller";
import { OGRENME_ARACI_TURLERI, type OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";
import { PERIYOTLAR, type Periyot } from "@/lib/utils/raporUtils";

export interface TmStatSecimi {
  periyot: Periyot;
  aracTuru: "tumu" | OgrenmeAraciTuru;
}

export interface TmStatIstatistikleri {
  toplam_utt: number;
  ogrenmeye_katilan_utt: number;
  katilim_yuzdesi: number | null;
  tamamlanan_ogrenme: number;
  toplam_oneri: number;
  tamamlanan_oneri: number;
  bekleyen_oneri: number;
  suresi_gecmis_oneri: number;
  kazanilan_puan: number;
  kaybedilen_puan: number;
  net_saha_puani: number;
}

interface TmStatOnerisi {
  oneren_id: string;
  kullanici_id: string;
  yayin_id: string;
  izlendi_mi: boolean | null;
  oneri_bitis: string;
}

interface TmStatPuanKaydi {
  yayin_id: string;
  puan: number;
}

interface TmStatKayipKaydi {
  yayin_id: string;
  kaybedilen_puan: number;
}

interface TmStatPuanOzeti {
  kullanici_id: string;
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  extra_puan: number;
  eclub_puani: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  toplam_net_puan: number;
}

const TM_STAT_KAZANIM_TURLERI = ["izleme", "cevaplama", "oneri", "extra", "eclub"];
const TM_STAT_SAYFA_BOYUTU = 500;
const TM_STAT_KIMLIK_PAKETI = 200;

async function tmStatSayfalariOku<T>(
  oku: (ilk: number, son: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const satirlar: T[] = [];
  for (let ilk = 0; ; ilk += TM_STAT_SAYFA_BOYUTU) {
    const { data, error } = await oku(ilk, ilk + TM_STAT_SAYFA_BOYUTU - 1);
    if (error) throw new Error(`TM istatistikleri alınamadı: ${error.message}`);
    if (!Array.isArray(data)) throw new Error("TM istatistik verisi eksik.");
    satirlar.push(...data);
    if (data.length < TM_STAT_SAYFA_BOYUTU) return satirlar;
  }
}

async function tmStatKapsamKayitlariOku<T>(
  kimlikler: string[],
  oku: (kimlikler: string[], ilk: number, son: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const satirlar: T[] = [];
  for (let ilk = 0; ilk < kimlikler.length; ilk += TM_STAT_KIMLIK_PAKETI) {
    const paket = kimlikler.slice(ilk, ilk + TM_STAT_KIMLIK_PAKETI);
    satirlar.push(...await tmStatSayfalariOku((baslangic, bitis) => oku(paket, baslangic, bitis)));
  }
  return satirlar;
}

function tmStatSayisi(deger: number): number {
  if (!Number.isSafeInteger(deger)) throw new Error("TM istatistiklerinde geçerli sayısal veri alınamadı.");
  return deger;
}

/**
 * TM kartlarının takım kapsamında zaman ve yayın türü filtreli okuma sözleşmesi.
 * Modül bayrakları kart hesabına katılmaz.
 */
export async function getTmAnaSayfaIstatistikleri(
  userId: string,
  admin: SupabaseClient,
  secim: TmStatSecimi = { periyot: "bu_hafta", aracTuru: "tumu" },
): Promise<{ istatistikler: TmStatIstatistikleri; secim: TmStatSecimi; baslangic: string; bitis: string }> {
  if (!PERIYOTLAR.some((periyot) => periyot.key === secim.periyot)
    || (secim.aracTuru !== "tumu" && !OGRENME_ARACI_TURLERI.includes(secim.aracTuru))) {
    throw new Error("Geçersiz TM istatistik seçimi.");
  }
  const { baslangic, bitis } = tarihAraligi(secim.periyot);
  const { data: tm, error: tmHatasi } = await admin.from("kullanicilar")
    .select("firma_id, takim_id").eq("kullanici_id", userId)
    .eq("rol", "tm").eq("aktif_mi", true).single();
  if (tmHatasi || !tm?.firma_id || !tm.takim_id) throw new Error("TM takım kapsamı alınamadı.");

  const [uttler, bmler] = await Promise.all([
    tmStatSayfalariOku((ilk, son) => admin.from("kullanicilar")
      .select("kullanici_id, bolge_id").eq("firma_id", tm.firma_id).eq("takim_id", tm.takim_id)
      .in("rol", TUKETICI_ROLLER).eq("aktif_mi", true)
      .order("kullanici_id").range(ilk, son).returns<{ kullanici_id: string; bolge_id: string | null }[]>()),
    tmStatSayfalariOku((ilk, son) => admin.from("kullanicilar")
      .select("kullanici_id, bolge_id").eq("firma_id", tm.firma_id).eq("takim_id", tm.takim_id)
      .eq("rol", "bm").eq("aktif_mi", true)
      .order("kullanici_id").range(ilk, son).returns<{ kullanici_id: string; bolge_id: string | null }[]>()),
  ]);
  const uttBolgeleri = new Map(uttler.map((utt) => [utt.kullanici_id, utt.bolge_id]));
  const bmBolgeleri = new Map(bmler.filter((bm) => bm.bolge_id).map((bm) => [bm.kullanici_id, bm.bolge_id]));
  const bmIdler = [...bmBolgeleri.keys()];
  const uttIdler = [...new Set(uttler.map((utt) => utt.kullanici_id))];
  const istatistikler: TmStatIstatistikleri = {
    toplam_utt: uttIdler.length, ogrenmeye_katilan_utt: 0,
    katilim_yuzdesi: uttIdler.length ? 0 : null, tamamlanan_ogrenme: 0,
    toplam_oneri: 0, tamamlanan_oneri: 0, bekleyen_oneri: 0, suresi_gecmis_oneri: 0,
    kazanilan_puan: 0, kaybedilen_puan: 0, net_saha_puani: 0,
  };
  const yanit = { istatistikler, secim, baslangic, bitis };
  if (!uttIdler.length) return yanit;

  // Eski kayıtlar için rapor SQL'indeki COALESCE tarih sırası da korunur.
  const tamamlanmaTarihi = [
    `and(izleme_bitis.gte.${baslangic},izleme_bitis.lte.${bitis})`,
    `and(izleme_bitis.is.null,created_at.gte.${baslangic},created_at.lte.${bitis})`,
    `and(izleme_bitis.is.null,created_at.is.null,izleme_baslangic.gte.${baslangic},izleme_baslangic.lte.${bitis})`,
  ].join(",");
  const [izlemeler, oneriler] = await Promise.all([
    tmStatKapsamKayitlariOku(uttIdler, (ids, ilk, son) => {
      let sorgu = admin.from("izleme_kayitlari").select("izleme_id, kullanici_id")
        .in("kullanici_id", ids).eq("tamamlandi_mi", true).eq("gercek_oynatma_mi", true)
        .or(tamamlanmaTarihi);
      if (secim.aracTuru !== "tumu") sorgu = sorgu.eq("arac_turu", secim.aracTuru);
      return sorgu.order("izleme_id").range(ilk, son)
        .returns<{ izleme_id: string; kullanici_id: string }[]>();
    }),
    (async () => {
      const satirlar: TmStatOnerisi[] = [];
      // Her iki kimlik listesi de paketlenir; aynı bölgedeki birden çok BM
      // kendi önerileriyle sayılır, UTT öğrenme kayıtları ise tekilleştirilir.
      for (let ilkBm = 0; ilkBm < bmIdler.length; ilkBm += TM_STAT_KIMLIK_PAKETI) {
        const bmPaketi = bmIdler.slice(ilkBm, ilkBm + TM_STAT_KIMLIK_PAKETI);
        satirlar.push(...await tmStatKapsamKayitlariOku(uttIdler, (ids, ilk, son) => admin.from("oneri_kayitlari")
          .select("oneren_id, kullanici_id, yayin_id, izlendi_mi, oneri_bitis")
          .in("oneren_id", bmPaketi).in("kullanici_id", ids)
          .gte("created_at", baslangic).lte("created_at", bitis)
          .order("oneri_id").range(ilk, son).returns<TmStatOnerisi[]>()));
      }
      return satirlar.filter((oneri) => bmBolgeleri.get(oneri.oneren_id) === uttBolgeleri.get(oneri.kullanici_id));
    })(),
  ]);
  istatistikler.ogrenmeye_katilan_utt = new Set(izlemeler.map((izleme) => izleme.kullanici_id)).size;
  istatistikler.tamamlanan_ogrenme = new Set(izlemeler.map((izleme) => izleme.izleme_id)).size;
  istatistikler.katilim_yuzdesi = Math.round(100 * istatistikler.ogrenmeye_katilan_utt / uttIdler.length);

  let yayinTuruHaritasi: Map<string, OgrenmeAraciTuru> | null = null;
  if (secim.aracTuru === "tumu") {
    // Tümü seçimi mevcut puan motorunun kanonik özetini kullanır.
    const ozetler = await tmStatSayfalariOku<TmStatPuanOzeti>(async (ilk, son) => {
      const { data, error } = await admin.rpc("get_kullanici_ozet", {
        p_baslangic: baslangic, p_bitis: bitis,
        p_takim_id: tm.takim_id, p_firma_id: tm.firma_id,
      }).order("kullanici_id").range(ilk, son);
      return { data: Array.isArray(data) ? data as TmStatPuanOzeti[] : null, error };
    });
    const kapsam = new Set(uttIdler);
    const okunanlar = new Set<string>();
    for (const ozet of ozetler) {
      if (!kapsam.has(ozet.kullanici_id) || okunanlar.has(ozet.kullanici_id)) throw new Error("TM puan özeti takım kapsamıyla eşleşmiyor.");
      okunanlar.add(ozet.kullanici_id);
      const kazanilan = [ozet.video_puani, ozet.soru_puani, ozet.oneri_puani, ozet.extra_puan, ozet.eclub_puani]
        .reduce((toplam, puan) => tmStatSayisi(toplam + tmStatSayisi(puan)), 0);
      const kaybedilen = [ozet.ileri_sarma_kaybi, ozet.yanlis_cevap_kaybi, ozet.oneri_kaybi]
        .reduce((toplam, puan) => tmStatSayisi(toplam + tmStatSayisi(puan)), 0);
      if (tmStatSayisi(ozet.toplam_net_puan) !== kazanilan - kaybedilen) throw new Error("TM net puan özeti tutarsız.");
      istatistikler.kazanilan_puan = tmStatSayisi(istatistikler.kazanilan_puan + kazanilan);
      istatistikler.kaybedilen_puan = tmStatSayisi(istatistikler.kaybedilen_puan + kaybedilen);
    }
    if (okunanlar.size !== kapsam.size) throw new Error("TM puan özeti eksik.");
  } else {
    // Araç filtresi olmayan RPC yerine aynı SQL sözleşmesinin kaynak kayıtları
    // yayın kimliği üzerinden süzülür. Kişisel C-Club tabloları okunmaz.
    const puanOku = (tablo: string, sahipAlani: string, kimlikAlani: string) =>
      tmStatKapsamKayitlariOku(uttIdler, (ids, ilk, son) => {
        let sorgu = admin.from(tablo).select("yayin_id, puan").in(sahipAlani, ids)
          .gte("created_at", baslangic).lte("created_at", bitis);
        if (tablo === "kazanilan_puanlar") sorgu = sorgu.in("puan_turu", TM_STAT_KAZANIM_TURLERI);
        return sorgu.order(kimlikAlani).range(ilk, son).returns<TmStatPuanKaydi[]>();
      });
    const kayipOku = (tablo: string, kimlikAlani: string) =>
      tmStatKapsamKayitlariOku(uttIdler, (ids, ilk, son) => admin.from(tablo)
        .select("yayin_id, kaybedilen_puan").in("kullanici_id", ids)
        .gte("created_at", baslangic).lte("created_at", bitis)
        .order(kimlikAlani).range(ilk, son).returns<TmStatKayipKaydi[]>());
    const [kazanimlar, eclubKazanimlari, ileriSarma, yanlisCevap, oneriKaybi] = await Promise.all([
      puanOku("kazanilan_puanlar", "kullanici_id", "kazanilan_puan_id"),
      puanOku("eclub_utt_puanlari", "utt_id", "utt_puan_id"),
      kayipOku("ileri_sarma_kayitlari", "kayit_id"),
      kayipOku("yanlis_cevap_kayitlari", "kayit_id"),
      kayipOku("oneri_kayip_kayitlari", "kayit_id"),
    ]);
    const puanlar = [...kazanimlar, ...eclubKazanimlari];
    const kayiplar = [...ileriSarma, ...yanlisCevap, ...oneriKaybi];
    const yayinIdler = [...new Set([...oneriler, ...puanlar, ...kayiplar].map((kayit) => kayit.yayin_id))];
    const yayinlar = await tmStatKapsamKayitlariOku(yayinIdler, (ids, ilk, son) => admin.from("v_yayin_kunye")
      .select("yayin_id, arac_turu").in("yayin_id", ids).order("yayin_id").range(ilk, son)
      .returns<{ yayin_id: string; arac_turu: OgrenmeAraciTuru }[]>());
    yayinTuruHaritasi = new Map(yayinlar.map((yayin) => [yayin.yayin_id, yayin.arac_turu]));
    for (const id of yayinIdler) {
      const tur = yayinTuruHaritasi.get(id);
      if (!tur || !OGRENME_ARACI_TURLERI.includes(tur)) throw new Error("TM istatistiklerinde yayın türü çözümlenemedi.");
    }
    istatistikler.kazanilan_puan = puanlar.filter((kayit) => yayinTuruHaritasi?.get(kayit.yayin_id) === secim.aracTuru)
      .reduce((toplam, kayit) => tmStatSayisi(toplam + tmStatSayisi(kayit.puan)), 0);
    istatistikler.kaybedilen_puan = kayiplar.filter((kayit) => yayinTuruHaritasi?.get(kayit.yayin_id) === secim.aracTuru)
      .reduce((toplam, kayit) => tmStatSayisi(toplam + tmStatSayisi(kayit.kaybedilen_puan)), 0);
  }

  for (const oneri of oneriler) {
    if (secim.aracTuru !== "tumu" && yayinTuruHaritasi?.get(oneri.yayin_id) !== secim.aracTuru) continue;
    istatistikler.toplam_oneri += 1;
    if (oneri.izlendi_mi) istatistikler.tamamlanan_oneri += 1;
    else {
      const oneriBitis = Date.parse(oneri.oneri_bitis);
      if (!Number.isFinite(oneriBitis)) throw new Error("TM önerisinin bitiş tarihi alınamadı.");
      if (oneriBitis < Date.parse(bitis)) istatistikler.suresi_gecmis_oneri += 1;
      else istatistikler.bekleyen_oneri += 1;
    }
  }
  istatistikler.net_saha_puani = tmStatSayisi(istatistikler.kazanilan_puan - istatistikler.kaybedilen_puan);
  return yanit;
}
