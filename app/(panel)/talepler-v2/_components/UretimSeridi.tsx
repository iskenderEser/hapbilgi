// app/talepler-v2/_components/UretimSeridi.tsx
//
// ÜRETİM ŞERİDİ — sayfanın omurgası.
//
// Talep → Senaryo → Video → Soru Seti → Yayın. Beş adım her talepte çizilir; o
// üretim yönteminde hiç üretilmeyecek adımlar kırmızı ve işleme kapalı gelir
// (S-1). Kullanıcı hangi yöntemi seçerse seçsin sürecin tamamını görür.
//
// Hal hesabı burada YAPILMAZ — lib/utils/uretimSeridi.ts'ten hazır gelir. İçerik
// de burada üretilmez: adımın kutusunu çağıran çizer (icerikCiz). Bu dosya yalnız
// şeridin kendisini ve aç/kapa davranışını sahiplenir.
//
// Durum metinleri sözlükten (DurumPill) okunur. Burada sabit yazılan iki metin
// var ve ikisinin de sözlükte karşılığı YOKTUR — biri henüz başlamamış, diğeri
// hiç başlamayacak işin hâli.

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Pill, DurumPill, NOTR_RENK } from "@/components/pill";
import type { Adim, AdimAnahtari } from "@/lib/utils/uretimSeridi";

/** Sırası gelmemiş adım — sözlükte karşılığı yok (henüz başlamamış iş). */
const BEKLENIYOR = "Bekleniyor";
/** Bu varyantta İÜ'nün üretmeyeceği adım — sistem geçiriyor (S-1). */
const ASAMA_GECILDI = "Bu aşama geçildi";
/** Aksiyon kırmızısı — kapalı adımın rengi (İskender 28.07). */
const KAPALI_RENK = { bg: "#fff1f0", metin: "#bc2d0d", kenar: "#fecaca" };

interface Props {
  adimlar: Adim[];
  rol: string;
  formatTarih: (tarih: string | null) => string;
  /** Adımın açılınca görünecek içeriği. null dönerse kutu hiç çizilmez. */
  icerikCiz: (anahtar: AdimAnahtari) => ReactNode;
  /** Şerit hangi talebe ait — talep değişince açık kutu aktif adıma sıfırlanır. */
  talepId: string;
}

function daireStili(hal: Adim["hal"]): React.CSSProperties {
  switch (hal) {
    case "tamam":
      return { background: "#16a34a", borderColor: "#16a34a" };
    case "aktif":
      return { background: "#fff", borderColor: "#bc2d0d", boxShadow: "0 0 0 3px rgba(188,45,13,0.14)" };
    case "kapali":
      return { background: "#fecaca", borderColor: "#bc2d0d" };
    default:
      return { background: "#fff", borderColor: "#e5e7eb" };
  }
}

export function UretimSeridi({ adimlar, rol, formatTarih, icerikCiz, talepId }: Props) {
  const router = useRouter();

  // E-4: yalnız AKTİF adımın kutusu açık gelir; tamamlananlar kapalı başlar.
  const aktifAnahtar = adimlar.find((a) => a.hal === "aktif")?.anahtar ?? null;
  const [acik, setAcik] = useState<AdimAnahtari | null>(aktifAnahtar);

  // Başka bir talep seçilince açık kutu yeni talebin aktif adımına döner.
  useEffect(() => {
    setAcik(aktifAnahtar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talepId]);

  return (
    <div className="flex flex-col">
      {adimlar.map((adim, i) => {
        const sonuncu = i === adimlar.length - 1;
        // Kapalı adım hiçbir koşulda açılmaz (S-1). Yayına alma bu sayfaya
        // taşınmadı; Yayın adımı kendi sayfasına götürür (D-3).
        const yolaGider = !!adim.yol && adim.hal !== "kapali";
        const acilabilir = adim.hal !== "kapali" && !adim.yol;
        const icerik = acilabilir && acik === adim.anahtar ? icerikCiz(adim.anahtar) : null;

        const tikla = () => {
          if (yolaGider) router.push(adim.yol!);
          else if (acilabilir) setAcik((o) => (o === adim.anahtar ? null : adim.anahtar));
        };

        return (
          <div key={adim.anahtar} className="flex gap-3">
            {/* Daire + bağlantı çizgisi */}
            <div className="flex flex-col items-center w-4 flex-shrink-0">
              <span
                className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5 border-2 transition-all"
                style={daireStili(adim.hal)}
              />
              {!sonuncu && (
                <span
                  className="w-0.5 flex-1 my-1"
                  style={{ background: adim.hal === "tamam" ? "#bbf7d0" : "#e5e7eb" }}
                />
              )}
            </div>

            {/* Gövde */}
            <div className={`min-w-0 flex-1 ${sonuncu ? "" : "pb-4"}`}>
              <div
                onClick={yolaGider || acilabilir ? tikla : undefined}
                className={`flex items-center gap-2 flex-wrap ${yolaGider || acilabilir ? "cursor-pointer" : "cursor-default"}`}
              >
                <span
                  className="text-sm font-bold"
                  style={{ color: adim.hal === "ileri" ? "#9ca3af" : adim.hal === "kapali" ? "#bc2d0d" : "#111827" }}
                >
                  {adim.etiket}
                </span>

                {adim.hal === "kapali" ? (
                  <Pill renk={KAPALI_RENK}>{ASAMA_GECILDI}</Pill>
                ) : adim.hal === "ileri" ? (
                  <Pill renk={NOTR_RENK}>{BEKLENIYOR}</Pill>
                ) : adim.durum_kodu ? (
                  <DurumPill kod={adim.durum_kodu} rol={rol} tarih={adim.tarih} />
                ) : null}

                {adim.tarih && adim.hal !== "kapali" && (
                  <span className="text-xs text-gray-400">{formatTarih(adim.tarih)}</span>
                )}
              </div>

              {icerik && (
                <div className="mt-2 border border-gray-200 rounded-xl bg-gray-50 px-3.5 py-3">
                  {icerik}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
