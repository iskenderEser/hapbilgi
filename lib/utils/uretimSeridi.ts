// lib/utils/uretimSeridi.ts
//
// ÜRETİM ŞERİDİNİN SAF ÇÖZÜCÜSÜ (docs/talepler_v2_is_plani.md, A-3).
//
// Talep merkezli sayfada (/talepler) aşama ayrı bir YER değil, talebin
// içindeki ADIM. Şerit her talepte SABİT BEŞ adım gösterir:
//   Talep → Senaryo → Video → Soru Seti → Yayın
//
// Varyant adım SAYISINI değiştirmez, adımın HALİNİ değiştirir (İskender kararı
// 28.07 — S-1): o üretim yönteminde hiç üretilmeyecek adımlar "kapali" gelir;
// ekranda kırmızı gösterilir ve işleme kapatılır. Böylece kullanıcı hangi
// yöntemi seçerse seçsin üretim sürecinin tüm adımlarını görür ve bilir.
//
// SINIR: burada yalnız HAL hesaplanır. Durum METNİ ve rengi mesaj.ts sözlüğünün,
// çizim ekranın işidir. Kaskad da burada yeniden yazılmaz — asamaCoz çağrılır,
// böylece ana sayfa / Talepler / bu şerit aynı cevabı verir.

import { asamaCoz, type ZincirSatiri, type ZincirTalebi } from "@/lib/utils/uretimZinciri";
import type { DurumKodu } from "@/lib/utils/durum/mesaj";

export type AdimAnahtari = "talep" | "senaryo" | "video" | "soru_seti" | "yayin";

/** tamam: kapandı · aktif: sıra burada · ileri: henüz gelmedi · kapali: bu varyantta hiç üretilmeyecek. */
export type AdimHal = "tamam" | "aktif" | "ileri" | "kapali";

export interface Adim {
  anahtar: AdimAnahtari;
  etiket: string;
  hal: AdimHal;
  /** Ekranda DurumPill'e verilecek kod. Talep / ileri / kapalı adımlarda null. */
  durum_kodu: DurumKodu | null;
  tarih: string | null;
  /** Yalnız Yayın adımında dolu: yayına alma işlemi kendi sayfasında yaşıyor (D-3). */
  yol?: string;
}

/** Şeridin çözülebilmesi için talepten gereken üç alan. */
export interface SeritTalebi extends ZincirTalebi {
  hazir_soru_seti: boolean;
}

const SIRA: AdimAnahtari[] = ["talep", "senaryo", "video", "soru_seti", "yayin"];

const ETIKET: Record<AdimAnahtari, string> = {
  talep: "Talep",
  senaryo: "Senaryo",
  video: "Video",
  soru_seti: "Soru Seti",
  yayin: "Yayın",
};

/** asamaCoz'un ZincirAsama'sı → şerit adımı. "Tamamlandı" zincirin sonudur, sırada yayına alma vardır. */
const ASAMA_ADIMI: Record<string, AdimAnahtari> = {
  "Senaryo": "senaryo",
  "Video": "video",
  "Soru Seti": "soru_seti",
  "Tamamlandı": "yayin",
};

/** View satırı yoksa boş satır gibi davranılır — fonksiyon çökmez, şerit yine 5 adım döner. */
const BOS_ZINCIR = (talep_id: string): ZincirSatiri => ({
  talep_id,
  senaryo_id: null, senaryo_iu_id: null, senaryo_durum: null, senaryo_durum_tarih: null,
  video_id: null, video_iu_id: null, video_durum: null, video_durum_tarih: null,
  soru_seti_id: null, soru_seti_iu_id: null, soru_seti_durum: null, soru_seti_durum_tarih: null,
  yayin_durum: null, yayin_tarihi: null,
});

/**
 * Varyantta hiç üretilmeyecek adımlar.
 * Hazır videoda senaryo yazılmaz (zincir yükleme anında kurulur); hazır soru
 * setinde set İÜ işi olarak doğmaz, video onayıyla otomatik onaylanır.
 */
function kapaliAdimlar(talep: SeritTalebi): Set<AdimAnahtari> {
  const kapali = new Set<AdimAnahtari>();
  if (talep.hazir_video) kapali.add("senaryo");
  if (talep.hazir_soru_seti) kapali.add("soru_seti");
  return kapali;
}

export function adimlariCoz(talep: SeritTalebi, z: ZincirSatiri | null): Adim[] {
  const zincir = z ?? BOS_ZINCIR(talep.talep_id);
  const durum = asamaCoz(talep, zincir);
  const kapali = kapaliAdimlar(talep);

  const aktifAdim = ASAMA_ADIMI[durum.asama] ?? "senaryo";
  const aktifSira = SIRA.indexOf(aktifAdim);

  const tarihler: Record<AdimAnahtari, string | null> = {
    talep: talep.created_at ?? null,
    senaryo: zincir.senaryo_durum_tarih,
    video: zincir.video_durum_tarih,
    soru_seti: zincir.soru_seti_durum_tarih,
    yayin: zincir.yayin_tarihi,
  };

  return SIRA.map((anahtar, sira) => {
    // Talep adımı her zaman kapanmıştır: talep açıldığı an bu adım bitmiştir.
    // Durum kodu VERİLMEZ — talep onaylanmadı, oluşturuldu; "onaylandi" kodu
    // ekrana "Onayladınız" yazdırırdı ve yanlış olurdu.
    if (anahtar === "talep") {
      return { anahtar, etiket: ETIKET[anahtar], hal: "tamam" as AdimHal, durum_kodu: null, tarih: tarihler.talep };
    }

    if (kapali.has(anahtar)) {
      return { anahtar, etiket: ETIKET[anahtar], hal: "kapali" as AdimHal, durum_kodu: null, tarih: null };
    }

    const hal: AdimHal = sira < aktifSira ? "tamam" : sira === aktifSira ? "aktif" : "ileri";
    const durum_kodu: DurumKodu | null =
      hal === "aktif" ? durum.durum_kodu : hal === "tamam" ? "onaylandi" : null;

    return {
      anahtar,
      etiket: ETIKET[anahtar],
      hal,
      durum_kodu,
      tarih: hal === "ileri" ? null : tarihler[anahtar],
      // Yayına alma bu sayfaya taşınmaz; adım tıklanınca kendi sayfasına gider (D-3).
      ...(anahtar === "yayin" ? { yol: "/yayin-yonetimi" } : {}),
    };
  });
}
