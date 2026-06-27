// lib/cc/uygunAliciListesi.ts
// Seçilen video için gönderilebilir BM listesi.
//
// Tüm aktif BM'leri (aynı firmadan, gönderenin kendisi hariç) döndürür.
// Her BM için gonderilebilir bayrağı ve gerekirse sebep alanı doldurulur.
// UI uygun olmayanları gri/disabled gösterebilir.
//
// Performans: 3 toplu sorgu ile tüm kontroller yapılır (BM başına ayrı sorgu yok).
//   - Sorgu 1: gönderenin bu ay yaptığı tüm gönderimler → aylık kota + alıcı yönlü kontrolü
//   - Sorgu 2: göndericiye bu ay gelen gönderimler → karşılıklılık kilidi
//   - Sorgu 3: seçilen videoyu tamamlamış tüm kullanıcılar → tekrar izleme engeli
//
// İlgili dokümantasyon: Karar Belgesi 5 (lib katmanı), iş kuralı 1-4. maddeler.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { UygunAlici } from "@/lib/cc/tipler";
import { AYLIK_MAX_GONDERIM } from "@/lib/cc/sabitler";
import { ayBaslangici } from "@/lib/zaman/kontrol";

export async function uygunAliciListesi(
  supabase: SupabaseClient,
  gonderenId: string,
  gonderenFirmaId: string,
  yayinId: string
): Promise<UygunAlici[]> {
  const ayBas = ayBaslangici().toISOString();

  // Paralel: 4 sorgu birbirinden bağımsız
  const [bmlerRes, gonderdiklerimRes, aldiklarimRes, tamamlayanlarRes] = await Promise.all([
    // 1) Aktif diğer BM'ler (aynı firma, kendisi hariç)
    supabase
      .from("kullanicilar")
      .select("kullanici_id, ad, soyad")
      .eq("rol", "bm")
      .eq("aktif_mi", true)
      .eq("firma_id", gonderenFirmaId)
      .neq("kullanici_id", gonderenId)
      .order("ad", { ascending: true }),

    // 2) Gönderenin bu ay yaptığı tüm gönderimler (alıcı id'leri)
    supabase
      .from("challenge_kayitlari")
      .select("alan_id")
      .eq("gonderen_id", gonderenId)
      .gte("created_at", ayBas),

    // 3) Göndericiye bu ay gelen tüm gönderimler (kimden geldi)
    supabase
      .from("challenge_kayitlari")
      .select("gonderen_id")
      .eq("alan_id", gonderenId)
      .gte("created_at", ayBas),

    // 4) Seçilen videoyu tamamlamış tüm BM'ler (CC ekosistemi)
    supabase
      .from("cc_izleme_kayitlari")
      .select("bm_id")
      .eq("yayin_id", yayinId)
      .eq("tamamlandi_mi", true),
  ]);

  // BM listesi alınamadıysa boş array döner
  if (bmlerRes.error || !bmlerRes.data) return [];

  // Set'ler — O(1) lookup
  const gonderilmisAliciSet = new Set<string>(
    (gonderdiklerimRes.data ?? []).map((c: { alan_id: string }) => c.alan_id)
  );
  const benimleKarsiliklilikSet = new Set<string>(
    (aldiklarimRes.data ?? []).map((c: { gonderen_id: string }) => c.gonderen_id)
  );
  const videoyuIzlemisSet = new Set<string>(
    (tamamlayanlarRes.data ?? []).map((iz: { bm_id: string }) => iz.bm_id)
  );

  // Aylık kota — gönderenin bu ay toplam kaç gönderim yaptığı
  const buAyToplamGonderim = gonderdiklerimRes.data?.length ?? 0;
  const aylikKotaDoldu = buAyToplamGonderim >= AYLIK_MAX_GONDERIM;

  // Her BM için durum hesabı (öncelik sırasıyla)
  const sonuc: UygunAlici[] = bmlerRes.data.map((bm) => {
    const temelBilgi = {
      kullanici_id: bm.kullanici_id,
      ad: bm.ad,
      soyad: bm.soyad,
    };

    // Öncelik 1: Aylık kota dolu mu?
    if (aylikKotaDoldu) {
      return {
        ...temelBilgi,
        gonderilebilir: false,
        sebep: `Bu ay aylık kotanız doldu (${buAyToplamGonderim}/${AYLIK_MAX_GONDERIM}).`,
      };
    }

    // Öncelik 2: Bu BM bu ay sana challenge gönderdi mi? (karşılıklılık kilidi)
    if (benimleKarsiliklilikSet.has(bm.kullanici_id)) {
      return {
        ...temelBilgi,
        gonderilebilir: false,
        sebep: "Bu BM bu ay size challenge gönderdi. Karşılıklılık kuralı gereği geri gönderim yapamazsınız.",
      };
    }

    // Öncelik 3: Bu BM'ye bu ay zaten gönderdin mi?
    if (gonderilmisAliciSet.has(bm.kullanici_id)) {
      return {
        ...temelBilgi,
        gonderilebilir: false,
        sebep: "Bu BM'ye bu ay zaten bir challenge gönderdiniz.",
      };
    }

    // Öncelik 4: Bu BM seçilen videoyu zaten izledi mi?
    if (videoyuIzlemisSet.has(bm.kullanici_id)) {
      return {
        ...temelBilgi,
        gonderilebilir: false,
        sebep: "Bu BM seçilen videoyu zaten izlemiş.",
      };
    }

    // Tüm engellerden geçti
    return {
      ...temelBilgi,
      gonderilebilir: true,
    };
  });

  return sonuc;
}