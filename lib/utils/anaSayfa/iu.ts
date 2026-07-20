// lib/utils/anaSayfa/iu.ts
//
// İU ana sayfa verisi (yeniden yazım — docs/iu_surecleri_is_gelistirme.md G-1).
// Eski sürüm components/ana-sayfa/IuAnaSayfa.tsx'in beklediği { satirlar,
// istatistikler } şeklini hiç üretmiyordu (T-1); bu sürüm iki kaynağı birleştirir:
//
//   Kaynak A — "Bekleyen İşler": IU'nun asıl iş bulma mekanizması bildirimler
//   sistemidir (yeni talep/revizyon → tüm/ilgili IU'lara bildirim gider, T-5).
//   Okunmamış (goruldu_mu=false) bildirimler kategori "bekleyen" olur.
//
//   Kaynak B — "Devam Eden" / "Revizyon" / "Tamamlanan": iu_id = bu kullanıcı
//   olan senaryolar/videolar/soru_setleri satırları, v_*_son_durum view'larından
//   (T-6) son durumla birleştirilip iuKendiDurumunuEsle ile kategoriye çevrilir.
//
// Çıktı sözleşmesi IuAnaSayfa.tsx ile birebir — frontend'e dokunulmadı.

import { SupabaseClient } from "@supabase/supabase-js";
import { talepBilgisiSenaryo, talepBilgisiVideo, talepBilgisiSoruSeti } from "@/lib/utils/talepZinciri";
import { iuKendiDurumunuEsle, type IuKategori } from "@/lib/utils/anaSayfa/iuDurumEsle";

// G-2 (docs/iu_surecleri_is_gelistirme.md): dönüş tipi burada tanımlanır, IuAnaSayfa.tsx
// aynı tipi import eder — backend/frontend şekli bir daha sessizce ayrışamaz.
export interface IsSatiri {
  talep_id: string;
  urun_adi: string;
  teknik_adi: string;
  asama: "Senaryo" | "Video" | "Soru Seti";
  durum: string;
  tarih: string;
  yol: string;
  kategori: IuKategori;
}

export interface IuAnaSayfaVeri {
  satirlar: IsSatiri[];
  istatistikler: { bekleyen: number; revizyon: number; devam: number; tamamlanan: number };
}

const BILDIRIM_ASAMA: Record<string, "Senaryo" | "Video" | "Soru Seti"> = {
  talep: "Senaryo",
  senaryo: "Senaryo",
  video: "Video",
  soru_seti: "Soru Seti",
};

async function bekleyenSatiriKur(
  adminSupabase: SupabaseClient,
  bildirim: { kayit_turu: string; kayit_id: string; mesaj: string; created_at: string }
): Promise<IsSatiri | null> {
  const asama = BILDIRIM_ASAMA[bildirim.kayit_turu];
  if (!asama) return null; // yayin/oneri/challenge — IU ana sayfasının kapsamı dışı

  if (bildirim.kayit_turu === "talep") {
    const { data: talep } = await adminSupabase
      .from("talepler")
      .select("talep_id, urunler(urun_adi), teknikler(teknik_adi)")
      .eq("talep_id", bildirim.kayit_id)
      .single();
    if (!talep) return null;
    return {
      talep_id: bildirim.kayit_id,
      urun_adi: (talep as any).urunler?.urun_adi ?? "-",
      teknik_adi: (talep as any).teknikler?.teknik_adi ?? "-",
      asama,
      durum: bildirim.mesaj,
      tarih: bildirim.created_at,
      yol: `/senaryolar/${bildirim.kayit_id}`,
      kategori: "bekleyen",
    };
  }

  const zincirCek = bildirim.kayit_turu === "senaryo" ? talepBilgisiSenaryo
    : bildirim.kayit_turu === "video" ? talepBilgisiVideo
    : talepBilgisiSoruSeti;
  const bilgi = await zincirCek(adminSupabase, bildirim.kayit_id);
  if (!bilgi) return null;

  const yol = bildirim.kayit_turu === "senaryo" ? `/senaryolar/${bilgi.talep_id}`
    : bildirim.kayit_turu === "video" ? "/videolar"
    : "/soru-setleri";

  return {
    talep_id: bilgi.talep_id,
    urun_adi: bilgi.urun_adi,
    teknik_adi: bilgi.teknik_adi,
    asama,
    durum: bildirim.mesaj,
    tarih: bildirim.created_at,
    yol,
    kategori: "bekleyen",
  };
}

async function kendiSenaryolarim(adminSupabase: SupabaseClient, userId: string): Promise<IsSatiri[]> {
  const { data: satirlarim } = await adminSupabase
    .from("senaryolar")
    .select("senaryo_id, talep_id, created_at, talepler(urunler(urun_adi), teknikler(teknik_adi))")
    .eq("iu_id", userId);
  if (!satirlarim || satirlarim.length === 0) return [];

  const ids = satirlarim.map((s: any) => s.senaryo_id);
  const { data: sonDurumlar } = await adminSupabase
    .from("v_senaryo_son_durum").select("senaryo_id, durum, created_at").in("senaryo_id", ids);
  const durumMap = new Map((sonDurumlar ?? []).map((d: any) => [d.senaryo_id, d]));

  return satirlarim.map((s: any) => {
    const sd = durumMap.get(s.senaryo_id);
    const esleme = iuKendiDurumunuEsle(sd?.durum ?? null);
    return {
      talep_id: s.talep_id,
      urun_adi: s.talepler?.urunler?.urun_adi ?? "-",
      teknik_adi: s.talepler?.teknikler?.teknik_adi ?? "-",
      asama: "Senaryo" as const,
      durum: esleme.metin,
      tarih: sd?.created_at ?? s.created_at,
      yol: `/senaryolar/${s.talep_id}`,
      kategori: esleme.kategori,
    };
  });
}

