// app/admin/page.tsx
//
// Admin paneli — orchestrator (M2 kabuğu, admin modernizasyon planı B.2).
// Yerleşim: üst bar (global bölümler — GLOBAL_BOLUMLER) + sol FirmaSidebar
// (firma seçimi) + firma bağlamı modül sekmeleri (MODUL_SEKMELERI).
// Tüm business logic _hooks/ altında, UI parçaları _components/ altında.
//
// Firma admini hazırlığı (K-A1): sekme/bölüm görünürlüğü _constants'taki
// tek kaynaktan gelir; rol bazlı kapatma ileride oradan yapılır.

"use client";

import { useState } from "react";
import { HataMesajiContainer } from "@/components/HataMesaji";
import { useAdminPanel } from "./_hooks/useAdminPanel";
import { useTekilForm } from "./_hooks/useTekilForm";
import { useTopluForm } from "./_hooks/useTopluForm";
import { useTakimBolgeForm } from "./_hooks/useTakimBolgeForm";
import { useUrunTeknik } from "./_hooks/useUrunTeknik";
import { useKullaniciListesi } from "./_hooks/useKullaniciListesi";

import AdminUstBar from "./_components/AdminUstBar";
import FirmaSidebar from "./_components/FirmaSidebar";
import ModulSekmeBari from "./_components/ModulSekmeBari";
import ModulDurumKarti from "./_components/ModulDurumKarti";
import SekmeBari from "./_components/SekmeBari";
import TekilGirisFormu from "./_components/TekilGirisFormu";
import TopluGirisFormu from "./_components/TopluGirisFormu";
import TakimBolgeFormu from "./_components/TakimBolgeFormu";
import UrunTeknikYonetimi from "./_components/UrunTeknikYonetimi";
import KullaniciListesi from "./_components/KullaniciListesi";
import SistemAyarlari from "./_components/SistemAyarlari";
import TestVeriSilModal from "./_components/TestVeriSilModal";
import HbStorePaneli from "./_components/global/HbStorePaneli";
import EclubStorePaneli from "./_components/global/EclubStorePaneli";
import EclubYonetimPaneli from "./eclub/_components/EclubYonetimPaneli";

import type { GlobalBolumId, ModulSekmeId } from "./_constants";

