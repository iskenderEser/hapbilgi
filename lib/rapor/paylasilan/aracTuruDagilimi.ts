import type { SupabaseClient } from "@supabase/supabase-js";
import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";

const TURLER: OgrenmeAraciTuru[] = ["video", "podcast", "gorsel", "flip_pdf"];

type RolMetrigi = { baslatma: number; tamamlama: number };
type OlayToplami = {
  baslatma: number; tamamlama: number; dogru_cevap: number; yanlis_cevap: number;
  kazanilan_puan: number; kaybedilen_puan: number; oneri_gonderildi: number;
  oneri_tamamlandi: number; challenge_gonderildi: number; challenge_tamamlandi: number;
  eclub_dagitim: number; eclub_dagitim_tamamlandi: number; eczanem_dagitim: number;
  eczanem_dagitim_tamamlandi: number;
};

export interface AracTuruRaporSatiri extends OlayToplami {
  arac_turu: OgrenmeAraciTuru;
  yayin_sayisi: number;
  kayitli_arac_puani: number;
  net_kazanilan_puan: number;
  dogru_cevap_yuzdesi: number | null;
  roller: Record<string, RolMetrigi>;
  yayinlar: Array<{
    yayin_id: string; talep_id: string | null; talep_no: string | null;
    kayitli_arac_puani: number; kazanilan_puan: number; kaybedilen_puan: number;
    baslatma: number; tamamlama: number;
  }>;
}

const BOS: OlayToplami = {
  baslatma: 0, tamamlama: 0, dogru_cevap: 0, yanlis_cevap: 0,
  kazanilan_puan: 0, kaybedilen_puan: 0, oneri_gonderildi: 0,
  oneri_tamamlandi: 0, challenge_gonderildi: 0, challenge_tamamlandi: 0,
  eclub_dagitim: 0, eclub_dagitim_tamamlandi: 0, eczanem_dagitim: 0,
  eczanem_dagitim_tamamlandi: 0,
};

export async function aracTuruDagilimi(
  db: SupabaseClient,
  girdi: { baslangic: string; bitis: string; firmaId?: string | null; takimId?: string | null; ureticiId?: string | null; aktorId?: string | null },
): Promise<AracTuruRaporSatiri[]> {
  let yayinSorgu = db.from("v_rapor_arac_turu_ozet")
    .select("yayin_id,talep_id,talep_no,arac_turu,arac_puani")
    .gte("yayin_tarihi", girdi.baslangic).lt("yayin_tarihi", girdi.bitis);
  let olaySorgu = db.from("v_rapor_arac_turu_olaylari")
    .select("yayin_id,talep_id,talep_no,arac_turu,olay_turu,rol,adet,puan")
    .gte("olay_tarihi", girdi.baslangic).lt("olay_tarihi", girdi.bitis);
  if (girdi.ureticiId) {
    yayinSorgu = yayinSorgu.eq("uretici_id", girdi.ureticiId); olaySorgu = olaySorgu.eq("uretici_id", girdi.ureticiId);
  } else if (girdi.takimId) {
    yayinSorgu = yayinSorgu.eq("takim_id", girdi.takimId); olaySorgu = olaySorgu.eq("takim_id", girdi.takimId);
  } else if (girdi.firmaId) {
    yayinSorgu = yayinSorgu.eq("firma_id", girdi.firmaId); olaySorgu = olaySorgu.eq("firma_id", girdi.firmaId);
  }
  if (girdi.aktorId) olaySorgu = olaySorgu.eq("aktor_id", girdi.aktorId);
  const [yayinYaniti, olayYaniti] = await Promise.all([yayinSorgu, olaySorgu]);
  if (yayinYaniti.error || olayYaniti.error) throw new Error("Öğrenme aracı türü rapor kaynağı okunamadı.");

  return TURLER.map((arac_turu) => {
    const yayinlar = (yayinYaniti.data ?? []).filter((x) => x.arac_turu === arac_turu);
    const olaylar = (olayYaniti.data ?? []).filter((x) => x.arac_turu === arac_turu);
    const toplam: OlayToplami = { ...BOS };
    const roller: Record<string, RolMetrigi> = {};
    const yayinMetrigi = new Map<string, OlayToplami>();
    for (const olay of olaylar) {
      const tur = olay.olay_turu as keyof OlayToplami;
      if (!(tur in toplam)) continue;
      const deger = tur === "kazanilan_puan" || tur === "kaybedilen_puan" ? Number(olay.puan ?? 0) : Number(olay.adet ?? 0);
      toplam[tur] += deger;
      const yayin = yayinMetrigi.get(olay.yayin_id) ?? { ...BOS };
      yayin[tur] += deger; yayinMetrigi.set(olay.yayin_id, yayin);
      if (tur === "baslatma" || tur === "tamamlama") {
        const rol = olay.rol || "bilinmiyor";
        const metrik = roller[rol] ?? { baslatma: 0, tamamlama: 0 };
        metrik[tur] += deger; roller[rol] = metrik;
      }
    }
    const cevapToplami = toplam.dogru_cevap + toplam.yanlis_cevap;
    return {
      arac_turu, yayin_sayisi: yayinlar.length,
      kayitli_arac_puani: yayinlar.reduce((t, y) => t + Number(y.arac_puani ?? 0), 0),
      ...toplam,
      net_kazanilan_puan: toplam.kazanilan_puan - toplam.kaybedilen_puan,
      dogru_cevap_yuzdesi: cevapToplami === 0 ? null : Math.round((1000 * toplam.dogru_cevap) / cevapToplami) / 10,
      roller,
      yayinlar: yayinlar.map((y) => {
        const m = yayinMetrigi.get(y.yayin_id) ?? BOS;
        return { yayin_id: y.yayin_id, talep_id: y.talep_id ?? null, talep_no: y.talep_no ?? null,
          kayitli_arac_puani: Number(y.arac_puani ?? 0), kazanilan_puan: m.kazanilan_puan,
          kaybedilen_puan: m.kaybedilen_puan, baslatma: m.baslatma, tamamlama: m.tamamlama };
      }),
    };
  });
}
