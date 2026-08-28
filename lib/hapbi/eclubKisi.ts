import type { SupabaseClient } from "@supabase/supabase-js";
import { eclubKisiErisimi } from "@/lib/eclub/kisiErisim";
import { eclubOneriDurumu } from "@/lib/eclub/izlemeKurali";
import { ECLUB_TUKETICI_ROLLERI, eclubKisiHedefRolu, hedefRolleriOku } from "@/lib/utils/roller";
import { yayinAraciKullanimaAcikMi } from "@/lib/ogrenmeAraci/bayraklar";
import { tamamlanmaOrani } from "@/lib/rapor/paylasilan/oran";

export type EclubKisiListeFiltresi = "bekleyen" | "tamamlanan" | "suresi_gecmis" | "tumu";

export interface EclubKisiHapbiEgitimi {
  oneri_id: string;
  baslik: string;
  teknik: string | null;
  firma: string | null;
  durum: "bekleyen" | "tamamlanan" | "suresi_gecmis";
  kalan_gun: number | null;
  kayitli_video_puani: number;
  kayitli_soru_puani: number;
  arac_turu: "video" | "podcast" | "gorsel" | "flip_pdf";
  dogru_cevap: number;
  yanlis_cevap: number;
  dogru_cevap_yuzdesi: number;
  url: string;
}

export interface EclubKisiHapbiSonucu {
  kisi: { rol: string };
  ozet: {
    bekleyen_egitim: number;
    tamamlanan_egitim: number;
    suresi_gecmis_egitim: number;
    toplam_kazanilan_puan: number;
    ileri_sarma_kaybi: number;
    net_puan: number;
    kullanilabilir_puan: number;
    dogru_cevap: number;
    yanlis_cevap: number;
    dogru_cevap_yuzdesi: number;
  };
  gelisim_durumu: { gozlem: string; adim: string; sinir: string };
  liste: { filtre: EclubKisiListeFiltresi; toplam: number; kesildi: boolean };
  egitimler: EclubKisiHapbiEgitimi[];
}

interface EclubYayinDetayi {
  yayin_id: string;
  firma_id: string | null;
  firma_adi: string | null;
  urun_adi: string | null;
  teknik_adi: string | null;
  hedef_roller?: unknown;
  durum: string | null;
  video_puani: number | null;
  soru_puani: number | null;
  arac_turu: "video" | "podcast" | "gorsel" | "flip_pdf";
}

interface EclubOneriSatiri {
  oneri_id: string;
  yayin_id: string;
  oneri_baslangic: string;
  oneri_bitis: string;
  izlendi_mi: boolean;
}

const sayi = (deger: unknown) => Number(deger ?? 0);

