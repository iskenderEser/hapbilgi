// lib/video/anaSayfaVideolari.ts
// Ana sayfa için PAYLAŞILAN video verisi. Görünürlük kuralını (gorunurluk.ts) uygulayıp
// bir rolün GÖRECEĞİ yayınlanmış videoları çeker. app/ana-sayfa/api/route.ts çağırır (yalnız-izleme rolleri için).
//
// Kapsam:
//  - Tür kapısı: gorunenTurler(rol) — rol hangi türleri görüyorsa onlar.
//  - Konum: geniş roller → kendi firmalarındaki TÜM takımlar; dar roller → yalnız kendi takımı.
//    (Çok-firmalı yapı: başka firmanın videosu sızmaz.)
//  - BM ana sayfası kendi rolüne hedeflenen yayınları; TM saha görünümü UTT'ye
//    hedeflenen yayınları kendi takımı + firma geneli kapsamında gösterir.
//
// Varsayılan ortak çağrıda firma-geneli (takim_id NULL) içerik dışarıdadır;
// yalnız bunu açıkça isteyen rol çağrıları firma sınırı korunarak dahil eder.
//  - Tüketiciye özgü kişisel izleme/puan durumu: UTT/KD_UTT kendi sayfasını
//    (getUttAnaSayfaVeri) kullanmaya devam ediyor. BM/TM rafları için gereken
//    toplu etkileşim sayıları getSahaAnaSayfaVideolari tarafından ayrıca eklenir.

import { SupabaseClient } from "@supabase/supabase-js";
import { IcerikTuru } from "./icerikTuru";
import { gorunenTurler, kapsamGenisMi } from "./gorunurluk";
import { ogrenmeAraciBayraklari } from "@/lib/ogrenmeAraci/bayraklar";
import { yayinThumbnailUrlCoz, yayinVideoUrlCoz } from "@/lib/ogrenmeAraci/yayinThumbnail";
import { yayinGorunenUrunIdHaritasi } from "@/lib/urunler/gorunenId";

export interface AnaSayfaVideo {
  yayin_id: string;
  talep_no?: number | null;
  firma_adi?: string | null;
  urun_adi: string;
  gorunen_urun_id?: string | null;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
  video_puani: number | null;
  extra_puan?: number | null;
  yayin_tarihi: string;
  icerik_turu: IcerikTuru | null;
  ileri_sarma_acik: boolean; // yalnız-izleme modunda kullanılmaz; oynatıcı tipiyle uyum için
  arac_id?: string | null;
  arac_turu?: "video" | "podcast" | "gorsel" | "flip_pdf";
}

export interface SahaAnaSayfaVideo extends AnaSayfaVideo {
  izlenme_sayisi: number;
  begeni_sayisi: number;
  favori_sayisi: number;
  begeni_mi?: boolean;
  favori_mi?: boolean;
  son_izleme_tarihi?: string | null;
  gelen_challenge_id?: string | null;
}

interface AnaSayfaVideoSecenekleri {
  hedefRol?: string;
  firmaGeneliDahil?: boolean;
  tumFirmaTakimlariDahil?: boolean;
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
    .select("yayin_id, urun_adi, teknik_adi, video_url, thumbnail_url, arac_kapak_yolu, arac_dosya_yolu, arac_metadata, video_puani, yayin_tarihi, icerik_turu, takim_id, talep_no, firma_adi, arac_id, arac_turu")
    .eq("durum", "yayinda")
    .in("arac_turu", Object.entries(ogrenmeAraciBayraklari()).filter(([, acik]) => acik).map(([tur]) => tur))
    .in("icerik_turu", turler)
    .order("yayin_tarihi", { ascending: false });

  if (secenekler.hedefRol) {
    query = query.contains("hedef_roller", [secenekler.hedefRol]);
  }
  if (secenekler.hedefRol === "bm") {
    const simdi = new Date().toISOString();
    query = query.lte("yayin_tarihi", simdi)
      .or(`durdurma_tarihi.is.null,durdurma_tarihi.gt.${simdi}`);
  }

