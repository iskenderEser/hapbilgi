// lib/utils/uretimZinciri.ts
//
// ÜRETİM ZİNCİRİNİN TEK OKUMA YERİ (27.07.2026).
//
// Bir talebin üretim zinciri (senaryo → video → soru seti → yayın) DB'de
// v_uretici_icerik_takip view'inde tek sorguda çözülür; bu dosya o satırı okur ve
// "bu talep hangi aşamada, hangi durumda" sorusunu yanıtlar.
//
// Neden ortak dosya: aynı soruyu iki ekran soruyor —
//   • üretici ana sayfası (Yayın Listesi)  → lib/utils/anaSayfa/uretici.ts
//   • Talepler sayfası (devam eden / iptal ayrımı) → app/talepler/api/route.ts
// Kaskadı iki yere kopyalamak, iki ekranın zamanla farklı cevap vermesi demektir.
//
// SINIR: burada yalnız HAM zincir okunur ve aşama seçilir. Durum METNİ ve rengi
// mesaj.ts sözlüğünün işidir; kategori/kart eşlemesi ekranın işidir.

import type { SupabaseClient } from "@supabase/supabase-js";
import { kayitDurumKodu, yayinDurumKodu, type DurumKodu } from "@/lib/utils/durum/mesaj";

/** Zincirdeki konum. Dördüncüsü "Yayın" DEĞİL "Tamamlandı" — durum sütunundaki
 *  metinlerin çoğu "yayın" taşıdığı için yan yana aynı kelime tekrarlanıyordu. */
export type ZincirAsama = "Senaryo" | "Video" | "Soru Seti" | "Tamamlandı";

/** v_uretici_icerik_takip'in bir satırı: bir talebin zincir anlık görüntüsü. */
export interface ZincirSatiri {
  talep_id: string;
  senaryo_id: string | null;
  senaryo_iu_id: string | null;
  senaryo_durum: string | null;
  senaryo_durum_tarih: string | null;
  video_id: string | null;
  video_iu_id: string | null;
  video_durum: string | null;
  video_durum_tarih: string | null;
  soru_seti_id: string | null;
  soru_seti_iu_id: string | null;
  soru_seti_durum: string | null;
  soru_seti_durum_tarih: string | null;
  yayin_durum: string | null;
  yayin_tarihi: string | null;
}

export interface ZincirDurumu {
  asama: ZincirAsama;
  durum_kodu: DurumKodu;
  tarih: string;
  /** Bu aşamada tıklanınca gidilecek ekran. */
  yol: string;
  /** O anki aşamayı üstlenen İÜ (yoksa null — henüz kimse üstlenmemiş). */
  iu_id: string | null;
}

/** Zincirin okunacağı talep: kaskad yalnız bu üç alana bakar. */
export interface ZincirTalebi {
  talep_id: string;
  hazir_video: boolean;
  created_at: string | null;
  yayin_oncesi_silme_durumu?: "isleniyor" | "tamamlandi" | "hata" | null;
  yayin_oncesi_silme_tarihi?: string | null;
}

// Kolonlar açık yazılır (select("*") DEĞİL): denetim aracı yıldızı atlar, açık
// listede ise view kolonu değişirse `npm run denetim` bunu yakalar.
const ZINCIR_ALANLARI = `
  talep_id,
  senaryo_id, senaryo_iu_id, senaryo_durum, senaryo_durum_tarih,
  video_id, video_iu_id, video_durum, video_durum_tarih,
  soru_seti_id, soru_seti_iu_id, soru_seti_durum, soru_seti_durum_tarih,
  yayin_durum, yayin_tarihi
`;

/**
 * Zincir satırlarını talep_id → satır haritası olarak çeker.
 * View service_role yetkilidir; adminSupabase ile okunur.
 * Süzgeç iki biçimden biri: bir üreticinin tümü, ya da verilen talep kümesi.
 */
export async function zincirHaritasi(
  adminSupabase: SupabaseClient,
  suzgec: { ureticiId: string } | { talepIdler: string[] },
): Promise<Map<string, ZincirSatiri>> {
  const harita = new Map<string, ZincirSatiri>();

  // Boş küme sorgulanmaz: PostgREST'e boş .in() göndermek gereksiz gidiş-geliştir.
  if ("talepIdler" in suzgec && suzgec.talepIdler.length === 0) return harita;

  let sorgu = adminSupabase.from("v_uretici_icerik_takip").select(ZINCIR_ALANLARI);
  sorgu = "ureticiId" in suzgec
    ? sorgu.eq("uretici_id", suzgec.ureticiId)
    : sorgu.in("talep_id", suzgec.talepIdler);

  const { data, error } = await sorgu;
  if (error) throw new Error(`İçerik takibi çekilemedi: ${error.message}`);

  for (const z of (data ?? []) as unknown as ZincirSatiri[]) harita.set(z.talep_id, z);
  return harita;
}

