// lib/tur/kayit.ts
// Tekrar gönderim (tur) modeli — yayin_tekrar_kayitlari yazım ve okuma katmanı.
// Bu tabloya INSERT yalnızca buradan yapılır (kayit-tek-kaynak kuralı).
// Desen: lib/puan/kayit.ts (route orkestre eder, yazım tek noktadan).

import { SupabaseClient } from "@supabase/supabase-js";

export type TurAcilisTuru = "ilk_yayin" | "otomatik";

export interface TurKaydiParams {
  yayin_id: string;
  tur_no: number;
  acilis_turu: TurAcilisTuru;
  /** Verilmezse DB varsayılanı (now()) kullanılır. */
  baslangic_tarihi?: string;
}

export interface TurKaydiSonuc {
  ok: boolean;
  tekrar_id?: string;
  error?: string;
}

export interface GecerliTur {
  tekrar_id: string;
  tur_no: number;
  baslangic_tarihi: string;
}

export interface GecerliTurSonuc {
  ok: boolean;
  tur?: GecerliTur;
  error?: string;
}

/** Liste ekranları için hesaplanmış tur bilgisi (salt-okur — satır açılmaz). */
export interface HesaplananTur {
  /** Geçerli turun başlangıcı (periyot dolmuşsa takvim hizalı hesaplanmış değer). */
  baslangic_tarihi: string;
  /** Tekrar periyodu (gün); NULL = tekrar yok. */
  tekrar_periyot_gun: number | null;
  /** Bir sonraki turun açılacağı an; periyot yoksa null. */
  sonraki_tur_tarihi: string | null;
}

const GUN_MS = 24 * 60 * 60 * 1000;

/** Takvim hizalı geçerli başlangıç: son başlangıç + geçen tam periyot sayısı × periyot. */
function hizaliBaslangic(sonBaslangicMs: number, periyotGun: number, simdiMs: number): number {
  const gecenPeriyot = Math.floor((simdiMs - sonBaslangicMs) / (periyotGun * GUN_MS));
  return gecenPeriyot < 1 ? sonBaslangicMs : sonBaslangicMs + gecenPeriyot * periyotGun * GUN_MS;
}

/**
 * yayin_tekrar_kayitlari'na yeni tur satırı açar.
 * (yayin_id, tur_no) UNIQUE olduğundan eşzamanlı çift açılış DB seviyesinde engellenir;
 * çakışmada ok:false döner, çağıran taraf mevcut turu okuyarak devam eder.
 */
export async function turKaydiAc(
  adminSupabase: SupabaseClient,
  params: TurKaydiParams
): Promise<TurKaydiSonuc> {
  const kayit: Record<string, unknown> = {
    yayin_id: params.yayin_id,
    tur_no: params.tur_no,
    acilis_turu: params.acilis_turu,
  };
  if (params.baslangic_tarihi) kayit.baslangic_tarihi = params.baslangic_tarihi;

  const { data, error } = await adminSupabase
    .from("yayin_tekrar_kayitlari")
    .insert(kayit)
    .select("tekrar_id")
    .single();

  if (error) {
    return { ok: false, error: `yayin_tekrar_kayitlari INSERT: ${error.message}` };
  }

  return { ok: true, tekrar_id: data.tekrar_id };
}

/**
 * Yayının geçerli turunu döner; periyot dolmuşsa yeni turu açar (otomatik mekanizma).
 *
 * Kurallar:
 * - Periyot yoksa (tekrar_periyot_gun NULL) mevcut son tur döner — tekrar işlemez.
 * - Periyot dolmuşsa yeni tur açılır. Başlangıç, sorgu anı değil periyodun kendi
 *   takvimidir: son başlangıç + (geçen tam periyot sayısı × periyot). Atlanan
 *   periyotlar için ara satır açılmaz; tur_no bir ilerler, başlangıç son dolan
 *   sınıra hizalanır.
 * - Tur kaydı hiç yoksa (U2'de nadir başarısızlık) tur-1 now() ile açılır —
 *   yayin_tarihi'ne dayanılmaz (durdur/başlat o kolonu günceller; oynak kaynak).
 * - Eşzamanlı açılışta UNIQUE çakışması yutulur, kazanan satır okunup dönülür.
 */
