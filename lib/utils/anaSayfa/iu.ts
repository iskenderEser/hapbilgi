// lib/utils/anaSayfa/iu.ts
//
// İÜ ana sayfa verisi.
//
// 25.07 KAYNAK DEĞİŞİKLİĞİ (İskender kararı — (b) seçeneği): satırlar artık
// OKUNMAMIŞ BİLDİRİMDEN değil, İŞİN KENDİSİNDEN türer. Eski kurguda "bekleyen
// işler" bildirim listesiydi; durum sütununa bildirim CÜMLESİ yazılıyordu
// ("Senaryon onaylandı, video yüklemeye hazır: X") ve İÜ bildirimi okuduğunda iş
// ana sayfadan kayboluyordu. Artık bildirim yalnız zildir; iş listesi üretim
// hattındaki gerçek kayıtlardan gelir ve okundu bilgisinden etkilenmez.
//
// Kapsam: iu_id = kullanıcı OLAN ya da HENÜZ ATANMAMIŞ (null) kayıtlar. Havuz/
// üstlenme kavramı yoktur — sistemde tek İÜ vardır, çoğalırsa iş atamayla
// dağıtılacaktır (İskender 25.07). Atanmamış iş fiilen İÜ'nün işidir.
//
// Zincir talep_id üzerinden kurulur (senaryo_durumu hop'u değil): hazır video
// talebinde senaryo yoktur, eski zincir o işi tamamen görünmez bırakıyordu.
//
// Metinler burada YAZILMAZ — satır yalnız durum KODU taşır, karşılığı tek
// sözlükten okunur (lib/utils/durum/mesaj.ts).

import { SupabaseClient } from "@supabase/supabase-js";
import type { IuKategori } from "@/lib/utils/anaSayfa/iuDurumEsle";
import { talepBazindaTekillestir } from "@/lib/utils/anaSayfa/iuDurumEsle";
import { TALEP_TURU_KURALLARI, type TalepTuru } from "@/lib/uretici/yetenekler";
import { kayitDurumKodu, type Asama, type DurumKodu } from "@/lib/utils/durum/mesaj";
import { ROL_ADLARI } from "@/lib/utils/roller";

export interface IsSatiri {
  talep_id: string;
  urun_adi: string;
  teknik_adi: string;
  turu_adi: string | null;
  asama: Asama;
  durum_kodu: DurumKodu;
  /** Talebi açan üreticinin unvanı — mesaj "Ürün Müdürü İnceliyor" diye yazılır. */
  uretici_rol_adi: string | null;
  tarih: string;
  yol: string;
  kategori: IuKategori;
}

export interface IuAnaSayfaVeri {
  satirlar: IsSatiri[];
  istatistikler: { bekleyen: number; revizyon: number; devam: number; tamamlanan: number };
}

const TAMAMLANAN_PENCERE_MS = 30 * 24 * 60 * 60 * 1000; // 30 gün — liste sınırsız büyümesin

const TALEP_ALANLARI = "talep_id, uretici_id, created_at, egitim_turu, urun_adi, urunler(urun_adi), teknikler(teknik_adi)";

const urunTeknik = (talep: any) => ({
  // Ürün yoksa serbest eğitim/içerik adına düş (medikal_egitim, ik_egitimi).
  urun_adi: talep?.urunler?.urun_adi ?? talep?.urun_adi ?? "-",
  teknik_adi: talep?.teknikler?.teknik_adi ?? "-",
  turu_adi: talep?.egitim_turu ? (TALEP_TURU_KURALLARI[talep.egitim_turu as TalepTuru]?.ad ?? null) : null,
});

/** Durum kodu → stat kartı kategorisi. İptal listelenmez (null). */
function kategoriBul(kod: DurumKodu): IuKategori | null {
  switch (kod) {
    case "iptal": return null;
    case "iu_iletildi":
    case "iu_hazirliyor": return "bekleyen";
    case "iu_duzeltiyor": return "revizyon";
    case "onaylandi": return "tamamlanan";
    default: return "devam";
  }
}

/** iu_id = ben VEYA atanmamış — İÜ'nün işi budur. */
const bana = (userId: string) => `iu_id.eq.${userId},iu_id.is.null`;

