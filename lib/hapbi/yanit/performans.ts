import type { SupabaseClient } from "@supabase/supabase-js";
import type { HapbiKirilim } from "../kirilimSozlesmesi";
import type { HapbiOlcut } from "../olcutSozlesmesi";
import { hapbiSorgusunuDogrula, type HapbiSorgu } from "../sozlesme";
import { hapbiSorguPlaniOlustur } from "../motor/sorguOlustur";
import { hapbiSorguPlaniniCalistir } from "../motor/calistir";
import { hapbiMotorSonucunuDogrula } from "../motor/dogrula";
import { hapbiKanitPaketiOlustur, type HapbiKanitPaketi } from "../motor/kanit";

export type HapbiPerformansOzeti = Readonly<{
  gostergeler: readonly Readonly<{
    olcut: HapbiOlcut;
    kirilim: HapbiKirilim;
    durum: "dogrulandi" | "veri_yok_veya_dogrulanamadi";
    degerler: readonly Readonly<{ ad: string; deger: number }>[];
  }>[];
  hesaplananBulgular: readonly string[];
  rakip: Readonly<{
    durum: "dogrulandi" | "karsilastirilabilir_veri_yok";
    aciklama: string;
    bolge?: string;
    netPuan?: number;
    fark?: number;
    konum?: "onde" | "geride" | "esit";
  }>;
}>;

async function kanitOku(db: SupabaseClient, sorgu: HapbiSorgu): Promise<HapbiKanitPaketi | null> {
  if (!hapbiSorgusunuDogrula(sorgu).gecerli) return null;
  const plan = hapbiSorguPlaniOlustur(sorgu);
  if (!plan.basarili) return null;
  const sonuc = await hapbiSorguPlaniniCalistir(db, plan.plan);
  if (!sonuc.basarili || sonuc.sonuc.veriDurumu !== "var") return null;
  const dogrulama = hapbiMotorSonucunuDogrula(sonuc.sonuc, plan.plan);
  const kanit = hapbiKanitPaketiOlustur(dogrulama, plan.plan);
  return kanit.basarili ? kanit.kanit : null;
}

function degerler(kanit: HapbiKanitPaketi): { ad: string; deger: number }[] {
  return kanit.satirlar.flatMap((satir) => {
    const deger = satir.degerler.find((alan) => alan.alan === "sonuc_degeri");
    return deger ? [{ ad: satir.ad, deger: deger.deger }] : [];
  });
}

function analizSorgusu(ana: HapbiSorgu, olcut: HapbiOlcut, kirilim: HapbiKirilim): HapbiSorgu {
  return {
    surum: ana.surum,
    kapsam: ana.kapsam,
    veriAlani: ana.veriAlani,
    zaman: ana.zaman,
    olcut,
    kirilim,
    islem: "dogrudan_deger",
    filtreler: ana.filtreler,
  };
}

async function rakipOku(db: SupabaseClient, ana: HapbiSorgu, anaKanit: HapbiKanitPaketi): Promise<{
  rakip: HapbiPerformansOzeti["rakip"];
  kanit: HapbiKanitPaketi | null;
}> {
  const yok = {
    rakip: { durum: "karsilastirilabilir_veri_yok", aciklama: "Aynı kapsam ve dönemde doğrulanmış rakip farkı yok; yakın/uzak rakip yorumu yapma." } as const,
    kanit: null,
  };
  const { kapsam } = ana;
  if (kapsam.rol !== "bm" || ana.veriAlani !== "tclub" || ana.kirilim !== "bolge"
    || ana.olcut !== "net_puan" || !kapsam.takimId || !kapsam.bolgeId || !ana.zaman
    || ana.karsilastirma || anaKanit.satirlar.length !== 1
    || anaKanit.satirlar[0].anahtar !== kapsam.bolgeId
    || ana.filtreler.some((f) => f.tur !== "varlik" || f.kirilim !== "bolge"
      || f.kimlikler.length !== 1 || f.kimlikler[0] !== kapsam.bolgeId)) return yok;

  // HB Ligi'nin getSahaLig BM kuralı: yalnız aynı firma ve takımın bölge karşılaştırması.
  // Bu kapsam yalnız toplu rakip puanı içindir; ana sorguya veya modele kimlik taşınmaz.
  const { data, error } = await db.from("kullanicilar")
    .select("kullanici_id, bolge_id")
    .eq("firma_id", kapsam.firmaId).eq("takim_id", kapsam.takimId)
    .eq("aktif_mi", true).in("rol", ["utt", "kd_utt"]);
  if (error || !data?.length) return yok;
  const kisiler = data.filter((k) => typeof k.kullanici_id === "string" && typeof k.bolge_id === "string");
  const bolgeler = [...new Set(kisiler.map((k) => k.bolge_id as string))];
  if (!bolgeler.includes(kapsam.bolgeId) || bolgeler.length < 2) return yok;
  const sorgu = analizSorgusu(ana, "net_puan", "bolge");
  const kanit = await kanitOku(db, {
    ...sorgu,
    filtreler: [],
    kapsam: {
      ...kapsam,
      veriAlanlari: {
        ...kapsam.veriAlanlari,
        tclub: {
          ...kapsam.veriAlanlari.tclub,
          bolgeIdleri: bolgeler,
          kullaniciIdleri: kisiler.map((k) => k.kullanici_id as string),
        },
      },
    },
  });
  if (!kanit) return yok;
  const puan = (k: HapbiKanitPaketi["satirlar"][number]) =>
    k.degerler.find((d) => d.alan === "sonuc_degeri")?.deger;
  const kendi = kanit.satirlar.find((k) => k.anahtar === kapsam.bolgeId);
  const kendiPuan = kendi ? puan(kendi) : undefined;
  const anaPuan = puan(anaKanit.satirlar[0]);
  if (kendiPuan === undefined || anaPuan === undefined || Math.abs(kendiPuan - anaPuan) > 0.000001) return yok;
  const adaylar = kanit.satirlar.flatMap((k) => {
    const deger = puan(k);
    return k.anahtar !== kapsam.bolgeId && deger !== undefined
      ? [{ ad: k.ad, puan: deger, fark: deger - kendiPuan }] : [];
  }).sort((a, b) => Math.abs(a.fark) - Math.abs(b.fark) || a.ad.localeCompare(b.ad, "tr"));
  const enYakin = adaylar[0];
  if (!enYakin) return yok;
  return {
    kanit,
    rakip: {
      durum: "dogrulandi",
      aciklama: "Aynı takımda, aynı tarih aralığında net puanı en yakın bölge. Mutlak toplam puan kıyasıdır; ekip büyüklüğüne göre düzeltilmemiştir. Farkın küçük/büyük olduğuna dair sabit bir başarı eşiği yoktur.",
      bolge: enYakin.ad,
      netPuan: enYakin.puan,
      fark: Math.abs(enYakin.fark),
      konum: enYakin.fark > 0 ? "geride" : enYakin.fark < 0 ? "onde" : "esit",
    },
  };
}

