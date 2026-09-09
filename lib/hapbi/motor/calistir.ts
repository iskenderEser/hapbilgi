import type { SupabaseClient } from "@supabase/supabase-js";

import type { HapbiKirilim } from "../kirilimSozlesmesi";
import type { HapbiOlcut } from "../olcutSozlesmesi";
import type { HapbiDegerFiltresi, HapbiFiltre } from "../sozlesme";
import type {
  HapbiKaynakPlani,
  HapbiOlcutPlani,
  HapbiSorguPlani,
  HapbiSorguTarafiPlani,
} from "./sorguOlustur";

type Kayit = Record<string, unknown>;

type KullaniciBilgisi = Readonly<{
  id: string;
  ad: string;
  rol: string;
  firmaId: string | null;
  takimId: string | null;
  bolgeId: string | null;
}>;

type YayinBilgisi = Readonly<{
  id: string;
  ad: string;
  urunId: string | null;
  firmaId: string | null;
  takimId: string | null;
}>;

type IzlemeBilgisi = Readonly<{
  id: string;
  aktorId: string | null;
  yayinId: string | null;
  urunId: string | null;
}>;

type CalismaBaglami = Readonly<{
  kullanicilar: ReadonlyMap<string, KullaniciBilgisi>;
  yayinlar: ReadonlyMap<string, YayinBilgisi>;
  urunAdlari: ReadonlyMap<string, string>;
  takimAdlari: ReadonlyMap<string, string>;
  bolgeAdlari: ReadonlyMap<string, string>;
  firmaAdlari: ReadonlyMap<string, string>;
  izlemeler: ReadonlyMap<string, IzlemeBilgisi>;
  izinliIzlemeIdleri: ReadonlySet<string>;
}>;

type HamOlcum = Readonly<{
  anahtar: string;
  ad: string;
  deger: number;
  eksik: boolean;
  kayitSayisi: number;
}>;

export type HapbiMotorSatiri = Readonly<{
  anahtar: string;
  ad: string;
  secimDegeri: number | null;
  sonucDegeri: number | null;
  goreliDeger?: number | null;
  solDeger?: number | null;
  sagDeger?: number | null;
  fark?: number | null;
}>;

export type HapbiMotorSonucu = Readonly<{
  veriDurumu: "var" | "bos" | "eksik";
  veriAlani: HapbiSorguPlani["veriAlani"];
  islem: HapbiSorguPlani["islem"];
  kirilim: HapbiKirilim;
  secimOlcutu: HapbiOlcut;
  sonucOlcutu: HapbiOlcut;
  satirlar: readonly HapbiMotorSatiri[];
  kaynaklar: readonly string[];
}>;

export type HapbiMotorCalistirmaSonucu =
  | Readonly<{ basarili: true; sonuc: HapbiMotorSonucu }>
  | Readonly<{
    basarili: false;
    neden: "veri_okunamadi" | "kaynak_plani_gecersiz";
    kaynak?: string;
    ayrinti?: string;
  }>;

function metin(deger: unknown): string | null {
  return typeof deger === "string" && deger.length > 0 ? deger : null;
}

function sayi(deger: unknown): number | null {
  if (typeof deger === "number" && Number.isFinite(deger)) return deger;
  if (typeof deger === "string" && deger.trim() !== "") {
    const sonuc = Number(deger);
    return Number.isFinite(sonuc) ? sonuc : null;
  }
  return null;
}

function adSoyad(kayit: Kayit): string {
  return [metin(kayit.ad), metin(kayit.soyad)].filter(Boolean).join(" ");
}

async function satirlariOku(
  supabase: SupabaseClient,
  tablo: string,
  alanlar: readonly string[],
  kosullar: ReadonlyArray<Readonly<{ alan: string; degerler: readonly string[] }>> = [],
): Promise<{ data: Kayit[]; error: string | null }> {
  if (kosullar.some((kosul) => kosul.degerler.length === 0)) return { data: [], error: null };

  let sorgu = supabase.from(tablo).select([...new Set(alanlar)].join(","));
  for (const kosul of kosullar) sorgu = sorgu.in(kosul.alan, [...kosul.degerler]);
  const { data, error } = await sorgu;
  return {
    data: (data ?? []) as unknown as Kayit[],
    error: error?.message ?? null,
  };
}

