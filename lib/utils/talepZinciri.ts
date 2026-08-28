// lib/utils/talepZinciri.ts
// Senaryo, video veya soru seti ID'sinden talep bilgisine ulaşan merkezi utility.
//
// Adım 5 (22.07): Yol 2 sonrası video ve soru seti talebe DOĞRUDAN bağlı
// (`talep_id`). Eski zincir yürüme (video→senaryo_durumu→senaryolar→talep,
// set→video_durumu→...→talep) kaldırıldı — hem sadeleşti hem hazır kolu düzeltti
// (hazır videoda `senaryo_durum_id=null` olduğundan eski zincir null dönüyordu).
// Senaryo zaten talebe bağlıdır (tek hop). Dönüş şekli (TalepBilgisi) değişmedi.

import { SupabaseClient } from "@supabase/supabase-js";
import type { TalepTuru } from "@/lib/uretici/yetenekler";
import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";
import { ROL_ADLARI, hedefRolleriOku, type HedefRoller } from "@/lib/utils/roller";
import { departmanKey, type DepartmanKey } from "@/lib/video/departman";

export interface TalepBilgisi {
  talep_id: string;
  talep_no: number | null;
  firma_adi: string;
  uretici_id: string | null;
  /** Talebi açanın UNVANI (Ürün Müdürü, Eğitim Müdürü…). "PM"/"üretici" kod
   *  dilidir, ekrana çıkmaz — İÜ'ye gösterilen her metin bunu kullanır. */
  uretici_rol_adi: string | null;
  /** Talebi açan rolün DEPARTMAN anahtarı (urun/medikal/egitim/ik) — klasörleme
   *  bunun üzerinden yürür (26.07). Ham kod (pm, jr_pm, kd_pm, egt_md…) künyeden
   *  dışarı çıkmaz: üç ayrı ürün rolü tek "Ürün" klasörüne düşer ve bu eşleme
   *  ekranlara dağılırsa iki liste farklı klasörleme gösterebilir. Unvan
   *  (uretici_rol_adi) metin içindir, departman gruplama içindir — ikisi ayrı. */
  departman: DepartmanKey;
  urun_adi: string;
  teknik_adi: string;
  egitim_turu: TalepTuru;
  ogrenme_araci_turu: OgrenmeAraciTuru;
  ogrenme_araci_tercihleri: Record<string, unknown>;
  hedef_roller: HedefRoller;
  icerik_turu: string | null;
  aciklama: string | null;
  dosya_urls: unknown[] | null;
  hazir_video: boolean;
  hazir_soru_seti: boolean;
  soru_seti_buyuklugu: number;
  secenek_sayisi: number;
  video_basi_soru_sayisi: number;
  created_at: string | null;
  yayin_oncesi_silme_durumu: "isleniyor" | "tamamlandi" | "hata" | null;
  yayin_oncesi_silme_tarihi: string | null;
}

export interface HamTalepKaydi {
  talep_id: string;
  talep_no?: number | null;
  uretici_id?: string | null;
  egitim_turu?: string | null;
  ogrenme_araci_turu?: string | null;
  ogrenme_araci_tercihleri?: Record<string, unknown> | null;
  hedef_roller?: unknown;
  icerik_turu?: string | null;
  aciklama?: string | null;
  dosya_urls?: unknown[] | null;
  hazir_video?: boolean | null;
  hazir_soru_seti?: boolean | null;
  soru_seti_buyuklugu?: number | null;
  secenek_sayisi?: number | null;
  video_basi_soru_sayisi?: number | null;
  created_at?: string | null;
  yayin_oncesi_silme_durumu?: "isleniyor" | "tamamlandi" | "hata" | null;
  yayin_oncesi_silme_tarihi?: string | null;
  urun_adi?: string | null;
  teknik_adi?: string | null;
  urunler?: { urun_adi?: string | null } | Array<{ urun_adi?: string | null }> | null;
  teknikler?: { teknik_adi?: string | null } | Array<{ teknik_adi?: string | null }> | null;
  firmalar?: { firma_adi?: string | null } | Array<{ firma_adi?: string | null }> | null;
  kullanicilar?: { rol?: string | null } | Array<{ rol?: string | null }> | null;
}

