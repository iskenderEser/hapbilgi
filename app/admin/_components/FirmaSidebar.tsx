// app/admin/_components/FirmaSidebar.tsx
//
// Admin panel sol paneli: firma listesi + yeni firma ekleme formu.
// Her firma bir kart: ad + (Firma aktif/pasif · Mağaza aç/kapa · Sil) +
// (Dışa aktar · İçe aktar). Dışa/İçe aktar butonları şimdilik devre dışıdır
// (mantık sonraki aşamada eklenecek). Pasif firma soluk + "Pasif" rozeti.

"use client";

import type { Firma } from "../_types";

interface FirmaSidebarProps {
  firmalar: Firma[];
  seciliFirma: Firma | null;
  yeniFirmaAdi: string;
  setYeniFirmaAdi: (v: string) => void;
  handleFirmaEkle: (e: React.FormEvent) => void | Promise<void>;
  handleFirmaSecildi: (f: Firma) => void;
  handleStoreToggle: (f: Firma) => void | Promise<void>;
  handleFirmaToggle: (f: Firma) => void | Promise<void>;
  handleFirmaSil: (f: Firma) => Promise<boolean>;
  handleExport: (f: Firma) => void | Promise<void>;
  loading: boolean;
}

// Kaydırmalı switch (toggle) — açık/kapalı görsel durum.
function Switch({
  acik,
  renk,
  onClick,
  baslik,
}: {
  acik: boolean;
  renk: string;
  onClick: () => void;
  baslik: string;
}) {
  return (
    <button
      onClick={onClick}
      title={baslik}
      style={{
        flexShrink: 0,
        width: "34px",
        height: "19px",
        borderRadius: "999px",
        border: "none",
        background: acik ? renk : "#d1d5db",
        position: "relative",
        cursor: "pointer",
        padding: 0,
        transition: "background 0.15s",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "2px",
          left: acik ? "17px" : "2px",
          width: "15px",
          height: "15px",
          borderRadius: "50%",
          background: "white",
          transition: "left 0.15s",
        }}
      />
    </button>
  );
}

