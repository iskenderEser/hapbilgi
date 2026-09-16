import "server-only";

import { yayinAraciKullanimaAcikMi } from "@/lib/ogrenmeAraci/bayraklar";
import { ogrenmeAraciTuruMu, tamamlamaKanitiDogrula } from "@/lib/ogrenmeAraci/sozlesme";
import type { TamamlamaKaniti } from "@/lib/ogrenmeAraci/tipler";

type TamamlamaKapisiSonucu = { ok: true } | { ok: false; hata: string };

const KANIT_HATASI = {
  podcast: "Podcast tamamlanma kanıtı doğrulanamadı.",
  gorsel: "Görsel tamamlanma kanıtı doğrulanamadı.",
  flip_pdf: "Literatür tamamlanma kanıtı doğrulanamadı.",
} as const;

/**
 * Kanal bağımsız yayın tamamlama kapısı.
 * Sahiplik ve kanalın ödül kuralları doğrulandıktan sonra çağrılır.
 */
export function ogrenmeAraciTamamlamaKapisi(girdi: {
  yayinDurumu: unknown;
  aracTuru: unknown;
  tamamlamaKaniti: unknown;
}): TamamlamaKapisiSonucu {
  if (girdi.yayinDurumu !== "yayinda") {
    return { ok: false, hata: "Yayın artık aktif değil." };
  }
  if (!ogrenmeAraciTuruMu(girdi.aracTuru) || !yayinAraciKullanimaAcikMi(girdi.aracTuru)) {
    return { ok: false, hata: "Bu öğrenme aracı kullanıma kapalı." };
  }
  if (girdi.aracTuru === "video") return { ok: true };

  if (!girdi.tamamlamaKaniti || typeof girdi.tamamlamaKaniti !== "object") {
    return { ok: false, hata: KANIT_HATASI[girdi.aracTuru] };
  }
  const kanit = girdi.tamamlamaKaniti as Partial<TamamlamaKaniti>;
  if (!kanit.veri || typeof kanit.veri !== "object") {
    return { ok: false, hata: KANIT_HATASI[girdi.aracTuru] };
  }
  if (!tamamlamaKanitiDogrula(girdi.aracTuru, girdi.tamamlamaKaniti as TamamlamaKaniti)) {
    return { ok: false, hata: KANIT_HATASI[girdi.aracTuru] };
  }
  return { ok: true };
}
