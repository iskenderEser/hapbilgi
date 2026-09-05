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
import { hapbiAnalitikDonemiAraligaCevir } from "@/lib/hapbi/analitik/tclubOkuyucu";
import { HapbiHata, type HapbiKaynak } from "@/lib/hapbi/sozlesme";

export interface HapbiUretimAnalitikHamSatir {
  olay_id: string;
  olay_turu: "talep" | "gorev" | "yayin";
  olay_tarihi: string;
  talep_id: string;
  talep_adi: string;
  firma_id: string;
  firma_adi: string;
  takim_id: string | null;
  takim_adi: string | null;
  kullanici_id: string;
  kullanici_adi: string;
  kullanici_rol: string;
  urun_id: string | null;
  urun_adi: string | null;
  kategori: string;
  arac_turu: string;
  yayin_id: string | null;
  yayin_adi: string;
  durum: string;
  uretim_varyanti: string;
  talep_sayisi: number;
  gorev_sayisi: number;
  yayin_sayisi: number;
}

const UretimOlcutAlani: Partial<Record<HapbiAnalitikOlcut, keyof HapbiUretimAnalitikHamSatir>> = {
  talep_sayisi: "talep_sayisi",
  gorev_sayisi: "gorev_sayisi",
  yayin_sayisi: "yayin_sayisi",
};

function varlik(
  tur: Exclude<HapbiAnalitikBoyut, "zaman">,
  id: string,
  ad: string,
  ust?: string | null,
): HapbiAnalitikVarlik {
  return { tur, id, ad, ...(ust !== undefined ? { ust_varlik_id: ust } : {}) };
}

function zamanEtiketi(sorgu: HapbiAnalitikSorgu): string {
  const d = sorgu.donem;
  if (d.tur === "ozel") return `${d.baslangic}/${d.bitis}`;
  if (d.tur === "hafta") return `${d.yil}/hafta:${d.hafta}`;
  if (d.tur === "ay") return `${d.yil}/ay:${d.ay}`;
  if (d.tur === "ceyrek") return `${d.yil}/çeyrek:${d.ceyrek}`;
  return `${d.yil}`;
}

function boyutDegeri(s: HapbiUretimAnalitikHamSatir, b: HapbiAnalitikBoyut, zaman: string) {
  if (b === "firma") return varlik("firma", s.firma_id, s.firma_adi);
  if (b === "takim") return varlik("takim", s.takim_id ?? "takimsiz", s.takim_adi ?? "Takımsız", s.firma_id);
  if (b === "kullanici") return varlik("kullanici", s.kullanici_id, s.kullanici_adi, s.takim_id);
  if (b === "urun") return varlik("urun", s.urun_id ?? "urunsuz", s.urun_adi ?? "Ürünsüz içerik", s.takim_id);
  if (b === "icerik") return varlik("icerik", s.talep_id, s.talep_adi, s.urun_id);
  if (b === "kategori") return s.kategori;
  if (b === "arac_turu") return s.arac_turu;
  if (b === "yayin") return varlik("yayin", s.yayin_id ?? `yayinsiz:${s.talep_id}`, s.yayin_id ? s.yayin_adi : "Henüz yayın değil", s.urun_id);
  if (b === "durum") return s.durum;
  if (b === "uretim_varyanti") return s.uretim_varyanti;
  if (b === "zaman") return zaman;
  throw new HapbiHata("DESTEKLENMEYEN_BOYUT", 400, `${b} üretim analitik kaynağında desteklenmiyor.`);
}

function boyutKimligi(s: HapbiUretimAnalitikHamSatir, b: Exclude<HapbiAnalitikBoyut, "zaman">): string | null {
  if (b === "firma") return s.firma_id;
  if (b === "takim") return s.takim_id;
  if (b === "kullanici") return s.kullanici_id;
  if (b === "urun") return s.urun_id;
  if (b === "icerik") return s.talep_id;
  if (b === "kategori") return s.kategori;
  if (b === "arac_turu") return s.arac_turu;
  if (b === "yayin") return s.yayin_id;
  if (b === "durum") return s.durum;
  if (b === "uretim_varyanti") return s.uretim_varyanti;
  return null;
}

function olguOznesi(satir: HapbiAnalitikSatir): HapbiAnalitikVarlik | null {
  return Object.values(satir.boyutlar).find(
    (deger): deger is HapbiAnalitikVarlik => Boolean(deger && typeof deger === "object" && "id" in deger),
  ) ?? null;
}