async function baglamiOlustur(
  supabase: SupabaseClient,
  plan: HapbiSorguPlani,
  taraf: HapbiSorguTarafiPlani,
): Promise<{ baglam: CalismaBaglami | null; hata: string | null }> {
  const alanKapsami = taraf.kapsam.veriAlanlari[plan.veriAlani];
  const kullaniciIdleri = [...alanKapsami.kullaniciIdleri];
  const yayinIdleri = [...alanKapsami.yayinIdleri];

  const [kullaniciSonucu, yayinSonucu, takimSonucu, bolgeSonucu, firmaSonucu] = await Promise.all([
    satirlariOku(supabase, "kullanicilar", ["kullanici_id", "ad", "soyad", "rol", "firma_id", "takim_id", "bolge_id"], [
      { alan: "kullanici_id", degerler: kullaniciIdleri },
    ]),
    satirlariOku(supabase, "v_yayin_kunye", ["yayin_id", "urun_id", "firma_id", "takim_id"], [
      { alan: "yayin_id", degerler: yayinIdleri },
    ]),
    satirlariOku(supabase, "takimlar", ["takim_id", "takim_adi"], [
      { alan: "takim_id", degerler: alanKapsami.takimIdleri },
    ]),
    satirlariOku(supabase, "bolgeler", ["bolge_id", "bolge_adi"], [
      { alan: "bolge_id", degerler: alanKapsami.bolgeIdleri },
    ]),
    satirlariOku(supabase, "firmalar", ["firma_id", "firma_adi"], [
      { alan: "firma_id", degerler: alanKapsami.firmaIdleri },
    ]),
  ]);

  const temelHata = [kullaniciSonucu, yayinSonucu, takimSonucu, bolgeSonucu, firmaSonucu]
    .find((sonuc) => sonuc.error)?.error;
  if (temelHata) return { baglam: null, hata: temelHata };

  const kullanicilar = new Map<string, KullaniciBilgisi>();
  for (const kayit of kullaniciSonucu.data) {
    const id = metin(kayit.kullanici_id);
    if (!id) continue;
    kullanicilar.set(id, {
      id,
      ad: adSoyad(kayit) || id,
      rol: metin(kayit.rol) ?? "",
      firmaId: metin(kayit.firma_id),
      takimId: metin(kayit.takim_id),
      bolgeId: metin(kayit.bolge_id),
    });
  }

  const yayinlar = new Map<string, YayinBilgisi>();
  for (const kayit of yayinSonucu.data) {
    const id = metin(kayit.yayin_id);
    if (!id) continue;
    yayinlar.set(id, {
      id,
      ad: id,
      urunId: metin(kayit.urun_id),
      firmaId: metin(kayit.firma_id),
      takimId: metin(kayit.takim_id),
    });
  }

  const urunIdleri = [...new Set([...yayinlar.values()].map((yayin) => yayin.urunId).filter((id): id is string => Boolean(id)))];
  const [urunSonucu, yayinAdSonucu] = await Promise.all([
    satirlariOku(supabase, "urunler", ["urun_id", "urun_adi"], [{ alan: "urun_id", degerler: urunIdleri }]),
    satirlariOku(supabase, "v_yayin_detay", ["yayin_id", "urun_adi", "teknik_adi", "talep_no"], [
      { alan: "yayin_id", degerler: yayinIdleri },
    ]),
  ]);
  if (urunSonucu.error || yayinAdSonucu.error) {
    return { baglam: null, hata: urunSonucu.error ?? yayinAdSonucu.error };
  }

  const urunAdlari = new Map<string, string>();
  for (const kayit of urunSonucu.data) {
    const id = metin(kayit.urun_id);
    if (id) urunAdlari.set(id, metin(kayit.urun_adi) ?? id);
  }
  for (const kayit of yayinAdSonucu.data) {
    const id = metin(kayit.yayin_id);
    const yayin = id ? yayinlar.get(id) : null;
    if (!id || !yayin || yayin.ad !== id) continue;
    const ad = metin(kayit.urun_adi) ?? metin(kayit.teknik_adi) ?? metin(kayit.talep_no) ?? id;
    yayinlar.set(id, { ...yayin, ad });
  }

  const izlemeler = new Map<string, IzlemeBilgisi>();
  const izinliIzlemeIdleri = new Set<string>();

  const cclub = plan.veriAlani === "cclub";
  const izlemeSonucu = await satirlariOku(
    supabase,
    cclub ? "cc_izleme_kayitlari" : "izleme_kayitlari",
    cclub
      ? ["izleme_id", "bm_id", "yayin_id"]
      : ["izleme_id", "kullanici_id", "yayin_id"],
    [
      { alan: cclub ? "bm_id" : "kullanici_id", degerler: kullaniciIdleri },
      { alan: "yayin_id", degerler: yayinIdleri },
    ],
  );
  if (izlemeSonucu.error) return { baglam: null, hata: izlemeSonucu.error };
  for (const kayit of izlemeSonucu.data) {
    const id = metin(kayit.izleme_id);
    if (!id) continue;
    izlemeler.set(id, {
      id,
      aktorId: metin(cclub ? kayit.bm_id : kayit.kullanici_id),
      yayinId: metin(kayit.yayin_id),
      urunId: null,
    });
    izinliIzlemeIdleri.add(id);
  }

  return {
    baglam: {
      kullanicilar,
      yayinlar,
      urunAdlari,
      takimAdlari: new Map(takimSonucu.data.flatMap((kayit) => {
        const id = metin(kayit.takim_id);
        return id ? [[id, metin(kayit.takim_adi) ?? id] as const] : [];
      })),
      bolgeAdlari: new Map(bolgeSonucu.data.flatMap((kayit) => {
        const id = metin(kayit.bolge_id);
        return id ? [[id, metin(kayit.bolge_adi) ?? id] as const] : [];
      })),
      firmaAdlari: new Map(firmaSonucu.data.flatMap((kayit) => {
        const id = metin(kayit.firma_id);
        return id ? [[id, metin(kayit.firma_adi) ?? id] as const] : [];
      })),
      izlemeler,
      izinliIzlemeIdleri,
    },
    hata: null,
  };
}

