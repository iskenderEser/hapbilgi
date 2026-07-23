// app/admin/_components/TalepYayinSilModal.tsx
//
// Talep/Yayın Silme — Adım 4 (24.07.2026). İki mod (radyo):
//   • Tekil: görünen ID gir → Önizle (özet + puan var mı) → Sil. Sonuç
//     "durdurulabilir" ise (puanlı yayın) durdurma önerilir.
//   • Toplu: eski "Test Verilerini Sil" — puanlı yayınları koruyup gerisini siler.
// Uçlar: GET/POST /admin/api/talep-sil, POST /admin/api/test-verileri-sil.

"use client";

import { useState } from "react";

interface Props {
  acik: boolean;
  onKapat: () => void;
  basari: (mesaj: string) => void;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
}

interface Onizleme {
  talep_id: string;
  gorunen_id: string;
  firma_adi: string;
  urun_adi: string;
  teknik_adi: string;
  yayin_var: boolean;
  puan_var: boolean;
  durum: string;
}

const KUTU: React.CSSProperties = {
  background: "white", borderRadius: "12px", padding: "24px",
  maxWidth: "480px", width: "90%", fontFamily: "'Nunito', sans-serif",
  boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
};

const TOPLU_KORUNAN =
  "Puanlı yayınlar ve tüm bağlıları (üretim zinciri + izleme/puan kayıtları); " +
  "firmalar, takımlar, bölgeler, kullanıcılar, E-Club kişileri/eczaneleri, " +
  "Eczanem müşterileri/üyelikleri/tarifeleri, ürünler, teknikler, kategoriler. " +
  "İptal edilmemiş siparişlerin stokları iade edilir.";

