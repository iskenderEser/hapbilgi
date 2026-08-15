// app/talepler/_components/YeniTalepAkordiyonu.tsx
//
// Talep açma da bu sayfada: kullanıcı talep oluşturmak için başka bir ekrana
// gitmiyor. Akordiyon kapalı başlar, çağrılınca açılır.
//
// KURALLAR KOPYALANMAZ: useTalepFormu aynen kullanılır — hedef rol kapısı,
// tür-ürün-teknik zorunlulukları, Eczanem dörtlü kilidi, hazır set parametre
// kilidi ve dört varyantlı onay modalı o hook'ta yaşar, dokunulmadı.
// Yerleşim YeniTalepFormV2 içinde, kurallar ise useTalepFormu'nda tek kaynaktır.
//
// TALEP OLUŞTUĞUNU NASIL ANLIYORUZ: paylaşılan hook'ta "talep oluşturuldu"
// bildirimi yok ve o dosyaya dokunulmuyor. Form kendi listesini tazelediği için
// talep sayısı ARTIYOR; ilk yükleme temel alınır, sonraki artış yeni talep
// sayılır. Talepler silinmediğinden bu güvenilir bir sinyaldir.

"use client";

import { useCallback, useState } from "react";
import { useTalepFormu } from "@/app/(panel)/talepler/_hooks/useTalepFormu";
import { HataMesajiContainer } from "@/components/HataMesaji";
import { YeniTalepFormV2 } from "./YeniTalepFormV2";

interface Props {
  /** Yeni talep açıldığında: v2 listesini tazele ve yeni talebi seç. */
  onTalepOlusturuldu: () => void;
}

export function YeniTalepAkordiyonu({ onTalepOlusturuldu }: Props) {
  const [acik, setAcik] = useState(false);
  const talepOlustu = useCallback(async () => {
    setAcik(false);
    await onTalepOlusturuldu();
  }, [onTalepOlusturuldu]);
  const formu = useTalepFormu(talepOlustu);

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

    <div className="overflow-hidden rounded-2xl border border-[#dce7f4] bg-white shadow-[0_10px_30px_rgba(31,55,90,0.05)]">
      <button
        type="button"
        aria-expanded={acik}
        aria-controls="yeni-talep-formu"
        onClick={() => setAcik((a) => !a)}
        className="group flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-[#f8fbff] md:px-5"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf4ff] text-[#2483e2] transition-colors group-hover:bg-[#ddecff]">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-extrabold text-[#203653]">Yeni İçerik Talebi</span>
            <span className="mt-0.5 block text-xs leading-4 text-[#7487a2]">
              Hedef kitlenizi ve üretim ihtiyacınızı tanımlayın.
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-bold text-[#3989d7]">
          <span className="hidden sm:inline">{acik ? "Formu kapat" : "Talep oluştur"}</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4 transition-transform duration-200"
            style={{ transform: acik ? "rotate(180deg)" : "none" }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {acik && (
        <div id="yeni-talep-formu" className="border-t border-[#e8eef6] bg-[#fbfdff] p-4 md:p-5">
          <YeniTalepFormV2 formu={formu} />
        </div>
      )}
    </div>
    </>
  );
}
