// components/cc-ligi/CcLigiBanner.tsx
//
// CC Ligi üst banner'ı: Çeyrek Lideri + Yıl Lideri rozetleri.
// İki API çağrısı: get_cc_ligi_donem_lideri ve get_cc_ligi_yil_lideri.
// Eşitlik durumunda birden fazla lider isim olarak gösterilir.
// 0 puanlı durumda "Lider Bekleniyor" mesajı gösterilir.

"use client";

import { useEffect, useState } from "react";

interface Lider {
  kullanici_id: string;
  ad: string;
  soyad: string;
  toplam_net_puan: number;
}

interface Props {
  yil: number;
  ceyrek: number;
  hata: (mesaj: string, adim?: string, detay?: any) => void;
}

export default function CcLigiBanner({ yil, ceyrek, hata }: Props) {
  const [donemLiderleri, setDonemLiderleri] = useState<Lider[]>([]);
  const [yilLiderleri, setYilLiderleri] = useState<Lider[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    const yukle = async () => {
      setYukleniyor(true);
      try {
        const [donemRes, yilRes] = await Promise.all([
          fetch(`/cc-ligi/api?tip=donem-lideri&yil=${yil}&ceyrek=${ceyrek}`),
          fetch(`/cc-ligi/api?tip=yil-lideri&yil=${yil}`),
        ]);

        if (donemRes.ok) {
          const d = await donemRes.json();
          setDonemLiderleri(d.liderler ?? []);
        } else {
          const d = await donemRes.json();
          hata(d.hata ?? "Çeyrek lideri çekilemedi.", d.adim, d.detay);
        }

        if (yilRes.ok) {
          const d = await yilRes.json();
          setYilLiderleri(d.liderler ?? []);
        } else {
          const d = await yilRes.json();
          hata(d.hata ?? "Yıl lideri çekilemedi.", d.adim, d.detay);
        }
      } catch (err) {
        hata("Banner verisi yüklenemedi.", "fetch", String(err));
      }
      setYukleniyor(false);
    };

    yukle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yil, ceyrek]);

  const liderMetni = (liderler: Lider[]): { isim: string; puan: number; varMi: boolean } => {
    // 0 puanlı veya boş ise "Lider Bekleniyor"
    if (liderler.length === 0) return { isim: "", puan: 0, varMi: false };
    if (liderler[0].toplam_net_puan <= 0) return { isim: "", puan: 0, varMi: false };

    const isimler = liderler.map((l) => `${l.ad} ${l.soyad}`).join(", ");
    return { isim: isimler, puan: liderler[0].toplam_net_puan, varMi: true };
  };

  const donem = liderMetni(donemLiderleri);
  const yilL = liderMetni(yilLiderleri);

  return (
    <div
      className="rounded-xl px-5 py-4 mb-4 text-white"
      style={{ background: "#bc2d0d" }}
    >
      <div className="flex flex-col gap-2.5">
        {/* Çeyrek lideri */}
        <div className="flex items-center gap-2.5">
          <span className="text-lg">🏆</span>
          <span
            className="text-xs uppercase tracking-wider"
            style={{ opacity: 0.8, minWidth: "110px" }}
          >
            Bu Çeyrek Lideri
          </span>
          {yukleniyor ? (
            <span className="text-sm" style={{ opacity: 0.7 }}>Yükleniyor...</span>
          ) : donem.varMi ? (
            <>
              <span className="text-sm font-semibold flex-1">{donem.isim}</span>
              <span className="text-sm font-bold">{donem.puan} puan</span>
            </>
          ) : (
            <span className="text-sm italic" style={{ opacity: 0.85 }}>
              Lider Bekleniyor
            </span>
          )}
        </div>

        {/* Ayırıcı */}
        <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.3)" }} />

        {/* Yıl lideri */}
        <div className="flex items-center gap-2.5">
          <span className="text-lg">🌟</span>
          <span
            className="text-xs uppercase tracking-wider"
            style={{ opacity: 0.8, minWidth: "110px" }}
          >
            Bu Yıl Lideri
          </span>
          {yukleniyor ? (
            <span className="text-sm" style={{ opacity: 0.7 }}>Yükleniyor...</span>
          ) : yilL.varMi ? (
            <>
              <span className="text-sm font-semibold flex-1">{yilL.isim}</span>
              <span className="text-sm font-bold">{yilL.puan} puan</span>
            </>
          ) : (
            <span className="text-sm italic" style={{ opacity: 0.85 }}>
              Lider Bekleniyor
            </span>
          )}
        </div>
      </div>
    </div>
  );
}