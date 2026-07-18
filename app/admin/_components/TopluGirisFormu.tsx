// app/admin/_components/TopluGirisFormu.tsx
//
// Toplu kullanıcı ekleme: CSV/XLSX dosya yükleme + önizleme tablosu + kaydet.
// useTopluForm hook'unun return değerlerini prop alır.

"use client";

import { btnBase, RENK_BORDO } from "../_constants";
import { ROL_ADLARI } from "@/lib/utils/roller";
import type { OnizlemeSatir } from "../_types";
import type { TopluKaydetSonucu } from "../_hooks/useTopluForm";

interface TopluGirisFormuProps {
  topluDosya: File | null;
  onizlemesatirlari: OnizlemeSatir[] | null;
  onizlemeLoading: boolean;
  topluKaydetLoading: boolean;
  yeniSayisi: number;
  guncelleSayisi: number;
  degismeyenSayisi: number;
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
    ["Ad", "Soyad", "E-posta", "Telefon", "Şifre", "Rol", "Takım", "Bölge"],
    ["Ali", "Veli", "ali.veli@ornek.com", "0532 123 45 67", "gizli123", "Ürün Tanıtım Temsilcisi", "Kardiyoloji", "Kadıköy"],
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
          <div style={{ marginBottom: "12px", display: "flex", gap: "12px", flexWrap: "wrap", fontSize: "13px", fontWeight: 600, fontFamily: "'Nunito', sans-serif" }}>
            {/* Upsert kırılımı: eşleşmeyen satır yeni, eşleşen güncelleme */}
            <span style={{ color: RENK_BORDO }}>Yeni: {p.yeniSayisi}</span>
            <span style={{ color: "#0f766e" }}>Güncellenecek: {p.guncelleSayisi}</span>
            <span style={{ color: "#737373" }}>Değişiklik yok: {p.degismeyenSayisi}</span>
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
                  <th style={tarz_th}>Telefon</th>
                  <th style={tarz_th}>Takım</th>
                  <th style={tarz_th}>Bölge</th>
                  <th style={tarz_th}>İşlem</th>
                  <th style={tarz_th}>Durum</th>
                </tr>
              </thead>
              <tbody>
                {p.onizlemesatirlari.map((s) => (
                  <tr key={s.index} style={{ background: s.durum === "hatali" ? "#fef2f2" : s.durum === "eksik" ? "#fffbeb" : "white" }}>
                    <td style={tarz_td}>{s.index}</td>
                    <td style={tarz_td}>{s.ad}</td>
                    <td style={tarz_td}>{s.soyad}</td>
                    {/* Satır kanonik rol kodunu taşır; görünüm insan adıdır (B-31 çizgisi) */}
                    <td style={tarz_td}>{ROL_ADLARI[s.rol] ?? s.rol}</td>
                    <td style={tarz_td}>{s.eposta}</td>
                    <td style={tarz_td}>{s.telefon}</td>
                    <td style={tarz_td}>{s.takim_adi}</td>
                    <td style={tarz_td}>{s.bolge_adi}</td>
                    <td style={tarz_td}>
                      {s.islem === "yeni" ? (
                        <span style={{ color: RENK_BORDO, fontWeight: 600 }}>Yeni</span>
                      ) : s.islem === "guncelle" ? (
                        <span style={{ color: "#0f766e", fontWeight: 600 }}>
                          Güncelleme{s.degisen && s.degisen.length > 0 ? ` — ${s.degisen.join(", ")}` : ""}
                        </span>
                      ) : s.islem === "degisiklik-yok" ? (
                        <span style={{ color: "#737373" }}>Değişiklik yok</span>
                      ) : (
                        <span style={{ color: "#737373" }}>—</span>
                      )}
                    </td>
                    <td style={tarz_td}>
                      {s.durum === "hazir" ? (
                        <span style={{ color: RENK_BORDO, fontWeight: 600 }}>Hazır</span>
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

          {/* Toplu kaydet — upsert: yeni + güncellenecek satırlar işlenir;
              K-A6 gereği eksik bilgili satırlar da dahildir */}
          <button
            onClick={p.handleTopluKaydet}
            disabled={p.yeniSayisi + p.guncelleSayisi === 0 || p.topluKaydetLoading}
            style={{
              ...btnBase,
              background: p.yeniSayisi + p.guncelleSayisi === 0 || p.topluKaydetLoading ? "#d1d5db" : RENK_BORDO,
              color: "white",
              border: "none",
              cursor: p.yeniSayisi + p.guncelleSayisi === 0 || p.topluKaydetLoading ? "not-allowed" : "pointer",
            }}
          >
            {p.topluKaydetLoading
              ? "Kaydediliyor..."
              : `${p.yeniSayisi} ekle, ${p.guncelleSayisi} güncelle${p.eksikSayisi > 0 ? ` (${p.eksikSayisi} eksik bilgili)` : ""}`}
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
            {p.kaydetSonucu.eklenen} eklendi, {p.kaydetSonucu.guncellenen} güncellendi
            {p.kaydetSonucu.degismeyen > 0 ? `, ${p.kaydetSonucu.degismeyen} değişiklik yok` : ""}
            {p.kaydetSonucu.eksikli > 0 ? ` (${p.kaydetSonucu.eksikli} tanesi eksik bilgili — tamamlanmalı)` : ""}
            {p.kaydetSonucu.hatali > 0 ? `, ${p.kaydetSonucu.hatali} satır işlenemedi:` : "."}
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