export default function TalepYayinSilModal({ acik, onKapat, basari, hata }: Props) {
  const [mod, setMod] = useState<"tekil" | "toplu">("tekil");
  const [id, setId] = useState("");
  const [onizleme, setOnizleme] = useState<Onizleme | null>(null);
  const [durdurSor, setDurdurSor] = useState(false); // puanlı → durdur öner
  const [yukleniyor, setYukleniyor] = useState(false);

  if (!acik) return null;

  const kapat = () => {
    if (yukleniyor) return;
    setId(""); setOnizleme(null); setDurdurSor(false); setMod("tekil");
    onKapat();
  };

  const onizle = async () => {
    setYukleniyor(true); setOnizleme(null); setDurdurSor(false);
    try {
      const res = await fetch(`/admin/api/talep-sil?id=${encodeURIComponent(id.trim())}`);
      const d = await res.json();
      if (res.status === 404 || d?.bulundu === false) {
        hata("Talep bulunamadı. Görünen ID'yi kontrol edin.", "talep-sil önizleme");
      } else if (!res.ok) {
        hata(d?.hata ?? "Önizleme alınamadı.", "talep-sil önizleme");
      } else {
        setOnizleme(d as Onizleme);
      }
    } catch {
      hata("Önizleme isteği gönderilemedi.", "talep-sil önizleme");
    }
    setYukleniyor(false);
  };

  const sil = async () => {
    if (!onizleme) return;
    setYukleniyor(true);
    try {
      const res = await fetch("/admin/api/talep-sil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: onizleme.gorunen_id, islem: "sil" }),
      });
      const d = await res.json();
      if (!res.ok) {
        hata(d?.hata ?? "Silme başarısız.", "talep-sil");
      } else if (d?.durum === "durdurulabilir") {
        setDurdurSor(true); // puanlı yayın — silinemez, durdurma önerilir
      } else if (d?.durum === "silindi") {
        basari(`Talep silindi (${onizleme.gorunen_id}).`);
        kapat();
      } else {
        hata("Beklenmeyen yanıt.", "talep-sil", JSON.stringify(d));
      }
    } catch {
      hata("Silme isteği gönderilemedi.", "talep-sil");
    }
    setYukleniyor(false);
  };

  const durdur = async () => {
    if (!onizleme) return;
    setYukleniyor(true);
    try {
      const res = await fetch("/admin/api/talep-sil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: onizleme.gorunen_id, islem: "durdur" }),
      });
      const d = await res.json();
      if (!res.ok) hata(d?.hata ?? "Durdurma başarısız.", "talep-sil durdur");
      else { basari(`Yayın durduruldu (${onizleme.gorunen_id}).`); kapat(); }
    } catch {
      hata("Durdurma isteği gönderilemedi.", "talep-sil durdur");
    }
    setYukleniyor(false);
  };

  const topluSil = async () => {
    setYukleniyor(true);
    try {
      const res = await fetch("/admin/api/test-verileri-sil", { method: "POST" });
      const d = await res.json();
      if (!res.ok) hata(d?.hata ?? "Toplu silme başarısız.", "test-verileri-sil");
      else { basari(d?.mesaj ?? "Test verileri silindi."); kapat(); }
    } catch {
      hata("Toplu silme isteği gönderilemedi.", "test-verileri-sil");
    }
    setYukleniyor(false);
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
      onClick={kapat}
    >
      <div style={KUTU} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: "16px", fontWeight: 700, color: "#b91c1c", marginBottom: "12px" }}>
          Talep / Yayın Silme
        </div>

        {/* Mod seçimi */}
        <div style={{ display: "flex", gap: "16px", marginBottom: "16px", fontSize: "13px", color: "#374151" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
            <input type="radio" checked={mod === "tekil"} onChange={() => { setMod("tekil"); setDurdurSor(false); }} disabled={yukleniyor} />
            Tekil (talep/yayın)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
            <input type="radio" checked={mod === "toplu"} onChange={() => { setMod("toplu"); setDurdurSor(false); }} disabled={yukleniyor} />
            Toplu (test verileri)
          </label>
        </div>

        {mod === "tekil" ? (
          <>
            <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
              <input
                value={id}
                onChange={(e) => { setId(e.target.value); setOnizleme(null); setDurdurSor(false); }}
                placeholder="Görünen ID (ör. hepifarma_30008)"
                disabled={yukleniyor}
                style={{ flex: 1, padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "13px", fontFamily: "'Nunito', sans-serif" }}
              />
              <button
                onClick={onizle}
                disabled={yukleniyor || !id.trim()}
                style={{ padding: "8px 16px", background: "#374151", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600, color: "white", cursor: yukleniyor || !id.trim() ? "not-allowed" : "pointer", opacity: yukleniyor || !id.trim() ? 0.6 : 1, fontFamily: "'Nunito', sans-serif" }}
              >
                Önizle
              </button>
            </div>

            {onizleme && !durdurSor && (
              <>
                <div style={{ fontSize: "12px", color: "#374151", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px", marginBottom: "14px", lineHeight: 1.7 }}>
                  <div><b>Firma:</b> {onizleme.firma_adi}</div>
                  <div><b>Ürün:</b> {onizleme.urun_adi} &nbsp; <b>Teknik:</b> {onizleme.teknik_adi}</div>
                  <div><b>Durum:</b> {onizleme.durum}</div>
                  <div style={{ marginTop: "4px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px", background: onizleme.puan_var ? "#fef2f2" : "#f0fdf4", color: onizleme.puan_var ? "#b91c1c" : "#166534" }}>
                      {onizleme.puan_var ? "PUANLI — silinemez, durdurulabilir" : "Puansız — silinebilir"}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button onClick={kapat} disabled={yukleniyor} style={btnGri(yukleniyor)}>Vazgeç</button>
                  <button onClick={sil} disabled={yukleniyor} style={btnKirmizi(yukleniyor)}>
                    {yukleniyor ? "Siliniyor..." : "Sil"}
                  </button>
                </div>
              </>
            )}

            {durdurSor && (
              <>
                <div style={{ fontSize: "13px", color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", padding: "12px", marginBottom: "14px" }}>
                  Bu yayını silemezsiniz — puanlı. <b>Durdurmak ister misiniz?</b>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button onClick={() => setDurdurSor(false)} disabled={yukleniyor} style={btnGri(yukleniyor)}>Hayır</button>
                  <button onClick={durdur} disabled={yukleniyor} style={{ ...btnKirmizi(yukleniyor), background: "#d97706" }}>
                    {yukleniyor ? "Durduruluyor..." : "Evet, durdur"}
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div style={{ fontSize: "13px", color: "#374151", marginBottom: "10px" }}>
              Tüm test kayıtları silinir; <b>puanlı yayınlar korunur.</b>
            </div>
            <div style={{ fontSize: "12px", color: "#166534", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "8px 10px", marginBottom: "16px" }}>
              <b>Korunacaklar:</b> {TOPLU_KORUNAN}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button onClick={kapat} disabled={yukleniyor} style={btnGri(yukleniyor)}>Vazgeç</button>
              <button onClick={topluSil} disabled={yukleniyor} style={btnKirmizi(yukleniyor)}>
                {yukleniyor ? "Siliniyor..." : "Evet, sil"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function btnGri(disabled: boolean): React.CSSProperties {
  return { padding: "8px 16px", background: "transparent", border: "0.5px solid #9ca3af", borderRadius: "8px", fontSize: "13px", color: "#374151", cursor: disabled ? "not-allowed" : "pointer", fontFamily: "'Nunito', sans-serif" };
}
function btnKirmizi(disabled: boolean): React.CSSProperties {
  return { padding: "8px 16px", background: "#dc2626", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 700, color: "white", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, fontFamily: "'Nunito', sans-serif" };
}
