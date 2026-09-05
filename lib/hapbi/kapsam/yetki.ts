import type { SupabaseClient } from "@supabase/supabase-js";
import { eclubKisiErisimi } from "@/lib/eclub/kisiErisim";
import type { HapbiCozulmusKapsam } from "@/lib/hapbi/kapsam/cozucu";
import type {
  HapbiKapsamTuru,
  HapbiRolKapsamKurali,
} from "@/lib/hapbi/kapsam/rolMatrisi";
import type { HapbiVeriAlani } from "@/lib/hapbi/niyet/sozlesme";
import { HapbiHata } from "@/lib/hapbi/sozlesme";

type HapbiAnalitikKapsamTuru = Exclude<
  HapbiKapsamTuru,
  "yalniz_acikca_tanimlanan_araclar"
>;

export interface HapbiYetkiliKapsam {
  veriAlani: HapbiVeriAlani;
  kapsam: HapbiAnalitikKapsamTuru;
  authKullaniciId: string;
  rol: string;
  firmaId?: string;
  takimId?: string;
  bolgeId?: string;
  firmaIdler?: readonly string[];
  eczaneIdler?: readonly string[];
  urunKapsami?: "takim_urunleri";
}

function yetkiHatasi(mesaj: string): never {
  throw new HapbiHata("HAPBI_YETKI", 403, mesaj);
}

function zorunlu(deger: string | null, mesaj: string): string {
  if (!deger) yetkiHatasi(mesaj);
  return deger;
}

function veriAlaniKuraliniBul(
  kapsam: HapbiCozulmusKapsam,
  veriAlani: HapbiVeriAlani,
): HapbiRolKapsamKurali {
  const kural = kapsam.rolKapsami.kurallar.find(
    (aday) => aday.veriAlani === veriAlani || aday.veriAlani === "yetkili_veri_alanlari",
  );

  if (!kural || kural.kapsam === "yalniz_acikca_tanimlanan_araclar") {
    yetkiHatasi("Bu veri alanı için HapBi yetkisi bulunmuyor.");
  }
  return kural;
}

async function firmaModulunuDogrula(
  db: SupabaseClient,
  firmaId: string,
  veriAlani: HapbiVeriAlani,
): Promise<void> {
  const { data: firma, error } = await db
    .from("firmalar")
    .select("aktif, cc_aktif, eclub_aktif")
    .eq("firma_id", firmaId)
    .maybeSingle();

  if (error || !firma || firma.aktif !== true) {
    yetkiHatasi("Aktif firma kapsamı doğrulanamadı.");
  }
  if (veriAlani === "cclub" && firma.cc_aktif !== true) {
    yetkiHatasi("Firma için C-Club etkin değil.");
  }
  if (veriAlani === "eclub" && firma.eclub_aktif !== true) {
    yetkiHatasi("Firma için E-Club etkin değil.");
  }
}

async function eclubKisiselYetkisiniOlustur(
  db: SupabaseClient,
  kapsam: HapbiCozulmusKapsam,
  veriAlani: HapbiVeriAlani,
): Promise<HapbiYetkiliKapsam> {
  if (veriAlani !== "eclub") {
    yetkiHatasi("E-Club kişisel kimliği bu veri alanını kullanamaz.");
  }

  const erisim = await eclubKisiErisimi(db, kapsam.authKullaniciId);
  if (!erisim.kisi || erisim.kisi.rol !== kapsam.rol || !erisim.eclub_aktif) {
    yetkiHatasi("Aktif E-Club kişi erişimi doğrulanamadı.");
  }

  const firmaIdler = erisim.firmalar
    .filter((firma) => firma.aktif !== false && firma.eclub_aktif === true)
    .map((firma) => firma.firma_id);

  if (erisim.eczane_idler.length === 0 || firmaIdler.length === 0) {
    yetkiHatasi("Aktif E-Club eczane ve firma ilişkisi doğrulanamadı.");
  }

  return {
    veriAlani,
    kapsam: "kisisel",
    authKullaniciId: kapsam.authKullaniciId,
    rol: kapsam.rol,
    firmaIdler,
    eczaneIdler: erisim.eczane_idler,
  };
}

export async function hapbiYetkiliKapsaminiOlustur(
  db: SupabaseClient,
  cozulmusKapsam: HapbiCozulmusKapsam,
  veriAlani: HapbiVeriAlani,
): Promise<HapbiYetkiliKapsam> {
  if (!cozulmusKapsam.rolKapsami.hapbiErisimi) {
    yetkiHatasi("Kullanıcının HapBi erişimi bulunmuyor.");
  }

  const kural = veriAlaniKuraliniBul(cozulmusKapsam, veriAlani);
  if (cozulmusKapsam.kimlikTuru === "eclub_kisi") {
    return eclubKisiselYetkisiniOlustur(db, cozulmusKapsam, veriAlani);
  }

  const temel = {
    veriAlani,
    authKullaniciId: cozulmusKapsam.authKullaniciId,
    rol: cozulmusKapsam.rol,
  };

  if (kural.kapsam === "kisisel") {
    const firmaId = zorunlu(
      cozulmusKapsam.firmaId,
      "Kişisel kapsamın firma ilişkisi doğrulanamadı.",
    );
    await firmaModulunuDogrula(db, firmaId, veriAlani);
    return { ...temel, kapsam: "kisisel", firmaId };
  }

  if (kural.kapsam === "bm_sorumlulugu") {
    const firmaId = zorunlu(cozulmusKapsam.firmaId, "BM firma kapsamı doğrulanamadı.");
    const takimId = zorunlu(cozulmusKapsam.takimId, "BM takım kapsamı doğrulanamadı.");
    const bolgeId = zorunlu(cozulmusKapsam.bolgeId, "BM sorumluluk kapsamı doğrulanamadı.");
    await firmaModulunuDogrula(db, firmaId, veriAlani);
    return { ...temel, kapsam: "bm_sorumlulugu", firmaId, takimId, bolgeId };
  }

  if (kural.kapsam === "takim") {
    const firmaId = zorunlu(cozulmusKapsam.firmaId, "Takım kapsamının firma ilişkisi doğrulanamadı.");
    const takimId = zorunlu(cozulmusKapsam.takimId, "Takım kapsamı doğrulanamadı.");
    await firmaModulunuDogrula(db, firmaId, veriAlani);
    return {
      ...temel,
      kapsam: "takim",
      firmaId,
      takimId,
      ...(kural.urunKapsami ? { urunKapsami: kural.urunKapsami } : {}),
    };
  }

  const firmaId = zorunlu(cozulmusKapsam.firmaId, "Firma kapsamı doğrulanamadı.");
  await firmaModulunuDogrula(db, firmaId, veriAlani);
  return { ...temel, kapsam: "firma", firmaId };
}
