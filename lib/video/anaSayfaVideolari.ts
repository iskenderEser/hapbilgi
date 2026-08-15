// lib/video/anaSayfaVideolari.ts
// Ana sayfa için PAYLAŞILAN video verisi. Görünürlük kuralını (gorunurluk.ts) uygulayıp
// bir rolün GÖRECEĞİ yayınlanmış videoları çeker. app/ana-sayfa/api/route.ts çağırır (yalnız-izleme rolleri için).
//
// Kapsam:
//  - Tür kapısı: gorunenTurler(rol) — rol hangi türleri görüyorsa onlar.
//  - Konum: geniş roller → kendi firmalarındaki TÜM takımlar; dar roller → yalnız kendi takımı.
//    (Çok-firmalı yapı: başka firmanın videosu sızmaz.)
//  - BM/TM saha yönetimi görünümü: UTT ile eş katalog için kendi takımı + firma geneli ve
//    yalnız hedef_roller içinde 'utt' bulunan yayınlar.
//
// Varsayılan ortak çağrıda firma-geneli (takim_id NULL) içerik dışarıdadır;
// yalnız bunu açıkça isteyen rol çağrıları firma sınırı korunarak dahil eder.
//  - Tüketiciye özgü kişisel izleme/puan durumu: UTT/KD_UTT kendi sayfasını
//    (getUttAnaSayfaVeri) kullanmaya devam ediyor. BM/TM rafları için gereken
//    toplu etkileşim sayıları getSahaAnaSayfaVideolari tarafından ayrıca eklenir.

import { SupabaseClient } from "@supabase/supabase-js";
import { IcerikTuru } from "./icerikTuru";
import { gorunenTurler, kapsamGenisMi } from "./gorunurluk";

export interface AnaSayfaVideo {
  yayin_id: string;
  talep_no?: number | null;
  firma_adi?: string | null;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
  video_puani: number | null;
  yayin_tarihi: string;
  icerik_turu: IcerikTuru | null;
  ileri_sarma_acik: boolean; // yalnız-izleme modunda kullanılmaz; oynatıcı tipiyle uyum için
}

export interface SahaAnaSayfaVideo extends AnaSayfaVideo {
  izlenme_sayisi: number;
  begeni_sayisi: number;
  favori_sayisi: number;
}

interface AnaSayfaVideoSecenekleri {
  hedefRol?: string;
  firmaGeneliDahil?: boolean;
}

export async function getAnaSayfaVideolari(
  userId: string,
  rol: string,
  adminSupabase: SupabaseClient,
  secenekler: AnaSayfaVideoSecenekleri = {},
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
    .select("yayin_id, urun_adi, teknik_adi, video_url, thumbnail_url, video_puani, yayin_tarihi, icerik_turu, takim_id, talep_no, firma_adi")
    .eq("durum", "yayinda")
    .in("icerik_turu", turler)
    .order("yayin_tarihi", { ascending: false });

  if (secenekler.hedefRol) {
    query = query.contains("hedef_roller", [secenekler.hedefRol]);
  }

  if (kapsamGenisMi(rol)) {
    // Geniş: kullanıcının firmasındaki tüm takımlar
    const { data: takimlar } = await adminSupabase
      .from("takimlar")
      .select("takim_id")
      .eq("firma_id", kullanici.firma_id);

    const takimIdler = (takimlar ?? []).map((t: any) => t.takim_id);
    if (secenekler.firmaGeneliDahil) {
      const takimListe = takimIdler.length > 0 ? takimIdler.join(",") : "00000000-0000-0000-0000-000000000000";
      query = query.or(`takim_id.in.(${takimListe}),and(takim_id.is.null,firma_id.eq.${kullanici.firma_id})`);
    } else {
      query = query.in("takim_id", takimIdler.length > 0 ? takimIdler : ["00000000-0000-0000-0000-000000000000"]);
    }
  } else {
    // Dar: kendi takımı; istenirse aynı firmadaki takımsız genel içerik de dahil.
    if (kullanici.takim_id && secenekler.firmaGeneliDahil) {
      query = query.or(`takim_id.eq.${kullanici.takim_id},and(takim_id.is.null,firma_id.eq.${kullanici.firma_id})`);
    } else if (kullanici.takim_id) {
      query = query.eq("takim_id", kullanici.takim_id);
    } else if (secenekler.firmaGeneliDahil) {
      query = query.is("takim_id", null).eq("firma_id", kullanici.firma_id);
    } else {
      return [];
    }
  }

  const { data: videolar, error } = await query;
  if (error) throw new Error("Videolar çekilemedi.");

  return (videolar ?? []).map((v: any) => ({
    yayin_id: v.yayin_id,
    talep_no: v.talep_no ?? null,
    firma_adi: v.firma_adi ?? null,
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

/**
 * BM/TM ana sayfasındaki kategori raflarının kullandığı etkileşimli video verisi.
 * Görünür video kapsamı getAnaSayfaVideolari'nden gelir; burada yalnız raf
 * sıralaması için gereken tamamlanmış izleme, beğeni ve favori sayıları eklenir.
 */
export async function getSahaAnaSayfaVideolari(
  userId: string,
  rol: "bm" | "tm",
  adminSupabase: SupabaseClient,
): Promise<SahaAnaSayfaVideo[]> {
  const videolar = await getAnaSayfaVideolari(userId, rol, adminSupabase, {
    hedefRol: "utt",
    firmaGeneliDahil: true,
  });
  if (videolar.length === 0) return [];

  const yayinIdler = videolar.map((video) => video.yayin_id);
  const [begeniSonucu, favoriSonucu, izlemeSonucu] = await Promise.all([
    adminSupabase
      .from("video_begeniler")
      .select("yayin_id")
      .in("yayin_id", yayinIdler),
    adminSupabase
      .from("video_favoriler")
      .select("yayin_id")
      .in("yayin_id", yayinIdler),
    adminSupabase
      .from("izleme_kayitlari")
      .select("yayin_id")
      .in("yayin_id", yayinIdler)
      .eq("tamamlandi_mi", true)
      .eq("gercek_oynatma_mi", true),
  ]);

  if (begeniSonucu.error || favoriSonucu.error || izlemeSonucu.error) {
    throw new Error("Saha yöneticisi video etkileşim sayıları çekilemedi.");
  }

  const say = (satirlar: { yayin_id: string }[]) => {
    const sonuc = new Map<string, number>();
    for (const satir of satirlar) {
      sonuc.set(satir.yayin_id, (sonuc.get(satir.yayin_id) ?? 0) + 1);
    }
    return sonuc;
  };

  const begeniler = say(begeniSonucu.data ?? []);
  const favoriler = say(favoriSonucu.data ?? []);
  const izlemeler = say(izlemeSonucu.data ?? []);

  return videolar.map((video) => ({
    ...video,
    izlenme_sayisi: izlemeler.get(video.yayin_id) ?? 0,
    begeni_sayisi: begeniler.get(video.yayin_id) ?? 0,
    favori_sayisi: favoriler.get(video.yayin_id) ?? 0,
  }));
}
