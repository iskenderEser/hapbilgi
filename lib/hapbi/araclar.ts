import type { SupabaseClient } from "@supabase/supabase-js";
import type { HapbiKullaniciBaglami } from "@/lib/hapbi/hapbiKullaniciBaglami";
import { nesne, type HapbiAracSonucu } from "@/lib/hapbi/sozlesme";
import { aktifPeriyot } from "@/lib/zaman/kontrol";
import { aracBaglamiOlustur, type HapbiAlanCalistirici } from "@/lib/hapbi/aracMotorlari/ortak";

export { ARAC_TANIMLARI } from "@/lib/hapbi/aracTanimlari";
export { periyoduDogrula, guvenliSatirlar } from "@/lib/hapbi/aracMotorlari/ortak";

async function calistiriciyiYukle(ad: string): Promise<HapbiAlanCalistirici | null> {
  if (ad === "platform_bilgisi") {
    return (await import("@/lib/hapbi/aracMotorlari/platform")).platformAraciniCalistir;
  }
  if (ad === "egitimleri_getir" || ad === "egitim_icerigi") {
    return (await import("@/lib/hapbi/aracMotorlari/egitim")).egitimAraciniCalistir;
  }
  if (ad === "gelisim_rehberi" || ad === "donem_karsilastir") {
    return (await import("@/lib/hapbi/aracMotorlari/gelisim")).gelisimAraciniCalistir;
  }
  if (ad === "lig_durumu" || ad === "performans_raporu") {
    return (await import("@/lib/hapbi/aracMotorlari/saha")).sahaAraciniCalistir;
  }
  if (ad === "uretim_raporu") {
    return (await import("@/lib/hapbi/aracMotorlari/uretim")).uretimAraciniCalistir;
  }
  if (ad === "eclub_kisisel_durum" || ad === "eclub_raporu") {
    return (await import("@/lib/hapbi/aracMotorlari/eclub")).eclubAraciniCalistir;
  }
  return null;
}

export function hapbiAraclariniOlustur(db: SupabaseClient, kullanici: HapbiKullaniciBaglami, simdi = new Date()) {
  const baglam = aracBaglamiOlustur(db, kullanici, simdi);
  return {
    takvim: aktifPeriyot(simdi),
    async calistir(ad: string, parametre: unknown): Promise<HapbiAracSonucu> {
      try {
        const a = nesne(parametre);
        const calistir = await calistiriciyiYukle(ad);
        if (!calistir) return { durum: "desteklenmiyor", aciklama: "Bu araç mevcut değil." };
        return await calistir(baglam, ad, a);
      } catch {
        return { durum: "hata", aciklama: "Parametre veya veri kaynağı doğrulanamadı. Bu sonuç sıfır puan, birincilik veya tamamlandı anlamına gelmez." };
      }
    },
  };
}
