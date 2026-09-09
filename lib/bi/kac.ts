import type { SupabaseClient } from "@supabase/supabase-js";

import { biMetniniNormalize } from "@/lib/bi/normalizasyon";
import { TUKETICI_ROLLER } from "@/lib/utils/roller";
import { ayBaslangici, ayKaydir, haftaBaslangici, yilBaslangici } from "@/lib/zaman/kontrol";

type DonemTuru = "hafta" | "ay" | "yıl";
type DonemYonu = "bu" | "geçen";

export type KacSorgusu = Readonly<{
  olcut: "kisisel_tclub_net_puani";
  donemTuru: DonemTuru;
  donemYonu: DonemYonu;
}>;

export type KacCozumu =
  | Readonly<{ durum: "bulundu"; sorgu: KacSorgusu }>
  | Readonly<{ durum: "eksik" }>
  | Readonly<{ durum: "kac_sorusu_degil" }>;

export type KacDonemi = Readonly<{
  baslangic: string;
  bitis: string;
  etiket: string;
}>;

export type KacOkumaSonucu =
  | Readonly<{ basarili: true; puan: number; donem: KacDonemi; okumaZamani: string }>
  | Readonly<{
      basarili: false;
      neden: "rol_desteklenmiyor" | "veri_okunamadi" | "kayit_yok" | "veri_eksik";
    }>;

const KAC_KALIPLARI = [
  /^(bu|geçen) (hafta|ay|yıl) (?:t club )?(?:net )?puanım kaç$/u,
  /^(?:t club )?(?:net )?puanım (bu|geçen) (hafta|ay|yıl) kaç$/u,
];

export function kacSorusunuCoz(soru: string): KacCozumu {
  const normal = biMetniniNormalize(soru);
  for (const kalip of KAC_KALIPLARI) {
    const eslesme = normal.match(kalip);
    if (eslesme) {
      return {
        durum: "bulundu",
        sorgu: {
          olcut: "kisisel_tclub_net_puani",
          donemYonu: eslesme[1] as DonemYonu,
          donemTuru: eslesme[2] as DonemTuru,
        },
      };
    }
  }

  if (normal.split(" ").includes("kaç")) return { durum: "eksik" };
  return { durum: "kac_sorusu_degil" };
}

function oncekiBaslangic(tur: DonemTuru, mevcutBaslangic: Date): Date {
  if (tur === "hafta") return new Date(mevcutBaslangic.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (tur === "ay") return ayKaydir(mevcutBaslangic, -1);
  return yilBaslangici(new Date(mevcutBaslangic.getTime() - 24 * 60 * 60 * 1000));
}

export function kacDoneminiCoz(sorgu: KacSorgusu, simdi: Date = new Date()): KacDonemi {
  const mevcutBaslangic = sorgu.donemTuru === "hafta"
    ? haftaBaslangici(simdi)
    : sorgu.donemTuru === "ay"
      ? ayBaslangici(simdi)
      : yilBaslangici(simdi);

  const baslangic = sorgu.donemYonu === "bu"
    ? mevcutBaslangic
    : oncekiBaslangic(sorgu.donemTuru, mevcutBaslangic);
  const bitis = sorgu.donemYonu === "bu" ? simdi : mevcutBaslangic;
  return {
    baslangic: baslangic.toISOString(),
    bitis: bitis.toISOString(),
    etiket: `${sorgu.donemYonu} ${sorgu.donemTuru}`,
  };
}

export async function kisiselTclubNetPuaniniOku(
  db: SupabaseClient,
  kullaniciId: string,
  rol: string,
  sorgu: KacSorgusu,
  simdi: Date = new Date(),
): Promise<KacOkumaSonucu> {
  if (!TUKETICI_ROLLER.includes(rol.trim().toLowerCase())) {
    return { basarili: false, neden: "rol_desteklenmiyor" };
  }

  const donem = kacDoneminiCoz(sorgu, simdi);
  const { data, error } = await db.rpc("get_kullanici_ozet", {
    p_kullanici_id: kullaniciId,
    p_baslangic: donem.baslangic,
    p_bitis: donem.bitis,
  });
  if (error) return { basarili: false, neden: "veri_okunamadi" };
  if (!Array.isArray(data) || data.length === 0) {
    return { basarili: false, neden: "kayit_yok" };
  }

  const hamPuan = (data[0] as Record<string, unknown>).toplam_net_puan;
  if (hamPuan === null || hamPuan === undefined || hamPuan === "") {
    return { basarili: false, neden: "veri_eksik" };
  }
  const puan = Number(hamPuan);
  if (!Number.isFinite(puan)) return { basarili: false, neden: "veri_eksik" };

  return {
    basarili: true,
    puan,
    donem,
    okumaZamani: simdi.toISOString(),
  };
}
