// lib/uretim/surec.ts
//
// Üretim sürecinin TEK kural yeri (Yol 2 / Plan B).
// Bir aşama onaylandığında sıradaki işin (kabuk) doğması, ilgili İU'ya bildirim
// gitmesi ve hazır girişlerin (hazır video / hazır soru seti) hatta katılması
// burada yaşar. Katılım sonrası kod hazır/normal ayrımı taşımaz; kabuklar yeni
// modele göre doğar: talep_id dolu, kaynak='iu'|'hazir', iu_id=null (İU sahibi
// teslimde yazılır; hazırda İU yoktur). SUNUCU TARAFI: adminSupabase ile.

import { SupabaseClient } from "@supabase/supabase-js";
import { bildirimOlustur, cokluBildirimOlustur } from "@/lib/utils/bildirimOlustur";
import { hazirParametreKontrol } from "@/lib/uretim/parametreKontrol";

export interface SurecSonuc {
  ok: boolean;
  hata?: string;
}

export interface HazirVideoSonuc {
  ok: true;
  video_id: string;
  soruSetiIslendi: boolean; // hazır set otomatik işlenip onaylandıysa true
}
export interface HazirHata {
  ok: false;
  hata: string;
  adim: string;
}

/**
 * Senaryo onaylandığında: video kabuğu doğar (kaynak='iu', iu_id=null) ve
 * senaryoyu yazan İU'ya "video yüklemeye hazır" bildirimi gider.
 */
export async function senaryoOnayindaVideoAc(
  adminSupabase: SupabaseClient,
  params: {
    senaryo_durum_id: string;
    talep_id: string;
    senaryo_iu_id: string | null;
    onaylayan_id: string;
    urun_adi: string;
  }
): Promise<SurecSonuc> {
  const { data: video, error } = await adminSupabase
    .from("videolar")
    .insert({
      senaryo_durum_id: params.senaryo_durum_id,
      talep_id: params.talep_id,
      kaynak: "iu",
      iu_id: null,
      video_url: "",
    })
    .select("video_id")
    .single();

  if (error || !video) return { ok: false, hata: error?.message ?? "Video kabuğu oluşturulamadı." };

  if (params.senaryo_iu_id) {
    await bildirimOlustur({
      adminSupabase,
      alici_id: params.senaryo_iu_id,
      gonderen_id: params.onaylayan_id,
      kayit_turu: "video",
      kayit_id: video.video_id,
      mesaj: `Senaryon onaylandı, video yüklemeye hazır: ${params.urun_adi}`,
    });
  }
  return { ok: true };
}

/**
 * Video onaylandığında: soru seti kabuğu doğar (kaynak='iu', iu_id=null) ve
 * videoyu üreten İU'ya "soru seti yazmaya hazır" bildirimi gider.
 */
export async function videoOnayindaSoruSetiAc(
  adminSupabase: SupabaseClient,
  params: {
    video_durum_id: string;
    talep_id: string;
    video_iu_id: string | null;
    onaylayan_id: string;
    urun_adi: string;
  }
): Promise<SurecSonuc> {
  const { data: set, error } = await adminSupabase
    .from("soru_setleri")
    .insert({
      video_durum_id: params.video_durum_id,
      talep_id: params.talep_id,
      kaynak: "iu",
      iu_id: null,
      sorular: [],
    })
    .select("soru_seti_id")
    .single();

  if (error || !set) return { ok: false, hata: error?.message ?? "Soru seti kabuğu oluşturulamadı." };

  if (params.video_iu_id) {
    await bildirimOlustur({
      adminSupabase,
      alici_id: params.video_iu_id,
      gonderen_id: params.onaylayan_id,
      kayit_turu: "soru_seti",
      kayit_id: set.soru_seti_id,
      mesaj: `Videon onaylandı, soru seti yazmaya hazır: ${params.urun_adi}`,
    });
  }
  return { ok: true };
}

/**
 * Talebin hazır videosu var mı? Varsa video_id döner, yoksa null.
 * (Hazır video PUT'ta yeniden yükleme telafisi için — mükerrer giriş engellenir.)
 */
export async function hazirVideoBul(
  adminSupabase: SupabaseClient,
  talep_id: string
): Promise<string | null> {
  const { data } = await adminSupabase
    .from("videolar")
    .select("video_id")
    .eq("talep_id", talep_id)
    .eq("kaynak", "hazir")
    .limit(1)
    .maybeSingle();
  return (data as any)?.video_id ?? null;
}

/**
 * Hazır video hatta "video onaylandı" girişinden katılır: talebe DOĞRUDAN bağlı
 * video (kaynak='hazir', senaryosuz) + onaylı durum. Ardından:
 *  - hazır soru seti varsa: doldurulup onaylanır (hazirSoruSetiGir),
 *  - yoksa: İU'ya boş set kabuğu (kaynak='iu') açılır; hazır videoda üreten İU
 *    olmadığından iş havuza düşer, tüm aktif İU'lara bildirim gider (sahiplik
 *    borcu — bkz. plan §5; sorumlu İU modeli ayrı tur).
 * Fake senaryo YOKtur.
 */
