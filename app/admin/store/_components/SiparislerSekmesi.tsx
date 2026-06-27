// app/admin/store/_components/SiparislerSekmesi.tsx
//
// HBStore admin panel siparişler sekmesi: kart listesi + kargo/iptal modal.
// Durum bazlı koşullar:
//   - Beklemede → "Kargoya Ver" + "İptal Et" butonları
//   - Kargoda → kargo firması + takip linki + "İptal Et" butonu
//   - Teslim Edildi → teslim tarihi, buton yok
//   - İptal → iptal sebebi, buton yok
// useSiparisYonetimi hook'unun return değerlerini prop alır.

"use client";

import SiparisYonetimModal, { type SiparisYonetimModu } from "./SiparisYonetimModal";
import { DURUM_ETIKETLERI, DURUM_RENKLERI } from "@/lib/store/sabitler";
import { kargoTakipUrl } from "@/lib/store/kargo";
import type { SiparisGosterim } from "../_types";
import type { AdresSnapshot } from "@/lib/store/tipler";

interface SiparislerSekmesiProps {
  // Veri
  siparisler: SiparisGosterim[];
  yukleniyor: boolean;
  siparisleriYukle: () => void;

  // Modal state
  modalAcik: boolean;
  mod: SiparisYonetimModu;
  seciliSiparis: SiparisGosterim | null;
  handleKargola: (s: SiparisGosterim) => void;
  handleIptal: (s: SiparisGosterim) => void;
  handleModalKapat: () => void;

