// lib/admin/kullaniciDogrulama.ts
//
// KULLANICI EKLEME KURAL KİTABININ TEK KAYNAĞI (B-18 + B-21 düzeltmesi,
// admin modernizasyon planı M0). Tekli rota (kullanicilar POST) ve toplu
// yükleme (toplu-yukle) AYNI doğrulamayı buradan çağırır; rol kuralları
// roller.ts + ureticiYetenegi'nden türetilir, koda gömülü liste yoktur.
//
// B-22 kilidi: bölgeler firma kapsamında yüklenir (bolgeler → takimlar.firma_id
// zinciri) — başka firmanın aynı adlı bölgesi yapısal olarak eşleşemez.
//
// Tasarım: DB okuması tek seferlik (firmaYapisiYukle), satır doğrulaması
// saf fonksiyon (kullaniciSatirDogrula) — toplu yüklemede N sorgu üretmez.

import { SupabaseClient } from "@supabase/supabase-js";
import { TUM_ROLLER, TUKETICI_ROLLER, ROL_ADLARI } from "@/lib/utils/roller";
import { ureticiYetenegi } from "@/lib/uretici/yetenekler";

/**
 * İnsan girdisini karşılaştırma için katlar: Türkçe küçük harf, diakritik
 * sadeleştirme, harf/rakam dışı her şey atılır ("E-posta" → "eposta",
 * "Takım Adı" → "takimadi"). Başlık eşleme ve rol adı çözümü bunu kullanır (B-25).
 */
export function turkceKatla(metin: string): string {
  return metin
    .toLocaleLowerCase("tr-TR")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/â/g, "a")
    .replace(/î/g, "i")
    .replace(/û/g, "u")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Rol girdisini koda çözer (B-25): kod ("utt") ya da insan adı
 * ("Ürün Tanıtım Temsilcisi") kabul edilir; ad eşlemesi ROL_ADLARI'ndan
 * katlanarak yapılır. Çözülemezse girdi olduğu gibi döner (TUM_ROLLER
 * kontrolü reddeder).
 */
export function rolCoz(girdi: string): string {
  const kod = girdi.toLocaleLowerCase("tr-TR").trim();
  if (TUM_ROLLER.includes(kod)) return kod;
  const katli = turkceKatla(girdi);
  const eslesme = Object.entries(ROL_ADLARI).find(([, ad]) => turkceKatla(ad) === katli);
  return eslesme ? eslesme[0] : kod;
}

/**
 * Telefon girdisini tek biçime çevirir: rakam dışı her şey atılır, +90/90
 * öneki düşürülür, 10 haneli "5..." girdinin başına 0 eklenir. Hedef biçim
 * 05XXXXXXXXX (11 hane) — DB'de bu biçimde saklanır, benzersizlik index'i
 * bu sayede "0555 123 45 67" ile "05551234567"yi aynı numara sayar.
 * Excel'in sayı tipine çevirip baştaki 0'ı düşürdüğü hücreler 10-hane
 * kuralıyla geri kazanılır.
 */
export function telefonNormalize(girdi: unknown): { ok: true; telefon: string } | { ok: false; hata: string } {
  const ham = metinAl(girdi);
  if (!ham) return { ok: false, hata: "Telefon zorunludur." };
  let rakamlar = ham.replace(/\D/g, "");
  if (rakamlar.length === 12 && rakamlar.startsWith("90")) rakamlar = rakamlar.slice(2);
  if (rakamlar.length === 10 && rakamlar.startsWith("5")) rakamlar = "0" + rakamlar;
  if (!/^05\d{9}$/.test(rakamlar)) {
    return { ok: false, hata: `Geçersiz telefon: "${ham}". Beklenen biçim: 05XX XXX XX XX.` };
  }
  return { ok: true, telefon: rakamlar };
}

const ALAN_UZUNLUK_SINIRI = 200;
// B-36: Supabase auth'un min-6 kuralı burada Türkçe mesajla önden yakalanır;
// ham İngilizce Auth hatası kullanıcıya hiç ulaşmaz.
const SIFRE_MIN_UZUNLUK = 6;

export interface FirmaYapisi {
  firma_id: string;
  takimlar: { takim_id: string; takim_adi: string }[];
  bolgeler: { bolge_id: string; bolge_adi: string; takim_id: string }[];
}

