"use client";

import { useState } from "react";
import {
  CEK_KODU_GORUNUR_DURUMLARI,
  CEK_TALEP_ADMIN_DURUMLARI,
  CEK_TALEP_DURUM_META,
  type EclubStoreCekTalebiSatiri,
} from "@/lib/eclub/store/eclubStoreTipler";
import { Check, Copy, FileSpreadsheet } from "lucide-react";

interface Props {
  cekTalepleri: EclubStoreCekTalebiSatiri[];
  cekYukleniyor: boolean;
  cekDurumFiltre: string;
  setCekDurumFiltre: (durum: string) => void;
  islemLoading: boolean;
  cekKoduTeslim: (talepId: string, cekKodu: string) => Promise<boolean>;
  excelExport: (talepler: EclubStoreCekTalebiSatiri[]) => void;
}

const CEK_FILTRELER = [
  { id: "", ad: "Tümü" },
  ...CEK_TALEP_ADMIN_DURUMLARI.map((id) => ({ id, ad: CEK_TALEP_DURUM_META[id].etiket })),
];

export default function EclubStoreSiparislerSekmesi({
  cekTalepleri,
  cekYukleniyor,
  cekDurumFiltre,
  setCekDurumFiltre,
  islemLoading,
  cekKoduTeslim,
  excelExport,
}: Props) {
  const [kodInputs, setKodInputs] = useState<Record<string, string>>({});
  const [kopyalandiId, setKopyalandiId] = useState<string | null>(null);

  const handleKodGonder = async (talepId: string) => {
    const kod = kodInputs[talepId]?.trim();
    if (!kod) return;
    if (await cekKoduTeslim(talepId, kod)) {
      setKodInputs((onceki) => {
        const sonraki = { ...onceki };
        delete sonraki[talepId];
        return sonraki;
      });
    }
  };

  const kodKopyala = async (kod: string, id: string) => {
    await navigator.clipboard.writeText(kod);
    setKopyalandiId(id);
    setTimeout(() => setKopyalandiId(null), 2000);
  };

  return (
    <div style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "14px" }}>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {CEK_FILTRELER.map((filtre) => {
            const aktif = cekDurumFiltre === filtre.id;
            return (
              <button key={filtre.id} onClick={() => setCekDurumFiltre(filtre.id)} style={{ padding: "5px 12px", background: aktif ? "#ecfdf5" : "transparent", border: aktif ? "1px solid #10b981" : "0.5px solid #e5e7eb", borderRadius: "6px", fontSize: "12px", color: aktif ? "#065f46" : "#6b7280", fontWeight: aktif ? 600 : 400, cursor: "pointer" }}>
                {filtre.ad}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => excelExport(cekTalepleri)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 14px", background: "#15803d", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: 700, color: "#fff", cursor: "pointer" }}>
          <FileSpreadsheet size={15} /> Excel&apos;e Aktar
        </button>
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
                {['Tarih', 'Eczane (GLN)', 'Talep Eden', 'UTT & BM', 'Ürün & Satış Şartı', 'Puan', 'Çek Tutarı', 'Durum', 'Çek Kodu Teslimatı'].map((baslik) => (
                  <th key={baslik} style={{ padding: "10px 12px", fontWeight: 700 }}>{baslik}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cekTalepleri.map((talep) => {
                const durum = CEK_TALEP_DURUM_META[talep.durum];
                const kodGonderildi = CEK_KODU_GORUNUR_DURUMLARI.includes(talep.durum) && talep.cek_kodu;
                return (
                  <tr key={talep.talep_id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{new Date(talep.created_at).toLocaleDateString("tr-TR")}</td>
                    <td style={{ padding: "10px 12px" }}><strong>{talep.eczane_adi}</strong><div style={{ color: "#6b7280" }}>GLN: {talep.gln || "—"}</div></td>
                    <td style={{ padding: "10px 12px" }}><strong>{talep.talep_eden_ad_soyad}</strong><div style={{ color: "#6b7280" }}>{talep.talep_eden_rol}</div></td>
                    <td style={{ padding: "10px 12px" }}>UTT: <strong>{talep.utt_adi || "—"}</strong><div style={{ color: "#6b7280" }}>BM: {talep.bm_adi || "—"}</div></td>
                    <td style={{ padding: "10px 12px" }}><strong>{talep.urun_adi}</strong><div style={{ color: "#047857" }}>{talep.siparis_adet ? `${talep.siparis_adet} adet + ${talep.siparis_mal_fazlasi} MF` : "Siparişsiz"}</div></td>
                    <td style={{ padding: "10px 12px", fontWeight: 700 }}>{talep.toplanan_puan.toLocaleString("tr-TR")}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 800, color: "#047857" }}>{talep.talep_edilen_cek_tl.toLocaleString("tr-TR")} TL</td>
                    <td style={{ padding: "10px 12px" }}><span style={{ padding: "3px 8px", borderRadius: "999px", color: durum.metin, background: durum.arka, fontWeight: 700, whiteSpace: "nowrap" }}>{durum.etiket}</span></td>
                    <td style={{ padding: "10px 12px" }}>
                      {kodGonderildi ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#f0fdf4", border: "1px solid #86efac", padding: "4px 8px", borderRadius: "6px" }}>
                          <span style={{ fontFamily: "monospace", fontWeight: 800 }}>{talep.cek_kodu}</span>
                          <button type="button" onClick={() => void kodKopyala(talep.cek_kodu!, talep.talep_id)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#15803d" }}>{kopyalandiId === talep.talep_id ? <Check size={13} /> : <Copy size={13} />}</button>
                        </div>
                      ) : talep.durum === "onaylandi" && talep.siparis_verildi_mi && !talep.siparis_okundu_at ? (
                        <span style={{ color: "#92400e", fontWeight: 700 }}>Siparişin UTT tarafından Okundu yapılması bekleniyor.</span>
                      ) : talep.durum === "onaylandi" ? (
                        <div style={{ display: "flex", gap: "4px" }}>
                          <input type="text" placeholder="Çek kodu" value={kodInputs[talep.talep_id] ?? ""} onChange={(event) => setKodInputs((onceki) => ({ ...onceki, [talep.talep_id]: event.target.value }))} style={{ padding: "4px 8px", border: "1px solid #d1d5db", borderRadius: "6px", width: "140px" }} />
                          <button type="button" onClick={() => void handleKodGonder(talep.talep_id)} disabled={islemLoading} style={{ padding: "4px 8px", background: "#15803d", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 700 }}>Gönder</button>
                        </div>
                      ) : <span style={{ color: "#9ca3af" }}>Onay süreci devam ediyor</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