function kapsamKosulu(
  kaynak: HapbiKaynakPlani,
  baglam: CalismaBaglami,
): Readonly<{ alan: string; degerler: readonly string[] }> {
  if (kaynak.kapsamYolu === "dogrudan_yayin") return { alan: "yayin_id", degerler: kaynak.kapsamYayinIdleri };
  if (kaynak.kapsamYolu === "dogrudan_kullanici") return { alan: "kullanici_id", degerler: kaynak.kapsamKullaniciIdleri };
  if (kaynak.kapsamYolu === "dogrudan_bm") return { alan: "bm_id", degerler: kaynak.kapsamKullaniciIdleri };
  return { alan: "izleme_id", degerler: [...baglam.izinliIzlemeIdleri] };
}

function satirYetkiliMi(kayit: Kayit, kaynak: HapbiKaynakPlani, baglam: CalismaBaglami): boolean {
  const yayinId = metin(kayit.yayin_id);
  if (yayinId && !kaynak.kapsamYayinIdleri.includes(yayinId)) return false;
  const izlemeId = metin(kayit.izleme_id);
  if (izlemeId && !baglam.izinliIzlemeIdleri.has(izlemeId)) return false;
  return true;
}

function aktorVeYayin(
  kayit: Kayit,
  baglam: CalismaBaglami,
): { aktorId: string | null; yayinId: string | null; urunId: string | null } {
  const izleme = metin(kayit.izleme_id) ? baglam.izlemeler.get(metin(kayit.izleme_id)!) : null;
  const aktorId = metin(kayit.kullanici_id)
    ?? metin(kayit.bm_id)
    ?? izleme?.aktorId
    ?? null;
  const yayinId = metin(kayit.yayin_id) ?? izleme?.yayinId ?? null;
  return {
    aktorId,
    yayinId,
    urunId: metin(kayit.urun_id) ?? izleme?.urunId ?? (yayinId ? baglam.yayinlar.get(yayinId)?.urunId ?? null : null),
  };
}