export interface KullaniciGirdisi {
  ad?: unknown;
  soyad?: unknown;
  eposta?: unknown;
  telefon?: unknown;
  sifre?: unknown;
  rol?: unknown;
  takim_id?: unknown;
  takim_adi?: unknown;
  bolge_id?: unknown;
  bolge_adi?: unknown;
}

export interface DogrulanmisKullanici {
  ad: string;
  soyad: string;
  eposta: string;
  telefon: string;
  sifre: string;
  rol: string;
  takim_id: string | null;
  bolge_id: string | null;
}

// K-A6 — eksik kabul modeli: kimlik çekirdeği (ad, soyad, eposta, telefon,
// sifre, rol) tam olan satır, takım/bölge çözülemese de KABUL edilir; kayıt
// NULL alanla döner ve eksikAlanlar doldurulur. "Eksik bilgili" tanımının TEK
// KAYNAĞI kullaniciEksikMi'dir — listede rozet, firma aktivasyon kilidi ve
// başka her tüketici kendi kontrolünü yazmaz, bu fonksiyonu çağırır.
// Telefon kimlik çekirdeğindedir (İskender kararı, 18.07.2026): yeni satır
// telefonsuz giremez; kolon öncesi mevcut kayıtlar için eksik alanı sayılır.
export type EksikAlan = "takim" | "bolge" | "telefon";

export type SatirDogrulamaSonucu =
  | { ok: true; kayit: DogrulanmisKullanici; eksikAlanlar: EksikAlan[]; uyari?: string }
  | { ok: false; hata: string; alanlar?: string[] };

/**
 * Kullanıcının "eksik bilgili" olup olmadığını rol kurallarından türetir.
 * DB'de ayrı bir eksik kolonu YOKTUR; tanım her zaman buradan okunur.
 */
export function kullaniciEksikMi(
  rol: string,
  takim_id: string | null,
  bolge_id: string | null,
  telefon: string | null
): { eksik: boolean; eksikAlanlar: EksikAlan[] } {
  const eksikAlanlar: EksikAlan[] = [];
  if (!telefon) eksikAlanlar.push("telefon");
  const yetenek = ureticiYetenegi(rol);
  if (yetenek) {
    if (yetenek.takimZorunlu && !takim_id) eksikAlanlar.push("takim");
  } else if (rol === "tm") {
    if (!takim_id) eksikAlanlar.push("takim");
  } else if (rol === "bm" || TUKETICI_ROLLER.includes(rol)) {
    // Takım bölgeden türetilir; eksiklik bölge üzerinden raporlanır.
    if (!bolge_id) eksikAlanlar.push("bolge");
  }
  return { eksik: eksikAlanlar.length > 0, eksikAlanlar };
}

export interface EksikKullanici {
  kullanici_id: string;
  ad: string;
  soyad: string;
  rol: string;
  eksikAlanlar: EksikAlan[];
}

/**
 * Firmanın eksik bilgili kullanıcılarını döner (tek SELECT + saf filtre).
 * Firma aktivasyon kilidi (K-A6) ve liste rozeti bu yardımcıyı kullanır.
 */
export async function firmaninEksikKullanicilari(
  adminSupabase: SupabaseClient,
  firma_id: string
): Promise<{ ok: true; eksikler: EksikKullanici[] } | { ok: false; hata: string }> {
  const { data, error } = await adminSupabase
    .from("kullanicilar")
    .select("kullanici_id, ad, soyad, rol, takim_id, bolge_id, telefon")
    .eq("firma_id", firma_id);

  if (error) return { ok: false, hata: "Kullanıcılar çekilemedi." };

  const eksikler: EksikKullanici[] = [];
  for (const k of data ?? []) {
    const sonuc = kullaniciEksikMi(k.rol, k.takim_id, k.bolge_id, k.telefon);
    if (sonuc.eksik) {
      eksikler.push({ kullanici_id: k.kullanici_id, ad: k.ad, soyad: k.soyad, rol: k.rol, eksikAlanlar: sonuc.eksikAlanlar });
    }
  }
  return { ok: true, eksikler };
}

