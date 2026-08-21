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
//
// ORAN NEREDEN GELİYOR — KAPAKTAN ÖLÇÜLÜYOR (Adım 0 kararı, 26.07):
// Bunny'nin thumbnail.jpg dosyası videonun GERÇEK oranında üretiliyor; sabit bir
// kutuya doldurulmuyor. 30022 numaralı talebin dikey test videosunda ölçüldü:
// kapak 720×1280, Bunny API'sinin bildirdiği width/height de 720×1280 — birebir.
// Bu yüzden oran için DB kolonu, webhook ya da sunucu değişikliği GEREKMİYOR;
// kutu kapağı okuyarak kendi oranını buluyor. (Yol A — plan 10 adımdan 6'ya indi.)
//
// Video URL'i doğrudan ölçülemez: o bir HTML embed sayfasıdır, `Image` yükleyemez;
// cross-origin iframe içeriği de CSS'e ya da JS'e hiçbir koşulda sızmaz. Ölçülebilir
// tek şey kapak görselidir.
//
// BİLİNEN ÖDÜN: ilk çizimde oran henüz bilinmediği için 16:9 kutu çizilir, kapak
// yüklenince dikey videoda kutu bir kez yeniden boyutlanır. Kapak küçük (~60 KB) ve
// kart ekranlarında zaten önbellekte olduğu için pratikte tek karelik sıçrama.

"use client";

import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { enBoyOrani, dikeyMi } from "@/lib/video/enBoyOrani";
import { thumbnailUrlUret } from "@/lib/video/thumbnail";

interface Props {
  /** Oynatılan videonun adresi. Ölçü verilmemişse kapağı buradan bulunup ölçülür. */
  videoUrl?: string | null;
  /** Videonun ham ölçüleri. Verilirse kapak ölçümü hiç yapılmaz (öncelikli kaynak). */
  genislik?: number | null;
  yukseklik?: number | null;
  /** Oynatıcı iframe'i. Çağıran sahiplenir (ref, playerjs, sandbox nitelikleri onda kalır). */
  children: React.ReactNode;
  /** Kutunun görünüm sınıfları (kenarlık, köşe yuvarlama…). İframe'in ÜZERİNDEKİ
   *  böyle sınıflar buraya taşınmalıdır: [&>iframe]:border-0 kuralı iframe'in kendi
   *  kenarlığını siler, kutuda ise overflow-hidden sayesinde köşe de doğru kırpılır. */
  className?: string;
  /** Cross-origin iframe'in üstünde çalışan ortak ilk oynatma yüzeyi. İframe'in
   *  iç CSS'ine erişilemediği için parmak imleci ve ilk oynatma bu katmanda
   *  çözülür; oynatma başlayınca çağıran katmanı kapatır. */
  etkilesimKatmani?: {
    ariaLabel: string;
    onClick: () => void;
    /** İlk oynatmayı tüm yüzeye değil yalnızca görünür Play düğmesine bağlar. */
    yalnizPlayButonu?: boolean;
  } | null;
}

/** İframe'in kutuyu doldurmasını garantileyen ortak sınıflar. */
const IFRAME_DOLDUR = "[&>iframe]:block [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:border-0";

/**
 * Dikey/masaüstü ölçüsü. Tavan `min(78vh,720px)`: 26.07'de ölçülen ilk halde
 * 560 px'lik tavan, 815 px yükseklikli bir ekranda videoyu gereksiz küçük
 * bırakıyordu (İskender kararı — yükseltildi). vh payı, tarayıcı çubuklarıyla
 * birlikte videonun ekrandan taşmamasını garantiler.
 *
 * NOT: Tailwind sınıf adlarını kaynakta BİREBİR tarar; bu metin şablon
 * değişkeniyle kurulursa sınıf hiç üretilmez. Bu yüzden tam sınıf dizisi sabit
 * olarak durur, parça parça birleştirilmez.
 */
const DIKEY_OLCU = "w-full md:w-auto md:h-[min(78vh,720px)] md:mx-auto";

