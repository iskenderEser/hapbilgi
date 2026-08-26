import { alanlariDogrula } from "@/lib/hapbi/sozlesme";
import { bilgiyiBul, BILGI_SURUMU } from "@/lib/hapbi/bilgiKaynaklari";
import type { HapbiAlanCalistirici } from "@/lib/hapbi/aracMotorlari/ortak";

export const platformAraciniCalistir: HapbiAlanCalistirici = async (baglam, _ad, a) => {
  alanlariDogrula(a, ["konu"]);
  const bilgiler = bilgiyiBul(String(a.konu));
  if (!bilgiler.length) throw new Error("Geçersiz bilgi konusu.");
  const { kullanici } = baglam;
  return {
    durum: "ok",
    kaynak: baglam.kaynak("HapBilgi rehberi", kullanici.kimlik_turu === "kullanici" ? bilgiler[0].url : kullanici.kimlik_turu === "musteri" ? "/eczanem" : "/eclub/panel"),
    veri: { surum: BILGI_SURUMU, bilgiler: bilgiler.map(b => ({ baslik: b.baslik, metin: b.metin })) },
  };
};
