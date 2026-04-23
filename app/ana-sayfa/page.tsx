// app/ana-sayfa/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import PmAnaSayfa from "@/components/ana-sayfa/PmAnaSayfa";
import IuAnaSayfa from "@/components/ana-sayfa/IuAnaSayfa";
import UttAnaSayfa from "@/components/ana-sayfa/UttAnaSayfa";
import BmAnaSayfa from "@/components/ana-sayfa/BmAnaSayfa";
import TmAnaSayfa from "@/components/ana-sayfa/TmAnaSayfa";
import YoneticiAnaSayfa from "@/components/ana-sayfa/YoneticiAnaSayfa";
import EgitimciAnaSayfa from "@/components/ana-sayfa/EgitimciAnaSayfa";

// UTT için mevcut veri tipleri
interface HaftaninEni {
  kullanici_id: string;
  ad: string;
  soyad: string;
  fotograf_url: string | null;
  toplam_puan: number;
}

interface VideoKart {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
  video_puani: number | null;
  yayin_tarihi: string;
  izlenme_sayisi?: number;
  begeni_sayisi?: number;
  favori_sayisi?: number;
}

interface AnaSayfaVeri {
  haftanin_enleri: HaftaninEni[];
  en_yeniler: VideoKart[];
  en_cok_izlenenler: VideoKart[];
  en_cok_begenilenler: VideoKart[];
  en_cok_favoriye_eklenenler: VideoKart[];
}

const GRADYANLAR = [
  "linear-gradient(135deg, #b5d4f4, #56aeff)",
  "linear-gradient(135deg, #c0dd97, #639922)",
  "linear-gradient(135deg, #f5c4b3, #D85A30)",
  "linear-gradient(135deg, #CECBF6, #534AB7)",
  "linear-gradient(135deg, #9FE1CB, #1D9E75)",
];

const PM_ROLLER = ["pm", "jr_pm", "kd_pm"];
const IU_ROLLER = ["iu"];
const UTT_ROLLER = ["utt", "kd_utt"];
const BM_ROLLER = ["bm"];
const TM_ROLLER = ["tm"];
const YONETICI_ROLLER = ["gm", "gm_yrd", "drk", "paz_md", "blm_md", "med_md", "grp_pm", "sm"];
const EGITIMCI_ROLLER = ["egt_md", "egt_yrd_md", "egt_yon", "egt_uz"];

