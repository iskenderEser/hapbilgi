import type { SupabaseClient } from "@supabase/supabase-js";
import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";
import { gorunenUrunIdHaritasi } from "@/lib/urunler/gorunenId";
import { talepIdGoster } from "@/lib/utils/talepId";

export type UttMutabakatKarari = "onay" | "beklet" | "ret";
export type UttMutabakatFiltresi = "tumu" | "bekliyor" | UttMutabakatKarari;

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
  kaynaklar: UttMutabakatKaynagi[];
  karar_gecmisi: UttMutabakatKararGecmisi[];
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

export interface UttMutabakatKararSonucu {
  mutabakat_id: string;
  karar: UttMutabakatKarari;
  karar_tarihi: string;
  surum: number;
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
  return { ...liste, kayitlar: await uttMutabakatKayitlariniZenginlestir(db, liste.kayitlar) };
}

async function uttMutabakatKayitlariniZenginlestir(db: SupabaseClient, kayitlar: UttMutabakatKaydi[]): Promise<UttMutabakatKaydi[]> {
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
  return { ...liste, kayitlar: await uttMutabakatKayitlariniZenginlestir(db, liste.kayitlar) };
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
