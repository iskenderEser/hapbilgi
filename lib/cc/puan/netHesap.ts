// lib/cc/puan/netHesap.ts
// CC ekosistemindeki net puan hesabını tek noktada yapan fonksiyonlar.
//
// Sorumluluk:
//   - Bir BM'in net puanını hesaplamak
//   - Net puan = kazanım toplamı − üç kayıp tablosunun toplamı
//   - Zaman aralığı parametresi alır (örn. bu ay, bu çeyrek, bu yıl, tüm zamanlar)
//   - BM bazında veya toplu (CC Ligi için sıralı liste) sorgu yapar
//
// Net puan formülü:
//   net = SUM(cc_kazanilan_puanlar.puan)
//       − SUM(cc_ileri_sarma_kayitlari.kaybedilen_puan)
//       − SUM(cc_yanlis_cevap_kayitlari.kaybedilen_puan)
//       − SUM(challenge_kayip_kayitlari.kaybedilen_puan)
//
// Çağıran yerler (öngörü):
//   - CC Ligi sayfası (Faz H) — bmlerNetPuanListesi
//   - BM ana sayfasında kişisel puan göstergesi (varsa) — bmNetPuani

import type { SupabaseClient } from "@supabase/supabase-js";

interface PuanAraligi {
  baslangic: string; // ISO timestamp
  bitis: string;     // ISO timestamp
}

// ─── 1. TEK BM NET PUAN ──────────────────────────────────────────────────────

/**
 * Belirtilen zaman aralığında bir BM'in net puanını hesaplar.
 * Hata durumunda 0 döner (raporlama bozulmamalı).
 */
export async function bmNetPuani(
  supabase: SupabaseClient,
  bm_id: string,
  araligi: PuanAraligi
): Promise<number> {
  // 4 paralel sorgu — kazanım toplamı + 3 kayıp toplamı
  const [kazanimRes, ileriSarmaRes, yanlisCevapRes, challengeKayipRes] = await Promise.all([
    supabase
      .from("cc_kazanilan_puanlar")
      .select("puan")
      .eq("bm_id", bm_id)
      .gte("created_at", araligi.baslangic)
      .lte("created_at", araligi.bitis),
    supabase
      .from("cc_ileri_sarma_kayitlari")
      .select("kaybedilen_puan")
      .eq("bm_id", bm_id)
      .gte("created_at", araligi.baslangic)
      .lte("created_at", araligi.bitis),
    supabase
      .from("cc_yanlis_cevap_kayitlari")
      .select("kaybedilen_puan")
      .eq("bm_id", bm_id)
      .gte("created_at", araligi.baslangic)
      .lte("created_at", araligi.bitis),
    supabase
      .from("challenge_kayip_kayitlari")
      .select("kaybedilen_puan")
      .eq("kullanici_id", bm_id)
      .gte("created_at", araligi.baslangic)
      .lte("created_at", araligi.bitis),
  ]);

  const kazanimToplam = (kazanimRes.data ?? []).reduce(
    (acc: number, r: { puan: number }) => acc + r.puan,
    0
  );
  const ileriSarmaToplam = (ileriSarmaRes.data ?? []).reduce(
    (acc: number, r: { kaybedilen_puan: number }) => acc + r.kaybedilen_puan,
    0
  );
  const yanlisCevapToplam = (yanlisCevapRes.data ?? []).reduce(
    (acc: number, r: { kaybedilen_puan: number }) => acc + r.kaybedilen_puan,
    0
  );
  const challengeKayipToplam = (challengeKayipRes.data ?? []).reduce(
    (acc: number, r: { kaybedilen_puan: number }) => acc + r.kaybedilen_puan,
    0
  );

  return kazanimToplam - ileriSarmaToplam - yanlisCevapToplam - challengeKayipToplam;
}

// ─── 2. BM LİSTESİ NET PUAN ──────────────────────────────────────────────────

/**
 * Belirtilen BM listesi için net puanları döner, en yüksek puandan başlayarak sıralı.
 * CC Ligi sayfası için kullanılır.
 *
 * Performans notu: Şu an her BM için ayrı sorgu (bmNetPuani çağrısı). Büyük listede
 * yavaş olabilir. Daha sonra tek SQL ile gruplama yapan RPC fonksiyonuyla optimize edilebilir.
 */
export async function bmlerNetPuanListesi(
  supabase: SupabaseClient,
  bm_idler: string[],
  araligi: PuanAraligi
): Promise<{ bm_id: string; net_puan: number }[]> {
  if (bm_idler.length === 0) return [];

  const puanlar = await Promise.all(
    bm_idler.map(async (bm_id) => {
      const net_puan = await bmNetPuani(supabase, bm_id, araligi);
      return { bm_id, net_puan };
    })
  );

  // En yüksek puandan başlayarak sırala
  puanlar.sort((a, b) => b.net_puan - a.net_puan);

  return puanlar;
}