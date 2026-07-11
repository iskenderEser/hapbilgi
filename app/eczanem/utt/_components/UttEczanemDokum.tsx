// app/eczanem/utt/_components/UttEczanemDokum.tsx
// UTT mutabakat dökümü (U9, İP-§9.2, §10.1): listesindeki eczanelerin
// eczane×ürün toplamları (kutu + indirim TL) — aylık firma-eczane
// mutabakatının sistem dayanağı. Müşteri bilgisi (son-4-hane dahil) YOKTUR.

"use client";

import { useCallback, useEffect, useState } from "react";
import { PERIYOTLAR, Periyot } from "@/lib/utils/raporUtils";

interface UrunSatir { urun_id: string; urun_adi: string; kutu: number; indirim_tl: number; }
interface EczaneSatir {
  eczane_id: string;
  eczane_adi: string;
  urunler: UrunSatir[];
  toplam_kutu: number;
  toplam_tl: number;
}
interface Dokum {
  eczaneler: EczaneSatir[];
  toplam_kutu: number;
  toplam_tl: number;
}

interface Props {
  hata: (mesaj: string, adim?: string) => void;
}

export default function UttEczanemDokum({ hata }: Props) {
  const [periyot, setPeriyot] = useState<Periyot>("bu_ay");
  const [dokum, setDokum] = useState<Dokum | null>(null);
  const [acikEczane, setAcikEczane] = useState<string | null>(null);

  const cek = useCallback(async () => {
    try {
      const res = await fetch(`/eczanem/utt/api/dokum?periyot=${periyot}`);
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Döküm yüklenemedi.", "döküm"); return; }
      setDokum(d);
    } catch { hata("Döküm yüklenemedi.", "döküm"); }
  }, [hata, periyot]);

  useEffect(() => { cek(); }, [cek]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mt-6">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-semibold text-gray-700">Mutabakat Dökümü</div>
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
        Eczane × ürün toplamları (onaylanan siparişler) — aylık firma-eczane mutabakatının dayanağı.
      </div>

      {!dokum || dokum.eczaneler.length === 0 ? (
        <div className="text-sm text-gray-400">Bu dönemde onaylanmış işlem yok.</div>
      ) : (
        <>
          <div className="flex justify-between text-sm font-semibold mb-3 px-1">
            <span className="text-gray-800">Genel toplam</span>
            <span style={{ color: "#b45309" }}>{dokum.toplam_kutu} kutu · {dokum.toplam_tl.toFixed(2)} TL</span>
          </div>
          <div className="divide-y divide-gray-100">
            {dokum.eczaneler.map((e) => {
              const acik = acikEczane === e.eczane_id;
              return (
                <div key={e.eczane_id}>
                  <button
                    onClick={() => setAcikEczane(acik ? null : e.eczane_id)}
                    className="w-full py-2.5 flex items-center justify-between gap-3 text-left"
                  >
                    <span className="text-sm text-gray-800 truncate">{e.eczane_adi}</span>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {e.toplam_kutu} kutu · {e.toplam_tl.toFixed(2)} TL {acik ? "▾" : "▸"}
                    </span>
                  </button>
                  {acik && (
                    <table className="w-full text-sm mb-3">
                      <tbody>
                        {e.urunler.map((u) => (
                          <tr key={u.urun_id} className="border-t border-gray-50">
                            <td className="py-1.5 pl-3 text-gray-600">{u.urun_adi}</td>
                            <td className="py-1.5 text-right text-gray-600">{u.kutu}</td>
                            <td className="py-1.5 text-right text-gray-600">{u.indirim_tl.toFixed(2)} TL</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
