// lib/eczanem/gonderim.ts
// U6 — Faz 2c dağıtım zincirinin tek kaynağı (İP-§5): UTT→eczane ve
// eczane→müşteri gönderimleri. Route'lar yalnızca auth/rol + orkestrasyon;
// tüm iş kuralı burada.
//
// İlkeler:
//  - Teklikler YAPISAL: UNIQUE(yayin_id, eczane_id) ve UNIQUE(yayin_id,
//    musteri_id, eczane_id). Çakışma (23505) "zaten gönderilmiş" demektir.
//  - Eşik ön koşulu (İP-§5.2): UTT ekranında gösterilir, gönderimde server
//    tarafında YENİDEN doğrulanır (istemciye güvenilmez).
//  - İzlenme takibi YOK (İP-§6.2): gönderim kaydı bildirim/metrik üretmez.
//  - Aktif üye = eczanem_uyelikler.aktif_mi (daveti kabul etmiş müşteri);
//    davet aşamasındaki kayıtlar sayılmaz — eşik şişirme yapısal imkânsız.

import { SupabaseClient } from "@supabase/supabase-js";
import { pushYayinlaEczanemMusterilereArkada } from "@/lib/push/orkestrasyon";
import { eczaneEczanemFirmaIdleri, eczaneYayinErisimiDogrula } from "@/lib/eczanem/erisim";

// Ayar okunamazsa güvenli geri düşüş (davet.ts DAVET_GECERLILIK deseni).
// Canlı seed değeri 10; bu sabit yalnız okuma hatasında devreye girer.
export const AKTIF_UYE_ESIGI_VARSAYILAN = 10;

/** sistem_ayarlari.eczanem_aktif_uye_esigi — eczaneye gönderim için asgari aktif üye. */
export async function aktifUyeEsigi(adminSupabase: SupabaseClient): Promise<number> {
  const { data, error } = await adminSupabase
    .from("sistem_ayarlari")
    .select("deger")
    .eq("anahtar", "eczanem_aktif_uye_esigi")
    .single();

  const deger = Number(data?.deger);
  if (error || !Number.isFinite(deger) || deger < 0) {
    console.error("[UYARI] eczanem_aktif_uye_esigi okunamadı, varsayılan kullanılıyor:", error?.message ?? data?.deger);
    return AKTIF_UYE_ESIGI_VARSAYILAN;
  }
  return deger;
}

// ── Ortak yardımcı: yayın kimliklerinden ad haritası (v_yayin_detay) ────────
async function yayinAdMap(
  adminSupabase: SupabaseClient,
  yayinIdler: string[],
  firmaIdler?: string[],
): Promise<Map<string, { urun_adi: string; teknik_adi: string; yayin_tarihi: string | null }>> {
  const map = new Map<string, { urun_adi: string; teknik_adi: string; yayin_tarihi: string | null }>();
  if (yayinIdler.length === 0) return map;
  let sorgu = adminSupabase
    .from("v_yayin_detay")
    .select("yayin_id, urun_adi, teknik_adi, yayin_tarihi")
    .in("yayin_id", yayinIdler);
  if (firmaIdler) {
    if (firmaIdler.length === 0) return map;
    sorgu = sorgu.in("firma_id", firmaIdler);
  }
  const { data, error } = await sorgu;
  if (error) throw new Error("Eczanem yayın bilgileri okunamadı.");
  for (const y of data ?? []) {
    map.set((y as any).yayin_id, {
      urun_adi: (y as any).urun_adi ?? "-",
      teknik_adi: (y as any).teknik_adi ?? "-",
      yayin_tarihi: (y as any).yayin_tarihi ?? null,
    });
  }
  return map;
}

// ── Ortak yardımcı: eczane_id'lerden ad haritası (gln → master) ─────────────
// dokum.ts (U9) da kullanır — export bilinçli.
export async function eczaneAdMap(
  adminSupabase: SupabaseClient,
  eczaneIdler: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (eczaneIdler.length === 0) return map;

  const { data: eczaneler, error: eczaneError } = await adminSupabase
    .from("eclub_eczaneler")
    .select("eczane_id, gln")
    .in("eczane_id", eczaneIdler);
  if (eczaneError) throw new Error("Eczane bilgileri okunamadı.");

  const eczaneGln = new Map<string, string>();
  for (const e of eczaneler ?? []) eczaneGln.set((e as any).eczane_id, (e as any).gln);

  const glnler = [...new Set((eczaneler ?? []).map((e: any) => e.gln).filter(Boolean))];
  const { data: masterlar, error: masterError } = glnler.length
    ? await adminSupabase.from("eclub_eczane_master").select("gln, eczane_adi").in("gln", glnler)
    : { data: [] as any[], error: null };
  if (masterError) throw new Error("Eczane adları okunamadı.");

  const glnAd = new Map<string, string>();
  for (const m of masterlar ?? []) glnAd.set((m as any).gln, (m as any).eczane_adi);

  for (const [ez, gln] of eczaneGln) {
    const ad = glnAd.get(gln);
    if (ad) map.set(ez, ad);
  }
  return map;
}

