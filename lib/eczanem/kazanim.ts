// lib/eczanem/kazanim.ts
// Eczanem kazanım ledger'ının tek kaynağı (İP-§6/§7).
// ile simetrik ama üç kritik farkla:
//  1. KAYIPSIZ MODEL (İP-§6.1): ileri sarma / yanlış cevap KAYBI yok; yalnız
//     kazanım (izleme + cevap) yazılır. Yanlış cevap hiç kayıt üretmez.
//  2. DÖRTLÜ KİLİT (İP-§9.2): musteri_id + eczane_id + firma_id + urun_id kayıt
//     anında denormalize yazılır — puan tek kişiye değil, o kişinin O ECZANEDEKİ
//     O ürün bakiyesine yazılır (aynı müşteri farklı eczanelerde ayrı bakiye).
//  3. FIFO/180 gün temeli: kalan_puan = puan (taze), harcamayla azalır; bakiye
//     Σ kalan_puan WHERE created_at ≥ now−180g (U8 harcama RPC'si tüketir).
//
// puan_turu değerleri: 'izleme' | 'cevap' (izleme/cevap kazanımı).

import type { SupabaseClient } from "@supabase/supabase-js";

export type EczanemPuanTuru = "izleme" | "cevap";

export interface EczanemKazanimParams {
  musteri_id: string;
  eczane_id: string;
  yayin_id: string;
  izleme_id: string;
  puan_turu: EczanemPuanTuru;
  puan: number;
}

export interface KazanimSonuc {
  ok: boolean;
  error?: string;
}

// Eczane ekseninde teklik: aynı müşteri/yayın başka bir eczanede bağımsızdır.
// Ledger yayın tutmadığı için gönderim → izleme köprüsü kullanılır.
export async function kazanimVarMi(
  adminSupabase: SupabaseClient,
  musteriId: string,
  yayinId: string,
  eczaneId: string,
  puanTuru: EczanemPuanTuru
): Promise<boolean> {
  const { data: gonderimler } = await adminSupabase
    .from("eczanem_gonderimler")
    .select("gonderim_id")
    .eq("musteri_id", musteriId)
    .eq("yayin_id", yayinId)
    .eq("eczane_id", eczaneId);
  const gonderimIdler = (gonderimler ?? []).map((g) => g.gonderim_id);
  if (gonderimIdler.length === 0) return false;

  const { data: izlemeler } = await adminSupabase
    .from("eczanem_izleme_kayitlari")
    .select("izleme_id")
    .eq("musteri_id", musteriId)
    .eq("yayin_id", yayinId)
    .in("gonderim_id", gonderimIdler);

  const izlemeIdler = (izlemeler ?? []).map((i) => i.izleme_id);
  if (izlemeIdler.length === 0) return false;

  const { data } = await adminSupabase
    .from("eczanem_puan_kayitlari")
    .select("kayit_id")
    .eq("puan_turu", puanTuru)
    .in("izleme_id", izlemeIdler)
    .limit(1);

  return (data ?? []).length > 0;
}

// Yayından urun_id (üretimle ortak RPC).
async function yayindanUrunId(adminSupabase: SupabaseClient, yayin_id: string): Promise<string | null> {
  const { data, error } = await adminSupabase.rpc("get_urun_from_yayin", { p_yayin_id: yayin_id });
  if (error) {
    console.error("[lib/eczanem/kazanim] get_urun_from_yayin hatası:", { yayin_id, hata: error.message });
    return null;
  }
  return (data as string) ?? null;
}

// Ürünün firmasını çeker (dörtlü kilidin firma ekseni — İP-§9.2 PM ürün ekseni).
async function urundenFirmaId(adminSupabase: SupabaseClient, urun_id: string): Promise<string | null> {
  const { data, error } = await adminSupabase
    .from("urunler")
    .select("firma_id")
    .eq("urun_id", urun_id)
    .maybeSingle();
  if (error || !data) {
    console.error("[lib/eczanem/kazanim] urunler.firma_id çekilemedi:", { urun_id, hata: error?.message });
    return null;
  }
  return data.firma_id ?? null;
}

// Kazanım kaydı (izleme/cevap). Dörtlü kilit kayıt anında yazılır; kalan_puan=puan.
export async function kazanimKaydet(
  adminSupabase: SupabaseClient,
  params: EczanemKazanimParams
): Promise<KazanimSonuc> {
  if (params.puan <= 0) return { ok: true }; // puansız yayında yazacak bir şey yok

  const urun_id = await yayindanUrunId(adminSupabase, params.yayin_id);
  if (!urun_id) return { ok: false, error: "Yayından urun_id çekilemedi." };

  const firma_id = await urundenFirmaId(adminSupabase, urun_id);
  if (!firma_id) return { ok: false, error: "Üründen firma_id çekilemedi." };

  const { error } = await adminSupabase.from("eczanem_puan_kayitlari").insert({
    musteri_id: params.musteri_id,
    eczane_id: params.eczane_id,
    firma_id,
    urun_id,
    izleme_id: params.izleme_id,
    puan_turu: params.puan_turu,
    puan: params.puan,
    kalan_puan: params.puan,
  });

  if (error) {
    console.error("[lib/eczanem/kazanim] kazanimKaydet hatası:", {
      yayin_id: params.yayin_id, puan_turu: params.puan_turu, hata: error.message,
    });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
