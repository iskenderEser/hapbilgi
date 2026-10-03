import type { SupabaseClient } from "@supabase/supabase-js";
import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";
import { gorunenUrunIdHaritasi } from "@/lib/urunler/gorunenId";
import { talepIdGoster } from "@/lib/utils/talepId";

export type UttMutabakatKarari = "onay" | "beklet" | "ret";
export type UttMutabakatFiltresi = "tumu" | "bekliyor" | UttMutabakatKarari;
export type MutabakatOnayDurumu = "utt_hazirliginda" | "bm_onayinda" | "tm_onayinda" | "onaylandi" | "tm_reddetti";
export type MutabakatOnayRolu = "utt" | "bm" | "tm";

const MUTABAKAT_ONAY_DURUMU_ETIKETLERI: Record<MutabakatOnayRolu, Record<MutabakatOnayDurumu, string>> = {
  utt: {
    utt_hazirliginda: "UTT Kararı Bekleniyor",
    bm_onayinda: "BM Onayı Bekleniyor",
    tm_onayinda: "TM Onayı Bekleniyor",
    onaylandi: "Onaylandı",
    tm_reddetti: "TM Reddetti",
  },
  bm: {
    utt_hazirliginda: "UTT İşlemi Bekleniyor",
    bm_onayinda: "BM Onayınız Bekleniyor",
    tm_onayinda: "TM Onayı Bekleniyor",
    onaylandi: "TM Onayladı",
    tm_reddetti: "TM Reddetti",
  },
  tm: {
    utt_hazirliginda: "UTT İşlemi Bekleniyor",
    bm_onayinda: "BM Onayı Bekleniyor",
    tm_onayinda: "TM Onayınız Bekleniyor",
    onaylandi: "Onaylandı",
    tm_reddetti: "Reddedildi",
  },
};

export function mutabakatOnayDurumuEtiketi(
  rol: MutabakatOnayRolu,
  durum: MutabakatOnayDurumu,
  uttKarariVarMi = false,
): string {
  if (rol === "utt" && durum === "utt_hazirliginda" && uttKarariVarMi) {
    return "BM Onayına Gönderilmeyi Bekliyor";
  }
  return MUTABAKAT_ONAY_DURUMU_ETIKETLERI[rol][durum];
}

export function uttMutabakatSonucEtiketi(
  karar: UttMutabakatKarari | null,
  onayDurumu: MutabakatOnayDurumu,
): string {
  if (karar === "beklet") return "Beklemede";
  if (karar === "ret") return "Reddedildi";
  if (karar === "onay" && onayDurumu === "bm_onayinda") return "BM Onayında";
  if (karar === "onay" && onayDurumu === "tm_onayinda") return "TM Onayında";
  if (karar === "onay" && onayDurumu === "onaylandi") return "Onaylandı";
  if (karar === "onay" && onayDurumu === "tm_reddetti") return "TM Reddetti";
  if (karar === "onay") return "BM Onayına Gönder";
  return "Karar Bekliyor";
}

export interface UttMutabakatKaynagi {
  yayin_id: string;
  gorunen_talep_id?: string | null;
  arac_id: string;
  arac_turu: OgrenmeAraciTuru;
  teknik_adi: string | null;
  pm_ogrenme_puani: number | null;
  kullanilan_puan: number;
}

export interface UttMutabakatKararGecmisi {
  surum: number;
  karar: UttMutabakatKarari;
  karar_tarihi: string;
}

export interface UttMutabakatKaydi {
  mutabakat_id: string;
  gorunen_indirim_id?: string | null;
  eczane_id: string;
  eczane_adi: string | null;
  urun_id: string;
  urun_adi: string;
  gorunen_urun_id?: string | null;
  onay_tarihi: string;
  kullanilan_puan: number;
  indirim_tl: number;
  tarife_puan: number;
  tarife_tl: number;
  satis_fiyati: number | null;
  utt_karar: UttMutabakatKarari | null;
  utt_karar_tarihi: string | null;
  karar_surumu: number;
  onay_durumu: MutabakatOnayDurumu;
  bm_id: string | null;
  utt_gonderim_tarihi: string | null;
  bm_karar: UttMutabakatKarari | null;
  bm_karar_tarihi: string | null;
  bm_karar_surumu: number;
  bm_onay_tarihi: string | null;
  tm_id: string | null;
  tm_karar: UttMutabakatKarari | null;
  tm_karar_tarihi: string | null;
  tm_karar_surumu: number;
  tm_onay_tarihi: string | null;
  kaynaklar: UttMutabakatKaynagi[];
  karar_gecmisi: UttMutabakatKararGecmisi[];
}

