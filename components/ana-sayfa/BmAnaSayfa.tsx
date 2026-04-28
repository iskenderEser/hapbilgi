// components/ana-sayfa/BmAnaSayfa.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useHataMesaji } from "@/components/HataMesaji";
import { useEkran } from "@/styles/responsive";

interface OneriSatiri {
  oneri_id: string;
  kullanici_id: string;
  utt_adi: string;
  urun_adi: string;
  teknik_adi: string;
  durum: string;
  tarih: string;
  kategori: "bekleyen" | "tamamlanan";
}

interface BmVeri {
  satirlar: OneriSatiri[];
  istatistikler: {
    hafta_oneri: number;
    bekleyen: number;
    tamamlanan: number;
    utt_sayisi: number;
  };
}

interface Props {
  user: any;
  adSoyad: string;
}

export default function BmAnaSayfa({ user, adSoyad }: Props) {
  const router = useRouter();
  const ekran = useEkran();
  const [bmVeri, setBmVeri] = useState<BmVeri | null>(null);
  const [loading, setLoading] = useState(true);
  const [aktifFiltre, setAktifFiltre] = useState<string>("tumu");
  const { hata } = useHataMesaji();

  useEffect(() => {
    const veriCek = async () => {
      setLoading(true);
      const res = await fetch("/ana-sayfa/api/bm");
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Veriler yüklenemedi.", data.adim, data.detay); }
      else { setBmVeri(data); }
      setLoading(false);
    };
    veriCek();
  }, [user]);

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });

  const bugunTarih = () =>
    new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });

  const durumRenk = (durum: string) => {
    if (durum === "Tamamlandı") return { bg: "#f0fdf4", text: "#166534" };
    return { bg: "#fff1f0", text: "#bc2d0d" };
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

  const satirlar = bmVeri?.satirlar ?? [];
  const istat = bmVeri?.istatistikler ?? { hafta_oneri: 0, bekleyen: 0, tamamlanan: 0, utt_sayisi: 0 };
  const filtrelenmis = aktifFiltre === "tumu" ? satirlar : satirlar.filter(s => s.kategori === aktifFiltre);
  const ad = adSoyad.split(" ")[0] || "BM";
  const padding = ekran === 'mobile' ? '16px 14px' : ekran === 'tablet' ? '20px 24px' : '28px 32px';
  const statGrid = ekran === 'mobile' ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)';

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding, paddingBottom: ekran === 'mobile' ? '80px' : undefined }}>

      {/* Karşılama */}
      <div style={{ display: "flex", flexDirection: ekran === 'mobile' ? 'column' : 'row', alignItems: ekran === 'mobile' ? 'flex-start' : 'flex-end', justifyContent: "space-between", gap: 8, marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: ekran === 'mobile' ? "18px" : "20px", fontWeight: 800, color: "#111827", margin: 0 }}>Merhaba, {ad} 👋</h1>
          <p style={{ fontSize: "13px", color: "#737373", marginTop: "4px" }}>BM</p>
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
          { label: "Bu Hafta Gönderilen", value: istat.hafta_oneri, sub: "Toplam öneri sayısı", renk: "#56aeff", filtre: "" },
          { label: "Bekleyen Öneriler", value: istat.bekleyen, sub: "UTT henüz izlemedi", renk: "#bc2d0d", filtre: "bekleyen" },
          { label: "Tamamlanan", value: istat.tamamlanan, sub: "UTT izledi", renk: "#16a34a", filtre: "tamamlanan" },
          { label: "Bölgedeki UTT", value: istat.utt_sayisi, sub: "Aktif temsilci sayısı", renk: "#f59e0b", filtre: "" },
        ].map((k, idx) => (
          <div
            key={idx}
            onClick={() => k.filtre && setAktifFiltre(aktifFiltre === k.filtre ? "tumu" : k.filtre)}
            style={{
              background: "white",
              border: "1px solid #e5e7eb",
              borderLeft: `3px solid ${k.renk}`,
              borderRadius: "12px",
              padding: ekran === 'mobile' ? "14px 14px" : "20px 22px",
              cursor: k.filtre ? "pointer" : "default",
              boxShadow: k.filtre && aktifFiltre === k.filtre ? `0 0 0 2px ${k.renk}33` : "none",
              transition: "box-shadow 0.15s",
            }}
          >
            <div style={{ fontSize: "10px", fontWeight: 700, color: "#9ca3af", letterSpacing: "0.4px", textTransform: "uppercase", marginBottom: "8px" }}>{k.label}</div>
            <div style={{ fontSize: ekran === 'mobile' ? "22px" : "28px", fontWeight: 800, color: "#111827", lineHeight: 1 }}>{k.value}</div>
            {ekran !== 'mobile' && <div style={{ fontSize: "12px", color: "#737373", marginTop: "6px" }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Öneri listesi başlık */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <span style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>Öneri Takibi</span>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {aktifFiltre !== "tumu" && (
            <button
              onClick={() => setAktifFiltre("tumu")}
              style={{ fontSize: "12px", color: "#737373", background: "none", border: "0.5px solid #e5e7eb", borderRadius: "20px", padding: "4px 12px", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}
            >
              Filtreyi Kaldır
            </button>
          )}
          <button
            onClick={() => router.push("/oneriler")}
            style={{ fontSize: "12px", color: "white", background: "#56aeff", border: "none", borderRadius: "20px", padding: "5px 14px", cursor: "pointer", fontFamily: "'Nunito', sans-serif", fontWeight: 600 }}
          >
            + Yeni Öneri
          </button>
        </div>
      </div>

      {/* Tablo */}
      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
        {ekran === 'mobile' ? (
          // Mobile: kart görünümü
          filtrelenmis.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", fontSize: "13px", color: "#9ca3af" }}>Bu kategoride öneri bulunmuyor.</div>
          ) : (
            filtrelenmis.map((s, i) => {
              const durumR = durumRenk(s.durum);
              return (
                <div
                  key={s.oneri_id}
                  onClick={() => router.push("/oneriler")}
                  style={{ padding: "14px 16px", borderBottom: i < filtrelenmis.length - 1 ? "1px solid #f3f4f6" : "none", cursor: "pointer" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#111827" }}>{s.utt_adi}</div>
                    <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", background: durumR.bg, color: durumR.text, whiteSpace: "nowrap" }}>{s.durum}</span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#374151" }}>{s.urun_adi} · {s.teknik_adi}</div>
                  <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: 4 }}>{formatTarih(s.tarih)}</div>
                </div>
              );
            })
          )
        ) : (
          // Tablet/Desktop: grid tablo
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.4fr 1.2fr 1.1fr 1fr 20px", gap: "12px", padding: "10px 20px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              {["UTT", "ÜRÜN", "TEKNİK", "DURUM", "TARİH", ""].map((h, i) => (
                <div key={i} style={{ fontSize: "11px", fontWeight: 700, color: "#9ca3af", letterSpacing: "0.4px", textTransform: "uppercase" }}>{h}</div>
              ))}
            </div>
            {filtrelenmis.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", fontSize: "13px", color: "#9ca3af" }}>Bu kategoride öneri bulunmuyor.</div>
            ) : (
              filtrelenmis.map((s, i) => {
                const durumR = durumRenk(s.durum);
                return (
                  <div
                    key={s.oneri_id}
                    onClick={() => router.push("/oneriler")}
                    style={{ display: "grid", gridTemplateColumns: "1.4fr 1.4fr 1.2fr 1.1fr 1fr 20px", gap: "12px", padding: "13px 20px", borderBottom: i < filtrelenmis.length - 1 ? "1px solid #f3f4f6" : "none", alignItems: "center", cursor: "pointer", background: "white", transition: "background 0.12s" }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "#f9fafb"}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "white"}
                  >
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.utt_adi}</div>
                    <div style={{ fontSize: "12px", color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.urun_adi}</div>
                    <div style={{ fontSize: "12px", color: "#737373", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.teknik_adi}</div>
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