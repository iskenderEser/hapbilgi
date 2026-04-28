// components/ana-sayfa/TmAnaSayfa.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useHataMesaji } from "@/components/HataMesaji";
import { useEkran } from "@/styles/responsive";

interface BmSatiri {
  kullanici_id: string;
  bm_adi: string;
  bolge_adi: string;
  hafta_oneri: number;
  bekleyen: number;
  tamamlanan: number;
  toplam: number;
}

interface TmVeri {
  bm_satirlari: BmSatiri[];
  istatistikler: {
    bm_sayisi: number;
    hafta_aktif_bm: number;
    toplam_bekleyen: number;
    toplam_tamamlanan: number;
  };
}

interface Props {
  user: any;
  adSoyad: string;
}

export default function TmAnaSayfa({ user, adSoyad }: Props) {
  const router = useRouter();
  const ekran = useEkran();
  const [tmVeri, setTmVeri] = useState<TmVeri | null>(null);
  const [loading, setLoading] = useState(true);
  const { hata } = useHataMesaji();

  useEffect(() => {
    const veriCek = async () => {
      setLoading(true);
      const res = await fetch("/ana-sayfa/api/tm");
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Veriler yüklenemedi.", data.adim, data.detay); }
      else { setTmVeri(data); }
      setLoading(false);
    };
    veriCek();
  }, [user]);

  const bugunTarih = () =>
    new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });

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

  const istat = tmVeri?.istatistikler ?? { bm_sayisi: 0, hafta_aktif_bm: 0, toplam_bekleyen: 0, toplam_tamamlanan: 0 };
  const satirlar = tmVeri?.bm_satirlari ?? [];
  const ad = adSoyad.split(" ")[0] || "TM";
  const padding = ekran === 'mobile' ? '16px 14px' : ekran === 'tablet' ? '20px 24px' : '28px 32px';
  const statGrid = ekran === 'mobile' ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)';

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding }}>

      {/* Karşılama */}
      <div style={{ display: "flex", flexDirection: ekran === 'mobile' ? 'column' : 'row', alignItems: ekran === 'mobile' ? 'flex-start' : 'flex-end', justifyContent: "space-between", gap: 8, marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: ekran === 'mobile' ? "18px" : "20px", fontWeight: 800, color: "#111827", margin: 0 }}>Merhaba, {ad} 👋</h1>
          <p style={{ fontSize: "13px", color: "#737373", marginTop: "4px" }}>TM</p>
        </div>
        {ekran !== 'mobile' && (
          <span style={{ fontSize: "12px", color: "#737373", background: "white", border: "1px solid #e5e7eb", borderRadius: "20px", padding: "5px 14px", whiteSpace: "nowrap" }}>
            {bugunTarih()}
          </span>
        )}
      </div>

      {/* Stat kartlar */}
      <div style={{ display: "grid", gridTemplateColumns: statGrid, gap: "10px", marginBottom: "20px" }}>
        {[
          { label: "Takımdaki BM", value: istat.bm_sayisi, sub: "Aktif bölge müdürü", renk: "#56aeff" },
          { label: "Bu Hafta Aktif BM", value: istat.hafta_aktif_bm, sub: "Öneri gönderen", renk: "#16a34a" },
          { label: "Bekleyen Öneriler", value: istat.toplam_bekleyen, sub: "Tüm bölgeler", renk: "#bc2d0d" },
          { label: "Tamamlanan", value: istat.toplam_tamamlanan, sub: "UTT izledi", renk: "#f59e0b" },
        ].map((k, idx) => (
          <div
            key={idx}
            style={{
              background: "white",
              border: "1px solid #e5e7eb",
              borderLeft: `3px solid ${k.renk}`,
              borderRadius: "12px",
              padding: ekran === 'mobile' ? "14px 14px" : "20px 22px",
            }}
          >
            <div style={{ fontSize: "10px", fontWeight: 700, color: "#9ca3af", letterSpacing: "0.4px", textTransform: "uppercase", marginBottom: "8px" }}>{k.label}</div>
            <div style={{ fontSize: ekran === 'mobile' ? "22px" : "28px", fontWeight: 800, color: "#111827", lineHeight: 1 }}>{k.value}</div>
            {ekran !== 'mobile' && <div style={{ fontSize: "12px", color: "#737373", marginTop: "6px" }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* BM tablosu */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <span style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>BM Aktivite Takibi</span>
      </div>

      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
        {ekran === 'mobile' ? (
          satirlar.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", fontSize: "13px", color: "#9ca3af" }}>Takımda BM bulunmuyor.</div>
          ) : (
            satirlar.map((s, i) => (
              <div
                key={s.kullanici_id}
                onClick={() => router.push("/oneriler")}
                style={{ padding: "14px 16px", borderBottom: i < satirlar.length - 1 ? "1px solid #f3f4f6" : "none", cursor: "pointer" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#111827" }}>{s.bm_adi}</div>
                  <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", background: s.hafta_oneri > 0 ? "#f0fdf4" : "#f3f4f6", color: s.hafta_oneri > 0 ? "#166534" : "#9ca3af" }}>
                    {s.hafta_oneri} öneri
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "#737373" }}>{s.bolge_adi}</div>
                <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                  <span style={{ fontSize: "11px", color: s.bekleyen > 0 ? "#bc2d0d" : "#9ca3af" }}>Bekleyen: {s.bekleyen}</span>
                  <span style={{ fontSize: "11px", color: "#16a34a" }}>Tamamlanan: {s.tamamlanan}</span>
                </div>
              </div>
            ))
          )
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.2fr 1fr 1fr 1fr 20px", gap: "12px", padding: "10px 20px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              {["BM", "BÖLGE", "BU HAFTA", "BEKLEYEN", "TAMAMLANAN", ""].map((h, i) => (
                <div key={i} style={{ fontSize: "11px", fontWeight: 700, color: "#9ca3af", letterSpacing: "0.4px", textTransform: "uppercase" }}>{h}</div>
              ))}
            </div>
            {satirlar.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", fontSize: "13px", color: "#9ca3af" }}>Takımda BM bulunmuyor.</div>
            ) : (
              satirlar.map((s, i) => (
                <div
                  key={s.kullanici_id}
                  onClick={() => router.push("/oneriler")}
                  style={{ display: "grid", gridTemplateColumns: "1.6fr 1.2fr 1fr 1fr 1fr 20px", gap: "12px", padding: "13px 20px", borderBottom: i < satirlar.length - 1 ? "1px solid #f3f4f6" : "none", alignItems: "center", cursor: "pointer", background: "white", transition: "background 0.12s" }}
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
          </>
        )}
      </div>
    </div>
  );
}