/**
 * Firmanın takım/bölge yapısını TEK sorgu çiftiyle yükler.
 * Bölgeler firma kapsamına kilitlidir (B-22).
 */
export async function firmaYapisiYukle(
  adminSupabase: SupabaseClient,
  firma_id: string
): Promise<{ ok: true; yapi: FirmaYapisi } | { ok: false; hata: string }> {
  const { data: takimlar, error: takimError } = await adminSupabase
    .from("takimlar")
    .select("takim_id, takim_adi")
    .eq("firma_id", firma_id);

  if (takimError) return { ok: false, hata: "Takımlar çekilemedi." };

  const takimIdler = (takimlar ?? []).map((t) => t.takim_id);
  let bolgeler: FirmaYapisi["bolgeler"] = [];
  if (takimIdler.length > 0) {
    const { data, error: bolgeError } = await adminSupabase
      .from("bolgeler")
      .select("bolge_id, bolge_adi, takim_id")
      .in("takim_id", takimIdler);
    if (bolgeError) return { ok: false, hata: "Bölgeler çekilemedi." };
    bolgeler = data ?? [];
  }

  return { ok: true, yapi: { firma_id, takimlar: takimlar ?? [], bolgeler } };
}

function metinAl(deger: unknown): string {
  // Hücre değeri tipinden bağımsız okunur: Excel "123456" gibi girdilere
  // kendi kafasına göre sayı tipi atar — değer neyse o alınır.
  if (typeof deger === "string") return deger.trim();
  if (typeof deger === "number" && Number.isFinite(deger)) return String(deger);
  return "";
}

/**
 * Bir kullanıcı satırını doğrular ve temiz kayda çevirir. Kurallar:
 * - ad/soyad/eposta/telefon/sifre/rol zorunlu; alanlar ≤200; eposta '@' içerir.
 * - telefon telefonNormalize'dan geçer (05XXXXXXXXX'e oturmayan girdi RED).
 * - rol TUM_ROLLER'da olmalı (B-18 — geçersiz rol yapısal olarak giremez).
 * - Üretici roller: takım zorunluluğu yetenek profilinden (takimZorunlu).
 * - TM: takım zorunlu. BM/UTT/KD_UTT: bölge zorunlu, takım bölgeden türetilir.
 * - Diğer roller (yönetici/admin/İU): takım-bölge atanmaz.
 * - Takım/bölge id ya da adla verilebilir; eşleşme firma yapısı İÇİNDE aranır.
 *
 * K-A6 — eksik kabul: takım/bölge zorunluluğu artık RED sebebi DEĞİLDİR.
 * Alan boşsa ya da verilen ad/id firmada eşleşmezse satır kabul edilir,
 * ilgili alan NULL kalır, eksikAlanlar işaretlenir; eşleşmeyen girdi için
 * uyari mesajı döner (yanlış yazım sessizce kaybolmaz, görünür kalır).
 */
