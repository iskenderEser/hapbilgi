// components/ana-sayfa/YoneticiAnaSayfa.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useHataMesaji } from "@/components/HataMesaji";

interface Video {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  thumbnail_url: string | null;
  video_url: string | null;
  yayin_tarihi: string;
  izlenme_sayisi: number;
}

interface HaftaninEni {
  kullanici_id: string;
  ad: string;
  soyad: string;
  fotograf_url: string | null;
  toplam_puan: number;
}

interface YoneticiVeri {
  en_cok_izlenenler: Video[];
  haftanin_enleri: HaftaninEni[];
  istatistikler: {
    yayin_sayisi: number;
    hafta_izlenme: number;
    utt_sayisi: number;
    tamamlanma_orani: number;
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

export default function YoneticiAnaSayfa({ user, rol, adSoyad }: Props) {
  const router = useRouter();
  const [veri, setVeri] = useState<YoneticiVeri | null>(null);
  const [loading, setLoading] = useState(true);
  const { hata } = useHataMesaji();

  useEffect(() => {
    const veriCek = async () => {
      setLoading(true);
      const res = await fetch("/ana-sayfa/api/yonetici");
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Veriler yüklenemedi.", data.adim, data.detay); }
      else { setVeri(data); }
      setLoading(false);
    };
    veriCek();
  }, [user]);

  const bugunTarih = () =>
    new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });

  const haftaTarihi = () => {
    const baslangic = new Date();
    baslangic.setDate(baslangic.getDate() - baslangic.getDay() + 1);
    const bitis = new Date(baslangic);
    bitis.setDate(bitis.getDate() + 6);
    return `${baslangic.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })} — ${bitis.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" })}`;
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

  const istat = veri?.istatistikler ?? { yayin_sayisi: 0, hafta_izlenme: 0, utt_sayisi: 0, tamamlanma_orani: 0 };
  const ad = adSoyad.split(" ")[0] || "Yönetici";

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "28px 32px" }}>

      {/* Karşılama */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 800, color: "#111827", margin: 0 }}>Merhaba, {ad} 👋</h1>
          <p style={{ fontSize: "13px", color: "#737373", marginTop: "4px" }}>{rol.toUpperCase()}</p>
        </div>
        <span style={{ fontSize: "12px", color: "#737373", background: "white", border: "1px solid #e5e7eb", borderRadius: "20px", padding: "5px 14px", whiteSpace: "nowrap" }}>
          {bugunTarih()}
        </span>
      </div>

      {/* Stat kartlar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "28px" }}>
        {[
          { label: "Yayındaki Video", value: istat.yayin_sayisi, sub: "Aktif içerik", renk: "#16a34a" },
          { label: "Bu Hafta İzlenme", value: istat.hafta_izlenme, sub: "Toplam izlenme sayısı", renk: "#56aeff" },
          { label: "Aktif UTT", value: istat.utt_sayisi, sub: "Platforma kayıtlı", renk: "#f59e0b" },
          { label: "Tamamlanma Oranı", value: `%${istat.tamamlanma_orani}`, sub: "Başlayan / tamamlayan", renk: "#bc2d0d" },
        ].map((k, idx) => (
          <div
            key={idx}
            style={{
              background: "white",
              border: "1px solid #e5e7eb",
              borderLeft: `3px solid ${k.renk}`,
              borderRadius: "12px",
              padding: "20px 22px",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#9ca3af", letterSpacing: "0.4px", textTransform: "uppercase", marginBottom: "10px" }}>{k.label}</div>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#111827", lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: "12px", color: "#737373", marginTop: "6px" }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>

        {/* En Çok İzlenenler */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>En Çok İzlenenler</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {(veri?.en_cok_izlenenler ?? []).length === 0 ? (
              <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "32px", textAlign: "center", fontSize: "13px", color: "#9ca3af" }}>
                Henüz izlenme yok.
              </div>
            ) : (
              (veri?.en_cok_izlenenler ?? []).map((v, i) => (
                <div key={v.yayin_id} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px 14px", display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "8px", overflow: "hidden", flexShrink: 0 }}>
                    {v.thumbnail_url
                      ? <img src={v.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <div style={{ width: "100%", height: "100%", background: GRADYANLAR[i % GRADYANLAR.length] }} />
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.urun_adi}</div>
                    <div style={{ fontSize: "11px", color: "#737373", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.teknik_adi}</div>
                  </div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#56aeff", flexShrink: 0 }}>{v.izlenme_sayisi} izlenme</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Haftanın En'leri */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>Haftanın En'leri</span>
            <span style={{ fontSize: "10px", color: "#9ca3af" }}>{haftaTarihi()}</span>
          </div>
          <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
            {(veri?.haftanin_enleri ?? []).length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", fontSize: "13px", color: "#9ca3af" }}>
                Bu hafta henüz puan kazanılmadı.
              </div>
            ) : (
              (veri?.haftanin_enleri ?? []).map((utt, i) => (
                <div key={utt.kullanici_id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderBottom: i < (veri?.haftanin_enleri ?? []).length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <div style={{ width: "20px", fontSize: "12px", fontWeight: 700, color: i === 0 ? "#56aeff" : "#9ca3af", textAlign: "center" }}>{i + 1}</div>
                  {utt.fotograf_url ? (
                    <img src={utt.fotograf_url} alt={utt.ad} style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: i === 0 ? "#b5d4f4" : "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: i === 0 ? "#1d4ed8" : "#374151", flexShrink: 0 }}>
                      {utt.ad[0]}{utt.soyad[0]}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "#111827" }}>{utt.ad} {utt.soyad}</div>
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: i === 0 ? "#56aeff" : "#737373" }}>
                    {utt.toplam_puan.toLocaleString("tr-TR")} p
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}