// lib/video/bunnyTusIstemci.ts
//
// İSTEMCİ TARAFI TUS yardımcısı (A2/A4 ortak — docs/bunny_dogrudan_yukleme_is_plani.md).
// Vezneden alınan tek videoya özel süreli izinle dosyayı tarayıcıdan DOĞRUDAN
// Bunny'ye yükler — dosya bizim sunucuya uğramaz, API anahtarı istemciye asla inmez.
// Sunucu çekirdeği: bunnyYukleme.ts (oraya istemciden import YAPILMAZ).

import * as tus from "tus-js-client";

/** Vezne uçlarının (videolar/talepler bunny-yukleme-baslat) ortak yanıt sözleşmesi. */
export interface BunnyVezneIzni {
  yukleme_id?: string | null;
  video_guid: string;
  library_id: string | number;
  imza: string;
  son_kullanma: number;
  tus_endpoint: string;
  embed_url: string;
  baslik: string;
}

function yarimYuklemeBildir(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("hapbilgi:yarim-yukleme-degisti"));
}

export async function videoYuklemeOturumuGuncelle(
  yuklemeId: string | null | undefined,
  islem: "aktarim_tamamlandi" | "baglandi",
): Promise<void> {
  if (!yuklemeId) return;
  const yanit = await fetch("/api/ogrenme-araclari/yarim-yuklemeler", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ yukleme_id: yuklemeId, islem }),
  });
  const veri = await yanit.json().catch(() => ({}));
  if (!yanit.ok) throw new Error(veri.hata ?? "Video yükleme oturumu güncellenemedi.");
}

/** Dosyayı TUS ile doğrudan Bunny'ye yükler; kesintiden kaldığı yerden devam edebilir. */
export function bunnyTusYukle(
  dosya: File,
  izin: BunnyVezneIzni,
  onYuzde: (yuzde: number) => void
): Promise<void> {
  return new Promise<void>((tamamla, reddet) => {
    const yukleme = new tus.Upload(dosya, {
      endpoint: izin.tus_endpoint,
      retryDelays: [0, 1000, 3000, 5000],
      headers: {
        AuthorizationSignature: izin.imza,
        AuthorizationExpire: String(izin.son_kullanma),
        VideoId: izin.video_guid,
        LibraryId: String(izin.library_id),
      },
      metadata: { filetype: dosya.type, title: izin.baslik },
      onError: (error) => { yarimYuklemeBildir(); reddet(error); },
      onProgress: (yuklenen, toplam) => onYuzde(Math.round((yuklenen / toplam) * 100)),
      onSuccess: () => tamamla(),
    });
    // Aynı dosya ve aynı Bunny video kimliğiyle kesilen TUS aktarımı varsa
    // tarayıcının tuttuğu offset'ten sürdür; yoksa normal yüklemeyi başlat.
    void yukleme.findPreviousUploads()
      .then((oncekiler) => {
        const ayniVideo = oncekiler.find((onceki) =>
          onceki.metadata?.title === izin.baslik
          && onceki.size === dosya.size);
        if (ayniVideo) yukleme.resumeFromPreviousUpload(ayniVideo);
        yukleme.start();
      })
      .catch(() => yukleme.start());
  });
}
