// lib/eczanem/kasa.ts
// Eczanem kasa akışının TS orkestrasyonu (İP-§8): bakiye, barkod→hesap,
// sipariş oluşturma (puan DÜŞMEZ — bekliyor). Atomik FIFO düşüm ve onay
// DB'de `eczanem_siparis_onayla` RPC'sindedir (SQL ayrı verilir) — para
// düşümü tek yerde, transaction içinde (İP-§8.1 "çift taraflı el sıkışma").
//
// Kurallar burada tek kaynak:
//  - Bakiye(müşteri, eczane, ürün) = Σ kalan_puan WHERE created_at ≥ now−180g
//    (İP-§7.4 kayan pencere; ayar: eczanem_puan_omru_gun).
//  - İndirim = bakiye_puan × (tarife.tl / tarife.puan). ADET İNDİRİMİ ÇARPMAZ
//    (İP-§8.2): adet yalnız kutu sayısıdır (mutabakat), indirim hakkı kadardır.
//  - Tarife onay anına kadar müşteri aleyhine değişmez (K-E3): sipariş anında
//    tarife_snapshot alınır; onay bu snapshot'ı kullanır.

import { SupabaseClient } from "@supabase/supabase-js";
import { guncelTarife } from "@/lib/eczanem/tarife";

export const PUAN_OMRU_GUN_VARSAYILAN = 180;

// Müşterinin aktif üye olduğu eczaneler (İndirim kullan eczane seçimi + fiş
// eczane adı). Ad gln → eclub_eczane_master zinciriyle (ayrı sorgu + Map).
export async function musteriEczaneleri(
  adminSupabase: SupabaseClient,
  musteriId: string
): Promise<Array<{ eczane_id: string; eczane_adi: string }>> {
  const { data: uyelikler } = await adminSupabase
    .from("eczanem_uyelikler")
    .select("eczane_id")
    .eq("musteri_id", musteriId)
    .eq("aktif_mi", true);

  const eczaneIdler = [...new Set((uyelikler ?? []).map((u: any) => u.eczane_id))];
  if (eczaneIdler.length === 0) return [];

  const { data: eczaneler } = await adminSupabase
    .from("eclub_eczaneler")
    .select("eczane_id, gln")
    .in("eczane_id", eczaneIdler);
  const eczaneGln = new Map<string, string>();
  for (const e of eczaneler ?? []) eczaneGln.set((e as any).eczane_id, (e as any).gln);

  const glnler = [...new Set((eczaneler ?? []).map((e: any) => e.gln).filter(Boolean))];
  const { data: masterlar } = glnler.length
    ? await adminSupabase.from("eclub_eczane_master").select("gln, eczane_adi").in("gln", glnler)
    : { data: [] as any[] };
  const glnAd = new Map<string, string>();
  for (const m of masterlar ?? []) glnAd.set((m as any).gln, (m as any).eczane_adi);

  return eczaneIdler
    .map((ez) => ({ eczane_id: ez, eczane_adi: glnAd.get(eczaneGln.get(ez) ?? "") ?? "(isimsiz eczane)" }))
    .sort((a, b) => a.eczane_adi.localeCompare(b.eczane_adi, "tr"));
}

/** sistem_ayarlari.eczanem_puan_omru_gun — kazanımın bakiyede kalma süresi. */
export async function puanOmruGun(adminSupabase: SupabaseClient): Promise<number> {
  const { data, error } = await adminSupabase
    .from("sistem_ayarlari")
    .select("deger")
    .eq("anahtar", "eczanem_puan_omru_gun")
    .single();
  const deger = Number(data?.deger);
  if (error || !Number.isFinite(deger) || deger <= 0) {
    console.error("[UYARI] eczanem_puan_omru_gun okunamadı, varsayılan:", error?.message ?? data?.deger);
    return PUAN_OMRU_GUN_VARSAYILAN;
  }
  return deger;
}