export function mutabakatRolSonucEtiketi(kayit: UttMutabakatKaydi, rol: MutabakatOnayRolu): string {
  if (rol === "utt") return uttMutabakatSonucEtiketi(kayit.utt_karar, kayit.onay_durumu);
  if (rol === "bm") {
    if (kayit.onay_durumu === "tm_onayinda") return "TM Onayında";
    if (kayit.onay_durumu === "tm_reddetti") return "TM Reddetti";
    if (kayit.onay_durumu === "onaylandi") return "TM Onayladı";
    if (kayit.bm_karar === "beklet") return "Beklemede";
    if (kayit.bm_karar === "ret") return "Reddedildi";
    return "Karar Bekliyor";
  }
  if (kayit.onay_durumu === "onaylandi") return "Onaylandı";
  if (kayit.onay_durumu === "tm_reddetti") return "Reddedildi";
  if (kayit.tm_karar === "beklet") return "Beklemede";
  return "Karar Bekliyor";
}

export interface UttMutabakatListesi {
  donem: string;
  karar_penceresi_acik: boolean;
  toplam: number;
  toplam_puan: number;
  toplam_indirim_tl: number;
  kayitlar: UttMutabakatKaydi[];
}

export interface UttMutabakatUrunSatiri {
  urun_id: string;
  urun_adi: string;
  gorunen_urun_id: string | null;
  islem_sayisi: number;
  toplam_puan: number;
  toplam_indirim_tl: number;
}

export interface UttMutabakatUrunListesi extends Omit<UttMutabakatListesi, "kayitlar"> {
  toplam_urun: number;
  urunler: UttMutabakatUrunSatiri[];
}

export interface UttMutabakatUrunIslemleri {
  toplam: number;
  kayitlar: UttMutabakatKaydi[];
}

export interface UttMutabakatEczaneSatiri {
  eczane_id: string;
  eczane_adi: string | null;
  islem_sayisi: number;
  toplam_puan: number;
  toplam_indirim_tl: number;
}

export interface UttMutabakatEczaneListesi extends Omit<UttMutabakatListesi, "kayitlar"> {
  toplam_eczane: number;
  eczaneler: UttMutabakatEczaneSatiri[];
}

export interface UttMutabakatEczaneIslemleri {
  toplam: number;
  urun_secenekleri: { urun_id: string; urun_adi: string; gorunen_urun_id: string | null }[];
  kayitlar: UttMutabakatKaydi[];
}

export interface UttMutabakatKararSonucu {
  mutabakat_id: string;
  karar: UttMutabakatKarari;
  karar_tarihi: string;
  surum: number;
}

export interface BmMutabakatKararSonucu {
  mutabakat_id: string;
  karar: UttMutabakatKarari;
  karar_tarihi: string;
  surum: number;
}

export interface TmMutabakatKararSonucu extends BmMutabakatKararSonucu {
  onay_durumu: MutabakatOnayDurumu;
  tm_onay_tarihi: string | null;
}

export interface MutabakatOnaySonucu {
  mutabakat_id: string;
  onay_durumu: MutabakatOnayDurumu;
  bm_id?: string | null;
  tm_id?: string | null;
  utt_gonderim_tarihi?: string | null;
  bm_karar?: UttMutabakatKarari | null;
  bm_karar_tarihi?: string | null;
  bm_karar_surumu?: number;
  bm_onay_tarihi?: string | null;
  tm_karar?: UttMutabakatKarari | null;
  tm_karar_tarihi?: string | null;
  tm_karar_surumu?: number;
  tm_onay_tarihi?: string | null;
}

export const UTT_MUTABAKAT_SAYFA_BOYUTU = 20;
export const UTT_MUTABAKAT_DURUMLARI: readonly UttMutabakatFiltresi[] = [
  "tumu", "bekliyor", "onay", "beklet", "ret",
];
export const UTT_MUTABAKAT_KARARLARI: readonly UttMutabakatKarari[] = ["onay", "beklet", "ret"];