export function kullaniciSatirDogrula(
  yapi: FirmaYapisi,
  girdi: KullaniciGirdisi
): SatirDogrulamaSonucu {
  const ad = metinAl(girdi.ad);
  const soyad = metinAl(girdi.soyad);
  const eposta = metinAl(girdi.eposta).toLowerCase();
  const telefonHam = metinAl(girdi.telefon);
  const sifre = metinAl(girdi.sifre);
  // B-25: rol kod ya da insan adıyla gelebilir — tek çözümleyiciden geçer.
  const rol = rolCoz(metinAl(girdi.rol));

  if (!ad || !soyad || !eposta || !telefonHam || !sifre || !rol) {
    return { ok: false, hata: "Zorunlu alan eksik (ad, soyad, eposta, telefon, sifre, rol).", alanlar: ["ad", "soyad", "eposta", "telefon", "sifre", "rol"] };
  }
  for (const [alan, deger] of [["ad", ad], ["soyad", soyad], ["eposta", eposta], ["sifre", sifre]] as const) {
    if (deger.length > ALAN_UZUNLUK_SINIRI) {
      return { ok: false, hata: `${alan} ${ALAN_UZUNLUK_SINIRI} karakterden uzun olamaz.`, alanlar: [alan] };
    }
  }
  if (!eposta.includes("@")) {
    return { ok: false, hata: "Geçersiz e-posta adresi.", alanlar: ["eposta"] };
  }
  const telefonSonuc = telefonNormalize(telefonHam);
  if (!telefonSonuc.ok) {
    return { ok: false, hata: telefonSonuc.hata, alanlar: ["telefon"] };
  }
  const telefon = telefonSonuc.telefon;
  if (sifre.length < SIFRE_MIN_UZUNLUK) {
    return { ok: false, hata: `Şifre en az ${SIFRE_MIN_UZUNLUK} karakter olmalıdır.`, alanlar: ["sifre"] };
  }
  if (!TUM_ROLLER.includes(rol)) {
    return { ok: false, hata: `Geçersiz rol: "${rol}". Rol kodu (ör. utt) ya da tam adı (ör. Ürün Tanıtım Temsilcisi) kullanın.`, alanlar: ["rol"] };
  }

  const takimIdGirdi = metinAl(girdi.takim_id);
  const takimAdiGirdi = metinAl(girdi.takim_adi);
  const bolgeIdGirdi = metinAl(girdi.bolge_id);
  const bolgeAdiGirdi = metinAl(girdi.bolge_adi);

  const takimBul = (): { ok: boolean; takim_id?: string; hata?: string } => {
    if (takimIdGirdi) {
      const t = yapi.takimlar.find((x) => x.takim_id === takimIdGirdi);
      return t ? { ok: true, takim_id: t.takim_id } : { ok: false, hata: "Takım bu firmada bulunamadı." };
    }
    if (takimAdiGirdi) {
      const t = yapi.takimlar.find((x) => x.takim_adi.toLowerCase() === takimAdiGirdi.toLowerCase());
      return t ? { ok: true, takim_id: t.takim_id } : { ok: false, hata: `"${takimAdiGirdi}" adında takım bu firmada bulunamadı.` };
    }
    return { ok: false };
  };

  const bolgeBul = (): { ok: boolean; bolge_id?: string; takim_id?: string; hata?: string } => {
    if (bolgeIdGirdi) {
      const b = yapi.bolgeler.find((x) => x.bolge_id === bolgeIdGirdi);
      return b ? { ok: true, bolge_id: b.bolge_id, takim_id: b.takim_id } : { ok: false, hata: "Bölge bu firmada bulunamadı." };
    }
    if (bolgeAdiGirdi) {
      const b = yapi.bolgeler.find((x) => x.bolge_adi.toLowerCase() === bolgeAdiGirdi.toLowerCase());
      return b ? { ok: true, bolge_id: b.bolge_id, takim_id: b.takim_id } : { ok: false, hata: `"${bolgeAdiGirdi}" adında bölge bu firmada bulunamadı.` };
    }
    return { ok: false };
  };

  let takim_id: string | null = null;
  let bolge_id: string | null = null;
  let uyari: string | undefined;

  const takimGirdiVar = Boolean(takimIdGirdi || takimAdiGirdi);
  const bolgeGirdiVar = Boolean(bolgeIdGirdi || bolgeAdiGirdi);
  const yetenek = ureticiYetenegi(rol);

  if (yetenek || rol === "tm") {
    const t = takimBul();
    if (t.ok) {
      takim_id = t.takim_id!;
    } else if (takimGirdiVar) {
      // Verilmiş ama firmada eşleşmemiş: NULL kabul + görünür uyarı (K-A6).
      uyari = `${t.hata ?? "Takım bulunamadı."} Kullanıcı takım ataması olmadan kaydedilir.`;
    }
  } else if (rol === "bm" || TUKETICI_ROLLER.includes(rol)) {
    const b = bolgeBul();
    if (b.ok) {
      bolge_id = b.bolge_id!;
      takim_id = b.takim_id!;
    } else if (bolgeGirdiVar) {
      uyari = `${b.hata ?? "Bölge bulunamadı."} Kullanıcı bölge ataması olmadan kaydedilir.`;
    }
  }
  // Diğer roller: takım/bölge atanmaz.

  const { eksikAlanlar } = kullaniciEksikMi(rol, takim_id, bolge_id, telefon);
  return { ok: true, kayit: { ad, soyad, eposta, telefon, sifre, rol, takim_id, bolge_id }, eksikAlanlar, uyari };
}

// ─── Rol geçişi (B-23) ──────────────────────────────────────────────────────

