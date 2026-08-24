// components/challenge-club/CcVideoOynatici.tsx
//
// CC izleme akışını yöneten React bileşeni. BM Challenge Club ekosistemine özel.
// UTT VideoOynatici'sinden tamamen ayrı; kendi state'ini, kendi API çağrılarını
// (challenge-club/izle/api/*) ve kendi UI'sını yönetir.
//
// Video oynatma teknik altyapısı lib/video/videoPlayer modülünden alınır
// (sağlayıcı bağımsız: Bunny, Mux, Cloudflare Stream, vs.).
//
// challenge_id prop'u varsa: izleme challenge tetikleyicisiyle başlar, lib
// katmanı cevap işlemede referral akışını otomatik tetikler.

"use client";

import { useEffect, useState, useRef } from "react";
import { CheckCircle2 } from "lucide-react";
import { createVideoPlayer, type VideoPlayer } from "@/lib/video/videoPlayer";
import VideoCercevesi from "@/components/video/VideoCercevesi";
import { useVideoEtkilesimKatmani } from "@/components/video/useVideoEtkilesimKatmani";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface OynaticiVideo {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  ileri_sarma_acik: boolean;
}

interface Soru {
  soru_index: number;
  soru_metni: string;
  secenekler: { harf: string; metin: string }[];
}

interface CevapSonucu {
  soru_index: number;
  verilen_cevap: string;
  dogru_cevap: string;
  dogru_mu: boolean;
  kazanilan_puan: number;
  kaybedilen_puan: number;
}

interface Props {
  video: OynaticiVideo;
  challenge_id?: string | null;
  onKapat: () => void;
  onVeriYenile: () => void | Promise<void>;
  hata: (mesaj: string, adim?: string, detay?: any) => void;
  basari: (mesaj: string) => void;
  uyari: (mesaj: string) => void;
}

