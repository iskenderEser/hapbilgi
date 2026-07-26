// components/video/VideoCercevesi.tsx
//
// VİDEO OYNATICI ÇERÇEVESİ — oranı bilinen videoyu doğru kutuya oturtan tek yer (26.07).
//
// Neden: sekiz oynatıcı yüzeyi videoyu sabit yükseklikli kutuya sokuyordu
// (height="400" | "450" | "360" | "320"). Dikey video kaybolmuyor ama yatay
// kutunun ortasında avuç içi kadar kalıyordu. Kutu artık videonun oranına göre
// çiziliyor.
//
// KRİTİK TASARIM KARARI — İFRAME'İ BU BİLEŞEN SAHİPLENMEZ, `children` ALIR.
// components/izle/VideoOynatici.tsx ve components/challenge-club/CcVideoOynatici.tsx
// iframe'e `ref` bağlayıp lib/video/videoPlayer.ts üzerinden playerjs ile
// konuşuyor: izleme takibi, ileri sarma denetimi, bitiş tespiti oradan yürüyor.
// Sarmalayıcı iframe'i kendi üretseydi o zincir kopardı. Bu yüzden çerçeve
// yalnız KUTUYU kurar; iframe'i çağıran verir, ref'i çağıranda kalır.
//
// İframe'in kutuyu doldurması CSS ile GARANTİ altındadır
// ([&>iframe]:w-full/h-full): çağıranın üzerinde kalmış eski bir height="400"
// niteliği kutuyu bozmaz. Taşıma sırasında sessiz kırılma olmaması için.
//
// DİKEY DAVRANIŞI (İskender kararı 26.07): masaüstünde ORTALANIR ve yükseklik
// tavanına oturur — tavansız bırakılırsa uzun bir dikey video sayfayı aşağı
// doğru uzatır. Mobilde tavan yoktur; dar ekranda dikey video zaten tam
// genişliğe oturur, tavan orada gereksiz kısıt olurdu.
//
// Ortalama iki katmanlı: dış kapta `justify-center`, kutuda `mx-auto`.
// margin-auto tek başına, kutunun genişliği tavandan türediği için her yerleşim
// bağlamında güvenilir değil; flex ortalaması garantiyi tamamlar.

"use client";

import { enBoyOrani, dikeyMi } from "@/lib/video/enBoyOrani";

interface Props {
  /** Videonun ham ölçüleri. Bilinmiyorsa 16:9'a düşer — mevcut videoların davranışı. */
  genislik?: number | null;
  yukseklik?: number | null;
  /** Oynatıcı iframe'i. Çağıran sahiplenir (ref, playerjs, sandbox nitelikleri onda kalır). */
  children: React.ReactNode;
}

/** İframe'in kutuyu doldurmasını garantileyen ortak sınıflar. */
const IFRAME_DOLDUR = "[&>iframe]:block [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:border-0";

export default function VideoCercevesi({ genislik, yukseklik, children }: Props) {
  const oran = enBoyOrani(genislik, yukseklik);
  const dikey = dikeyMi(oran);

  // Dikey/masaüstü: yükseklik tavana sabitlenir, genişliği oran türetir (mx-auto ortalar).
  // Dikey/mobil ve tüm yatay: tam genişlik, yüksekliği oran türetir.
  const olcuSiniflari = dikey
    ? "w-full md:w-auto md:h-[min(70vh,560px)] md:mx-auto"
    : "w-full";

  return (
    <div className="flex justify-center w-full">
      <div
        className={`relative overflow-hidden max-w-full ${IFRAME_DOLDUR} ${olcuSiniflari}`}
        style={{ aspectRatio: oran }}
      >
        {children}
      </div>
    </div>
  );
}
