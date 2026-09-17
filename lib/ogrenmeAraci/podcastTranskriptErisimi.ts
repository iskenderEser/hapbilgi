import "server-only";

interface PodcastTranskriptErisimSonucu {
  transkriptUrl: string | null;
  transkriptMetni: string | null;
  temizMetadata: Record<string, unknown>;
}

/**
 * Tüketiciye yalnız onaylanmış podcast transkriptini açar ve üretim sürecine ait
 * taslak, girişim, hata ve kullanıcı kimliği alanlarını yanıttan temizler.
 */
export function podcastTranskriptErisiminiCoz(girdi: {
  metadata: Record<string, unknown> | null | undefined;
  transkriptYolu: string | null | undefined;
  imzaliUrlUret: (yol: string) => string | null;
}): PodcastTranskriptErisimSonucu {
  const metadata = girdi.metadata ?? {};
  const transkriptObj = metadata.transkript && typeof metadata.transkript === "object"
    ? metadata.transkript as Record<string, unknown>
    : null;

  let transkriptUrl: string | null = null;
  let transkriptMetni: string | null = null;

  if (transkriptObj?.durum === "onaylandi") {
    transkriptUrl = girdi.transkriptYolu ? girdi.imzaliUrlUret(girdi.transkriptYolu) : null;
    transkriptMetni = typeof transkriptObj.onaylanan_metin === "string" && transkriptObj.onaylanan_metin.trim()
      ? transkriptObj.onaylanan_metin.trim()
      : null;
  } else if (!transkriptObj && metadata.transkript_dogrulandi === true) {
    transkriptUrl = girdi.transkriptYolu ? girdi.imzaliUrlUret(girdi.transkriptYolu) : null;
    transkriptMetni = typeof metadata.transkript_metni === "string" && metadata.transkript_metni.trim()
      ? metadata.transkript_metni.trim()
      : null;
  }

  const temizMetadata: Record<string, unknown> = { ...metadata };
  if (transkriptObj) {
    const kalanTranskript = { ...transkriptObj };
    delete kalanTranskript.taslak_metin;
    delete kalanTranskript.ai_girisim_id;
    delete kalanTranskript.hata_kodu;
    delete kalanTranskript.onaylayan_kullanici_id;
    if (transkriptObj.durum !== "onaylandi") {
      delete kalanTranskript.onaylanan_metin;
      delete temizMetadata.transkript_metni;
    }
    temizMetadata.transkript = kalanTranskript;
  } else if (metadata.transkript_dogrulandi !== true) {
    delete temizMetadata.transkript_metni;
  }

  delete temizMetadata.taslak_metin;
  delete temizMetadata.ai_girisim_id;
  delete temizMetadata.hata_kodu;
  delete temizMetadata.onaylayan_kullanici_id;

  return { transkriptUrl, transkriptMetni, temizMetadata };
}
