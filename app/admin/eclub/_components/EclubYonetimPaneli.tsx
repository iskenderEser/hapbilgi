// app/admin/eclub/_components/EclubYonetimPaneli.tsx
//
// M2-b — E-Club yönetim içeriği (onay bekleyen eczaneler + kayıtlı
// firma/eczane/kişi). Eski /admin/eclub sayfasının kabuksuz hâli: auth,
// Navbar ve hata konteyneri ANA panelin işidir; bu bileşen yalnız içeriktir
// ve ana paneldeki E-Club sekmesine gömülür (plan B.2).

"use client";

import { useState } from "react";
import { useEclubOnaylar } from "../_hooks/useEclubOnaylar";
import { useEclubKayitli } from "../_hooks/useEclubKayitli";
import { RENK_BORDO, RENK_BORDO_ZEMIN } from "../../_constants";

const KISI_ROL_ETIKETLERI: Record<string, string> = {
  eczaci: "Eczacı",
  eczane_teknisyeni: "Eczane Teknisyeni",
};

interface EclubYonetimPaneliProps {
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export default function EclubYonetimPaneli({ hata, basari }: EclubYonetimPaneliProps) {
  // Ana panel bu bileşeni yalnız admin doğrulandıktan sonra render eder.
  const { bekleyenler, loading, islemLoading, kararVer } = useEclubOnaylar({ hazir: true, hata, basari });
  const {
    firmalar, seciliFirmaId, eczaneler, acikEczaneId, kisiler,
    firmaSec, eczaneTikla, kisiPasifeAl,
  } = useEclubKayitli({ hata, basari });

  const [reddetOnay, setReddetOnay] = useState<string | null>(null);
  const [pasifeOnay, setPasifeOnay] = useState<string | null>(null);

  if (loading) {
    return <p className="text-sm text-gray-400 py-4 m-0">E-Club verileri yükleniyor...</p>;
  }

  return (
    <div className="flex flex-col gap-6" style={{ maxWidth: "860px", fontFamily: "'Nunito', sans-serif" }}>

      {/* --- Onay Bekleyen Eczaneler --- */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 md:px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">Onay Bekleyen Eczaneler</span>
          <span className="text-xs text-gray-400">{bekleyenler.length} kayıt</span>
        </div>

        {bekleyenler.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8 m-0">Onay bekleyen eczane yok.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {bekleyenler.map((b) => (
              <div key={b.gln} className="px-4 md:px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-gray-900">{b.eczane_adi}</span>
                  <span className="text-xs text-gray-400 font-mono">{b.gln}</span>
                  <span className="text-xs text-gray-500">
                    {b.il}{b.ilce ? ` / ${b.ilce}` : ""}
                    {b.ekleyen_ad ? ` · Ekleyen: ${b.ekleyen_ad}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {reddetOnay === b.gln ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">Silinsin mi?</span>
                      <button onClick={async () => { await kararVer(b.gln, "reddet"); setReddetOnay(null); }}
                        disabled={islemLoading}
                        className="text-xs px-2.5 py-1 rounded-lg border-none text-white cursor-pointer" style={{ background: "#bc2d0d" }}>
                        Evet, reddet
                      </button>
                      <button onClick={() => setReddetOnay(null)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 bg-transparent text-gray-500 cursor-pointer">Vazgeç</button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => kararVer(b.gln, "onayla")} disabled={islemLoading}
                        className="text-xs px-3 py-1.5 rounded-lg border-none bg-green-700 text-white font-semibold cursor-pointer">Onayla</button>
                      <button onClick={() => setReddetOnay(b.gln)} disabled={islemLoading}
                        className="text-xs px-3 py-1.5 rounded-lg bg-transparent cursor-pointer"
                        style={{ border: "0.5px solid #fecaca", color: "#bc2d0d" }}>Reddet</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- Kayıtlı Firma / Eczane / Kişi --- */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 md:px-5 py-3.5 border-b border-gray-100 bg-gray-50">
          <span className="text-sm font-semibold text-gray-900">Kayıtlı Eczaneler ve Kişiler</span>
        </div>

        <div className="px-4 md:px-5 py-3 border-b border-gray-100">
          <label className="block text-xs text-gray-500 mb-1">Firma</label>
          <select
            value={seciliFirmaId}
            onChange={(e) => firmaSec(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 outline-none"
            style={{ fontFamily: "'Nunito', sans-serif" }}
          >
            <option value="">Firma seçin...</option>
            {firmalar.map((f) => (
              <option key={f.firma_id} value={f.firma_id}>
                {f.firma_adi}{f.eclub_aktif ? "" : " (E-Club kapalı)"}
              </option>
            ))}
          </select>
        </div>

        {!seciliFirmaId ? (
          <p className="text-sm text-gray-400 text-center py-8 m-0">Eczaneleri görmek için firma seçin.</p>
        ) : eczaneler.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8 m-0">Bu firmada kayıtlı eczane yok.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {eczaneler.map((e) => (
              <div key={e.eczane_id}>
                <div
                  onClick={() => eczaneTikla(e.eczane_id)}
                  className="px-4 md:px-5 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"
                      style={{ transform: acikEczaneId === e.eczane_id ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-gray-900">{e.eczane_adi}</span>
                      <span className="text-xs text-gray-400 font-mono">{e.gln} · {e.il}{e.ilce ? ` / ${e.ilce}` : ""}</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">{e.aktif_kisi_sayisi} kişi</span>
                </div>

                {acikEczaneId === e.eczane_id && (
                  <div className="bg-gray-50 border-t border-gray-100">
                    {kisiler.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4 m-0">Bu eczanede kayıtlı kişi yok.</p>
                    ) : (
                      kisiler.map((k) => (
                        <div key={k.kisi_id} className="pl-11 pr-4 md:pr-5 py-2.5 flex items-center justify-between gap-3 border-b border-gray-100 last:border-b-0">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                              style={{ background: RENK_BORDO_ZEMIN, color: RENK_BORDO }}>
                              {`${k.ad?.[0] ?? ""}${k.soyad?.[0] ?? ""}`}
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm text-gray-900">{k.ad} {k.soyad}</span>
                              <span className="text-xs text-gray-400">
                                {KISI_ROL_ETIKETLERI[k.rol] ?? k.rol} · {k.aktif_mi ? "aktif" : "pasif"}
                              </span>
                            </div>
                          </div>

                          {k.aktif_mi ? (
                            pasifeOnay === k.kisi_id ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-gray-500">Emin misiniz?</span>
                                <button
                                  onClick={async () => { await kisiPasifeAl(k.kisi_id, e.eczane_id); setPasifeOnay(null); }}
                                  className="text-xs px-2.5 py-1 rounded-lg border-none text-white cursor-pointer"
                                  style={{ background: "#bc2d0d" }}>
                                  Evet, pasife al
                                </button>
                                <button onClick={() => setPasifeOnay(null)}
                                  className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 bg-transparent text-gray-500 cursor-pointer">Vazgeç</button>
                              </div>
                            ) : (
                              <button onClick={() => setPasifeOnay(k.kisi_id)}
                                className="text-xs px-3 py-1.5 rounded-lg bg-transparent cursor-pointer"
                                style={{ border: "0.5px solid #fecaca", color: "#bc2d0d" }}>Pasife al</button>
                            )
                          ) : (
                            <span className="text-xs text-gray-400">Pasif</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
