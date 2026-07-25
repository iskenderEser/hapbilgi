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
import type { HedefRol } from "@/lib/utils/roller";

export interface TalepBilgisi {
  talep_id: string;
  talep_no: number | null;
  firma_adi: string;
  uretici_id: string | null;
  urun_adi: string;
  teknik_adi: string;
  egitim_turu: TalepTuru;
  hedef_rol: HedefRol;
  icerik_turu: string | null;
  aciklama: string | null;
  dosya_urls: any[] | null;
  hazir_video: boolean;
  hazir_soru_seti: boolean;
  soru_seti_buyuklugu: number;
  secenek_sayisi: number;
  video_basi_soru_sayisi: number;
  created_at: string | null;
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
  hedef_rol,
  icerik_turu,
  aciklama,
  dosya_urls,
  hazir_video,
  hazir_soru_seti,
  soru_seti_buyuklugu,
  secenek_sayisi,
  video_basi_soru_sayisi,
  created_at,
  urun_adi,
  teknik_adi,
  urunler ( urun_adi ),
  teknikler ( teknik_adi ),
  firmalar ( firma_adi )
`;

export function haritalaTalep(talep: any): TalepBilgisi {
  return {
    talep_id: talep.talep_id,
    talep_no: talep.talep_no ?? null,
    firma_adi: talep.firmalar?.firma_adi ?? "",
    uretici_id: talep.uretici_id ?? null,
    urun_adi: talep.urunler?.urun_adi ?? talep.urun_adi ?? "-",
    teknik_adi: talep.teknikler?.teknik_adi ?? talep.teknik_adi ?? "-",
    egitim_turu: (talep.egitim_turu ?? "urun_egitimi") as TalepTuru,
    hedef_rol: (talep.hedef_rol ?? "utt") as HedefRol,
    icerik_turu: talep.icerik_turu ?? null,
    aciklama: talep.aciklama ?? null,
    dosya_urls: talep.dosya_urls ?? null,
    hazir_video: talep.hazir_video === true,
    hazir_soru_seti: talep.hazir_soru_seti === true,
    soru_seti_buyuklugu: talep.soru_seti_buyuklugu ?? 25,
    secenek_sayisi: talep.secenek_sayisi ?? 2,
    video_basi_soru_sayisi: talep.video_basi_soru_sayisi ?? 2,
    created_at: talep.created_at ?? null,
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

  if (!data?.talepler) return null;
  return haritalaTalep(data.talepler);
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

  if (!data?.talepler) return null;
  return haritalaTalep(data.talepler);
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

  if (!data?.talepler) return null;
  return haritalaTalep(data.talepler);
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
  return haritalaTalep(data);
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

  const talep = (data as any)?.senaryolar?.talepler;
  if (!talep) return null;
  return haritalaTalep(talep);
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

  const talep = (data as any)?.videolar?.talepler;
  if (!talep) return null;
  return haritalaTalep(talep);
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

  return (data ?? []).map(haritalaTalep);
}