// Kayan pencere alt sınırı (created_at ≥ bu tarih → bakiyeye girer).
async function pencereAltSinir(adminSupabase: SupabaseClient): Promise<string> {
  const omur = await puanOmruGun(adminSupabase);
  return new Date(Date.now() - omur * 24 * 60 * 60 * 1000).toISOString();
}

// Bakiye(müşteri, eczane, ürün): Σ kalan_puan pencere içinde.
export async function urunBakiyesi(
  adminSupabase: SupabaseClient,
  musteriId: string,
  eczaneId: string,
  urunId: string
): Promise<number> {
  const altSinir = await pencereAltSinir(adminSupabase);
  const { data } = await adminSupabase
    .from("eczanem_puan_kayitlari")
    .select("kalan_puan")
    .eq("musteri_id", musteriId)
    .eq("eczane_id", eczaneId)
    .eq("urun_id", urunId)
    .gte("created_at", altSinir);
  return (data ?? []).reduce((acc: number, r: any) => acc + (r.kalan_puan ?? 0), 0);
}

// puan → TL (tarife oranı). İki ondalıkta yuvarlanır (para).
export function indirimHesapla(bakiyePuan: number, tarifePuan: number, tarifeTl: number): number {
  if (tarifePuan <= 0) return 0;
  return Math.round((bakiyePuan * tarifeTl / tarifePuan) * 100) / 100;
}

export interface HesapSonuc {
  ok: boolean;
  hata?: string;
  urun_id?: string;
  urun_adi?: string;
  bakiye_puan?: number;
  tarife_puan?: number;
  tarife_tl?: number;
  indirim_tl?: number;
}

// Barkod → ürün → bakiye → tarife → indirim (İP-§8.1/2). Müşteri o eczanenin
// aktif üyesi olmalı; ürünün tarifesi (Karşılık) tanımlı olmalı.
export async function barkodHesap(
  adminSupabase: SupabaseClient,
  musteriId: string,
  eczaneId: string,
  barkod: string
): Promise<HesapSonuc> {
  const temizBarkod = (barkod ?? "").trim();
  if (!temizBarkod) return { ok: false, hata: "Barkod girin." };

  // Müşteri bu eczanenin aktif üyesi mi?
  const { data: uyelik } = await adminSupabase
    .from("eczanem_uyelikler")
    .select("uyelik_id")
    .eq("musteri_id", musteriId)
    .eq("eczane_id", eczaneId)
    .eq("aktif_mi", true)
    .maybeSingle();
  if (!uyelik) return { ok: false, hata: "Bu eczanenin üyesi değilsiniz." };

  // Barkod → ürün
  const { data: urun } = await adminSupabase
    .from("urunler")
    .select("urun_id, urun_adi")
    .eq("barkod", temizBarkod)
    .maybeSingle();
  if (!urun) return { ok: false, hata: "Bu barkoda ait Eczanem ürünü bulunamadı." };

  const tarife = await guncelTarife(adminSupabase, urun.urun_id);
  if (!tarife) return { ok: false, hata: "Bu ürünün Karşılık tanımı yok." };

  const bakiyePuan = await urunBakiyesi(adminSupabase, musteriId, eczaneId, urun.urun_id);
  const indirimTl = indirimHesapla(bakiyePuan, tarife.puan, tarife.tl);

  return {
    ok: true,
    urun_id: urun.urun_id,
    urun_adi: urun.urun_adi,
    bakiye_puan: bakiyePuan,
    tarife_puan: tarife.puan,
    tarife_tl: tarife.tl,
    indirim_tl: indirimTl,
  };
}

export interface SiparisSonuc {
  ok: boolean;
  hata?: string;
  siparis_id?: string;
}