function kirilimDegeri(
  kayit: Kayit,
  kirilim: HapbiKirilim,
  baglam: CalismaBaglami,
): { anahtar: string; ad: string } | null {
  const bag = aktorVeYayin(kayit, baglam);
  const kullanici = bag.aktorId ? baglam.kullanicilar.get(bag.aktorId) : null;

  if (kirilim === "kullanici") {
    const id = bag.aktorId;
    if (!id) return null;
    return { anahtar: id, ad: kullanici?.ad ?? id };
  }
  if (kirilim === "utt") {
    if (!bag.aktorId) return null;
    return { anahtar: bag.aktorId, ad: kullanici?.ad ?? bag.aktorId };
  }
  if (kirilim === "yayin") {
    if (!bag.yayinId) return null;
    return { anahtar: bag.yayinId, ad: baglam.yayinlar.get(bag.yayinId)?.ad ?? bag.yayinId };
  }
  if (kirilim === "urun") {
    if (!bag.urunId) return null;
    return { anahtar: bag.urunId, ad: baglam.urunAdlari.get(bag.urunId) ?? bag.urunId };
  }

  const yayin = bag.yayinId ? baglam.yayinlar.get(bag.yayinId) : null;
  const takimId = kullanici?.takimId ?? yayin?.takimId ?? null;
  const bolgeId = kullanici?.bolgeId ?? null;
  const firmaId = kullanici?.firmaId ?? yayin?.firmaId ?? null;
  if (kirilim === "takim" && takimId) return { anahtar: takimId, ad: baglam.takimAdlari.get(takimId) ?? takimId };
  if (kirilim === "bolge" && bolgeId) return { anahtar: bolgeId, ad: baglam.bolgeAdlari.get(bolgeId) ?? bolgeId };
  if (kirilim === "firma" && firmaId) return { anahtar: firmaId, ad: baglam.firmaAdlari.get(firmaId) ?? firmaId };
  return null;
}

function sabitFiltreleriUygula(kayit: Kayit, filtreler: readonly HapbiKaynakPlani["sabitFiltreler"][number][]): boolean {
  return filtreler.every((filtre) => kayit[filtre.alan] === filtre.deger);
}

async function kaynagiOlc(
  supabase: SupabaseClient,
  kaynak: HapbiKaynakPlani,
  taraf: HapbiSorguTarafiPlani,
  kirilim: HapbiKirilim,
  baglam: CalismaBaglami,
): Promise<{ olcumler: HamOlcum[]; hata: string | null }> {
  let sorgu = supabase
    .from(kaynak.tablo)
    .select(kaynak.secilecekAlanlar.join(","));

  if (kaynak.zamanAlani && taraf.zaman) {
    sorgu = sorgu
      .gte(kaynak.zamanAlani, taraf.zaman.baslangic)
      .lt(kaynak.zamanAlani, taraf.zaman.bitis);
  }

  const kapsam = kapsamKosulu(kaynak, baglam);
  if (kapsam.degerler.length === 0) return { olcumler: [], hata: null };
  sorgu = sorgu.in(kapsam.alan, [...kapsam.degerler]);
  if (kaynak.secilecekAlanlar.includes("yayin_id") && kaynak.kapsamYayinIdleri.length > 0) {
    sorgu = sorgu.in("yayin_id", [...kaynak.kapsamYayinIdleri]);
  }
  for (const filtre of kaynak.sabitFiltreler) sorgu = sorgu.eq(filtre.alan, filtre.deger);

  const { data, error } = await sorgu;
  if (error) return { olcumler: [], hata: error.message };

  const gruplar = new Map<string, { ad: string; deger: number; eksik: boolean; kayitSayisi: number }>();
  const atanmisYayinPuanlari = new Map<string, number | null>();
  for (const kayit of (data ?? []) as unknown as Kayit[]) {
    if (!satirYetkiliMi(kayit, kaynak, baglam) || !sabitFiltreleriUygula(kayit, kaynak.sabitFiltreler)) continue;
    const grup = kirilimDegeri(kayit, kirilim, baglam);
    if (!grup) continue;
    const mevcut = gruplar.get(grup.anahtar) ?? { ad: grup.ad, deger: 0, eksik: false, kayitSayisi: 0 };
    if (kaynak.kapsamYolu === "dogrudan_yayin") {
      const yayinId = metin(kayit.yayin_id);
      if (!yayinId) continue;
      const puan = sayi(kayit[kaynak.degerAlani]);
      if (atanmisYayinPuanlari.has(yayinId)) {
        if (atanmisYayinPuanlari.get(yayinId) !== puan) {
          gruplar.set(grup.anahtar, { ...mevcut, eksik: true });
        }
        continue;
      }
      atanmisYayinPuanlari.set(yayinId, puan);
    }
    const deger = kaynak.hesaplama === "kayit_say" || kaynak.hesaplama === "kosullu_kayit_say"
      ? 1
      : sayi(kayit[kaynak.degerAlani]);
    gruplar.set(grup.anahtar, {
      ad: grup.ad,
      deger: mevcut.deger + (deger ?? 0),
      eksik: mevcut.eksik || deger === null,
      kayitSayisi: mevcut.kayitSayisi + 1,
    });
  }

  return {
    olcumler: [...gruplar.entries()].map(([anahtar, olcum]) => ({ anahtar, ...olcum })),
    hata: null,
  };
}

