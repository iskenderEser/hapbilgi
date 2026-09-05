import type { SupabaseClient } from "@supabase/supabase-js";
import {
  HAPBI_ANALITIK_SURUMU,
  hapbiAnalitikSorguyuDogrula,
  type HapbiAnalitikBoyut,
  type HapbiAnalitikOlcut,
  type HapbiAnalitikSatir,
  type HapbiAnalitikSonuc,
  type HapbiAnalitikSorgu,
  type HapbiAnalitikVarlik,
} from "@/lib/hapbi/analitik/sozlesme";
import { HapbiHata, type HapbiKaynak } from "@/lib/hapbi/sozlesme";
import { ligPeriyoduAraligi } from "@/lib/zaman/kontrol";

export interface HapbiTclubAnalitikHamSatir {
  kullanici_id: string;
  kullanici_adi: string;
  kullanici_rol: string;
  firma_id: string;
  firma_adi: string;
  takim_id: string | null;
  takim_adi: string | null;
  bolge_id: string | null;
  bolge_adi: string | null;
  bm_id: string | null;
  bm_adi: string | null;
  bm_eslesme_durumu: "tek" | "yok" | "coklu";
  urun_id: string | null;
  urun_adi: string | null;
  kategori: string | null;
  arac_turu: string | null;
  yayin_id: string;
  yayin_adi: string;
  tamamlama_sayisi: number;
  benzersiz_yayin_sayisi: number;
  izleme_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  extra_puan: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  challenge_puani?: number;
  challenge_kaybi?: number;
  kazanilan_puan: number;
  kaybedilen_puan: number;
  net_puan: number;
  cevap_sayisi: number;
  dogru_cevap_sayisi: number;
  yanlis_cevap_sayisi: number;
  gonderim_sayisi: number;
}

const TClubOlcutAlani: Partial<Record<HapbiAnalitikOlcut, keyof HapbiTclubAnalitikHamSatir>> = {
  net_puan: "net_puan",
  kazanilan_puan: "kazanilan_puan",
  kaybedilen_puan: "kaybedilen_puan",
  izleme_puani: "izleme_puani",
  cevaplama_puani: "cevaplama_puani",
  oneri_puani: "oneri_puani",
  extra_puan: "extra_puan",
  ileri_sarma_kaybi: "ileri_sarma_kaybi",
  yanlis_cevap_kaybi: "yanlis_cevap_kaybi",
  oneri_kaybi: "oneri_kaybi",
  challenge_puani: "challenge_puani",
  challenge_kaybi: "challenge_kaybi",
  tamamlama_sayisi: "tamamlama_sayisi",
  benzersiz_yayin_sayisi: "benzersiz_yayin_sayisi",
  cevap_sayisi: "cevap_sayisi",
  dogru_cevap_sayisi: "dogru_cevap_sayisi",
  yanlis_cevap_sayisi: "yanlis_cevap_sayisi",
  gonderim_sayisi: "gonderim_sayisi",
};

interface ToplamaGrubu {
  boyutlar: HapbiAnalitikSatir["boyutlar"];
  olcumler: Partial<Record<HapbiAnalitikOlcut, number>>;
  yayinlar: Set<string>;
  kullaniciYayinlari: Set<string>;
}

function varlik(tur: Exclude<HapbiAnalitikBoyut, "zaman">, id: string, ad: string, ust?: string | null): HapbiAnalitikVarlik {
  return { tur, id, ad, ...(ust !== undefined ? { ust_varlik_id: ust } : {}) };
}