// ── Ortak yardımcı: eczane_id'lere göre aktif üye sayıları ──────────────────
async function aktifUyeSayilari(
  adminSupabase: SupabaseClient,
  eczaneIdler: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (eczaneIdler.length === 0) return map;
  const { data, error } = await adminSupabase
    .from("eczanem_uyelikler")
    .select("eczane_id")
    .in("eczane_id", eczaneIdler)
    .eq("aktif_mi", true);
  if (error) throw new Error("Eczane aktif üye sayıları okunamadı.");
  for (const u of data ?? []) {
    const ez = (u as any).eczane_id;
    map.set(ez, (map.get(ez) ?? 0) + 1);
  }
  return map;
}

// ════════════════════════════════════════════════════════════════════════
//  UTT TARAFI (İP-§5.1–5.3)
// ════════════════════════════════════════════════════════════════════════

export interface UttEczanemYayin {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
  yayin_tarihi: string | null;
}
export interface UttEczanemEczane {
  eczane_id: string;
  eczane_adi: string;
  aktif_uye_sayisi: number;
  esik_uygun: boolean;
}
export interface UttEczanemVeri {
  esik: number;
  yayinlar: UttEczanemYayin[];
  eczaneler: UttEczanemEczane[];
  gonderimler: Array<{ yayin_id: string; eczane_id: string; created_at: string }>;
}

// UTT'nin takımındaki Eczanem yayınları + kendi bağladığı eczaneler
// (aktif üye sayısı + eşik durumu) + hangi (yayın,eczane) çiftlerinin zaten
// gönderildiği. baglayan_utt_id = kullanici_id = auth id (aynı değer).
export async function uttEczanemVerisi(
  adminSupabase: SupabaseClient,
  uttAuthId: string,
  firmaId: string,
  takimId: string | null
): Promise<UttEczanemVeri> {
  const esik = await aktifUyeEsigi(adminSupabase);

  // 1. Eczanem yayınları (bu UTT'nin takımı, yayında)
  let yayinQuery = adminSupabase
    .from("v_yayin_detay")
    .select("yayin_id, urun_adi, teknik_adi, video_url, thumbnail_url, yayin_tarihi")
    .eq("durum", "yayinda")
    .eq("firma_id", firmaId)
    .contains("hedef_roller", ["eczanem"])
    .order("yayin_tarihi", { ascending: false });
  yayinQuery = takimId
    ? yayinQuery.or(`takim_id.is.null,takim_id.eq.${takimId}`)
    : yayinQuery.is("takim_id", null);
  const { data: yayinRaw, error: yayinError } = await yayinQuery;
  if (yayinError) throw new Error("Eczanem yayınları okunamadı.");

  const yayinlar: UttEczanemYayin[] = (yayinRaw ?? []).map((y: any) => ({
    yayin_id: y.yayin_id,
    urun_adi: y.urun_adi ?? "-",
    teknik_adi: y.teknik_adi ?? "",
    video_url: y.video_url ?? null,
    thumbnail_url: y.thumbnail_url ?? null,
    yayin_tarihi: y.yayin_tarihi ?? null,
  }));

  // 2. UTT'nin bağladığı aktif eczaneler
  const { data: baglar, error: bagError } = await adminSupabase
    .from("eclub_eczane_firma")
    .select("eczane_id")
    .eq("baglayan_utt_id", uttAuthId)
    .eq("firma_id", firmaId)
    .eq("aktif_mi", true);
  if (bagError) throw new Error("UTT eczane bağlantıları okunamadı.");

  const eczaneIdler = [...new Set((baglar ?? []).map((b: any) => b.eczane_id))];
  const [adMap, sayiMap] = await Promise.all([
    eczaneAdMap(adminSupabase, eczaneIdler),
    aktifUyeSayilari(adminSupabase, eczaneIdler),
  ]);

  const eczaneler: UttEczanemEczane[] = eczaneIdler
    .map((ez) => {
      const sayi = sayiMap.get(ez) ?? 0;
      return {
        eczane_id: ez,
        eczane_adi: adMap.get(ez) ?? "(isimsiz eczane)",
        aktif_uye_sayisi: sayi,
        esik_uygun: sayi >= esik,
      };
    })
    .sort((a, b) => a.eczane_adi.localeCompare(b.eczane_adi, "tr"));

  // 3. Zaten gönderilmiş (yayın,eczane) çiftleri — yalnız bu yayın/eczane kümesi
  let gonderimler: Array<{ yayin_id: string; eczane_id: string; created_at: string }> = [];
  if (yayinlar.length && eczaneIdler.length) {
    const { data: gnd, error: gonderimError } = await adminSupabase
      .from("eczanem_eczane_gonderimleri")
      .select("yayin_id, eczane_id, created_at")
      .in("yayin_id", yayinlar.map((y) => y.yayin_id))
      .in("eczane_id", eczaneIdler);
    if (gonderimError) throw new Error("Eczanem gönderim durumları okunamadı.");
    gonderimler = (gnd ?? []).map((gonderim) => ({
      yayin_id: gonderim.yayin_id,
      eczane_id: gonderim.eczane_id,
      created_at: gonderim.created_at,
    }));
  }

  return { esik, yayinlar, eczaneler, gonderimler };
}

