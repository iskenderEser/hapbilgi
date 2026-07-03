// app/eclub/oneriler/_components/OneriGonder.tsx
"use client";

import { useMemo, useState } from "react";
import type { OneriYayin, OneriKisi, OneriGonderSonuc } from "../_types";
import { ROL_ETIKETLERI, ATLANMA_SEBEP_ETIKETLERI } from "../_types";

interface Props {
  yayinlar: OneriYayin[];
  kisiler: OneriKisi[];
  gonderLoading: boolean;
  onGonder: (yayin_id: string, kisi_idler: string[]) => Promise<OneriGonderSonuc | null>;
}

function rolRenk(rol: "eczaci" | "eczane_teknisyeni") {
  return rol === "eczaci"
    ? { bg: "#fff5f5", renk: "#e30a17", border: "#e30a17" }
    : { bg: "#eaf7e4", renk: "#10304a", border: "#7ed957" };
}

export function OneriGonder({ yayinlar, kisiler, gonderLoading, onGonder }: Props) {
  const [seciliYayin, setSeciliYayin] = useState<string | null>(null);
  const [seciliKisiler, setSeciliKisiler] = useState<Set<string>>(new Set());
  const [sonRapor, setSonRapor] = useState<OneriGonderSonuc | null>(null);

  const yayin = yayinlar.find((y) => y.yayin_id === seciliYayin) ?? null;

  // Seçili videonun hedef_rol'üne uygun, aktif kişiler
  const uygunKisiler = useMemo(() => {
    if (!yayin) return [];
    return kisiler.filter((k) => k.aktif_mi && k.rol === yayin.hedef_rol);
  }, [yayin, kisiler]);

  const yayinSec = (id: string) => {
    setSeciliYayin(id);
    setSeciliKisiler(new Set()); // video değişince kişi seçimi sıfırlanır
    setSonRapor(null);
  };

  const kisiToggle = (id: string) => {
    setSeciliKisiler((prev) => {
      const y = new Set(prev);
      if (y.has(id)) y.delete(id); else y.add(id);
      return y;
    });
  };

  const tumunuSec = () => {
    if (seciliKisiler.size === uygunKisiler.length) setSeciliKisiler(new Set());
    else setSeciliKisiler(new Set(uygunKisiler.map((k) => k.kisi_id)));
  };

  const gonder = async () => {
    if (!seciliYayin || seciliKisiler.size === 0) return;
    const rapor = await onGonder(seciliYayin, [...seciliKisiler]);
    if (rapor) {
      setSonRapor(rapor);
      setSeciliKisiler(new Set());
    }
  };

  // Atlananları sebebe göre grupla (rapor gösterimi)
  const atlananGruplu = useMemo(() => {
    if (!sonRapor) return [];
    const map = new Map<string, number>();
    for (const a of sonRapor.atlanan) map.set(a.sebep, (map.get(a.sebep) ?? 0) + 1);
    return [...map.entries()];
  }, [sonRapor]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 md:px-5 py-3.5 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-900">Öneri Gönder</span>
      </div>

      <div className="px-4 md:px-5 py-4 flex flex-col gap-4">
        {/* Video seçimi */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">1. Video seçin</p>
          {yayinlar.length === 0 ? (
            <p className="text-sm text-gray-400">Önerilebilir yayın bulunmuyor.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {yayinlar.map((y) => {
                const r = rolRenk(y.hedef_rol);
                const secili = seciliYayin === y.yayin_id;
                return (
                  <button key={y.yayin_id} onClick={() => yayinSec(y.yayin_id)}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border cursor-pointer text-left transition-colors"
                    style={{ borderColor: secili ? r.border : "#e5e7eb", background: secili ? r.bg : "white" }}>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-gray-900">{y.urun_adi}</span>
                      <span className="text-xs text-gray-500">{y.teknik_adi}</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background: r.bg, color: r.renk, border: `0.5px solid ${r.border}` }}>
                      {ROL_ETIKETLERI[y.hedef_rol]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Kişi seçimi */}
        {yayin && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 m-0">
                2. Kişi seçin ({ROL_ETIKETLERI[yayin.hedef_rol]})
              </p>
              {uygunKisiler.length > 0 && (
                <button onClick={tumunuSec}
                  className="text-xs px-2 py-0.5 rounded-lg border border-gray-200 bg-transparent text-gray-500 cursor-pointer hover:bg-gray-100 transition-colors">
                  {seciliKisiler.size === uygunKisiler.length ? "Seçimi kaldır" : "Tümünü seç"}
                </button>
              )}
            </div>
            {uygunKisiler.length === 0 ? (
              <p className="text-sm text-gray-400">Bu role uygun aktif kişi yok.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {uygunKisiler.map((k) => {
                  const secili = seciliKisiler.has(k.kisi_id);
                  return (
                    <label key={k.kisi_id}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors"
                      style={{ borderColor: secili ? "#56aeff" : "#e5e7eb", background: secili ? "#eff6ff" : "white" }}>
                      <input type="checkbox" checked={secili} onChange={() => kisiToggle(k.kisi_id)}
                        className="cursor-pointer" />
                      <span className="text-sm text-gray-900">{k.ad} {k.soyad}</span>
                      <span className="text-xs text-gray-400 ml-auto">{k.eczane_adi}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Gönder */}
        {yayin && uygunKisiler.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{seciliKisiler.size} kişi seçildi</span>
            <button onClick={gonder} disabled={gonderLoading || seciliKisiler.size === 0}
              className="text-white border-none rounded-lg px-5 py-2.5 text-sm font-semibold cursor-pointer"
              style={{ background: "#56aeff", opacity: seciliKisiler.size === 0 ? 0.5 : 1, fontFamily: "'Nunito', sans-serif" }}>
              {gonderLoading ? "Gönderiliyor..." : "Öneri Gönder"}
            </button>
          </div>
        )}

        {/* Sonuç raporu (atla-raporla) */}
        {sonRapor && (
          <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
            <p className="text-sm font-semibold text-gray-900 m-0 mb-1.5">
              {sonRapor.gonderilen_sayisi} öneri gönderildi.
            </p>
            {atlananGruplu.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-gray-500 m-0">Gönderilemeyenler:</p>
                {atlananGruplu.map(([sebep, adet]) => (
                  <span key={sebep} className="text-xs text-gray-600">
                    • {adet} kişi — {ATLANMA_SEBEP_ETIKETLERI[sebep] ?? sebep}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}