// talepler embed'i için ortak alan listesi ve haritalama — üç giriş de aynı.
//
// AD KURALI (25.07): içeriğin adı İKİ kaynaktan gelebilir. Ürünlü türlerde
// urunler/teknikler join'inden, ürünsüz türlerde (ik_egitimi, kurumsal vb.)
// talepler'in KENDİ serbest alanlarından — talep açılırken oraya yazılır
// (app/talepler/api/route.ts:197). Serbest alanlar sorguya alınmadığı için bu
// kaynak ürünsüz eğitimlerde "-" döndürüyordu; bildirim metinlerine ve Bunny
// video başlığına da "-" gidiyordu. Yedek zinciri artık burada, tek yerde.
// SUNUCU TARAFI İÇİN DIŞA AÇIK (25.07, Aşama 3): ekranlar künyeyi /talepler/api/kunye
// ucundan alır, ama sunucuda çalışan modüller (ana sayfa veri üreticileri) kendi
// kendine HTTP isteği atmaz — aynı listeyi ve çeviriciyi doğrudan kullanır.
// Tek kaynak korunur, erişim yolu iki tanedir.
export const TALEP_ALANLARI = `
  talep_id,
  talep_no,
  uretici_id,
  egitim_turu,
  ogrenme_araci_turu,
  ogrenme_araci_tercihleri,
  hedef_roller,
  icerik_turu,
  aciklama,
  dosya_urls,
  hazir_video,
  hazir_soru_seti,
  soru_seti_buyuklugu,
  secenek_sayisi,
  video_basi_soru_sayisi,
  created_at,
  yayin_oncesi_silme_durumu,
  yayin_oncesi_silme_tarihi,
  urun_adi,
  teknik_adi,
  urunler ( urun_adi ),
  teknikler ( teknik_adi ),
  firmalar ( firma_adi ),
  kullanicilar!uretici_id ( rol )
`;

export function haritalaTalep(talep: HamTalepKaydi): TalepBilgisi {
  const firmalar = Array.isArray(talep.firmalar) ? talep.firmalar[0] : talep.firmalar;
  const urunler = Array.isArray(talep.urunler) ? talep.urunler[0] : talep.urunler;
  const teknikler = Array.isArray(talep.teknikler) ? talep.teknikler[0] : talep.teknikler;
  const kullanicilar = Array.isArray(talep.kullanicilar) ? talep.kullanicilar[0] : talep.kullanicilar;

  return {
    talep_id: talep.talep_id,
    talep_no: talep.talep_no ?? null,
    firma_adi: firmalar?.firma_adi ?? "",
    uretici_id: talep.uretici_id ?? null,
    uretici_rol_adi: kullanicilar?.rol ? (ROL_ADLARI[kullanicilar.rol] ?? kullanicilar.rol) : null,
    departman: departmanKey(kullanicilar?.rol),
    urun_adi: urunler?.urun_adi ?? talep.urun_adi ?? "-",
    teknik_adi: teknikler?.teknik_adi ?? talep.teknik_adi ?? "-",
    egitim_turu: (talep.egitim_turu ?? "urun_egitimi") as TalepTuru,
    ogrenme_araci_turu: talep.ogrenme_araci_turu === "podcast" || talep.ogrenme_araci_turu === "gorsel" || talep.ogrenme_araci_turu === "flip_pdf"
      ? talep.ogrenme_araci_turu
      : "video",
    ogrenme_araci_tercihleri: talep.ogrenme_araci_tercihleri ?? {},
    hedef_roller: hedefRolleriOku(talep),
    icerik_turu: talep.icerik_turu ?? null,
    aciklama: talep.aciklama ?? null,
    dosya_urls: talep.dosya_urls ?? null,
    hazir_video: talep.hazir_video === true,
    hazir_soru_seti: talep.hazir_soru_seti === true,
    soru_seti_buyuklugu: talep.soru_seti_buyuklugu ?? 25,
    secenek_sayisi: talep.secenek_sayisi ?? 2,
    video_basi_soru_sayisi: talep.video_basi_soru_sayisi ?? 2,
    created_at: talep.created_at ?? null,
    yayin_oncesi_silme_durumu: talep.yayin_oncesi_silme_durumu ?? null,
    yayin_oncesi_silme_tarihi: talep.yayin_oncesi_silme_tarihi ?? null,
  };
}

// senaryolar → talep (senaryolar zaten talebe bağlı)
export async function talepBilgisiSenaryo(
  adminSupabase: SupabaseClient,
  senaryo_id: string
): Promise<TalepBilgisi | null> {
  const { data } = await adminSupabase
    .from("senaryolar")
    .select(`talep_id, talepler ( ${TALEP_ALANLARI} )`)
    .eq("senaryo_id", senaryo_id)
    .single();

  const talep = Array.isArray(data?.talepler) ? data?.talepler[0] : data?.talepler;
  if (!talep) return null;
  return haritalaTalep(talep as unknown as HamTalepKaydi);
}