/** Hapbi için salt okunur E-Club kişi özeti. Kimlik ve firma kapsamı sunucuda çözülür. */
export async function eclubKisiHapbiOzeti(
  db: SupabaseClient,
  authUserId: string,
  beklenenRol: string,
  liste: EclubKisiListeFiltresi,
  simdi = new Date(),
): Promise<EclubKisiHapbiSonucu> {
  if (!ECLUB_TUKETICI_ROLLERI.includes(beklenenRol)) throw new Error("E-Club kişi rolü uygun değil.");

  const erisim = await eclubKisiErisimi(db, authUserId);
  const kisi = erisim.kisi;
  if (!kisi || kisi.rol !== beklenenRol || !ECLUB_TUKETICI_ROLLERI.includes(kisi.rol) || !erisim.eclub_aktif) {
    throw new Error("Aktif E-Club kişi erişimi doğrulanamadı.");
  }
  const firmaIdler = erisim.firmalar
    .filter((firma) => firma.aktif !== false && firma.eclub_aktif === true)
    .map((firma) => firma.firma_id);
  if (!firmaIdler.length) throw new Error("Aktif E-Club firma erişimi doğrulanamadı.");

  const simdiIso = simdi.toISOString();
  const [oneriSonucu, puanSonucu, kayipSonucu, dogruSonucu, yanlisSonucu, bakiyeSonucu] = await Promise.all([
    db.from("eclub_oneri_kayitlari")
      .select("oneri_id, yayin_id, oneri_baslangic, oneri_bitis, izlendi_mi")
      .eq("kisi_id", kisi.kisi_id).lte("oneri_baslangic", simdiIso)
      .order("created_at", { ascending: false }),
    db.from("eclub_kazanilan_puanlar").select("yayin_id, puan").eq("kisi_id", kisi.kisi_id),
    db.from("eclub_ileri_sarma_kayitlari").select("yayin_id, kaybedilen_puan").eq("kisi_id", kisi.kisi_id),
    db.from("eclub_dogru_cevap_kayitlari").select("yayin_id").eq("kisi_id", kisi.kisi_id),
    db.from("eclub_yanlis_cevap_kayitlari").select("yayin_id").eq("kisi_id", kisi.kisi_id),
    db.rpc("get_eclub_store_firma_bakiye", { p_kisi_id: kisi.kisi_id }),
  ]);
  if (oneriSonucu.error || puanSonucu.error || kayipSonucu.error || dogruSonucu.error || yanlisSonucu.error || bakiyeSonucu.error) {
    throw new Error("E-Club kişisel özeti okunamadı.");
  }

  const oneriler = (oneriSonucu.data ?? []) as EclubOneriSatiri[];
  const puanlar = puanSonucu.data ?? [];
  const kayiplar = kayipSonucu.data ?? [];
  const bakiyeler = (bakiyeSonucu.data ?? []) as Array<{ firma_id: string; bakiye: number | null }>;
  const yayinIdler = [...new Set([
    ...oneriler.map((oneri) => oneri.yayin_id),
    ...puanlar.map((puan) => puan.yayin_id),
    ...kayiplar.map((kayip) => kayip.yayin_id),
  ])];

  let yayinlar: EclubYayinDetayi[] = [];
  if (yayinIdler.length) {
    const yayinSonucu = await db.from("v_yayin_detay")
      .select("yayin_id, firma_id, firma_adi, urun_adi, teknik_adi, hedef_roller, durum, video_puani, soru_puani, arac_turu")
      .in("yayin_id", yayinIdler).in("firma_id", firmaIdler).or("arac_turu.in.(gorsel,flip_pdf),video_suresi_saniye.gt.0");
    if (yayinSonucu.error) throw new Error("E-Club yayınları okunamadı.");
    yayinlar = (yayinSonucu.data ?? []) as EclubYayinDetayi[];
  }

  const hedefRol = eclubKisiHedefRolu(kisi.rol);
  const yayinMap = new Map(yayinlar
    .filter((yayin) => yayin.durum === "yayinda" && yayinAraciKullanimaAcikMi(yayin.arac_turu) && hedefRol && hedefRolleriOku(yayin).includes(hedefRol))
    .map((yayin) => [yayin.yayin_id, yayin]));
  const gorunenOneriler = oneriler.flatMap((oneri) => {
    const yayin = yayinMap.get(oneri.yayin_id);
    if (!yayin || !firmaIdler.includes(String(yayin.firma_id))) return [];
    const durum = oneri.izlendi_mi
      ? "tamamlanan" as const
      : eclubOneriDurumu(oneri.oneri_baslangic, oneri.oneri_bitis, simdi) === "aktif"
        ? "bekleyen" as const
        : "suresi_gecmis" as const;
    const dogruCevap = (dogruSonucu.data ?? []).filter((cevap) => cevap.yayin_id === oneri.yayin_id).length;
    const yanlisCevap = (yanlisSonucu.data ?? []).filter((cevap) => cevap.yayin_id === oneri.yayin_id).length;
    return [{
      oneri_id: oneri.oneri_id,
      baslik: yayin.urun_adi ?? "Eğitim",
      teknik: yayin.teknik_adi,
      firma: yayin.firma_adi,
      durum,
      kalan_gun: durum === "bekleyen"
        ? Math.max(0, Math.ceil((new Date(oneri.oneri_bitis).getTime() - simdi.getTime()) / 86_400_000))
        : null,
      kayitli_video_puani: sayi(yayin.video_puani),
      kayitli_soru_puani: sayi(yayin.soru_puani),
      arac_turu: yayin.arac_turu,
      dogru_cevap: dogruCevap,
      yanlis_cevap: yanlisCevap,
      dogru_cevap_yuzdesi: tamamlanmaOrani(dogruCevap, dogruCevap + yanlisCevap),
      url: `/eclub/panel?oneri_id=${encodeURIComponent(oneri.oneri_id)}`,
    }];
  });

  const bekleyen = gorunenOneriler.filter((oneri) => oneri.durum === "bekleyen")
    .sort((a, b) => (a.kalan_gun ?? 0) - (b.kalan_gun ?? 0));
  const tamamlanan = gorunenOneriler.filter((oneri) => oneri.durum === "tamamlanan");
  const suresiGecmis = gorunenOneriler.filter((oneri) => oneri.durum === "suresi_gecmis");
  const filtrelenen = liste === "bekleyen" ? bekleyen
    : liste === "tamamlanan" ? tamamlanan
      : liste === "suresi_gecmis" ? suresiGecmis : gorunenOneriler;
  const secilen = filtrelenen.slice(0, 20);
  const toplamKazanilan = puanlar
    .filter((puan) => firmaIdler.includes(String(yayinMap.get(puan.yayin_id)?.firma_id ?? "")))
    .reduce((toplam, puan) => toplam + sayi(puan.puan), 0);
  const ileriSarmaKaybi = kayiplar
    .filter((kayip) => firmaIdler.includes(String(yayinMap.get(kayip.yayin_id)?.firma_id ?? "")))
    .reduce((toplam, kayip) => toplam + sayi(kayip.kaybedilen_puan), 0);
  const kullanilabilirPuan = bakiyeler
    .filter((bakiye) => firmaIdler.includes(bakiye.firma_id))
    .reduce((toplam, bakiye) => toplam + sayi(bakiye.bakiye), 0);
  const toplamDogru = (dogruSonucu.data ?? []).filter((cevap) => firmaIdler.includes(String(yayinMap.get(cevap.yayin_id)?.firma_id ?? ""))).length;
  const toplamYanlis = (yanlisSonucu.data ?? []).filter((cevap) => firmaIdler.includes(String(yayinMap.get(cevap.yayin_id)?.firma_id ?? ""))).length;

  return {
    kisi: { rol: kisi.rol },
    ozet: {
      bekleyen_egitim: bekleyen.length,
      tamamlanan_egitim: tamamlanan.length,
      suresi_gecmis_egitim: suresiGecmis.length,
      toplam_kazanilan_puan: toplamKazanilan,
      ileri_sarma_kaybi: ileriSarmaKaybi,
      net_puan: Math.max(0, toplamKazanilan - ileriSarmaKaybi),
      kullanilabilir_puan: kullanilabilirPuan,
      dogru_cevap: toplamDogru,
      yanlis_cevap: toplamYanlis,
      dogru_cevap_yuzdesi: tamamlanmaOrani(toplamDogru, toplamDogru + toplamYanlis),
    },
    gelisim_durumu: {
      gozlem: bekleyen.length
        ? `${bekleyen.length} süresi devam eden eğitim bekliyor.`
        : suresiGecmis.length
          ? `Süresi devam eden bekleyen eğitim yok; ${suresiGecmis.length} eğitim tamamlanmadan sona ermiş.`
          : "Süresi devam eden bekleyen eğitim yok.",
      adim: bekleyen.length
        ? "Önce bitişi en yakın eğitime devam edin."
        : suresiGecmis.length
          ? "Süresi geçmiş eğitimler puanlı güncel görev değildir; öğrenme amacıyla yeniden incelenebilir."
          : "Yeni eğitim atandığında E-Club panelinden takip edin.",
      sinir: "Tamamlama ve puan verileri mesleki yetkinlik veya satış başarısı ölçümü değildir.",
    },
    liste: { filtre: liste, toplam: filtrelenen.length, kesildi: filtrelenen.length > 20 },
    egitimler: secilen,
  };
}
