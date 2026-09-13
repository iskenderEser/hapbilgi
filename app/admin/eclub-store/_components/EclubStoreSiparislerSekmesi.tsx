// app/admin/eclub-store/_components/EclubStoreSiparislerSekmesi.tsx
"use client";

import { useState } from "react";
import type { EclubStoreAdminSiparis, EclubStoreCekTalebiSatiri } from "@/lib/eclub/store/eclubStoreTipler";
import EclubStoreSiparisYonetimModal from "./EclubStoreSiparisYonetimModal";
import { RENK_BORDO, RENK_BORDO_ZEMIN, RENK_BORDO_KENAR } from "../../_constants";
import { Check, Copy, Download, FileSpreadsheet, Gift, Package, Send, ShieldCheck } from "lucide-react";

interface Props {
  siparisler: EclubStoreAdminSiparis[];
  yukleniyor: boolean;
  durumFiltre: string;
  setDurumFiltre: (d: string) => void;
  seciliSiparis: EclubStoreAdminSiparis | null;
  setSeciliSiparis: (s: EclubStoreAdminSiparis | null) => void;
  islemLoading: boolean;
  durumGuncelle: (siparis_id: string, durum: string, kargo?: { firma: string; takip: string }) => Promise<boolean>;
  siparisIptal: (siparis_id: string, sebep: string) => Promise<boolean>;
  // Hediye Çeki Operasyonu Props
  cekTalepleri?: EclubStoreCekTalebiSatiri[];
  cekYukleniyor?: boolean;
  cekDurumFiltre?: string;
  setCekDurumFiltre?: (d: string) => void;
  cekKoduTeslim?: (talep_id: string, cek_kodu: string) => Promise<boolean>;
  excelExport?: (talepler: EclubStoreCekTalebiSatiri[]) => void;
}

const DURUM_ETIKET: Record<string, { ad: string; renk: string; bg: string }> = {
  beklemede: { ad: "Beklemede (UTT)", renk: "#92400e", bg: "#fef3c7" },
  bm_onayinda: { ad: "BM Onayında", renk: "#1e40af", bg: "#eff6ff" },
  onaylandi: { ad: "Onaylandı (Kod Bekliyor)", renk: "#065f46", bg: "#ecfdf5" },
  hazirlaniyor: { ad: "Hazırlanıyor", renk: "#1d4ed8", bg: "#dbeafe" },
  kargoda: { ad: "Kargoda", renk: "#7c3aed", bg: "#ede9fe" },
  teslim_edildi: { ad: "Teslim Edildi", renk: "#166534", bg: "#dcfce7" },
  iptal: { ad: "İptal", renk: "#bc2d0d", bg: "#fee2e2" },
  cek_kodlari_gonderildi: { ad: "Çek Kodları Gönderildi", renk: "#15803d", bg: "#dcfce7" },
};

const CEK_FILTRELER = [
  { id: "", ad: "Tümü" },
  { id: "beklemede", ad: "Beklemede" },
  { id: "bm_onayinda", ad: "BM Onayında" },
  { id: "onaylandi", ad: "Onaylandı (Kod Bekleyen)" },
  { id: "cek_kodlari_gonderildi", ad: "Çek Kodları Gönderildi" },
];

const FIZIKSEL_FILTRELER = [
  { id: "", ad: "Tümü" },
  { id: "beklemede", ad: "Beklemede" },
  { id: "hazirlaniyor", ad: "Hazırlanıyor" },
  { id: "kargoda", ad: "Kargoda" },
  { id: "teslim_edildi", ad: "Teslim" },
  { id: "iptal", ad: "İptal" },
];

