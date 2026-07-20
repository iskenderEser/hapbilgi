// lib/hazirVideoSoruSeti/zincir.ts
//
// Hazır kolun (hazır video + hazır soru seti) zincir kurulumu TEK NOKTADA —
// İskender kararı (19.07.2026): hazır akış IU üretim hattından ayrı gruplanır,
// olası müdahale IU koluna dokunmaz. Video onayında sistem zinciri kurar:
// senaryo (atlandı) → senaryo durumu → video → video durumu → soru seti;
// hazır soru seti varsa sorular OTOMATİK işlenir ve durum "onaylandı" açılır
// (senaryo/videodaki "otomatik onay" deseninin aynısı) — IU'nun elle "sisteme
// işle" adımı kalktı. SUNUCU TARAFI: adminSupabase ile çağrılır.

import { SupabaseClient } from "@supabase/supabase-js";
import { hazirParametreKontrol } from "./parametreKontrol";
import { cokluBildirimOlustur } from "@/lib/utils/bildirimOlustur";

export interface HazirZincirGirdisi {
  talep_id: string;
  hazir_video_url: string;
  hazir_soru_seti: boolean;
  hazir_soru_seti_verisi: any[] | null;
  soru_seti_buyuklugu: number | null;
  video_basi_soru_sayisi: number | null;
  urun_adi?: string | null; // bildirim metni için (G-2)
}

export interface HazirZincirSonucu {
  ok: true;
  video_durum_id: string;
  soru_seti_id: string;
  soruSetiIslendi: boolean; // hazır set otomatik işlenip onaylandıysa true
}

export interface HazirZincirHata {
  ok: false;
  hata: string;
  adim: string;
  detay?: any;
}

export async function hazirZinciriKur(
  adminSupabase: SupabaseClient,
  girdi: HazirZincirGirdisi,
  degistiren_id: string
): Promise<HazirZincirSonucu | HazirZincirHata> {
  // Parametre kilidi: hazır set sayısı = toplam soru sayısı; video başı ≤ toplam.
  const hazirSetSayisi = girdi.hazir_soru_seti ? (girdi.hazir_soru_seti_verisi?.length ?? 0) : null;
  const parametreHatasi = hazirParametreKontrol(girdi.soru_seti_buyuklugu, girdi.video_basi_soru_sayisi, hazirSetSayisi);
  if (parametreHatasi) {
    return { ok: false, hata: parametreHatasi, adim: "hazır akış parametre kontrolü" };
  }

  // 1. senaryolar — hazır kolda senaryo aşaması atlanır
  const { data: senaryo, error: senaryoError } = await adminSupabase
    .from("senaryolar")
    .insert({
      talep_id: girdi.talep_id,
      iu_id: null,
      senaryo_metni: "[Hazır Video — Senaryo Atlandı]",
    })
    .select("senaryo_id")
    .single();

  if (senaryoError || !senaryo) {
    return { ok: false, hata: "Senaryo oluşturulamadı.", adim: "senaryolar tablosu INSERT", detay: senaryoError };
  }

  // 2. senaryo_durumu
  const { data: senaryoDurum, error: sdError } = await adminSupabase
    .from("senaryo_durumu")
    .insert({
      senaryo_id: senaryo.senaryo_id,
      durum: "onaylandi",
      degistiren_id,
      notlar: "Hazır video talebi — otomatik onay",
    })
    .select("senaryo_durum_id")
    .single();

  if (sdError || !senaryoDurum) {
    return { ok: false, hata: "Senaryo durumu oluşturulamadı.", adim: "senaryo_durumu tablosu INSERT", detay: sdError };
  }

  // 3. videolar
  const { data: video, error: videoError } = await adminSupabase
    .from("videolar")
    .insert({
      senaryo_durum_id: senaryoDurum.senaryo_durum_id,
      iu_id: null,
      video_url: girdi.hazir_video_url,
      thumbnail_url: null,
    })
    .select("video_id")
    .single();

  if (videoError || !video) {
    return { ok: false, hata: "Video oluşturulamadı.", adim: "videolar tablosu INSERT", detay: videoError };
  }

  // 4. video_durumu
  const { data: videoDurum, error: vdError } = await adminSupabase
    .from("video_durumu")
    .insert({
      video_id: video.video_id,
      durum: "onaylandi",
      degistiren_id,
      notlar: "Hazır video talebi — otomatik onay",
    })
    .select("video_durum_id")
    .single();

  if (vdError || !videoDurum) {
    return { ok: false, hata: "Video durumu oluşturulamadı.", adim: "video_durumu tablosu INSERT", detay: vdError };
  }

  // 5-6. Soru seti: hazır set varsa sorular DOĞRUDAN yazılıp otomatik onaylanır
  // (V2); yoksa boş set açılır ve IU'lara "yazmaya hazır" bildirimi gider (V1 — G-2).
  if (girdi.hazir_soru_seti && girdi.hazir_soru_seti_verisi) {
    const islenen = await hazirSoruSetiIsle(adminSupabase, videoDurum.video_durum_id, girdi, degistiren_id);
    if (!islenen.ok) return islenen;
    return {
      ok: true,
      video_durum_id: videoDurum.video_durum_id,
      soru_seti_id: islenen.soru_seti_id,
      soruSetiIslendi: true,
    };
  }

  const { data: soruSeti, error: ssError } = await adminSupabase
    .from("soru_setleri")
    .insert({
      video_durum_id: videoDurum.video_durum_id,
      iu_id: null,
      sorular: [],
    })
    .select("soru_seti_id")
    .single();

  if (ssError || !soruSeti) {
    return { ok: false, hata: "Soru seti oluşturulamadı.", adim: "soru_setleri tablosu INSERT", detay: ssError };
  }

  // G-2: iş bu anda doğdu — normal hattaki "soru seti yazmaya hazır" bildiriminin
  // hazır koldaki karşılığı. Hazır kolda videoyu yükleyen IU olmadığından tüm
  // aktif IU'lara gider (talep açılış bildirimi deseni). Bildirim başarısızlığı
  // zinciri düşürmez — set açılmıştır, iş listede görünür.
  const { data: iuKullanicilar } = await adminSupabase
    .from("kullanicilar")
    .select("kullanici_id")
    .eq("rol", "iu")
    .eq("aktif_mi", true);
  const iuIdler = (iuKullanicilar ?? []).map((k: any) => k.kullanici_id);
  if (iuIdler.length > 0) {
    await cokluBildirimOlustur({
      adminSupabase,
      alici_idler: iuIdler,
      gonderen_id: degistiren_id,
      kayit_turu: "soru_seti",
      kayit_id: soruSeti.soru_seti_id,
      mesaj: `Hazır video onaylandı, soru seti yazmaya hazır: ${girdi.urun_adi ?? "-"}`,
    });
  }

  return {
    ok: true,
    video_durum_id: videoDurum.video_durum_id,
    soru_seti_id: soruSeti.soru_seti_id,
    soruSetiIslendi: false,
  };
}