// Sipariş oluştur — puan DÜŞMEZ (durum='bekliyor'). Hesap yeniden yapılır
// (istemciye güvenilmez); tarife_snapshot alınır (onay bunu kullanır, K-E3).
export async function siparisOlustur(
  adminSupabase: SupabaseClient,
  musteriId: string,
  eczaneId: string,
  barkod: string,
  adet: number
): Promise<SiparisSonuc> {
  const temizAdet = Math.floor(Number(adet));
  if (!Number.isFinite(temizAdet) || temizAdet < 1) return { ok: false, hata: "Geçerli bir adet girin." };

  const hesap = await barkodHesap(adminSupabase, musteriId, eczaneId, barkod);
  if (!hesap.ok) return { ok: false, hata: hesap.hata };
  if ((hesap.bakiye_puan ?? 0) <= 0) return { ok: false, hata: "Bu üründe kullanılabilir puanınız yok." };

  // Aynı ürün+eczane için zaten bekleyen sipariş varsa yenisini açma (mükerrer önlenir).
  const { data: bekleyen } = await adminSupabase
    .from("eczanem_siparisler")
    .select("siparis_id")
    .eq("musteri_id", musteriId)
    .eq("eczane_id", eczaneId)
    .eq("urun_id", hesap.urun_id!)
    .eq("durum", "bekliyor")
    .maybeSingle();
  if (bekleyen) return { ok: false, hata: "Bu ürün için onay bekleyen bir siparişiniz zaten var." };

  const { data: yeni, error } = await adminSupabase
    .from("eczanem_siparisler")
    .insert({
      musteri_id: musteriId,
      eczane_id: eczaneId,
      urun_id: hesap.urun_id!,
      adet: temizAdet,
      kullanilan_puan: hesap.bakiye_puan!,
      indirim_tl: hesap.indirim_tl!,
      tarife_snapshot: { puan: hesap.tarife_puan, tl: hesap.tarife_tl },
      durum: "bekliyor",
    })
    .select("siparis_id")
    .single();

  if (error || !yeni) return { ok: false, hata: "Sipariş oluşturulamadı." };
  return { ok: true, siparis_id: yeni.siparis_id };
}

// Sipariş reddi/vazgeçmesi (İP-§8.3): onaysız sipariş düşer, puan hiç düşmez.
// Yalnız 'bekliyor' → 'dustu'. Eczacı reddinde ve müşteri vazgeçmesinde ortak.
// Sahiplik/rol kontrolü çağıran route'ta yapılır.
export async function siparisReddet(
  adminSupabase: SupabaseClient,
  siparisId: string
): Promise<{ ok: boolean; hata?: string }> {
  const { data, error } = await adminSupabase
    .from("eczanem_siparisler")
    .update({ durum: "dustu" })
    .eq("siparis_id", siparisId)
    .eq("durum", "bekliyor")
    .select("siparis_id")
    .maybeSingle();
  if (error) return { ok: false, hata: "Sipariş düşürülemedi." };
  if (!data) return { ok: false, hata: "Sipariş zaten işlenmiş." };
  return { ok: true };
}

export interface OnaySonuc {
  ok: boolean;
  hata?: string;
  islem_kodu?: string;
  indirim_tl?: number;
  kullanilan_puan?: number;
}

// Sipariş onayı — atomik FIFO düşüm DB RPC'sinde (eczanem_siparis_onayla).
// RPC TABLE döner (store deseni): ilk satır ok/hata/islem_kodu/indirim_tl.
export async function siparisOnayla(
  adminSupabase: SupabaseClient,
  siparisId: string
): Promise<OnaySonuc> {
  const { data, error } = await adminSupabase.rpc("eczanem_siparis_onayla", { p_siparis_id: siparisId });
  if (error) {
    console.error("[lib/eczanem/kasa] eczanem_siparis_onayla RPC hatası:", error.message);
    return { ok: false, hata: error.message };
  }
  const ilk = Array.isArray(data) && data.length > 0 ? data[0] : null;
  if (!ilk) return { ok: false, hata: "Onay sonucu alınamadı." };
  return {
    ok: Boolean(ilk.ok),
    hata: ilk.hata ?? undefined,
    islem_kodu: ilk.islem_kodu ?? undefined,
    indirim_tl: ilk.indirim_tl != null ? Number(ilk.indirim_tl) : undefined,
    kullanilan_puan: ilk.kullanilan_puan ?? undefined,
  };
}
