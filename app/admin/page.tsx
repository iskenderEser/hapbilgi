// app/admin/page.tsx
//
// Admin paneli — orchestrator. Hook'ları bağlar, sekme dispatch'i yapar.
// Tüm business logic _hooks/ altında, UI parçaları _components/ altında.

"use client";

import { HataMesajiContainer } from "@/components/HataMesaji";
import { useAdminPanel } from "./_hooks/useAdminPanel";
import { useTekilForm } from "./_hooks/useTekilForm";
import { useTopluForm } from "./_hooks/useTopluForm";
import { useTakimBolgeForm } from "./_hooks/useTakimBolgeForm";
import { useUrunTeknik } from "./_hooks/useUrunTeknik";
import { useKullaniciListesi } from "./_hooks/useKullaniciListesi";

import FirmaSidebar from "./_components/FirmaSidebar";
import SekmeBari from "./_components/SekmeBari";
import TekilGirisFormu from "./_components/TekilGirisFormu";
import TopluGirisFormu from "./_components/TopluGirisFormu";
import TakimBolgeFormu from "./_components/TakimBolgeFormu";
import UrunTeknikYonetimi from "./_components/UrunTeknikYonetimi";
import KullaniciListesi from "./_components/KullaniciListesi";

export default function AdminPanel() {
  const admin = useAdminPanel();

  const tekil = useTekilForm({
    seciliFirma: admin.seciliFirma,
    takimlar: admin.takimlar,
    refreshKullanicilar: admin.refreshKullanicilar,
    hata: admin.hata,
    basari: admin.basari,
  });

  const toplu = useTopluForm({
    seciliFirma: admin.seciliFirma,
    refreshKullanicilar: admin.refreshKullanicilar,
    hata: admin.hata,
    basari: admin.basari,
  });

  const takimBolge = useTakimBolgeForm({
    seciliFirma: admin.seciliFirma,
    refreshTakimlar: admin.refreshTakimlar,
    hata: admin.hata,
    basari: admin.basari,
  });

  const urunTeknik = useUrunTeknik({
    seciliFirma: admin.seciliFirma,
    takimlar: admin.takimlar,
    hata: admin.hata,
    basari: admin.basari,
  });

  const kullaniciListesi = useKullaniciListesi({
    seciliFirma: admin.seciliFirma,
    kullanicilar: admin.kullanicilar,
    refreshKullanicilar: admin.refreshKullanicilar,
    hata: admin.hata,
    basari: admin.basari,
  });

  if (admin.yukleniyor || !admin.kullanici) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Nunito', sans-serif" }}>
      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 80px", borderBottom: "0.5px solid #e5e7eb" }}>
        <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: 0 }}>
          Admin Paneli
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
      <div style={{ display: "flex", minHeight: "calc(100vh - 50px)" }}>
        <FirmaSidebar
          firmalar={admin.firmalar}
          seciliFirma={admin.seciliFirma}
          yeniFirmaAdi={admin.yeniFirmaAdi}
          setYeniFirmaAdi={admin.setYeniFirmaAdi}
          handleFirmaEkle={admin.handleFirmaEkle}
          handleFirmaSecildi={admin.handleFirmaSecildi}
          handleStoreToggle={admin.handleStoreToggle}
          handleCcToggle={admin.handleCcToggle}
          handleFirmaToggle={admin.handleFirmaToggle}
          handleFirmaSil={admin.handleFirmaSil}
          handleExport={admin.handleExport}
          loading={admin.loading}
        />

        <div style={{ flex: 1, padding: "20px", overflow: "auto" }}>
          {!admin.seciliFirma ? (
            <p style={{ fontSize: "13px", color: "#737373" }}>
              Soldan bir firma seçin.
            </p>
          ) : (
            <>
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#111", marginBottom: "16px" }}>
                {admin.seciliFirma.firma_adi}
              </h2>

              <SekmeBari girisSecimi={admin.girisSecimi} setGirisSecimi={admin.setGirisSecimi} />

              {admin.girisSecimi === "tekil" && (
                <TekilGirisFormu takimlar={admin.takimlar} {...tekil} />
              )}
              {admin.girisSecimi === "toplu" && <TopluGirisFormu {...toplu} />}
              {admin.girisSecimi === "takim" && <TakimBolgeFormu {...takimBolge} />}
              {admin.girisSecimi === "urun" && (
                <UrunTeknikYonetimi takimlar={admin.takimlar} {...urunTeknik} />
              )}

              <KullaniciListesi {...kullaniciListesi} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}