// lib/utils/hataIsle.ts
import { NextResponse } from "next/server";

// Supabase hata kodları
const SUPABASE_HATA_KODLARI: Record<string, string> = {
  "23505": "Bu kayıt zaten mevcut (unique constraint ihlali).",
  "23503": "İlişkili kayıt bulunamadı (foreign key ihlali).",
  "23502": "Zorunlu alan boş bırakılamaz (not null ihlali).",
  "23514": "Geçersiz değer (check constraint ihlali).",
  "42P01": "Tablo bulunamadı.",
  "42703": "Kolon bulunamadı.",
  "PGRST116": "Kayıt bulunamadı.",
  "PGRST301": "Yetki hatası.",
};

// Standart hata yanıtı arayüzü
export interface HataDetay {
  hata: string;
  detay?: string;
  adim?: string;
  tablo?: string;
  kod?: string;
}

/**
 * Supabase hatasını ayrıştırır ve kullanıcı dostu mesaja çevirir.
 */
export function supabaseHatasiniCoz(error: any): string {
  if (!error) return "Bilinmeyen hata.";
  const kod = error.code ?? "";
  if (SUPABASE_HATA_KODLARI[kod]) return SUPABASE_HATA_KODLARI[kod];
  return error.message ?? "Veritabanı hatası.";
}

/**
 * API route'larında kullanılacak standart hata yanıtı üretici.
 * @param hata - Kullanıcıya gösterilecek ana hata mesajı
 * @param adim - Hatanın oluştuğu adım (örn: "senaryolar tablosu insert")
 * @param error - Supabase veya JS hata nesnesi
 * @param status - HTTP durum kodu (varsayılan 500)
 */
export function hataYaniti(
  hata: string,
  adim?: string,
  error?: any,
  status: number = 500
): NextResponse {
  const detay: HataDetay = { hata };

  if (adim) detay.adim = adim;

  if (error) {
    detay.detay = supabaseHatasiniCoz(error);
    if (error.code) detay.kod = error.code;
  }

  // Konsola detaylı log
  console.error(`[HATA] ${adim ?? "bilinmeyen adım"}: ${hata}`, {
    detay: error?.message,
    kod: error?.code,
    hint: error?.hint,
    details: error?.details,
  });

  return NextResponse.json(detay, { status });
}

/**
 * Null/undefined kontrolü yapan yardımcı.
 * Zincir sorgularında her adımda kullanılır.
 */
export function veriKontrol<T>(
  veri: T | null | undefined,
  adim: string,
  hata: string = "Kayıt bulunamadı."
): { gecerli: true; veri: T } | { gecerli: false; yanit: NextResponse } {
  if (veri === null || veri === undefined) {
    console.error(`[NULL] ${adim}: ${hata}`);
    return {
      gecerli: false,
      yanit: NextResponse.json({ hata, adim }, { status: 404 }),
    };
  }
  return { gecerli: true, veri };
}

/**
 * Beklenmedik sunucu hatalarını yakalar.
 */
export function sunucuHatasi(err: unknown, adim: string): NextResponse {
  const mesaj = err instanceof Error ? err.message : "Bilinmeyen hata.";
  console.error(`[SUNUCU HATASI] ${adim}:`, err);
  return NextResponse.json(
    { hata: "Sunucu hatası.", adim, detay: mesaj },
    { status: 500 }
  );
}

/**
 * Yetki hatası yanıtı.
 */
export function yetkiHatasi(mesaj: string = "Yetkisiz erişim."): NextResponse {
  return NextResponse.json({ hata: mesaj }, { status: 401 });
}

/**
 * Rol hatası yanıtı.
 */
export function rolHatasi(mesaj: string = "Bu işlem için yetkiniz bulunmuyor."): NextResponse {
  return NextResponse.json({ hata: mesaj }, { status: 403 });
}

/**
 * Validasyon hatası yanıtı.
 */
export function validasyonHatasi(mesaj: string, alanlar?: string[]): NextResponse {
  return NextResponse.json(
    { hata: mesaj, alanlar },
    { status: 400 }
  );
}

/**
 * İş kuralı ihlali yanıtı.
 */
export function isKuraluHatasi(mesaj: string): NextResponse {
  return NextResponse.json({ hata: mesaj }, { status: 422 });
}