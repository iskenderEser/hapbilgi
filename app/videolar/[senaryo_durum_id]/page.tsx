// app/videolar/[senaryo_durum_id]/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";

interface Video {
  video_id: string;
  senaryo_durum_id: string;
  iu_id: string;
  video_url: string;
  thumbnail_url: string | null;
  created_at: string;
  son_durum?: string;
  son_durum_notlar?: string;
}

interface Senaryo {
  senaryo_id: string;
  talep_id: string;
  senaryo_metni: string;
  urun_adi?: string;
  teknik_adi?: string;
}

export default function VideoAkisPage() {
  const router = useRouter();
  const params = useParams();
  const senaryo_durum_id = params.senaryo_durum_id as string;

  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState<string>("");
  const [senaryo, setSenaryo] = useState<Senaryo | null>(null);
  const [videolar, setVideolar] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [gonderLoading, setGonderLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [revizyonNotu, setRevizyonNotu] = useState("");
  const [aktifRevizyon, setAktifRevizyon] = useState(false);
  const [acikVideo, setAcikVideo] = useState<string | null>(null);
  const { mesajlar, hata, basari } = useHataMesaji();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      setUser(data.user);
      setRol(data.user.user_metadata?.rol ?? "");
    });
  }, []);

  const handleCikis = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const veriCek = async () => {
    setLoading(true);
    const supabase = createClient();

    const { data: senaryoDurum, error: sdError } = await supabase
      .from("senaryo_durumu")
      .select("senaryo_id")
      .eq("senaryo_durum_id", senaryo_durum_id)
      .single();

    if (sdError || !senaryoDurum) {
      hata("Senaryo durumu bulunamadı.", "senaryo_durumu tablosu SELECT — senaryo_durum_id", sdError?.message);
    } else {
      const { data: senaryoData, error: senaryoError } = await supabase
        .from("senaryolar")
        .select("senaryo_id, talep_id, senaryo_metni")
        .eq("senaryo_id", senaryoDurum.senaryo_id)
        .single();

      if (senaryoError || !senaryoData) {
        hata("Senaryo bulunamadı.", "senaryolar tablosu SELECT — senaryo_id", senaryoError?.message);
      } else {
        const { data: talep } = await supabase
          .from("talepler")
          .select(`urunler(urun_adi), teknikler(teknik_adi)`)
          .eq("talep_id", senaryoData.talep_id)
          .single();

        setSenaryo({
          ...senaryoData,
          urun_adi: (talep as any)?.urunler?.urun_adi ?? "-",
          teknik_adi: (talep as any)?.teknikler?.teknik_adi ?? "-",
        });
      }
    }

    const { data: videolarData, error: videoError } = await supabase
      .from("videolar")
      .select("video_id, senaryo_durum_id, iu_id, video_url, thumbnail_url, created_at")
      .eq("senaryo_durum_id", senaryo_durum_id)
      .order("created_at", { ascending: true });

    if (videoError) {
      hata("Videolar yüklenemedi.", "videolar tablosu SELECT — senaryo_durum_id", videoError.message);
    }

    const videolarWithDurum = await Promise.all(
      (videolarData ?? []).map(async (v) => {
        const { data: durumlar } = await supabase
          .from("video_durumu")
          .select("durum, notlar")
          .eq("video_id", v.video_id)
          .order("created_at", { ascending: false })
          .limit(1);

        return { ...v, son_durum: durumlar?.[0]?.durum ?? null, son_durum_notlar: durumlar?.[0]?.notlar ?? null };
      })
    );

    setVideolar(videolarWithDurum);
    setLoading(false);
  };

  useEffect(() => {
    if (user && senaryo_durum_id) veriCek();
  }, [user, senaryo_durum_id]);

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const rolKucu = rol.toLowerCase();
  const isPM = ["pm", "jr_pm", "kd_pm"].includes(rolKucu);
  const isIU = rolKucu === "iu";

  const sonVideo = videolar[videolar.length - 1];
  const iuGonderebilir = isIU && (!sonVideo || sonVideo.son_durum === "Revizyon Bekleniyor" || !sonVideo.video_url);
  const revizyonSayisi = videolar.filter(v => v.son_durum === "Revizyon Bekleniyor").length;

  const handleIuGonder = async () => {
    if (!videoUrl.trim() || !sonVideo) return;
    setGonderLoading(true);

    const res = await fetch("/videolar/api", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: sonVideo.video_id, video_url: videoUrl.trim(), thumbnail_url: thumbnailUrl.trim() || null }),
    });

    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Video URL kaydedilemedi.", d.adim, d.detay); setGonderLoading(false); return; }

    const res2 = await fetch("/videolar/api/durum", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: sonVideo.video_id, durum: "Inceleme Bekleniyor" }),
    });

    const d2 = await res2.json();
    if (!res2.ok) { hata(d2.hata ?? "Durum kaydedilemedi.", d2.adim, d2.detay); }
    else basari("Video PM'e gönderildi.");

    setVideoUrl(""); setThumbnailUrl("");
    await veriCek();
    setGonderLoading(false);
  };

  const handlePMKarar = async (durum: string, notlar?: string) => {
    if (!sonVideo) return;
    setGonderLoading(true);
    const res = await fetch("/videolar/api/durum", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: sonVideo.video_id, durum, notlar }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "İşlem gerçekleştirilemedi.", d.adim, d.detay); }
    else {
      basari(durum === "Onaylandi" ? "Video onaylandı." : durum === "Revizyon Bekleniyor" ? "Revizyon talebi gönderildi." : "Video iptal edildi.");
      setAktifRevizyon(false); setRevizyonNotu("");
      await veriCek();
    }
    setGonderLoading(false);
  };

  const durumRenk = (durum: string) => {
    switch (durum) {
      case "Onaylandi": return { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" };
      case "Iptal Edildi": return { bg: "#fef2f2", text: "#bc2d0d", border: "#fecaca" };
      case "Revizyon Bekleniyor": return { bg: "#fefce8", text: "#854d0e", border: "#fde68a" };
      case "Inceleme Bekleniyor": return { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" };
      default: return { bg: "#f9fafb", text: "#737373", border: "#e5e7eb" };
    }
  };

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
      <Navbar email={user?.email ?? ""} rol={rol} onCikis={handleCikis} />

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <button onClick={() => router.push("/videolar")} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", cursor: "pointer", color: "#737373", fontSize: "13px", padding: 0, width: "fit-content" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M15 19l-7-7 7-7"/></svg>
          Videolar
        </button>

        {senaryo && (
          <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", padding: "16px 20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "10px" }}>
              <span style={{ fontSize: "15px", fontWeight: 600, color: "#111" }}>{senaryo.urun_adi}</span>
              <span style={{ fontSize: "12px", color: "#737373" }}>{senaryo.teknik_adi}</span>
            </div>
            <p style={{ fontSize: "13px", color: "#374151", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{senaryo.senaryo_metni}</p>
          </div>
        )}

        <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "0.5px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#111" }}>Video Akışı</span>
            <span style={{ fontSize: "11px", color: "#737373" }}>Revizyon: {revizyonSayisi} / 2</span>
          </div>

          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {videolar.length === 0 && <p style={{ fontSize: "13px", color: "#9ca3af", textAlign: "center", padding: "20px 0" }}>Henüz video yüklenmedi.</p>}

            {videolar.map((v, i) => {
              const renk = durumRenk(v.son_durum ?? "");
              return (
                <div key={v.video_id} style={{ border: "0.5px solid #e5e7eb", borderRadius: "10px", overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", background: "#fafafa", borderBottom: "0.5px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "11px", color: "#737373" }}>Versiyon {i + 1}</span>
                      <span style={{ fontSize: "11px", color: "#9ca3af" }}>{formatTarih(v.created_at)}</span>
                    </div>
                    {v.son_durum && <span style={{ fontSize: "11px", padding: "2px 10px", borderRadius: "20px", background: renk.bg, color: renk.text, border: `0.5px solid ${renk.border}` }}>{v.son_durum}</span>}
                  </div>

                  {v.video_url && (
                    <div style={{ padding: "14px" }}>
                      <div style={{ borderRadius: "8px", overflow: "hidden", marginBottom: "8px", cursor: "pointer" }} onClick={() => setAcikVideo(v.video_url)}>
                        {v.thumbnail_url
                          ? <img src={v.thumbnail_url} alt="thumbnail" style={{ width: "100%", height: "180px", objectFit: "cover" }} />
                          : <div style={{ width: "100%", height: "180px", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center" }}><svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" width="32" height="32"><circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4V8z"/></svg></div>
                        }
                      </div>
                      <p style={{ fontSize: "11px", color: "#9ca3af", margin: 0, wordBreak: "break-all" }}>{v.video_url}</p>
                    </div>
                  )}

                  {v.son_durum === "Revizyon Bekleniyor" && v.son_durum_notlar && (
                    <div style={{ padding: "10px 14px", background: "#fefce8", borderTop: "0.5px solid #fde68a" }}>
                      <span style={{ fontSize: "11px", color: "#854d0e", fontWeight: 600 }}>Revizyon Notu: </span>
                      <span style={{ fontSize: "12px", color: "#854d0e" }}>{v.son_durum_notlar}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {isPM && sonVideo?.son_durum === "Inceleme Bekleniyor" && (
            <div style={{ borderTop: "0.5px solid #e5e7eb", padding: "14px 20px", background: "#fafafa" }}>
              {aktifRevizyon ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <textarea value={revizyonNotu} onChange={(e) => setRevizyonNotu(e.target.value)} placeholder="Revizyon notunu yazın..." rows={3} style={{ width: "100%", border: "0.5px solid #fde68a", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", fontFamily: "'Nunito', sans-serif", resize: "vertical" }} />
                  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <button onClick={() => { setAktifRevizyon(false); setRevizyonNotu(""); }} style={{ padding: "7px 14px", borderRadius: "6px", border: "0.5px solid #e5e7eb", background: "transparent", color: "#737373", fontSize: "11px", cursor: "pointer" }}>İptal</button>
                    <button onClick={() => handlePMKarar("Revizyon Bekleniyor", revizyonNotu)} disabled={!revizyonNotu.trim() || gonderLoading} style={{ padding: "7px 14px", borderRadius: "6px", border: "none", background: "#f59e0b", color: "white", fontSize: "11px", fontWeight: 600, cursor: "pointer", opacity: !revizyonNotu.trim() ? 0.5 : 1 }}>Revizyon Gönder</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                  <button onClick={() => handlePMKarar("Onaylandi")} disabled={gonderLoading} style={{ padding: "7px 14px", borderRadius: "6px", border: "none", background: "#16a34a", color: "white", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>Onayla</button>
                  {revizyonSayisi < 2 && <button onClick={() => setAktifRevizyon(true)} disabled={gonderLoading} style={{ padding: "7px 14px", borderRadius: "6px", border: "none", background: "#f59e0b", color: "white", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>Revizyon İste</button>}
                  <button onClick={() => handlePMKarar("Iptal Edildi")} disabled={gonderLoading} style={{ padding: "7px 14px", borderRadius: "6px", border: "0.5px solid #fecaca", background: "transparent", color: "#bc2d0d", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>İptal Et</button>
                </div>
              )}
            </div>
          )}

          {iuGonderebilir && (
            <div style={{ borderTop: "0.5px solid #e5e7eb", padding: "14px 20px", background: "#fafafa" }}>
              <input type="text" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="Bunny.net video URL..." style={{ width: "100%", border: "0.5px solid #e5e7eb", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", fontFamily: "'Nunito', sans-serif", marginBottom: "8px" }} />
              <input type="text" value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} placeholder="Thumbnail URL (opsiyonel)..." style={{ width: "100%", border: "0.5px solid #e5e7eb", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", fontFamily: "'Nunito', sans-serif", marginBottom: "10px" }} />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={handleIuGonder} disabled={!videoUrl.trim() || gonderLoading} style={{ background: "#56aeff", color: "white", border: "none", borderRadius: "8px", padding: "10px 20px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif", opacity: !videoUrl.trim() ? 0.5 : 1 }}>
                  {gonderLoading ? "Gönderiliyor..." : "Gönder"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {acikVideo && (
        <div onClick={() => setAcikVideo(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: "12px", overflow: "hidden", width: "80%", maxWidth: "800px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "0.5px solid #e5e7eb" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#111" }}>Video Önizleme</span>
              <button onClick={() => setAcikVideo(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#737373", fontSize: "18px" }}>✕</button>
            </div>
            <iframe src={acikVideo} width="100%" height="450" frameBorder="0" allowFullScreen />
          </div>
        </div>
      )}

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}