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
import type { UygunAlici } from "@/lib/cclub/tipler";
import { AYLIK_MAX_GONDERIM } from "@/lib/cclub/sabitler";
import { ayBaslangici } from "@/lib/zaman/kontrol";

export async function uygunAliciListesi(
  supabase: SupabaseClient,
  gonderenId: string,
  gonderenFirmaId: string,
  yayinId: string,
  turBaslangici?: string
): Promise<UygunAlici[]> {
  const ayBas = ayBaslangici().toISOString();
  const turBas = turBaslangici ?? "1970-01-01T00:00:00.000Z";

  // Paralel: 5 sorgu birbirinden bağımsız
  const [bmlerRes, gonderdiklerimRes, tamamlayanlarRes, ayniVideoRes, bekleyenChallengeRes] = await Promise.all([
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

    // 3) Seçilen videoyu geçerli turda tamamlamış tüm BM'ler (CC ekosistemi)
    supabase
      .from("cc_izleme_kayitlari")
      .select("bm_id")
      .eq("yayin_id", yayinId)
      .eq("tamamlandi_mi", true)
      .gte("izleme_baslangic", turBas),

    // 4) Aynı videonun geçerli turda bu gönderen tarafından gönderildiği alıcılar
    supabase
      .from("challenge_kayitlari")
      .select("alan_id")
      .eq("gonderen_id", gonderenId)
      .eq("yayin_id", yayinId)
      .gte("created_at", turBas),

    // 5) Alıcının bu video için geçerli turda bekleyen challenge'ı var mı
    supabase
      .from("challenge_kayitlari")
      .select("alan_id")
      .eq("yayin_id", yayinId)
      .eq("izlendi_mi", false)
      .gte("created_at", turBas),
  ]);

  // Kontrollerden biri okunamadıysa güvenli biçimde hiçbir alıcıyı açma.
  if (bmlerRes.error || gonderdiklerimRes.error
      || tamamlayanlarRes.error || ayniVideoRes.error || bekleyenChallengeRes.error || !bmlerRes.data) return [];

  // Set'ler — O(1) lookup
  const gonderilmisAliciSet = new Set<string>(
    (gonderdiklerimRes.data ?? []).map((c: { alan_id: string }) => c.alan_id)
  );
  const videoyuIzlemisSet = new Set<string>(
    (tamamlayanlarRes.data ?? []).map((iz: { bm_id: string }) => iz.bm_id)
  );
  const ayniVideoGonderilmisSet = new Set<string>(
    (ayniVideoRes.data ?? []).map((c: { alan_id: string }) => c.alan_id)
  );
  const bekleyenChallengeSet = new Set<string>(
    (bekleyenChallengeRes.data ?? []).map((c: { alan_id: string }) => c.alan_id)
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

    // Öncelik 2: Bu BM'ye bu ay zaten gönderdin mi?
    if (gonderilmisAliciSet.has(bm.kullanici_id)) {
      return {
        ...temelBilgi,
        gonderilebilir: false,
        sebep: "Bu BM'ye bu ay zaten bir challenge gönderdiniz.",
      };
    }

    // Öncelik 3: Bu BM seçilen videoyu bu turda zaten izledi mi?
    if (videoyuIzlemisSet.has(bm.kullanici_id)) {
      return {
        ...temelBilgi,
        gonderilebilir: false,
        sebep: "Bu BM seçilen videoyu bu turda zaten tamamlamış.",
      };
    }

    // Öncelik 4: Aynı video bu turda bu BM'ye zaten gönderildi mi?
    if (ayniVideoGonderilmisSet.has(bm.kullanici_id)) {
      return {
        ...temelBilgi,
        gonderilebilir: false,
        sebep: "Aynı video bu turda bu BM'ye zaten gönderilmiş.",
      };
    }

    // Öncelik 5: Bu BM'nin bu video için bekleyen başka bir challenge'ı var mı?
    if (bekleyenChallengeSet.has(bm.kullanici_id)) {
      return {
        ...temelBilgi,
        gonderilebilir: false,
        sebep: "Bu BM'nin bu video için bekleyen bir challenge'ı var.",
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
