// app/admin/eclub-store/_components/EclubStoreSiparislerSekmesi.tsx
"use client";

import type { EclubStoreAdminSiparis } from "@/lib/eclub/store/eclubStoreTipler";
import EclubStoreSiparisYonetimModal from "./EclubStoreSiparisYonetimModal";
import { RENK_BORDO, RENK_BORDO_ZEMIN, RENK_BORDO_KENAR } from "../../_constants";

interface Props {
  siparisler: EclubStoreAdminSiparis[];
  yukleniyor: boolean;
  durumFiltre: string;
  setDurumFiltre: (d: string) => void;
  seciliSiparis: EclubStoreAdminSiparis | null;
  setSeciliSiparis: (s: EclubStoreAdminSiparis | null) => void;
  islemLoading: boolean;
  durumGuncelle: (siparis_id: string, durum: string, kargo?: { firma: string; takip: string }) => Promise<boolean>;
  siparisIptal: (siparis_id: string, sebep: string) => Promise<boolean>;
}

const DURUM_ETIKET: Record<string, { ad: string; renk: string; bg: string }> = {
  beklemede: { ad: "Beklemede", renk: "#92400e", bg: "#fef3c7" },
  hazirlaniyor: { ad: "Hazırlanıyor", renk: "#1d4ed8", bg: "#dbeafe" },
  kargoda: { ad: "Kargoda", renk: "#7c3aed", bg: "#ede9fe" },
  teslim_edildi: { ad: "Teslim Edildi", renk: "#166534", bg: "#dcfce7" },
  iptal: { ad: "İptal", renk: "#bc2d0d", bg: "#fee2e2" },
};

const FILTRELER = [
  { id: "", ad: "Tümü" },
  { id: "beklemede", ad: "Beklemede" },
  { id: "hazirlaniyor", ad: "Hazırlanıyor" },
  { id: "kargoda", ad: "Kargoda" },
  { id: "teslim_edildi", ad: "Teslim" },
  { id: "iptal", ad: "İptal" },
];

export default function EclubStoreSiparislerSekmesi(props: Props) {
  const { siparisler, yukleniyor, durumFiltre, setDurumFiltre, seciliSiparis, setSeciliSiparis, islemLoading, durumGuncelle, siparisIptal } = props;

  return (
    <div style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div style={{ display: "flex", gap: "6px", marginBottom: "14px", flexWrap: "wrap" }}>
        {FILTRELER.map((f) => {
          const aktif = durumFiltre === f.id;
          return (
            <button key={f.id} onClick={() => setDurumFiltre(f.id)}
              style={{ padding: "5px 12px", background: aktif ? RENK_BORDO_ZEMIN : "transparent", border: aktif ? `1px solid ${RENK_BORDO_KENAR}` : "0.5px solid #e5e7eb", borderRadius: "6px", fontSize: "12px", color: aktif ? RENK_BORDO : "#6b7280", fontWeight: aktif ? 600 : 400, cursor: "pointer" }}>
              {f.ad}
            </button>
          );
        })}
      </div>

      {yukleniyor ? (
        <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "14px", padding: "24px" }}>Yükleniyor...</p>
      ) : siparisler.length === 0 ? (
        <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "14px", padding: "24px" }}>Sipariş yok.</p>
      ) : (
        <div style={{ border: "0.5px solid #e5e7eb", borderRadius: "10px", overflow: "hidden" }}>
          {siparisler.map((s) => {
            const durum = DURUM_ETIKET[s.durum] ?? { ad: s.durum, renk: "#6b7280", bg: "#f3f4f6" };
            return (
              <div key={s.siparis_id} onClick={() => setSeciliSiparis(s)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "0.5px solid #f3f4f6", cursor: "pointer" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 500, color: "#111" }}>{s.urun_adi} × {s.adet}</span>
                  <span style={{ fontSize: "12px", color: "#9ca3af" }}>{s.kisi_ad_soyad} · {s.toplam_puan} puan · {new Date(s.created_at).toLocaleDateString("tr")}</span>
                </div>
                <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "999px", color: durum.renk, background: durum.bg }}>{durum.ad}</span>
              </div>
            );
          })}
        </div>
      )}

      {seciliSiparis && (
        <EclubStoreSiparisYonetimModal
          siparis={seciliSiparis}
          islemLoading={islemLoading}
          onKapat={() => setSeciliSiparis(null)}
          onDurumGuncelle={durumGuncelle}
          onIptal={siparisIptal}
        />
      )}
    </div>
  );
}