import type { SupabaseClient } from "@supabase/supabase-js";
import {
  HAPBI_ANALITIK_SURUMU,
  hapbiAnalitikSorguyuDogrula,
  type HapbiAnalitikBoyut,
  type HapbiAnalitikOlcut,
  type HapbiAnalitikSonuc,
  type HapbiAnalitikSorgu,
  type HapbiAnalitikVarlik,
} from "@/lib/hapbi/analitik/sozlesme";
import { hapbiAnalitikDonemiAraligaCevir } from "@/lib/hapbi/analitik/tclubOkuyucu";
import { HapbiHata, type HapbiKaynak } from "@/lib/hapbi/sozlesme";

export interface HapbiEclubAnalitikHamSatir {
  utt_id: string;
  utt_adi: string;
  firma_id: string;
  firma_adi: string;
  takim_id: string | null;
  takim_adi: string | null;
  bolge_id: string | null;
  bolge_adi: string | null;
  bm_id: string | null;
  bm_adi: string | null;
  bm_eslesme_durumu: "tek" | "yok" | "coklu";
  eczane_id: string;
  gln: string | null;
  eczane_adi: string;
  kisi_id: string | null;
  kisi_adi: string | null;
  kisi_rol: string | null;
  icerik_anahtari: string | null;
  icerik_adi: string | null;
  urun_id: string | null;
  urun_adi: string | null;
  gonderim_sayisi: number;
  tamamlama_sayisi: number;
  dogru_cevap_sayisi: number;
  yanlis_cevap_sayisi: number;
  izleme_puani: number;
  cevaplama_puani: number;
  ileri_sarma_kaybi: number;
  kazanilan_puan: number;
  kaybedilen_puan: number;
  net_puan: number;
}

const EclubOlcutAlani: Partial<Record<HapbiAnalitikOlcut, keyof HapbiEclubAnalitikHamSatir>> = {
  net_puan: "net_puan",
  kazanilan_puan: "kazanilan_puan",
  kaybedilen_puan: "kaybedilen_puan",
  izleme_puani: "izleme_puani",
  cevaplama_puani: "cevaplama_puani",
  ileri_sarma_kaybi: "ileri_sarma_kaybi",
  tamamlama_sayisi: "tamamlama_sayisi",
  gonderim_sayisi: "gonderim_sayisi",
  cevap_sayisi: "dogru_cevap_sayisi",
  dogru_cevap_sayisi: "dogru_cevap_sayisi",
  yanlis_cevap_sayisi: "yanlis_cevap_sayisi",
};

function varlik(tur: Exclude<HapbiAnalitikBoyut, "zaman">, id: string, ad: string, ust?: string | null): HapbiAnalitikVarlik {
  return { tur, id, ad, ...(ust !== undefined ? { ust_varlik_id: ust } : {}) };
}

function boyut(s: HapbiEclubAnalitikHamSatir, b: HapbiAnalitikBoyut, zaman: string) {
  if (b === "firma") return varlik("firma", s.firma_id, s.firma_adi);
  if (b === "takim") return varlik("takim", s.takim_id ?? "takimsiz", s.takim_adi ?? "Takımsız", s.firma_id);
  if (b === "bm_kapsami") return varlik("bm_kapsami", s.bm_id ?? `${s.takim_id}:${s.bolge_id}:${s.bm_eslesme_durumu}`, s.bm_adi ?? (s.bm_eslesme_durumu === "coklu" ? "Birden fazla BM" : "Atanmamış BM kapsamı"), s.takim_id);
  if (b === "kullanici") return varlik("kullanici", s.kisi_id ?? "kisisiz", s.kisi_adi ?? "Kişi kaydı yok", s.eczane_id);
  if (b === "eczane") return varlik("eczane", s.eczane_id, s.eczane_adi, s.utt_id);
  if (b === "urun") return varlik("urun", s.urun_id ?? "urunsuz", s.urun_adi ?? "Ürünsüz içerik", s.takim_id);
  if (b === "icerik") return varlik("icerik", s.icerik_anahtari ?? "iceriksiz", s.icerik_adi ?? "İçerik kaydı yok", s.urun_id);
  if (b === "zaman") return zaman;
  throw new HapbiHata("DESTEKLENMEYEN_BOYUT", 400, `${b} E-Club analitik kaynağında desteklenmiyor.`);
}

function kimlik(s: HapbiEclubAnalitikHamSatir, b: Exclude<HapbiAnalitikBoyut, "zaman">): string | null {
  if (b === "firma") return s.firma_id;
  if (b === "takim") return s.takim_id;
  if (b === "bm_kapsami") return s.bm_id;
  if (b === "kullanici") return s.kisi_id;
  if (b === "eczane") return s.eczane_id;
  if (b === "urun") return s.urun_id;
  if (b === "icerik") return s.icerik_anahtari;
  return null;
}