export function hapbiUretimSatirlariniTopla(
  sorgu: HapbiAnalitikSorgu,
  hamSatirlar: HapbiUretimAnalitikHamSatir[],
  kaynak: HapbiKaynak,
): HapbiAnalitikSonuc {
  hapbiAnalitikSorguyuDogrula(sorgu);
  if (sorgu.veri_alani !== "uretim") {
    throw new HapbiHata("GECERSIZ_VERI_ALANI", 400, "Üretim okuyucusu yalnız üretim sorgusu kabul eder.");
  }

  const filtrelenmis = hamSatirlar.filter((satir) => sorgu.filtreler.every((filtre) => {
    const kimlik = boyutKimligi(satir, filtre.boyut);
    return kimlik !== null && filtre.kimlikler.includes(kimlik);
  }));
  const zaman = zamanEtiketi(sorgu);
  const gruplar = new Map<string, HapbiAnalitikSatir>();

  for (const satir of filtrelenmis) {
    const boyutlar = Object.fromEntries(sorgu.boyutlar.map((boyut) => [boyut, boyutDegeri(satir, boyut, zaman)]));
    const anahtar = JSON.stringify(boyutlar);
    const grup: HapbiAnalitikSatir = gruplar.get(anahtar) ?? { boyutlar, olcumler: {} };
    for (const olcut of sorgu.olcutler) {
      const alan = UretimOlcutAlani[olcut];
      if (!alan) throw new HapbiHata("DESTEKLENMEYEN_OLCUT", 400, `${olcut} üretim analitik kaynağında desteklenmiyor.`);
      grup.olcumler[olcut] = Number(grup.olcumler[olcut] ?? 0) + Number(satir[alan] ?? 0);
    }
    gruplar.set(anahtar, grup);
  }

  let tumSatirlar = [...gruplar.values()];
  const toplamlar = Object.fromEntries(sorgu.olcutler.map((olcut) => [
    olcut,
    tumSatirlar.reduce((toplam, satir) => toplam + Number(satir.olcumler[olcut] ?? 0), 0),
  ]));
  if (sorgu.siralama) {
    const { olcut, yon } = sorgu.siralama;
    const isaret = yon === "artan" ? 1 : -1;
    tumSatirlar = [...tumSatirlar].sort((a, b) => (
      Number(a.olcumler[olcut] ?? 0) - Number(b.olcumler[olcut] ?? 0)
    ) * isaret);
  }
  const satirlar = tumSatirlar.slice(0, sorgu.limit ?? 100);
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

  return {
    surum: HAPBI_ANALITIK_SURUMU,
    sorgu,
    veri_durumu: filtrelenmis.length ? "var" : "bos",
    satirlar,
    toplamlar,
    olgular,
    kaynaklar: [kaynak],
    tam_mi: satirlar.length === tumSatirlar.length,
    ...(satirlar.length < tumSatirlar.length ? { sinir_aciklamasi: `Sonuç ${satirlar.length} satırla sınırlandı.` } : {}),
  };
}

export async function hapbiUretimAnalitikOku(
  db: SupabaseClient,
  sorgu: HapbiAnalitikSorgu,
  kaynak: HapbiKaynak,
): Promise<HapbiAnalitikSonuc> {
  hapbiAnalitikSorguyuDogrula(sorgu);
  if (sorgu.veri_alani !== "uretim") {
    throw new HapbiHata("GECERSIZ_VERI_ALANI", 400, "Üretim okuyucusu yalnız üretim sorgusu kabul eder.");
  }
  const aralik = hapbiAnalitikDonemiAraligaCevir(sorgu);
  const bitisHaric = new Date(new Date(aralik.bitis).getTime() + 1).toISOString();
  const { data, error } = await db.rpc("get_hapbi_uretim_analitik_v1", {
    p_isteyen_id: sorgu.kapsam.kullanici_id,
    p_baslangic: aralik.baslangic,
    p_bitis_haric: bitisHaric,
  });
  if (error) throw new HapbiHata("ANALITIK_KAYNAK", 500, "Üretim analitik verisi okunamadı.");
  return hapbiUretimSatirlariniTopla(sorgu, (data ?? []) as HapbiUretimAnalitikHamSatir[], kaynak);
}
