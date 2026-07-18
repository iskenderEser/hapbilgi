// app/admin/eclub-store/_components/EclubStoreSiparisYonetimModal.tsx
"use client";

import { useState } from "react";
import type { EclubStoreAdminSiparis } from "@/lib/eclub/store/eclubStoreTipler";
import { RENK_BORDO } from "../../_constants";

interface Props {
  siparis: EclubStoreAdminSiparis;
  islemLoading: boolean;
  onKapat: () => void;
  onDurumGuncelle: (siparis_id: string, durum: string, kargo?: { firma: string; takip: string }) => Promise<boolean>;
  onIptal: (siparis_id: string, sebep: string) => Promise<boolean>;
}

const DURUMLAR = [
  { id: "beklemede", ad: "Beklemede" },
  { id: "hazirlaniyor", ad: "Hazırlanıyor" },
  { id: "kargoda", ad: "Kargoda" },
  { id: "teslim_edildi", ad: "Teslim Edildi" },
];

export default function EclubStoreSiparisYonetimModal({ siparis, islemLoading, onKapat, onDurumGuncelle, onIptal }: Props) {
  const [durum, setDurum] = useState(siparis.durum);
  const [kargoFirma, setKargoFirma] = useState(siparis.kargo_firmasi ?? "");
  const [kargoTakip, setKargoTakip] = useState(siparis.kargo_takip_no ?? "");
  const [iptalMod, setIptalMod] = useState(false);
  const [iptalSebep, setIptalSebep] = useState("");

  const adres = siparis.adres_snapshot as Record<string, unknown> | null;

  const kaydet = async () => {
    if (durum === "kargoda") {
      if (!kargoFirma.trim() || !kargoTakip.trim()) return;
      await onDurumGuncelle(siparis.siparis_id, durum, { firma: kargoFirma, takip: kargoTakip });
    } else {
      await onDurumGuncelle(siparis.siparis_id, durum);
    }
  };

  const inputCls: React.CSSProperties = { width: "100%", padding: "8px 10px", fontSize: "14px", border: "0.5px solid #e5e7eb", borderRadius: "6px", outline: "none", fontFamily: "'Nunito', sans-serif" };
  const label: React.CSSProperties = { fontSize: "12px", color: "#6b7280" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", background: "rgba(0,0,0,0.4)", overflowY: "auto" }}>
      <div style={{ background: "#fff", borderRadius: "12px", width: "100%", maxWidth: "440px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px", fontFamily: "'Nunito', sans-serif", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 600, margin: 0, color: "#111" }}>Sipariş Yönetimi</h3>
          <button onClick={onKapat} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "18px", color: "#9ca3af" }}>✕</button>
        </div>

        <div style={{ background: "#f9fafb", borderRadius: "8px", padding: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "14px", fontWeight: 500, color: "#111" }}>{siparis.urun_adi} × {siparis.adet}</span>
          <span style={{ fontSize: "12px", color: "#6b7280" }}>{siparis.kisi_ad_soyad} · {siparis.toplam_puan} puan</span>
          {adres && (
            <span style={{ fontSize: "12px", color: "#9ca3af" }}>
              {String(adres.ad_soyad ?? "")} · {String(adres.telefon ?? "")}<br />
              {String(adres.il ?? "")}/{String(adres.ilce ?? "")} — {String(adres.acik_adres ?? "")}
            </span>
          )}
        </div>

        {siparis.durum === "iptal" ? (
          <div style={{ fontSize: "13px", color: "#bc2d0d", padding: "8px", background: "#fee2e2", borderRadius: "6px" }}>
            Bu sipariş iptal edilmiş. {siparis.iptal_sebebi ? `Sebep: ${siparis.iptal_sebebi}` : ""}
          </div>
        ) : iptalMod ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={label}>İptal Sebebi</label>
            <textarea style={inputCls} rows={2} value={iptalSebep} onChange={(e) => setIptalSebep(e.target.value)} placeholder="İptal sebebi" />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button onClick={() => setIptalMod(false)} style={{ padding: "8px 14px", background: "transparent", border: "0.5px solid #d1d5db", borderRadius: "6px", fontSize: "13px", color: "#6b7280", cursor: "pointer" }}>Geri</button>
              <button onClick={() => onIptal(siparis.siparis_id, iptalSebep)} disabled={islemLoading} style={{ padding: "8px 16px", background: "#bc2d0d", border: "none", borderRadius: "6px", fontSize: "13px", color: "#fff", cursor: "pointer" }}>{islemLoading ? "..." : "İptal Et (puan iade)"}</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={label}>Durum</label>
              <select style={inputCls} value={durum} onChange={(e) => setDurum(e.target.value)}>
                {DURUMLAR.map((d) => <option key={d.id} value={d.id}>{d.ad}</option>)}
              </select>
            </div>

            {durum === "kargoda" && (
              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={label}>Kargo Firması</label>
                  <input style={inputCls} value={kargoFirma} onChange={(e) => setKargoFirma(e.target.value)} />
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={label}>Takip No</label>
                  <input style={inputCls} value={kargoTakip} onChange={(e) => setKargoTakip(e.target.value)} />
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", marginTop: "4px" }}>
              <button onClick={() => setIptalMod(true)} style={{ padding: "8px 14px", background: "transparent", border: "0.5px solid #fecaca", borderRadius: "6px", fontSize: "13px", color: "#bc2d0d", cursor: "pointer" }}>Siparişi İptal Et</button>
              <button onClick={kaydet} disabled={islemLoading} style={{ padding: "8px 16px", background: RENK_BORDO, border: "none", borderRadius: "6px", fontSize: "13px", color: "#fff", fontWeight: 600, cursor: "pointer" }}>{islemLoading ? "..." : "Durumu Kaydet"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}