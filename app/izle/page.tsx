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
  interface Window { playerjs: any; }
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
    const res = await fetch("/izle/api/begeni", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ yayin_id }) });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Beğeni işlemi başarısız.", d.adim, d.detay); return; }
    setVideolar(prev => prev.map(v => v.yayin_id === yayin_id ? { ...v, begeni_mi: d.begeni_mi, begeni_sayisi: d.begeni_mi ? v.begeni_sayisi + 1 : v.begeni_sayisi - 1 } : v));
  };

  const handleFavori = async (e: React.MouseEvent, yayin_id: string) => {
    e.stopPropagation();
    const res = await fetch("/izle/api/favori", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ yayin_id }) });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Favori işlemi başarısız.", d.adim, d.detay); return; }
    setVideolar(prev => prev.map(v => v.yayin_id === yayin_id ? { ...v, favori_mi: d.favori_mi, favori_sayisi: d.favori_mi ? v.favori_sayisi + 1 : v.favori_sayisi - 1 } : v));
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

  useEffect(() => { if (user) veriCek(); }, [user]);

  useEffect(() => {
    if (typeof window !== "undefined" && !window.playerjs) {
      const script = document.createElement("script");
      script.src = "//assets.mediadelivery.net/playerjs/playerjs-latest.min.js";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (!izlemeBasladi || !iframeRef.current || !aktifVideo?.ileri_sarma_acik) return;
    const baglanti = () => {
      if (!window.playerjs || !iframeRef.current) return;
      maxIzlenenRef.current = 0; ileriSarilanToplamRef.current = 0;
      const player = new window.playerjs.Player(iframeRef.current);
      playerRef.current = player;
      player.on("ready", () => {
        player.on("timeupdate", (data: { seconds: number }) => { if (data.seconds > maxIzlenenRef.current) maxIzlenenRef.current = data.seconds; });
        player.on("seeked", () => {
          player.getCurrentTime((current: number) => {
            if (current > maxIzlenenRef.current + 1) { setBekleyenSeekBitis(current); setIleriSarmaModal(true); player.setCurrentTime(maxIzlenenRef.current); }
          });
        });
      });
    };
    if (window.playerjs) { baglanti(); }
    else {
      const interval = setInterval(() => { if (window.playerjs) { clearInterval(interval); baglanti(); } }, 200);
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
    await fetch("/izle/api/ileri-sarma", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yayin_id: aktifVideo.yayin_id, izleme_id: izlemeId, atlama_baslangic: Math.round(maxIzlenenRef.current), atlama_bitis: Math.round(bekleyenSeekBitis), atlanan_sure: Math.round(atlanan), kaybedilen_puan: kaybedilenPuan }),
    });
    if (playerRef.current) { playerRef.current.setCurrentTime(bekleyenSeekBitis); maxIzlenenRef.current = bekleyenSeekBitis; }
    setBekleyenSeekBitis(null);
  };

  const handleIleriSarmaReddet = () => { setIleriSarmaModal(false); setBekleyenSeekBitis(null); };

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

  const handleVideoAc = (video: Video) => {
    setAktifVideo(video); setIzlemeBasladi(false); setIzlemeTamamlandi(false);
    setSorular([]); setSoruGosterilecek(false); setCevaplar({});
    setCevapSonuclari([]); setKazanilanPuan(null); setIzlemeId(null);
    maxIzlenenRef.current = 0; ileriSarilanToplamRef.current = 0; playerRef.current = null;
  };

  const handleIzlemeBaslat = async () => {
    if (!aktifVideo) return;
    setIslemLoading(true);
    const res = await fetch("/izle/api/baslat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ yayin_id: aktifVideo.yayin_id, izleme_turu: "kendi_kendine" }) });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "İzleme başlatılamadı.", d.adim, d.detay); setIslemLoading(false); return; }
    setIzlemeId(d.izleme.izleme_id); setIzlemeBasladi(true); setIslemLoading(false);
  };

  const handleIzlemeBitir = async () => {
    if (!izlemeId) return;
    setIslemLoading(true);
    const res = await fetch("/izle/api/bitir", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ izleme_id: izlemeId, ileri_sarilan_sure: ileriSarilanToplamRef.current }) });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "İzleme tamamlanamadı.", d.adim, d.detay); setIslemLoading(false); return; }
    setIzlemeTamamlandi(true); setSoruGosterilecek(d.soru_gosterilecek);
    if (!d.puan_kazanildi && !d.soru_gosterilecek) uyari(d.mesaj ?? "Puan kazanma saatleri dışında izlendi.");
    if (d.ileri_sarildi) uyari("Video ileri sarıldığı için sorular gösterilmeyecek.");
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
    const res = await fetch("/izle/api/cevap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ izleme_id: izlemeId, cevaplar: cevapListesi }) });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Cevaplar gönderilemedi.", d.adim, d.detay); setIslemLoading(false); return; }
    setCevapSonuclari(d.sonuclar); setKazanilanPuan(d.kazanilan_puan);
    if (d.kazanilan_puan > 0) basari(`+${d.kazanilan_puan} puan kazandınız!`);
    setIslemLoading(false); await veriCek();
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
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={user?.email ?? ""} rol={rol} onCikis={handleCikis} />

      <div className="max-w-5xl mx-auto px-3 py-4 md:px-6 md:py-6">

        {/* Video listesi */}
        {!aktifVideo && (
          <>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-900">Videolar</span>
              <span className="text-xs text-gray-500">{videolar.length} video</span>
            </div>

            {videolar.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">
                Yayında video bulunmuyor.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {videolar.map((v) => (
                  <div key={v.yayin_id} onClick={() => handleVideoAc(v)}
                    className="bg-white border border-gray-200 rounded-xl overflow-hidden cursor-pointer transition-shadow duration-150"
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "none"}>

                    {/* Thumbnail */}
                    <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16/9", background: "#b5d4f4" }}>
                      {v.thumbnail_url
                        ? <img src={v.thumbnail_url} alt="thumbnail" className="w-full h-full object-cover" />
                        : <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #b5d4f4, #56aeff)" }} />
                      }
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
                          <svg width="10" height="12" viewBox="0 0 10 12" fill="white"><path d="M0 0l10 6-10 6z" /></svg>
                        </div>
                      </div>
                      <div className="absolute top-2 left-2 flex gap-1">
                        {v.daha_once_izledi ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#f0fdf4", color: "#16a34a", border: "0.5px solid #bbf7d0", fontSize: 10 }}>İzlendi</span>
                        ) : (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: "#56aeff", fontSize: 10 }}>Yeni</span>
                        )}
                        {v.ileri_sarma_acik && (
                          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-white" style={{ background: "rgba(0,0,0,0.6)", fontSize: 10 }}>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bilgi */}
                    <div className="px-3 py-2.5 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-gray-900 truncate">{v.urun_adi}</div>
                        <div className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">{v.teknik_adi}</div>
                      </div>
                      <div className="flex items-center justify-between">
                        {v.video_puani !== null ? (
                          <div className="flex items-center gap-1.5">
                            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5 text-xs text-gray-500">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#56aeff" strokeWidth="2">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </svg>
                              Video <span className="font-semibold text-gray-900 ml-0.5">{v.video_puani}</span>
                            </div>
                            {v.extra_puan > 0 && (
                              <div className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs" style={{ background: "#f0fdf4", border: "0.5px solid #bbf7d0", color: "#15803d" }}>
                                +<span className="font-semibold">{v.extra_puan}</span> extra
                              </div>
                            )}
                          </div>
                        ) : <div />}
                        <div className="text-xs text-gray-400 flex-shrink-0">{formatTarih(v.yayin_tarihi)}</div>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <div className="flex items-center gap-1 cursor-pointer" onClick={(e) => handleBegeni(e, v.yayin_id)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill={v.begeni_mi ? "#bc2d0d" : "none"} stroke="#bc2d0d" strokeWidth="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                          <span className="text-xs" style={{ color: v.begeni_mi ? "#bc2d0d" : "#737373", fontWeight: v.begeni_mi ? 600 : 400 }}>{v.begeni_sayisi}</span>
                        </div>
                        <div className="flex items-center gap-1 cursor-pointer" onClick={(e) => handleFavori(e, v.yayin_id)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill={v.favori_mi ? "#56aeff" : "none"} stroke={v.favori_mi ? "#56aeff" : "#737373"} strokeWidth="2">
                            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                            <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                          </svg>
                          <span className="text-xs" style={{ color: v.favori_mi ? "#56aeff" : "#737373", fontWeight: v.favori_mi ? 600 : 400 }}>{v.favori_sayisi}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Aktif video detayı */}
        {aktifVideo && (
          <div className="flex flex-col gap-4">
            <button onClick={() => setAktifVideo(null)}
              className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-gray-500 text-sm p-0 w-fit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M15 19l-7-7 7-7" /></svg>
              Videolar
            </button>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Başlık */}
              <div className="px-4 md:px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-gray-900">{aktifVideo.urun_adi}</div>
                  <div className="text-xs text-gray-500 mt-1">{aktifVideo.teknik_adi}</div>
                </div>
                {aktifVideo.ileri_sarma_acik && (
                  <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
                    style={{ color: "#bc2d0d", background: "rgba(188,45,13,0.08)", border: "0.5px solid rgba(188,45,13,0.25)" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#bc2d0d" strokeWidth="2.5">
                      <polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>
                    </svg>
                    İleri sarma açık
                  </span>
                )}
              </div>

              {/* Video */}
              {aktifVideo.video_url && (
                <div className="border-b border-gray-100">
                  <iframe ref={iframeRef} src={aktifVideo.video_url} width="100%" height="400"
                    frameBorder="0" allowFullScreen
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" />
                </div>
              )}

              {/* Aksiyon alanı */}
              <div className="px-4 md:px-5 py-4">

                {/* İzlemeye başla */}
                {!izlemeBasladi && !izlemeTamamlandi && (
                  <div className="flex justify-center">
                    <button onClick={handleIzlemeBaslat} disabled={islemLoading}
                      className="text-white border-none rounded-lg px-8 py-3 text-sm font-semibold cursor-pointer"
                      style={{ background: "#56aeff", fontFamily: "'Nunito', sans-serif" }}>
                      {islemLoading ? "..." : "İzlemeye Başla"}
                    </button>
                  </div>
                )}

                {/* İzlemeyi tamamla */}
                {izlemeBasladi && !izlemeTamamlandi && (
                  <div className="flex flex-col items-center gap-3">
                    <span className="text-xs text-gray-500">Video izleniyor...</span>
                    <button onClick={handleIzlemeBitir} disabled={islemLoading}
                      className="text-white border-none rounded-lg px-8 py-3 text-sm font-semibold cursor-pointer bg-green-700"
                      style={{ fontFamily: "'Nunito', sans-serif" }}>
                      {islemLoading ? "..." : "İzlemeyi Tamamla"}
                    </button>
                  </div>
                )}

                {/* Sorular */}
                {izlemeTamamlandi && soruGosterilecek && sorular.length > 0 && cevapSonuclari.length === 0 && (
                  <div className="flex flex-col gap-4">
                    <div className="text-sm font-semibold text-gray-900">Soruları Cevapla</div>
                    {sorular.map((soru) => (
                      <div key={soru.soru_index} className="px-3 py-3.5 bg-gray-50 rounded-xl border border-gray-200">
                        <p className="text-sm text-gray-700 font-semibold mb-3">{soru.soru_index + 1}. {soru.soru_metni}</p>
                        <div className="flex flex-col gap-2">
                          {soru.secenekler.map((s) => (
                            <button key={s.harf} onClick={() => setCevaplar(prev => ({ ...prev, [soru.soru_index]: s.harf }))}
                              className="px-3 py-2.5 rounded-lg text-sm text-left cursor-pointer border transition-colors"
                              style={{
                                border: cevaplar[soru.soru_index] === s.harf ? "1.5px solid #56aeff" : "0.5px solid #e5e7eb",
                                background: cevaplar[soru.soru_index] === s.harf ? "#e6f1fb" : "white",
                                color: cevaplar[soru.soru_index] === s.harf ? "#56aeff" : "#374151",
                                fontWeight: cevaplar[soru.soru_index] === s.harf ? 600 : 400,
                                fontFamily: "'Nunito', sans-serif",
                              }}>
                              {s.harf}. {s.metin}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-end">
                      <button onClick={handleCevapGonder}
                        disabled={Object.keys(cevaplar).length < sorular.length || islemLoading}
                        className="text-white border-none rounded-lg px-6 py-2.5 text-xs font-semibold cursor-pointer"
                        style={{ background: "#56aeff", opacity: Object.keys(cevaplar).length < sorular.length ? 0.5 : 1, fontFamily: "'Nunito', sans-serif" }}>
                        {islemLoading ? "..." : "Cevapla"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Cevap sonuçları */}
                {cevapSonuclari.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="text-sm font-semibold text-gray-900">Sonuçlar</div>
                    {cevapSonuclari.map((s) => (
                      <div key={s.soru_index} className="px-3 py-2.5 rounded-lg border"
                        style={{ background: s.dogru_mu ? "#f0fdf4" : "#fef2f2", border: `0.5px solid ${s.dogru_mu ? "#bbf7d0" : "#fecaca"}` }}>
                        <span className="text-xs font-semibold" style={{ color: s.dogru_mu ? "#16a34a" : "#bc2d0d" }}>
                          {s.dogru_mu ? "✓ Doğru" : `✗ Yanlış — Doğru cevap: ${s.dogru_cevap}`}
                        </span>
                      </div>
                    ))}
                    {kazanilanPuan !== null && kazanilanPuan > 0 && (
                      <div className="px-4 py-3.5 bg-blue-50 rounded-xl border border-blue-200 text-center">
                        <span className="text-sm font-bold text-blue-700">+{kazanilanPuan} puan kazandınız!</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Soru yok ama puan var */}
                {izlemeTamamlandi && !soruGosterilecek && kazanilanPuan !== null && kazanilanPuan > 0 && cevapSonuclari.length === 0 && (
                  <div className="px-4 py-3.5 bg-blue-50 rounded-xl border border-blue-200 text-center">
                    <span className="text-sm font-bold text-blue-700">+{kazanilanPuan} puan kazandınız!</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* İleri sarma uyarı modal */}
      {ileriSarmaModal && aktifVideo && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-11/12 max-w-md">
            <div className="text-sm font-semibold text-gray-900 mb-3">İleri sarmak istiyor musunuz?</div>
            <div className="text-sm text-gray-500 leading-relaxed mb-5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-3">
              Bu videonun her saniyesi puan değer taşır. İleri sarılan süre kadar <strong style={{ color: "#bc2d0d" }}>puan kaybedeceksiniz</strong>. İleri sarılan videolarda sorular gösterilmez.
            </div>
            <div className="flex gap-2.5 justify-end">
              <button onClick={handleIleriSarmaReddet}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-transparent text-gray-500 text-xs cursor-pointer"
                style={{ fontFamily: "'Nunito', sans-serif" }}>İptal</button>
              <button onClick={handleIleriSarmaOnayla}
                className="px-4 py-2 rounded-lg border-none text-white text-xs font-semibold cursor-pointer"
                style={{ background: "#bc2d0d", fontFamily: "'Nunito', sans-serif" }}>Anladım, İleri Sar</button>
            </div>
          </div>
        </div>
      )}

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}