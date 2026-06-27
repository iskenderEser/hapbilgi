// app/admin/_components/KullaniciListesi.tsx
//
// Kullanıcı listesi: arama bar + toplu işlem bar + tablo. Filtreler artık
// sütun başlıklarında dropdown olarak gösterilir (rol/takım/bölge/durum).
// useKullaniciListesi hook'unun return değerlerini prop alır.

"use client";

import { ROLLER, filterSelectStyle } from "../_constants";
import type { Kullanici } from "../_types";

interface KullaniciListesiProps {
  aramaMetni: string;
  setAramaMetni: (v: string) => void;
  filtrRol: string;
  setFiltrRol: (v: string) => void;
  filtrTakim: string;
  setFiltrTakim: (v: string) => void;
  filtrBolge: string;
  setFiltrBolge: (v: string) => void;
  filtrDurum: string;
  setFiltrDurum: (v: string) => void;
  sifirlaFiltreler: () => void;

  benzersizTakimlar: string[];
  benzersizBolgeler: string[];
  benzersizRoller: string[];
  filtrelenmisKullanicilar: Kullanici[];
  tumSeciliMi: boolean;

  acikRolId: string | null;
  setAcikRolId: (v: string | null) => void;
  rolDegistirLoading: string | null;
  aktifToggleLoading: string | null;
  silOnayId: string | null;
  setSilOnayId: (v: string | null) => void;
  silLoading: string | null;
  seciliKullanicilar: Set<string>;
  topluSilOnay: boolean;
  setTopluSilOnay: (v: boolean) => void;
  topluIslemLoading: boolean;
  yetkiLoading: string | null;

  handleRolDegistir: (kullanici_id: string, yeniRol: string) => void;
  handleAktifToggle: (kullanici_id: string, mevcutDurum: boolean) => void;
  handleYetkiDegistir: (kullanici_id: string, alan: "yetki_kullanici_yonetim" | "yetki_aktif_pasif", mevcutDeger: boolean) => void;
  handleSil: (kullanici_id: string) => void;
  handleTopluPasif: () => void;
  handleTopluSil: () => void;
  toggleSecim: (kullanici_id: string, secildi: boolean) => void;
  toggleTumSecim: (secildi: boolean) => void;
}

const thStyle: React.CSSProperties = {
  padding: "8px 10px", textAlign: "left",
  borderBottom: "0.5px solid #e5e7eb", fontWeight: 700,
  color: "#374151", fontSize: "11px", whiteSpace: "nowrap",
  background: "#f9fafb", fontFamily: "'Nunito', sans-serif",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 10px", borderBottom: "0.5px solid #f3f4f6",
  color: "#111", fontSize: "12px", fontFamily: "'Nunito', sans-serif",
};

const topluBtnStyle = (renk: string, loading: boolean): React.CSSProperties => ({
  padding: "4px 10px",
  background: loading ? "#d1d5db" : renk,
  color: "white", border: "none", borderRadius: "4px",
  fontSize: "11px", fontWeight: 600,
  cursor: loading ? "not-allowed" : "pointer",
  fontFamily: "'Nunito', sans-serif",
});

const silBtnStyle = (renk: string, loading: boolean): React.CSSProperties => ({
  padding: "3px 8px",
  background: loading ? "#d1d5db" : renk,
  color: "white", border: "none", borderRadius: "4px",
  fontSize: "10px", fontWeight: 600,
  cursor: loading ? "not-allowed" : "pointer",
  fontFamily: "'Nunito', sans-serif",
});

const yetkiLabelStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "3px",
  fontSize: "10px", color: "#111",
  fontFamily: "'Nunito', sans-serif", cursor: "pointer",
};

// Header'da inline kullanılan filtre select stili — başlık görünümünde
const headerSelectStyle: React.CSSProperties = {
  border: "none", background: "transparent",
  color: "#374151", fontSize: "11px", fontWeight: 700,
  fontFamily: "'Nunito', sans-serif",
  cursor: "pointer", outline: "none", padding: "0",
};

const headerSelectAktifStyle: React.CSSProperties = {
  ...headerSelectStyle, color: "#1d4ed8",
};

