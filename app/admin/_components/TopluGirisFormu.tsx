// app/admin/_components/TopluGirisFormu.tsx
//
// Toplu kullanıcı ekleme: CSV/XLSX dosya yükleme + önizleme tablosu + kaydet.
// useTopluForm hook'unun return değerlerini prop alır.

"use client";

import { btnBase } from "../_constants";
import type { OnizlemeSatir } from "../_types";
import type { TopluKaydetSonucu } from "../_hooks/useTopluForm";

interface TopluGirisFormuProps {
  topluDosya: File | null;
  onizlemesatirlari: OnizlemeSatir[] | null;
  onizlemeLoading: boolean;
  topluKaydetLoading: boolean;
  hazirSayisi: number;
  eksikSayisi: number;
  hataliSayisi: number;
  kaydetSonucu: TopluKaydetSonucu | null;
  handleDosyaSec: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleTopluKaydet: () => void;
}

const tarz_th: React.CSSProperties = {
  padding: "8px 10px",
  textAlign: "left",
  borderBottom: "0.5px solid #e5e7eb",
  fontWeight: 700,
  color: "#374151",
  whiteSpace: "nowrap",
};

const tarz_td: React.CSSProperties = {
  padding: "6px 10px",
  borderBottom: "0.5px solid #f3f4f6",
  color: "#111",
};

// B-25 — şablon indir: insan başlıklı, tek örnek satırlı XLSX üretir.
// xlsx tıklamada dinamik import edilir (sayfa yüküne binmez).
async function sablonIndir() {
  const XLSX = await import("xlsx");
  const sayfa = XLSX.utils.aoa_to_sheet([
    ["Ad", "Soyad", "E-posta", "Şifre", "Rol", "Takım", "Bölge"],
    ["Ali", "Veli", "ali.veli@ornek.com", "gizli123", "Ürün Tanıtım Temsilcisi", "Kardiyoloji", "Kadıköy"],
  ]);
  const kitap = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(kitap, sayfa, "Kullanicilar");
  XLSX.writeFile(kitap, "kullanici_yukleme_sablonu.xlsx");
}