export interface GonderimSonuc {
  ok: boolean;
  hata?: string;
}

// UTT → eczane gönderimi (İP-§5.2/5.3): UTT kapsamı + yayın + sahiplik + eşik
// doğrulaması ve UNIQUE yazımı tek DB transaction'ında tamamlanır.
export async function eczaneyeGonder(
  adminSupabase: SupabaseClient,
  uttAuthId: string,
  yayinId: string,
  eczaneId: string
): Promise<GonderimSonuc> {
  const { data, error } = await adminSupabase.rpc("eczanem_utt_eczaneye_gonder", {
    p_utt_id: uttAuthId,
    p_yayin_id: yayinId,
    p_eczane_id: eczaneId,
  });
  if (error) throw new Error("Eczanem gönderimi veritabanında tamamlanamadı.");
  const sonuc = Array.isArray(data) ? data[0] : data;
  if (!sonuc || typeof sonuc.ok !== "boolean") throw new Error("Eczanem gönderim sonucu alınamadı.");
  return { ok: sonuc.ok, hata: sonuc.hata ?? undefined };
}

// ════════════════════════════════════════════════════════════════════════
//  ECZANE TARAFI (İP-§5.5)
// ════════════════════════════════════════════════════════════════════════

export interface EczaneGelenVideo {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  gelis_tarihi: string;
}
export interface EczaneUye {
  musteri_id: string;
  telefon_maskeli: string;
}

interface EczaneGonderimSatiri { yayin_id: string; created_at: string; }

function telefonMaskele(telefon: string): string {
  return `••• ••• ${(telefon ?? "").slice(-4)}`;
}

// Eczaneye UTT'lerce gönderilen videolar (eczacının dağıtabileceği liste).
export async function eczaneGelenVideolar(
  adminSupabase: SupabaseClient,
  eczaneId: string
): Promise<EczaneGelenVideo[]> {
  const { data: gnd } = await adminSupabase
    .from("eczanem_eczane_gonderimleri")
    .select("yayin_id, created_at")
    .eq("eczane_id", eczaneId)
    .order("created_at", { ascending: false });

  const rows = (gnd ?? []) as EczaneGonderimSatiri[];
  const erisim = await eczaneEczanemFirmaIdleri(adminSupabase, eczaneId);
  if (!erisim.ok || !erisim.acik) return [];
  const adMap = await yayinAdMap(adminSupabase, [...new Set(rows.map((gonderim) => gonderim.yayin_id))], erisim.firmaIdler);
  return rows.filter((gonderim) => adMap.has(gonderim.yayin_id)).map((gonderim) => {
    const ad = adMap.get(gonderim.yayin_id);
    return {
      yayin_id: gonderim.yayin_id,
      urun_adi: ad?.urun_adi ?? "-",
      teknik_adi: ad?.teknik_adi ?? "-",
      gelis_tarihi: gonderim.created_at,
    };
  });
}

// Eczanenin aktif üyeleri (yalnız son-4-hane — İP-§9.2; ad-soyad hiç akmaz).
export async function eczaneAktifUyeler(
  adminSupabase: SupabaseClient,
  eczaneId: string
): Promise<EczaneUye[]> {
  const { data: uyelikler } = await adminSupabase
    .from("eczanem_uyelikler")
    .select("musteri_id")
    .eq("eczane_id", eczaneId)
    .eq("aktif_mi", true);

  const musteriIdler = [...new Set((uyelikler ?? []).map((uyelik) => uyelik.musteri_id))];
  if (musteriIdler.length === 0) return [];

  const { data: musteriler } = await adminSupabase
    .from("eczanem_musteriler")
    .select("musteri_id, telefon")
    .in("musteri_id", musteriIdler)
    .eq("aktif_mi", true);

  return (musteriler ?? [])
    .map((m: any) => ({ musteri_id: m.musteri_id, telefon_maskeli: telefonMaskele(m.telefon) }))
    .sort((a, b) => a.telefon_maskeli.localeCompare(b.telefon_maskeli, "tr"));
}

