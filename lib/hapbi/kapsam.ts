import type { SupabaseClient } from "@supabase/supabase-js";

import {
  HAPBI_ROL_KURALLARI,
  HAPBI_SAHA_TUKETICI_ROLLERI,
  HAPBI_URETICI_ROLLERI,
  hapbiKullanabilirMi,
  type HapbiKapsamDuzeyi,
  type HapbiRol,
  type HapbiVeriAlani,
} from "./roller";

type KimlikSatiri = {
  auth_id: string | null;
  kimlik_turu: string | null;
  kimlik_id: string | null;
  rol: string | null;
  aktif_mi: boolean | null;
  firma_id: string | null;
  takim_id: string | null;
  bolge_id: string | null;
};

type KullaniciSatiri = {
  kullanici_id: string;
  rol: string;
};

type UrunSatiri = { urun_id: string };
type TakimSatiri = { takim_id: string };
type BolgeSatiri = { bolge_id: string; takim_id: string };

type YayinSatiri = {
  yayin_id: string | null;
  hedef_roller: string[] | null;
};

export type HapbiAlanKapsami = Readonly<{
  duzey: HapbiKapsamDuzeyi;
  firmaIdleri: readonly string[];
  takimIdleri: readonly string[];
  bolgeIdleri: readonly string[];
  kullaniciIdleri: readonly string[];
  urunIdleri: readonly string[];
  yayinIdleri: readonly string[];
}>;

export type HapbiKapsami = Readonly<{
  authId: string;
  kullaniciId: string;
  rol: HapbiRol;
  firmaId: string;
  takimId: string | null;
  bolgeId: string | null;
  veriAlanlari: Readonly<Record<HapbiVeriAlani, HapbiAlanKapsami>>;
}>;

export type HapbiKapsamSonucu =
  | Readonly<{ basarili: true; kapsam: HapbiKapsami }>
  | Readonly<{ basarili: false; neden: "kimlik_bulunamadi" | "hapbi_kapali" | "organizasyon_eksik" | "veri_okunamadi" }>;

const TUKETICI_ROLLERI = new Set<string>(HAPBI_SAHA_TUKETICI_ROLLERI);
const BM_ROLU = new Set(["bm"]);
const URETICI_ROLLERI = new Set<string>(HAPBI_URETICI_ROLLERI);

function benzersiz(degerler: Array<string | null | undefined>): string[] {
  return [...new Set(degerler.filter((deger): deger is string => Boolean(deger)))];
}

function hedefRolUygunMu(veriAlani: HapbiVeriAlani, hedefRoller: string[] | null): boolean {
  if (!hedefRoller?.length) return true;
  if (veriAlani === "tclub") return hedefRoller.includes("utt");
  if (veriAlani === "cclub") return hedefRoller.includes("bm");
  if (veriAlani === "eclub") {
    return hedefRoller.includes("eczaci") || hedefRoller.includes("eczane_teknisyeni");
  }
  return veriAlani === "uretim";
}

function kullaniciIdleri(
  tumKullanicilar: KullaniciSatiri[],
  duzey: HapbiKapsamDuzeyi,
  kendiId: string,
  veriAlani: HapbiVeriAlani,
): string[] {
  if (duzey === "yok") return [];
  if (duzey === "kisisel") return [kendiId];

  const izinliRoller = veriAlani === "cclub"
    ? BM_ROLU
    : veriAlani === "uretim"
      ? URETICI_ROLLERI
      : TUKETICI_ROLLERI;
  return benzersiz(tumKullanicilar.filter((kullanici) => izinliRoller.has(kullanici.rol)).map((kullanici) => kullanici.kullanici_id));
}