export default function AnaSayfaPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState<string>("");
  const [adSoyad, setAdSoyad] = useState<string>("");
  const [veri, setVeri] = useState<AnaSayfaVeri | null>(null);
  const [loading, setLoading] = useState(true);
  const { mesajlar, hata } = useHataMesaji();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      setUser(data.user);
      const r = data.user.user_metadata?.rol ?? "";
      setRol(r);
      const ad = data.user.user_metadata?.ad ?? "";
      const soyad = data.user.user_metadata?.soyad ?? "";
      setAdSoyad(`${ad} ${soyad}`.trim());
    });
  }, []);

  const handleCikis = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  useEffect(() => {
    if (!user || !rol) return;
    if (PM_ROLLER.includes(rol.toLowerCase()) || IU_ROLLER.includes(rol.toLowerCase()) || UTT_ROLLER.includes(rol.toLowerCase()) || BM_ROLLER.includes(rol.toLowerCase()) || TM_ROLLER.includes(rol.toLowerCase()) || YONETICI_ROLLER.includes(rol.toLowerCase()) || EGITIMCI_ROLLER.includes(rol.toLowerCase())) {
      setLoading(false);
      return;
    }

    // Diğer roller için mevcut API
    const veriCek = async () => {
      setLoading(true);
      const res = await fetch("/ana-sayfa/api");
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Veriler yüklenemedi.", data.adim, data.detay); }
      else { setVeri(data); }
      setLoading(false);
    };
    veriCek();
  }, [user, rol]);

  const haftaTarihi = () => {
    const baslangic = new Date();
    baslangic.setDate(baslangic.getDate() - baslangic.getDay() + 1);
    const bitis = new Date(baslangic);
    bitis.setDate(bitis.getDate() + 6);
    return `${baslangic.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })} — ${bitis.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" })}`;
  };

  if (!user || !rol) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg className="animate-spin" style={{ width: 24, height: 24, color: "#737373" }} fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg className="animate-spin" style={{ width: 24, height: 24, color: "#737373" }} fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={user?.email ?? ""} rol={rol} adSoyad={adSoyad} onCikis={handleCikis} />

      {/* PM görünümü */}
      {PM_ROLLER.includes(rol.toLowerCase()) && (
        <PmAnaSayfa user={user} rol={rol} adSoyad={adSoyad} />
      )}

      {/* IU görünümü */}
      {IU_ROLLER.includes(rol.toLowerCase()) && (
        <IuAnaSayfa user={user} adSoyad={adSoyad} />
      )}

      {/* UTT / KD_UTT görünümü */}
      {UTT_ROLLER.includes(rol.toLowerCase()) && (
        <UttAnaSayfa user={user} rol={rol} adSoyad={adSoyad} />
      )}

      {/* BM görünümü */}
      {BM_ROLLER.includes(rol.toLowerCase()) && (
        <BmAnaSayfa user={user} adSoyad={adSoyad} />
      )}

      {/* TM görünümü */}
      {TM_ROLLER.includes(rol.toLowerCase()) && (
        <TmAnaSayfa user={user} adSoyad={adSoyad} />
      )}

      {/* Yönetici görünümü */}
      {YONETICI_ROLLER.includes(rol.toLowerCase()) && (
        <YoneticiAnaSayfa user={user} rol={rol} adSoyad={adSoyad} />
      )}

      {/* Eğitimci görünümü */}
      {EGITIMCI_ROLLER.includes(rol.toLowerCase()) && (
        <EgitimciAnaSayfa user={user} rol={rol} adSoyad={adSoyad} />
      )}

      {/* Diğer roller */}
      {!PM_ROLLER.includes(rol.toLowerCase()) && !IU_ROLLER.includes(rol.toLowerCase()) && !UTT_ROLLER.includes(rol.toLowerCase()) && !BM_ROLLER.includes(rol.toLowerCase()) && !TM_ROLLER.includes(rol.toLowerCase()) && !YONETICI_ROLLER.includes(rol.toLowerCase()) && !EGITIMCI_ROLLER.includes(rol.toLowerCase()) && (
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>

          {veri && veri.haftanin_enleri.length > 0 && (
            <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid #e5e7eb", padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#111" }}>Haftanın En'leri</div>
                  <div style={{ fontSize: "11px", color: "#737373", marginTop: "2px" }}>Bu haftanın en yüksek puanlı temsilcileri</div>
                </div>
                <span style={{ fontSize: "10px", color: "#9ca3af" }}>{haftaTarihi()}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${veri.haftanin_enleri.length}, 1fr)`, gap: "10px" }}>
                {veri.haftanin_enleri.map((utt, i) => (
                  <div key={utt.kullanici_id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", padding: "12px 8px", background: i === 0 ? "#eff6ff" : "#f9fafb", borderRadius: "10px", border: i === 0 ? "1.5px solid #56aeff" : "0.5px solid #e5e7eb", position: "relative" }}>
                    <div style={{ position: "absolute", top: "-8px", background: i === 0 ? "#56aeff" : "#737373", color: "white", fontSize: "10px", fontWeight: 700, width: "18px", height: "18px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
                    {utt.fotograf_url ? (
                      <img src={utt.fotograf_url} alt={utt.ad} style={{ width: "44px", height: "44px", borderRadius: "50%", objectFit: "cover", border: i === 0 ? "2px solid #56aeff" : "2px solid #e5e7eb" }} />
                    ) : (
                      <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: i === 0 ? "#b5d4f4" : "#e5e7eb", border: i === 0 ? "2px solid #56aeff" : "2px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700, color: i === 0 ? "#1d4ed8" : "#374151" }}>
                        {utt.ad[0]}{utt.soyad[0]}
                      </div>
                    )}
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "#111", textAlign: "center" }}>{utt.ad} {utt.soyad}</div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: i === 0 ? "#56aeff" : "#737373" }}>{utt.toplam_puan.toLocaleString("tr-TR")} p</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {veri && veri.en_yeniler.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#111" }}>En Yeniler</span>
                <span style={{ fontSize: "11px", color: "#56aeff", cursor: "pointer" }} onClick={() => router.push("/izle")}>Tümünü gör</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
                {veri.en_yeniler.map(v => (
                  <VideoKartBileseni key={v.yayin_id} video={v} alt={
                    <div style={{ background: "#56aeff", color: "white", borderRadius: "20px", padding: "1px 7px", fontSize: "9px", fontWeight: 600 }}>Yeni</div>
                  } />
                ))}
              </div>
            </div>
          )}

          {veri && veri.en_yeniler.length === 0 && (
            <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", padding: "40px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>
              Henüz yayında video bulunmuyor.
            </div>
          )}
        </div>
      )}

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}

function VideoKartBileseni({ video, alt }: { video: VideoKart; alt?: React.ReactNode }) {
  return (
    <div
      style={{ background: "white", borderRadius: "10px", border: "0.5px solid #e5e7eb", overflow: "hidden", cursor: "pointer", transition: "box-shadow 0.15s" }}
      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"}
      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "none"}
    >
      <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", overflow: "hidden" }}>
        {video.thumbnail_url
          ? <img src={video.thumbnail_url} alt="thumbnail" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ width: "100%", height: "100%", background: GRADYANLAR[Math.abs(video.yayin_id.charCodeAt(0)) % GRADYANLAR.length] }} />
        }
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: "32px", height: "32px", background: "rgba(0,0,0,0.5)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="9" height="11" viewBox="0 0 10 12" fill="white"><path d="M0 0l10 6-10 6z" /></svg>
          </div>
        </div>
        {alt && <div style={{ position: "absolute", bottom: "6px", right: "6px" }}>{alt}</div>}
      </div>
      <div style={{ padding: "8px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{video.urun_adi}</div>
          <div style={{ fontSize: "10px", color: "#737373", whiteSpace: "nowrap", flexShrink: 0 }}>{video.teknik_adi}</div>
        </div>
      </div>
    </div>
  );
}