export function varsayilanUttMutabakatDonemi(simdi: Date = new Date()): string {
  const parcalar = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit",
  }).formatToParts(simdi);
  const yil = Number(parcalar.find((parca) => parca.type === "year")?.value);
  const ay = Number(parcalar.find((parca) => parca.type === "month")?.value);
  const oncekiAy = ay === 1 ? 12 : ay - 1;
  return `${ay === 1 ? yil - 1 : yil}-${String(oncekiAy).padStart(2, "0")}`;
}

export function uttMutabakatDonemiGecerliMi(donem: string): boolean {
  return /^(20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/.test(donem);
}

export function uttMutabakatIdGecerliMi(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export async function uttMutabakatlariListele(
  db: SupabaseClient,
  uttAuthId: string,
  donem: string,
  durum: UttMutabakatFiltresi,
  sayfa: number,
): Promise<UttMutabakatListesi> {
  const { data, error } = await db.rpc("eczanem_utt_mutabakat_listele", {
    p_utt_id: uttAuthId,
    p_donem: `${donem}-01`,
    p_durum: durum,
    p_limit: UTT_MUTABAKAT_SAYFA_BOYUTU,
    p_offset: sayfa * UTT_MUTABAKAT_SAYFA_BOYUTU,
  });
  if (error) throw new Error(`UTT mutabakat listesi alınamadı: ${error.code ?? "DB"}`);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("UTT mutabakat liste yanıtı geçersiz.");
  }
  const liste = data as UttMutabakatListesi;
  return { ...liste, kayitlar: await uttMutabakatKayitlariniZenginlestir(db, uttAuthId, liste.kayitlar) };
}

export async function tumUttMutabakatKayitlariniListele(
  db: SupabaseClient,
  uttAuthId: string,
  donem: string,
  durum: UttMutabakatFiltresi,
): Promise<UttMutabakatKaydi[]> {
  const ilkSayfa = await uttMutabakatlariListele(db, uttAuthId, donem, durum, 0);
  const sayfaSayisi = Math.ceil(ilkSayfa.toplam / UTT_MUTABAKAT_SAYFA_BOYUTU);
  const kalanSayfalar = sayfaSayisi > 1
    ? await Promise.all(Array.from({ length: sayfaSayisi - 1 }, (_, indeks) =>
        uttMutabakatlariListele(db, uttAuthId, donem, durum, indeks + 1)))
    : [];
  return [ilkSayfa, ...kalanSayfalar].flatMap((liste) => liste.kayitlar);
}

async function uttMutabakatKayitlariniZenginlestir(db: SupabaseClient, uttId: string, kayitlar: UttMutabakatKaydi[]): Promise<UttMutabakatKaydi[]> {
  if (kayitlar.length === 0) return [];
  const mutabakatIdler = kayitlar.map((kayit) => kayit.mutabakat_id);
  const { data: onayDurumlari, error: onayDurumuHatasi } = await db.rpc("eczanem_mutabakat_onay_durumlari", {
    p_utt_id: uttId,
    p_mutabakat_idler: mutabakatIdler,
  });
  if (onayDurumuHatasi) throw new Error(`Mutabakat onay durumları alınamadı: ${onayDurumuHatasi.code ?? "DB"}`);
  const onayHaritasi = new Map(
    ((onayDurumlari ?? []) as MutabakatOnaySonucu[]).map((durum) => [durum.mutabakat_id, durum]),
  );
  const urunIdleri = await gorunenUrunIdHaritasi(db, kayitlar.map((kayit) => kayit.urun_id));
  const yayinIdleri = [...new Set(kayitlar.flatMap((kayit) => kayit.kaynaklar.map((kaynak) => kaynak.yayin_id)))];
  const talepIdleri = new Map<string, string>();
  if (yayinIdleri.length > 0) {
    const { data: yayinlar, error: yayinHatasi } = await db.from("v_yayin_detay")
      .select("yayin_id, firma_adi, talep_no")
      .in("yayin_id", yayinIdleri);
    if (yayinHatasi) throw new Error("Mutabakat yayın kimlikleri okunamadı.");
    for (const yayin of yayinlar ?? []) {
      if (yayin.talep_no != null && yayin.firma_adi) {
        talepIdleri.set(yayin.yayin_id, talepIdGoster(yayin.firma_adi, yayin.talep_no));
      }
    }
  }
  return kayitlar.map((kayit) => ({
      ...kayit,
      ...(onayHaritasi.get(kayit.mutabakat_id) ?? {
        onay_durumu: "utt_hazirliginda" as const,
        bm_id: null,
        utt_gonderim_tarihi: null,
        bm_karar: null,
        bm_karar_tarihi: null,
        bm_karar_surumu: 0,
        bm_onay_tarihi: null,
        tm_id: null,
        tm_karar: null,
        tm_karar_tarihi: null,
        tm_karar_surumu: 0,
        tm_onay_tarihi: null,
      }),
      gorunen_urun_id: urunIdleri.get(kayit.urun_id) ?? null,
      kaynaklar: kayit.kaynaklar.map((kaynak) => ({
        ...kaynak,
        gorunen_talep_id: talepIdleri.get(kaynak.yayin_id) ?? null,
      })),
    }));
}

export async function uttMutabakatUrunleriniListele(
  db: SupabaseClient, uttAuthId: string, donem: string,
  durum: UttMutabakatFiltresi, sayfa: number,
): Promise<UttMutabakatUrunListesi> {
  const { data, error } = await db.rpc("eczanem_utt_mutabakat_urunleri_listele", {
    p_utt_id: uttAuthId, p_donem: `${donem}-01`, p_durum: durum,
    p_limit: UTT_MUTABAKAT_SAYFA_BOYUTU,
    p_offset: sayfa * UTT_MUTABAKAT_SAYFA_BOYUTU,
  });
  if (error) throw new Error(`UTT mutabakat ürünleri alınamadı: ${error.code ?? "DB"}`);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("UTT mutabakat ürün yanıtı geçersiz.");
  }
  return data as UttMutabakatUrunListesi;
}

