import type { SupabaseClient } from "@supabase/supabase-js";
import { TUKETICI_ROLLER } from "@/lib/utils/roller";

type YayinKunye = {
  yayin_id: string;
  talep_no: string | null;
  urun_adi: string | null;
  icerik_turu: string | null;
  arac_turu: string | null;
};

type Kazanim = { yayin_id: string; kullanici_id: string; puan_turu: string; puan: number };
type Kayip = { yayin_id: string; kullanici_id: string; kaybedilen_puan: number };
type Tamamlama = { yayin_id: string; aktor_id: string; adet: number };
type SorguYaniti<T> = { data: T[] | null; error: { message: string } | null };

export type UreticiYayinPerformansi = {
  yayin_id: string;
  yayin_adi: string;
  urun_adi: string | null;
  icerik_turu: string;
  arac_turu: string;
  tamamlanma: number;
  aktif_utt: number;
  tamamlayan_uttler: Array<{ kullanici_id: string; ad: string }>;
  izleme_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  extra_puani: number;
  eclub_puani: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  kazanilan_puan: number;
  kaybedilen_puan: number;
  net_puan: number;
};

const SAYFA_BOYUTU = 1000;
const PARCA_BOYUTU = 100;

async function tumSayfalariOku<T>(
  sorgu: (ilk: number, son: number) => PromiseLike<SorguYaniti<T>>,
): Promise<T[]> {
  const tumu: T[] = [];
  for (let ilk = 0; ; ilk += SAYFA_BOYUTU) {
    const yanit = await sorgu(ilk, ilk + SAYFA_BOYUTU - 1);
    if (yanit.error) throw new Error(yanit.error.message);
    const sayfa = yanit.data ?? [];
    tumu.push(...sayfa);
    if (sayfa.length < SAYFA_BOYUTU) return tumu;
  }
}

function parcalaraAyir<T>(degerler: T[]): T[][] {
  const sonuc: T[][] = [];
  for (let i = 0; i < degerler.length; i += PARCA_BOYUTU) sonuc.push(degerler.slice(i, i + PARCA_BOYUTU));
  return sonuc;
}

const bosYayin = (kunye: YayinKunye): UreticiYayinPerformansi => ({
  yayin_id: kunye.yayin_id,
  yayin_adi: kunye.talep_no ? `Yayın ${kunye.talep_no}` : `Yayın ${kunye.yayin_id.slice(0, 8)}`,
  urun_adi: kunye.urun_adi,
  icerik_turu: kunye.icerik_turu ?? "bilinmiyor",
  arac_turu: kunye.arac_turu ?? "video",
  tamamlanma: 0,
  aktif_utt: 0,
  tamamlayan_uttler: [],
  izleme_puani: 0,
  cevaplama_puani: 0,
  oneri_puani: 0,
  extra_puani: 0,
  eclub_puani: 0,
  ileri_sarma_kaybi: 0,
  yanlis_cevap_kaybi: 0,
  oneri_kaybi: 0,
  kazanilan_puan: 0,
  kaybedilen_puan: 0,
  net_puan: 0,
});