export default function FirmaSidebar({
  firmalar,
  seciliFirma,
  yeniFirmaAdi,
  setYeniFirmaAdi,
  handleFirmaEkle,
  handleFirmaSecildi,
  handleStoreToggle,
  handleFirmaToggle,
  handleFirmaSil,
  handleExport,
  loading,
}: FirmaSidebarProps) {

  const silTikla = async (f: Firma) => {
    // Onay iste (geri alınamaz işlem). API ayrıca export koşulunu kontrol eder;
    // export edilmemişse hata mesajı döner (kullanıcı bilgilendirilir).
    const onay = window.confirm(
      `"${f.firma_adi}" firmasını silmek üzeresiniz. Bu işlem geri alınamaz.\n\nFirmanın verileri dışa aktarılmamışsa silme işlemi engellenir.\n\nDevam edilsin mi?`
    );
    if (!onay) return;
    await handleFirmaSil(f);
  };

  return (
    <div style={{ width: "300px", borderRight: "0.5px solid #e5e7eb", padding: "20px", flexShrink: 0 }}>
      <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#111", marginBottom: "16px", fontFamily: "'Nunito', sans-serif" }}>
        Firmalar
      </h2>

      <form onSubmit={handleFirmaEkle} style={{ marginBottom: "20px", display: "flex", gap: "6px" }}>
        <input
          type="text"
          value={yeniFirmaAdi}
          onChange={(e) => setYeniFirmaAdi(e.target.value)}
          placeholder="Yeni firma adı..."
          style={{
            flex: 1,
            padding: "8px 10px",
            border: "0.5px solid #e5e7eb",
            borderRadius: "6px",
            fontSize: "13px",
            outline: "none",
            fontFamily: "'Nunito', sans-serif",
            color: "#111",
          }}
        />
        <button
          type="submit"
          disabled={!yeniFirmaAdi.trim()}
          style={{
            padding: "8px 14px",
            background: yeniFirmaAdi.trim() ? "#1d4ed8" : "#d1d5db",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: yeniFirmaAdi.trim() ? "pointer" : "not-allowed",
            fontFamily: "'Nunito', sans-serif",
          }}
        >
          Ekle
        </button>
      </form>

      {loading ? (
        <p style={{ fontSize: "13px", color: "#737373" }}>Yükleniyor...</p>
      ) : firmalar.length === 0 ? (
        <p style={{ fontSize: "13px", color: "#737373" }}>Henüz firma yok.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {firmalar.map((f, i) => {
            const secili = seciliFirma?.firma_id === f.firma_id;
            const pasif = !f.aktif;
            // Zebra: dönüşümlü arka plan. Seçili firma vurgulanır.
            const zebraBg = i % 2 === 0 ? "#ffffff" : "#fafafa";
            const kartBg = secili ? "#eff6ff" : zebraBg;
            const kartBorder = secili ? "0.5px solid #93c5fd" : "0.5px solid #e5e7eb";

            return (
              <div
                key={f.firma_id}
                style={{
                  background: kartBg,
                  border: kartBorder,
                  borderRadius: "10px",
                  padding: "12px",
                  opacity: pasif ? 0.65 : 1,
                }}
              >
                {/* Firma adı (seçim) + pasif rozeti */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <button
                    onClick={() => handleFirmaSecildi(f)}
                    style={{
                      flex: 1,
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      fontSize: "14px",
                      fontWeight: secili ? 700 : 500,
                      color: secili ? "#1d4ed8" : "#111",
                      cursor: "pointer",
                      fontFamily: "'Nunito', sans-serif",
                    }}
                  >
                    {f.firma_adi}
                  </button>
                  {pasif && (
                    <span
                      style={{
                        fontSize: "11px",
                        background: "#fef2f2",
                        color: "#bc2d0d",
                        padding: "2px 8px",
                        borderRadius: "999px",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Pasif
                    </span>
                  )}
                </div>

                {/* Aksiyon satırı: Firma toggle · Mağaza toggle · Sil */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "#737373", fontFamily: "'Nunito', sans-serif" }}>
                    <Switch
                      acik={f.aktif}
                      renk="#10b981"
                      onClick={() => handleFirmaToggle(f)}
                      baslik={f.aktif ? "Firma aktif — pasifleştirmek için tıkla" : "Firma pasif — aktifleştirmek için tıkla"}
                    />
                    Firma
                  </span>

                  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "#737373", fontFamily: "'Nunito', sans-serif" }}>
                    <Switch
                      acik={f.hbstore_aktif}
                      renk="#1d4ed8"
                      onClick={() => handleStoreToggle(f)}
                      baslik={f.hbstore_aktif ? "Mağaza açık — kapatmak için tıkla" : "Mağaza kapalı — açmak için tıkla"}
                    />
                    Mağaza
                  </span>

                  <button
                    onClick={() => silTikla(f)}
                    title="Firmayı sil"
                    style={{
                      marginLeft: "auto",
                      flexShrink: 0,
                      padding: "5px 9px",
                      background: "transparent",
                      border: "0.5px solid #fecaca",
                      borderRadius: "6px",
                      fontSize: "12px",
                      color: "#bc2d0d",
                      cursor: "pointer",
                      fontFamily: "'Nunito', sans-serif",
                    }}
                  >
                    Sil
                  </button>
                </div>

                {/* Dışa aktar — firmanın verilerini Excel olarak indirir */}
                <div style={{ display: "flex" }}>
                  <button
                    onClick={() => handleExport(f)}
                    title="Firma verilerini Excel olarak dışa aktar"
                    style={{
                      flex: 1,
                      padding: "6px",
                      background: "#ffffff",
                      border: "0.5px solid #1d4ed8",
                      borderRadius: "6px",
                      fontSize: "12px",
                      color: "#1d4ed8",
                      cursor: "pointer",
                      fontFamily: "'Nunito', sans-serif",
                    }}
                  >
                    Dışa aktar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}