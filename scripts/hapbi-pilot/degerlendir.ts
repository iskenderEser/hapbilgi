import type { HapbiKaynak } from "@/lib/hapbi/sozlesme";
import type { PilotAdimi } from "@/scripts/hapbi-pilot/vakalar";

export interface PilotAracCagrisi {
  ad: string;
  parametre: unknown;
  sonuc?: unknown;
  sureMs: number;
  hata?: string;
}

export interface PilotKontrolSonucu {
  boyut: "yol" | "arac" | "parametre" | "kaynak" | "anlam";
  kod: string;
  aciklama: string;
  gecti: boolean;
  kritik: boolean;
}

function nesneMi(deger: unknown): deger is Record<string, unknown> {
  return !!deger && typeof deger === "object" && !Array.isArray(deger);
}

function parametrelerEslesiyor(gercek: unknown, beklenen: Record<string, string | number>): boolean {
  if (!nesneMi(gercek)) return false;
  return Object.entries(beklenen).every(([anahtar, deger]) => gercek[anahtar] === deger);
}

export function pilotAdiminiDegerlendir(
  adim: PilotAdimi,
  cevap: string,
  kaynaklar: HapbiKaynak[],
  aracCagrilari: PilotAracCagrisi[],
  yol?: "dogrudan" | "hizli_ai" | "ai",
): PilotKontrolSonucu[] {
  const sonuclar: PilotKontrolSonucu[] = [];
  if (adim.beklenenYol) {
    sonuclar.push({
      boyut: "yol", kod: `yol:${adim.beklenenYol}`, aciklama: `${adim.beklenenYol} yanıt yolu kullanılmalı.`,
      gecti: yol === adim.beklenenYol, kritik: true,
    });
  }
  for (const arac of adim.zorunluAraclar ?? []) {
    const adaylar = aracCagrilari.filter(cagri => cagri.ad === arac.ad);
    sonuclar.push({
      boyut: "arac", kod: `zorunlu-arac:${arac.ad}`,
      aciklama: `${arac.ad} aracı çağrılmalı.`, gecti: adaylar.length > 0, kritik: true,
    });
    if (arac.parametreler) {
      sonuclar.push({
        boyut: "parametre", kod: `parametre:${arac.ad}`,
        aciklama: `${arac.ad} parametreleri soruyla eşleşmeli.`,
        gecti: adaylar.some(cagri => parametrelerEslesiyor(cagri.parametre, arac.parametreler!)), kritik: true,
      });
    }
  }
  for (const arac of adim.yasakAraclar ?? []) {
    sonuclar.push({
      boyut: "arac", kod: `yasak-arac:${arac}`,
      aciklama: `Netleştirme veya ret öncesinde ${arac} çağrılmamalı.`,
      gecti: !aracCagrilari.some(cagri => cagri.ad === arac), kritik: true,
    });
  }
  if (adim.kaynakDeseni) {
    sonuclar.push({
      boyut: "kaynak", kod: "kaynak-basligi", aciklama: "Beklenen canlı kaynak seçilmeli.",
      gecti: kaynaklar.some(kaynak => adim.kaynakDeseni!.test(kaynak.baslik)), kritik: true,
    });
  }
  for (const kural of adim.metinKurallari) {
    const eslesti = kural.desen.test(cevap);
    sonuclar.push({
      boyut: "anlam", kod: kural.kod, aciklama: kural.aciklama,
      gecti: kural.tur === "bulunmali" ? eslesti : !eslesti, kritik: kural.kritik === true,
    });
  }
  return sonuclar;
}

export function pilotAdimiGecti(sonuclar: PilotKontrolSonucu[]): boolean {
  return sonuclar.every(sonuc => sonuc.gecti);
}

export function kritikIhlalVar(sonuclar: PilotKontrolSonucu[]): boolean {
  return sonuclar.some(sonuc => sonuc.kritik && !sonuc.gecti);
}