/**
 * Zincirin nerede durduğunu bulur: ilk tamamlanmamış aşama talebin aşamasıdır.
 * Saf fonksiyon — sorgu yapmaz, yalnız view satırını okur.
 * Bekleyen aşamaların tarihi "bir önceki aşamanın onay tarihi"dir (oncekiTarih).
 *
 * "Kayıt yok" ile "kayıt var ama durumu yok" ayrımı *_id kolonlarının NULL'luğundan
 * yapılır — durum ikisinde de NULL'dur, ayrımı id verir.
 */
export function asamaCoz(talep: ZincirTalebi, z: ZincirSatiri): ZincirDurumu {
  if (talep.yayin_oncesi_silme_durumu) {
    const kod: DurumKodu = talep.yayin_oncesi_silme_durumu === "tamamlandi"
      ? "yayin_oncesi_silindi"
      : talep.yayin_oncesi_silme_durumu === "hata"
        ? "yayin_silme_hatasi"
        : "yayin_siliniyor";
    return {
      asama: "Tamamlandı",
      durum_kodu: kod,
      tarih: talep.yayin_oncesi_silme_tarihi ?? talep.created_at ?? "",
      yol: "/yayin-yonetimi",
      iu_id: z.soru_seti_iu_id,
    };
  }

  let oncekiTarih: string = talep.created_at ?? "";

  // ── Senaryo: yalnız normal kol. Hazır video senaryosuz, bu aşamayı atlar. ──
  if (!talep.hazir_video) {
    if (!z.senaryo_id) {
      // Senaryo kaydı yok → hiçbir İÜ işi üstlenmemiş; iş İÜ tarafında bekliyor.
      return { asama: "Senaryo", durum_kodu: "iu_iletildi", tarih: oncekiTarih, yol: `/talepler/${talep.talep_id}`, iu_id: null };
    }
    if (z.senaryo_durum !== "onaylandi") {
      return {
        asama: "Senaryo",
        durum_kodu: kayitDurumKodu(z.senaryo_durum, !!z.senaryo_iu_id),
        tarih: z.senaryo_durum_tarih ?? oncekiTarih,
        yol: `/senaryolar/${talep.talep_id}`,
        iu_id: z.senaryo_iu_id,
      };
    }
    oncekiTarih = z.senaryo_durum_tarih ?? oncekiTarih;
  }

  // ── Video (ortak): video talebe talep_id ile bağlı (hazır + normal). ──
  if (!z.video_id) {
    // Hazır kolda video kaydı yoksa yükleme üreticidedir. Normal kolda kabuk
    // senaryo onayıyla doğduğundan burada olmaması zincir kopmasıdır.
    const kod: DurumKodu = talep.hazir_video ? "video_bekleniyor" : "sistem_hatasi";
    return {
      asama: "Video",
      durum_kodu: kod,
      tarih: oncekiTarih,
      yol: talep.hazir_video ? `/talepler/${talep.talep_id}` : "/videolar",
      iu_id: null,
    };
  }
  if (z.video_durum !== "onaylandi") {
    return {
      asama: "Video",
      durum_kodu: kayitDurumKodu(z.video_durum, !!z.video_iu_id),
      tarih: z.video_durum_tarih ?? oncekiTarih,
      yol: "/videolar",
      iu_id: z.video_iu_id,
    };
  }
  oncekiTarih = z.video_durum_tarih ?? oncekiTarih;

  // ── Soru seti (ortak): set video_durum_id ile bağlı. ──
  if (!z.soru_seti_id) {
    // Set kabuğu video onayıyla (hazır kolda yükleme anında) doğar; yoksa zincir kopuktur.
    return { asama: "Soru Seti", durum_kodu: "sistem_hatasi", tarih: oncekiTarih, yol: "/soru-setleri", iu_id: null };
  }
  if (z.soru_seti_durum !== "onaylandi") {
    return {
      asama: "Soru Seti",
      durum_kodu: kayitDurumKodu(z.soru_seti_durum, !!z.soru_seti_iu_id),
      tarih: z.soru_seti_durum_tarih ?? oncekiTarih,
      yol: "/soru-setleri",
      iu_id: z.soru_seti_iu_id,
    };
  }
  oncekiTarih = z.soru_seti_durum_tarih ?? oncekiTarih;

  // ── Yayın: zincirin sonu. Kayıt yoksa yayına alma üreticidedir (mesaj.ts). ──
  return {
    asama: "Tamamlandı",
    durum_kodu: yayinDurumKodu(z.yayin_durum),
    tarih: z.yayin_tarihi ?? oncekiTarih,
    yol: "/yayin-yonetimi",
    iu_id: z.soru_seti_iu_id,
  };
}

/** Üretimi bitmiş mi? Bitenler Yayın Listesi'ne, bitmeyenler Talepler sayfasına ait. */
export const uretimBittiMi = (d: ZincirDurumu) => d.asama === "Tamamlandı";

/** İptal edilmiş mi? Ne devam eder ne yayına girer — kendi tablosunda durur. */
export const iptalEdildiMi = (d: ZincirDurumu) => d.durum_kodu === "iptal";
