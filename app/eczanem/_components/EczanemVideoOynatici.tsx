// app/eczanem/_components/EczanemVideoOynatici.tsx
// Müşteri izleme oynatıcısı — panel içinde açılır. E-Club oynatıcısının Eczanem
// uyarlaması: izleme gönderime bağlı (gonderim_id), ömür boyu teklik, kayıpsız
// (ileri sarma/kayıp yok). Akış: baslat → oynat → bitir → sorular → cevapla.

"use client";

import { useEffect, useRef, useState } from "react";
import { createVideoPlayer, type VideoPlayer } from "@/lib/video/videoPlayer";

interface OynaticiVideo {
  gonderim_id: string;
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string | null;
  video_url: string | null;
}
interface Soru {
  soru_index: number;
  soru_metni: string;
  secenekler: { harf: string; metin: string }[];
}
interface CevapSonucu {
  soru_index: number;
  dogru_mu: boolean;
  dogru_secenek: string | null;
}
interface Props {
  video: OynaticiVideo;
  onKapat: () => void;
  onTamamlandi: () => void | Promise<void>;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export default function EczanemVideoOynatici({ video, onKapat, onTamamlandi, hata, basari }: Props) {
  const [izlemeId, setIzlemeId] = useState<string | null>(null);
  const [izlemeBasladi, setIzlemeBasladi] = useState(false);
  const [izlemeTamamlandi, setIzlemeTamamlandi] = useState(false);
  const [sorular, setSorular] = useState<Soru[]>([]);
  const [soruGosterilecek, setSoruGosterilecek] = useState(false);
  const [cevaplar, setCevaplar] = useState<Record<number, string>>({});
  const [cevapSonuclari, setCevapSonuclari] = useState<CevapSonucu[]>([]);
  const [islemLoading, setIslemLoading] = useState(false);

  const izlemeIdRef = useRef<string | null>(null);
  const izlemeBitirildiRef = useRef<boolean>(false);
  const baslatTetiklendiRef = useRef<string | null>(null);
  const videoSuresiRef = useRef<number>(0);
  const playerRef = useRef<VideoPlayer | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // İzleme başlat — video değiştiğinde
  useEffect(() => {
    if (!video.gonderim_id) return;
    if (baslatTetiklendiRef.current === video.gonderim_id) return;
    baslatTetiklendiRef.current = video.gonderim_id;
    izlemeIdRef.current = null;
    izlemeBitirildiRef.current = false;
    videoSuresiRef.current = 0;
    handleBaslat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.gonderim_id]);

  // Player bağlantısı
  useEffect(() => {
    if (!izlemeBasladi || !iframeRef.current || !video.video_url) return;
    let player: VideoPlayer;
    try {
      player = createVideoPlayer(iframeRef.current, video.video_url);
    } catch (err) {
      hata(err instanceof Error ? err.message : "Video oynatıcı kurulamadı.", "createVideoPlayer");
      return;
    }
    playerRef.current = player;

    player.onReady(() => {
      player.getDuration((sure: number) => {
        if (sure && sure > 0) videoSuresiRef.current = sure;
      });
      player.onTimeUpdate((data: { seconds: number }) => {
        if (!izlemeBitirildiRef.current && videoSuresiRef.current > 0 && data.seconds >= videoSuresiRef.current - 0.5) {
          izlemeBitirildiRef.current = true;
          handleBitir();
        }
      });
      player.onEnded(() => {
        if (izlemeBitirildiRef.current) return;
        izlemeBitirildiRef.current = true;
        handleBitir();
      });
    });

    return () => {
      player.destroy();
      if (playerRef.current === player) playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [izlemeBasladi, video.gonderim_id]);

  const handleBaslat = async () => {
    setIslemLoading(true);
    const res = await fetch("/eczanem/api/izleme/baslat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gonderim_id: video.gonderim_id }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "İzleme başlatılamadı.", d.adim, d.detay); setIslemLoading(false); return; }
    setIzlemeId(d.izleme.izleme_id);
    izlemeIdRef.current = d.izleme.izleme_id;
    setIzlemeBasladi(true);
    setIslemLoading(false);
  };

  const handleBitir = async () => {
    const id = izlemeIdRef.current ?? izlemeId;
    if (!id) return;
    setIslemLoading(true);
    const res = await fetch("/eczanem/api/izleme/bitir", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ izleme_id: id }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "İzleme tamamlanamadı.", d.adim, d.detay); setIslemLoading(false); return; }

    setIzlemeTamamlandi(true);
    setSoruGosterilecek(d.soru_gosterilecek === true);
    if (d.puan_kazanildi && d.izleme_puani > 0) basari(`+${d.izleme_puani} izleme puanı kazandınız!`);
    if (d.puan_uyarisi) hata(d.puan_uyarisi, "puan kaydı"); // B-08: yazım hatası kullanıcıya görünür

    if (d.soru_gosterilecek === true) {
      const sRes = await fetch(`/eczanem/api/izleme/sorular?izleme_id=${id}`);
      const sData = await sRes.json();
      if (!sRes.ok) {
        // Sorular zaten cevaplanmış olabilir — akışı bozmadan bilgilendir.
        if (sData.hata) hata(sData.hata, sData.adim, sData.detay);
        setSoruGosterilecek(false);
      } else {
        setSorular(sData.sorular ?? []);
      }
    }
    setIslemLoading(false);
    await onTamamlandi();
  };

  const handleCevapGonder = async () => {
    if (!izlemeId || Object.keys(cevaplar).length < sorular.length) return;
    setIslemLoading(true);
    const cevapListesi = sorular.map((s) => ({ soru_index: s.soru_index, verilen_cevap: cevaplar[s.soru_index] }));
    const res = await fetch("/eczanem/api/izleme/cevapla", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ izleme_id: izlemeId, cevaplar: cevapListesi }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Cevaplar gönderilemedi.", d.adim, d.detay); setIslemLoading(false); return; }
    setCevapSonuclari(d.sonuclar ?? []);
    if (d.kazanilan_puan > 0) basari(`+${d.kazanilan_puan} cevap puanı kazandınız!`);
    if (d.puan_uyarisi) hata(d.puan_uyarisi, "puan kaydı"); // B-08: yazım hatası kullanıcıya görünür
    setIslemLoading(false);
    await onTamamlandi();
  };

  const tumuCevaplandi = Object.keys(cevaplar).length >= sorular.length;

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onKapat} className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-gray-500 text-sm p-0 w-fit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M15 19l-7-7 7-7" /></svg>
        Videolara dön
      </button>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 md:px-5 py-4 border-b border-gray-100">
          <div className="text-base font-semibold text-gray-900">{video.urun_adi}</div>
          {video.teknik_adi && <div className="text-xs text-gray-500 mt-1">{video.teknik_adi}</div>}
        </div>

        {video.video_url && (
          <div className="border-b border-gray-100">
            <iframe
              key={video.gonderim_id}
              ref={iframeRef}
              src={video.video_url}
              width="100%"
              height="400"
              frameBorder="0"
              allowFullScreen
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
            />
          </div>
        )}

        <div className="px-4 md:px-5 py-4">
          {izlemeTamamlandi && soruGosterilecek && sorular.length > 0 && cevapSonuclari.length === 0 && (
            <div className="flex flex-col gap-4">
              <div className="text-sm font-semibold text-gray-900">Soruları Cevapla</div>
              {sorular.map((soru, i) => (
                <div key={soru.soru_index} className="px-3 py-3.5 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-sm text-gray-700 font-semibold mb-3">{i + 1}. {soru.soru_metni}</p>
                  <div className="flex flex-col gap-2">
                    {soru.secenekler.map((s) => {
                      const secili = cevaplar[soru.soru_index] === s.harf;
                      return (
                        <button
                          key={s.harf}
                          onClick={() => setCevaplar((prev) => ({ ...prev, [soru.soru_index]: s.harf }))}
                          className="px-3 py-2.5 rounded-lg text-sm text-left cursor-pointer transition-colors"
                          style={{
                            border: secili ? "1.5px solid #b45309" : "0.5px solid #e5e7eb",
                            background: secili ? "#fff7ed" : "white",
                            color: secili ? "#b45309" : "#374151",
                            fontWeight: secili ? 600 : 400,
                          }}
                        >
                          {s.harf}. {s.metin}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="flex justify-end">
                <button
                  onClick={handleCevapGonder}
                  disabled={!tumuCevaplandi || islemLoading}
                  className="text-white border-none rounded-lg px-6 py-2.5 text-xs font-semibold cursor-pointer"
                  style={{ background: "#b45309", opacity: !tumuCevaplandi ? 0.5 : 1 }}
                >
                  {islemLoading ? "..." : "Cevapla"}
                </button>
              </div>
            </div>
          )}

          {cevapSonuclari.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="text-sm font-semibold text-gray-900">Sonuçlar</div>
              {cevapSonuclari.map((s) => (
                <div key={s.soru_index} className="px-3 py-2.5 rounded-lg" style={{ background: s.dogru_mu ? "#f0fdf4" : "#fef2f2", border: `0.5px solid ${s.dogru_mu ? "#bbf7d0" : "#fecaca"}` }}>
                  <span className="text-xs font-semibold" style={{ color: s.dogru_mu ? "#16a34a" : "#bc2d0d" }}>
                    {s.dogru_mu ? "✓ Doğru" : `✗ Yanlış — Doğru cevap: ${s.dogru_secenek ?? "-"}`}
                  </span>
                </div>
              ))}
              <button onClick={onKapat} className="text-white border-none rounded-lg px-6 py-2.5 text-xs font-semibold cursor-pointer self-end" style={{ background: "#b45309" }}>
                Videolara dön
              </button>
            </div>
          )}

          {izlemeTamamlandi && !soruGosterilecek && cevapSonuclari.length === 0 && (
            <div className="px-4 py-3.5 rounded-xl border text-center" style={{ background: "#fff7ed", border: "0.5px solid #fed7aa" }}>
              <span className="text-sm font-semibold" style={{ color: "#b45309" }}>İzleme tamamlandı.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
