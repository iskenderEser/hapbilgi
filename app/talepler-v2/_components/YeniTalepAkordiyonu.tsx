// app/talepler-v2/_components/YeniTalepAkordiyonu.tsx
//
// Talep açma da bu sayfada: kullanıcı talep oluşturmak için başka bir ekrana
// gitmiyor. Akordiyon kapalı başlar, çağrılınca açılır.
//
// KURALLAR KOPYALANMAZ: useTalepFormu aynen kullanılır — hedef rol kapısı,
// tür-ürün-teknik zorunlulukları, Eczanem dörtlü kilidi, hazır set parametre
// kilidi ve dört varyantlı onay modalı o hook'ta yaşar, dokunulmadı.
// YERLEŞİM ise v2'ye özeldir (YeniTalepFormV2, dört sütun — İskender kararı
// 28.07): ortak YeniTalepForm değiştirilseydi /talepler sayfası da değişirdi.
//
// TALEP OLUŞTUĞUNU NASIL ANLIYORUZ: paylaşılan hook'ta "talep oluşturuldu"
// bildirimi yok ve o dosyaya dokunulmuyor. Form kendi listesini tazelediği için
// talep sayısı ARTIYOR; ilk yükleme temel alınır, sonraki artış yeni talep
// sayılır. Talepler silinmediğinden bu güvenilir bir sinyaldir.

"use client";

import { useEffect, useRef, useState } from "react";
import { useTalepFormu } from "@/app/(panel)/talepler/_hooks/useTalepFormu";
import { HataMesajiContainer } from "@/components/HataMesaji";
import { YeniTalepFormV2 } from "./YeniTalepFormV2";

interface Props {
  /** Yeni talep açıldığında: v2 listesini tazele ve yeni talebi seç. */
  onTalepOlusturuldu: () => void;
}

export function YeniTalepAkordiyonu({ onTalepOlusturuldu }: Props) {
  const formu = useTalepFormu();
  const [acik, setAcik] = useState(false);
  const oncekiSayi = useRef<number | null>(null);

  useEffect(() => {
    // İlk yükleme bitmeden sayım anlamlı değil (0 → N sıçraması yeni talep değildir).
    if (formu.loading) return;
    const sayi = formu.talepler.length;
    if (oncekiSayi.current === null) {
      oncekiSayi.current = sayi;
      return;
    }
    if (sayi > oncekiSayi.current) {
      setAcik(false);
      onTalepOlusturuldu();
    }
    oncekiSayi.current = sayi;
  }, [formu.loading, formu.talepler, onTalepOlusturuldu]);

  if (!formu.isUretici) return null;

  return (
    <>
    {/* Formun kendi mesajları (useTalepFormu içindeki useHataMesaji) — sayfadaki
        kapsayıcı useTalepMerkezi'nin mesajlarını basıyor, bu hook'unkileri değil.
        Bu yüzden "Ürün seçimi zorunludur." gibi doğrulama uyarıları ve talep
        gönderim bildirimleri ekrana hiç çıkmıyordu (A-12 Faz 1 madde 2 bulgusu).
        Akordiyon gövdesinin DIŞINDA: talep oluşunca akordiyon kapanıyor, mesaj
        içeride olsaydı başarı bildirimi kapanışla birlikte kaybolurdu. */}
    <HataMesajiContainer mesajlar={formu.mesajlar} />

    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div
        onClick={() => setAcik((a) => !a)}
        className="px-5 py-4 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-900">Yeni Talep Oluştur</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#6b7280"
          strokeWidth="2"
          width="16"
          height="16"
          className="transition-transform duration-200 flex-shrink-0"
          style={{ transform: acik ? "rotate(180deg)" : "none" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      {acik && (
        <div className="border-t border-gray-100 p-4 md:p-5">
          <YeniTalepFormV2 formu={formu} />
        </div>
      )}
    </div>
    </>
  );
}
