// components/ana-sayfa/PmAnaSayfa.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useHataMesaji } from "@/components/HataMesaji";
import { useEkran } from "@/styles/responsive";

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

interface PMVeri {
  satirlar: TakipSatiri[];
  istatistikler: {
    inceleme_bekleyen: number;
    yayin_bekleyen: number;
    yayinda: number;
    toplam: number;
  };
}

interface Props {
  user: any;
  rol: string;
  adSoyad: string;
}

export default function PmAnaSayfa({ user, rol, adSoyad }: Props) {
  const router = useRouter();
  const ekran = useEkran();
  const [pmVeri, setPmVeri] = useState<PMVeri | null>(null);
  const [takimAdi, setTakimAdi] = useState("");
  const [loading, setLoading] = useState(true);
  const [aktifFiltre, setAktifFiltre] = useState<string>("tumu");
  const { hata } = useHataMesaji();

  useEffect(() => {
    const veriCek = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data: kullanici } = await supabase.from("kullanicilar").select("takim_id").eq("kullanici_id", user.id).single();
      if (kullanici?.takim_id) {
        const { data: takim } = await supabase.from("takimlar").select("takim_adi").eq("takim_id", kullanici.takim_id).single();
        setTakimAdi(takim?.takim_adi ?? "");
      }
      const res = await fetch("/ana-sayfa/api/pm");
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Veriler yüklenemedi.", data.adim, data.detay); }
      else { setPmVeri(data); }
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

  const satirlar = pmVeri?.satirlar ?? [];
  const istat = pmVeri?.istatistikler ?? { inceleme_bekleyen: 0, yayin_bekleyen: 0, yayinda: 0, toplam: 0 };
  const filtrelenmis = aktifFiltre === "tumu" ? satirlar : satirlar.filter(s => s.kategori === aktifFiltre);
  const ad = adSoyad.split(" ")[0] || "PM";
  const padding = ekran === 'mobile' ? '16px 14px' : ekran === 'tablet' ? '20px 24px' : '28px 32px';
  const statGrid = ekran === 'mobile' ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)';

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding }}>

      {/* Karşılama */}
      <div style={{ display: "flex", flexDirection: ekran === 'mobile' ? 'column' : 'row', alignItems: ekran === 'mobile' ? 'flex-start' : 'flex-end', justifyContent: "space-between", gap: 8, marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: ekran === 'mobile' ? "18px" : "20px", fontWeight: 800, color: "#111827", margin: 0 }}>Merhaba, {ad} 👋</h1>
          <p style={{ fontSize: "13px", color: "#737373", marginTop: "4px" }}>
            {takimAdi && <strong style={{ color: "#56aeff", fontWeight: 700 }}>{takimAdi} · </strong>}
            {rol.toUpperCase()}
          </p>
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
              borderRadius: "12px", padding: ekran === 'mobile' ? "14px 14px" : "20px 22px",
              cursor: "pointer", boxShadow: aktifFiltre === k.filtre ? `0 0 0 2px ${k.renk}33` : "none", transition: "box-shadow 0.15s",
            }}
          >
            <div style={{ fontSize: "10px", fontWeight: 700, color: "#9ca3af", letterSpacing: "0.4px", textTransform: "uppercase", marginBottom: "8px" }}>{k.label}</div>
            <div style={{ fontSize: ekran === 'mobile' ? "22px" : "28px", fontWeight: 800, color: "#111827", lineHeight: 1 }}>{k.value}</div>
            {ekran !== 'mobile' && <div style={{ fontSize: "12px", color: "#737373", marginTop: "6px" }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* İçerik tablosu başlık */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <span style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>İçerik Takibi</span>
        {aktifFiltre !== "tumu" && (
          <button onClick={() => setAktifFiltre("tumu")} style={{ fontSize: "12px", color: "#737373", background: "none", border: "0.5px solid #e5e7eb", borderRadius: "20px", padding: "4px 12px", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>
            Filtreyi Kaldır
          </button>
        )}
      </div>

      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
        {ekran === 'mobile' ? (
          filtrelenmis.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", fontSize: "13px", color: "#9ca3af" }}>Bu kategoride içerik bulunmuyor.</div>
          ) : (
            filtrelenmis.map((s, i) => {
              const asamaR = asamaRenk(s.asama);
              const durumR = durumRenk(s.durum);
              return (
                <div key={`${s.talep_id}-${i}`} onClick={() => router.push(s.yol)}
                  style={{ padding: "14px 16px", borderBottom: i < filtrelenmis.length - 1 ? "1px solid #f3f4f6" : "none", cursor: "pointer" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#111827" }}>{s.urun_adi}</div>
                    <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", background: durumR.bg, color: durumR.text, whiteSpace: "nowrap" }}>{s.durum}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 6px", borderRadius: "20px", background: asamaR.bg, color: asamaR.text }}>{s.asama}</span>
                    <span style={{ fontSize: "11px", color: "#737373" }}>{s.teknik_adi}</span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: 4 }}>{formatTarih(s.tarih)}</div>
                </div>
              );
            })
          )
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1.4fr 1.1fr 1.4fr 1fr 20px", gap: "12px", padding: "10px 20px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              {["ÜRÜN", "TEKNİK", "AŞAMA", "DURUM", "TARİH", ""].map((h, i) => (
                <div key={i} style={{ fontSize: "11px", fontWeight: 700, color: "#9ca3af", letterSpacing: "0.4px", textTransform: "uppercase" }}>{h}</div>
              ))}
            </div>
            {filtrelenmis.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", fontSize: "13px", color: "#9ca3af" }}>Bu kategoride içerik bulunmuyor.</div>
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
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.urun_adi}</div>
                    <div style={{ fontSize: "12px", color: "#737373", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.teknik_adi}</div>
                    <div><span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", background: asamaR.bg, color: asamaR.text, display: "inline-block", whiteSpace: "nowrap" }}>{s.asama}</span></div>
                    <div><span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", background: durumR.bg, color: durumR.text, display: "inline-block", whiteSpace: "nowrap" }}>{s.durum}</span></div>
                    <span style={{ fontSize: "12px", color: "#9ca3af", whiteSpace: "nowrap" }}>{formatTarih(s.tarih)}</span>
                    <span style={{ color: "#d1d5db", fontSize: "16px" }}>›</span>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
}