export default function EclubStoreSiparislerSekmesi(props: Props) {
  const {
    siparisler, yukleniyor, durumFiltre, setDurumFiltre, seciliSiparis, setSeciliSiparis,
    islemLoading, durumGuncelle, siparisIptal,
    cekTalepleri = [], cekYukleniyor = false, cekDurumFiltre = "", setCekDurumFiltre = () => {},
    cekKoduTeslim, excelExport,
  } = props;

  const [aktifMod, setAktifMod] = useState<"cekler" | "fiziksel">("cekler");
  const [kodInputs, setKodInputs] = useState<Record<string, string>>({});
  const [kopyalandiId, setKopyalandiId] = useState<string | null>(null);

  const handleKodChange = (talepId: string, val: string) => {
    setKodInputs((prev) => ({ ...prev, [talepId]: val }));
  };

  const handleKodGonder = async (talepId: string) => {
    const kod = kodInputs[talepId];
    if (!kod || !kod.trim()) {
      alert("Lütfen hediye çeki kodunu girin.");
      return;
    }
    if (cekKoduTeslim) {
      const ok = await cekKoduTeslim(talepId, kod);
      if (ok) {
        setKodInputs((prev) => {
          const next = { ...prev };
          delete next[talepId];
          return next;
        });
      }
    }
  };

  const kodKopyala = (kod: string, id: string) => {
    navigator.clipboard.writeText(kod);
    setKopyalandiId(id);
    setTimeout(() => setKopyalandiId(null), 2000);
  };

  return (
    <div style={{ fontFamily: "'Nunito', sans-serif" }}>
      {/* Mod Seçimi (Hediye Çekleri vs Fiziksel) */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", borderBottom: "1px solid #e5e7eb", paddingBottom: "10px" }}>
        <button
          type="button"
          onClick={() => setAktifMod("cekler")}
          style={{
            display: "flex", alignItems: "center", gap: "6px", padding: "6px 14px",
            background: aktifMod === "cekler" ? "#ecfdf5" : "transparent",
            border: aktifMod === "cekler" ? "1px solid #10b981" : "1px solid #e5e7eb",
            borderRadius: "8px", fontSize: "13px", fontWeight: 700,
            color: aktifMod === "cekler" ? "#065f46" : "#6b7280", cursor: "pointer",
          }}
        >
          <Gift size={15} />
          Migros Hediye Çeki Operasyonu ({cekTalepleri.length})
        </button>

        <button
          type="button"
          onClick={() => setAktifMod("fiziksel")}
          style={{
            display: "flex", alignItems: "center", gap: "6px", padding: "6px 14px",
            background: aktifMod === "fiziksel" ? RENK_BORDO_ZEMIN : "transparent",
            border: aktifMod === "fiziksel" ? `1px solid ${RENK_BORDO_KENAR}` : "1px solid #e5e7eb",
            borderRadius: "8px", fontSize: "13px", fontWeight: 700,
            color: aktifMod === "fiziksel" ? RENK_BORDO : "#6b7280", cursor: "pointer",
          }}
        >
          <Package size={15} />
          Fiziksel Ürün Siparişleri ({siparisler.length})
        </button>
      </div>

      {aktifMod === "cekler" ? (
        <div>
          {/* Çek Operasyonu Üst Bar: Filtreler & Excel Export */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "14px" }}>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {CEK_FILTRELER.map((f) => {
                const aktif = cekDurumFiltre === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setCekDurumFiltre(f.id)}
                    style={{
                      padding: "5px 12px",
                      background: aktif ? "#ecfdf5" : "transparent",
                      border: aktif ? "1px solid #10b981" : "0.5px solid #e5e7eb",
                      borderRadius: "6px", fontSize: "12px",
                      color: aktif ? "#065f46" : "#6b7280",
                      fontWeight: aktif ? 600 : 400, cursor: "pointer",
                    }}
                  >
                    {f.ad}
                  </button>
                );
              })}
            </div>

            {excelExport && (
              <button
                type="button"
                onClick={() => excelExport(cekTalepleri)}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "6px 14px", background: "#15803d", border: "none",
                  borderRadius: "8px", fontSize: "12px", fontWeight: 700,
                  color: "#fff", cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                }}
              >
                <FileSpreadsheet size={15} />
                Excel&apos;e Aktar (.xlsx)
              </button>
            )}
          </div>

          {cekYukleniyor ? (
            <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "14px", padding: "24px" }}>Yükleniyor...</p>
          ) : cekTalepleri.length === 0 ? (
            <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "14px", padding: "24px" }}>Çek talebi bulunamadı.</p>
          ) : (
            <div style={{ border: "0.5px solid #e5e7eb", borderRadius: "10px", overflowX: "auto", background: "#fff" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", textAlign: "left", color: "#6b7280" }}>
                    <th style={{ padding: "10px 12px", fontWeight: 700 }}>Tarih</th>
                    <th style={{ padding: "10px 12px", fontWeight: 700 }}>Eczane (GLN)</th>
                    <th style={{ padding: "10px 12px", fontWeight: 700 }}>Kişi (Rol & Tel)</th>
                    <th style={{ padding: "10px 12px", fontWeight: 700 }}>UTT & BM</th>
                    <th style={{ padding: "10px 12px", fontWeight: 700 }}>Ürün & Satış Şartı</th>
                    <th style={{ padding: "10px 12px", fontWeight: 700, textAlign: "right" }}>Puan</th>
                    <th style={{ padding: "10px 12px", fontWeight: 700, textAlign: "right" }}>Çek Tutarı</th>
                    <th style={{ padding: "10px 12px", fontWeight: 700 }}>Durum</th>
                    <th style={{ padding: "10px 12px", fontWeight: 700, minWidth: "220px" }}>Çek Kodu Teslimatı</th>
                  </tr>
                </thead>
                <tbody>
                  {cekTalepleri.map((t) => {
                    const durum = DURUM_ETIKET[t.durum] ?? { ad: t.durum, renk: "#6b7280", bg: "#f3f4f6" };
                    const isKodGonderildi = t.durum === "cek_kodlari_gonderildi" && t.cek_kodu;
                    const isKodBekliyor = t.durum === "onaylandi";

                    return (
                      <tr key={t.talep_id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "10px 12px", color: "#6b7280", whiteSpace: "nowrap" }}>
                          {new Date(t.created_at).toLocaleDateString("tr-TR")}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ fontWeight: 700, color: "#111" }}>{t.eczane_adi}</div>
                          <div style={{ fontSize: "11px", color: "#6b7280" }}>GLN: {t.gln || "—"} {t.eczane_tel ? `· ${t.eczane_tel}` : ""}</div>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ fontWeight: 600, color: "#111" }}>{t.talep_eden_ad_soyad}</div>
                          <div style={{ fontSize: "11px", color: "#6b7280" }}>{t.talep_eden_rol} {t.talep_eden_tel ? `· ${t.talep_eden_tel}` : ""}</div>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ fontSize: "11px", color: "#1f2937" }}>UTT: <strong>{t.utt_adi || "—"}</strong></div>
                          <div style={{ fontSize: "11px", color: "#6b7280" }}>BM: {t.bm_adi || "—"}</div>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ fontWeight: 600, color: "#111" }}>{t.urun_adi}</div>
                          <div style={{ fontSize: "11px", color: "#047857", fontWeight: 700 }}>
                            {t.siparis_adet ? `${t.siparis_adet} Adet + ${t.siparis_mal_fazlasi} MF` : "Siparişsiz"}
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#374151" }}>
                          {t.toplanan_puan.toLocaleString("tr-TR")}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, color: "#047857" }}>
                          {t.talep_edilen_cek_tl.toLocaleString("tr-TR")} TL
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "999px", color: durum.renk, background: durum.bg, fontWeight: 700, whiteSpace: "nowrap" }}>
                            {durum.ad}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          {isKodGonderildi ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#f0fdf4", border: "1px solid #86efac", padding: "4px 8px", borderRadius: "6px" }}>
                              <span style={{ fontFamily: "monospace", fontWeight: 800, color: "#14532d" }}>{t.cek_kodu}</span>
                              <button
                                type="button"
                                onClick={() => kodKopyala(t.cek_kodu!, t.talep_id)}
                                title="Kopyala"
                                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#15803d", padding: "2px" }}
                              >
                                {kopyalandiId === t.talep_id ? <Check size={13} /> : <Copy size={13} />}
                              </button>
                            </div>
                          ) : isKodBekliyor ? (
                            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                              <input
                                type="text"
                                placeholder="Çek Kodu (Örn: MIGROS-123)"
                                value={kodInputs[t.talep_id] ?? ""}
                                onChange={(e) => handleKodChange(t.talep_id, e.target.value)}
                                style={{ padding: "4px 8px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "11px", width: "140px" }}
                              />
                              <button
                                type="button"
                                onClick={() => handleKodGonder(t.talep_id)}
                                disabled={islemLoading}
                                style={{ padding: "4px 8px", background: "#15803d", color: "#fff", border: "none", borderRadius: "6px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                              >
                                Gönder
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: "#9ca3af", fontSize: "11px" }}>
                              {t.durum === "beklemede" ? "UTT Onayı Bekliyor" : "BM Onayı Bekliyor"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Fiziksel Siparişler Görünümü */
        <div>
          <div style={{ display: "flex", gap: "6px", marginBottom: "14px", flexWrap: "wrap" }}>
            {FIZIKSEL_FILTRELER.map((f) => {
              const aktif = durumFiltre === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setDurumFiltre(f.id)}
                  style={{
                    padding: "5px 12px",
                    background: aktif ? RENK_BORDO_ZEMIN : "transparent",
                    border: aktif ? `1px solid ${RENK_BORDO_KENAR}` : "0.5px solid #e5e7eb",
                    borderRadius: "6px", fontSize: "12px",
                    color: aktif ? RENK_BORDO : "#6b7280",
                    fontWeight: aktif ? 600 : 400, cursor: "pointer",
                  }}
                >
                  {f.ad}
                </button>
              );
            })}
          </div>

          {yukleniyor ? (
            <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "14px", padding: "24px" }}>Yükleniyor...</p>
          ) : siparisler.length === 0 ? (
            <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "14px", padding: "24px" }}>Fiziksel sipariş yok.</p>
          ) : (
            <div style={{ border: "0.5px solid #e5e7eb", borderRadius: "10px", overflow: "hidden" }}>
              {siparisler.map((s) => {
                const durum = DURUM_ETIKET[s.durum] ?? { ad: s.durum, renk: "#6b7280", bg: "#f3f4f6" };
                return (
                  <div
                    key={s.siparis_id}
                    onClick={() => setSeciliSiparis(s)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 16px", borderBottom: "0.5px solid #f3f4f6", cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 500, color: "#111" }}>
                        {s.urun_adi} × {s.adet}
                      </span>
                      <span style={{ fontSize: "12px", color: "#9ca3af" }}>
                        {s.kisi_ad_soyad} · {s.toplam_puan} puan · {new Date(s.created_at).toLocaleDateString("tr")}
                      </span>
                    </div>
                    <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "999px", color: durum.renk, background: durum.bg }}>
                      {durum.ad}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {seciliSiparis && (
            <EclubStoreSiparisYonetimModal
              siparis={seciliSiparis}
              islemLoading={islemLoading}
              onKapat={() => setSeciliSiparis(null)}
              onDurumGuncelle={durumGuncelle}
              onIptal={siparisIptal}
            />
          )}
        </div>
      )}
    </div>
  );
}