// lib/utils/anaSayfa/iu.ts
//
// İU ana sayfa verisi (docs/iu_surecleri_is_gelistirme.md G-1 + DÜZELTME bölümü).
// İki kaynak birleşir, sonra talep bazında TEKİLLEŞTİRİLİR (çift satır hatası
// düzeltmesi — aynı talep için bildirim + kendi-işi satırı tek satıra iner):
//
//   Kaynak A — "Bekleyen İşler": okunmamış bildirimler (IU'nun asıl iş bulma
//   mekanizması, T-5). Zincir bilgileri kayit_turu başına TEK toplu sorguyla
//   çekilir — bildirim başına sorgu yok (T-6 N+1 yasağı).
//
//   Kaynak B — kendi işleri: iu_id = kullanıcı olan senaryolar/videolar/
//   soru_setleri, v_*_son_durum view'larıyla toplu birleşir. "Iptal Edildi"
//   listelenmez; "tamamlanan" satırlar 30 günlük pencereye tabidir.
//
// Çıktı sözleşmesi IuAnaSayfa.tsx ile birebir — tip buradan import edilir.

import { SupabaseClient } from "@supabase/supabase-js";
import { iuKendiDurumunuEsle, talepBazindaTekillestir, type IuKategori } from "@/lib/utils/anaSayfa/iuDurumEsle";
import { TALEP_TURU_KURALLARI, type TalepTuru } from "@/lib/uretici/yetenekler";

