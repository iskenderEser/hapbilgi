// app/admin/_components/TestVeriSilModal.tsx
//
// Test verilerini silme onay modalı. Admin üst barındaki kırmızı butonla
// açılır; neyin silinip neyin korunacağını özetler, "Evet" onayıyla
// /admin/api/test-verileri-sil'i çağırır (uç proxy'de admin-korumalıdır).
// Sonuç: başarılıysa özet mesaj; tabloda hata varsa ilk hatalar gösterilir.
// Deploy öncesi bu araç bütünüyle kaldırılacaktır (redbook §6.4).

"use client";

import { useState } from "react";

interface Props {
  acik: boolean;
  onKapat: () => void;
  basari: (mesaj: string) => void;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
}

const SILINECEKLER = [
  "Üretim hattı: talepler, senaryolar, videolar, soru setleri, yayınlar, tur kayıtları",
  "İzleme & puan: izlemeler, cevaplar, kazanılan puanlar, kayıplar, beğeni/favori, bildirimler",
  "Öneriler ve Challenge Club kayıtları",
  "E-Club: öneriler, izlemeler, puanlar, bildirimler, store siparişleri/adresleri",
  "Eczanem: davetler, OTP, gönderimler, izlemeler, puanlar, harcamalar, siparişler",
  "HBStore: siparişler, puan harcamaları, adresler",
];

const KORUNANLAR =
  "Firmalar, takımlar, bölgeler, kullanıcılar, E-Club kişileri/eczaneleri, " +
  "Eczanem müşterileri/üyelikleri/tarifeleri, ürünler, teknikler, kategoriler, sistem ayarları. " +
  "İptal edilmemiş siparişlerin stokları silinmeden önce iade edilir.";

export default function TestVeriSilModal({ acik, onKapat, basari, hata }: Props) {
  const [siliniyor, setSiliniyor] = useState(false);

  if (!acik) return null;

  const handleSil = async () => {
    setSiliniyor(true);
    try {
      const res = await fetch("/admin/api/test-verileri-sil", { method: "POST" });
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? d.error ?? "Test verileri silinemedi.", d.adim, d.detay);
      } else {
        const hatalilar = (d.detay ?? []).filter((s: { durum: string }) => s.durum === "hata");
        basari(d.mesaj ?? "Test verileri silindi.");
        if (hatalilar.length > 0) {
          hata(
            `${hatalilar.length} tabloda silme hatası oluştu.`,
            "test-verileri-sil",
            hatalilar.slice(0, 3).map((s: { tablo: string; detay?: string }) => `${s.tablo}: ${s.detay ?? "?"}`).join(" | ")
          );
        }
      }
    } catch (e) {
      hata("Silme isteği gönderilemedi.", "test-verileri-sil fetch", e instanceof Error ? e.message : String(e));
    }
    setSiliniyor(false);
    onKapat();
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(17,24,39,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
      }}
      onClick={siliniyor ? undefined : onKapat}
    >
      <div
        style={{
          background: "white", borderRadius: "12px", padding: "24px",
          maxWidth: "480px", width: "90%", fontFamily: "'Nunito', sans-serif",
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: "16px", fontWeight: 700, color: "#b91c1c", marginBottom: "8px" }}>
          Test Verilerini Sil
        </div>
        <div style={{ fontSize: "13px", color: "#374151", marginBottom: "10px" }}>
          Bu veriler <b>kalıcı olarak</b> silinecek:
        </div>
        <ul style={{ fontSize: "12px", color: "#4b5563", margin: "0 0 12px 0", paddingLeft: "18px", lineHeight: 1.7 }}>
          {SILINECEKLER.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
        <div style={{ fontSize: "12px", color: "#166534", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "8px 10px", marginBottom: "16px" }}>
          <b>Korunacaklar:</b> {KORUNANLAR}
        </div>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "#111827", marginBottom: "14px" }}>
          Onaylıyor musun?
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button
            onClick={onKapat}
            disabled={siliniyor}
            style={{
              padding: "8px 16px", background: "transparent", border: "0.5px solid #9ca3af",
              borderRadius: "8px", fontSize: "13px", color: "#374151",
              cursor: siliniyor ? "not-allowed" : "pointer", fontFamily: "'Nunito', sans-serif",
            }}
          >
            Hayır, vazgeç
          </button>
          <button
            onClick={handleSil}
            disabled={siliniyor}
            style={{
              padding: "8px 16px", background: "#dc2626", border: "none",
              borderRadius: "8px", fontSize: "13px", fontWeight: 700, color: "white",
              cursor: siliniyor ? "not-allowed" : "pointer", opacity: siliniyor ? 0.6 : 1,
              fontFamily: "'Nunito', sans-serif",
            }}
          >
            {siliniyor ? "Siliniyor..." : "Evet, sil"}
          </button>
        </div>
      </div>
    </div>
  );
}
