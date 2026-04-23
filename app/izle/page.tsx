// app/izle/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";

interface Video {
  yayin_id: string;
  soru_seti_durum_id: string;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
  video_puani: number | null;
  yayin_tarihi: string;
  daha_once_izledi: boolean;
  begeni_sayisi: number;
  favori_sayisi: number;
  begeni_mi: boolean;
  favori_mi: boolean;
  ileri_sarma_acik: boolean;
  extra_puan: number;
}

interface Soru {
  soru_index: number;
  soru_metni: string;
  secenekler: { harf: string; metin: string }[];
}

interface CevapSonucu {
  soru_index: number;
  verilen_cevap: string;
  dogru_mu: boolean;
  dogru_cevap: string;
}

declare global {
  interface Window {
    playerjs: any;
  }
}

export default function IzlePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState<string>("");
  const [videolar, setVideolar] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [aktifVideo, setAktifVideo] = useState<Video | null>(null);
  const [izlemeId, setIzlemeId] = useState<string | null>(null);
  const [izlemeBasladi, setIzlemeBasladi] = useState(false);
  const [izlemeTamamlandi, setIzlemeTamamlandi] = useState(false);
  const [sorular, setSorular] = useState<Soru[]>([]);
  const [soruGosterilecek, setSoruGosterilecek] = useState(false);
  const [cevaplar, setCevaplar] = useState<Record<number, string>>({});
  const [cevapSonuclari, setCevapSonuclari] = useState<CevapSonucu[]>([]);
  const [kazanilanPuan, setKazanilanPuan] = useState<number | null>(null);
  const [islemLoading, setIslemLoading] = useState(false);
  const [ileriSarmaModal, setIleriSarmaModal] = useState(false);
  const [bekleyenSeekBitis, setBekleyenSeekBitis] = useState<number | null>(null);
  const maxIzlenenRef = useRef<number>(0);
  const ileriSarilanToplamRef = useRef<number>(0);
  const playerRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { mesajlar, hata, basari, uyari } = useHataMesaji();

  const handleBegeni = async (e: React.MouseEvent, yayin_id: string) => {
    e.stopPropagation();
    const res = await fetch("/izle/api/begeni", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yayin_id }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Beğeni işlemi başarısız.", d.adim, d.detay); return; }
    setVideolar(prev => prev.map(v => v.yayin_id === yayin_id
      ? { ...v, begeni_mi: d.begeni_mi, begeni_sayisi: d.begeni_mi ? v.begeni_sayisi + 1 : v.begeni_sayisi - 1 }
      : v
    ));
  };

  const handleFavori = async (e: React.MouseEvent, yayin_id: string) => {
    e.stopPropagation();
    const res = await fetch("/izle/api/favori", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yayin_id }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Favori işlemi başarısız.", d.adim, d.detay); return; }
    setVideolar(prev => prev.map(v => v.yayin_id === yayin_id
      ? { ...v, favori_mi: d.favori_mi, favori_sayisi: d.favori_mi ? v.favori_sayisi + 1 : v.favori_sayisi - 1 }
      : v
    ));
  };

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
    const res = await fetch("/izle/api");
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Videolar yüklenemedi.", data.adim, data.detay); }
    else { setVideolar(data.videolar ?? []); }
    setLoading(false);
  };

  useEffect(() => {
    if (user) veriCek();
  }, [user]);

  // player.js yükle
  useEffect(() => {
    if (typeof window !== "undefined" && !window.playerjs) {
      const script = document.createElement("script");
      script.src = "//assets.mediadelivery.net/playerjs/playerjs-latest.min.js";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  // player.js entegrasyonu — izleme başladığında
  useEffect(() => {
    if (!izlemeBasladi || !iframeRef.current || !aktifVideo?.ileri_sarma_acik) return;

    const baglanti = () => {
      if (!window.playerjs || !iframeRef.current) return;
      maxIzlenenRef.current = 0;
      ileriSarilanToplamRef.current = 0;

      const player = new window.playerjs.Player(iframeRef.current);
      playerRef.current = player;

      player.on("ready", () => {
        player.on("timeupdate", (data: { seconds: number }) => {
          if (data.seconds > maxIzlenenRef.current) {
            maxIzlenenRef.current = data.seconds;
          }
        });

        player.on("seeked", () => {
          player.getCurrentTime((current: number) => {
            if (current > maxIzlenenRef.current + 1) {
              // İleri sarma tespit edildi
              setBekleyenSeekBitis(current);
              setIleriSarmaModal(true);
              // Geri sar
              player.setCurrentTime(maxIzlenenRef.current);
            }
          });
        });
      });
    };

    if (window.playerjs) {
      baglanti();
    } else {
      const interval = setInterval(() => {
        if (window.playerjs) {
          clearInterval(interval);
          baglanti();
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, [izlemeBasladi, aktifVideo]);

  const handleIleriSarmaOnayla = async () => {
    if (!aktifVideo || !izlemeId || bekleyenSeekBitis === null) return;
    setIleriSarmaModal(false);

    const atlanan = bekleyenSeekBitis - maxIzlenenRef.current;
    const saniyeBasiPuan = (aktifVideo.video_puani ?? 0) > 0 ? (aktifVideo.video_puani! / 60) : 0;
    const kaybedilenPuan = Math.round(saniyeBasiPuan * atlanan);

    ileriSarilanToplamRef.current += atlanan;

    // İleri sarma log kaydı
    await fetch("/izle/api/ileri-sarma", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        yayin_id: aktifVideo.yayin_id,
        izleme_id: izlemeId,
        atlama_baslangic: Math.round(maxIzlenenRef.current),
        atlama_bitis: Math.round(bekleyenSeekBitis),
        atlanan_sure: Math.round(atlanan),
        kaybedilen_puan: kaybedilenPuan,
      }),
    });

    // Player'ı ileri sar
    if (playerRef.current) {
      playerRef.current.setCurrentTime(bekleyenSeekBitis);
      maxIzlenenRef.current = bekleyenSeekBitis;
    }
    setBekleyenSeekBitis(null);
  };

  const handleIleriSarmaReddet = () => {
    setIleriSarmaModal(false);
    setBekleyenSeekBitis(null);
    // Player zaten geri sarıldı
  };

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

  const handleVideoAc = (video: Video) => {
    setAktifVideo(video);
    setIzlemeBasladi(false);
    setIzlemeTamamlandi(false);
    setSorular([]);
    setSoruGosterilecek(false);
    setCevaplar({});
    setCevapSonuclari([]);
    setKazanilanPuan(null);
    setIzlemeId(null);
    maxIzlenenRef.current = 0;
    ileriSarilanToplamRef.current = 0;
    playerRef.current = null;
  };

  const handleIzlemeBaslat = async () => {
    if (!aktifVideo) return;
    setIslemLoading(true);
    const res = await fetch("/izle/api/baslat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yayin_id: aktifVideo.yayin_id, izleme_turu: "kendi_kendine" }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "İzleme başlatılamadı.", d.adim, d.detay); setIslemLoading(false); return; }
    setIzlemeId(d.izleme.izleme_id);
    setIzlemeBasladi(true);
    setIslemLoading(false);
  };

  const handleIzlemeBitir = async () => {
    if (!izlemeId) return;
    setIslemLoading(true);
    const res = await fetch("/izle/api/bitir", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        izleme_id: izlemeId,
        ileri_sarilan_sure: ileriSarilanToplamRef.current,
      }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "İzleme tamamlanamadı.", d.adim, d.detay); setIslemLoading(false); return; }
    setIzlemeTamamlandi(true);
    setSoruGosterilecek(d.soru_gosterilecek);
    if (!d.puan_kazanildi && !d.soru_gosterilecek) {
      uyari(d.mesaj ?? "Puan kazanma saatleri dışında izlendi.");
    }
    if (d.ileri_sarildi) {
      uyari("Video ileri sarıldığı için sorular gösterilmeyecek.");
    }
    if (d.soru_gosterilecek) {
      const sRes = await fetch(`/izle/api/sorular?izleme_id=${izlemeId}`);
      const sData = await sRes.json();
      if (!sRes.ok) { hata(sData.hata ?? "Sorular yüklenemedi.", sData.adim, sData.detay); }
      else { setSorular(sData.sorular ?? []); }
    } else {
      const toplam = d.kazanilan_puanlar?.reduce((t: number, p: any) => t + p.puan, 0) ?? 0;
      setKazanilanPuan(toplam);
      if (toplam > 0) basari(`+${toplam} puan kazandınız!`);
    }
    setIslemLoading(false);
  };

  const handleCevapGonder = async () => {
    if (!izlemeId || Object.keys(cevaplar).length < sorular.length) return;
    setIslemLoading(true);
    const cevapListesi = sorular.map(s => ({ soru_index: s.soru_index, verilen_cevap: cevaplar[s.soru_index] }));
    const res = await fetch("/izle/api/cevap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ izleme_id: izlemeId, cevaplar: cevapListesi }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Cevaplar gönderilemedi.", d.adim, d.detay); setIslemLoading(false); return; }
    setCevapSonuclari(d.sonuclar);
    setKazanilanPuan(d.kazanilan_puan);
    if (d.kazanilan_puan > 0) basari(`+${d.kazanilan_puan} puan kazandınız!`);
    setIslemLoading(false);
    await veriCek();
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

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "24px" }}>

        {!aktifVideo && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <span style={{ fontSize: "14px", fontWeight: 600, color: "#111" }}>Videolar</span>
              <span style={{ fontSize: "12px", color: "#737373" }}>{videolar.length} video</span>
            </div>

            {videolar.length === 0 ? (
              <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", padding: "40px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>
                Yayında video bulunmuyor.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
                {videolar.map((v) => (
                  <div
                    key={v.yayin_id}
                    onClick={() => handleVideoAc(v)}
                    style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", overflow: "hidden", cursor: "pointer", transition: "box-shadow 0.15s" }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "none"}
                  >
                    <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "#b5d4f4", overflow: "hidden" }}>
                      {v.thumbnail_url
                        ? <img src={v.thumbnail_url} alt="thumbnail" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #b5d4f4, #56aeff)" }} />
                      }
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: "36px", height: "36px", background: "rgba(0,0,0,0.5)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="10" height="12" viewBox="0 0 10 12" fill="white"><path d="M0 0l10 6-10 6z" /></svg>
                        </div>
                      </div>
                      <div style={{ position: "absolute", top: "8px", left: "8px", display: "flex", gap: "4px" }}>
                        {v.daha_once_izledi ? (
                          <span style={{ background: "#f0fdf4", color: "#16a34a", border: "0.5px solid #bbf7d0", borderRadius: "20px", padding: "2px 8px", fontSize: "10px", fontWeight: 600 }}>İzlendi</span>
                        ) : (
                          <span style={{ background: "#56aeff", color: "white", borderRadius: "20px", padding: "2px 8px", fontSize: "10px", fontWeight: 600 }}>Yeni</span>
                        )}
                        {v.ileri_sarma_acik && (
                          <span style={{ background: "rgba(0,0,0,0.6)", color: "white", borderRadius: "20px", padding: "2px 7px", fontSize: "10px", display: "flex", alignItems: "center", gap: "3px" }}>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.urun_adi}</div>
                        <div style={{ fontSize: "11px", color: "#737373", whiteSpace: "nowrap", flexShrink: 0 }}>{v.teknik_adi}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        {v.video_puani !== null ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: "6px", padding: "3px 8px", fontSize: "11px", color: "#737373" }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#56aeff" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                              Video <span style={{ fontWeight: 600, color: "#111", marginLeft: "2px" }}>{v.video_puani}</span>
                            </div>
                            {v.extra_puan > 0 && (
                              <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "#f0fdf4", border: "0.5px solid #bbf7d0", borderRadius: "6px", padding: "3px 8px", fontSize: "11px", color: "#15803d" }}>
                                +<span style={{ fontWeight: 600 }}>{v.extra_puan}</span> extra
                              </div>
                            )}
                          </div>
                        ) : <div />}
                        <div style={{ fontSize: "10px", color: "#9ca3af", flexShrink: 0 }}>{formatTarih(v.yayin_tarihi)}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "2px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "3px", cursor: "pointer" }} onClick={(e) => handleBegeni(e, v.yayin_id)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill={v.begeni_mi ? "#bc2d0d" : "none"} stroke="#bc2d0d" strokeWidth="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                          <span style={{ fontSize: "11px", color: v.begeni_mi ? "#bc2d0d" : "#737373", fontWeight: v.begeni_mi ? 600 : 400 }}>{v.begeni_sayisi}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "3px", cursor: "pointer" }} onClick={(e) => handleFavori(e, v.yayin_id)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill={v.favori_mi ? "#56aeff" : "none"} stroke={v.favori_mi ? "#56aeff" : "#737373"} strokeWidth="2">
                            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                            <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                          </svg>
                          <span style={{ fontSize: "11px", color: v.favori_mi ? "#56aeff" : "#737373", fontWeight: v.favori_mi ? 600 : 400 }}>{v.favori_sayisi}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {aktifVideo && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <button onClick={() => setAktifVideo(null)} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", cursor: "pointer", color: "#737373", fontSize: "13px", padding: 0, width: "fit-content" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M15 19l-7-7 7-7" /></svg>
              Videolar
            </button>

            <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: "0.5px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 600, color: "#111" }}>{aktifVideo.urun_adi}</div>
                  <div style={{ fontSize: "12px", color: "#737373", marginTop: "4px" }}>{aktifVideo.teknik_adi}</div>
                </div>
                {aktifVideo.ileri_sarma_acik && (
                  <span style={{ fontSize: "11px", color: "#bc2d0d", background: "rgba(188,45,13,0.08)", border: "0.5px solid rgba(188,45,13,0.25)", borderRadius: "20px", padding: "3px 10px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#bc2d0d" strokeWidth="2.5"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
                    İleri sarma açık
                  </span>
                )}
              </div>

              {aktifVideo.video_url && (
                <div style={{ borderBottom: "0.5px solid #e5e7eb" }}>
                  <iframe
                    ref={iframeRef}
                    src={aktifVideo.video_url}
                    width="100%"
                    height="400"
                    frameBorder="0"
                    allowFullScreen
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                  />
                </div>
              )}

              <div style={{ padding: "16px 20px" }}>
                {!izlemeBasladi && !izlemeTamamlandi && (
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <button onClick={handleIzlemeBaslat} disabled={islemLoading} style={{ background: "#56aeff", color: "white", border: "none", borderRadius: "8px", padding: "12px 32px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>
                      {islemLoading ? "..." : "İzlemeye Başla"}
                    </button>
                  </div>
                )}

                {izlemeBasladi && !izlemeTamamlandi && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "12px", color: "#737373" }}>Video izleniyor...</span>
                    <button onClick={handleIzlemeBitir} disabled={islemLoading} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: "8px", padding: "12px 32px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>
                      {islemLoading ? "..." : "İzlemeyi Tamamla"}
                    </button>
                  </div>
                )}

                {izlemeTamamlandi && soruGosterilecek && sorular.length > 0 && cevapSonuclari.length === 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#111" }}>Soruları Cevapla</div>
                    {sorular.map((soru) => (
                      <div key={soru.soru_index} style={{ padding: "14px", background: "#f9fafb", borderRadius: "10px", border: "0.5px solid #e5e7eb" }}>
                        <p style={{ fontSize: "13px", color: "#374151", fontWeight: 600, marginBottom: "12px" }}>{soru.soru_index + 1}. {soru.soru_metni}</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {soru.secenekler.map((s) => (
                            <button key={s.harf} onClick={() => setCevaplar(prev => ({ ...prev, [soru.soru_index]: s.harf }))} style={{ padding: "10px 14px", borderRadius: "8px", border: cevaplar[soru.soru_index] === s.harf ? "1.5px solid #56aeff" : "0.5px solid #e5e7eb", background: cevaplar[soru.soru_index] === s.harf ? "#e6f1fb" : "white", color: cevaplar[soru.soru_index] === s.harf ? "#56aeff" : "#374151", fontSize: "12px", fontWeight: cevaplar[soru.soru_index] === s.harf ? 600 : 400, cursor: "pointer", textAlign: "left", fontFamily: "'Nunito', sans-serif" }}>
                              {s.harf}. {s.metin}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button onClick={handleCevapGonder} disabled={Object.keys(cevaplar).length < sorular.length || islemLoading} style={{ background: "#56aeff", color: "white", border: "none", borderRadius: "8px", padding: "10px 24px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif", opacity: Object.keys(cevaplar).length < sorular.length ? 0.5 : 1 }}>
                        {islemLoading ? "..." : "Cevapla"}
                      </button>
                    </div>
                  </div>
                )}

                {cevapSonuclari.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#111" }}>Sonuçlar</div>
                    {cevapSonuclari.map((s) => (
                      <div key={s.soru_index} style={{ padding: "12px 14px", borderRadius: "8px", background: s.dogru_mu ? "#f0fdf4" : "#fef2f2", border: `0.5px solid ${s.dogru_mu ? "#bbf7d0" : "#fecaca"}` }}>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: s.dogru_mu ? "#16a34a" : "#bc2d0d" }}>
                          {s.dogru_mu ? "✓ Doğru" : `✗ Yanlış — Doğru cevap: ${s.dogru_cevap}`}
                        </span>
                      </div>
                    ))}
                    {kazanilanPuan !== null && kazanilanPuan > 0 && (
                      <div style={{ padding: "14px", background: "#eff6ff", borderRadius: "10px", border: "0.5px solid #bfdbfe", textAlign: "center" }}>
                        <span style={{ fontSize: "14px", fontWeight: 700, color: "#1d4ed8" }}>+{kazanilanPuan} puan kazandınız!</span>
                      </div>
                    )}
                  </div>
                )}

                {izlemeTamamlandi && !soruGosterilecek && kazanilanPuan !== null && cevapSonuclari.length === 0 && kazanilanPuan > 0 && (
                  <div style={{ padding: "14px", background: "#eff6ff", borderRadius: "10px", border: "0.5px solid #bfdbfe", textAlign: "center" }}>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#1d4ed8" }}>+{kazanilanPuan} puan kazandınız!</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* İleri sarma uyarı modal */}
      {ileriSarmaModal && aktifVideo && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid #e5e7eb", padding: "24px", maxWidth: "420px", width: "90%" }}>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#111", marginBottom: "12px" }}>İleri sarmak istiyor musunuz?</div>
            <div style={{ fontSize: "13px", color: "#737373", lineHeight: 1.7, marginBottom: "20px", background: "#fff7ed", border: "0.5px solid #fed7aa", borderRadius: "8px", padding: "12px 14px" }}>
              Bu videonun her saniyesi puan değer taşır. İleri sarılan süre kadar <strong style={{ color: "#bc2d0d" }}>puan kaybedeceksiniz</strong>. İleri sarılan videolarda sorular gösterilmez.
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={handleIleriSarmaReddet} style={{ padding: "8px 16px", borderRadius: "6px", border: "0.5px solid #e5e7eb", background: "transparent", color: "#737373", fontSize: "12px", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>İptal</button>
              <button onClick={handleIleriSarmaOnayla} style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "#bc2d0d", color: "white", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>Anladım, İleri Sar</button>
            </div>
          </div>
        </div>
      )}

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}