export async function getUreticiYayinDetaylari(
  db: SupabaseClient,
  girdi: {
    ureticiId: string;
    firmaId: string;
    yetkiliUttler: Array<{ kullanici_id: string; ad: string }>;
    baslangic: string;
    bitis: string;
  },
): Promise<UreticiYayinPerformansi[]> {
  const kunyeSatirlari = await tumSayfalariOku<YayinKunye>((ilk, son) =>
    db.from("v_yayin_detay")
      .select("yayin_id,talep_no,urun_adi,icerik_turu,arac_turu")
      .eq("uretici_id", girdi.ureticiId)
      .eq("firma_id", girdi.firmaId)
      .range(ilk, son),
  );
  const tekilKunyeler = [...new Map(kunyeSatirlari.map((satir) => [satir.yayin_id, satir])).values()];
  const yayinIdleri = tekilKunyeler.map((satir) => satir.yayin_id);
  if (yayinIdleri.length === 0) return [];

  const parcalar = parcalaraAyir(yayinIdleri);
  const aralik = <T>(tablo: string, secim: string, ids: string[]) =>
    tumSayfalariOku<T>((ilk, son) => (
      db.from(tablo).select(secim)
        .in("yayin_id", ids).gte("created_at", girdi.baslangic).lt("created_at", girdi.bitis).range(ilk, son)
    ) as unknown as PromiseLike<SorguYaniti<T>>);

  const [kazanimlar, ileriSarma, yanlisCevap, oneriKaybi, tamamlamalar] = await Promise.all([
    Promise.all(parcalar.map((ids) => aralik<Kazanim>("kazanilan_puanlar", "yayin_id,kullanici_id,puan_turu,puan", ids))).then((x) => x.flat()),
    Promise.all(parcalar.map((ids) => aralik<Kayip>("ileri_sarma_kayitlari", "yayin_id,kullanici_id,kaybedilen_puan", ids))).then((x) => x.flat()),
    Promise.all(parcalar.map((ids) => aralik<Kayip>("yanlis_cevap_kayitlari", "yayin_id,kullanici_id,kaybedilen_puan", ids))).then((x) => x.flat()),
    Promise.all(parcalar.map((ids) => aralik<Kayip>("oneri_kayip_kayitlari", "yayin_id,kullanici_id,kaybedilen_puan", ids))).then((x) => x.flat()),
    Promise.all(parcalar.map((ids) => tumSayfalariOku<Tamamlama>((ilk, son) =>
      db.from("v_rapor_arac_turu_olaylari")
        .select("yayin_id,aktor_id,adet")
        .in("yayin_id", ids)
        .in("rol", [...TUKETICI_ROLLER])
        .eq("olay_turu", "tamamlama")
        .gte("olay_tarihi", girdi.baslangic).lt("olay_tarihi", girdi.bitis)
        .range(ilk, son),
    ))).then((x) => x.flat()),
  ]);

  const yetkiliUttler = new Set(girdi.yetkiliUttler.map((utt) => utt.kullanici_id));
  const uttAdlari = new Map(girdi.yetkiliUttler.map((utt) => [utt.kullanici_id, utt.ad]));
  const sonuc = new Map(tekilKunyeler.map((kunye) => [kunye.yayin_id, bosYayin(kunye)]));
  const aktifUttler = new Map<string, Set<string>>();

  for (const kayit of kazanimlar) {
    if (!yetkiliUttler.has(kayit.kullanici_id)) continue;
    const yayin = sonuc.get(kayit.yayin_id);
    if (!yayin) continue;
    const puan = Number(kayit.puan ?? 0);
    if (kayit.puan_turu === "izleme") yayin.izleme_puani += puan;
    else if (kayit.puan_turu === "cevaplama") yayin.cevaplama_puani += puan;
    else if (kayit.puan_turu === "oneri") yayin.oneri_puani += puan;
    else if (kayit.puan_turu === "extra") yayin.extra_puani += puan;
    else if (kayit.puan_turu === "eclub") yayin.eclub_puani += puan;
  }
  const kayipEkle = (kayitlar: Kayip[], alan: "ileri_sarma_kaybi" | "yanlis_cevap_kaybi" | "oneri_kaybi") => {
    for (const kayit of kayitlar) {
      if (!yetkiliUttler.has(kayit.kullanici_id)) continue;
      const yayin = sonuc.get(kayit.yayin_id);
      if (yayin) yayin[alan] += Number(kayit.kaybedilen_puan ?? 0);
    }
  };
  kayipEkle(ileriSarma, "ileri_sarma_kaybi");
  kayipEkle(yanlisCevap, "yanlis_cevap_kaybi");
  kayipEkle(oneriKaybi, "oneri_kaybi");

  for (const kayit of tamamlamalar) {
    if (!yetkiliUttler.has(kayit.aktor_id)) continue;
    const yayin = sonuc.get(kayit.yayin_id);
    if (!yayin) continue;
    yayin.tamamlanma += Number(kayit.adet ?? 0);
    const set = aktifUttler.get(kayit.yayin_id) ?? new Set<string>();
    set.add(kayit.aktor_id);
    aktifUttler.set(kayit.yayin_id, set);
  }

  for (const yayin of sonuc.values()) {
    const tamamlayanIdler = [...(aktifUttler.get(yayin.yayin_id) ?? new Set<string>())];
    yayin.aktif_utt = tamamlayanIdler.length;
    yayin.tamamlayan_uttler = tamamlayanIdler
      .map((kullanici_id) => ({ kullanici_id, ad: uttAdlari.get(kullanici_id) ?? "Bilinmeyen UTT" }))
      .sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
    yayin.kazanilan_puan = yayin.izleme_puani + yayin.cevaplama_puani + yayin.oneri_puani + yayin.extra_puani + yayin.eclub_puani;
    yayin.kaybedilen_puan = yayin.ileri_sarma_kaybi + yayin.yanlis_cevap_kaybi + yayin.oneri_kaybi;
    yayin.net_puan = yayin.kazanilan_puan - yayin.kaybedilen_puan;
  }

  return [...sonuc.values()]
    .filter((yayin) => yayin.tamamlanma > 0 || yayin.kazanilan_puan > 0 || yayin.kaybedilen_puan > 0)
    .sort((a, b) => b.net_puan - a.net_puan || a.yayin_adi.localeCompare(b.yayin_adi, "tr"));
}