export default function KullaniciListesi(p: KullaniciListesiProps) {
  return (
    <div style={{ marginTop: "20px" }}>
      <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#111", marginBottom: "12px", fontFamily: "'Nunito', sans-serif" }}>
        Kullanıcı Listesi ({p.filtrelenmisKullanicilar.length})
      </h3>

      {/* Arama bar (filtreler sütun başlıklarına taşındı) */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginBottom: "12px" }}>
        <input
          type="text"
          value={p.aramaMetni}
          onChange={(e) => p.setAramaMetni(e.target.value)}
          placeholder="Ara: ad, soyad, e-posta, takım..."
          style={{ ...filterSelectStyle, minWidth: "240px", flex: 1, maxWidth: "320px" }}
        />
        {(p.aramaMetni || p.filtrRol || p.filtrTakim || p.filtrBolge || p.filtrDurum) && (
          <button
            onClick={p.sifirlaFiltreler}
            style={{
              padding: "4px 10px", background: "white",
              border: "0.5px solid #e5e7eb", borderRadius: "6px",
              fontSize: "11px", color: "#737373", cursor: "pointer",
              fontFamily: "'Nunito', sans-serif",
            }}
          >
            Filtreyi Temizle
          </button>
        )}
      </div>

      {/* Toplu işlem bar */}
      {p.seciliKullanicilar.size > 0 && (
        <div style={{ display: "flex", gap: "8px", alignItems: "center", padding: "8px 12px", background: "#eff6ff", borderRadius: "6px", marginBottom: "8px" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#1d4ed8", fontFamily: "'Nunito', sans-serif" }}>
            {p.seciliKullanicilar.size} seçili
          </span>
          <button onClick={p.handleTopluPasif} disabled={p.topluIslemLoading} style={topluBtnStyle("#f59e0b", p.topluIslemLoading)}>
            {p.topluIslemLoading ? "..." : "Toplu Pasife Al"}
          </button>
          {p.topluSilOnay ? (
            <>
              <button onClick={p.handleTopluSil} disabled={p.topluIslemLoading} style={topluBtnStyle("#dc2626", p.topluIslemLoading)}>
                {p.topluIslemLoading ? "Siliniyor..." : "Eminim, Sil"}
              </button>
              <button onClick={() => p.setTopluSilOnay(false)} style={topluBtnStyle("#737373", false)}>
                İptal
              </button>
            </>
          ) : (
            <button onClick={() => p.setTopluSilOnay(true)} style={topluBtnStyle("#dc2626", false)}>
              Toplu Sil
            </button>
          )}
        </div>
      )}

      {/* Tablo */}
      {p.filtrelenmisKullanicilar.length === 0 ? (
        <p style={{ fontSize: "13px", color: "#737373", padding: "20px", textAlign: "center", fontFamily: "'Nunito', sans-serif" }}>
          Gösterilecek kullanıcı yok.
        </p>
      ) : (
        <div style={{ overflow: "auto", border: "0.5px solid #e5e7eb", borderRadius: "8px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>
                  <input type="checkbox" checked={p.tumSeciliMi}
                    onChange={(e) => p.toggleTumSecim(e.target.checked)} />
                </th>
                <th style={thStyle}>Ad</th>
                <th style={thStyle}>Soyad</th>
                <th style={thStyle}>
                  <select value={p.filtrRol} onChange={(e) => p.setFiltrRol(e.target.value)}
                    style={p.filtrRol ? headerSelectAktifStyle : headerSelectStyle}>
                    <option value="">Rol ▾</option>
                    {p.benzersizRoller.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </th>
                <th style={thStyle}>E-posta</th>
                <th style={thStyle}>
                  <select value={p.filtrTakim} onChange={(e) => p.setFiltrTakim(e.target.value)}
                    style={p.filtrTakim ? headerSelectAktifStyle : headerSelectStyle}>
                    <option value="">Takım ▾</option>
                    {p.benzersizTakimlar.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </th>
                <th style={thStyle}>
                  <select value={p.filtrBolge} onChange={(e) => p.setFiltrBolge(e.target.value)}
                    style={p.filtrBolge ? headerSelectAktifStyle : headerSelectStyle}>
                    <option value="">Bölge ▾</option>
                    {p.benzersizBolgeler.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </th>
                <th style={thStyle}>
                  <select value={p.filtrDurum} onChange={(e) => p.setFiltrDurum(e.target.value)}
                    style={p.filtrDurum ? headerSelectAktifStyle : headerSelectStyle}>
                    <option value="">Durum ▾</option>
                    <option value="aktif">Aktif</option>
                    <option value="pasif">Pasif</option>
                  </select>
                </th>
                <th style={thStyle}>Yetkiler</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {p.filtrelenmisKullanicilar.map(k => (
                <tr key={k.kullanici_id} style={{ background: p.seciliKullanicilar.has(k.kullanici_id) ? "#eff6ff" : "white" }}>
                  <td style={tdStyle}>
                    <input type="checkbox" checked={p.seciliKullanicilar.has(k.kullanici_id)}
                      onChange={(e) => p.toggleSecim(k.kullanici_id, e.target.checked)} />
                  </td>
                  <td style={tdStyle}>{k.ad}</td>
                  <td style={tdStyle}>{k.soyad}</td>
                  <td style={tdStyle}>
                    {p.acikRolId === k.kullanici_id ? (
                      <select autoFocus value={k.rol}
                        onChange={(e) => p.handleRolDegistir(k.kullanici_id, e.target.value)}
                        onBlur={() => p.setAcikRolId(null)}
                        style={{ ...filterSelectStyle, padding: "2px 6px" }}>
                        {ROLLER.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : (
                      <span onClick={() => p.setAcikRolId(k.kullanici_id)}
                        style={{ cursor: "pointer", color: "#1d4ed8", fontWeight: 600 }}>
                        {p.rolDegistirLoading === k.kullanici_id ? "..." : k.rol}
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>{k.eposta}</td>
                  <td style={tdStyle}>{k.takim_adi ?? "-"}</td>
                  <td style={tdStyle}>{k.bolge_adi ?? "-"}</td>
                  <td style={tdStyle}>
                    <button onClick={() => p.handleAktifToggle(k.kullanici_id, k.aktif_mi)}
                      disabled={p.aktifToggleLoading === k.kullanici_id}
                      style={{
                        padding: "2px 8px",
                        background: k.aktif_mi ? "#dcfce7" : "#fee2e2",
                        color: k.aktif_mi ? "#16a34a" : "#dc2626",
                        border: "none", borderRadius: "4px",
                        fontSize: "11px", fontWeight: 600, cursor: "pointer",
                        fontFamily: "'Nunito', sans-serif",
                      }}>
                      {p.aktifToggleLoading === k.kullanici_id ? "..." : (k.aktif_mi ? "Aktif" : "Pasif")}
                    </button>
                  </td>
                  <td style={tdStyle}>
                    <label style={yetkiLabelStyle}>
                      <input type="checkbox" checked={k.yetki_kullanici_yonetim}
                        onChange={() => p.handleYetkiDegistir(k.kullanici_id, "yetki_kullanici_yonetim", k.yetki_kullanici_yonetim)}
                        disabled={p.yetkiLoading === k.kullanici_id + "yetki_kullanici_yonetim"} />
                      <span>Yön.</span>
                    </label>
                    <label style={{ ...yetkiLabelStyle, marginLeft: "8px" }}>
                      <input type="checkbox" checked={k.yetki_aktif_pasif}
                        onChange={() => p.handleYetkiDegistir(k.kullanici_id, "yetki_aktif_pasif", k.yetki_aktif_pasif)}
                        disabled={p.yetkiLoading === k.kullanici_id + "yetki_aktif_pasif"} />
                      <span>A/P</span>
                    </label>
                  </td>
                  <td style={tdStyle}>
                    {p.silOnayId === k.kullanici_id ? (
                      <>
                        <button onClick={() => p.handleSil(k.kullanici_id)}
                          disabled={p.silLoading === k.kullanici_id}
                          style={silBtnStyle("#dc2626", p.silLoading === k.kullanici_id)}>
                          {p.silLoading === k.kullanici_id ? "..." : "Eminim"}
                        </button>
                        <button onClick={() => p.setSilOnayId(null)}
                          style={{ ...silBtnStyle("#737373", false), marginLeft: "4px" }}>
                          İptal
                        </button>
                      </>
                    ) : (
                      <button onClick={() => p.setSilOnayId(k.kullanici_id)} style={silBtnStyle("#dc2626", false)}>
                        Sil
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