export interface HazirSoruSetiIslendi {
  ok: true;
  soru_seti_id: string;
}

/**
 * Hazır soru setini işler: parametre kilidi → sorular yazılır → "onaylandı"
 * durum kaydı (yayın bekleyenlerine düşer). İki çağıran var:
 * - hazirZinciriKur (V2: hazır video + hazır set),
 * - normal hattın video onay ucu (V3 / G-1a: video IU'dan, set üreticiden) —
 *   işleme mantığı modülde kalır, uç yalnız çağırır (F-07 gruplama kararı).
 */
export async function hazirSoruSetiIsle(
  adminSupabase: SupabaseClient,
  video_durum_id: string,
  girdi: Pick<HazirZincirGirdisi, "hazir_soru_seti_verisi" | "soru_seti_buyuklugu" | "video_basi_soru_sayisi">,
  degistiren_id: string
): Promise<HazirSoruSetiIslendi | HazirZincirHata> {
  const parametreHatasi = hazirParametreKontrol(
    girdi.soru_seti_buyuklugu,
    girdi.video_basi_soru_sayisi,
    girdi.hazir_soru_seti_verisi?.length ?? 0
  );
  if (parametreHatasi) {
    return { ok: false, hata: parametreHatasi, adim: "hazır akış parametre kontrolü" };
  }

  const { data: soruSeti, error: ssError } = await adminSupabase
    .from("soru_setleri")
    .insert({
      video_durum_id,
      iu_id: null,
      sorular: girdi.hazir_soru_seti_verisi,
    })
    .select("soru_seti_id")
    .single();

  if (ssError || !soruSeti) {
    return { ok: false, hata: "Soru seti oluşturulamadı.", adim: "soru_setleri tablosu INSERT", detay: ssError };
  }

  const { error: ssdError } = await adminSupabase
    .from("soru_seti_durumu")
    .insert({
      soru_seti_id: soruSeti.soru_seti_id,
      durum: "onaylandi",
      degistiren_id,
      notlar: "Hazır soru seti — otomatik onay",
    });

  if (ssdError) {
    return { ok: false, hata: "Soru seti durumu oluşturulamadı.", adim: "soru_seti_durumu tablosu INSERT", detay: ssdError };
  }

  return { ok: true, soru_seti_id: soruSeti.soru_seti_id };
}