export interface MusteriGonderimSonuc {
  ok: boolean;
  hata?: string;
  gonderilen: number;
  atlanan: number;
}

// Eczane → müşteri gönderimi (İP-§5.5): tekil veya toplu, tek istekte.
// Kurallar: (1) video eczaneye gerçekten gelmiş olmalı — gelmeyeni dağıtamaz;
// (2) yalnız bu eczanenin aktif üyesine; (3) UNIQUE(yayin_id, musteri_id, eczane_id)
// çakışmaları sessizce atlanır (zaten gönderilmiş). Atlananlar raporlanır.
export async function musteriyeGonder(
  adminSupabase: SupabaseClient,
  eczaneId: string,
  gonderenKisiId: string,
  yayinId: string,
  musteriIdler: string[]
): Promise<MusteriGonderimSonuc> {
  const istenen = [...new Set((musteriIdler ?? []).filter((m) => typeof m === "string"))];
  if (!yayinId) return { ok: false, hata: "Video seçilmedi.", gonderilen: 0, atlanan: 0 };
  if (istenen.length === 0) return { ok: false, hata: "En az bir müşteri seçin.", gonderilen: 0, atlanan: 0 };

  // 1. Video bu eczaneye gelmiş mi (yalnız geleni dağıtabilir)
  const { data: gelen } = await adminSupabase
    .from("eczanem_eczane_gonderimleri")
    .select("gonderim_id")
    .eq("eczane_id", eczaneId)
    .eq("yayin_id", yayinId)
    .maybeSingle();
  if (!gelen) return { ok: false, hata: "Bu video eczanenize gönderilmemiş.", gonderilen: 0, atlanan: 0 };
  const yayinErisimi = await eczaneYayinErisimiDogrula(adminSupabase, eczaneId, yayinId);
  if (!yayinErisimi.ok) {
    return { ok: false, hata: yayinErisimi.hata ?? "Eczanem erişimi doğrulanamadı.", gonderilen: 0, atlanan: 0 };
  }

  // 2. İstenenlerden bu eczanenin aktif üyesi olanlar
  const { data: uyeler } = await adminSupabase
    .from("eczanem_uyelikler")
    .select("musteri_id")
    .eq("eczane_id", eczaneId)
    .eq("aktif_mi", true)
    .in("musteri_id", istenen);
  const uyeSet = new Set((uyeler ?? []).map((u: any) => u.musteri_id));

  // 3. Zaten gönderilmiş olanlar (UNIQUE çakışacaklar) — önceden ele
  const { data: mevcut } = await adminSupabase
    .from("eczanem_gonderimler")
    .select("musteri_id")
    .eq("yayin_id", yayinId)
    .eq("eczane_id", eczaneId)
    .in("musteri_id", istenen);
  const gonderilmisSet = new Set((mevcut ?? []).map((g: any) => g.musteri_id));

  const yeni = istenen.filter((m) => uyeSet.has(m) && !gonderilmisSet.has(m));
  const atlanan = istenen.length - yeni.length;

  if (yeni.length === 0) return { ok: true, gonderilen: 0, atlanan };

  const satirlar = yeni.map((m) => ({
    yayin_id: yayinId,
    eczane_id: eczaneId,
    musteri_id: m,
    gonderen_kisi_id: gonderenKisiId,
  }));

  const { error } = await adminSupabase.from("eczanem_gonderimler").insert(satirlar);
  if (error) {
    // Yarışan istek UNIQUE'e takılabilir — tümü tek işlem, tekrar denenebilir.
    if (error.code === "23505") return { ok: false, hata: "Gönderim çakışması; tekrar deneyin.", gonderilen: 0, atlanan };
    return { ok: false, hata: "Gönderim kaydedilemedi.", gonderilen: 0, atlanan };
  }

  // Push — K-P3 Eczanem istisnası: in-app bildirim katmanı olmadığından
  // doğrudan iş olayından tetiklenir; yükte kişi verisi yoktur (K-P6).
  pushYayinlaEczanemMusterilereArkada(adminSupabase, "eczanem_gonderim", yeni);

  return { ok: true, gonderilen: yeni.length, atlanan };
}