export async function uttMutabakatUrunIslemleriniListele(
  db: SupabaseClient, uttAuthId: string, donem: string,
  durum: UttMutabakatFiltresi, urunId: string, sayfa: number,
): Promise<UttMutabakatUrunIslemleri> {
  const { data, error } = await db.rpc("eczanem_utt_mutabakat_urun_islemleri_listele", {
    p_utt_id: uttAuthId, p_donem: `${donem}-01`, p_urun_id: urunId,
    p_durum: durum, p_limit: UTT_MUTABAKAT_SAYFA_BOYUTU,
    p_offset: sayfa * UTT_MUTABAKAT_SAYFA_BOYUTU,
  });
  if (error) throw new Error(`UTT mutabakat işlemleri alınamadı: ${error.code ?? "DB"}`);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("UTT mutabakat işlem yanıtı geçersiz.");
  }
  const liste = data as UttMutabakatUrunIslemleri;
  return { ...liste, kayitlar: await uttMutabakatKayitlariniZenginlestir(db, uttAuthId, liste.kayitlar) };
}

export async function uttMutabakatEczaneleriniListele(
  db: SupabaseClient, uttAuthId: string, donem: string,
  durum: UttMutabakatFiltresi, sayfa: number,
): Promise<UttMutabakatEczaneListesi> {
  const { data, error } = await db.rpc("eczanem_utt_mutabakat_eczaneleri_listele", {
    p_utt_id: uttAuthId, p_donem: `${donem}-01`, p_durum: durum,
    p_limit: UTT_MUTABAKAT_SAYFA_BOYUTU,
    p_offset: sayfa * UTT_MUTABAKAT_SAYFA_BOYUTU,
  });
  if (error) throw new Error(`UTT mutabakat eczaneleri alınamadı: ${error.code ?? "DB"}`);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("UTT mutabakat eczane yanıtı geçersiz.");
  }
  return data as UttMutabakatEczaneListesi;
}