  // Ortak mesaj sistemi
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

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

export default function SiparislerSekmesi(p: SiparislerSekmesiProps) {
  return (
    <div style={{ marginTop: "20px" }}>
      <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#111", marginBottom: "12px", fontFamily: "'Nunito', sans-serif" }}>
        Siparişler ({p.siparisler.length})
      </h3>

      {p.yukleniyor ? (
        <p style={{ fontSize: "13px", color: "#737373", padding: "20px", textAlign: "center", fontFamily: "'Nunito', sans-serif" }}>
          Yükleniyor...
        </p>
      ) : p.siparisler.length === 0 ? (
        <p style={{ fontSize: "13px", color: "#737373", padding: "20px", textAlign: "center", fontFamily: "'Nunito', sans-serif" }}>
          Henüz sipariş yok.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {p.siparisler.map(s => {
            const durumStili = DURUM_RENKLERI[s.durum];
            const adres = s.adres_snapshot as AdresSnapshot;
            const kargoUrl = kargoTakipUrl(s.kargo_firmasi, s.kargo_takip_no);

            return (
              <div
                key={s.siparis_id}
                style={{
                  background: "white",
                  border: "0.5px solid #e5e7eb",
                  borderRadius: "8px",
                  overflow: "hidden",
                  fontFamily: "'Nunito', sans-serif",
                }}
              >
                {/* Üst kısım: görsel + bilgi + durum */}
                <div style={{ display: "flex", gap: "12px", padding: "12px" }}>
                  <div style={{
                    width: "60px", height: "60px",
                    flexShrink: 0,
                    borderRadius: "6px", overflow: "hidden",
                    background: "#f9fafb",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {s.store_urunler?.gorsel_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.store_urunler.gorsel_url}
                        alt={s.store_urunler.ad}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <span style={{ fontSize: "10px", color: "#737373" }}>—</span>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", flexWrap: "wrap" }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#111" }}>
                        {s.store_urunler?.ad ?? "Ürün"}
                      </div>
                      <span style={{
                        fontSize: "11px",
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                        color: durumStili.metin,
                        background: durumStili.arka,
                        border: `0.5px solid ${durumStili.kenar}`,
                      }}>
                        {DURUM_ETIKETLERI[s.durum]}
                      </span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#737373" }}>
                      Sipariş veren: <span style={{ color: "#111", fontWeight: 500 }}>
                        {s.kullanicilar?.ad} {s.kullanicilar?.soyad}
                      </span> ({s.kullanicilar?.rol})
                    </div>
                    <div style={{ fontSize: "12px", color: "#737373" }}>
                      {s.adet} adet × {s.puan_birim_fiyat} HapPuan ={" "}
                      <strong style={{ color: "#bc2d0d" }}>{s.toplam_puan} HapPuan</strong>
                    </div>
                    <div style={{ fontSize: "12px", color: "#737373" }}>
                      Sipariş tarihi: {tarihFormatla(s.created_at)}
                    </div>
                  </div>
                </div>

                {/* Adres */}
                <div style={{
                  padding: "8px 12px",
                  fontSize: "11px",
                  background: "#f9fafb",
                  color: "#737373",
                  borderTop: "0.5px solid #f3f4f6",
                }}>
                  <span style={{ fontWeight: 600, color: "#111" }}>Teslimat:</span>{" "}
                  {adres.alici_adi} · {adres.telefon} — {adres.adres_detay}, {adres.ilce} / {adres.il}
                </div>

                {/* Kargo bilgisi */}
                {s.durum === "kargoda" && s.kargo_firmasi && (
                  <div style={{
                    padding: "8px 12px",
                    fontSize: "11px",
                    borderTop: "0.5px solid #f3f4f6",
                    color: "#737373",
                  }}>
                    <span style={{ fontWeight: 600, color: "#111" }}>Kargo:</span>{" "}
                    {s.kargo_firmasi} ·{" "}
                    {kargoUrl ? (
                      <a
                        href={kargoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#1d4ed8", textDecoration: "underline" }}
                      >
                        {s.kargo_takip_no}
                      </a>
                    ) : (
                      <span>{s.kargo_takip_no}</span>
                    )}
                  </div>
                )}

                {/* İptal sebebi */}
                {s.durum === "iptal" && (
                  <div style={{
                    padding: "8px 12px",
                    fontSize: "11px",
                    borderTop: "0.5px solid #f3f4f6",
                    color: "#737373",
                  }}>
                    <span style={{ fontWeight: 600, color: "#bc2d0d" }}>İptal sebebi:</span>{" "}
                    {s.iptal_sebebi ?? "Belirtilmemiş"}
                  </div>
                )}

                {/* Teslim tarihi */}
                {s.durum === "teslim_edildi" && s.teslim_alma_at && (
                  <div style={{
                    padding: "8px 12px",
                    fontSize: "11px",
                    borderTop: "0.5px solid #f3f4f6",
                    color: "#737373",
                  }}>
                    <span style={{ fontWeight: 600, color: "#16a34a" }}>Teslim alındı:</span>{" "}
                    {tarihFormatla(s.teslim_alma_at)}
                  </div>
                )}

                {/* Aksiyon butonları */}
                {(s.durum === "beklemede" || s.durum === "kargoda") && (
                  <div style={{
                    padding: "10px 12px",
                    borderTop: "0.5px solid #f3f4f6",
                    display: "flex",
                    gap: "8px",
                    justifyContent: "flex-end",
                  }}>
                    {s.durum === "beklemede" && (
                      <button
                        onClick={() => p.handleKargola(s)}
                        style={{
                          padding: "5px 12px",
                          background: "#1d4ed8",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "'Nunito', sans-serif",
                        }}
                      >
                        Kargoya Ver
                      </button>
                    )}
                    <button
                      onClick={() => p.handleIptal(s)}
                      style={{
                        padding: "5px 12px",
                        background: "white",
                        border: "0.5px solid #bc2d0d",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "#bc2d0d",
                        cursor: "pointer",
                        fontFamily: "'Nunito', sans-serif",
                      }}
                    >
                      İptal Et
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <SiparisYonetimModal
        acik={p.modalAcik}
        mod={p.mod}
        mevcutSiparis={
          p.seciliSiparis
            ? {
                siparis_id: p.seciliSiparis.siparis_id,
                urun_adi: p.seciliSiparis.store_urunler?.ad ?? "Ürün",
                durum: DURUM_ETIKETLERI[p.seciliSiparis.durum],
              }
            : null
        }
        onKapat={p.handleModalKapat}
        onKaydedildi={p.siparisleriYukle}
        hata={p.hata}
        basari={p.basari}
      />
    </div>
  );
}