export default function AdminPanel() {
  const admin = useAdminPanel();

  // M2 kabuk state'i: firma bağlamı sekmesi + global bölüm (üst bar).
  const [seciliSekme, setSeciliSekme] = useState<ModulSekmeId>("kullanicilar");
  const [globalBolum, setGlobalBolum] = useState<GlobalBolumId | null>(null);

  // Test verilerini silme onay modalı (test dönemi aracı — deploy öncesi kaldırılır).
  const [testSilAcik, setTestSilAcik] = useState(false);

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

  // Firma seçilince global görünüm kapanır, firma bağlamına dönülür.
  const handleFirmaSecildi = (...args: Parameters<typeof admin.handleFirmaSecildi>) => {
    setGlobalBolum(null);
    return admin.handleFirmaSecildi(...args);
  };

  // Kullanıcılar sekmesine dönüşte alt-sekme varsayılana çekilir;
  // Organizasyon ve Ürün & Teknik alt-sekmesiz doğrudan render edilir.
  const handleSekmeSec = (sekme: ModulSekmeId) => {
    setSeciliSekme(sekme);
    if (sekme === "kullanicilar") admin.setGirisSecimi("tekil");
  };

  if (admin.yukleniyor || !admin.kullanici) return null;

  const f = admin.seciliFirma;
  const kapaliModuller: ModulSekmeId[] = f
    ? [
        ...(f.cc_aktif ? [] : ["cclub" as const]),
        ...(f.eclub_aktif ? [] : ["eclub" as const]),
      ]
    : [];

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Nunito', sans-serif" }}>
      <AdminUstBar
        kullaniciAd={`${admin.kullanici.ad} ${admin.kullanici.soyad}`}
        globalBolum={globalBolum}
        setGlobalBolum={setGlobalBolum}
        onTestSil={() => setTestSilAcik(true)}
        onCikis={admin.cikisYap}
      />

      <HataMesajiContainer mesajlar={admin.mesajlar} />

      <TestVeriSilModal
        acik={testSilAcik}
        onKapat={() => setTestSilAcik(false)}
        basari={admin.basari}
        hata={admin.hata}
      />

      <div style={{ display: "flex", minHeight: "calc(100vh - 54px)" }}>
        <FirmaSidebar
          firmalar={admin.firmalar}
          seciliFirma={admin.seciliFirma}
          yeniFirmaAdi={admin.yeniFirmaAdi}
          setYeniFirmaAdi={admin.setYeniFirmaAdi}
          handleFirmaEkle={admin.handleFirmaEkle}
          handleFirmaSecildi={handleFirmaSecildi}
          handleStoreToggle={admin.handleStoreToggle}
          handleCcToggle={admin.handleCcToggle}
          handleEclubToggle={admin.handleEclubToggle}
          handleEclubStoreToggle={admin.handleEclubStoreToggle}
          handleFirmaToggle={admin.handleFirmaToggle}
          handleFirmaSil={admin.handleFirmaSil}
          handleExport={admin.handleExport}
          loading={admin.loading}
        />

        <div style={{ flex: 1, padding: "20px 24px", overflow: "auto" }}>
          {globalBolum === "sistem" ? (
            <SistemAyarlari hata={admin.hata} basari={admin.basari} />
          ) : globalBolum === "hbstore" ? (
            <HbStorePaneli hata={admin.hata} basari={admin.basari} />
          ) : globalBolum === "eclubstore" ? (
            <EclubStorePaneli hata={admin.hata} basari={admin.basari} />
          ) : !f ? (
            <p style={{ fontSize: "13px", color: "#737373" }}>Soldan bir firma seçin.</p>
          ) : (
            <>
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#111", marginBottom: "16px" }}>
                {f.firma_adi}
              </h2>

              <ModulSekmeBari
                seciliSekme={seciliSekme}
                setSeciliSekme={handleSekmeSec}
                kapaliModuller={kapaliModuller}
              />

              {seciliSekme === "kullanicilar" && (
                <>
                  <SekmeBari
                    girisSecimi={admin.girisSecimi}
                    setGirisSecimi={admin.setGirisSecimi}
                  />
                  {admin.girisSecimi === "tekil" && (
                    <TekilGirisFormu takimlar={admin.takimlar} {...tekil} />
                  )}
                  {admin.girisSecimi === "toplu" && <TopluGirisFormu {...toplu} />}
                  <KullaniciListesi {...kullaniciListesi} />
                </>
              )}

              {seciliSekme === "organizasyon" && <TakimBolgeFormu {...takimBolge} />}

              {seciliSekme === "urunteknik" && (
                <UrunTeknikYonetimi takimlar={admin.takimlar} {...urunTeknik} />
              )}

              {seciliSekme === "tclub" && (
                <ModulDurumKarti
                  baslik="T-Club"
                  acik={null}
                  aciklama="Temsilcilerin sürekli öğrenme modülü — üretim hattı, yayınlar, izleme ve puan akışları. Ana modüldür; firma bazında kapatılmaz."
                />
              )}

              {seciliSekme === "cclub" && (
                <ModulDurumKarti
                  baslik="C-Club (Challenge Club)"
                  acik={f.cc_aktif}
                  onToggle={() => admin.handleCcToggle(f)}
                  aciklama="Değişim liderlerinin modülü — challenge akışları ve CC ligi. Kapalıyken bu firmanın hiçbir kullanıcısı C-Club'a erişemez."
                />
              )}

              {seciliSekme === "eclub" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <ModulDurumKarti
                    baslik="E-Club"
                    acik={f.eclub_aktif}
                    onToggle={() => admin.handleEclubToggle(f)}
                    aciklama="Eczanelere özel tanıtım modülü — eczane onayları, kayıtlı eczane/kişi yönetimi ve öneri akışları."
                    m4NotuGoster={false}
                  />
                  <EclubYonetimPaneli hata={admin.hata} basari={admin.basari} />
                </div>
              )}

              {seciliSekme === "eczanem" && (
                <ModulDurumKarti
                  baslik="Eczanem"
                  acik={null}
                  aciklama="Eczanenin danışanlarının bilgilenme modülü — gönderimler, üyeler, siparişler ve tarifeler. Firma bayrağı (eczanem_aktif) admin yönetimine M4'te bağlanacak."
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
