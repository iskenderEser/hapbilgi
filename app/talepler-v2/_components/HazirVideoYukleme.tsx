// app/talepler-v2/_components/HazirVideoYukleme.tsx
//
// Hazır video kolunda (V2/V4) üreticinin videoyu yüklediği alan — Video adımının
// kutusunda yaşar. Bugün bunun için /talepler/[talep_id] detay sayfasına gitmek
// gerekiyor; burada talep sayfasından çıkmadan yapılıyor.
//
// DOSYA SEÇİMİ VE YÜZDE ÇUBUĞU ORTAK BİLEŞENDEN (28.07 düzeltmesi):
// bir süre burada elle yazılıydı — aynı upload ikonu, aynı çubuk, aynı
// "Bunny'ye yükleniyor" metni ikinci kez yazılmış oluyordu. Artık /talepler
// formuyla AYNI VideoYukleme bileşeni çağrılıyor; kabul edilen dosya türleri de
// oradan geliyor (eskiden burada `video/*` idi, sistemin listesiyle uyumsuzdu).
//
// Burada kalan iki şey bu ekrana özeldir ve ortak bileşende yoktur:
//   1. bilgi satırı,
//   2. "Bunny'ye Yükle" düğmesi — talep formunda gönderim form submit'iyle
//      başlar, burada ayrı bir tetik gerekiyor.
//
// Yükleme mantığı burada DEĞİL, hook'ta (useTalepMerkezi.hazirVideoYukle):
// dosya tarayıcıdan doğrudan Bunny'ye gider.

"use client";

import { useState } from "react";
import { VideoYukleme } from "@/app/talepler/_components/VideoYukleme";
import type { BekleyenDosya } from "@/app/talepler/_types";

interface Props {
  /** null değilse yükleme sürüyor demektir. */
  yuzde: number | null;
  onYukle: (dosya: File) => void;
}

export function HazirVideoYukleme({ yuzde, onYukle }: Props) {
  const [bekleyen, setBekleyen] = useState<BekleyenDosya | null>(null);
  const yukleniyor = yuzde !== null;

  // Ortak bileşenin sözleşmesi dosya + önizleme künyesidir; şekil talep
  // formundaki handleVideoSec ile birebir aynı tutulur.
  const handleSec = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dosya = e.target.files?.[0];
    if (!dosya) return;
    setBekleyen({
      dosya,
      preview: {
        dosya_adi: dosya.name,
        url: "",
        boyut: dosya.size,
        yuklenme_tarihi: new Date().toISOString(),
      },
    });
  };

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-sm text-gray-500 m-0">
        Hazır video talebi — video henüz yüklenmedi.
      </p>

      <VideoYukleme
        bekleyen={bekleyen}
        onSec={handleSec}
        onSil={() => setBekleyen(null)}
        yuklemeYuzdesi={yuzde}
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => bekleyen && onYukle(bekleyen.dosya)}
          disabled={!bekleyen || yukleniyor}
          className="text-white border-none rounded-lg px-5 py-2 text-xs font-semibold cursor-pointer"
          style={{
            background: "#56aeff",
            opacity: !bekleyen || yukleniyor ? 0.5 : 1,
            fontFamily: "'Nunito', sans-serif",
          }}
        >
          {yukleniyor ? `Yükleniyor... %${yuzde}` : "Bunny'ye Yükle"}
        </button>
      </div>
    </div>
  );
}