async function kendiVideolarim(adminSupabase: SupabaseClient, userId: string): Promise<IsSatiri[]> {
  const { data: satirlarim } = await adminSupabase
    .from("videolar")
    .select(`
      video_id, senaryo_durum_id, created_at,
      senaryo_durumu ( senaryolar ( talep_id, talepler ( urunler(urun_adi), teknikler(teknik_adi) ) ) )
    `)
    .eq("iu_id", userId);
  if (!satirlarim || satirlarim.length === 0) return [];

  const ids = satirlarim.map((v: any) => v.video_id);
  const { data: sonDurumlar } = await adminSupabase
    .from("v_video_son_durum").select("video_id, durum, created_at").in("video_id", ids);
  const durumMap = new Map((sonDurumlar ?? []).map((d: any) => [d.video_id, d]));

  return satirlarim.flatMap((v: any) => {
    const senaryo = v.senaryo_durumu?.senaryolar;
    const talep = senaryo?.talepler;
    if (!talep) return []; // zincir kopuksa (beklenmez) satır atlanır, çökme yok
    const sd = durumMap.get(v.video_id);
    const esleme = iuKendiDurumunuEsle(sd?.durum ?? null);
    return [{
      talep_id: senaryo.talep_id,
      urun_adi: talep.urunler?.urun_adi ?? "-",
      teknik_adi: talep.teknikler?.teknik_adi ?? "-",
      asama: "Video" as const,
      durum: esleme.metin,
      tarih: sd?.created_at ?? v.created_at,
      yol: `/videolar/${v.senaryo_durum_id}`,
      kategori: esleme.kategori,
    }];
  });
}

async function kendiSoruSetlerim(adminSupabase: SupabaseClient, userId: string): Promise<IsSatiri[]> {
  const { data: satirlarim } = await adminSupabase
    .from("soru_setleri")
    .select(`
      soru_seti_id, video_durum_id, created_at,
      video_durumu ( videolar ( senaryo_durumu ( senaryolar ( talep_id, talepler ( urunler(urun_adi), teknikler(teknik_adi) ) ) ) ) )
    `)
    .eq("iu_id", userId);
  if (!satirlarim || satirlarim.length === 0) return [];

  const ids = satirlarim.map((s: any) => s.soru_seti_id);
  const { data: sonDurumlar } = await adminSupabase
    .from("v_soru_seti_son_durum").select("soru_seti_id, durum, created_at").in("soru_seti_id", ids);
  const durumMap = new Map((sonDurumlar ?? []).map((d: any) => [d.soru_seti_id, d]));

  return satirlarim.flatMap((s: any) => {
    const senaryo = s.video_durumu?.videolar?.senaryo_durumu?.senaryolar;
    const talep = senaryo?.talepler;
    if (!talep) return [];
    const sd = durumMap.get(s.soru_seti_id);
    const esleme = iuKendiDurumunuEsle(sd?.durum ?? null);
    return [{
      talep_id: senaryo.talep_id,
      urun_adi: talep.urunler?.urun_adi ?? "-",
      teknik_adi: talep.teknikler?.teknik_adi ?? "-",
      asama: "Soru Seti" as const,
      durum: esleme.metin,
      tarih: sd?.created_at ?? s.created_at,
      yol: `/soru-setleri/${s.video_durum_id}`,
      kategori: esleme.kategori,
    }];
  });
}

export async function getIuAnaSayfaVeri(userId: string, adminSupabase: SupabaseClient): Promise<IuAnaSayfaVeri> {
  const { data: bildirimler } = await adminSupabase
    .from("bildirimler")
    .select("kayit_turu, kayit_id, mesaj, created_at")
    .eq("alici_id", userId)
    .eq("goruldu_mu", false)
    .order("created_at", { ascending: false });

  const [bekleyenSatirlar, senaryoSatirlari, videoSatirlari, soruSetiSatirlari] = await Promise.all([
    Promise.all((bildirimler ?? []).map(b => bekleyenSatiriKur(adminSupabase, b))),
    kendiSenaryolarim(adminSupabase, userId),
    kendiVideolarim(adminSupabase, userId),
    kendiSoruSetlerim(adminSupabase, userId),
  ]);

  const satirlar: IsSatiri[] = [
    ...bekleyenSatirlar.filter((s): s is IsSatiri => s !== null),
    ...senaryoSatirlari,
    ...videoSatirlari,
    ...soruSetiSatirlari,
  ].sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime());

  const sayimYap = (kategori: IuKategori) => satirlar.filter(s => s.kategori === kategori).length;

  return {
    satirlar,
    istatistikler: {
      bekleyen: sayimYap("bekleyen"),
      revizyon: sayimYap("revizyon"),
      devam: sayimYap("devam"),
      tamamlanan: sayimYap("tamamlanan"),
    },
  };
}
