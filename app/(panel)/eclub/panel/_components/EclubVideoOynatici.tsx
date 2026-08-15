// app/eclub/panel/_components/EclubVideoOynatici.tsx
//
// E-Club kişi (eczacı/teknisyen) izleme oynatıcısı — panel içinde açılır.
// CC/UTT oynatıcısının sade hali: ileri sarma YOK, extra YOK, challenge YOK,
// kayıp puan YOK. Akış: baslat → video oynat → bitince bitir → sorular → cevapla.
// Süresi geçmiş öneride izleme olur; puan ve soru açılmaz (API'ler karar verir).

"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, HelpCircle, Send } from "lucide-react";
import { createVideoPlayer, type VideoPlayer } from "@/lib/video/videoPlayer";
import VideoCercevesi from "@/components/video/VideoCercevesi";
import { useVideoEtkilesimKatmani } from "@/components/video/useVideoEtkilesimKatmani";

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
  const videoEtkilesimi = useVideoEtkilesimKatmani({
    anahtar: oneri.oneri_id,
    playerRef,
    etkin: Boolean(oneri.video_url),
  });

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
      videoEtkilesimi.oynaticiHazir(player);
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
    if (d.puan_uyarisi) hata(d.puan_uyarisi, "puan kaydı"); // B-08: yazım hatası kullanıcıya görünür

    // Sorular tamamlama anında bu izlemeye sabitlenir ve ayrı uçtan güvenli biçimde çekilir.
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
    if (d.puan_uyarisi) hata(d.puan_uyarisi, "puan kaydı"); // B-08: yazım hatası kullanıcıya görünür
    setIslemLoading(false);
    await onTamamlandi();
  };

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onKapat}
        className="flex w-fit items-center gap-1.5 rounded-lg px-1 py-1 text-xs font-extrabold text-[#71859d] hover:text-[#237ac8]"
      >
        <ArrowLeft size={15} /> Videolarıma dön
      </button>

      <div className="overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white shadow-[0_8px_26px_rgba(31,55,90,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e7edf4] px-4 py-4 md:px-5">
          <div><div className="text-base font-extrabold text-[#203653]">{oneri.urun_adi}</div>{oneri.teknik_adi && <div className="mt-0.5 text-xs font-semibold text-[#8190a3]">{oneri.teknik_adi}</div>}</div>
          <span className="rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-2.5 py-1 text-[9px] font-extrabold text-[#2563a8]">Video ve Soru Akışı</span>
        </div>

        {oneri.video_url && (
          <div className="border-b border-[#e7edf4] bg-[#10213d]">
            {/* Kutu videonun oranına göre çizilir (26.07). iframe burada kalır — ref playerjs'e bağlı. */}
            <VideoCercevesi
              videoUrl={oneri.video_url}
              etkilesimKatmani={videoEtkilesimi.katmanAcik ? {
                ariaLabel: `${oneri.urun_adi} videosunu oynat`,
                onClick: videoEtkilesimi.oynat,
              } : null}
            >
              <iframe
                key={oneri.oneri_id}
                ref={iframeRef}
                src={oneri.video_url}
                frameBorder="0"
                allowFullScreen
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
              />
            </VideoCercevesi>
          </div>
        )}

        <div className="px-4 py-4 md:px-5 md:py-5">
          {izlemeTamamlandi && soruGosterilecek && sorular.length > 0 && cevapSonuclari.length === 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f2efff] text-[#7358c7]"><HelpCircle size={16} /></span><div><div className="text-sm font-extrabold text-[#203653]">Soruları Cevapla</div><div className="text-[10px] font-semibold text-[#8190a3]">Tüm soruları yanıtladıktan sonra cevaplarınızı gönderin.</div></div></div>
              {sorular.map((soru, i) => (
                <div key={soru.soru_index} className="rounded-2xl border border-[#e1e9f1] bg-[#f8fafc] px-3.5 py-4">
                  <p className="mb-3 text-sm font-bold leading-5 text-[#30475f]">{i + 1}. {soru.soru_metni}</p>
                  <div className="grid gap-2">
                    {soru.secenekler.map((s) => (
                      <button
                        type="button"
                        key={s.harf}
                        onClick={() => setCevaplar((prev) => ({ ...prev, [soru.soru_index]: s.harf }))}
                        className={`rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition ${cevaplar[soru.soru_index] === s.harf ? "border-[#8abde8] bg-[#eaf5fc] text-[#237ac8] ring-1 ring-[#b9d9ef]" : "border-[#dfe7f1] bg-white text-[#40556d] hover:border-[#b9d7ee]"}`}
                      >
                        <strong className="mr-1.5">{s.harf}.</strong> {s.metin}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleCevapGonder}
                  disabled={Object.keys(cevaplar).length < sorular.length || islemLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#237ac8] px-5 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-[#1d69aa] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Send size={13} /> {islemLoading ? "Gönderiliyor..." : "Cevapları Gönder"}
                </button>
              </div>
            </div>
          )}

          {cevapSonuclari.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm font-extrabold text-[#203653]"><CheckCircle2 size={17} className="text-[#16865f]" /> Cevap Sonuçları</div>
              {cevapSonuclari.map((s) => (
                <div
                  key={s.soru_index}
                  className={`rounded-xl border px-3.5 py-3 ${s.dogru_mu ? "border-[#bce8d4] bg-[#effaf5]" : "border-[#fecaca] bg-[#fff7f7]"}`}
                >
                  <span className={`text-xs font-bold ${s.dogru_mu ? "text-[#16865f]" : "text-[#b23b31]"}`}>
                    {s.dogru_mu ? "✓ Doğru" : `✗ Yanlış — Doğru cevap: ${s.dogru_cevap ?? "-"}`}
                  </span>
                </div>
              ))}
              <button
                type="button"
                onClick={onKapat}
                className="self-end rounded-xl bg-[#237ac8] px-5 py-2.5 text-xs font-extrabold text-white hover:bg-[#1d69aa]"
              >
                Panele dön
              </button>
            </div>
          )}

          {izlemeTamamlandi && !soruGosterilecek && cevapSonuclari.length === 0 && (
            <div className="rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-4 text-center">
              <span className="text-sm font-extrabold text-[#2563a8]">İzleme tamamlandı.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
