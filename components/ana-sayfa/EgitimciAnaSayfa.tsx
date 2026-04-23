// components/ana-sayfa/EgitimciAnaSayfa.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useHataMesaji } from "@/components/HataMesaji";

interface TakipSatiri {
  talep_id: string;
  urun_adi: string;
  teknik_adi: string;
  asama: "Senaryo" | "Video" | "Soru Seti" | "Yayın";
  durum: string;
  tarih: string;
  yol: string;
  kategori: "inceleme" | "yayin-bekleyen" | "yayinda" | "durdurulan" | "devam";
}

interface BmSatiri {
  kullanici_id: string;
  bm_adi: string;
  bolge_adi: string;
  hafta_oneri: number;
  bekleyen: number;
  tamamlanan: number;
}

interface EgitimciVeri {
  satirlar: TakipSatiri[];
  istatistikler: { inceleme_bekleyen: number; yayin_bekleyen: number; yayinda: number; toplam: number };
  bm_satirlari: BmSatiri[];
  bm_istatistikler: { bm_sayisi: number; hafta_aktif_bm: number; toplam_bekleyen: number; toplam_tamamlanan: number };
}

interface Props {
  user: any;
  rol: string;
  adSoyad: string;
}

export default function EgitimciAnaSayfa({ user, rol, adSoyad }: Props) {
  const router = useRouter();
  const [veri, setVeri] = useState<EgitimciVeri | null>(null);
  const [loading, setLoading] = useState(true);
  const [aktifFiltre, setAktifFiltre] = useState<string>("tumu");
  const { hata } = useHataMesaji();

  useEffect(() => {
    const veriCek = async () => {
      setLoading(true);
      const res = await fetch("/ana-sayfa/api/egitimci");
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Veriler yüklenemedi.", data.adim, data.detay); }
      else { setVeri(data); }
      setLoading(false);
    };
    veriCek();
  }, [user]);

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });

  const bugunTarih = () =>
    new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });

  const asamaRenk = (asama: string) => {
    switch (asama) {
      case "Senaryo": return { bg: "#f5f3ff", text: "#6d28d9" };
      case "Video": return { bg: "#eff6ff", text: "#1d4ed8" };
      case "Soru Seti": return { bg: "#fff7ed", text: "#c2410c" };
      case "Yayın": return { bg: "#f0fdf4", text: "#166534" };
      default: return { bg: "#f3f4f6", text: "#6b7280" };
    }
  };

  const durumRenk = (durum: string) => {
    if (durum === "İnceleme Bekliyor") return { bg: "#fff1f0", text: "#bc2d0d" };
    if (durum === "Revizyon Gönderildi") return { bg: "#fef3c7", text: "#92400e" };
    if (durum === "Yayında") return { bg: "#eff6ff", text: "#1d4ed8" };
    if (durum === "Yayın Bekliyor") return { bg: "#f3f4f6", text: "#6b7280" };
    if (durum === "Durduruldu") return { bg: "#fef2f2", text: "#bc2d0d" };
    return { bg: "#f3f4f6", text: "#9ca3af" };
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px" }}>
        <svg className="animate-spin" style={{ width: 24, height: 24, color: "#737373" }} fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const satirlar = veri?.satirlar ?? [];
  const istat = veri?.istatistikler ?? { inceleme_bekleyen: 0, yayin_bekleyen: 0, yayinda: 0, toplam: 0 };
  const bmSatirlari = veri?.bm_satirlari ?? [];
  const bmIstat = veri?.bm_istatistikler ?? { bm_sayisi: 0, hafta_aktif_bm: 0, toplam_bekleyen: 0, toplam_tamamlanan: 0 };
  const filtrelenmis = aktifFiltre === "tumu" ? satirlar : satirlar.filter(s => s.kategori === aktifFiltre);
  const ad = adSoyad.split(" ")[0] || "Eğitimci";

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "28px 32px", display: "flex", flexDirection: "column", gap: "28px" }}>

      {/* Karşılama */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 800, color: "#111827", margin: 0 }}>Merhaba, {ad} 👋</h1>
          <p style={{ fontSize: "13px", color: "#737373", marginTop: "4px" }}>{rol.toUpperCase()}</p>
        </div>
        <span style={{ fontSize: "12px", color: "#737373", background: "white", border: "1px solid #e5e7eb", borderRadius: "20px", padding: "5px 14px", whiteSpace: "nowrap" }}>
          {bugunTarih()}
        </span>
      </div>

      {/* ——— BÖLÜM 1: İçerik Takibi ——— */}
      <div>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "#56aeff", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "12px" }}>İçerik Takibi</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }}>
          {[
            { label: "İnceleme Bekleniyor", value: istat.inceleme_bekleyen, sub: "Senaryo, video veya soru seti", renk: "#bc2d0d", filtre: "inceleme" },
            { label: "Yayın Bekleyenler", value: istat.yayin_bekleyen, sub: "Onaylı, yayına alınmadı", renk: "#f59e0b", filtre: "yayin-bekleyen" },
            { label: "Yayında Olanlar", value: istat.yayinda, sub: "UTT'ler izleyebilir", renk: "#16a34a", filtre: "yayinda" },
            { label: "Toplam Talep", value: istat.toplam, sub: "Tüm içerik kalemleri", renk: "#56aeff", filtre: "tumu" },
          ].map(k => (
            <div
              key={k.filtre}
              onClick={() => setAktifFiltre(aktifFiltre === k.filtre ? "tumu" : k.filtre)}
              style={{
                background: "white", border: "1px solid #e5e7eb", borderLeft: `3px solid ${k.renk}`,
                borderRadius: "12px", padding: "20px 22px", cursor: "pointer",
                boxShadow: aktifFiltre === k.filtre ? `0 0 0 2px ${k.renk}33` : "none", transition: "box-shadow 0.15s",
              }}
              onMouseEnter={e => { if (aktifFiltre !== k.filtre) (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.07)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = aktifFiltre === k.filtre ? `0 0 0 2px ${k.renk}33` : "none"; }}
            >
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#9ca3af", letterSpacing: "0.4px", textTransform: "uppercase", marginBottom: "10px" }}>{k.label}</div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#111827", lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: "12px", color: "#737373", marginTop: "6px" }}>{k.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>İçerik Listesi</span>
          {aktifFiltre !== "tumu" && (
            <button onClick={() => setAktifFiltre("tumu")} style={{ fontSize: "12px", color: "#737373", background: "none", border: "0.5px solid #e5e7eb", borderRadius: "20px", padding: "4px 12px", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>
              Filtreyi Kaldır
            </button>
          )}
        </div>

        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1.4fr 1.1fr 1.4fr 1fr 20px", gap: "12px", padding: "10px 20px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
            {["ÜRÜN", "TEKNİK", "AŞAMA", "DURUM", "TARİH", ""].map((h, i) => (
              <div key={i} style={{ fontSize: "11px", fontWeight: 700, color: "#9ca3af", letterSpacing: "0.4px", textTransform: "uppercase" }}>{h}</div>
            ))}
          </div>
          {filtrelenmis.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", fontSize: "13px", color: "#9ca3af" }}>Bu kategoride içerik bulunmuyor.</div>
          ) : (
            filtrelenmis.map((s, i) => {
              const asamaR = asamaRenk(s.asama);
              const durumR = durumRenk(s.durum);
              return (
                <div key={`${s.talep_id}-${i}`} onClick={() => router.push(s.yol)}
                  style={{ display: "grid", gridTemplateColumns: "1.8fr 1.4fr 1.1fr 1.4fr 1fr 20px", gap: "12px", padding: "13px 20px", borderBottom: i < filtrelenmis.length - 1 ? "1px solid #f3f4f6" : "none", alignItems: "center", cursor: "pointer", background: "white", transition: "background 0.12s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "#f9fafb"}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "white"}
                >
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#111827" }}>{s.urun_adi}</div>
                  </div>
                  <div style={{ fontSize: "12px", color: "#737373", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.teknik_adi}</div>
                  <div><span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", background: asamaR.bg, color: asamaR.text, display: "inline-block", whiteSpace: "nowrap" }}>{s.asama}</span></div>
                  <div><span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", background: durumR.bg, color: durumR.text, display: "inline-block", whiteSpace: "nowrap" }}>{s.durum}</span></div>
                  <span style={{ fontSize: "12px", color: "#9ca3af", whiteSpace: "nowrap" }}>{formatTarih(s.tarih)}</span>
                  <span style={{ color: "#d1d5db", fontSize: "16px" }}>›</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ——— BÖLÜM 2: BM Takibi ——— */}
      <div>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "#56aeff", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "12px" }}>BM Aktivite Takibi</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }}>
          {[
            { label: "Takımdaki BM", value: bmIstat.bm_sayisi, sub: "Aktif bölge müdürü", renk: "#56aeff" },
            { label: "Bu Hafta Aktif BM", value: bmIstat.hafta_aktif_bm, sub: "Öneri gönderen", renk: "#16a34a" },
            { label: "Bekleyen Öneriler", value: bmIstat.toplam_bekleyen, sub: "Tüm bölgeler", renk: "#bc2d0d" },
            { label: "Tamamlanan", value: bmIstat.toplam_tamamlanan, sub: "UTT izledi", renk: "#f59e0b" },
          ].map((k, idx) => (
            <div key={idx} style={{ background: "white", border: "1px solid #e5e7eb", borderLeft: `3px solid ${k.renk}`, borderRadius: "12px", padding: "20px 22px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#9ca3af", letterSpacing: "0.4px", textTransform: "uppercase", marginBottom: "10px" }}>{k.label}</div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#111827", lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: "12px", color: "#737373", marginTop: "6px" }}>{k.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.2fr 1fr 1fr 1fr 20px", gap: "12px", padding: "10px 20px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
            {["BM", "BÖLGE", "BU HAFTA", "BEKLEYEN", "TAMAMLANAN", ""].map((h, i) => (
              <div key={i} style={{ fontSize: "11px", fontWeight: 700, color: "#9ca3af", letterSpacing: "0.4px", textTransform: "uppercase" }}>{h}</div>
            ))}
          </div>
          {bmSatirlari.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", fontSize: "13px", color: "#9ca3af" }}>Takımda BM bulunmuyor.</div>
          ) : (
            bmSatirlari.map((s, i) => (
              <div key={s.kullanici_id} onClick={() => router.push("/oneriler")}
                style={{ display: "grid", gridTemplateColumns: "1.6fr 1.2fr 1fr 1fr 1fr 20px", gap: "12px", padding: "13px 20px", borderBottom: i < bmSatirlari.length - 1 ? "1px solid #f3f4f6" : "none", alignItems: "center", cursor: "pointer", background: "white", transition: "background 0.12s" }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "#f9fafb"}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "white"}
              >
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#111827" }}>{s.bm_adi}</div>
                <div style={{ fontSize: "12px", color: "#737373" }}>{s.bolge_adi}</div>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", background: s.hafta_oneri > 0 ? "#f0fdf4" : "#f3f4f6", color: s.hafta_oneri > 0 ? "#166534" : "#9ca3af", display: "inline-block" }}>
                    {s.hafta_oneri} öneri
                  </span>
                </div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: s.bekleyen > 0 ? "#bc2d0d" : "#9ca3af" }}>{s.bekleyen}</div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#16a34a" }}>{s.tamamlanan}</div>
                <span style={{ color: "#d1d5db", fontSize: "16px" }}>›</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}