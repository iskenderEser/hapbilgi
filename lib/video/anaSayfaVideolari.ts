// lib/video/anaSayfaVideolari.ts
// Ana sayfa için PAYLAŞILAN video verisi. Görünürlük kuralını (gorunurluk.ts) uygulayıp
// bir rolün GÖRECEĞİ yayınlanmış videoları çeker. app/ana-sayfa/api/route.ts çağırır (yalnız-izleme rolleri için).
//
// Kapsam:
//  - Tür kapısı: gorunenTurler(rol) — rol hangi türleri görüyorsa onlar.
//  - Konum: geniş roller → kendi firmalarındaki TÜM takımlar; dar roller → yalnız kendi takımı.
//    (Çok-firmalı yapı: başka firmanın videosu sızmaz.)
//
// Bilinçli olarak şimdilik DIŞARIDA:
//  - "Tüm firma" (takim_id NULL) içeriği: med/egt "tüm firma" seçimi henüz üretilemediği için
//    bu içerik yok. Üretim etkinleşince v_yayin_detay'a firma_id eklenip burada ele alınacak.
//  - Tüketici alanları (beğeni/favori/izlendi/puan): yalnız-izleme rolleri için gerekmiyor.
//    UTT/KD_UTT kendi sayfasını (getUttAnaSayfaVeri) kullanmaya devam ediyor.

import { SupabaseClient } from "@supabase/supabase-js";
import { IcerikTuru } from "./icerikTuru";
import { gorunenTurler, kapsamGenisMi } from "./gorunurluk";

export interface AnaSayfaVideo {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
  video_puani: number | null;
  yayin_tarihi: string;
  icerik_turu: IcerikTuru | null;
  ileri_sarma_acik: boolean; // yalnız-izleme modunda kullanılmaz; oynatıcı tipiyle uyum için
}

export async function getAnaSayfaVideolari(
  userId: string,
  rol: string,
  adminSupabase: SupabaseClient
): Promise<AnaSayfaVideo[]> {
  const turler = gorunenTurler(rol);
  if (turler.length === 0) return []; // İK rolleri, IU, tanımsız roller → ana sayfada video yok

  const { data: kullanici, error: kError } = await adminSupabase
    .from("kullanicilar")
    .select("takim_id, firma_id")
    .eq("kullanici_id", userId)
    .single();

  if (kError || !kullanici) throw new Error("Kullanıcı bilgisi alınamadı.");

  let query = adminSupabase
    .from("v_yayin_detay")
    .select("yayin_id, urun_adi, teknik_adi, video_url, thumbnail_url, video_puani, yayin_tarihi, icerik_turu, takim_id")
    .eq("durum", "yayinda")
    .in("icerik_turu", turler)
    .order("yayin_tarihi", { ascending: false });

  if (kapsamGenisMi(rol)) {
    // Geniş: kullanıcının firmasındaki tüm takımlar
    const { data: takimlar } = await adminSupabase
      .from("takimlar")
      .select("takim_id")
      .eq("firma_id", kullanici.firma_id);

    const takimIdler = (takimlar ?? []).map((t: any) => t.takim_id);
    query = query.in("takim_id", takimIdler.length > 0 ? takimIdler : ["00000000-0000-0000-0000-000000000000"]);
  } else {
    // Dar: yalnız kendi takımı
    if (!kullanici.takim_id) return [];
    query = query.eq("takim_id", kullanici.takim_id);
  }

  const { data: videolar, error } = await query;
  if (error) throw new Error("Videolar çekilemedi.");

  return (videolar ?? []).map((v: any) => ({
    yayin_id: v.yayin_id,
    urun_adi: v.urun_adi ?? "-",
    teknik_adi: v.teknik_adi ?? "-",
    video_url: v.video_url ?? null,
    thumbnail_url: v.thumbnail_url ?? null,
    video_puani: v.video_puani ?? null,
    yayin_tarihi: v.yayin_tarihi,
    icerik_turu: (v.icerik_turu as IcerikTuru) ?? null,
    ileri_sarma_acik: false,
  }));
}