export async function hapbiPerformansiniOku(
  db: SupabaseClient,
  ana: HapbiSorgu,
  anaKanit: HapbiKanitPaketi,
): Promise<{ ozet: HapbiPerformansOzeti; kanitlar: HapbiKanitPaketi[]; rakipKaniti: HapbiKanitPaketi | null }> {
  const hedefler: { olcut: HapbiOlcut; kirilim: HapbiKirilim }[] = ana.zaman && !ana.karsilastirma
    && ana.filtreler.every((f) => f.tur === "varlik") ? [
      { olcut: "kazanilan_puan", kirilim: ana.kirilim },
      { olcut: "kaybedilen_puan", kirilim: ana.kirilim },
      { olcut: "kazanilan_izleme_puani", kirilim: ana.kirilim },
      { olcut: "dogru_cevap_sayisi", kirilim: ana.kirilim },
      { olcut: "yanlis_cevap_sayisi", kirilim: ana.kirilim },
      { olcut: "tamamlanan_izleme_sayisi", kirilim: ana.kirilim },
      { olcut: "kazanilan_puan", kirilim: "urun" },
      { olcut: "kaybedilen_puan", kirilim: "urun" },
    ] : [];
  const [sonuclar, rakipSonucu] = await Promise.all([
    Promise.allSettled(hedefler.map((h) => kanitOku(db, analizSorgusu(ana, h.olcut, h.kirilim)))),
    rakipOku(db, ana, anaKanit).catch(() => ({
      rakip: { durum: "karsilastirilabilir_veri_yok", aciklama: "Rakip verisi okunamadı; fark veya rakip stratejisi uydurma." } as const,
      kanit: null,
    })),
  ]);
  const kanitlar: HapbiKanitPaketi[] = [];
  const gostergeler = sonuclar.map((sonuc, i): HapbiPerformansOzeti["gostergeler"][number] => {
    const kanit = sonuc.status === "fulfilled" ? sonuc.value : null;
    if (kanit) kanitlar.push(kanit);
    return {
      ...hedefler[i],
      durum: kanit ? "dogrulandi" : "veri_yok_veya_dogrulanamadi",
      degerler: kanit ? degerler(kanit).sort((a, b) => b.deger - a.deger).slice(0, 3) : [],
    };
  });
  const toplam = (olcut: HapbiOlcut) => {
    const k = kanitlar.find((k) => k.secimOlcutu === olcut && k.kirilim === ana.kirilim);
    return k?.hesaplananToplam ?? null;
  };
  const hesaplananBulgular: string[] = [];
  const kazanim = toplam("kazanilan_puan");
  const kayip = toplam("kaybedilen_puan");
  if (kazanim !== null && kazanim > 0 && kayip !== null && kayip >= 0) {
    const oran = Math.round(kayip / kazanim * 1000) / 10;
    hesaplananBulgular.push(`Gerçekleşmiş kaybın brüt kazanıma oranı: ${oran}%. Bu bir öğrenme başarı oranı veya gelecekte geri kazanılacak puan vaadi değildir.`);
  }
  return {
    ozet: { gostergeler, hesaplananBulgular, rakip: rakipSonucu.rakip },
    kanitlar,
    rakipKaniti: rakipSonucu.kanit,
  };
}