export default function TopluGirisFormu(p: TopluGirisFormuProps) {
  return (
    <div style={{ maxWidth: "1000px" }}>
      {/* Dosya seçme */}
      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#111", marginBottom: "8px", fontFamily: "'Nunito', sans-serif" }}>
          Dosya seç (CSV veya XLSX):
        </label>
        {/* Native input gizli; görünen buton proje stilinde (tarayıcının ham
            "Dosya Seç / Dosya seçilmedi" kontrolü yerine — UX düzenlemesi). */}
        <input
          id="toplu-dosya-input"
          type="file"
          accept=".csv,.xlsx"
          onChange={p.handleDosyaSec}
          style={{ display: "none" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <label
            htmlFor="toplu-dosya-input"
            style={{ ...btnBase, background: "white", color: "#111" }}
          >
            Dosya Seç
          </label>
          <button
            onClick={sablonIndir}
            style={{ ...btnBase, background: "white", color: "#737373" }}
          >
            Şablonu İndir
          </button>
          <span style={{ fontSize: "12px", color: "#737373", fontFamily: "'Nunito', sans-serif" }}>
            {p.topluDosya ? `Seçili: ${p.topluDosya.name}` : "Henüz dosya seçilmedi"}
          </span>
        </div>
      </div>

      {/* Yüklenme durumu */}
      {p.onizlemeLoading && (
        <p style={{ fontSize: "13px", color: "#737373", fontFamily: "'Nunito', sans-serif" }}>
          Dosya okunuyor...
        </p>
      )}

      {/* Önizleme tablosu */}
      {p.onizlemesatirlari && p.onizlemesatirlari.length > 0 && (
        <>
          <div style={{ marginBottom: "12px", display: "flex", gap: "12px", fontSize: "13px", fontWeight: 600, fontFamily: "'Nunito', sans-serif" }}>
            <span style={{ color: "#1d4ed8" }}>Hazır: {p.hazirSayisi}</span>
            {/* K-A6: eksik satırlar da yüklenir — ayrı sayaçla görünür */}
            <span style={{ color: "#d97706" }}>Eksik bilgili: {p.eksikSayisi}</span>
            <span style={{ color: "#dc2626" }}>Hatalı: {p.hataliSayisi}</span>
          </div>

          <div style={{ overflow: "auto", border: "0.5px solid #e5e7eb", borderRadius: "8px", marginBottom: "16px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", fontFamily: "'Nunito', sans-serif" }}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={tarz_th}>#</th>
                  <th style={tarz_th}>Ad</th>
                  <th style={tarz_th}>Soyad</th>
                  <th style={tarz_th}>Rol</th>
                  <th style={tarz_th}>E-posta</th>
                  <th style={tarz_th}>Takım</th>
                  <th style={tarz_th}>Bölge</th>
                  <th style={tarz_th}>Durum</th>
                </tr>
              </thead>
              <tbody>
                {p.onizlemesatirlari.map((s) => (
                  <tr key={s.index} style={{ background: s.durum === "hatali" ? "#fef2f2" : s.durum === "eksik" ? "#fffbeb" : "white" }}>
                    <td style={tarz_td}>{s.index}</td>
                    <td style={tarz_td}>{s.ad}</td>
                    <td style={tarz_td}>{s.soyad}</td>
                    <td style={tarz_td}>{s.rol}</td>
                    <td style={tarz_td}>{s.eposta}</td>
                    <td style={tarz_td}>{s.takim_adi}</td>
                    <td style={tarz_td}>{s.bolge_adi}</td>
                    <td style={tarz_td}>
                      {s.durum === "hazir" ? (
                        <span style={{ color: "#1d4ed8", fontWeight: 600 }}>Hazır</span>
                      ) : s.durum === "eksik" ? (
                        <span style={{ color: "#d97706", fontWeight: 600 }} title={s.uyari_mesaji}>
                          Eksik bilgili{s.uyari_mesaji ? ` — ${s.uyari_mesaji}` : " (takım/bölge yok)"}
                        </span>
                      ) : (
                        // B-25: hata yalnız tooltip'te değil, GÖRÜNÜR metin olarak.
                        <span style={{ color: "#dc2626", fontWeight: 600 }}>
                          Hatalı{s.hata_mesaji ? ` — ${s.hata_mesaji}` : ""}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Toplu kaydet — K-A6: eksik bilgili satırlar da yüklenir,
              buton hazır+eksik toplamını kaydeder */}
          <button
            onClick={p.handleTopluKaydet}
            disabled={p.hazirSayisi + p.eksikSayisi === 0 || p.topluKaydetLoading}
            style={{
              ...btnBase,
              background: p.hazirSayisi + p.eksikSayisi === 0 || p.topluKaydetLoading ? "#d1d5db" : "#1d4ed8",
              color: "white",
              border: "none",
              cursor: p.hazirSayisi + p.eksikSayisi === 0 || p.topluKaydetLoading ? "not-allowed" : "pointer",
            }}
          >
            {p.topluKaydetLoading
              ? "Kaydediliyor..."
              : `${p.hazirSayisi + p.eksikSayisi} kullanıcıyı kaydet${p.eksikSayisi > 0 ? ` (${p.eksikSayisi} eksik bilgili)` : ""}`}
          </button>
        </>
      )}

      {p.onizlemesatirlari && p.onizlemesatirlari.length === 0 && (
        <p style={{ fontSize: "13px", color: "#737373", fontFamily: "'Nunito', sans-serif" }}>
          Dosyada geçerli satır bulunamadı.
        </p>
      )}

      {/* Kaydet sonucu — DÜRÜST özet (B-17): kısmi başarısızlık gizlenmez,
          hatalı satırlar görünür listelenir. */}
      {p.kaydetSonucu && (
        <div
          style={{
            marginTop: "16px",
            border: `0.5px solid ${p.kaydetSonucu.hatali > 0 ? "#fecaca" : "#bbf7d0"}`,
            background: p.kaydetSonucu.hatali > 0 ? "#fef2f2" : "#f0fdf4",
            borderRadius: "8px",
            padding: "12px 14px",
            fontFamily: "'Nunito', sans-serif",
          }}
        >
          <p style={{ fontSize: "13px", fontWeight: 700, color: p.kaydetSonucu.hatali > 0 ? "#b91c1c" : "#166534", margin: 0 }}>
            {p.kaydetSonucu.basarili} kullanıcı eklendi
            {p.kaydetSonucu.eksikli > 0 ? ` (${p.kaydetSonucu.eksikli} tanesi eksik bilgili — takım/bölge tamamlanmalı)` : ""}
            {p.kaydetSonucu.hatali > 0 ? `, ${p.kaydetSonucu.hatali} satır eklenemedi:` : "."}
          </p>
          {p.kaydetSonucu.hatalar.length > 0 && (
            <ul style={{ fontSize: "12px", color: "#7f1d1d", margin: "8px 0 0 0", paddingLeft: "18px", lineHeight: 1.7 }}>
              {p.kaydetSonucu.hatalar.map((h, i) => <li key={i}>{h}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}