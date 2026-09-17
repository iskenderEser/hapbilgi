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

export async function videoYuklemeOturumuGuncelle(
  yuklemeId: string | null | undefined,
  islem: "aktarim_tamamlandi" | "baglandi",
): Promise<void> {
  if (!yuklemeId) return;
  try {
    await fetch("/api/ogrenme-araclari/yarim-yuklemeler", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yukleme_id: yuklemeId, islem }),
    });
  } catch {
    // Oturum güncellemesi arka plan tutanağıdır; TUS aktarımını kesintiye uğratamaz.
  }
}

/** Kesilen video aktarımının Bunny kaydını ve geçici oturumunu temizler. */
export async function videoYuklemeOturumuIptalEt(
  yuklemeId: string | null | undefined,
): Promise<void> {
  if (!yuklemeId) return;
  try {
    await fetch("/api/ogrenme-araclari/yarim-yuklemeler", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tur: "video", kimlik: yuklemeId }),
    });
  } catch {
    // Temizlik hatası kullanıcı akışını kesmez.
  }
}

/** Dosyayı TUS ile doğrudan Bunny'ye yükler; kesilirse yeni deneme sıfırdan başlar. */
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
      onError: reddet,
      onProgress: (yuklenen, toplam) => onYuzde(Math.round((yuklenen / toplam) * 100)),
      onSuccess: () => {
        console.info("[Bunny TUS tamamlandı]", {
          video_guid: izin.video_guid,
          library_id: izin.library_id,
          upload_url: yukleme.url,
          dosya_boyutu: dosya.size,
        });
        tamamla();
      },
    });
    // Video aktarımı kesilirse devam ettirilmez. Kullanıcının sonraki denemesi
    // yeni Bunny GUID'iyle sıfırdan başlar.
    yukleme.start();
  });
}
