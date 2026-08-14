"use client";

import { useEffect, useState } from "react";
import type { UrunGosterim } from "../_types";

interface FirmaUrunErisimi {
  firma_id: string;
  firma_adi: string;
  aktif: boolean;
  hbstore_aktif: boolean;
  urun_aktif_mi: boolean;
}

interface FirmaErisimModalProps {
  urun: UrunGosterim | null;
  onKapat: () => void;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export default function FirmaErisimModal({ urun, onKapat, hata, basari }: FirmaErisimModalProps) {
  const [firmalar, setFirmalar] = useState<FirmaUrunErisimi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [guncellenenFirmaId, setGuncellenenFirmaId] = useState<string | null>(null);

  useEffect(() => {
    if (!urun) return;
    let iptal = false;
    setYukleniyor(true);

    fetch(`/admin/store/api/urun-firma?urun_id=${encodeURIComponent(urun.urun_id)}`)
      .then(async (res) => ({ res, data: await res.json() }))
      .then(({ res, data }) => {
        if (iptal) return;
        if (!res.ok) {
          hata(data.hata ?? "Firma erişimleri yüklenemedi.", data.adim, data.detay);
          return;
        }
        setFirmalar(data.firmalar ?? []);
      })
      .catch((err) => {
        if (!iptal) hata("Firma erişimleri yüklenemedi.", "fetch", String(err));
      })
      .finally(() => {
        if (!iptal) setYukleniyor(false);
      });

    return () => { iptal = true; };
    // Mesaj fonksiyonları ortak hook'ta her çizimde yeniden oluşuyor; yalnız ürün
    // değişince veri çekmek bilinçli sözleşmedir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urun]);

  if (!urun) return null;

  const erisimDegistir = async (firma: FirmaUrunErisimi) => {
    const yeniDeger = !firma.urun_aktif_mi;
    setGuncellenenFirmaId(firma.firma_id);
    try {
      const res = await fetch("/admin/store/api/urun-firma", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urun_id: urun.urun_id,
          firma_id: firma.firma_id,
          aktif_mi: yeniDeger,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        hata(data.hata ?? "Firma erişimi güncellenemedi.", data.adim, data.detay);
        return;
      }
      setFirmalar((mevcut) => mevcut.map((satir) => (
        satir.firma_id === firma.firma_id
          ? { ...satir, urun_aktif_mi: yeniDeger }
          : satir
      )));
      basari(`${firma.firma_adi} için ürün ${yeniDeger ? "açıldı" : "kapatıldı"}.`);
    } catch (err) {
      hata("Firma erişimi güncellenemedi.", "fetch", String(err));
    } finally {
      setGuncellenenFirmaId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="firma-erisim-baslik"
      style={{
        position: "fixed", inset: 0, zIndex: 80, background: "rgba(17,24,39,.45)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
      }}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onKapat(); }}
    >
      <div style={{
        width: "min(640px, 100%)", maxHeight: "min(720px, 86vh)", overflow: "hidden",
        background: "white", borderRadius: "12px", boxShadow: "0 20px 50px rgba(0,0,0,.18)",
        display: "flex", flexDirection: "column", fontFamily: "'Nunito', sans-serif",
      }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #e5e7eb", display: "flex", gap: "12px", justifyContent: "space-between" }}>
          <div>
            <h3 id="firma-erisim-baslik" style={{ margin: 0, fontSize: "15px", color: "#111827" }}>Firma Erişimi</h3>
            <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#737373" }}>
              {urun.ad} · Katalog globaldir; yalnız kapatmak istediğiniz firmaları seçin.
            </p>
          </div>
          <button type="button" onClick={onKapat} aria-label="Kapat" style={{ border: 0, background: "transparent", color: "#737373", fontSize: "20px", cursor: "pointer" }}>×</button>
        </div>

        <div style={{ overflowY: "auto", padding: "10px 18px 18px" }}>
          {yukleniyor ? (
            <div style={{ padding: "28px", textAlign: "center", color: "#737373", fontSize: "12px" }}>Firmalar yükleniyor...</div>
          ) : firmalar.length === 0 ? (
            <div style={{ padding: "28px", textAlign: "center", color: "#737373", fontSize: "12px" }}>Firma bulunamadı.</div>
          ) : firmalar.map((firma) => {
            const islemde = guncellenenFirmaId === firma.firma_id;
            return (
              <div key={firma.firma_id} style={{ minHeight: "52px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: "#111827", fontWeight: 700, fontSize: "12px" }}>{firma.firma_adi}</div>
                  <div style={{ color: "#737373", fontSize: "10px", marginTop: "2px" }}>
                    {!firma.aktif ? "Firma pasif" : firma.hbstore_aktif ? "HBStore açık" : "HBStore kapalı"}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={firma.urun_aktif_mi}
                  aria-label={`${firma.firma_adi} ürün erişimi`}
                  disabled={islemde}
                  onClick={() => erisimDegistir(firma)}
                  style={{
                    width: "88px", padding: "6px 10px", borderRadius: "999px", cursor: islemde ? "wait" : "pointer",
                    border: `1px solid ${firma.urun_aktif_mi ? "#86efac" : "#fecaca"}`,
                    background: firma.urun_aktif_mi ? "#dcfce7" : "#fee2e2",
                    color: firma.urun_aktif_mi ? "#166534" : "#991b1b",
                    fontWeight: 700, fontSize: "11px", opacity: islemde ? .55 : 1,
                  }}
                >
                  {islemde ? "..." : firma.urun_aktif_mi ? "Açık" : "Kapalı"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
