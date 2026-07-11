// components/raporlar/EczanemDokumBolumu.tsx
// İç rollerin Eczanem bölümü (U9, İP-§9.2) — /raporlar sayfalarına eklenen
// tek paylaşılan bileşen. Sunucu (raporlar/api/eczanem) rolü kendisi çözer:
//   cascade (BM bölge / TM takım / yönetici firma) → eczane×ürün toplamları
//   pm (ürün ekseni) → ürün → bölge → UTT → eczane kırılımı
// Firma Eczanem kapalıysa ya da rol kapsam dışıysa bölüm HİÇ görünmez.
// Kişi bazlı veri yoktur; izlenme metriği yoktur (İP-§6.2 — bilinçli karar).

"use client";

import { useCallback, useEffect, useState } from "react";
import { PERIYOTLAR, Periyot } from "@/lib/utils/raporUtils";

const AMBER = "#b45309";

interface UrunSatir { urun_id: string; urun_adi: string; kutu: number; indirim_tl: number; }
interface EczaneSatir {
  eczane_id: string;
  eczane_adi: string;
  utt_adi: string | null;
  urunler: UrunSatir[];
  toplam_kutu: number;
  toplam_tl: number;
}
interface PmEczane { eczane_adi: string; kutu: number; indirim_tl: number; }
interface PmUtt { utt_adi: string; kutu: number; indirim_tl: number; eczaneler: PmEczane[]; }
interface PmBolge { bolge_adi: string; kutu: number; indirim_tl: number; uttler: PmUtt[]; }
interface PmUrun { urun_id: string; urun_adi: string; kutu: number; indirim_tl: number; bolgeler: PmBolge[]; }

interface Veri {
  aktif: boolean;
  tip?: "cascade" | "pm";
  eczaneler?: EczaneSatir[];
  toplam_kutu?: number;
  toplam_tl?: number;
  urunler?: PmUrun[];
}

function tl(n: number) {
  return `${(n ?? 0).toFixed(2)} TL`;
}

export default function EczanemDokumBolumu() {
  const [periyot, setPeriyot] = useState<Periyot>("bu_ay");
  const [veri, setVeri] = useState<Veri | null>(null);
  const [acik, setAcik] = useState<string | null>(null);

  const cek = useCallback(async () => {
    try {
      const res = await fetch(`/raporlar/api/eczanem?periyot=${periyot}`);
      if (!res.ok) { setVeri(null); return; } // kapsam dışı rol (403) → bölüm görünmez
      const d = await res.json();
      setVeri(d?.data ?? null);
    } catch { setVeri(null); }
  }, [periyot]);

  useEffect(() => { cek(); }, [cek]);

  // Bayrak kapalı / kapsam dışı / veri yok → bölüm hiç render edilmez
  if (!veri?.aktif) return null;
  const cascadeBos = veri.tip === "cascade" && (veri.eczaneler ?? []).length === 0;
  const pmBos = veri.tip === "pm" && (veri.urunler ?? []).length === 0;

  return (
    <div className="mt-6 mb-5">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: AMBER }}>
          Eczanem — Mutabakat Dökümü
        </div>
        <div className="flex gap-1">
          {PERIYOTLAR.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriyot(p.key)}
              className="px-2 py-0.5 rounded-full text-[11px] border transition"
              style={{
                background: periyot === p.key ? AMBER : "transparent",
                color: periyot === p.key ? "#fff" : "#6b7280",
                borderColor: periyot === p.key ? AMBER : "#e5e7eb",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border rounded-xl p-4" style={{ borderColor: "#e5e7eb" }}>
        {cascadeBos || pmBos ? (
          <div className="text-sm text-gray-400">Bu dönemde onaylanmış Eczanem işlemi yok.</div>
        ) : veri.tip === "cascade" ? (
          <>
            <div className="flex justify-between text-sm font-semibold mb-3 px-1">
              <span className="text-gray-800">Kapsam toplamı</span>
              <span style={{ color: AMBER }}>{veri.toplam_kutu} kutu · {tl(veri.toplam_tl ?? 0)}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {(veri.eczaneler ?? []).map((e) => {
                const eAcik = acik === e.eczane_id;
                return (
                  <div key={e.eczane_id}>
                    <button
                      onClick={() => setAcik(eAcik ? null : e.eczane_id)}
                      className="w-full py-2.5 flex items-center justify-between gap-3 text-left"
                    >
                      <span className="min-w-0">
                        <span className="text-sm text-gray-800 block truncate">{e.eczane_adi}</span>
                        {e.utt_adi && <span className="text-[11px] text-gray-400">UTT: {e.utt_adi}</span>}
                      </span>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {e.toplam_kutu} kutu · {tl(e.toplam_tl)} {eAcik ? "▾" : "▸"}
                      </span>
                    </button>
                    {eAcik && (
                      <table className="w-full text-sm mb-3">
                        <tbody>
                          {e.urunler.map((u) => (
                            <tr key={u.urun_id} className="border-t border-gray-50">
                              <td className="py-1.5 pl-3 text-gray-600">{u.urun_adi}</td>
                              <td className="py-1.5 text-right text-gray-600">{u.kutu}</td>
                              <td className="py-1.5 text-right text-gray-600">{tl(u.indirim_tl)}</td>
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
        ) : (
          // PM — ürün ekseni: ürün → bölge → UTT → eczane
          <div className="divide-y divide-gray-100">
            {(veri.urunler ?? []).map((u) => {
              const uAcik = acik === u.urun_id;
              return (
                <div key={u.urun_id}>
                  <button
                    onClick={() => setAcik(uAcik ? null : u.urun_id)}
                    className="w-full py-2.5 flex items-center justify-between gap-3 text-left"
                  >
                    <span className="text-sm font-medium text-gray-800 truncate">{u.urun_adi}</span>
                    <span className="text-xs whitespace-nowrap" style={{ color: AMBER }}>
                      Türkiye: {u.kutu} kutu · {tl(u.indirim_tl)} {uAcik ? "▾" : "▸"}
                    </span>
                  </button>
                  {uAcik && (
                    <div className="pl-3 pb-3">
                      {u.bolgeler.map((b) => (
                        <div key={b.bolge_adi} className="mb-2">
                          <div className="flex justify-between text-sm text-gray-700 font-medium py-1">
                            <span>{b.bolge_adi}</span>
                            <span className="text-xs text-gray-500">{b.kutu} kutu · {tl(b.indirim_tl)}</span>
                          </div>
                          {b.uttler.map((ut) => (
                            <div key={ut.utt_adi} className="pl-3">
                              <div className="flex justify-between text-xs text-gray-500 py-0.5">
                                <span>{ut.utt_adi}</span>
                                <span>{ut.kutu} kutu · {tl(ut.indirim_tl)}</span>
                              </div>
                              {ut.eczaneler.map((ez) => (
                                <div key={ez.eczane_adi} className="pl-3 flex justify-between text-[11px] text-gray-400 py-0.5">
                                  <span className="truncate">{ez.eczane_adi}</span>
                                  <span className="whitespace-nowrap">{ez.kutu} kutu · {tl(ez.indirim_tl)}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
