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
      .from("senaryo_durumu").select("senaryo_id")
      .eq("senaryo_durum_id", senaryo_durum_id).single();

    if (sdError || !senaryoDurum) {
      hata("Senaryo durumu bulunamadı.", "senaryo_durumu tablosu SELECT — senaryo_durum_id", sdError?.message);
    } else {
      const { data: senaryoData, error: senaryoError } = await supabase
        .from("senaryolar").select("senaryo_id, talep_id, senaryo_metni")
        .eq("senaryo_id", senaryoDurum.senaryo_id).single();

      if (senaryoError || !senaryoData) {
        hata("Senaryo bulunamadı.", "senaryolar tablosu SELECT — senaryo_id", senaryoError?.message);
      } else {
        const { data: talep } = await supabase
          .from("talepler").select(`urunler(urun_adi), teknikler(teknik_adi)`)
          .eq("talep_id", senaryoData.talep_id).single();
        setSenaryo({ ...senaryoData, urun_adi: (talep as any)?.urunler?.urun_adi ?? "-", teknik_adi: (talep as any)?.teknikler?.teknik_adi ?? "-" });
      }
    }

    const { data: videolarData, error: videoError } = await supabase
      .from("videolar").select("video_id, senaryo_durum_id, iu_id, video_url, thumbnail_url, created_at")
      .eq("senaryo_durum_id", senaryo_durum_id).order("created_at", { ascending: true });

    if (videoError) hata("Videolar yüklenemedi.", "videolar tablosu SELECT — senaryo_durum_id", videoError.message);

    const videolarWithDurum = await Promise.all(
      (videolarData ?? []).map(async (v) => {
        const { data: durumlar } = await supabase
          .from("video_durumu").select("durum, notlar")
          .eq("video_id", v.video_id).order("created_at", { ascending: false }).limit(1);
        return { ...v, son_durum: durumlar?.[0]?.durum ?? null, son_durum_notlar: durumlar?.[0]?.notlar ?? null };
      })
    );

    setVideolar(videolarWithDurum);
    setLoading(false);
  };

  useEffect(() => { if (user && senaryo_durum_id) veriCek(); }, [user, senaryo_durum_id]);

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
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: sonVideo.video_id, video_url: videoUrl.trim(), thumbnail_url: thumbnailUrl.trim() || null }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Video URL kaydedilemedi.", d.adim, d.detay); setGonderLoading(false); return; }
    const res2 = await fetch("/videolar/api/durum", {
      method: "POST", headers: { "Content-Type": "application/json" },
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
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: sonVideo.video_id, durum, notlar }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "İşlem gerçekleştirilemedi.", d.adim, d.detay); }
    else {
      basari(durum === "Onaylandi" ? "Video onaylandı." : durum === "Revizyon Bekleniyor" ? "Revizyon talebi gönderildi." : "Video iptal edildi.");
      setAktifRevizyon(false); setRevizyonNotu(""); await veriCek();
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={user?.email ?? ""} rol={rol} onCikis={handleCikis} />

      <div className="max-w-3xl mx-auto px-3 py-4 md:px-6 md:py-6 flex flex-col gap-4">

        <button onClick={() => router.push("/videolar")}
          className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-gray-500 text-sm p-0 w-fit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M15 19l-7-7 7-7"/></svg>
          Videolar
        </button>

        {/* Senaryo bilgisi */}
        {senaryo && (
          <div className="bg-white border border-gray-200 rounded-xl px-4 md:px-5 py-4">
            <div className="flex flex-col gap-1 mb-2.5">
              <span className="text-base font-semibold text-gray-900">{senaryo.urun_adi}</span>
              <span className="text-xs text-gray-500">{senaryo.teknik_adi}</span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed m-0 whitespace-pre-wrap">{senaryo.senaryo_metni}</p>
          </div>
        )}

        {/* Video akışı */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 md:px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">Video Akışı</span>
            <span className="text-xs text-gray-500">Revizyon: {revizyonSayisi} / 2</span>
          </div>

          <div className="px-4 md:px-5 py-4 flex flex-col gap-4">
            {videolar.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-5">Henüz video yüklenmedi.</p>
            )}

            {videolar.map((v, i) => {
              const renk = durumRenk(v.son_durum ?? "");
              return (
                <div key={v.video_id} className="border border-gray-200 rounded-xl overflow-hidden">
                  {/* Versiyon başlık */}
                  <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Versiyon {i + 1}</span>
                      <span className="text-xs text-gray-400">{formatTarih(v.created_at)}</span>
                    </div>
                    {v.son_durum && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full"
                        style={{ background: renk.bg, color: renk.text, border: `0.5px solid ${renk.border}` }}>
                        {v.son_durum}
                      </span>
                    )}
                  </div>

                  {/* Thumbnail + URL */}
                  {v.video_url && (
                    <div className="p-3">
                      <div className="rounded-lg overflow-hidden mb-2 cursor-pointer" onClick={() => setAcikVideo(v.video_url)}>
                        {v.thumbnail_url
                          ? <img src={v.thumbnail_url} alt="thumbnail" className="w-full object-cover" style={{ height: 180 }} />
                          : (
                            <div className="w-full bg-gray-200 flex items-center justify-center" style={{ height: 180 }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" width="32" height="32">
                                <circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4V8z"/>
                              </svg>
                            </div>
                          )
                        }
                      </div>
                      <p className="text-xs text-gray-400 m-0 break-all">{v.video_url}</p>
                    </div>
                  )}

                  {/* Revizyon notu */}
                  {v.son_durum === "Revizyon Bekleniyor" && v.son_durum_notlar && (
                    <div className="px-3 py-2.5 bg-yellow-50 border-t border-yellow-200">
                      <span className="text-xs font-semibold text-yellow-800">Revizyon Notu: </span>
                      <span className="text-xs text-yellow-800">{v.son_durum_notlar}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* PM karar alanı */}
          {isPM && sonVideo?.son_durum === "Inceleme Bekleniyor" && (
            <div className="border-t border-gray-100 px-4 md:px-5 py-3.5 bg-gray-50">
              {aktifRevizyon ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={revizyonNotu}
                    onChange={(e) => setRevizyonNotu(e.target.value)}
                    placeholder="Revizyon notunu yazın..."
                    rows={3}
                    className="w-full border border-yellow-200 rounded-lg px-3 py-2 text-xs resize-y"
                    style={{ fontFamily: "'Nunito', sans-serif" }}
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setAktifRevizyon(false); setRevizyonNotu(""); }}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 bg-transparent text-gray-500 text-xs cursor-pointer">
                      İptal
                    </button>
                    <button onClick={() => handlePMKarar("Revizyon Bekleniyor", revizyonNotu)}
                      disabled={!revizyonNotu.trim() || gonderLoading}
                      className="px-3 py-1.5 rounded-lg border-none bg-amber-500 text-white text-xs font-semibold cursor-pointer"
                      style={{ opacity: !revizyonNotu.trim() ? 0.5 : 1 }}>
                      Revizyon Gönder
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 justify-end flex-wrap">
                  <button onClick={() => handlePMKarar("Onaylandi")} disabled={gonderLoading}
                    className="px-3 py-1.5 rounded-lg border-none bg-green-700 text-white text-xs font-semibold cursor-pointer">
                    Onayla
                  </button>
                  {revizyonSayisi < 2 && (
                    <button onClick={() => setAktifRevizyon(true)} disabled={gonderLoading}
                      className="px-3 py-1.5 rounded-lg border-none bg-amber-500 text-white text-xs font-semibold cursor-pointer">
                      Revizyon İste
                    </button>
                  )}
                  <button onClick={() => handlePMKarar("Iptal Edildi")} disabled={gonderLoading}
                    className="px-3 py-1.5 rounded-lg bg-transparent text-xs font-semibold cursor-pointer"
                    style={{ border: "0.5px solid #fecaca", color: "#bc2d0d" }}>
                    İptal Et
                  </button>
                </div>
              )}
            </div>
          )}

          {/* IU URL girişi */}
          {iuGonderebilir && (
            <div className="border-t border-gray-100 px-4 md:px-5 py-4 bg-gray-50">
              <input
                type="text" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Bunny.net video URL..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2"
                style={{ fontFamily: "'Nunito', sans-serif" }}
              />
              <input
                type="text" value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="Thumbnail URL (opsiyonel)..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2.5"
                style={{ fontFamily: "'Nunito', sans-serif" }}
              />
              <div className="flex justify-end">
                <button onClick={handleIuGonder} disabled={!videoUrl.trim() || gonderLoading}
                  className="text-white border-none rounded-lg px-5 py-2.5 text-xs font-semibold cursor-pointer"
                  style={{ background: "#56aeff", opacity: !videoUrl.trim() ? 0.5 : 1, fontFamily: "'Nunito', sans-serif" }}>
                  {gonderLoading ? "Gönderiliyor..." : "Gönder"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Video modal */}
      {acikVideo && (
        <div onClick={() => setAcikVideo(null)}
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl overflow-hidden w-11/12 md:w-4/5 max-w-3xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-900">Video Önizleme</span>
              <button onClick={() => setAcikVideo(null)}
                className="bg-transparent border-none cursor-pointer text-gray-500 text-lg">✕</button>
            </div>
            <iframe src={acikVideo} width="100%" height="450" frameBorder="0" allowFullScreen />
          </div>
        </div>
      )}

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}