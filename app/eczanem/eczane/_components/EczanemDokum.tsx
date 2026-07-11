// app/eczanem/eczane/_components/EczanemDokum.tsx
// Eczacı işlem dökümü (U9, İP-§9.2): kendi eczanesinin ürün bazında toplam
// kutu + indirim TL'si — aylık mutabakatın eczane tarafındaki karşılığı
// (İP-§10.1). Müşteri bilgisi bu bölümde YOKTUR (toplam görünür, kişi gizli).

"use client";

import { useCallback, useEffect, useState } from "react";
import { PERIYOTLAR, Periyot } from "@/lib/utils/raporUtils";

interface UrunSatir {
  urun_id: string;
  urun_adi: string;
  kutu: number;
  indirim_tl: number;
}
interface Dokum {
  satirlar: UrunSatir[];
  toplam_kutu: number;
  toplam_tl: number;
}

interface Props {
  hata: (mesaj: string, adim?: string) => void;
}

export default function EczanemDokum({ hata }: Props) {
  const [periyot, setPeriyot] = useState<Periyot>("bu_ay");
  const [dokum, setDokum] = useState<Dokum | null>(null);

  const cek = useCallback(async () => {
    try {
      const res = await fetch(`/eczanem/eczane/api/dokum?periyot=${periyot}`);
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Döküm yüklenemedi.", "döküm"); return; }
      setDokum(d);
    } catch { hata("Döküm yüklenemedi.", "döküm"); }
  }, [hata, periyot]);

  useEffect(() => { cek(); }, [cek]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-semibold text-gray-700">İşlem Dökümü</div>
        <div className="flex gap-1">
          {PERIYOTLAR.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriyot(p.key)}
              className="px-2 py-0.5 rounded-full text-[11px] border transition"
              style={{
                background: periyot === p.key ? "#b45309" : "transparent",
                color: periyot === p.key ? "#fff" : "#6b7280",
                borderColor: periyot === p.key ? "#b45309" : "#e5e7eb",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="text-xs text-gray-500 mb-4">
        Onaylanan siparişlerin ürün bazında toplamı — firma mutabakatının eczane tarafı.
      </div>

      {!dokum || dokum.satirlar.length === 0 ? (
        <div className="text-sm text-gray-400">Bu dönemde onaylanmış işlem yok.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-100">
              <th className="text-left font-medium py-1.5">Ürün</th>
              <th className="text-right font-medium py-1.5">Kutu</th>
              <th className="text-right font-medium py-1.5">İndirim (TL)</th>
            </tr>
          </thead>
          <tbody>
            {dokum.satirlar.map((s) => (
              <tr key={s.urun_id} className="border-b border-gray-50">
                <td className="py-2 text-gray-800">{s.urun_adi}</td>
                <td className="py-2 text-right text-gray-700">{s.kutu}</td>
                <td className="py-2 text-right text-gray-700">{s.indirim_tl.toFixed(2)}</td>
              </tr>
            ))}
            <tr>
              <td className="py-2 font-semibold text-gray-800">Toplam</td>
              <td className="py-2 text-right font-semibold" style={{ color: "#b45309" }}>{dokum.toplam_kutu}</td>
              <td className="py-2 text-right font-semibold" style={{ color: "#b45309" }}>{dokum.toplam_tl.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
