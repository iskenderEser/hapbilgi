// app/admin/store/page.tsx
//
// HBStore admin paneli — orchestrator. Hook'ları bağlar, sekme dispatch'i yapar.
// Tüm business logic _hooks/ altında, UI parçaları _components/ altında.

"use client";

import { HataMesajiContainer } from "@/components/HataMesaji";
import { useStoreAdminPanel } from "./_hooks/useStoreAdminPanel";
import { useKategoriYonetimi } from "./_hooks/useKategoriYonetimi";
import { useUrunYonetimi } from "./_hooks/useUrunYonetimi";
import { useSiparisYonetimi } from "./_hooks/useSiparisYonetimi";

import SekmeBari from "./_components/SekmeBari";
import UrunlerSekmesi from "./_components/UrunlerSekmesi";
import KategorilerSekmesi from "./_components/KategorilerSekmesi";
import SiparislerSekmesi from "./_components/SiparislerSekmesi";

export default function AdminStorePage() {
  const admin = useStoreAdminPanel();

  const kategori = useKategoriYonetimi({
    hata: admin.hata,
    basari: admin.basari,
  });

  const urun = useUrunYonetimi({
    hata: admin.hata,
    basari: admin.basari,
  });

  const siparis = useSiparisYonetimi({
    hata: admin.hata,
    basari: admin.basari,
  });

  if (admin.yukleniyor || !admin.kullanici) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Nunito', sans-serif" }}>
      {/* Top bar */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 80px",
        borderBottom: "0.5px solid #e5e7eb",
      }}>
        <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: 0 }}>
          HBStore Yönetimi
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "12px", color: "#737373" }}>
            {admin.kullanici.ad} {admin.kullanici.soyad}
          </span>
          <button
            onClick={admin.cikisYap}
            style={{
              padding: "6px 12px",
              background: "#1d4ed8",
              border: "none",
              borderRadius: "6px",
              fontSize: "12px",
              color: "white",
              cursor: "pointer",
            }}
          >
            Çıkış
          </button>
        </div>
      </div>

      <HataMesajiContainer mesajlar={admin.mesajlar} />

      {/* Ana içerik */}
      <div style={{ padding: "20px 80px" }}>
        <SekmeBari aktifSekme={admin.aktifSekme} setAktifSekme={admin.setAktifSekme} />

        {admin.aktifSekme === "urunler" && (
          <UrunlerSekmesi {...urun} hata={admin.hata} basari={admin.basari} />
        )}
        {admin.aktifSekme === "kategoriler" && (
          <KategorilerSekmesi {...kategori} hata={admin.hata} basari={admin.basari} />
        )}
        {admin.aktifSekme === "siparisler" && (
          <SiparislerSekmesi {...siparis} hata={admin.hata} basari={admin.basari} />
        )}
      </div>
    </div>
  );
}