export async function hapbiKapsaminiCoz(
  adminSupabase: SupabaseClient,
  authUserId: string,
): Promise<HapbiKapsamSonucu> {
  const { data: kimlikVerisi, error: kimlikHatasi } = await adminSupabase
    .from("v_auth_kimlik_admin")
    .select("auth_id, kimlik_turu, kimlik_id, rol, aktif_mi, firma_id, takim_id, bolge_id")
    .eq("auth_id", authUserId)
    .maybeSingle();

  if (kimlikHatasi || !kimlikVerisi) return { basarili: false, neden: "kimlik_bulunamadi" };

  const kimlik = kimlikVerisi as KimlikSatiri;
  const rol = (kimlik.rol ?? "").trim().toLowerCase();

  if (kimlik.aktif_mi !== true || !hapbiKullanabilirMi(kimlik.kimlik_turu ?? "", rol)) {
    return { basarili: false, neden: "hapbi_kapali" };
  }
  if (!kimlik.kimlik_id || !kimlik.firma_id) {
    return { basarili: false, neden: "organizasyon_eksik" };
  }

  const rolKurali = HAPBI_ROL_KURALLARI[rol];
  if ((rolKurali.organizasyon === "takim" && !kimlik.takim_id)
    || (rolKurali.organizasyon === "bolge" && (!kimlik.takim_id || !kimlik.bolge_id))) {
    return { basarili: false, neden: "organizasyon_eksik" };
  }

  let kullaniciSorgusu = adminSupabase
    .from("kullanicilar")
    .select("kullanici_id, rol")
    .eq("firma_id", kimlik.firma_id)
    .eq("aktif_mi", true);

  if (rolKurali.organizasyon === "bolge") kullaniciSorgusu = kullaniciSorgusu.eq("bolge_id", kimlik.bolge_id);
  if (rolKurali.organizasyon === "takim") kullaniciSorgusu = kullaniciSorgusu.eq("takim_id", kimlik.takim_id);
  if (rolKurali.organizasyon === "kisisel") kullaniciSorgusu = kullaniciSorgusu.eq("kullanici_id", kimlik.kimlik_id);

  let urunSorgusu = adminSupabase
    .from("urunler")
    .select("urun_id")
    .eq("firma_id", kimlik.firma_id);

  let yayinSorgusu = adminSupabase
    .from("v_yayin_kunye")
    .select("yayin_id, hedef_roller")
    .eq("firma_id", kimlik.firma_id);

  if (rolKurali.organizasyon !== "firma" && kimlik.takim_id) {
    urunSorgusu = urunSorgusu.eq("takim_id", kimlik.takim_id);
    yayinSorgusu = yayinSorgusu.or(`takim_id.eq.${kimlik.takim_id},takim_id.is.null`);
  }

  let takimSorgusu = adminSupabase
    .from("takimlar")
    .select("takim_id")
    .eq("firma_id", kimlik.firma_id);

  if (rolKurali.organizasyon !== "firma" && kimlik.takim_id) {
    takimSorgusu = takimSorgusu.eq("takim_id", kimlik.takim_id);
  }

  const [kullaniciSonucu, urunSonucu, yayinSonucu, takimSonucu] = await Promise.all([
    kullaniciSorgusu,
    urunSorgusu,
    yayinSorgusu,
    takimSorgusu,
  ]);

  if (kullaniciSonucu.error || urunSonucu.error || yayinSonucu.error || takimSonucu.error) {
    return { basarili: false, neden: "veri_okunamadi" };
  }

  const tumKullanicilar = (kullaniciSonucu.data ?? []) as KullaniciSatiri[];
  const takimIdleri = benzersiz(((takimSonucu.data ?? []) as TakimSatiri[]).map((takim) => takim.takim_id));

  let bolgeIdleri: string[] = [];
  if (takimIdleri.length > 0) {
    let bolgeSorgusu = adminSupabase
      .from("bolgeler")
      .select("bolge_id, takim_id")
      .in("takim_id", takimIdleri);

    if ((rolKurali.organizasyon === "kisisel" || rolKurali.organizasyon === "bolge") && kimlik.bolge_id) {
      bolgeSorgusu = bolgeSorgusu.eq("bolge_id", kimlik.bolge_id);
    }

    const bolgeSonucu = await bolgeSorgusu;
    if (bolgeSonucu.error) return { basarili: false, neden: "veri_okunamadi" };
    bolgeIdleri = benzersiz(((bolgeSonucu.data ?? []) as BolgeSatiri[]).map((bolge) => bolge.bolge_id));
  }

  const urunIdleri = benzersiz(((urunSonucu.data ?? []) as UrunSatiri[]).map((urun) => urun.urun_id));
  const tumYayinlar = (yayinSonucu.data ?? []) as YayinSatiri[];

  const alanKapsamiOlustur = (veriAlani: HapbiVeriAlani): HapbiAlanKapsami => {
    const duzey = rolKurali.veriAlanlari[veriAlani];
    return {
      duzey,
      firmaIdleri: duzey === "yok" ? [] : [kimlik.firma_id!],
      takimIdleri: duzey === "yok" ? [] : takimIdleri,
      bolgeIdleri: duzey === "yok" ? [] : bolgeIdleri,
      kullaniciIdleri: kullaniciIdleri(tumKullanicilar, duzey, kimlik.kimlik_id!, veriAlani),
      urunIdleri: duzey === "yok" ? [] : urunIdleri,
      yayinIdleri: duzey === "yok"
        ? []
        : benzersiz(
          tumYayinlar
            .filter((yayin) => hedefRolUygunMu(veriAlani, yayin.hedef_roller))
            .map((yayin) => yayin.yayin_id),
        ),
    };
  };

  const veriAlanlari: Record<HapbiVeriAlani, HapbiAlanKapsami> = {
    tclub: alanKapsamiOlustur("tclub"),
    cclub: alanKapsamiOlustur("cclub"),
    eclub: alanKapsamiOlustur("eclub"),
    uretim: alanKapsamiOlustur("uretim"),
  };

  return {
    basarili: true,
    kapsam: {
      authId: authUserId,
      kullaniciId: kimlik.kimlik_id,
      rol,
      firmaId: kimlik.firma_id,
      takimId: kimlik.takim_id,
      bolgeId: kimlik.bolge_id,
      veriAlanlari,
    },
  };
}

export function kapsamKimligiIzinliMi(
  kapsam: HapbiKapsami,
  veriAlani: HapbiVeriAlani,
  kimlikTuru: "firma" | "takim" | "bolge" | "kullanici" | "urun" | "yayin",
  kimlik: string,
): boolean {
  const alan = kapsam.veriAlanlari[veriAlani];
  if (alan.duzey === "yok") return false;
  if (kimlikTuru === "firma") return alan.firmaIdleri.includes(kimlik);
  if (kimlikTuru === "takim") return alan.takimIdleri.includes(kimlik);
  if (kimlikTuru === "bolge") return alan.bolgeIdleri.includes(kimlik);
  if (kimlikTuru === "kullanici") return alan.kullaniciIdleri.includes(kimlik);
  if (kimlikTuru === "urun") return alan.urunIdleri.includes(kimlik);
  return alan.yayinIdleri.includes(kimlik);
}
