// app/talepler/_components/AksiyonSeridi.tsx
//
// Üreticinin karar şeridi: Onayla / Revizyon İste / İptal Et.
//
// Bugün bu üç düğme üç ayrı sayfada duruyor (senaryolar, videolar, soru-setleri).
// Burada TEK yerde: hangi adım aktifse karar oraya gider. Kullanıcı "şimdi benden
// ne bekleniyor" sorusunu tek noktaya bakarak yanıtlar.
//
// Üç kural mevcut sistemden aynen taşınır (S-4) ve GİRDİDE uygulanır — sunucunun
// reddetmesini beklemek yerine düğme hiç çizilmez:
//   1. Revizyon notu zorunlu (boşken gönderilemez)
//   2. Revizyon tavanı 2 (dolduysa düğme yok)
//   3. Karar yalnız talebi açan üreticide (Ç-7)

"use client";

import { useState } from "react";
import type { ToastAsama } from "@/lib/uretim/toastMesaj";
import type { KararDurumu } from "../_hooks/useTalepMerkezi";

/** Revizyon hakkı tavanı — sunucudaki kuralın ekran karşılığı. */
const REVIZYON_TAVANI = 2;

interface Props {
  /** Karar verilebilecek aktif adım. null ise karar sırası üreticide değil. */
  hedef: { asama: ToastAsama; id: string; revizyonSayisi: number } | null;
  yukleniyor: boolean;
  onKarar: (durum: KararDurumu, notlar?: string) => void;
}

export function AksiyonSeridi({ hedef, yukleniyor, onKarar }: Props) {
  const [revizyonAcik, setRevizyonAcik] = useState(false);
  const [not, setNot] = useState("");

  // Karar sırası üreticide değilse hiçbir şey çizilmez (İskender 28.07): boşluğu
  // ilan eden satır kaldırıldı — top'un kimde olduğunu aktif adımın pill'i söylüyor.
  if (!hedef) return null;

  const revizyonHakkiVar = hedef.revizyonSayisi < REVIZYON_TAVANI;

  const kapat = () => { setRevizyonAcik(false); setNot(""); };

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      {revizyonAcik ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={not}
            onChange={(e) => setNot(e.target.value)}
            placeholder="Revizyon notunu yazın..."
            rows={3}
            className="w-full border border-yellow-200 rounded-lg px-3 py-2 text-sm resize-y outline-none focus:border-yellow-400"
            style={{ fontFamily: "'Nunito', sans-serif" }}
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={kapat}
              className="px-3 py-1.5 rounded-lg border border-gray-200 bg-transparent text-gray-500 text-xs cursor-pointer"
              style={{ fontFamily: "'Nunito', sans-serif" }}
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={() => { onKarar("revizyon bekleniyor", not); kapat(); }}
              disabled={!not.trim() || yukleniyor}
              className="px-3 py-1.5 rounded-lg border-none bg-amber-500 text-white text-xs font-semibold cursor-pointer"
              style={{ opacity: !not.trim() || yukleniyor ? 0.5 : 1, fontFamily: "'Nunito', sans-serif" }}
            >
              Revizyon Gönder
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 justify-end flex-wrap">
          <button
            type="button"
            onClick={() => onKarar("onaylandi")}
            disabled={yukleniyor}
            className="px-3 py-1.5 rounded-lg border-none bg-green-700 text-white text-xs font-semibold cursor-pointer"
            style={{ fontFamily: "'Nunito', sans-serif" }}
          >
            Onayla
          </button>
          {revizyonHakkiVar && (
            <button
              type="button"
              onClick={() => setRevizyonAcik(true)}
              disabled={yukleniyor}
              className="px-3 py-1.5 rounded-lg border-none bg-amber-500 text-white text-xs font-semibold cursor-pointer"
              style={{ fontFamily: "'Nunito', sans-serif" }}
            >
              Revizyon İste
            </button>
          )}
          <button
            type="button"
            onClick={() => onKarar("Iptal Edildi")}
            disabled={yukleniyor}
            className="px-3 py-1.5 rounded-lg bg-transparent text-xs font-semibold cursor-pointer"
            style={{ border: "0.5px solid #fecaca", color: "#bc2d0d", fontFamily: "'Nunito', sans-serif" }}
          >
            İptal Et
          </button>
        </div>
      )}
    </div>
  );
}