export async function hazirVideoGir(
  adminSupabase: SupabaseClient,
  girdi: {
    talep_id: string;
    video_url: string;
    hazir_soru_seti: boolean;
    hazir_soru_seti_verisi: any[] | null;
    soru_seti_buyuklugu: number | null;
    video_basi_soru_sayisi: number | null;
    urun_adi: string;
    degistiren_id: string;
  }
): Promise<HazirVideoSonuc | HazirHata> {
  // 1. video — talebe doğrudan bağlı, senaryo yok
  const { data: video, error: vErr } = await adminSupabase
    .from("videolar")
    .insert({
      talep_id: girdi.talep_id,
      senaryo_durum_id: null,
      kaynak: "hazir",
      iu_id: null,
      video_url: girdi.video_url,
      thumbnail_url: null,
    })
    .select("video_id")
    .single();
  if (vErr || !video) return { ok: false, hata: vErr?.message ?? "Video oluşturulamadı.", adim: "videolar INSERT" };

  // 2. video_durumu — otomatik onay
  const { data: vd, error: vdErr } = await adminSupabase
    .from("video_durumu")
    .insert({ video_id: video.video_id, durum: "onaylandi", degistiren_id: girdi.degistiren_id, notlar: "Hazır video — otomatik onay" })
    .select("video_durum_id")
    .single();
  if (vdErr || !vd) return { ok: false, hata: vdErr?.message ?? "Video durumu oluşturulamadı.", adim: "video_durumu INSERT" };

  // 3. soru seti
  if (girdi.hazir_soru_seti && girdi.hazir_soru_seti_verisi) {
    const s = await hazirSoruSetiGir(adminSupabase, {
      talep_id: girdi.talep_id,
      video_durum_id: vd.video_durum_id,
      sorular: girdi.hazir_soru_seti_verisi,
      soru_seti_buyuklugu: girdi.soru_seti_buyuklugu,
      video_basi_soru_sayisi: girdi.video_basi_soru_sayisi,
      degistiren_id: girdi.degistiren_id,
    });
    if (!s.ok) return s;
    return { ok: true, video_id: video.video_id, soruSetiIslendi: true };
  }

  // Hazır set yok → İU'ya boş set kabuğu; iş havuza düşer (tüm aktif İU'ya bildirim)
  const { data: set, error: sErr } = await adminSupabase
    .from("soru_setleri")
    .insert({ talep_id: girdi.talep_id, video_durum_id: vd.video_durum_id, kaynak: "iu", iu_id: null, sorular: [] })
    .select("soru_seti_id")
    .single();
  if (sErr || !set) return { ok: false, hata: sErr?.message ?? "Soru seti kabuğu oluşturulamadı.", adim: "soru_setleri INSERT" };

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
      gonderen_id: girdi.degistiren_id,
      kayit_turu: "soru_seti",
      kayit_id: set.soru_seti_id,
      mesaj: `Hazır video yüklendi, soru seti yazmaya hazır: ${girdi.urun_adi}`,
    });
  }
  return { ok: true, video_id: video.video_id, soruSetiIslendi: false };
}

/**
 * Hazır soru seti hatta "soru seti onaylandı" girişinden katılır: soru_setleri
 * (kaynak='hazir', dolu) + otomatik onay. Parametre kilidi dahil. İki çağıran:
 *  - hazirVideoGir (video+set hazır),
 *  - videolar/api/durum video onay ucu (video İU'dan, set hazır).
 */
export async function hazirSoruSetiGir(
  adminSupabase: SupabaseClient,
  girdi: {
    talep_id: string;
    video_durum_id: string;
    sorular: any[];
    soru_seti_buyuklugu: number | null;
    video_basi_soru_sayisi: number | null;
    degistiren_id: string;
  }
): Promise<{ ok: true; soru_seti_id: string } | HazirHata> {
  const parametreHatasi = hazirParametreKontrol(girdi.soru_seti_buyuklugu, girdi.video_basi_soru_sayisi, girdi.sorular?.length ?? 0);
  if (parametreHatasi) return { ok: false, hata: parametreHatasi, adim: "hazır parametre kontrolü" };

  const { data: set, error: sErr } = await adminSupabase
    .from("soru_setleri")
    .insert({
      talep_id: girdi.talep_id,
      video_durum_id: girdi.video_durum_id,
      kaynak: "hazir",
      iu_id: null,
      sorular: girdi.sorular,
    })
    .select("soru_seti_id")
    .single();
  if (sErr || !set) return { ok: false, hata: sErr?.message ?? "Soru seti oluşturulamadı.", adim: "soru_setleri INSERT" };

  const { error: sdErr } = await adminSupabase
    .from("soru_seti_durumu")
    .insert({ soru_seti_id: set.soru_seti_id, durum: "onaylandi", degistiren_id: girdi.degistiren_id, notlar: "Hazır soru seti — otomatik onay" });
  if (sdErr) return { ok: false, hata: sdErr.message, adim: "soru_seti_durumu INSERT" };

  return { ok: true, soru_seti_id: set.soru_seti_id };
}