export async function getIuAnaSayfaVeri(userId: string, adminSupabase: SupabaseClient): Promise<IuAnaSayfaVeri> {
  const [talepSonuc, senaryoSonuc, videoSonuc, setSonuc] = await Promise.all([
    // Senaryo aşaması henüz başlamamış talepler (hazır videoda senaryo yoktur).
    adminSupabase.from("talepler").select(TALEP_ALANLARI).eq("hazir_video", false),
    adminSupabase.from("senaryolar")
      .select(`senaryo_id, talep_id, iu_id, created_at, talepler(${TALEP_ALANLARI})`).or(bana(userId)),
    adminSupabase.from("videolar")
      .select(`video_id, senaryo_durum_id, talep_id, iu_id, created_at, talepler(${TALEP_ALANLARI})`).or(bana(userId)),
    adminSupabase.from("soru_setleri")
      .select(`soru_seti_id, video_durum_id, talep_id, iu_id, created_at, talepler(${TALEP_ALANLARI})`).or(bana(userId)),
  ]);

  const senaryolar = (senaryoSonuc.data ?? []) as any[];
  const videolar = (videoSonuc.data ?? []) as any[];
  const setler = (setSonuc.data ?? []) as any[];

  // Son durumlar — tür başına tek toplu sorgu (N+1 yasağı).
  const [sd, vd, ssd] = await Promise.all([
    senaryolar.length ? adminSupabase.from("v_senaryo_son_durum").select("senaryo_id, durum, created_at").in("senaryo_id", senaryolar.map(s => s.senaryo_id)) : Promise.resolve({ data: [] }),
    videolar.length ? adminSupabase.from("v_video_son_durum").select("video_id, durum, created_at").in("video_id", videolar.map(v => v.video_id)) : Promise.resolve({ data: [] }),
    setler.length ? adminSupabase.from("v_soru_seti_son_durum").select("soru_seti_id, durum, created_at").in("soru_seti_id", setler.map(s => s.soru_seti_id)) : Promise.resolve({ data: [] }),
  ]);
  const durumMapKur = (satirlar: any[], anahtar: string) =>
    new Map((satirlar ?? []).map((d: any) => [d[anahtar], d]));
  const senaryoDurum = durumMapKur(sd.data as any[], "senaryo_id");
  const videoDurum = durumMapKur(vd.data as any[], "video_id");
  const setDurum = durumMapKur(ssd.data as any[], "soru_seti_id");

  // Talebi açan üreticinin unvanı — tek toplu sorgu.
  const tumTalepler = [
    ...((talepSonuc.data ?? []) as any[]),
    ...senaryolar.map(s => s.talepler), ...videolar.map(v => v.talepler), ...setler.map(s => s.talepler),
  ].filter(Boolean);
  const uretIdler = Array.from(new Set(tumTalepler.map((t: any) => t.uretici_id).filter(Boolean)));
  const rolAdiMap = new Map<string, string>();
  if (uretIdler.length > 0) {
    const { data: sahipler } = await adminSupabase
      .from("kullanicilar").select("kullanici_id, rol").in("kullanici_id", uretIdler);
    for (const k of (sahipler ?? []) as any[]) rolAdiMap.set(k.kullanici_id, ROL_ADLARI[k.rol] ?? k.rol);
  }

  const satirYap = (talep: any, asama: Asama, kod: DurumKodu, tarih: string, yol: string): IsSatiri[] => {
    const kategori = kategoriBul(kod);
    if (!kategori || !talep) return [];
    return [{
      talep_id: talep.talep_id,
      ...urunTeknik(talep),
      asama,
      durum_kodu: kod,
      uretici_rol_adi: rolAdiMap.get(talep.uretici_id) ?? null,
      tarih,
      yol,
      kategori,
    }];
  };

  // Senaryosu hiç başlamamış talepler — eskiden yalnız "Yeni talep" bildirimiyle görünürdü.
  const senaryoluTalepIdler = new Set(senaryolar.map(s => s.talep_id));
  const senaryosuzSatirlar = ((talepSonuc.data ?? []) as any[])
    .filter(t => !senaryoluTalepIdler.has(t.talep_id))
    .flatMap(t => satirYap(t, "Senaryo", "iu_iletildi", t.created_at, `/senaryolar/${t.talep_id}`));

  const satirlar = talepBazindaTekillestir([
    ...senaryosuzSatirlar,
    ...senaryolar.flatMap(s => {
      const d = senaryoDurum.get(s.senaryo_id);
      return satirYap(s.talepler, "Senaryo", kayitDurumKodu(d?.durum, !!s.iu_id), d?.created_at ?? s.created_at, `/senaryolar/${s.talep_id}`);
    }),
    ...videolar.flatMap(v => {
      const d = videoDurum.get(v.video_id);
      return satirYap(v.talepler, "Video", kayitDurumKodu(d?.durum, !!v.iu_id), d?.created_at ?? v.created_at,
        v.senaryo_durum_id ? `/videolar/${v.senaryo_durum_id}` : "/videolar");
    }),
    ...setler.flatMap(s => {
      const d = setDurum.get(s.soru_seti_id);
      return satirYap(s.talepler, "Soru Seti", kayitDurumKodu(d?.durum, !!s.iu_id), d?.created_at ?? s.created_at, `/soru-setleri/${s.video_durum_id}`);
    }),
  ])
    .filter(s => s.kategori !== "tamamlanan" || Date.now() - new Date(s.tarih).getTime() <= TAMAMLANAN_PENCERE_MS)
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
