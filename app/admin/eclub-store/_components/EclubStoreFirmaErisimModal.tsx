"use client";

import { useEffect, useState } from "react";
import type { EclubStoreUrunDetay } from "@/lib/eclub/store/eclubStoreTipler";

interface FirmaErisimi {
  firma_id: string;
  firma_adi: string;
  aktif: boolean;
  eclub_store_aktif: boolean;
  urun_aktif_mi: boolean;
}

interface Props {
  urun: EclubStoreUrunDetay;
  onKapat: () => void;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export default function EclubStoreFirmaErisimModal({ urun, onKapat, hata, basari }: Props) {
  const [firmalar, setFirmalar] = useState<FirmaErisimi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [islemde, setIslemde] = useState<string | null>(null);

  useEffect(() => {
    let iptal = false;
    fetch(`/admin/eclub-store/api/urun-firma?urun_id=${encodeURIComponent(urun.urun_id)}`)
      .then(async (res) => ({ res, data: await res.json() }))
      .then(({ res, data }) => {
        if (iptal) return;
        if (!res.ok) hata(data.hata ?? "Firma erişimleri yüklenemedi.", data.adim, data.detay);
        else setFirmalar(data.firmalar ?? []);
      })
      .catch((err) => { if (!iptal) hata("Firma erişimleri yüklenemedi.", "fetch", String(err)); })
      .finally(() => { if (!iptal) setYukleniyor(false); });
    return () => { iptal = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urun.urun_id]);

  const degistir = async (firma: FirmaErisimi) => {
    const yeni = !firma.urun_aktif_mi;
    setIslemde(firma.firma_id);
    try {
      const res = await fetch("/admin/eclub-store/api/urun-firma", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urun_id: urun.urun_id, firma_id: firma.firma_id, aktif_mi: yeni }),
      });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Firma erişimi güncellenemedi.", data.adim, data.detay); return; }
      setFirmalar((liste) => liste.map((satir) => satir.firma_id === firma.firma_id ? { ...satir, urun_aktif_mi: yeni } : satir));
      basari(`${firma.firma_adi} için ürün ${yeni ? "açıldı" : "kapatıldı"}.`);
    } catch (err) {
      hata("Firma erişimi güncellenemedi.", "fetch", String(err));
    } finally {
      setIslemde(null);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="eclub-firma-erisim-baslik" onMouseDown={(e) => { if (e.target === e.currentTarget) onKapat(); }} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(17,24,39,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ width: "min(640px, 100%)", maxHeight: "86vh", overflow: "hidden", background: "#fff", borderRadius: "12px", boxShadow: "0 20px 50px rgba(0,0,0,.18)", display: "flex", flexDirection: "column", fontFamily: "'Nunito', sans-serif" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", gap: "12px" }}>
          <div><h3 id="eclub-firma-erisim-baslik" style={{ margin: 0, fontSize: "15px" }}>Firma Erişimi</h3><p style={{ margin: "3px 0 0", fontSize: "12px", color: "#737373" }}>{urun.ad} · Yalnız kapatmak istediğiniz firmaları seçin.</p></div>
          <button type="button" onClick={onKapat} aria-label="Kapat" style={{ border: 0, background: "transparent", fontSize: "20px", cursor: "pointer" }}>×</button>
        </div>
        <div style={{ overflowY: "auto", padding: "10px 18px 18px" }}>
          {yukleniyor ? <div style={{ padding: "28px", textAlign: "center", color: "#737373" }}>Firmalar yükleniyor...</div> : firmalar.map((firma) => (
            <div key={firma.firma_id} style={{ minHeight: "52px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", borderBottom: "1px solid #f3f4f6" }}>
              <div><strong style={{ display: "block", fontSize: "12px" }}>{firma.firma_adi}</strong><small style={{ color: "#737373" }}>{!firma.aktif ? "Firma pasif" : firma.eclub_store_aktif ? "E-Club Store açık" : "E-Club Store kapalı"}</small></div>
              <button type="button" role="switch" aria-checked={firma.urun_aktif_mi} disabled={islemde === firma.firma_id} onClick={() => void degistir(firma)} style={{ width: "88px", padding: "6px 10px", borderRadius: "999px", cursor: "pointer", border: `1px solid ${firma.urun_aktif_mi ? "#86efac" : "#fecaca"}`, background: firma.urun_aktif_mi ? "#dcfce7" : "#fee2e2", color: firma.urun_aktif_mi ? "#166534" : "#991b1b", fontWeight: 700, fontSize: "11px" }}>{islemde === firma.firma_id ? "..." : firma.urun_aktif_mi ? "Açık" : "Kapalı"}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