function zamanEtiketi(sorgu: HapbiAnalitikSorgu): string {
  const d = sorgu.donem;
  if (d.tur === "ozel") return `${d.baslangic}/${d.bitis}`;
  if (d.tur === "hafta") return `${d.yil}/hafta:${d.hafta}`;
  if (d.tur === "ay") return `${d.yil}/ay:${d.ay}`;
  if (d.tur === "ceyrek") return `${d.yil}/çeyrek:${d.ceyrek}`;
  return `${d.yil}`;
}

export function hapbiEclubSatirlariniTopla(
  sorgu: HapbiAnalitikSorgu,
  ham: HapbiEclubAnalitikHamSatir[],
  kaynak: HapbiKaynak,
): HapbiAnalitikSonuc {
  hapbiAnalitikSorguyuDogrula(sorgu);
  if (sorgu.veri_alani !== "eclub") throw new HapbiHata("GECERSIZ_VERI_ALANI", 400, "E-Club okuyucusu yalnız E-Club sorgusu kabul eder.");
  const satirlar = ham.filter((s) => sorgu.filtreler.every((f) => {
    const id = kimlik(s, f.boyut);
    return id !== null && f.kimlikler.includes(id);
  }));
  const gruplar = new Map<string, { boyutlar: Record<string, HapbiAnalitikVarlik | string>; olcumler: Partial<Record<HapbiAnalitikOlcut, number>> }>();
  const zaman = zamanEtiketi(sorgu);
  for (const s of satirlar) {
    const boyutlar = Object.fromEntries(sorgu.boyutlar.map((b) => [b, boyut(s, b, zaman)]));
    const anahtar = JSON.stringify(boyutlar);
    const grup = gruplar.get(anahtar) ?? { boyutlar, olcumler: {} };
    for (const olcut of sorgu.olcutler) {
      const alan = EclubOlcutAlani[olcut];
      if (!alan) throw new HapbiHata("DESTEKLENMEYEN_OLCUT", 400, `${olcut} E-Club analitik kaynağında desteklenmiyor.`);
      let deger = Number(s[alan] ?? 0);
      if (olcut === "cevap_sayisi") deger += Number(s.yanlis_cevap_sayisi ?? 0);
      grup.olcumler[olcut] = (grup.olcumler[olcut] ?? 0) + deger;
    }
    gruplar.set(anahtar, grup);
  }
  let liste = [...gruplar.values()];
  const toplamlar = Object.fromEntries(sorgu.olcutler.map((olcut) => [
    olcut,
    liste.reduce((toplam, grup) => toplam + Number(grup.olcumler[olcut] ?? 0), 0),
  ]));
  if (sorgu.siralama) {
    const { olcut, yon } = sorgu.siralama;
    liste.sort((a, b) => (Number(a.olcumler[olcut] ?? 0) - Number(b.olcumler[olcut] ?? 0)) * (yon === "artan" ? 1 : -1));
  }
  const tumSatirSayisi = liste.length;
  liste = liste.slice(0, sorgu.limit ?? 100);
  const sonucSatirlari = liste.map((grup) => ({ boyutlar: grup.boyutlar, olcumler: grup.olcumler }));
  const olgular = sonucSatirlari.flatMap((satir) => {
    const ozne = Object.values(satir.boyutlar).find((deger): deger is HapbiAnalitikVarlik => typeof deger === "object" && deger !== null && "id" in deger);
    return ozne ? Object.entries(satir.olcumler).map(([iliski, deger]) => ({ ozne, iliski: iliski as HapbiAnalitikOlcut, deger: Number(deger ?? 0), baglam: satir.boyutlar })) : [];
  });
  const cokluBm = satirlar.some((s) => s.bm_eslesme_durumu === "coklu");
  return {
    surum: HAPBI_ANALITIK_SURUMU, sorgu, veri_durumu: satirlar.length ? "var" : "bos",
    satirlar: sonucSatirlari, toplamlar, olgular, kaynaklar: [kaynak],
    tam_mi: !cokluBm && liste.length === tumSatirSayisi,
    ...(cokluBm ? { sinir_aciklamasi: "Aynı takım ve bölgede birden fazla aktif BM bulunduğu için BM kapsamı tekilleştirilemedi." }
      : liste.length < tumSatirSayisi ? { sinir_aciklamasi: `Sonuç ${liste.length} satırla sınırlandı.` } : {}),
  };
}

export async function hapbiEclubAnalitikOku(db: SupabaseClient, sorgu: HapbiAnalitikSorgu, kaynak: HapbiKaynak) {
  const aralik = hapbiAnalitikDonemiAraligaCevir(sorgu);
  const bitisHaric = new Date(new Date(aralik.bitis).getTime() + 1).toISOString();
  const { data, error } = await db.rpc("get_hapbi_eclub_analitik_v1", {
    p_isteyen_id: sorgu.kapsam.kullanici_id, p_baslangic: aralik.baslangic, p_bitis_haric: bitisHaric,
  });
  if (error) throw new HapbiHata("ANALITIK_KAYNAK", 500, "E-Club analitik verisi okunamadı.");
  return hapbiEclubSatirlariniTopla(sorgu, (data ?? []) as HapbiEclubAnalitikHamSatir[], kaynak);
}
