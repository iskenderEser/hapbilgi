// app/eclub/panel/_components/EclubVideoOynatici.tsx
//
// E-Club kişi (eczacı/teknisyen) izleme oynatıcısı — panel içinde açılır.
// CC/UTT oynatıcısının sade hali: ileri sarma YOK, extra YOK, challenge YOK,
// kayıp puan YOK. Akış: baslat → video oynat → bitince bitir → sorular → cevapla.
// Süre geçmiş öneride izleme olur ama puan yazılmaz (API'ler karar verir).

"use client";

import { useEffect, useRef, useState } from "react";
import { createVideoPlayer, type VideoPlayer } from "@/lib/video/videoPlayer";

interface OynaticiOneri {
  oneri_id: string;
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
  dogru_cevap: string | null;
}

interface Props {
  oneri: OynaticiOneri;
  onKapat: () => void;
  onTamamlandi: () => void | Promise<void>;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export default function EclubVideoOynatici({ oneri, onKapat, onTamamlandi, hata, basari }: Props) {
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

  // İzleme başlat — öneri değiştiğinde
  useEffect(() => {
    if (!oneri.oneri_id) return;
    if (baslatTetiklendiRef.current === oneri.oneri_id) return;
    baslatTetiklendiRef.current = oneri.oneri_id;

    izlemeIdRef.current = null;
    izlemeBitirildiRef.current = false;
    videoSuresiRef.current = 0;

    handleBaslat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oneri.oneri_id]);

  // Player bağlantısı
  useEffect(() => {
    if (!izlemeBasladi || !iframeRef.current || !oneri.video_url) return;

    let player: VideoPlayer;
    try {
      player = createVideoPlayer(iframeRef.current, oneri.video_url);
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
        if (
          !izlemeBitirildiRef.current &&
          videoSuresiRef.current > 0 &&
          data.seconds >= videoSuresiRef.current - 0.5
        ) {
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
  }, [izlemeBasladi, oneri.oneri_id]);

  const handleBaslat = async () => {
    setIslemLoading(true);
    const res = await fetch("/eclub/panel/api/baslat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oneri_id: oneri.oneri_id }),
    });
    const d = await res.json();
    if (!res.ok) {
      hata(d.hata ?? "İzleme başlatılamadı.", d.adim, d.detay);
      setIslemLoading(false);
      return;
    }
    setIzlemeId(d.izleme.izleme_id);
    izlemeIdRef.current = d.izleme.izleme_id;
    setIzlemeBasladi(true);
    setIslemLoading(false);
  };

  const handleBitir = async () => {
    const id = izlemeIdRef.current ?? izlemeId;
    if (!id) return;

    setIslemLoading(true);
    const res = await fetch("/eclub/panel/api/bitir", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ izleme_id: id }),
    });
    const d = await res.json();
    if (!res.ok) {
      hata(d.hata ?? "İzleme tamamlanamadı.", d.adim, d.detay);
      setIslemLoading(false);
      return;
    }

    setIzlemeTamamlandi(true);
    setSoruGosterilecek(d.soru_gosterilecek === true);

    if (d.puan_kazanildi && d.izleme_puani > 0) {
      basari(`+${d.izleme_puani} izleme puanı kazandınız!`);
    }

    // Sorular — v_yayin_detay.sorular panel API'den değil, ayrı sorular endpoint'i yok;
    // izleme bitince soruları göstermek için bitir sonrası cevapla ekranına geçiyoruz.
    // Soruları göstermek için sorular verisini panel API zaten sağlamıyor; bu yüzden
    // sorular cevapla API'sinin döndüğü sonuçlarla değil, ayrı çekilmeli.
    if (d.soru_gosterilecek === true) {
      const sRes = await fetch(`/eclub/panel/api/sorular?izleme_id=${id}`);
      const sData = await sRes.json();
      if (!sRes.ok) {
        hata(sData.hata ?? "Sorular yüklenemedi.", sData.adim, sData.detay);
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
    const cevapListesi = sorular.map((s) => ({
      soru_index: s.soru_index,
      verilen_cevap: cevaplar[s.soru_index],
    }));
    const res = await fetch("/eclub/panel/api/cevapla", {
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
    setCevapSonuclari(d.sonuclar ?? []);
    if (d.kazanilan_puan > 0) {
      basari(`+${d.kazanilan_puan} cevaplama puanı kazandınız!`);
    }
    setIslemLoading(false);
    await onTamamlandi();
  };

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={onKapat}
        className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-gray-500 text-sm p-0 w-fit"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
          <path d="M15 19l-7-7 7-7" />
        </svg>
        Panele dön
      </button>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 md:px-5 py-4 border-b border-gray-100">
          <div className="text-base font-semibold text-gray-900">{oneri.urun_adi}</div>
          {oneri.teknik_adi && <div className="text-xs text-gray-500 mt-1">{oneri.teknik_adi}</div>}
        </div>

        {oneri.video_url && (
          <div className="border-b border-gray-100">
            <iframe
              key={oneri.oneri_id}
              ref={iframeRef}
              src={oneri.video_url}
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
                    {soru.secenekler.map((s) => (
                      <button
                        key={s.harf}
                        onClick={() => setCevaplar((prev) => ({ ...prev, [soru.soru_index]: s.harf }))}
                        className="px-3 py-2.5 rounded-lg text-sm text-left cursor-pointer transition-colors"
                        style={{
                          border: cevaplar[soru.soru_index] === s.harf ? "1.5px solid #56aeff" : "0.5px solid #e5e7eb",
                          background: cevaplar[soru.soru_index] === s.harf ? "#e6f1fb" : "white",
                          color: cevaplar[soru.soru_index] === s.harf ? "#56aeff" : "#374151",
                          fontWeight: cevaplar[soru.soru_index] === s.harf ? 600 : 400,
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
                  disabled={Object.keys(cevaplar).length < sorular.length || islemLoading}
                  className="text-white border-none rounded-lg px-6 py-2.5 text-xs font-semibold cursor-pointer"
                  style={{
                    background: "#56aeff",
                    opacity: Object.keys(cevaplar).length < sorular.length ? 0.5 : 1,
                    fontFamily: "'Nunito', sans-serif",
                  }}
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
                <div
                  key={s.soru_index}
                  className="px-3 py-2.5 rounded-lg"
                  style={{
                    background: s.dogru_mu ? "#f0fdf4" : "#fef2f2",
                    border: `0.5px solid ${s.dogru_mu ? "#bbf7d0" : "#fecaca"}`,
                  }}
                >
                  <span className="text-xs font-semibold" style={{ color: s.dogru_mu ? "#16a34a" : "#bc2d0d" }}>
                    {s.dogru_mu ? "✓ Doğru" : `✗ Yanlış — Doğru cevap: ${s.dogru_cevap ?? "-"}`}
                  </span>
                </div>
              ))}
              <button
                onClick={onKapat}
                className="text-white border-none rounded-lg px-6 py-2.5 text-xs font-semibold cursor-pointer self-end"
                style={{ background: "#56aeff", fontFamily: "'Nunito', sans-serif" }}
              >
                Panele dön
              </button>
            </div>
          )}

          {izlemeTamamlandi && !soruGosterilecek && cevapSonuclari.length === 0 && (
            <div className="px-4 py-3.5 rounded-xl border text-center" style={{ background: "#e6f1fb", border: "0.5px solid #bfdbfe" }}>
              <span className="text-sm font-semibold" style={{ color: "#1d4ed8" }}>İzleme tamamlandı.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}