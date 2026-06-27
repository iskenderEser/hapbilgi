// app/store/siparisler/_components/SiparisTablosu.tsx
//
// HBStore genel sipariş listesi tablosu. Saf UI — sipariş listesi + 
// "Daha Fazla Yükle" butonunu render eder.
// useSiparisListe hook'unun return değerlerini prop alır.

"use client";

import type { SiparisSatiri } from "../_types";
import type { AdresSnapshot } from "@/lib/store/tipler";
import { DURUM_ETIKETLERI, DURUM_RENKLERI } from "@/lib/store/sabitler";
import { kargoTakipUrl } from "@/lib/store/kargo";

interface SiparisTablosuProps {
  siparisler: SiparisSatiri[];
  toplam: number;
  dahaVar: boolean;
  yukleniyor: boolean;
  dahaYukleniyor: boolean;
  dahaFazlaYukle: () => void;
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
  verticalAlign: "top",
};

const tarihFormatla = (iso: string | null): string => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function SiparisTablosu(p: SiparisTablosuProps) {
  if (p.yukleniyor) {
    return (
      <p style={{
        fontSize: "13px", color: "#737373", padding: "40px",
        textAlign: "center", fontFamily: "'Nunito', sans-serif",
      }}>
        Yükleniyor...
      </p>
    );
  }

  if (p.siparisler.length === 0) {
    return (
      <p style={{
        fontSize: "13px", color: "#737373", padding: "40px",
        textAlign: "center", fontFamily: "'Nunito', sans-serif",
      }}>
        Bu filtrelerle eşleşen sipariş yok.
      </p>
    );
  }

  return (
    <>
      <div style={{
        marginBottom: "12px",
        fontSize: "12px",
        color: "#737373",
        fontFamily: "'Nunito', sans-serif",
      }}>
        {p.siparisler.length} / {p.toplam} sipariş gösteriliyor
      </div>

      <div style={{
        overflow: "auto",
        border: "0.5px solid #e5e7eb",
        borderRadius: "8px",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Tarih</th>
              <th style={thStyle}>Ürün</th>
              <th style={thStyle}>Alıcı</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Adet</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Toplam Puan</th>
              <th style={thStyle}>Durum</th>
              <th style={thStyle}>Kargo</th>
              <th style={thStyle}>Teslimat</th>
            </tr>
          </thead>
          <tbody>
            {p.siparisler.map(s => {
              const durumStili = DURUM_RENKLERI[s.durum];
              const adres = s.adres_snapshot as AdresSnapshot;
              const kargoUrl = kargoTakipUrl(s.kargo_firmasi, s.kargo_takip_no);

              return (
                <tr key={s.siparis_id}>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap", color: "#737373" }}>
                    {tarihFormatla(s.created_at)}
                  </td>

                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{
                        width: "32px", height: "32px",
                        borderRadius: "4px", overflow: "hidden",
                        background: "#f9fafb", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {s.urun_gorsel_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.urun_gorsel_url} alt={s.urun_adi}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span style={{ fontSize: "10px", color: "#737373" }}>—</span>
                        )}
                      </div>
                      <span style={{ fontWeight: 500 }}>{s.urun_adi}</span>
                    </div>
                  </td>

                  <td style={tdStyle}>
                    <div>{s.alici_ad} {s.alici_soyad}</div>
                    <div style={{ fontSize: "11px", color: "#737373" }}>{s.alici_rol}</div>
                  </td>

                  <td style={{ ...tdStyle, textAlign: "right" }}>{s.adet}</td>

                  <td style={{ ...tdStyle, textAlign: "right", color: "#bc2d0d", fontWeight: 600 }}>
                    {s.toplam_puan}
                  </td>

                  <td style={tdStyle}>
                    <span style={{
                      fontSize: "11px",
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      whiteSpace: "nowrap",
                      color: durumStili.metin,
                      background: durumStili.arka,
                      border: `0.5px solid ${durumStili.kenar}`,
                    }}>
                      {DURUM_ETIKETLERI[s.durum]}
                    </span>
                  </td>

                  <td style={tdStyle}>
                    {s.kargo_firmasi ? (
                      <div>
                        <div style={{ fontSize: "11px" }}>{s.kargo_firmasi}</div>
                        {kargoUrl ? (
                          <a href={kargoUrl} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: "11px", color: "#1d4ed8", textDecoration: "underline" }}>
                            {s.kargo_takip_no}
                          </a>
                        ) : (
                          <div style={{ fontSize: "11px", color: "#737373" }}>{s.kargo_takip_no}</div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: "#737373" }}>—</span>
                    )}
                  </td>

                  <td style={{ ...tdStyle, color: "#737373", fontSize: "11px", maxWidth: "200px" }}>
                    {adres.ilce} / {adres.il}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Daha Fazla Yükle butonu */}
      {p.dahaVar && (
        <div style={{ marginTop: "16px", textAlign: "center" }}>
          <button
            onClick={p.dahaFazlaYukle}
            disabled={p.dahaYukleniyor}
            style={{
              padding: "8px 20px",
              background: p.dahaYukleniyor ? "#d1d5db" : "white",
              border: "0.5px solid #e5e7eb",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              color: "#374151",
              cursor: p.dahaYukleniyor ? "not-allowed" : "pointer",
              fontFamily: "'Nunito', sans-serif",
            }}
          >
            {p.dahaYukleniyor ? "Yükleniyor..." : "Daha Fazla Yükle"}
          </button>
        </div>
      )}
    </>
  );
}