// videolar → talep (doğrudan talep_id; hazır videoda da çalışır)
export async function talepBilgisiVideo(
  adminSupabase: SupabaseClient,
  video_id: string
): Promise<TalepBilgisi | null> {
  const { data } = await adminSupabase
    .from("videolar")
    .select(`talep_id, talepler ( ${TALEP_ALANLARI} )`)
    .eq("video_id", video_id)
    .single();

  const talep = Array.isArray(data?.talepler) ? data?.talepler[0] : data?.talepler;
  if (!talep) return null;
  return haritalaTalep(talep as unknown as HamTalepKaydi);
}

// soru_setleri → talep (doğrudan talep_id; hazır sette de çalışır)
export async function talepBilgisiSoruSeti(
  adminSupabase: SupabaseClient,
  soru_seti_id: string
): Promise<TalepBilgisi | null> {
  const { data } = await adminSupabase
    .from("soru_setleri")
    .select(`talep_id, talepler ( ${TALEP_ALANLARI} )`)
    .eq("soru_seti_id", soru_seti_id)
    .single();

  const talep = Array.isArray(data?.talepler) ? data?.talepler[0] : data?.talepler;
  if (!talep) return null;
  return haritalaTalep(talep as unknown as HamTalepKaydi);
}

// ─────────────────────────────────────────────────────────────────────────────
// EKRAN ANAHTARLARI (25.07 — Aşama 2b)
//
// Yukarıdaki üç giriş sunucu işlerinin elindeki kimlikleri kullanır (senaryo_id,
// video_id, soru_seti_id). Ekranların elinde başka kimlikler var: adres çubuğundaki
// talep_id / senaryo_durum_id / video_durum_id, listelerde ise talep kümesi.
// Aşağıdakiler o kimlikleri aynı künyeye çevirir — ekran alan listesi ve ad kuralı
// bilmez, yalnız kimliğini verir.
// ─────────────────────────────────────────────────────────────────────────────

// talep_id → talep (en kısa yol; talep detay ve senaryo detay ekranları)
export async function talepBilgisiTalep(
  adminSupabase: SupabaseClient,
  talep_id: string
): Promise<TalepBilgisi | null> {
  const { data } = await adminSupabase
    .from("talepler")
    .select(TALEP_ALANLARI)
    .eq("talep_id", talep_id)
    .maybeSingle();

  if (!data) return null;
  return haritalaTalep(data as unknown as HamTalepKaydi);
}

// senaryo_durumu → senaryolar → talep (video detay ekranının anahtarı)
export async function talepBilgisiSenaryoDurum(
  adminSupabase: SupabaseClient,
  senaryo_durum_id: string
): Promise<TalepBilgisi | null> {
  const { data } = await adminSupabase
    .from("senaryo_durumu")
    .select(`senaryolar ( talepler ( ${TALEP_ALANLARI} ) )`)
    .eq("senaryo_durum_id", senaryo_durum_id)
    .maybeSingle();

  const senaryolar = Array.isArray(data?.senaryolar) ? data.senaryolar[0] : data?.senaryolar;
  const talep = Array.isArray(senaryolar?.talepler) ? senaryolar?.talepler[0] : senaryolar?.talepler;
  if (!talep) return null;
  return haritalaTalep(talep as unknown as HamTalepKaydi);
}

// video_durumu → videolar → talep (soru seti detay ekranının anahtarı).
// videolar.talep_id doğrudan bağ olduğu için hazır videoda da çalışır.
export async function talepBilgisiVideoDurum(
  adminSupabase: SupabaseClient,
  video_durum_id: string
): Promise<TalepBilgisi | null> {
  const { data } = await adminSupabase
    .from("video_durumu")
    .select(`videolar ( talepler ( ${TALEP_ALANLARI} ) )`)
    .eq("video_durum_id", video_durum_id)
    .maybeSingle();

  const videolar = Array.isArray(data?.videolar) ? data.videolar[0] : data?.videolar;
  const talep = Array.isArray(videolar?.talepler) ? videolar?.talepler[0] : videolar?.talepler;
  if (!talep) return null;
  return haritalaTalep(talep as unknown as HamTalepKaydi);
}

// Çoklu talep → künye listesi (liste ekranları: tek sorgu, N+1 yok).
// Boş dizide sorgu hiç atılmaz.
export async function talepBilgileriCoklu(
  adminSupabase: SupabaseClient,
  talep_idler: string[]
): Promise<TalepBilgisi[]> {
  if (talep_idler.length === 0) return [];

  const { data } = await adminSupabase
    .from("talepler")
    .select(TALEP_ALANLARI)
    .in("talep_id", talep_idler);

  return ((data as HamTalepKaydi[] | null) ?? []).map(haritalaTalep);
}