export async function uttMutabakatEczaneIslemleriniListele(
  db: SupabaseClient, uttAuthId: string, donem: string,
  durum: UttMutabakatFiltresi, eczaneId: string, urunId: string | null, sayfa: number,
): Promise<UttMutabakatEczaneIslemleri> {
  const { data, error } = await db.rpc("eczanem_utt_mutabakat_eczane_islemleri_filtreli_listele", {
    p_utt_id: uttAuthId, p_donem: `${donem}-01`, p_eczane_id: eczaneId,
    p_durum: durum, p_urun_id: urunId, p_limit: UTT_MUTABAKAT_SAYFA_BOYUTU,
    p_offset: sayfa * UTT_MUTABAKAT_SAYFA_BOYUTU,
  });
  if (error) throw new Error(`UTT mutabakat eczane işlemleri alınamadı: ${error.code ?? "DB"}`);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("UTT mutabakat eczane işlem yanıtı geçersiz.");
  }
  const liste = data as UttMutabakatEczaneIslemleri;
  return { ...liste, kayitlar: await uttMutabakatKayitlariniZenginlestir(db, uttAuthId, liste.kayitlar) };
}

export async function uttMutabakatKarariVer(
  db: SupabaseClient,
  uttAuthId: string,
  mutabakatId: string,
  karar: UttMutabakatKarari,
): Promise<UttMutabakatKararSonucu> {
  const { data, error } = await db.rpc("eczanem_utt_mutabakat_karar_ver", {
    p_utt_id: uttAuthId,
    p_mutabakat_id: mutabakatId,
    p_karar: karar,
  });
  if (error) {
    const kod = error.code ?? "DB";
    throw new Error(`UTT mutabakat kararı kaydedilemedi: ${kod}`);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("UTT mutabakat karar yanıtı geçersiz.");
  }
  return data as UttMutabakatKararSonucu;
}

export async function bmMutabakatKarariVer(
  db: SupabaseClient,
  bmId: string,
  mutabakatId: string,
  karar: UttMutabakatKarari,
): Promise<BmMutabakatKararSonucu> {
  const { data, error } = await db.rpc("eczanem_mutabakat_bm_karar_ver", {
    p_bm_id: bmId,
    p_mutabakat_id: mutabakatId,
    p_karar: karar,
  });
  if (error) throw new Error(`BM mutabakat kararı kaydedilemedi: ${error.code ?? "DB"}`);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("BM mutabakat karar yanıtı geçersiz.");
  }
  return data as BmMutabakatKararSonucu;
}

export async function tmMutabakatKarariVer(
  db: SupabaseClient,
  tmId: string,
  mutabakatId: string,
  karar: UttMutabakatKarari,
): Promise<TmMutabakatKararSonucu> {
  const { data, error } = await db.rpc("eczanem_mutabakat_tm_karar_ver", {
    p_tm_id: tmId,
    p_mutabakat_id: mutabakatId,
    p_karar: karar,
  });
  if (error) throw new Error(`TM mutabakat kararı kaydedilemedi: ${error.code ?? "DB"}`);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("TM mutabakat karar yanıtı geçersiz.");
  }
  return data as TmMutabakatKararSonucu;
}

async function mutabakatOnayIslemi(
  db: SupabaseClient,
  rpc: "eczanem_mutabakat_bm_onayina_gonder" | "eczanem_mutabakat_tm_onayina_gonder" | "eczanem_mutabakat_tm_onayla",
  kullaniciAlani: "p_utt_id" | "p_bm_id" | "p_tm_id",
  kullaniciId: string,
  mutabakatId: string,
): Promise<MutabakatOnaySonucu> {
  const { data, error } = await db.rpc(rpc, { [kullaniciAlani]: kullaniciId, p_mutabakat_id: mutabakatId });
  if (error) throw new Error(`Mutabakat onay işlemi tamamlanamadı: ${error.code ?? "DB"}`);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Mutabakat onay yanıtı geçersiz.");
  return data as MutabakatOnaySonucu;
}

export const uttMutabakatiBmOnayinaGonder = (db: SupabaseClient, uttId: string, mutabakatId: string) =>
  mutabakatOnayIslemi(db, "eczanem_mutabakat_bm_onayina_gonder", "p_utt_id", uttId, mutabakatId);

export const bmMutabakatiTmOnayinaGonder = (db: SupabaseClient, bmId: string, mutabakatId: string) =>
  mutabakatOnayIslemi(db, "eczanem_mutabakat_tm_onayina_gonder", "p_bm_id", bmId, mutabakatId);

export const tmMutabakatiOnayla = (db: SupabaseClient, tmId: string, mutabakatId: string) =>
  mutabakatOnayIslemi(db, "eczanem_mutabakat_tm_onayla", "p_tm_id", tmId, mutabakatId);