function boyutDegeri(satir: HapbiTclubAnalitikHamSatir, boyut: HapbiAnalitikBoyut, donemEtiketi: string) {
  if (boyut === "firma") return varlik("firma", satir.firma_id, satir.firma_adi);
  if (boyut === "takim") return varlik("takim", satir.takim_id ?? "takimsiz", satir.takim_adi ?? "Takımsız", satir.firma_id);
  if (boyut === "bm_kapsami") {
    const ek = satir.bm_eslesme_durumu === "coklu" ? "Birden fazla BM" : "Atanmamış BM kapsamı";
    return varlik("bm_kapsami", satir.bm_id ?? `${satir.takim_id ?? "takimsiz"}:${satir.bolge_id ?? "bolgesiz"}:${satir.bm_eslesme_durumu}`, satir.bm_adi ?? ek, satir.takim_id);
  }
  if (boyut === "kullanici") return varlik("kullanici", satir.kullanici_id, satir.kullanici_adi, satir.bm_id ?? satir.bolge_id);
  if (boyut === "eczane" || boyut === "icerik") throw new HapbiHata("DESTEKLENMEYEN_BOYUT", 400, `${boyut} T-Club/C-Club kaynağında desteklenmiyor.`);
  if (boyut === "urun") return varlik("urun", satir.urun_id ?? "urunsuz", satir.urun_adi ?? "Ürünsüz içerik", satir.takim_id);
  if (boyut === "kategori") return satir.kategori ?? "kategorisiz";
  if (boyut === "arac_turu") return satir.arac_turu ?? "bilinmiyor";
  if (boyut === "yayin") return varlik("yayin", satir.yayin_id, satir.yayin_adi, satir.urun_id);
  if (boyut === "zaman") return donemEtiketi;
  throw new HapbiHata("DESTEKLENMEYEN_BOYUT", 400, `${boyut} T-Club/C-Club kaynağında desteklenmiyor.`);
}

function boyutKimligi(satir: HapbiTclubAnalitikHamSatir, boyut: Exclude<HapbiAnalitikBoyut, "zaman">): string | null {
  if (boyut === "firma") return satir.firma_id;
  if (boyut === "takim") return satir.takim_id;
  if (boyut === "bm_kapsami") return satir.bm_id;
  if (boyut === "kullanici") return satir.kullanici_id;
  if (boyut === "eczane" || boyut === "icerik") return null;
  if (boyut === "urun") return satir.urun_id;
  if (boyut === "kategori") return satir.kategori;
  if (boyut === "arac_turu") return satir.arac_turu;
  if (boyut === "yayin") return satir.yayin_id;
  return null;
}

function donemEtiketi(sorgu: HapbiAnalitikSorgu): string {
  const d = sorgu.donem;
  if (d.tur === "ozel") return `${d.baslangic}/${d.bitis}`;
  if (d.tur === "hafta") return `${d.yil}/hafta:${d.hafta}`;
  if (d.tur === "ay") return `${d.yil}/ay:${d.ay}`;
  if (d.tur === "ceyrek") return `${d.yil}/çeyrek:${d.ceyrek}`;
  return `${d.yil}`;
}

export function hapbiAnalitikDonemiAraligaCevir(sorgu: Pick<HapbiAnalitikSorgu, "donem">) {
  const d = sorgu.donem;
  if (d.tur === "ozel") return { baslangic: d.baslangic, bitis: d.bitis };
  return ligPeriyoduAraligi({
    periyot: d.tur === "ceyrek" ? "donem" : d.tur,
    yil: d.yil,
    ay: d.tur === "ay" ? d.ay : 1,
    ceyrek: d.tur === "ceyrek" ? d.ceyrek : 1,
    hafta: d.tur === "hafta" ? d.hafta : 1,
  });
}

function satirFiltreyeUyarMi(satir: HapbiTclubAnalitikHamSatir, sorgu: HapbiAnalitikSorgu): boolean {
  return sorgu.filtreler.every((filtre) => {
    const kimlik = boyutKimligi(satir, filtre.boyut);
    return kimlik !== null && filtre.kimlikler.includes(kimlik);
  });
}