async function olcutuOlc(
  supabase: SupabaseClient,
  plan: HapbiOlcutPlani,
  taraf: HapbiSorguTarafiPlani,
  kirilim: HapbiKirilim,
  baglam: CalismaBaglami,
): Promise<{ olcumler: HamOlcum[]; hata: string | null; kaynak?: string }> {
  const birlesik = new Map<string, { ad: string; deger: number; eksik: boolean; kayitSayisi: number }>();
  for (const kaynak of plan.kaynaklar) {
    const sonuc = await kaynagiOlc(supabase, kaynak, taraf, kirilim, baglam);
    if (sonuc.hata) return { olcumler: [], hata: sonuc.hata, kaynak: kaynak.tablo };
    for (const olcum of sonuc.olcumler) {
      const mevcut = birlesik.get(olcum.anahtar) ?? { ad: olcum.ad, deger: 0, eksik: false, kayitSayisi: 0 };
      const isaret = kaynak.hesaplamadakiRolu === "cikarilan" ? -1 : 1;
      birlesik.set(olcum.anahtar, {
        ad: olcum.ad,
        deger: mevcut.deger + isaret * olcum.deger,
        eksik: mevcut.eksik || olcum.eksik,
        kayitSayisi: mevcut.kayitSayisi + olcum.kayitSayisi,
      });
    }
  }
  return {
    olcumler: [...birlesik.entries()].map(([anahtar, olcum]) => ({ anahtar, ...olcum })),
    hata: null,
  };
}

function degerKosulunuSaglar(deger: number, filtre: HapbiDegerFiltresi): boolean {
  if (filtre.karsilastirma === "esittir") return deger === filtre.deger;
  if (filtre.karsilastirma === "buyuk") return deger > filtre.deger;
  if (filtre.karsilastirma === "buyuk_esit") return deger >= filtre.deger;
  if (filtre.karsilastirma === "kucuk") return deger < filtre.deger;
  return deger <= filtre.deger;
}

function sonucFiltreleriniUygula(
  satirlar: HapbiMotorSatiri[],
  filtreler: readonly HapbiFiltre[],
): HapbiMotorSatiri[] {
  const degerFiltreleri = filtreler.filter((filtre): filtre is HapbiDegerFiltresi => filtre.tur === "deger");
  return satirlar.filter((satir) => degerFiltreleri.every((filtre) => {
    const deger = satir.sonucDegeri;
    return deger !== null && degerKosulunuSaglar(deger, filtre);
  }));
}

function siralaVeSinirla(satirlar: HapbiMotorSatiri[], plan: HapbiSorguPlani): HapbiMotorSatiri[] {
  const sirali = [...satirlar];
  if (plan.siralama) {
    const carpan = plan.siralama.yon === "artan" ? 1 : -1;
    sirali.sort((sol, sag) => {
      const solDeger = plan.siralama?.olcut === plan.secimOlcutu.olcut ? sol.secimDegeri : sol.sonucDegeri;
      const sagDeger = plan.siralama?.olcut === plan.secimOlcutu.olcut ? sag.secimDegeri : sag.sonucDegeri;
      if (solDeger === null) return 1;
      if (sagDeger === null) return -1;
      return (solDeger - sagDeger) * carpan || sol.ad.localeCompare(sag.ad, "tr");
    });
  }
  return plan.sonucSiniri === null ? sirali : sirali.slice(0, plan.sonucSiniri);
}