export async function gecerliTur(
  adminSupabase: SupabaseClient,
  yayin_id: string
): Promise<GecerliTurSonuc> {
  const { data: yayin, error: yayinError } = await adminSupabase
    .from("yayin_yonetimi")
    .select("tekrar_periyot_gun")
    .eq("yayin_id", yayin_id)
    .single();

  if (yayinError || !yayin) {
    return { ok: false, error: `yayin_yonetimi SELECT: ${yayinError?.message ?? "yayın bulunamadı"}` };
  }

  const { data: sonTur, error: turError } = await adminSupabase
    .from("yayin_tekrar_kayitlari")
    .select("tekrar_id, tur_no, baslangic_tarihi")
    .eq("yayin_id", yayin_id)
    .order("tur_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (turError) {
    return { ok: false, error: `yayin_tekrar_kayitlari SELECT: ${turError.message}` };
  }

  // Kendini onarma: tur kaydı hiç yok → tur-1'i şimdi aç.
  if (!sonTur) {
    const acilis = await turKaydiAc(adminSupabase, {
      yayin_id,
      tur_no: 1,
      acilis_turu: "ilk_yayin",
    });
    if (!acilis.ok) return await sonTuruOku(adminSupabase, yayin_id, acilis.error);
    return await sonTuruOku(adminSupabase, yayin_id);
  }

  const periyotGun = yayin.tekrar_periyot_gun;

  // Tekrar yok — mevcut tur geçerli.
  if (!periyotGun || periyotGun <= 0) {
    return { ok: true, tur: sonTur as GecerliTur };
  }

  const baslangicMs = new Date(sonTur.baslangic_tarihi).getTime();
  const simdiMs = Date.now();
  const yeniBaslangicMs = hizaliBaslangic(baslangicMs, periyotGun, simdiMs);

  // Periyot henüz dolmadı — mevcut tur geçerli.
  if (yeniBaslangicMs === baslangicMs) {
    return { ok: true, tur: sonTur as GecerliTur };
  }

  // Periyot dol(du/dular) — yeni tur, takvim hizalı başlangıçla.
  const acilis = await turKaydiAc(adminSupabase, {
    yayin_id,
    tur_no: sonTur.tur_no + 1,
    acilis_turu: "otomatik",
    baslangic_tarihi: new Date(yeniBaslangicMs).toISOString(),
  });

  // Çakışma (eşzamanlı açılış) dahil her durumda kazanan satırı okuyup dön.
  if (!acilis.ok) return await sonTuruOku(adminSupabase, yayin_id, acilis.error);
  return await sonTuruOku(adminSupabase, yayin_id);
}

/**
 * LİSTE EKRANLARI İÇİN — toplu, SALT-OKUR tur hesabı (U8).
 *
 * Verilen yayınların geçerli tur başlangıçlarını iki sorguda HESAPLAR; satır AÇMAZ
 * (N+1 INSERT tuzağı yok — gerçek tur satırı izleme anlarında gecerliTur ile açılır).
 * Hesap gecerliTur ile aynı takvim hizası formülünü kullanır; sonuç deterministiktir,
 * satırın açılmış/açılmamış olması davranışı değiştirmez.
 *
 * Tur kaydı hiç olmayan yayın (nadir) haritada yer almaz — çağıran taraf
 * o yayın için epoch/eski davranışa düşer.
 *
 * @returns yayin_id → HesaplananTur haritası
 */
export async function gecerliTurBaslangiclari(
  adminSupabase: SupabaseClient,
  yayin_idler: string[]
): Promise<Record<string, HesaplananTur>> {
  const sonuc: Record<string, HesaplananTur> = {};
  if (yayin_idler.length === 0) return sonuc;

  const [{ data: yayinlar, error: yError }, { data: turlar, error: tError }] = await Promise.all([
    adminSupabase
      .from("yayin_yonetimi")
      .select("yayin_id, tekrar_periyot_gun")
      .in("yayin_id", yayin_idler),
    adminSupabase
      .from("yayin_tekrar_kayitlari")
      .select("yayin_id, tur_no, baslangic_tarihi")
      .in("yayin_id", yayin_idler),
  ]);

  if (yError || tError) {
    console.error("[UYARI] gecerliTurBaslangiclari sorgu hatası:", yError?.message ?? tError?.message);
    return sonuc; // boş harita — çağıran eski davranışa düşer
  }

  const periyotMap: Record<string, number | null> = {};
  for (const y of yayinlar ?? []) {
    periyotMap[y.yayin_id] = y.tekrar_periyot_gun ?? null;
  }

  // Her yayının EN SON turu (tur_no en büyük)
  const sonTurMap: Record<string, { tur_no: number; baslangic_tarihi: string }> = {};
  for (const t of turlar ?? []) {
    const mevcut = sonTurMap[t.yayin_id];
    if (!mevcut || t.tur_no > mevcut.tur_no) {
      sonTurMap[t.yayin_id] = { tur_no: t.tur_no, baslangic_tarihi: t.baslangic_tarihi };
    }
  }

  const simdiMs = Date.now();
  for (const yayin_id of Object.keys(sonTurMap)) {
    const sonTur = sonTurMap[yayin_id];
    const periyotGun = periyotMap[yayin_id] ?? null;
    const sonBaslangicMs = new Date(sonTur.baslangic_tarihi).getTime();

    if (!periyotGun || periyotGun <= 0) {
      sonuc[yayin_id] = {
        baslangic_tarihi: sonTur.baslangic_tarihi,
        tekrar_periyot_gun: null,
        sonraki_tur_tarihi: null,
      };
      continue;
    }

    const gecerliMs = hizaliBaslangic(sonBaslangicMs, periyotGun, simdiMs);
    sonuc[yayin_id] = {
      baslangic_tarihi: new Date(gecerliMs).toISOString(),
      tekrar_periyot_gun: periyotGun,
      sonraki_tur_tarihi: new Date(gecerliMs + periyotGun * GUN_MS).toISOString(),
    };
  }

  return sonuc;
}

/** Son tur satırını okur; bulunamazsa verilen bağlam hatasıyla döner. */
async function sonTuruOku(
  adminSupabase: SupabaseClient,
  yayin_id: string,
  baglamHata?: string
): Promise<GecerliTurSonuc> {
  const { data, error } = await adminSupabase
    .from("yayin_tekrar_kayitlari")
    .select("tekrar_id, tur_no, baslangic_tarihi")
    .eq("yayin_id", yayin_id)
    .order("tur_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      error: `yayin_tekrar_kayitlari okunamadı: ${error?.message ?? "kayıt yok"}${baglamHata ? ` (önceki hata: ${baglamHata})` : ""}`,
    };
  }
  return { ok: true, tur: data as GecerliTur };
}