export interface RolGecisiGirdisi {
  mevcut_takim_id: string | null;
  mevcut_bolge_id: string | null;
  takim_id?: unknown;
  takim_adi?: unknown;
  bolge_id?: unknown;
  bolge_adi?: unknown;
}

export type RolGecisiSonucu =
  | { ok: true; takim_id: string | null; bolge_id: string | null }
  | { ok: false; hata: string; alanlar?: string[] };

/**
 * Rol DEĞİŞİRKEN takım/bölge tutarlılığını çözer (B-23): yeni rolün
 * zorunlulukları uygulanır — eski role ait alanlar üstünde kalmaz.
 * Öncelik: istekle gelen takım/bölge > kullanıcının mevcut değeri.
 * Yeni rol için zorunlu alan hiçbir kaynaktan bulunamazsa geçiş reddedilir.
 */
export function rolGecisiCoz(
  yapi: FirmaYapisi,
  yeniRol: string,
  g: RolGecisiGirdisi
): RolGecisiSonucu {
  const takimIdGirdi = metinAl(g.takim_id);
  const takimAdiGirdi = metinAl(g.takim_adi);
  const bolgeIdGirdi = metinAl(g.bolge_id);
  const bolgeAdiGirdi = metinAl(g.bolge_adi);

  const takimSec = (): { ok: boolean; takim_id?: string; hata?: string } => {
    if (takimIdGirdi || takimAdiGirdi) {
      const t = takimIdGirdi
        ? yapi.takimlar.find((x) => x.takim_id === takimIdGirdi)
        : yapi.takimlar.find((x) => x.takim_adi.toLowerCase() === takimAdiGirdi.toLowerCase());
      return t ? { ok: true, takim_id: t.takim_id } : { ok: false, hata: "Takım bu firmada bulunamadı." };
    }
    if (g.mevcut_takim_id) return { ok: true, takim_id: g.mevcut_takim_id };
    return { ok: false };
  };

  const bolgeSec = (): { ok: boolean; bolge_id?: string; takim_id?: string; hata?: string } => {
    if (bolgeIdGirdi || bolgeAdiGirdi) {
      const b = bolgeIdGirdi
        ? yapi.bolgeler.find((x) => x.bolge_id === bolgeIdGirdi)
        : yapi.bolgeler.find((x) => x.bolge_adi.toLowerCase() === bolgeAdiGirdi.toLowerCase());
      return b ? { ok: true, bolge_id: b.bolge_id, takim_id: b.takim_id } : { ok: false, hata: "Bölge bu firmada bulunamadı." };
    }
    if (g.mevcut_bolge_id) {
      const b = yapi.bolgeler.find((x) => x.bolge_id === g.mevcut_bolge_id);
      if (b) return { ok: true, bolge_id: b.bolge_id, takim_id: b.takim_id };
    }
    return { ok: false };
  };

  const yetenek = ureticiYetenegi(yeniRol);

  if (yetenek) {
    const t = takimSec();
    if (yetenek.takimZorunlu) {
      if (!t.ok) return { ok: false, hata: t.hata ?? `${yeniRol} rolü için takım zorunludur; takım belirtin.`, alanlar: ["takim_id"] };
      return { ok: true, takim_id: t.takim_id!, bolge_id: null };
    }
    return { ok: true, takim_id: t.ok ? t.takim_id! : null, bolge_id: null };
  }
  if (yeniRol === "tm") {
    const t = takimSec();
    if (!t.ok) return { ok: false, hata: t.hata ?? "tm rolü için takım zorunludur; takım belirtin.", alanlar: ["takim_id"] };
    return { ok: true, takim_id: t.takim_id!, bolge_id: null };
  }
  if (yeniRol === "bm" || TUKETICI_ROLLER.includes(yeniRol)) {
    const b = bolgeSec();
    if (!b.ok) return { ok: false, hata: b.hata ?? `${yeniRol} rolü için bölge zorunludur; bölge belirtin.`, alanlar: ["bolge_id"] };
    return { ok: true, takim_id: b.takim_id!, bolge_id: b.bolge_id! };
  }
  // Yönetici/admin/İU sınıfı: takım-bölge taşınmaz.
  return { ok: true, takim_id: null, bolge_id: null };
}
