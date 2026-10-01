import {
  CEK_TAKIP_SAYFA_LIMITI,
  type CekTakipFiltreleri,
} from "@/lib/eclub/hediyeTakip/cekTakip";
import { cekTalepDurumuMu } from "@/lib/eclub/store/eclubStoreTipler";

const MAKSIMUM_LIMIT = 100;
const UUID_DESENI = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TARIH_DESENI = /^\d{4}-\d{2}-\d{2}$/;

export type CekTakipFiltreParseSonucu =
  | { ok: true; filtreler: CekTakipFiltreleri }
  | { ok: false; hata: string; alanlar: string[] };

function kimlikOku(searchParams: URLSearchParams, alan: string): string | null | undefined {
  const deger = searchParams.get(alan)?.trim() ?? "";
  if (!deger) return null;
  return UUID_DESENI.test(deger) ? deger : undefined;
}

function tarihOku(searchParams: URLSearchParams, alan: string): string | null | undefined {
  const deger = searchParams.get(alan)?.trim() ?? "";
  if (!deger) return null;
  if (!TARIH_DESENI.test(deger)) return undefined;
  const [yil, ay, gun] = deger.split("-").map(Number);
  const tarih = new Date(Date.UTC(yil, ay - 1, gun));
  return tarih.getUTCFullYear() === yil && tarih.getUTCMonth() === ay - 1 && tarih.getUTCDate() === gun
    ? deger
    : undefined;
}

export function cekTakipFiltreleriniParseEt(searchParams: URLSearchParams): CekTakipFiltreParseSonucu {
  const eczane_id = kimlikOku(searchParams, "eczane_id");
  const kisi_id = kimlikOku(searchParams, "kisi_id");
  const urun_id = kimlikOku(searchParams, "urun_id");
  const gecersizKimlikler = [
    ["eczane_id", eczane_id],
    ["kisi_id", kisi_id],
    ["urun_id", urun_id],
  ].filter(([, deger]) => deger === undefined).map(([alan]) => alan as string);
  if (gecersizKimlikler.length > 0) {
    return { ok: false, hata: "Filtre kimliği geçersiz.", alanlar: gecersizKimlikler };
  }

  const durumDegeri = searchParams.get("durum")?.trim() ?? "";
  if (durumDegeri && !cekTalepDurumuMu(durumDegeri)) {
    return { ok: false, hata: "Çek talebi durumu geçersiz.", alanlar: ["durum"] };
  }
  const durum = durumDegeri && cekTalepDurumuMu(durumDegeri) ? durumDegeri : null;

  const baslangic = tarihOku(searchParams, "baslangic");
  const bitis = tarihOku(searchParams, "bitis");
  const gecersizTarihler = [
    ["baslangic", baslangic],
    ["bitis", bitis],
  ].filter(([, deger]) => deger === undefined).map(([alan]) => alan as string);
  if (gecersizTarihler.length > 0) {
    return { ok: false, hata: "Tarih filtresi geçersiz.", alanlar: gecersizTarihler };
  }
  if (baslangic && bitis && baslangic > bitis) {
    return { ok: false, hata: "Başlangıç tarihi bitiş tarihinden sonra olamaz.", alanlar: ["baslangic", "bitis"] };
  }

  const offsetDegeri = searchParams.get("offset") ?? "0";
  const limitDegeri = searchParams.get("limit") ?? String(CEK_TAKIP_SAYFA_LIMITI);
  const offset = Number(offsetDegeri);
  const limit = Number(limitDegeri);
  if (!Number.isInteger(offset) || offset < 0) {
    return { ok: false, hata: "Sayfalama başlangıcı geçersiz.", alanlar: ["offset"] };
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAKSIMUM_LIMIT) {
    return { ok: false, hata: `Sayfa limiti 1-${MAKSIMUM_LIMIT} arasında olmalıdır.`, alanlar: ["limit"] };
  }

  return {
    ok: true,
    filtreler: {
      eczane_id: eczane_id ?? null,
      kisi_id: kisi_id ?? null,
      urun_id: urun_id ?? null,
      durum,
      baslangic: baslangic ?? null,
      bitis: bitis ?? null,
      offset,
      limit,
    },
  };
}