async function tarafiCalistir(
  supabase: SupabaseClient,
  plan: HapbiSorguPlani,
  taraf: HapbiSorguTarafiPlani,
): Promise<{ satirlar: HapbiMotorSatiri[]; eksik: boolean; hata: string | null; kaynak?: string }> {
  const baglamSonucu = await baglamiOlustur(supabase, plan, taraf);
  if (!baglamSonucu.baglam) return { satirlar: [], eksik: false, hata: baglamSonucu.hata };

  const secim = await olcutuOlc(supabase, plan.secimOlcutu, taraf, plan.kirilim, baglamSonucu.baglam);
  if (secim.hata) return { satirlar: [], eksik: false, hata: secim.hata, kaynak: secim.kaynak };
  const sonuc = plan.sonucOlcutu.olcut === plan.secimOlcutu.olcut
    ? secim
    : await olcutuOlc(supabase, plan.sonucOlcutu, taraf, plan.kirilim, baglamSonucu.baglam);
  if (sonuc.hata) return { satirlar: [], eksik: false, hata: sonuc.hata, kaynak: sonuc.kaynak };

  const secimHaritasi = new Map(secim.olcumler.map((olcum) => [olcum.anahtar, olcum]));
  const sonucHaritasi = new Map(sonuc.olcumler.map((olcum) => [olcum.anahtar, olcum]));
  const anahtarlar = new Set([...secimHaritasi.keys(), ...sonucHaritasi.keys()]);
  let satirlar = [...anahtarlar].map((anahtar): HapbiMotorSatiri => {
    const secimOlcumu = secimHaritasi.get(anahtar);
    const sonucOlcumu = sonucHaritasi.get(anahtar);
    return {
      anahtar,
      ad: secimOlcumu?.ad ?? sonucOlcumu?.ad ?? anahtar,
      secimDegeri: secimOlcumu && !secimOlcumu.eksik ? secimOlcumu.deger : null,
      sonucDegeri: sonucOlcumu && !sonucOlcumu.eksik ? sonucOlcumu.deger : null,
    };
  });

  satirlar = sonucFiltreleriniUygula(satirlar, taraf.filtreler);
  if (plan.islem === "goreli_hesaplama" || plan.islem === "katki") {
    const toplam = satirlar.reduce((birikim, satir) => birikim + (satir.sonucDegeri ?? 0), 0);
    satirlar = satirlar.map((satir) => ({
      ...satir,
      goreliDeger: satir.sonucDegeri === null || toplam === 0 ? null : satir.sonucDegeri / toplam,
    }));
  }

  return {
    satirlar: siralaVeSinirla(satirlar, plan),
    eksik: [...secim.olcumler, ...sonuc.olcumler].some((olcum) => olcum.eksik),
    hata: null,
  };
}

export async function hapbiSorguPlaniniCalistir(
  supabase: SupabaseClient,
  plan: HapbiSorguPlani,
): Promise<HapbiMotorCalistirmaSonucu> {
  const tarafSonuclari = [];
  for (const taraf of plan.taraflar) {
    const sonuc = await tarafiCalistir(supabase, plan, taraf);
    if (sonuc.hata) {
      return {
        basarili: false,
        neden: "veri_okunamadi",
        kaynak: sonuc.kaynak,
        ayrinti: sonuc.hata,
      };
    }
    tarafSonuclari.push({ taraf, ...sonuc });
  }

  let satirlar: HapbiMotorSatiri[];
  if (tarafSonuclari.length === 2) {
    const sol = new Map(tarafSonuclari[0].satirlar.map((satir) => [satir.anahtar, satir]));
    const sag = new Map(tarafSonuclari[1].satirlar.map((satir) => [satir.anahtar, satir]));
    const anahtarlar = new Set([...sol.keys(), ...sag.keys()]);
    satirlar = [...anahtarlar].map((anahtar) => {
      const solSatir = sol.get(anahtar);
      const sagSatir = sag.get(anahtar);
      const solDeger = solSatir?.sonucDegeri ?? null;
      const sagDeger = sagSatir?.sonucDegeri ?? null;
      return {
        anahtar,
        ad: solSatir?.ad ?? sagSatir?.ad ?? anahtar,
        secimDegeri: solSatir?.secimDegeri ?? null,
        sonucDegeri: solDeger !== null && sagDeger !== null ? solDeger - sagDeger : null,
        solDeger,
        sagDeger,
        fark: solDeger !== null && sagDeger !== null ? solDeger - sagDeger : null,
      };
    });
    satirlar = siralaVeSinirla(satirlar, plan);
  } else {
    satirlar = tarafSonuclari[0]?.satirlar ?? [];
  }

  const eksik = tarafSonuclari.some((sonuc) => sonuc.eksik)
    || satirlar.some((satir) => satir.sonucDegeri === null);
  const kaynaklar = [...new Set([
    ...plan.secimOlcutu.kaynaklar.map((kaynak) => kaynak.tablo),
    ...plan.sonucOlcutu.kaynaklar.map((kaynak) => kaynak.tablo),
  ])];

  return {
    basarili: true,
    sonuc: {
      veriDurumu: eksik ? "eksik" : satirlar.length === 0 ? "bos" : "var",
      veriAlani: plan.veriAlani,
      islem: plan.islem,
      kirilim: plan.kirilim,
      secimOlcutu: plan.secimOlcutu.olcut,
      sonucOlcutu: plan.sonucOlcutu.olcut,
      satirlar,
      kaynaklar,
    },
  };
}