export interface IsSatiri {
  talep_id: string;
  urun_adi: string;
  teknik_adi: string;
  turu_adi: string | null; // içerik/eğitim türü ("Medikal Eğitim" vb.) — bilgilendirici etiket
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

interface Bildirim {
  kayit_turu: string;
  kayit_id: string;
  mesaj: string;
  created_at: string;
}

interface ZincirBilgi {
  talep_id: string;
  urun_adi: string;
  teknik_adi: string;
  turu_adi: string | null;
  yol: string;
}

const TAMAMLANAN_PENCERE_MS = 30 * 24 * 60 * 60 * 1000; // 30 gün — liste sınırsız büyümesin

const urunTeknik = (talep: any) => ({
  // Ürün yoksa serbest eğitim/içerik adına düş (medikal_egitim, ik_egitimi — İskender 24.07).
  urun_adi: talep?.urunler?.urun_adi ?? talep?.urun_adi ?? "-",
  teknik_adi: talep?.teknikler?.teknik_adi ?? "-",
  turu_adi: talep?.egitim_turu ? (TALEP_TURU_KURALLARI[talep.egitim_turu as TalepTuru]?.ad ?? null) : null,
});

// Kaynak A: bildirimlerin talep zinciri bilgileri — kayit_turu başına TEK sorgu.
// Dönen harita anahtarı `${kayit_turu}:${kayit_id}`.
async function bildirimZincirHaritasi(
  adminSupabase: SupabaseClient,
  bildirimler: Bildirim[]
): Promise<Map<string, ZincirBilgi>> {
  const harita = new Map<string, ZincirBilgi>();
  const idler = (tur: string) => bildirimler.filter(b => b.kayit_turu === tur).map(b => b.kayit_id);

  const [talepIdler, senaryoIdler, videoIdler, soruSetiIdler] =
    [idler("talep"), idler("senaryo"), idler("video"), idler("soru_seti")];

  const sorgular: PromiseLike<void>[] = [];

  if (talepIdler.length > 0) {
    sorgular.push(adminSupabase
      .from("talepler")
      .select("talep_id, egitim_turu, urun_adi, urunler(urun_adi), teknikler(teknik_adi)")
      .in("talep_id", talepIdler)
      .then(({ data }) => {
        for (const t of (data ?? []) as any[]) {
          harita.set(`talep:${t.talep_id}`, { talep_id: t.talep_id, ...urunTeknik(t), yol: `/senaryolar/${t.talep_id}` });
        }
      }));
  }

  if (senaryoIdler.length > 0) {
    sorgular.push(adminSupabase
      .from("senaryolar")
      .select("senaryo_id, talep_id, talepler(egitim_turu, urun_adi, urunler(urun_adi), teknikler(teknik_adi))")
      .in("senaryo_id", senaryoIdler)
      .then(({ data }) => {
        for (const s of (data ?? []) as any[]) {
          harita.set(`senaryo:${s.senaryo_id}`, { talep_id: s.talep_id, ...urunTeknik(s.talepler), yol: `/senaryolar/${s.talep_id}` });
        }
      }));
  }

  if (videoIdler.length > 0) {
    sorgular.push(adminSupabase
      .from("videolar")
      .select("video_id, senaryo_durum_id, senaryo_durumu(senaryolar(talep_id, talepler(egitim_turu, urun_adi, urunler(urun_adi), teknikler(teknik_adi))))")
      .in("video_id", videoIdler)
      .then(({ data }) => {
        for (const v of (data ?? []) as any[]) {
          const senaryo = v.senaryo_durumu?.senaryolar;
          if (!senaryo) continue;
          harita.set(`video:${v.video_id}`, { talep_id: senaryo.talep_id, ...urunTeknik(senaryo.talepler), yol: `/videolar/${v.senaryo_durum_id}` });
        }
      }));
  }

  if (soruSetiIdler.length > 0) {
    sorgular.push(adminSupabase
      .from("soru_setleri")
      .select("soru_seti_id, video_durum_id, video_durumu(videolar(senaryo_durumu(senaryolar(talep_id, talepler(egitim_turu, urun_adi, urunler(urun_adi), teknikler(teknik_adi))))))")
      .in("soru_seti_id", soruSetiIdler)
      .then(({ data }) => {
        for (const s of (data ?? []) as any[]) {
          const senaryo = s.video_durumu?.videolar?.senaryo_durumu?.senaryolar;
          if (!senaryo) continue;
          harita.set(`soru_seti:${s.soru_seti_id}`, { talep_id: senaryo.talep_id, ...urunTeknik(senaryo.talepler), yol: `/soru-setleri/${s.video_durum_id}` });
        }
      }));
  }

  await Promise.all(sorgular);
  return harita;
}

const BILDIRIM_ASAMA: Record<string, "Senaryo" | "Video" | "Soru Seti"> = {
  talep: "Senaryo",
  senaryo: "Senaryo",
  video: "Video",
  soru_seti: "Soru Seti",
};

async function bekleyenSatirlar(adminSupabase: SupabaseClient, userId: string): Promise<IsSatiri[]> {
  const { data: bildirimler } = await adminSupabase
    .from("bildirimler")
    .select("kayit_turu, kayit_id, mesaj, created_at")
    .eq("alici_id", userId)
    .eq("goruldu_mu", false)
    .order("created_at", { ascending: false });

  const ilgili = ((bildirimler ?? []) as Bildirim[]).filter(b => BILDIRIM_ASAMA[b.kayit_turu]);
  if (ilgili.length === 0) return [];

  const harita = await bildirimZincirHaritasi(adminSupabase, ilgili);

  return ilgili.flatMap(b => {
    const bilgi = harita.get(`${b.kayit_turu}:${b.kayit_id}`);
    if (!bilgi) return []; // zincir kopuksa (silinmiş kayıt) satır atlanır, çökme yok
    return [{
      talep_id: bilgi.talep_id,
      urun_adi: bilgi.urun_adi,
      teknik_adi: bilgi.teknik_adi,
      turu_adi: bilgi.turu_adi,
      asama: BILDIRIM_ASAMA[b.kayit_turu],
      durum: b.mesaj,
      tarih: b.created_at,
      yol: bilgi.yol,
      kategori: "bekleyen" as const,
    }];
  });
}

async function kendiSenaryolarim(adminSupabase: SupabaseClient, userId: string): Promise<IsSatiri[]> {
  const { data: satirlarim } = await adminSupabase
    .from("senaryolar")
    .select("senaryo_id, talep_id, created_at, talepler(egitim_turu, urun_adi, urunler(urun_adi), teknikler(teknik_adi))")
    .eq("iu_id", userId);
  if (!satirlarim || satirlarim.length === 0) return [];

  const ids = satirlarim.map((s: any) => s.senaryo_id);
  const { data: sonDurumlar } = await adminSupabase
    .from("v_senaryo_son_durum").select("senaryo_id, durum, created_at").in("senaryo_id", ids);
  const durumMap = new Map((sonDurumlar ?? []).map((d: any) => [d.senaryo_id, d]));

  return satirlarim.flatMap((s: any) => {
    const sd = durumMap.get(s.senaryo_id);
    const esleme = iuKendiDurumunuEsle(sd?.durum ?? null);
    if (!esleme) return []; // Iptal Edildi — listelenmez
    return [{
      talep_id: s.talep_id,
      ...urunTeknik(s.talepler),
      asama: "Senaryo" as const,
      durum: esleme.metin,
      tarih: sd?.created_at ?? s.created_at,
      yol: `/senaryolar/${s.talep_id}`,
      kategori: esleme.kategori,
    }];
  });
}

async function kendiVideolarim(adminSupabase: SupabaseClient, userId: string): Promise<IsSatiri[]> {
  const { data: satirlarim } = await adminSupabase
    .from("videolar")
    .select(`
      video_id, senaryo_durum_id, created_at,
      senaryo_durumu ( senaryolar ( talep_id, talepler ( egitim_turu, urun_adi, urunler(urun_adi), teknikler(teknik_adi) ) ) )
    `)
    .eq("iu_id", userId);
  if (!satirlarim || satirlarim.length === 0) return [];

  const ids = satirlarim.map((v: any) => v.video_id);
  const { data: sonDurumlar } = await adminSupabase
    .from("v_video_son_durum").select("video_id, durum, created_at").in("video_id", ids);
  const durumMap = new Map((sonDurumlar ?? []).map((d: any) => [d.video_id, d]));

  return satirlarim.flatMap((v: any) => {
    const senaryo = v.senaryo_durumu?.senaryolar;
    if (!senaryo?.talepler) return []; // zincir kopuksa satır atlanır, çökme yok
    const sd = durumMap.get(v.video_id);
    const esleme = iuKendiDurumunuEsle(sd?.durum ?? null);
    if (!esleme) return [];
    return [{
      talep_id: senaryo.talep_id,
      ...urunTeknik(senaryo.talepler),
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
      video_durumu ( videolar ( senaryo_durumu ( senaryolar ( talep_id, talepler ( egitim_turu, urun_adi, urunler(urun_adi), teknikler(teknik_adi) ) ) ) ) )
    `)
    .eq("iu_id", userId);
  if (!satirlarim || satirlarim.length === 0) return [];

  const ids = satirlarim.map((s: any) => s.soru_seti_id);
  const { data: sonDurumlar } = await adminSupabase
    .from("v_soru_seti_son_durum").select("soru_seti_id, durum, created_at").in("soru_seti_id", ids);
  const durumMap = new Map((sonDurumlar ?? []).map((d: any) => [d.soru_seti_id, d]));

  return satirlarim.flatMap((s: any) => {
    const senaryo = s.video_durumu?.videolar?.senaryo_durumu?.senaryolar;
    if (!senaryo?.talepler) return [];
    const sd = durumMap.get(s.soru_seti_id);
    const esleme = iuKendiDurumunuEsle(sd?.durum ?? null);
    if (!esleme) return [];
    return [{
      talep_id: senaryo.talep_id,
      ...urunTeknik(senaryo.talepler),
      asama: "Soru Seti" as const,
      durum: esleme.metin,
      tarih: sd?.created_at ?? s.created_at,
      yol: `/soru-setleri/${s.video_durum_id}`,
      kategori: esleme.kategori,
    }];
  });
}

export async function getIuAnaSayfaVeri(userId: string, adminSupabase: SupabaseClient): Promise<IuAnaSayfaVeri> {
  const [bekleyenler, senaryolarim, videolarim, soruSetlerim] = await Promise.all([
    bekleyenSatirlar(adminSupabase, userId),
    kendiSenaryolarim(adminSupabase, userId),
    kendiVideolarim(adminSupabase, userId),
    kendiSoruSetlerim(adminSupabase, userId),
  ]);

  const simdi = Date.now();
  const satirlar = talepBazindaTekillestir([
    ...bekleyenler, ...senaryolarim, ...videolarim, ...soruSetlerim,
  ])
    .filter(s => s.kategori !== "tamamlanan" || simdi - new Date(s.tarih).getTime() <= TAMAMLANAN_PENCERE_MS)
    .sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime());

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