/**
 * Dikey videoda kutunun yanında kalan boşluğun zemini (pillarbox).
 *
 * Neden: kart/modal 16:9 için ölçülmüştür; dikey video yanlarında geniş boşluk
 * bırakır (ölçüldü: 768 px'lik modalda video 316 px, yanlarda 226'şar px). Bu
 * boşluk beyaz kalınca "eksik yüklenmiş" gibi okunuyordu; koyu zemin onu
 * oynatıcı letterbox'ına çevirir — YouTube/Vimeo davranışı.
 *
 * YALNIZ DİKEYDE uygulanır: yatay videoda kutu kabı zaten tamamen doldurur,
 * zemin hiç görünmez. Koşulsuz verilseydi bile görünmezdi ama niyet okunmazdı.
 */
const PILLARBOX = "bg-gray-900";

export default function VideoCercevesi({
  videoUrl,
  genislik,
  yukseklik,
  children,
  className = "",
  etkilesimKatmani = null,
}: Props) {
  const [olculen, setOlculen] = useState<{ videoUrl: string | null; g: number; y: number } | null>(null);

  useEffect(() => {
    // Ölçü dışarıdan geldiyse kapağa hiç gidilmez.
    if (genislik && yukseklik) return;

    const kapak = thumbnailUrlUret(videoUrl);
    if (!kapak) return; // Bunny dışı / eski / bozuk URL → 16:9 yedeği

    let aktif = true;
    const img = new Image();
    img.onload = () => {
      // 0 ölçü gelirse yazma: enBoyOrani zaten yakalar ama state'i kirletmenin anlamı yok.
      if (aktif && img.naturalWidth > 0 && img.naturalHeight > 0) {
        setOlculen({ videoUrl: videoUrl ?? null, g: img.naturalWidth, y: img.naturalHeight });
      }
    };
    // onerror bilinçli olarak boş: kapak 403/404 olsa da 16:9 yedeği zaten devrede.
    img.src = kapak;

    return () => { aktif = false; }; // unmount sonrası setState yarışını kapatır
  }, [videoUrl, genislik, yukseklik]);

  // Önceki URL'nin geç tamamlanan kapak ölçümü yeni videonun oranına taşınmaz.
  const gecerliOlcum = olculen?.videoUrl === (videoUrl ?? null) ? olculen : null;
  const oran = enBoyOrani(genislik ?? gecerliOlcum?.g, yukseklik ?? gecerliOlcum?.y);
  const dikey = dikeyMi(oran);

  // Dikey/masaüstü: yükseklik tavana sabitlenir, genişliği oran türetir (mx-auto ortalar).
  // Dikey/mobil ve tüm yatay: tam genişlik, yüksekliği oran türetir.
  const olcuSiniflari = dikey ? DIKEY_OLCU : "w-full";

  return (
    <div className={`flex justify-center w-full ${dikey ? PILLARBOX : ""}`}>
      <div
        className={`relative overflow-hidden max-w-full ${IFRAME_DOLDUR} ${olcuSiniflari} ${className}`}
        style={{ aspectRatio: oran }}
      >
        {children}
        {etkilesimKatmani?.yalnizPlayButonu ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#10233a]/20">
            <button
              type="button"
              onClick={etkilesimKatmani.onClick}
              aria-label={etkilesimKatmani.ariaLabel}
              data-etkilesimli="true"
              className="flex size-14 items-center justify-center rounded-full border-0 bg-[#10233a]/80 text-white shadow-lg transition hover:scale-105 hover:bg-[#10233a]/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Play className="ml-0.5 size-6 fill-current" />
            </button>
          </div>
        ) : etkilesimKatmani ? (
          <button
            type="button"
            onClick={etkilesimKatmani.onClick}
            aria-label={etkilesimKatmani.ariaLabel}
            data-etkilesimli="true"
            className="absolute inset-0 z-10 border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#56aeff]"
          />
        ) : null}
      </div>
    </div>
  );
}
