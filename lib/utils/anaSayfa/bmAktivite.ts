// lib/utils/anaSayfa/bmAktivite.ts
// BM Aktivite Takibi — kapsam-bağımsız ortak modül.
// "Takımdaki / firmadaki BM'ler ve öneri istatistikleri" sorusunu tek yerden cevaplar.
//
// Kullanım:
//   await getBmAktiviteVerisi({ tip: "takim", takim_id: "..." }, adminSupabase)
//   await getBmAktiviteVerisi({ tip: "firma", firma_id: "..." }, adminSupabase)
//
// Çıktı şekli sabit:
//   { satirlar: BmAktiviteSatiri[], istatistikler: BmAktiviteIstatistikler }
//
// Çağıran taraf (TmAnaSayfa, ileride GM/İK/BlmMd vs.) bu çıktıyı
// `bm_satirlari` / `bm_istatistikler` adıyla kendi response'unda kullanır.

import { SupabaseClient } from "@supabase/supabase-js";

export type BmKapsam =
  | { tip: "takim"; takim_id: string }
  | { tip: "firma"; firma_id: string };

export interface BmAktiviteSatiri {
  kullanici_id: string;
  bm_adi: string;
  bolge_adi: string;
  hafta_oneri: number;
  bekleyen: number;
  tamamlanan: number;
}

export interface BmAktiviteIstatistikler {
  bm_sayisi: number;
  hafta_aktif_bm: number;
  toplam_bekleyen: number;
  toplam_tamamlanan: number;
}

export interface BmAktiviteVerisi {
  satirlar: BmAktiviteSatiri[];
  istatistikler: BmAktiviteIstatistikler;
}

export async function getBmAktiviteVerisi(
  kapsam: BmKapsam,
  adminSupabase: SupabaseClient,
): Promise<BmAktiviteVerisi> {

  // 1) Kapsama göre bölgeleri çek.
  //    - takim kapsamı: bolgeler.takim_id = X
  //    - firma kapsamı: bolgeler -> takimlar.firma_id = X (join)
  let bolgeler: { bolge_id: string; bolge_adi: string; takim_id: string }[] = [];

  if (kapsam.tip === "takim") {
    const { data, error } = await adminSupabase
      .from("bolgeler")
      .select("bolge_id, bolge_adi, takim_id")
      .eq("takim_id", kapsam.takim_id);
    if (error) throw new Error("Bölgeler çekilemedi (takım kapsamı).");
    bolgeler = data ?? [];
  } else {
    // firma kapsamı: önce firmaya ait takımları bul, sonra bu takımlara ait bölgeleri al.
    const { data: takimlar, error: takimError } = await adminSupabase
      .from("takimlar")
      .select("takim_id")
      .eq("firma_id", kapsam.firma_id);
    if (takimError) throw new Error("Takımlar çekilemedi (firma kapsamı).");

    const takimIdler = (takimlar ?? []).map((t: any) => t.takim_id);
    if (takimIdler.length === 0) {
      return {
        satirlar: [],
        istatistikler: { bm_sayisi: 0, hafta_aktif_bm: 0, toplam_bekleyen: 0, toplam_tamamlanan: 0 },
      };
    }

    const { data, error } = await adminSupabase
      .from("bolgeler")
      .select("bolge_id, bolge_adi, takim_id")
      .in("takim_id", takimIdler);
    if (error) throw new Error("Bölgeler çekilemedi (firma kapsamı).");
    bolgeler = data ?? [];
  }

  const bolgeMap: Record<string, string> = {};
  for (const b of bolgeler) {
    bolgeMap[b.bolge_id] = b.bolge_adi;
  }

  // 2) BM'leri çek — kapsama göre.
  //    BM bolge_id üzerinden takıma bağlı. Takım kapsamı: takim_id ile, firma kapsamı: takim_id IN (...) ile.
  let bmQuery = adminSupabase
    .from("kullanicilar")
    .select("kullanici_id, ad, soyad, bolge_id")
    .eq("rol", "bm")
    .eq("aktif_mi", true);

  if (kapsam.tip === "takim") {
    bmQuery = bmQuery.eq("takim_id", kapsam.takim_id);
  } else {
    // firma kapsamı için takim_id'leri tekrar topluyoruz (bolgeler'den geliyor).
    const takimIdSet = [...new Set(bolgeler.map(b => b.takim_id))];
    if (takimIdSet.length === 0) {
      return {
        satirlar: [],
        istatistikler: { bm_sayisi: 0, hafta_aktif_bm: 0, toplam_bekleyen: 0, toplam_tamamlanan: 0 },
      };
    }
    bmQuery = bmQuery.in("takim_id", takimIdSet);
  }

  const { data: bmler, error: bmError } = await bmQuery;
  if (bmError) throw new Error("BM'ler çekilemedi.");

  const bmIdler = (bmler ?? []).map((b: any) => b.kullanici_id);

  // 3) Bu BM'lerin gönderdiği önerileri çek.
  const { data: tumOneriler } = bmIdler.length > 0
    ? await adminSupabase
        .from("oneri_kayitlari")
        .select("oneri_id, oneren_id, izlendi_mi, created_at")
        .in("oneren_id", bmIdler)
    : { data: [] as any[] };

  // 4) Bu haftanın başlangıcı (Pazartesi 00:00).
  const haftaBaslangic = new Date();
  haftaBaslangic.setDate(haftaBaslangic.getDate() - haftaBaslangic.getDay() + 1);
  haftaBaslangic.setHours(0, 0, 0, 0);

  // 5) BM bazında satırları kur.
  const satirlar: BmAktiviteSatiri[] = (bmler ?? []).map((bm: any) => {
    const bmOneriler = (tumOneriler ?? []).filter((o: any) => o.oneren_id === bm.kullanici_id);
    const haftaOneriler = bmOneriler.filter((o: any) => new Date(o.created_at) >= haftaBaslangic);
    return {
      kullanici_id: bm.kullanici_id,
      bm_adi: `${bm.ad} ${bm.soyad}`,
      bolge_adi: bolgeMap[bm.bolge_id] ?? "-",
      hafta_oneri: haftaOneriler.length,
      bekleyen: bmOneriler.filter((o: any) => !o.izlendi_mi).length,
      tamamlanan: bmOneriler.filter((o: any) => o.izlendi_mi).length,
    };
  });

  // 6) İstatistikleri kur.
  const istatistikler: BmAktiviteIstatistikler = {
    bm_sayisi: (bmler ?? []).length,
    hafta_aktif_bm: satirlar.filter(s => s.hafta_oneri > 0).length,
    toplam_bekleyen: satirlar.reduce((acc, s) => acc + s.bekleyen, 0),
    toplam_tamamlanan: satirlar.reduce((acc, s) => acc + s.tamamlanan, 0),
  };

  return { satirlar, istatistikler };
}