function grubuDoldur(grup: ToplamaGrubu, satir: HapbiTclubAnalitikHamSatir, olcutler: HapbiAnalitikOlcut[]) {
  for (const olcut of olcutler) {
    if (olcut === "yayin_sayisi" || olcut === "benzersiz_yayin_sayisi") continue;
    const alan = TClubOlcutAlani[olcut];
    if (!alan) throw new HapbiHata("DESTEKLENMEYEN_OLCUT", 400, `${olcut} T-Club analitik kaynağında desteklenmiyor.`);
    grup.olcumler[olcut] = (grup.olcumler[olcut] ?? 0) + Number(satir[alan] ?? 0);
  }
  grup.yayinlar.add(satir.yayin_id);
  if (satir.tamamlama_sayisi > 0) {
    grup.kullaniciYayinlari.add(`${satir.kullanici_id}:${satir.yayin_id}`);
  }
}

function gruplandir(sorgu: HapbiAnalitikSorgu, hamSatirlar: HapbiTclubAnalitikHamSatir[]): ToplamaGrubu[] {
  const gruplar = new Map<string, ToplamaGrubu>();
  const etiket = donemEtiketi(sorgu);
  for (const satir of hamSatirlar) {
    if (!satirFiltreyeUyarMi(satir, sorgu)) continue;
    const boyutlar = Object.fromEntries(sorgu.boyutlar.map((boyut) => [boyut, boyutDegeri(satir, boyut, etiket)]));
    const anahtar = JSON.stringify(boyutlar);
    const grup = gruplar.get(anahtar) ?? { boyutlar, olcumler: {}, yayinlar: new Set<string>(), kullaniciYayinlari: new Set<string>() };
    grubuDoldur(grup, satir, sorgu.olcutler);
    gruplar.set(anahtar, grup);
  }
  return [...gruplar.values()].map((grup) => {
    if (sorgu.olcutler.includes("yayin_sayisi")) grup.olcumler.yayin_sayisi = grup.yayinlar.size;
    if (sorgu.olcutler.includes("benzersiz_yayin_sayisi")) grup.olcumler.benzersiz_yayin_sayisi = grup.kullaniciYayinlari.size;
    return grup;
  });
}

function satirlariSirala(sorgu: HapbiAnalitikSorgu, gruplar: ToplamaGrubu[]): ToplamaGrubu[] {
  const siralama = sorgu.siralama;
  if (!siralama) return gruplar;
  const isaret = siralama.yon === "artan" ? 1 : -1;
  return [...gruplar].sort((a, b) => {
    const fark = Number(a.olcumler[siralama.olcut] ?? 0) - Number(b.olcumler[siralama.olcut] ?? 0);
    return fark === 0 ? JSON.stringify(a.boyutlar).localeCompare(JSON.stringify(b.boyutlar), "tr") : fark * isaret;
  });
}

function olguOznesi(satir: HapbiAnalitikSatir): HapbiAnalitikVarlik | null {
  for (const deger of Object.values(satir.boyutlar)) {
    if (deger && typeof deger === "object" && "id" in deger) return deger as HapbiAnalitikVarlik;
  }
  return null;
}

