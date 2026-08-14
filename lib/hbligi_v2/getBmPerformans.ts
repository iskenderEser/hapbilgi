import type { SupabaseClient } from "@supabase/supabase-js";
import type { LigPeriyot } from "@/lib/hbligi_v2/ligRpcCagir";
import type {
  BmPerformansDetay,
  BmUttPerformans,
} from "@/lib/rapor/paylasilan/bmPerformansTipleri";
import { ligPeriyoduAraligi } from "@/lib/zaman/kontrol";

interface BmPerformansKapsami {
  firma_id: string | null;
  takim_id: string | null;
}

interface BmSatiri {
  kullanici_id: string;
  ad: string | null;
  soyad: string | null;
  bolge_id: string | null;
}

function topla(
  satirlar: Array<Omit<BmUttPerformans, "bm_id">>,
  alan: keyof Omit<BmUttPerformans, "bm_id" | "kullanici_id" | "ad" | "soyad">,
): number {
  return satirlar.reduce((toplam, satir) => toplam + Number(satir[alan] ?? 0), 0);
}

/**
 * Yetkili firma/takım kapsamındaki BM'leri, Raporlar ile aynı BM→UTT RPC'siyle
 * toplar. Kapsam yalnız oturum kullanıcısından türetilen kimliklerle daraltılır.
 */
export async function getBmPerformans(
  supabase: SupabaseClient,
  kapsam: BmPerformansKapsami,
  periyot: LigPeriyot,
): Promise<BmPerformansDetay[]> {
  const { baslangic, bitis } = ligPeriyoduAraligi(periyot);
  let bmSorgusu = supabase
    .from("kullanicilar")
    .select("kullanici_id, ad, soyad, bolge_id")
    .eq("rol", "bm")
    .eq("aktif_mi", true);

  if (kapsam.firma_id) bmSorgusu = bmSorgusu.eq("firma_id", kapsam.firma_id);
  if (kapsam.takim_id) bmSorgusu = bmSorgusu.eq("takim_id", kapsam.takim_id);

  const { data: bmVerisi, error: bmHatasi } = await bmSorgusu;
  if (bmHatasi) throw new Error(`BM kapsamı alınamadı: ${bmHatasi.message}`);

  const bmler = (bmVerisi ?? []) as BmSatiri[];
  const bolgeIdleri = [...new Set(bmler.map((bm) => bm.bolge_id).filter((id): id is string => Boolean(id)))];
  const bolgeHaritasi = new Map<string, string>();
  if (bolgeIdleri.length > 0) {
    const { data: bolgeler, error: bolgeHatasi } = await supabase
      .from("bolgeler")
      .select("bolge_id, bolge_adi")
      .in("bolge_id", bolgeIdleri);
    if (bolgeHatasi) throw new Error(`BM bölgeleri alınamadı: ${bolgeHatasi.message}`);
    for (const bolge of bolgeler ?? []) {
      bolgeHaritasi.set(String(bolge.bolge_id), String(bolge.bolge_adi ?? "-"));
    }
  }

  const sonuclar = await Promise.all(
    bmler.map(async (bm) => ({
      bm,
      sonuc: await supabase.rpc("get_bm_utt_performans_v2", {
        p_bm_id: bm.kullanici_id,
        p_baslangic: baslangic,
        p_bitis: bitis,
      }),
    })),
  );

  return sonuclar.map(({ bm, sonuc }) => {
    if (sonuc.error) {
      const bmAdi = `${bm.ad ?? ""} ${bm.soyad ?? ""}`.trim();
      throw new Error(`get_bm_utt_performans_v2 RPC (${bmAdi}): ${sonuc.error.message}`);
    }

    const hamUttler = (sonuc.data ?? []) as Array<Omit<BmUttPerformans, "bm_id">>;
    const uttListesi = hamUttler.map((utt) => ({ ...utt, bm_id: bm.kullanici_id }));
    const izlemePuani = topla(hamUttler, "izleme_puani");
    const cevaplamaPuani = topla(hamUttler, "cevaplama_puani");
    const oneriPuani = topla(hamUttler, "oneri_puani");
    const extraPuan = topla(hamUttler, "extra_puan");
    const ileriSarmaKaybi = topla(hamUttler, "ileri_sarma_kaybi");
    const yanlisCevapKaybi = topla(hamUttler, "yanlis_cevap_kaybi");
    const oneriKaybi = topla(hamUttler, "oneri_kaybi");

    return {
      bm_id: bm.kullanici_id,
      bm_adi: `${bm.ad ?? ""} ${bm.soyad ?? ""}`.trim(),
      bolge_id: bm.bolge_id ?? "",
      bolge_adi: bm.bolge_id ? bolgeHaritasi.get(bm.bolge_id) ?? "-" : "-",
      toplam_utt: hamUttler.length,
      aktif_utt: hamUttler.filter((utt) => Number(utt.tamamlanan_izleme ?? 0) > 0).length,
      tamamlanan_izleme: topla(hamUttler, "tamamlanan_izleme"),
      benzersiz_yayin: topla(hamUttler, "benzersiz_yayin"),
      izleme_puani: izlemePuani,
      cevaplama_puani: cevaplamaPuani,
      oneri_puani: oneriPuani,
      extra_puan: extraPuan,
      ileri_sarma_kaybi: ileriSarmaKaybi,
      yanlis_cevap_kaybi: yanlisCevapKaybi,
      oneri_kaybi: oneriKaybi,
      kazanilan_toplam: izlemePuani + cevaplamaPuani + oneriPuani + extraPuan,
      kaybedilen_toplam: ileriSarmaKaybi + yanlisCevapKaybi + oneriKaybi,
      net_puan: izlemePuani + cevaplamaPuani + oneriPuani + extraPuan
        - ileriSarmaKaybi - yanlisCevapKaybi - oneriKaybi,
      utt_listesi: uttListesi,
    };
  });
}
