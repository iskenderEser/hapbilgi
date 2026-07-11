// lib/eczanem/silme.ts
// KVKK silme akışının tek kaynağı (İP-§3.6 + K-E5 kapalı karar, 11.07.2026):
// ANINDA TAM SİLME, puan dahil — sistemdeki ilk gerçek fiziksel DELETE akışı.
//
// Ne silinir: puan, izleme, gönderim, üyelik, davet ve giriş-OTP kayıtları +
// müşteri satırı + auth kaydı. Bakiye şartı YOKTUR (silme hakkı bakiyeye
// bağlanamaz — İP-§3.6).
//
// Ne kalır: parasal tarihçe (siparişler + harcama kayıtları) mutabakatın
// dayanağıdır — kişi bağı koparılır: siparişlerde musteri_id boşalır ve
// eczane bazlı "Müşteri N" etiketi yazılır (görüntülemede eczane adıyla
// "Eczane X Müşteri N" olarak birleşir). Harcama kayıtlarının puan bağı
// (kaynak_kayit_id) DB'de ON DELETE SET NULL ile kendiliğinden boşalır;
// dusulen_puan kopyalı olduğundan parasal iz kaybolmaz.

import { SupabaseClient } from "@supabase/supabase-js";

export interface SilmeSonuc {
  ok: boolean;
  hata?: string;
}

// Eczane bazlı anonim etiket: o eczanede daha önce verilmiş etiket sayısı + 1.
// Sayaç ayrı tabloda tutulmaz — etiketler siparişlerde durduğundan sayım
// sorgu-anında yapılır (silme nadir bir olaydır, yarış pratikte yoktur;
// çakışsa dahi etiket UNIQUE değildir, mutabakat toplamları etkilenmez).
async function anonimEtiketUret(
  adminSupabase: SupabaseClient,
  eczaneId: string
): Promise<string> {
  const { data } = await adminSupabase
    .from("eczanem_siparisler")
    .select("musteri_etiket")
    .eq("eczane_id", eczaneId)
    .not("musteri_etiket", "is", null);

  const mevcut = new Set((data ?? []).map((s: any) => s.musteri_etiket));
  return `Müşteri ${mevcut.size + 1}`;
}

export async function musteriSil(
  adminSupabase: SupabaseClient,
  musteriId: string
): Promise<SilmeSonuc> {
  const { data: musteri, error: musteriHatasi } = await adminSupabase
    .from("eczanem_musteriler")
    .select("musteri_id, auth_user_id, telefon")
    .eq("musteri_id", musteriId)
    .maybeSingle();

  if (musteriHatasi || !musteri) return { ok: false, hata: "Müşteri kaydı bulunamadı." };

  // 1) Parasal tarihçe anonimleştirilir — eczane başına tek etiket.
  const { data: siparisEczaneleri } = await adminSupabase
    .from("eczanem_siparisler")
    .select("eczane_id")
    .eq("musteri_id", musteriId);

  const eczaneIdler = [...new Set((siparisEczaneleri ?? []).map((s: any) => s.eczane_id))];
  for (const eczaneId of eczaneIdler) {
    const etiket = await anonimEtiketUret(adminSupabase, eczaneId);
    const { error: etiketHatasi } = await adminSupabase
      .from("eczanem_siparisler")
      .update({ musteri_id: null, musteri_etiket: etiket })
      .eq("musteri_id", musteriId)
      .eq("eczane_id", eczaneId);
    if (etiketHatasi) return { ok: false, hata: "Parasal tarihçe anonimleştirilemedi." };
  }

  // 2) Kişisel kayıtlar FK sırasıyla fiziksel silinir (çocuktan ebeveyne):
  //    puan → izleme → gönderim → üyelik → davet/OTP → müşteri satırı.
  const silmeAdimlari: Array<{ tablo: string; kolon: string; deger: string }> = [
    { tablo: "eczanem_puan_kayitlari", kolon: "musteri_id", deger: musteriId },
    { tablo: "eczanem_izleme_kayitlari", kolon: "musteri_id", deger: musteriId },
    { tablo: "eczanem_gonderimler", kolon: "musteri_id", deger: musteriId },
    { tablo: "eczanem_uyelikler", kolon: "musteri_id", deger: musteriId },
    { tablo: "eczanem_davetler", kolon: "telefon", deger: musteri.telefon },
    { tablo: "eczanem_giris_otp", kolon: "telefon", deger: musteri.telefon },
    { tablo: "eczanem_musteriler", kolon: "musteri_id", deger: musteriId },
  ];

  for (const adim of silmeAdimlari) {
    const { error } = await adminSupabase.from(adim.tablo).delete().eq(adim.kolon, adim.deger);
    if (error) return { ok: false, hata: `Silme tamamlanamadı (${adim.tablo}).` };
  }

  // 3) Auth kaydı en son — üstteki adımlar başarısız olursa kişi giriş
  //    yapabilir kalır ve silmeyi yeniden deneyebilir.
  if (musteri.auth_user_id) {
    const { error: authHatasi } = await adminSupabase.auth.admin.deleteUser(musteri.auth_user_id);
    if (authHatasi) {
      console.error("[lib/eczanem/silme] auth kaydı silinemedi:", authHatasi.message);
      // Kişisel veri zaten silindi; auth kaydı sahipsiz kaldı — log yeter,
      // akış başarıyla döner (kullanıcıya tekrar denetilecek bir şey kalmadı).
    }
  }

  return { ok: true };
}