export function hapbiTclubSatirlariniTopla(
  sorgu: HapbiAnalitikSorgu,
  hamSatirlar: HapbiTclubAnalitikHamSatir[],
  kaynak: HapbiKaynak,
): HapbiAnalitikSonuc {
  hapbiAnalitikSorguyuDogrula(sorgu);
  if (sorgu.veri_alani !== "tclub") throw new HapbiHata("GECERSIZ_VERI_ALANI", 400, "T-Club okuyucusu yalnız T-Club sorgusu kabul eder.");

  const filtrelenmis = hamSatirlar.filter((satir) => satirFiltreyeUyarMi(satir, sorgu));
  const gruplar = gruplandir(sorgu, filtrelenmis);
  const sirali = satirlariSirala(sorgu, gruplar).slice(0, sorgu.limit ?? 100);
  const satirlar: HapbiAnalitikSatir[] = sirali.map((grup) => ({ boyutlar: grup.boyutlar, olcumler: grup.olcumler }));

  const toplamSorgusu: HapbiAnalitikSorgu = { ...sorgu, boyutlar: [], filtreler: [], siralama: undefined, limit: undefined };
  const toplamGrubu = gruplandir(toplamSorgusu, filtrelenmis)[0];
  const toplamlar = toplamGrubu?.olcumler ?? Object.fromEntries(sorgu.olcutler.map((olcut) => [olcut, 0]));
  const olgular = satirlar.flatMap((satir) => {
    const ozne = olguOznesi(satir);
    if (!ozne) return [];
    return Object.entries(satir.olcumler).map(([iliski, deger]) => ({
      ozne,
      iliski: iliski as HapbiAnalitikOlcut,
      deger: Number(deger ?? 0),
      baglam: satir.boyutlar,
    }));
  });
  const cokluBm = filtrelenmis.some((satir) => satir.bm_eslesme_durumu === "coklu");

  return {
    surum: HAPBI_ANALITIK_SURUMU,
    sorgu,
    veri_durumu: filtrelenmis.length ? "var" : "bos",
    satirlar,
    toplamlar,
    olgular,
    kaynaklar: [kaynak],
    tam_mi: !cokluBm && sirali.length === gruplar.length,
    ...(cokluBm ? { sinir_aciklamasi: "Aynı takım ve bölgede birden fazla aktif BM bulunduğu için BM kapsamı tekilleştirilemedi." }
      : sirali.length < gruplar.length ? { sinir_aciklamasi: `Sonuç ${sirali.length} satırla sınırlandı.` } : {}),
  };
}

export function hapbiPuanSatirlariniTopla(
  sorgu: HapbiAnalitikSorgu,
  hamSatirlar: HapbiTclubAnalitikHamSatir[],
  kaynak: HapbiKaynak,
): HapbiAnalitikSonuc {
  hapbiAnalitikSorguyuDogrula(sorgu);
  if (sorgu.veri_alani !== "tclub" && sorgu.veri_alani !== "cclub") {
    throw new HapbiHata("GECERSIZ_VERI_ALANI", 400, "Puan okuyucusu yalnız T-Club veya C-Club sorgusu kabul eder.");
  }

  const tclubSorgusu = sorgu.veri_alani === "tclub" ? sorgu : { ...sorgu, veri_alani: "tclub" as const };
  const sonuc = hapbiTclubSatirlariniTopla(tclubSorgusu, hamSatirlar, kaynak);
  return { ...sonuc, sorgu, veri_durumu: sonuc.veri_durumu };
}

export async function hapbiTclubAnalitikOku(
  db: SupabaseClient,
  sorgu: HapbiAnalitikSorgu,
  kaynak: HapbiKaynak,
): Promise<HapbiAnalitikSonuc> {
  hapbiAnalitikSorguyuDogrula(sorgu);
  if (sorgu.veri_alani !== "tclub") throw new HapbiHata("GECERSIZ_VERI_ALANI", 400, "T-Club okuyucusu yalnız T-Club sorgusu kabul eder.");
  const aralik = hapbiAnalitikDonemiAraligaCevir(sorgu);
  const { data, error } = await db.rpc("get_hapbi_tclub_analitik_v1", {
    p_isteyen_id: sorgu.kapsam.kullanici_id,
    p_baslangic: aralik.baslangic,
    p_bitis: aralik.bitis,
  });
  if (error) {
    console.error("[hapbiTclubAnalitikOku RPC hatası]", error);
    throw new HapbiHata("ANALITIK_KAYNAK", 500, `T-Club analitik verisi okunamadı: ${error.message}`);
  }
  return hapbiTclubSatirlariniTopla(sorgu, (data ?? []) as HapbiTclubAnalitikHamSatir[], kaynak);
}
