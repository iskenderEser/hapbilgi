import type { SupabaseClient } from "@supabase/supabase-js";
import { TUKETICI_ROLLER } from "@/lib/utils/roller";
import { YAKLASAN_BITIS_SAATI } from "@/lib/tclub/oneri/yaklasanBitis";
import { OGRENME_ARACI_TURLERI, type OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";
import { PERIYOTLAR, type Periyot } from "@/lib/utils/raporUtils";
import { tarihAraligi } from "@/lib/utils/tarihAraligi";

export interface BmStatSecimi {
  periyot: Periyot;
  aracTuru: "tumu" | OgrenmeAraciTuru;
}

export interface BmStatIstatistikleri {
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

interface BmStatOnerisi {
  yayin_id: string;
  izlendi_mi: boolean | null;
  oneri_bitis: string;
}

interface BmStatPuanKaydi {
  yayin_id: string;
  puan: number;
}

interface BmStatKayipKaydi {
  yayin_id: string;
  kaybedilen_puan: number;
}

interface BmStatPuanOzeti {
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

const BM_STAT_KAZANIM_TURLERI = ["izleme", "cevaplama", "oneri", "extra", "eclub"];
const BM_STAT_SAYFA_BOYUTU = 500;
const BM_STAT_KIMLIK_PAKETI = 200;

async function bmStatSayfalariOku<T>(
  oku: (ilk: number, son: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const satirlar: T[] = [];
  for (let ilk = 0; ; ilk += BM_STAT_SAYFA_BOYUTU) {
    const { data, error } = await oku(ilk, ilk + BM_STAT_SAYFA_BOYUTU - 1);
    if (error) throw new Error(`BM istatistikleri alınamadı: ${error.message}`);
    if (!Array.isArray(data)) throw new Error("BM istatistik verisi eksik.");
    satirlar.push(...data);
    if (data.length < BM_STAT_SAYFA_BOYUTU) return satirlar;
  }
}

async function bmStatKapsamKayitlariOku<T>(
  kimlikler: string[],
  oku: (kimlikler: string[], ilk: number, son: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const satirlar: T[] = [];
  for (let ilk = 0; ilk < kimlikler.length; ilk += BM_STAT_KIMLIK_PAKETI) {
    const paket = kimlikler.slice(ilk, ilk + BM_STAT_KIMLIK_PAKETI);
    satirlar.push(...await bmStatSayfalariOku((baslangic, bitis) => oku(paket, baslangic, bitis)));
  }
  return satirlar;
}

function bmStatSayisi(deger: number): number {
  if (!Number.isSafeInteger(deger)) throw new Error("BM istatistiklerinde geçerli sayısal veri alınamadı.");
  return deger;
}

/**
 * BM kartlarının zaman ve yayın türü filtreli okuma sözleşmesi.
 * Modül bayrakları kart hesabına katılmaz.
 */
export async function getBmAnaSayfaIstatistikleri(
  userId: string,
  admin: SupabaseClient,
  secim: BmStatSecimi = { periyot: "bu_hafta", aracTuru: "tumu" },
): Promise<{ istatistikler: BmStatIstatistikleri; secim: BmStatSecimi; baslangic: string; bitis: string }> {
  if (!PERIYOTLAR.some((periyot) => periyot.key === secim.periyot)
    || (secim.aracTuru !== "tumu" && !OGRENME_ARACI_TURLERI.includes(secim.aracTuru))) {
    throw new Error("Geçersiz BM istatistik seçimi.");
  }
  const { baslangic, bitis } = tarihAraligi(secim.periyot);
  const { data: bm, error: bmHatasi } = await admin.from("kullanicilar")
    .select("firma_id, takim_id, bolge_id").eq("kullanici_id", userId)
    .eq("rol", "bm").eq("aktif_mi", true).single();
  if (bmHatasi || !bm?.firma_id || !bm.takim_id || !bm.bolge_id) throw new Error("BM bölge kapsamı alınamadı.");

  const uttler = await bmStatSayfalariOku((ilk, son) => admin.from("kullanicilar")
    .select("kullanici_id").eq("firma_id", bm.firma_id).eq("takim_id", bm.takim_id)
    .eq("bolge_id", bm.bolge_id).in("rol", TUKETICI_ROLLER).eq("aktif_mi", true)
    .order("kullanici_id").range(ilk, son).returns<{ kullanici_id: string }[]>());
  const uttIdler = [...new Set(uttler.map((utt) => utt.kullanici_id))];
  const istatistikler: BmStatIstatistikleri = {
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
    bmStatKapsamKayitlariOku(uttIdler, (ids, ilk, son) => {
      let sorgu = admin.from("izleme_kayitlari").select("izleme_id, kullanici_id")
        .in("kullanici_id", ids).eq("tamamlandi_mi", true).eq("gercek_oynatma_mi", true)
        .or(tamamlanmaTarihi);
      if (secim.aracTuru !== "tumu") sorgu = sorgu.eq("arac_turu", secim.aracTuru);
      return sorgu.order("izleme_id").range(ilk, son)
        .returns<{ izleme_id: string; kullanici_id: string }[]>();
    }),
    bmStatKapsamKayitlariOku(uttIdler, (ids, ilk, son) => admin.from("oneri_kayitlari")
      .select("yayin_id, izlendi_mi, oneri_bitis").eq("oneren_id", userId).in("kullanici_id", ids)
      .gte("created_at", baslangic).lte("created_at", bitis)
      .order("oneri_id").range(ilk, son).returns<BmStatOnerisi[]>()),
  ]);
  istatistikler.ogrenmeye_katilan_utt = new Set(izlemeler.map((izleme) => izleme.kullanici_id)).size;
  istatistikler.tamamlanan_ogrenme = new Set(izlemeler.map((izleme) => izleme.izleme_id)).size;
  istatistikler.katilim_yuzdesi = Math.round(100 * istatistikler.ogrenmeye_katilan_utt / uttIdler.length);

  let yayinTuruHaritasi: Map<string, OgrenmeAraciTuru> | null = null;
  if (secim.aracTuru === "tumu") {
    // Tümü seçimi mevcut puan motorunun kanonik özetini kullanır.
    const ozetler = await bmStatSayfalariOku<BmStatPuanOzeti>(async (ilk, son) => {
      const { data, error } = await admin.rpc("get_kullanici_ozet", {
        p_baslangic: baslangic, p_bitis: bitis, p_bolge_id: bm.bolge_id,
        p_takim_id: bm.takim_id, p_firma_id: bm.firma_id,
      }).order("kullanici_id").range(ilk, son);
      return { data: Array.isArray(data) ? data as BmStatPuanOzeti[] : null, error };
    });
    const kapsam = new Set(uttIdler);
    const okunanlar = new Set<string>();
    for (const ozet of ozetler) {
      if (!kapsam.has(ozet.kullanici_id) || okunanlar.has(ozet.kullanici_id)) throw new Error("BM puan özeti bölge kapsamıyla eşleşmiyor.");
      okunanlar.add(ozet.kullanici_id);
      const kazanilan = [ozet.video_puani, ozet.soru_puani, ozet.oneri_puani, ozet.extra_puan, ozet.eclub_puani]
        .reduce((toplam, puan) => bmStatSayisi(toplam + bmStatSayisi(puan)), 0);
      const kaybedilen = [ozet.ileri_sarma_kaybi, ozet.yanlis_cevap_kaybi, ozet.oneri_kaybi]
        .reduce((toplam, puan) => bmStatSayisi(toplam + bmStatSayisi(puan)), 0);
      if (bmStatSayisi(ozet.toplam_net_puan) !== kazanilan - kaybedilen) throw new Error("BM net puan özeti tutarsız.");
      istatistikler.kazanilan_puan = bmStatSayisi(istatistikler.kazanilan_puan + kazanilan);
      istatistikler.kaybedilen_puan = bmStatSayisi(istatistikler.kaybedilen_puan + kaybedilen);
    }
    if (okunanlar.size !== kapsam.size) throw new Error("BM puan özeti eksik.");
  } else {
    // Araç filtresi olmayan RPC yerine aynı SQL sözleşmesinin kaynak kayıtları
    // yayın kimliği üzerinden süzülür. Kişisel C-Club tabloları okunmaz.
    const puanOku = (tablo: string, sahipAlani: string, kimlikAlani: string) =>
      bmStatKapsamKayitlariOku(uttIdler, (ids, ilk, son) => {
        let sorgu = admin.from(tablo).select("yayin_id, puan").in(sahipAlani, ids)
          .gte("created_at", baslangic).lte("created_at", bitis);
        if (tablo === "kazanilan_puanlar") sorgu = sorgu.in("puan_turu", BM_STAT_KAZANIM_TURLERI);
        return sorgu.order(kimlikAlani).range(ilk, son).returns<BmStatPuanKaydi[]>();
      });
    const kayipOku = (tablo: string, kimlikAlani: string) =>
      bmStatKapsamKayitlariOku(uttIdler, (ids, ilk, son) => admin.from(tablo)
        .select("yayin_id, kaybedilen_puan").in("kullanici_id", ids)
        .gte("created_at", baslangic).lte("created_at", bitis)
        .order(kimlikAlani).range(ilk, son).returns<BmStatKayipKaydi[]>());
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
    const yayinlar = await bmStatKapsamKayitlariOku(yayinIdler, (ids, ilk, son) => admin.from("v_yayin_kunye")
      .select("yayin_id, arac_turu").in("yayin_id", ids).order("yayin_id").range(ilk, son)
      .returns<{ yayin_id: string; arac_turu: OgrenmeAraciTuru }[]>());
    yayinTuruHaritasi = new Map(yayinlar.map((yayin) => [yayin.yayin_id, yayin.arac_turu]));
    for (const id of yayinIdler) {
      const tur = yayinTuruHaritasi.get(id);
      if (!tur || !OGRENME_ARACI_TURLERI.includes(tur)) throw new Error("BM istatistiklerinde yayın türü çözümlenemedi.");
    }
    istatistikler.kazanilan_puan = puanlar.filter((kayit) => yayinTuruHaritasi?.get(kayit.yayin_id) === secim.aracTuru)
      .reduce((toplam, kayit) => bmStatSayisi(toplam + bmStatSayisi(kayit.puan)), 0);
    istatistikler.kaybedilen_puan = kayiplar.filter((kayit) => yayinTuruHaritasi?.get(kayit.yayin_id) === secim.aracTuru)
      .reduce((toplam, kayit) => bmStatSayisi(toplam + bmStatSayisi(kayit.kaybedilen_puan)), 0);
  }

  for (const oneri of oneriler) {
    if (secim.aracTuru !== "tumu" && yayinTuruHaritasi?.get(oneri.yayin_id) !== secim.aracTuru) continue;
    istatistikler.toplam_oneri += 1;
    if (oneri.izlendi_mi) istatistikler.tamamlanan_oneri += 1;
    else {
      const oneriBitis = Date.parse(oneri.oneri_bitis);
      if (!Number.isFinite(oneriBitis)) throw new Error("BM önerisinin bitiş tarihi alınamadı.");
      if (oneriBitis < Date.parse(bitis)) istatistikler.suresi_gecmis_oneri += 1;
      else istatistikler.bekleyen_oneri += 1;
    }
  }
  istatistikler.net_saha_puani = bmStatSayisi(istatistikler.kazanilan_puan - istatistikler.kaybedilen_puan);
  return yanit;
}

async function bmOnayiBekleyenSiparisSayisi(admin: SupabaseClient, firmaId: string, uttIdler: string[]): Promise<number> {
  if (uttIdler.length === 0) return 0;

  // Sipariş takibindeki "BM Onayı Bekliyor": UTT onayı var, BM onayı yok.
  const uttOnaylari: { talep_id: string }[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await admin.from("eclub_siparis_utt_onaylari")
      .select("talep_id").in("utt_id", uttIdler)
      .order("onay_tarihi", { ascending: false }).range(offset, offset + 499);
    if (error) throw new Error(`UTT sipariş onayları alınamadı: ${error.message}`);
    uttOnaylari.push(...(data ?? []));
    if ((data ?? []).length < 500) break;
  }

  let toplam = 0;
  for (let i = 0; i < uttOnaylari.length; i += 200) {
    const ids = uttOnaylari.slice(i, i + 200).map((onay) => onay.talep_id);
    const [talepler, bmOnaylari] = await Promise.all([
      admin.from("eclub_store_cek_talepleri").select("talep_id")
        .eq("firma_id", firmaId).in("utt_id", uttIdler).in("talep_id", ids)
        .eq("siparis_verildi_mi", true).neq("siparis_tipi", "siparissiz_cek").neq("durum", "iptal"),
      admin.from("eclub_siparis_bm_onaylari").select("talep_id").in("talep_id", ids),
    ]);
    if (talepler.error || bmOnaylari.error) throw new Error(talepler.error?.message ?? bmOnaylari.error?.message);
    const onaylananlar = new Set((bmOnaylari.data ?? []).map((onay) => onay.talep_id));
    toplam += (talepler.data ?? []).filter((talep) => !onaylananlar.has(talep.talep_id)).length;
  }
  return toplam;
}

export async function getBmAnaSayfaVeri(userId: string, adminSupabase: SupabaseClient) {
  const { data: bmKullanici, error: bmError } = await adminSupabase
    .from("kullanicilar")
    .select("firma_id, bolge_id, takim_id")
    .eq("kullanici_id", userId)
    .single();

  if (bmError || !bmKullanici) throw new Error("BM bilgisi alınamadı.");

  const [{ data: uttler, error: uttError }, { data: firma, error: firmaError }] = await Promise.all([
    adminSupabase.from("kullanicilar").select("kullanici_id")
      .eq("firma_id", bmKullanici.firma_id).eq("takim_id", bmKullanici.takim_id)
      .eq("bolge_id", bmKullanici.bolge_id).in("rol", TUKETICI_ROLLER).eq("aktif_mi", true),
    adminSupabase.from("firmalar").select("aktif, cc_aktif, eclub_aktif, eclub_store_aktif")
      .eq("firma_id", bmKullanici.firma_id).single(),
  ]);
  if (uttError || firmaError || !firma) throw new Error("BM modül kapsamı alınamadı.");
  const uttIdler = (uttler ?? []).map(u => u.kullanici_id);
  const eclubAcik = firma.aktif && firma.eclub_aktif && firma.eclub_store_aktif;
  const cclubAcik = firma.aktif && firma.cc_aktif;
  const simdi = new Date();
  const bitisEsigi = new Date(simdi.getTime() + YAKLASAN_BITIS_SAATI * 60 * 60 * 1000);

  const [oneriler, cekler, challenge, siparisSayisi] = await Promise.all([
    uttIdler.length ? adminSupabase.from("oneri_kayitlari")
      .select("oneri_id", { count: "exact", head: true }).eq("oneren_id", userId)
      .in("kullanici_id", uttIdler).eq("izlendi_mi", false)
      .lte("oneri_baslangic", simdi.toISOString()).gte("oneri_bitis", simdi.toISOString())
      .lte("oneri_bitis", bitisEsigi.toISOString()) : Promise.resolve({ count: 0, error: null }),
    eclubAcik && uttIdler.length ? adminSupabase.from("eclub_store_cek_talepleri")
      .select("talep_id", { count: "exact", head: true }).eq("firma_id", bmKullanici.firma_id)
      .eq("bm_id", userId).in("utt_id", uttIdler).eq("durum", "bm_onayinda") : Promise.resolve({ count: 0, error: null }),
    cclubAcik ? adminSupabase.from("challenge_kayitlari")
      .select("challenge_id", { count: "exact", head: true }).eq("alan_id", userId)
      .eq("izlendi_mi", false) : Promise.resolve({ count: 0, error: null }),
    eclubAcik ? bmOnayiBekleyenSiparisSayisi(adminSupabase, bmKullanici.firma_id, uttIdler) : Promise.resolve(0),
  ]);
  if (oneriler.error || cekler.error || challenge.error) {
    throw new Error(oneriler.error?.message ?? cekler.error?.message ?? challenge.error?.message);
  }

  return {
    istatistikler: {
      bitis_yaklasan_oneriler: oneriler.count ?? 0,
      cek_onay_bekleyen: cekler.count ?? 0,
      siparis_onay_bekleyen: siparisSayisi,
      gelen_challenge: challenge.count ?? 0,
    },
    moduller: { eclub: !!eclubAcik, cclub: !!cclubAcik },
  };
}
