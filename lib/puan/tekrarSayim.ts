// lib/puan/tekrarSayim.ts
//
// TAM TEKRAR SAYIMI — TEK KAYNAK.
//
// "Ay + tur kesişimli tam tekrar sayısı" hesabının tek adresi burasıdır.
// Kullanım yerleri:
// - app/izle/api/bitir/route.ts  → tamTekrarSayisi (tekil; extra puan kararı)
// - lib/utils/anaSayfa/utt.ts    → tamTekrarSayilari (toplu; Ekstra İzlediklerim bölümü)
//
// KOŞUL TANIMI (iki imza da aynı tanımı kullanır — bitir'deki eski inline
// sorgudan birebir taşındı, TB2 09.07.2026):
//   izleme_turu = 'extra'  +  tamamlandi_mi = true
//   izleme_baslangic >= max(ay başı, geçerli tur başı)
//
// Neden bu koşullar yeterli: bir izleme yalnızca puanlı pencerede, ileri
// sarılmadan, kendi_kendine türünde tekrar izlendiyse 'extra' işaretlenir
// (bitir route'u, puansız-pencere erken dönüşü + extra_aday koşulu).
// Yani 'extra' işaretli satırlar doğaları gereği "tam tekrar"dır; burada
// ayrıca ileri sarma / puansız pencere elemesi GEREKMEZ.
//
// Eşik yorumu (lib/puan/strateji.ts): extraPuanEsikKarsilandi(sayi) — sayı
// EŞİĞE TAM EŞİTKEN tek sefer true (mükerrer yapısal olarak imkânsız).
// Ekran tarafı türetmesi: sayi < eşik → "extra'ya (eşik − sayı) kaldı";
// sayi >= eşik → "bu ay extra kazanıldı" (ayrı kazanilan_puanlar sorgusu gerekmez).
//
// Tur kaydı olmayan yayında tur başı epoch kabul edilir → max(ay başı, epoch)
// = ay başı; eski (tur öncesi) davranışla uyumlu güvenli geri düşüş.

import { SupabaseClient } from "@supabase/supabase-js";
import { ayBaslangici } from "@/lib/zaman/kontrol";

const EPOCH = "2000-01-01T00:00:00Z";

/** max(ay başı, tur başı) — sayımın alt sınırı. Tek yerde hesaplanır. */
function sayimAltSiniri(turBaslangic: Date): Date {
  return new Date(Math.max(ayBaslangici().getTime(), turBaslangic.getTime()));
}

/**
 * TEKİL sayım — bitir route'u kullanır (extra puan kararı).
 * Not: bitir, mevcut izlemeyi ÖNCE 'extra' işaretler, SONRA bu fonksiyonu
 * çağırır — sayım "içinde bulunulan izleme dahil"dir (eski davranış birebir).
 */
export async function tamTekrarSayisi(
  supabase: SupabaseClient,
  kullanici_id: string,
  yayin_id: string,
  turBaslangic: Date
): Promise<{ ok: true; sayi: number } | { ok: false; error: string }> {
  const altSinir = sayimAltSiniri(turBaslangic);

  const { count, error } = await supabase
    .from("izleme_kayitlari")
    .select("izleme_id", { count: "exact", head: true })
    .eq("yayin_id", yayin_id)
    .eq("kullanici_id", kullanici_id)
    .eq("izleme_turu", "extra")
    .eq("tamamlandi_mi", true)
    .gte("izleme_baslangic", altSinir.toISOString());

  if (error) return { ok: false, error: error.message };
  return { ok: true, sayi: count ?? 0 };
}

/**
 * TOPLU sayım — Ekstra İzlediklerim bölümü kullanır (salt okuma, N+1 yok).
 * Tek sorgu: ay başından bu yana 'extra' işaretli tamamlanmış kayıtlar
 * (ay başı her yayın için güvenli alt küme sınırıdır — max(ay,tur) >= ay başı);
 * yayın bazlı tur-başı süzgeci bellekte uygulanır.
 *
 * turMap: gecerliTurBaslangiclari() çıktısı (salt-okur; satır AÇMAZ).
 * Dönüş: yalnızca kaydı olan yayınlar haritada — çağıran taraf `?? 0` kullanır.
 */
export async function tamTekrarSayilari(
  supabase: SupabaseClient,
  kullanici_id: string,
  yayin_idler: string[],
  turMap: Record<string, { baslangic_tarihi: string }>
): Promise<{ ok: true; sayilar: Record<string, number> } | { ok: false; error: string; sayilar: Record<string, number> }> {
  const sayilar: Record<string, number> = {};
  if (yayin_idler.length === 0) return { ok: true, sayilar };

  const ayBasi = ayBaslangici();

  const { data: kayitlar, error } = await supabase
    .from("izleme_kayitlari")
    .select("yayin_id, izleme_baslangic")
    .eq("kullanici_id", kullanici_id)
    .eq("izleme_turu", "extra")
    .eq("tamamlandi_mi", true)
    .in("yayin_id", yayin_idler)
    .gte("izleme_baslangic", ayBasi.toISOString());

  if (error) return { ok: false, error: error.message, sayilar };

  for (const k of kayitlar ?? []) {
    const turBaslangic = new Date(turMap[k.yayin_id]?.baslangic_tarihi ?? EPOCH);
    const altSinir = sayimAltSiniri(turBaslangic);
    if (new Date(k.izleme_baslangic) < altSinir) continue;
    sayilar[k.yayin_id] = (sayilar[k.yayin_id] ?? 0) + 1;
  }

  return { ok: true, sayilar };
}