  if (kapsamGenisMi(rol) || secenekler.tumFirmaTakimlariDahil) {
    // Geniş: kullanıcının firmasındaki tüm takımlar
    const { data: takimlar } = await adminSupabase
      .from("takimlar")
      .select("takim_id")
      .eq("firma_id", kullanici.firma_id);

    const takimIdler = (takimlar ?? []).map(t => t.takim_id);
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

  type VYayinDetayRow = {
    yayin_id: string;
    talep_no?: number | null;
    firma_adi?: string | null;
    urun_adi?: string | null;
    teknik_adi?: string | null;
    video_url?: string | null;
    thumbnail_url?: string | null;
    arac_kapak_yolu?: string | null;
    arac_dosya_yolu?: string | null;
    video_puani?: number | null;
    yayin_tarihi: string;
    icerik_turu?: string | null;
    arac_id?: string | null;
    arac_turu?: "video" | "podcast" | "gorsel" | "flip_pdf";
  };

  const yayinListesi = (videolar as VYayinDetayRow[] | null) ?? [];
  const yayinIdler = yayinListesi.map((v) => v.yayin_id);
  const gorunenUrunIdleri = await yayinGorunenUrunIdHaritasi(adminSupabase, yayinIdler);
  const extraPuanMap = new Map<string, number>();

  if (yayinIdler.length > 0) {
    const { data: extraPuanlar } = await adminSupabase
      .from("yayin_yonetimi")
      .select("yayin_id, extra_puan")
      .in("yayin_id", yayinIdler);

    for (const item of extraPuanlar ?? []) {
      if (item.extra_puan != null) {
        extraPuanMap.set(item.yayin_id, item.extra_puan);
      }
    }
  }

  return yayinListesi.map(v => ({
    yayin_id: v.yayin_id,
    talep_no: v.talep_no ?? null,
    firma_adi: v.firma_adi ?? null,
    urun_adi: v.urun_adi ?? "-",
    gorunen_urun_id: gorunenUrunIdleri.get(v.yayin_id) ?? null,
    teknik_adi: v.teknik_adi ?? "-",
    video_url: yayinVideoUrlCoz(v),
    thumbnail_url: yayinThumbnailUrlCoz(v),
    video_puani: v.video_puani ?? null,
    extra_puan: extraPuanMap.get(v.yayin_id) ?? null,
    yayin_tarihi: v.yayin_tarihi,
    icerik_turu: (v.icerik_turu as IcerikTuru) ?? null,
    arac_id: v.arac_id ?? null,
    arac_turu: v.arac_turu ?? "video",
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
  if (rol === "bm") {
    const { data: kullanici, error: kullaniciHatasi } = await adminSupabase.from("kullanicilar")
      .select("firma_id").eq("kullanici_id", userId).single();
    if (kullaniciHatasi || !kullanici?.firma_id) throw new Error("BM firma kapsamı alınamadı.");
    const { data: firma, error: firmaHatasi } = await adminSupabase.from("firmalar")
      .select("aktif, cc_aktif").eq("firma_id", kullanici.firma_id).single();
    if (firmaHatasi || !firma) throw new Error("C-Club durumu alınamadı.");
    if (!firma.aktif || !firma.cc_aktif) return [];
  }
  const videolar = await getAnaSayfaVideolari(userId, rol, adminSupabase, {
    hedefRol: rol === "bm" ? "bm" : "utt",
    firmaGeneliDahil: true,
    tumFirmaTakimlariDahil: rol === "bm",
  });
  if (videolar.length === 0) return [];

  const yayinIdler = videolar.map((video) => video.yayin_id);
  const [begeniSonucu, favoriSonucu, izlemeSonucu, challengeSonucu, benimBegenilerim, benimFavorilerim] = await Promise.all([
    adminSupabase
      .from("video_begeniler")
      .select("yayin_id")
      .in("yayin_id", yayinIdler),
    adminSupabase
      .from("video_favoriler")
      .select("yayin_id")
      .in("yayin_id", yayinIdler),
    rol === "bm"
      ? adminSupabase.from("cc_izleme_kayitlari")
        .select("yayin_id, bm_id, izleme_bitis, izleme_baslangic")
        .in("yayin_id", yayinIdler).eq("tamamlandi_mi", true)
      : adminSupabase.from("izleme_kayitlari")
        .select("yayin_id")
        .in("yayin_id", yayinIdler).eq("tamamlandi_mi", true).eq("gercek_oynatma_mi", true),
    rol === "bm"
      ? adminSupabase.from("challenge_kayitlari")
        .select("challenge_id, yayin_id, created_at")
        .eq("alan_id", userId).eq("izlendi_mi", false)
        .in("yayin_id", yayinIdler).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    rol === "bm"
      ? adminSupabase.from("video_begeniler").select("yayin_id")
        .eq("kullanici_id", userId).in("yayin_id", yayinIdler)
      : Promise.resolve({ data: [], error: null }),
    rol === "bm"
      ? adminSupabase.from("video_favoriler").select("yayin_id")
        .eq("kullanici_id", userId).in("yayin_id", yayinIdler)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (begeniSonucu.error || favoriSonucu.error || izlemeSonucu.error || challengeSonucu.error || benimBegenilerim.error || benimFavorilerim.error) {
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
  const begendiklerim = new Set((benimBegenilerim.data ?? []).map((kayit) => kayit.yayin_id));
  const favorilerim = new Set((benimFavorilerim.data ?? []).map((kayit) => kayit.yayin_id));
  const izlemeler = say(izlemeSonucu.data ?? []);
  const gelenChallenge = new Map<string, string>();
  for (const challenge of challengeSonucu.data ?? []) {
    if (!gelenChallenge.has(challenge.yayin_id)) gelenChallenge.set(challenge.yayin_id, challenge.challenge_id);
  }
  const benimSonIzlemem = new Map<string, string>();
  if (rol === "bm") {
    for (const izleme of izlemeSonucu.data ?? []) {
      if (!("bm_id" in izleme) || izleme.bm_id !== userId) continue;
      const tarih = ("izleme_bitis" in izleme && izleme.izleme_bitis)
        || ("izleme_baslangic" in izleme && izleme.izleme_baslangic);
      if (typeof tarih !== "string") continue;
      const onceki = benimSonIzlemem.get(izleme.yayin_id);
      if (!onceki || new Date(tarih).getTime() > new Date(onceki).getTime()) benimSonIzlemem.set(izleme.yayin_id, tarih);
    }
  }

  return videolar.map((video) => ({
    ...video,
    izlenme_sayisi: izlemeler.get(video.yayin_id) ?? 0,
    begeni_sayisi: begeniler.get(video.yayin_id) ?? 0,
    favori_sayisi: favoriler.get(video.yayin_id) ?? 0,
    begeni_mi: begendiklerim.has(video.yayin_id),
    favori_mi: favorilerim.has(video.yayin_id),
    son_izleme_tarihi: benimSonIzlemem.get(video.yayin_id) ?? null,
    gelen_challenge_id: gelenChallenge.get(video.yayin_id) ?? null,
  }));
}