export default function CcVideoOynatici({
  video,
  challenge_id,
  onKapat,
  onVeriYenile,
  hata,
  basari,
  uyari,
}: Props) {
  // ─── State ─────────────────────────────────────────────────────────────────
  const [izlemeId, setIzlemeId] = useState<string | null>(null);
  const [izlemeTuru, setIzlemeTuru] = useState<"kendi_izleme" | "challenge" | "extra" | null>(null);
  const [izlemeTamamlandi, setIzlemeTamamlandi] = useState(false);

  const [sorular, setSorular] = useState<Soru[]>([]);
  const [soruGosterilecek, setSoruGosterilecek] = useState(false);
  const [cevaplar, setCevaplar] = useState<Record<number, string>>({});
  const [cevapSonuclari, setCevapSonuclari] = useState<CevapSonucu[]>([]);

  const [kazanilanPuan, setKazanilanPuan] = useState<number | null>(null);
  const [netPuan, setNetPuan] = useState<number | null>(null);

  const [islemLoading, setIslemLoading] = useState(false);
  const [bitisAsamasi, setBitisAsamasi] = useState<"yok" | "mesaj" | "kayboluyor">("yok");
  const [ileriSarmaModal, setIleriSarmaModal] = useState(false);
  const [bekleyenSeekBitis, setBekleyenSeekBitis] = useState<number | null>(null);

  // ─── Refs ──────────────────────────────────────────────────────────────────
  const maxIzlenenRef = useRef<number>(0);
  const ileriSarildiRef = useRef<boolean>(false);
  const izlemeIdRef = useRef<string | null>(null);
  const izlemeBitirildiRef = useRef<boolean>(false);
  const baslatTetiklendiRef = useRef<string | null>(null);
  const videoSuresiRef = useRef<number>(0);
  const playerRef = useRef<VideoPlayer | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bitisZamanlayicilariRef = useRef<number[]>([]);
  const videoEtkilesimi = useVideoEtkilesimKatmani({
    anahtar: video.yayin_id,
    playerRef,
    etkin: Boolean(video.video_url),
    ilkOynatmaZorunlu: true,
  });

  // ─── İzleme başlatma — video değiştiğinde tüm state sıfırlanır ─────────────
  useEffect(() => {
    if (!video.yayin_id) return;

    // State sıfırla
    setIzlemeId(null);
    setIzlemeTuru(null);
    setIzlemeTamamlandi(false);
    setSorular([]);
    setSoruGosterilecek(false);
    setCevaplar({});
    setCevapSonuclari([]);
    setKazanilanPuan(null);
    setNetPuan(null);
    setBitisAsamasi("yok");
    setIleriSarmaModal(false);
    setBekleyenSeekBitis(null);

    // Ref sıfırla
    izlemeIdRef.current = null;
    izlemeBitirildiRef.current = false;
    ileriSarildiRef.current = false;
    maxIzlenenRef.current = 0;
    videoSuresiRef.current = 0;

    // Önceki player'ı temizle
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    bitisZamanlayicilariRef.current.forEach((zamanlayici) => window.clearTimeout(zamanlayici));
    bitisZamanlayicilariRef.current = [];

    baslatTetiklendiRef.current = null;
  }, [video.yayin_id]);

  // ─── Player bağlantısı ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!iframeRef.current || !video.video_url) return;

    let player: VideoPlayer;
    try {
      player = createVideoPlayer(iframeRef.current, video.video_url);
    } catch (err: any) {
      hata(err?.message ?? "Video oynatıcı kurulamadı.", "createVideoPlayer", err);
      return;
    }
    playerRef.current = player;

    maxIzlenenRef.current = 0;

    player.onReady(() => {
      videoEtkilesimi.oynaticiHazir(player);
      // Video süresi
      player.getDuration((sure: number) => {
        if (sure && sure > 0) videoSuresiRef.current = sure;
      });

      // timeupdate — ileri sarma takibi + manuel bitiş tespiti
      player.onTimeUpdate((data: { seconds: number }) => {
        if (video.ileri_sarma_acik && data.seconds > maxIzlenenRef.current) {
          maxIzlenenRef.current = data.seconds;
        }

        if (
          !izlemeBitirildiRef.current &&
          videoSuresiRef.current > 0 &&
          data.seconds >= videoSuresiRef.current - 0.5
        ) {
          izlemeBitirildiRef.current = true;
          handleIzlemeBitir();
        }
      });

      // İleri sarma — yalnızca ileri_sarma_acik=true ise
      if (video.ileri_sarma_acik) {
        player.onSeeked(() => {
          player.getCurrentTime((current: number) => {
            if (current > maxIzlenenRef.current + 1) {
              setBekleyenSeekBitis(current);
              setIleriSarmaModal(true);
              player.setCurrentTime(maxIzlenenRef.current);
              player.pause(); // ileri sarma algılandı: karar verilene kadar video durur
            }
          });
        });
      }

      // ended — yedek tetikleyici
      player.onEnded(() => {
        if (izlemeBitirildiRef.current) return;
        izlemeBitirildiRef.current = true;
        handleIzlemeBitir();
      });
    });

    return () => {
      bitisZamanlayicilariRef.current.forEach((zamanlayici) => window.clearTimeout(zamanlayici));
      bitisZamanlayicilariRef.current = [];
      player.destroy();
      if (playerRef.current === player) playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.yayin_id, video.ileri_sarma_acik]);

  // ─── API çağrıları ─────────────────────────────────────────────────────────

  const handleIzlemeBaslat = async () => {
    if (izlemeIdRef.current) return { puanliZaman: true };
    if (baslatTetiklendiRef.current === video.yayin_id) return null;
    baslatTetiklendiRef.current = video.yayin_id;
    setIslemLoading(true);
    try {
      const res = await fetch("/challenge-club/izle/api/baslat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yayin_id: video.yayin_id,
          challenge_id: challenge_id ?? undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "İzleme başlatılamadı.", d.adim, d.detay);
        return null;
      }

      const yeniIzlemeId = d.izleme?.izleme_id ?? null;
      setIzlemeId(yeniIzlemeId);
      setIzlemeTuru(d.izleme?.izleme_turu ?? null);
      izlemeIdRef.current = yeniIzlemeId;
      return { puanliZaman: d.puanli_zaman === true };
    } catch (err) {
      hata("İzleme başlatılamadı.", "C-Club izleme başlangıcı", err instanceof Error ? err.message : undefined);
      return null;
    } finally {
      if (!izlemeIdRef.current) baslatTetiklendiRef.current = null;
      setIslemLoading(false);
    }
  };

  const handleIzlemeBitir = async () => {
    const id = izlemeIdRef.current ?? izlemeId;
    if (!id) return;

    setIslemLoading(true);
    const res = await fetch("/challenge-club/izle/api/bitir", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        izleme_id: id,
        ileri_sarildi_mi: ileriSarildiRef.current,
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      hata(d.hata ?? "İzleme tamamlanamadı.", d.adim, d.detay);
      setIslemLoading(false);
      return;
    }

    setIzlemeTamamlandi(true);
    setSoruGosterilecek(d.soru_gosterilecek);

    if (d.kazanilan_puan > 0) {
      setKazanilanPuan(d.kazanilan_puan);
      basari(`+${d.kazanilan_puan} puan kazandınız!`);
    }

    if (d.ileri_sarildi) {
      uyari("Video ileri sarıldığı için sorular gösterilmeyecek.");
    }

    if (d.soru_gosterilecek) {
      const sRes = await fetch(
        `/challenge-club/izle/api/sorular?izleme_id=${id}`
      );
      const sData = await sRes.json();
      if (!sRes.ok) {
        hata(sData.hata ?? "Sorular yüklenemedi.", sData.adim, sData.detay);
      } else {
        setSorular(sData.sorular ?? []);
      }
    } else {
      // Soru gösterilmeyecekse video bitiminde otomatik listeye dönüş
      bitisZamanlayicilariRef.current.push(
        window.setTimeout(() => setBitisAsamasi("mesaj"), 800)
      );
      bitisZamanlayicilariRef.current.push(
        window.setTimeout(() => setBitisAsamasi("kayboluyor"), 2200)
      );
      bitisZamanlayicilariRef.current.push(
        window.setTimeout(() => onKapat(), 2500)
      );
    }

    setIslemLoading(false);
    await onVeriYenile();
  };

  const handleCevapGonder = async () => {
    if (!izlemeId || Object.keys(cevaplar).length < sorular.length) return;
    setIslemLoading(true);
    const cevapListesi = sorular.map((s) => ({
      soru_index: s.soru_index,
      verilen_cevap: cevaplar[s.soru_index],
    }));
    const res = await fetch("/challenge-club/izle/api/cevap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ izleme_id: izlemeId, cevaplar: cevapListesi }),
    });
    const d = await res.json();
    if (!res.ok) {
      hata(d.hata ?? "Cevaplar gönderilemedi.", d.adim, d.detay);
      setIslemLoading(false);
      return;
    }
    setCevapSonuclari(d.sonuclar);
    setNetPuan(d.net);
    if (d.net > 0) {
      basari(`Net +${d.net} puan kazandınız!`);
    } else if (d.net < 0) {
      uyari(`Net ${d.net} puan kaybettiniz.`);
    }

    // Sorular cevaplandıktan sonra kullanıcıya sonuçları gösterip otomatik listeye dönüş
    bitisZamanlayicilariRef.current.push(
      window.setTimeout(() => setBitisAsamasi("mesaj"), 1200)
    );
    bitisZamanlayicilariRef.current.push(
      window.setTimeout(() => setBitisAsamasi("kayboluyor"), 2600)
    );
    bitisZamanlayicilariRef.current.push(
      window.setTimeout(() => onKapat(), 2900)
    );

    setIslemLoading(false);
    await onVeriYenile();
  };

  const handleIleriSarmaOnayla = async () => {
    if (!izlemeId || bekleyenSeekBitis === null) return;
    setIleriSarmaModal(false);
    const atlanan = bekleyenSeekBitis - maxIzlenenRef.current;
    const sure = videoSuresiRef.current;

    await fetch("/challenge-club/izle/api/ileri-sarma", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        izleme_id: izlemeId,
        atlama_baslangic: Math.round(maxIzlenenRef.current),
        atlama_bitis: Math.round(bekleyenSeekBitis),
        atlanan_sure: Math.round(atlanan),
        video_suresi: sure,
      }),
    });

    ileriSarildiRef.current = true;

    if (playerRef.current) {
      playerRef.current.setCurrentTime(bekleyenSeekBitis);
      maxIzlenenRef.current = bekleyenSeekBitis;
      playerRef.current.play(); // onay: sarılan noktadan devam et
    }
    setBekleyenSeekBitis(null);
  };

  const handleIleriSarmaReddet = () => {
    setIleriSarmaModal(false);
    setBekleyenSeekBitis(null);
    playerRef.current?.play(); // ret: kaldığı yerden (maxIzlenen) devam et
  };

  const handleOynat = async () => {
    const baslangic = await handleIzlemeBaslat();
    if (!baslangic) return;
    videoEtkilesimi.oynat();
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* Geri linki */}
      <button
        onClick={onKapat}
        className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-gray-500 text-sm p-0 w-fit"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          width="16"
          height="16"
        >
          <path d="M15 19l-7-7 7-7" />
        </svg>
        Challenge Club
      </button>

      {/* Ana kart */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {/* Başlık */}
        <div className="px-4 md:px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-gray-900">
              {video.urun_adi}
            </div>
            <div className="text-xs text-gray-500 mt-1">{video.teknik_adi}</div>
          </div>
          <div className="flex items-center gap-2">
            {izlemeTuru === "challenge" && (
              <span
                className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-bold"
                style={{
                  color: "#237ac8",
                  background: "#edf6fd",
                  border: "0.5px solid #bfdbfe",
                }}
              >
                Challenge
              </span>
            )}
            {izlemeTuru === "extra" && (
              <span
                className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-bold"
                style={{
                  color: "#7c3aed",
                  background: "rgba(124,58,237,0.08)",
                  border: "0.5px solid rgba(124,58,237,0.3)",
                }}
              >
                Extra İzleme
              </span>
            )}
            {video.ileri_sarma_acik && (
              <span
                className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-bold"
                style={{
                  color: "#237ac8",
                  background: "#edf6fd",
                  border: "0.5px solid #bfdbfe",
                }}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#237ac8"
                  strokeWidth="2.5"
                >
                  <polygon points="5 4 15 12 5 20 5 4" />
                  <line x1="19" y1="5" x2="19" y2="19" />
                </svg>
                İleri sarma açık
              </span>
            )}
          </div>
        </div>

        {/* Video */}
        {video.video_url && (
          <div className="border-b border-gray-100">
            <div className={`relative transition-opacity duration-300 ${bitisAsamasi === "kayboluyor" ? "opacity-0" : "opacity-100"}`}>
              {/* Kutu videonun oranına göre çizilir (26.07). iframe burada kalır — ref playerjs'e bağlı. */}
              <VideoCercevesi
                videoUrl={video.video_url}
                etkilesimKatmani={videoEtkilesimi.katmanAcik ? {
                  ariaLabel: `${video.urun_adi} videosunu oynat`,
                  onClick: handleOynat,
                  yalnizPlayButonu: true,
                } : null}
              >
                <iframe
                  key={video.yayin_id}
                  ref={iframeRef}
                  src={video.video_url}
                  frameBorder="0"
                  allowFullScreen
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                />
              </VideoCercevesi>
              {bitisAsamasi !== "yok" && (
                <div className="absolute inset-0 z-20 flex animate-in items-center justify-center bg-[#10233a]/80 text-white fade-in duration-200">
                  <div className="flex flex-col items-center text-center">
                    <CheckCircle2 className="size-10 text-emerald-400" />
                    <strong className="mt-3 text-base">
                      {cevapSonuclari.length > 0 ? "Cevaplar kaydedildi" : "Video tamamlandı"}
                    </strong>
                    <span className="mt-1 text-xs font-semibold text-white/80">Listeye dönülüyor…</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Aksiyon alanı */}
        <div className="px-4 md:px-5 py-4">
          {/* Sorular */}
          {izlemeTamamlandi &&
            soruGosterilecek &&
            sorular.length > 0 &&
            cevapSonuclari.length === 0 && (
              <div className="flex flex-col gap-4">
                <div className="text-sm font-semibold text-gray-900">
                  Soruları Cevapla
                </div>
                {sorular.map((soru, i) => (
                  <div
                    key={soru.soru_index}
                    className="px-3 py-3.5 bg-gray-50 rounded-xl border border-gray-200"
                  >
                    <p className="text-sm text-gray-700 font-semibold mb-3">
                      {i + 1}. {soru.soru_metni}
                    </p>
                    <div className="flex flex-col gap-2">
                      {soru.secenekler.map((s) => (
                        <button
                          key={s.harf}
                          onClick={() =>
                            setCevaplar((prev) => ({
                              ...prev,
                              [soru.soru_index]: s.harf,
                            }))
                          }
                          className="px-3 py-2.5 rounded-lg text-sm text-left cursor-pointer transition-colors"
                          style={{
                            border:
                              cevaplar[soru.soru_index] === s.harf
                                ? "1.5px solid #237ac8"
                                : "0.5px solid #e5e7eb",
                            background:
                              cevaplar[soru.soru_index] === s.harf
                                ? "#edf6fd"
                                : "white",
                            color:
                              cevaplar[soru.soru_index] === s.harf
                                ? "#237ac8"
                                : "#374151",
                            fontWeight:
                              cevaplar[soru.soru_index] === s.harf ? 600 : 400,
                            fontFamily: "'Nunito', sans-serif",
                          }}
                        >
                          {s.harf}. {s.metin}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex justify-end">
                  <button
                    onClick={handleCevapGonder}
                    disabled={
                      Object.keys(cevaplar).length < sorular.length ||
                      islemLoading
                    }
                    className="text-white border-none rounded-lg px-6 py-2.5 text-xs font-semibold cursor-pointer transition-colors hover:bg-[#1d69aa]"
                    style={{
                      background: "#237ac8",
                      opacity:
                        Object.keys(cevaplar).length < sorular.length ? 0.5 : 1,
                      fontFamily: "'Nunito', sans-serif",
                    }}
                  >
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
                <div
                  key={s.soru_index}
                  className="px-3 py-2.5 rounded-lg"
                  style={{
                    background: s.dogru_mu ? "#f0fdf4" : "#fef2f2",
                    border: `0.5px solid ${
                      s.dogru_mu ? "#bbf7d0" : "#fecaca"
                    }`,
                  }}
                >
                  <span
                    className="text-xs font-semibold"
                    style={{ color: s.dogru_mu ? "#16a34a" : "#dc2626" }}
                  >
                    {s.dogru_mu
                      ? `✓ Doğru — +${s.kazanilan_puan} puan`
                      : `✗ Yanlış — Doğru cevap: ${s.dogru_cevap} (−${s.kaybedilen_puan} puan)`}
                  </span>
                </div>
              ))}
              {netPuan !== null && (
                <div
                  className="px-4 py-3.5 rounded-xl border text-center"
                  style={{
                    background: netPuan >= 0 ? "#f0fdf4" : "#fef2f2",
                    border: `0.5px solid ${
                      netPuan >= 0 ? "#bbf7d0" : "#fecaca"
                    }`,
                  }}
                >
                  <span
                    className="text-sm font-bold"
                    style={{ color: netPuan >= 0 ? "#16a34a" : "#dc2626" }}
                  >
                    {netPuan >= 0
                      ? `Net +${netPuan} puan kazandınız!`
                      : `Net ${netPuan} puan kaybettiniz.`}
                  </span>
                </div>
              )}
              {/* Akışın sonu — sonuçların altında listeye dönme butonu */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onKapat}
                  className="text-white border-none rounded-lg px-6 py-2.5 text-xs font-semibold cursor-pointer transition-colors hover:bg-[#1d69aa]"
                  style={{ background: "#237ac8", fontFamily: "'Nunito', sans-serif" }}
                >
                  Videolara dön
                </button>
              </div>
            </div>
          )}

          {/* Soru yok ama puan var (extra izleme veya soru seti olmayan izleme) */}
          {izlemeTamamlandi &&
            !soruGosterilecek &&
            cevapSonuclari.length === 0 && (
              <div className="flex flex-col gap-3">
                {kazanilanPuan !== null && kazanilanPuan > 0 && (
                  <div
                    className="px-4 py-3.5 rounded-xl border text-center"
                    style={{
                      background: "#f0fdf4",
                      border: "0.5px solid #bbf7d0",
                    }}
                  >
                    <span className="text-sm font-bold" style={{ color: "#16a34a" }}>
                      +{kazanilanPuan} puan kazandınız!
                    </span>
                  </div>
                )}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={onKapat}
                    className="text-white border-none rounded-lg px-6 py-2.5 text-xs font-semibold cursor-pointer transition-colors hover:bg-[#1d69aa]"
                    style={{ background: "#237ac8", fontFamily: "'Nunito', sans-serif" }}
                  >
                    Videolara dön
                  </button>
                </div>
              </div>
            )}
        </div>
      </div>

      {/* İleri sarma uyarı modal */}
      {ileriSarmaModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: "rgba(0,0,0,0.4)" }}
        >
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-11/12 max-w-md shadow-lg">
            <div className="text-sm font-semibold text-gray-900 mb-3">
              İleri sarmak istiyor musunuz?
            </div>
            <div
              className="text-sm text-gray-500 leading-relaxed mb-5 rounded-lg px-3 py-3"
              style={{
                background: "#fffbeb",
                border: "0.5px solid #fde68a",
              }}
            >
              Bu videonun her saniyesi puan değer taşır. İleri sarılan süre kadar{" "}
              <strong style={{ color: "#bc2d0d" }}>puan kaybedeceksiniz</strong>.
              İleri sarılan videolarda sorular gösterilmez.
            </div>
            <div className="flex gap-2.5 justify-end">
              <button
                onClick={handleIleriSarmaReddet}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-transparent text-gray-500 text-xs cursor-pointer"
                style={{ fontFamily: "'Nunito', sans-serif" }}
              >
                İptal
              </button>
              <button
                onClick={handleIleriSarmaOnayla}
                className="px-4 py-2 rounded-lg border-none text-white text-xs font-semibold cursor-pointer"
                style={{
                  background: "#bc2d0d",
                  fontFamily: "'Nunito', sans-serif",
                }}
              >
                Anladım, İleri Sar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
