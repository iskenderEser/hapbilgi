import type { HapbiAnalitikKapsam, HapbiVeriAlani } from "@/lib/hapbi/analitik/sozlesme";
import type { HapbiKullaniciBaglami } from "@/lib/hapbi/hapbiKullaniciBaglami";
import { HapbiHata } from "@/lib/hapbi/sozlesme";
import { ureticiYetenegi } from "@/lib/uretici/yetenekler";
import {
  ECLUB_TUKETICI_ROLLERI,
  ECLUB_YONETIM_ROLLERI,
  TUKETICI_ROLLER,
  YONETICI_ROLLER,
} from "@/lib/utils/roller";

function zorunlu(kosul: string | null, mesaj: string): string {
  if (!kosul) throw new HapbiHata("EKSIK_ANALITIK_KAPSAM", 403, mesaj);
  return kosul;
}

export function hapbiAnalitikKapsaminiCoz(
  kullanici: HapbiKullaniciBaglami,
  veriAlani: HapbiVeriAlani,
): HapbiAnalitikKapsam {
  const temel = { kaynak_rol: kullanici.rol, kullanici_id: kullanici.kullanici_id };

  if (veriAlani === "eclub") {
    if (kullanici.kimlik_turu === "eclub_kisi" && ECLUB_TUKETICI_ROLLERI.includes(kullanici.rol)) {
      return { ...temel, tur: "eclub_kisisel" };
    }
    if (kullanici.kimlik_turu === "kullanici" && ECLUB_YONETIM_ROLLERI.includes(kullanici.rol)) {
      if (!kullanici.eclub_aktif) throw new HapbiHata("ANALITIK_YETKI", 403, "Firma için E-Club etkin değil.");
      return {
        ...temel,
        tur: "eclub_organizasyon",
        firma_id: zorunlu(kullanici.firma_id, "E-Club firma kapsamı doğrulanamadı."),
        ...(kullanici.takim_id ? { takim_id: kullanici.takim_id } : {}),
        ...(kullanici.bolge_id ? { bolge_id: kullanici.bolge_id } : {}),
      };
    }
    throw new HapbiHata("ANALITIK_YETKI", 403, "Bu rolün E-Club analitik kapsamı yok.");
  }

  if (kullanici.kimlik_turu !== "kullanici") {
    throw new HapbiHata("ANALITIK_YETKI", 403, "Bu kimlik türünün iç platform analitik kapsamı yok.");
  }

  const firma_id = zorunlu(kullanici.firma_id, "Firma kapsamı doğrulanamadı.");
  if (veriAlani === "tclub") {
    if (TUKETICI_ROLLER.includes(kullanici.rol)) return { ...temel, tur: "kisisel", firma_id };
    if (kullanici.rol === "bm") {
      return {
        ...temel,
        tur: "bm_sorumluluk",
        firma_id,
        takim_id: zorunlu(kullanici.takim_id, "BM takım kapsamı doğrulanamadı."),
        bolge_id: zorunlu(kullanici.bolge_id, "BM sorumluluk kapsamı doğrulanamadı."),
      };
    }
    if (kullanici.rol === "tm") {
      return { ...temel, tur: "takim", firma_id, takim_id: zorunlu(kullanici.takim_id, "TM takım kapsamı doğrulanamadı.") };
    }
    const yetenek = ureticiYetenegi(kullanici.rol);
    if (yetenek?.raporScope === "takim") {
      return { ...temel, tur: "takim", firma_id, takim_id: zorunlu(kullanici.takim_id, "Üretici takım kapsamı doğrulanamadı.") };
    }
    if (yetenek?.raporScope === "firma" || YONETICI_ROLLER.includes(kullanici.rol)) {
      return { ...temel, tur: "firma", firma_id };
    }
    throw new HapbiHata("ANALITIK_YETKI", 403, "Bu rolün T-Club analitik kapsamı yok.");
  }

  if (veriAlani === "cclub") {
    if (!kullanici.cc_aktif) throw new HapbiHata("ANALITIK_YETKI", 403, "Firma için C-Club etkin değil.");
    if (kullanici.rol === "bm") return { ...temel, tur: "kisisel", firma_id };
    if (kullanici.rol === "tm") {
      return { ...temel, tur: "takim", firma_id, takim_id: zorunlu(kullanici.takim_id, "TM takım kapsamı doğrulanamadı.") };
    }
    const yetenek = ureticiYetenegi(kullanici.rol);
    if (yetenek?.raporScope === "takim") {
      return { ...temel, tur: "takim", firma_id, takim_id: zorunlu(kullanici.takim_id, "Üretici takım kapsamı doğrulanamadı.") };
    }
    if (yetenek?.raporScope === "firma" || YONETICI_ROLLER.includes(kullanici.rol)) {
      return { ...temel, tur: "firma", firma_id };
    }
    throw new HapbiHata("ANALITIK_YETKI", 403, "Bu rolün C-Club analitik kapsamı yok.");
  }

  const yetenek = ureticiYetenegi(kullanici.rol);
  if (yetenek?.raporScope === "takim") {
    return { ...temel, tur: "takim", firma_id, takim_id: zorunlu(kullanici.takim_id, "Üretim takım kapsamı doğrulanamadı.") };
  }
  if (yetenek?.raporScope === "firma" || YONETICI_ROLLER.includes(kullanici.rol)) {
    return { ...temel, tur: "firma", firma_id };
  }
  throw new HapbiHata("ANALITIK_YETKI", 403, "Bu rolün üretim analitik kapsamı yok.");
}
