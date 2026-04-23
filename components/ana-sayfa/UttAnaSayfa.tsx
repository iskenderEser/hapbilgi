// components/ana-sayfa/UttAnaSayfa.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useHataMesaji } from "@/components/HataMesaji";

interface Video {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
  video_puani: number | null;
  yayin_tarihi: string;
}

interface UttVeri {
  yeni_videolar: Video[];
  devam_edenler: Video[];
  tamamlananlar: Video[];
  istatistikler: {
    yeni: number;
    devam: number;
    tamamlanan: number;
    hafta_puani: number;
    toplam_puan: number;
  };
}

interface Props {
  user: any;
  rol: string;
  adSoyad: string;
}

const GRADYANLAR = [
  "linear-gradient(135deg, #b5d4f4, #56aeff)",
  "linear-gradient(135deg, #c0dd97, #639922)",
  "linear-gradient(135deg, #f5c4b3, #D85A30)",
  "linear-gradient(135deg, #CECBF6, #534AB7)",
  "linear-gradient(135deg, #9FE1CB, #1D9E75)",
];

export default function UttAnaSayfa({ user, rol, adSoyad }: Props) {
  const router = useRouter();
  const [uttVeri, setUttVeri] = useState<UttVeri | null>(null);
  const [loading, setLoading] = useState(true);
  const [aktifFiltre, setAktifFiltre] = useState<string>("yeni");
  const { hata } = useHataMesaji();

  useEffect(() => {
    const veriCek = async () => {
      setLoading(true);
      const res = await fetch("/ana-sayfa/api/utt");
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Veriler yüklenemedi.", data.adim, data.detay); }
      else { setUttVeri(data); }
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

  const istat = uttVeri?.istatistikler ?? { yeni: 0, devam: 0, tamamlanan: 0, hafta_puani: 0, toplam_puan: 0 };
  const ad = adSoyad.split(" ")[0] || "Temsilci";

  const aktifVideolar = aktifFiltre === "yeni"
    ? (uttVeri?.yeni_videolar ?? [])
    : aktifFiltre === "devam"
    ? (uttVeri?.devam_edenler ?? [])
    : (uttVeri?.tamamlananlar ?? []);

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "28px 32px" }}>

      {/* Karşılama */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 800, color: "#111827", margin: 0 }}>Merhaba, {ad} 👋</h1>
          <p style={{ fontSize: "13px", color: "#737373", marginTop: "4px" }}>
            {rol.toUpperCase()}
          </p>
        </div>
        <span style={{ fontSize: "12px", color: "#737373", background: "white", border: "1px solid #e5e7eb", borderRadius: "20px", padding: "5px 14px", whiteSpace: "nowrap" }}>
          {bugunTarih()}
        </span>
      </div>

      {/* Stat kartlar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "28px" }}>
        {[
          { label: "Yeni Videolar", value: istat.yeni, sub: "Henüz izlenmedi", renk: "#bc2d0d", filtre: "yeni" },
          { label: "Devam Eden", value: istat.devam, sub: "Yarıda bırakılan", renk: "#f59e0b", filtre: "devam" },
          { label: "Tamamlanan", value: istat.tamamlanan, sub: "İzlendi ve tamamlandı", renk: "#16a34a", filtre: "tamamlanan" },
          { label: "Bu Haftaki Puan", value: istat.hafta_puani, sub: `Toplam: ${istat.toplam_puan.toLocaleString("tr-TR")} p`, renk: "#56aeff", filtre: "" },
        ].map((k, idx) => (
          <div
            key={idx}
            onClick={() => k.filtre && setAktifFiltre(aktifFiltre === k.filtre ? "yeni" : k.filtre)}
            style={{
              background: "white",
              border: "1px solid #e5e7eb",
              borderLeft: `3px solid ${k.renk}`,
              borderRadius: "12px",
              padding: "20px 22px",
              cursor: k.filtre ? "pointer" : "default",
              boxShadow: k.filtre && aktifFiltre === k.filtre ? `0 0 0 2px ${k.renk}33` : "none",
              transition: "box-shadow 0.15s",
            }}
            onMouseEnter={e => { if (k.filtre && aktifFiltre !== k.filtre) (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.07)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = k.filtre && aktifFiltre === k.filtre ? `0 0 0 2px ${k.renk}33` : "none"; }}
          >
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#9ca3af", letterSpacing: "0.4px", textTransform: "uppercase", marginBottom: "10px" }}>{k.label}</div>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#111827", lineHeight: 1 }}>{k.value.toLocaleString("tr-TR")}</div>
            <div style={{ fontSize: "12px", color: "#737373", marginTop: "6px" }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Video grid */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <span style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>
          {aktifFiltre === "yeni" ? "Yeni Videolar" : aktifFiltre === "devam" ? "Devam Eden" : "Tamamlanan"}
        </span>
        <span
          style={{ fontSize: "11px", color: "#56aeff", cursor: "pointer" }}
          onClick={() => router.push("/izle")}
        >
          Tümünü gör
        </span>
      </div>

      {aktifVideolar.length === 0 ? (
        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "40px", textAlign: "center", fontSize: "13px", color: "#9ca3af" }}>
          Bu kategoride video bulunmuyor.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
          {aktifVideolar.slice(0, 8).map(v => (
            <div
              key={v.yayin_id}
              onClick={() => router.push("/izle")}
              style={{ background: "white", borderRadius: "10px", border: "0.5px solid #e5e7eb", overflow: "hidden", cursor: "pointer", transition: "box-shadow 0.15s" }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "none"}
            >
              <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", overflow: "hidden" }}>
                {v.thumbnail_url
                  ? <img src={v.thumbnail_url} alt="thumbnail" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div style={{ width: "100%", height: "100%", background: GRADYANLAR[Math.abs(v.yayin_id.charCodeAt(0)) % GRADYANLAR.length] }} />
                }
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: "32px", height: "32px", background: "rgba(0,0,0,0.5)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="9" height="11" viewBox="0 0 10 12" fill="white"><path d="M0 0l10 6-10 6z" /></svg>
                  </div>
                </div>
                {aktifFiltre === "yeni" && (
                  <div style={{ position: "absolute", bottom: "6px", right: "6px", background: "#bc2d0d", color: "white", borderRadius: "20px", padding: "1px 7px", fontSize: "9px", fontWeight: 600 }}>Yeni</div>
                )}
                {aktifFiltre === "tamamlanan" && (
                  <div style={{ position: "absolute", bottom: "6px", right: "6px", background: "#16a34a", color: "white", borderRadius: "20px", padding: "1px 7px", fontSize: "9px", fontWeight: 600 }}>✓</div>
                )}
              </div>
              <div style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.urun_adi}</div>
                <div style={{ fontSize: "10px", color: "#737373", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.teknik_adi}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}