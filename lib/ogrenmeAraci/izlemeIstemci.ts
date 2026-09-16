import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";

export interface OgrenmeAraciIzlemeBaslangici {
  izlemeId: string;
  ilerleme?: ({ sonKonumSaniye?: number } & Record<string, unknown>) | null;
  izlemeTuru?: string | null;
}

const BASLATMA_HATASI: Record<OgrenmeAraciTuru, string> = {
  video: "Video izlemesi başlatılamadı.",
  podcast: "Podcast dinlemesi başlatılamadı.",
  gorsel: "Görsel incelemesi başlatılamadı.",
  flip_pdf: "Literatür açılamadı.",
};

export async function ogrenmeAraciIzlemesiniBaslat(girdi: {
  url: string;
  govde: Record<string, unknown>;
  aracTuru: OgrenmeAraciTuru;
}): Promise<OgrenmeAraciIzlemeBaslangici> {
  const response = await fetch(girdi.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(girdi.govde),
  });
  const data = await response.json();
  if (!response.ok || typeof data.izleme?.izleme_id !== "string") {
    throw new Error(data.hata ?? BASLATMA_HATASI[girdi.aracTuru]);
  }
  return {
    izlemeId: data.izleme.izleme_id,
    ilerleme: data.izleme.ilerleme_durumu ?? null,
    izlemeTuru: data.izleme.izleme_turu ?? null,
  };
}
