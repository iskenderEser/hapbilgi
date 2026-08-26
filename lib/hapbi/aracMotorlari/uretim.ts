import { alanlariDogrula } from "@/lib/hapbi/sozlesme";
import { ligPeriyoduAraligi } from "@/lib/zaman/kontrol";
import { getUretimData, uretimRaporunuGorebilir } from "@/lib/rapor/uretim/getUretimData";
import { guvenliSatirlar, PERIYOT_ALANLARI, periyoduDogrula, reddet, type HapbiAlanCalistirici } from "@/lib/hapbi/aracMotorlari/ortak";

export const uretimAraciniCalistir: HapbiAlanCalistirici = async (baglam, _ad, a) => {
  alanlariDogrula(a, PERIYOT_ALANLARI);
  const p = periyoduDogrula(a);
  const aralik = ligPeriyoduAraligi(p);
  const { db, kullanici: k } = baglam;
  if (k.kimlik_turu !== "kullanici" || !k.firma_id || !uretimRaporunuGorebilir(k.rol)) return reddet();
  const rapor = await getUretimData(db, k, aralik.baslangic, aralik.bitis);
  return {
    durum: "ok", kaynak: baglam.kaynak("Üretim Raporları · firma portföyü", "/raporlar/uretim", p),
    veri: { aralik, kapsam: "kendi firmasının üretim portföyü",
      uretim: { toplam_yayina_alma: rapor.uretim.toplam_yayina_alma,
        donemde_yayina_alinan: rapor.uretim.donemde_yayina_alinan, su_an_yayinda: rapor.uretim.su_an_yayinda,
        donemde_yayina_alinan_turleri: rapor.uretim.turler,
        donemde_yayina_alinan_varyantlari: rapor.uretim.varyantlar,
        canli_yayin_varyant_dagilimi: null },
      egitim_turu_etkisi: rapor.egitim_turu_etkisi.map(tur => ({
        ...guvenliSatirlar([tur], ["egitim_turu", "egitim_adi", "donemde_yayina_alinan", "tamamlanan_izleme", "kazanilan_toplam", "kaybedilen_toplam", "net_puan", "begeni_sayisi", "favori_sayisi", "extra_izleme_sayisi"])[0],
        urun_dagilimi: guvenliSatirlar(tur.urun_dagilimi, ["urun_adi", "kazanilan_toplam", "kaybedilen_toplam", "net_puan"]),
        toplam_urun: tur.urun_dagilimi.length,
      })),
      not: "Şirket portföyü kişisel talep/takım raporu değildir. donemde_yayina_alinan dönem hareketi, su_an_yayinda anlık stok, toplam_yayina_alma tarihsel toplamdır. Varyant adetleri yalnız dönemde yayına alınanlara aittir; canlıdaki yayınların dağılımı bilinmiyor. Bir dönem varyantının sıfır olması o varyantta hiç canlı yayın olmadığı anlamına gelmez. Saha izleme/puanı önceki dönem yayınlarından da gelebilir; yeni yayınların sebep olduğu başarı diye anlatma. Ürün listeleri tür başına en çok 40 satırdır; kesik listeyi toplama." },
  };
};
