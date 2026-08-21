// Müşteri izleme oynatıcısı. Kartın açılması yalnız oynatıcıyı yerleştirir;
// izleme oturumu görünür Play düğmesine basıldıktan sonra başlatılır.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, BadgeCheck, CircleAlert, CircleHelp, LoaderCircle, Play } from "lucide-react";
import { createVideoPlayer, type VideoPlayer } from "@/lib/video/videoPlayer";
import VideoCercevesi from "@/components/video/VideoCercevesi";
import { useVideoEtkilesimKatmani } from "@/components/video/useVideoEtkilesimKatmani";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface OynaticiVideo {
  gonderim_id: string;
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string | null;
  video_url: string | null;
  eczane_adi?: string;
  son_konum_saniye?: number;
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
  const [tamamlamaHatasi, setTamamlamaHatasi] = useState<string | null>(null);

  const izlemeIdRef = useRef<string | null>(null);
  const izlemeBitirildiRef = useRef(false);
  const baslatiliyorRef = useRef(false);
  const videoSuresiRef = useRef(0);
  const maxIzlenenRef = useRef(0);
  const sonKonumRef = useRef(0);
  const sonGonderilenKonumRef = useRef(0);
  const playerRef = useRef<VideoPlayer | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { katmanAcik, oynaticiHazir, oynat } = useVideoEtkilesimKatmani({
    anahtar: video.gonderim_id,
    playerRef,
    etkin: Boolean(video.video_url),
    ilkOynatmaZorunlu: true,
  });

  useEffect(() => {
    izlemeIdRef.current = null;
    izlemeBitirildiRef.current = false;
    baslatiliyorRef.current = false;
    videoSuresiRef.current = 0;
    maxIzlenenRef.current = 0;
    sonKonumRef.current = 0;
    sonGonderilenKonumRef.current = 0;
    setIzlemeId(null);
    setIzlemeBasladi(false);
    setIzlemeTamamlandi(false);
    setSorular([]);
    setSoruGosterilecek(false);
    setCevaplar({});
    setCevapSonuclari([]);
    setTamamlamaHatasi(null);
  }, [video.gonderim_id]);

  const ilerlemeKaydet = useCallback((zorla = false) => {
    const id = izlemeIdRef.current;
    const konum = Math.max(0, Math.floor(sonKonumRef.current));
    if (!id || izlemeBitirildiRef.current || konum < 1) return;
    if (!zorla && Math.abs(konum - sonGonderilenKonumRef.current) < 5) return;
    sonGonderilenKonumRef.current = konum;
    void fetch("/eczanem/api/izleme/ilerleme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ izleme_id: id, konum_saniye: konum }),
      keepalive: zorla,
    }).catch(() => { /* İlerleme bir sonraki zaman güncellemesinde yeniden yazılır. */ });
  }, []);

  const handleBitir = useCallback(async () => {
    const id = izlemeIdRef.current;
    if (!id) return;
    setIslemLoading(true);
    setTamamlamaHatasi(null);
    try {
      const res = await fetch("/eczanem/api/izleme/bitir", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ izleme_id: id }),
      });
      const d = await res.json();
      if (!res.ok) {
        const mesaj = d.hata ?? "İzleme tamamlanamadı.";
        setTamamlamaHatasi(mesaj);
        hata(mesaj, d.adim, d.detay);
        return;
      }

      setIzlemeTamamlandi(true);
      setSoruGosterilecek(d.soru_gosterilecek === true);
      if (d.puan_kazanildi && d.izleme_puani > 0) basari(`+${d.izleme_puani} izleme puanı kazandınız!`);
      if (d.puan_uyarisi) hata(d.puan_uyarisi, "puan kaydı");

      if (d.soru_gosterilecek === true) {
        const sRes = await fetch(`/eczanem/api/izleme/sorular?izleme_id=${id}`, { cache: "no-store" });
        const sData = await sRes.json();
        if (!sRes.ok) {
          if (sData.hata) hata(sData.hata, sData.adim, sData.detay);
          setSoruGosterilecek(false);
        } else {
          setSorular(sData.sorular ?? []);
        }
      }
      await onTamamlandi();
    } catch {
      setTamamlamaHatasi("İzleme tamamlanamadı; bağlantınızı kontrol edip yeniden deneyin.");
      hata("İzleme tamamlanamadı.", "izleme tamamlama");
    } finally {
      setIslemLoading(false);
    }
  }, [basari, hata, onTamamlandi]);

  useEffect(() => {
    if (!iframeRef.current || !video.video_url) return;
    let player: VideoPlayer;
    try {
      player = createVideoPlayer(iframeRef.current, video.video_url);
    } catch (err) {
      hata(err instanceof Error ? err.message : "Video oynatıcı kurulamadı.", "createVideoPlayer");
      return;
    }
    playerRef.current = player;

    player.onReady(() => {
      oynaticiHazir(player);
      player.getDuration((sure: number) => {
        if (sure > 0) videoSuresiRef.current = sure;
      });
      player.onTimeUpdate((data: { seconds: number }) => {
        if (izlemeIdRef.current && data.seconds > maxIzlenenRef.current + 1.5) {
          player.setCurrentTime(maxIzlenenRef.current);
          return;
        }
        if (data.seconds > maxIzlenenRef.current) maxIzlenenRef.current = data.seconds;
        sonKonumRef.current = data.seconds;
        ilerlemeKaydet();
        if (!izlemeBitirildiRef.current && videoSuresiRef.current > 0 && maxIzlenenRef.current >= videoSuresiRef.current - 0.5) {
          izlemeBitirildiRef.current = true;
          void handleBitir();
        }
      });
      player.onSeeked(() => {
        player.getCurrentTime((current: number) => {
          if (izlemeIdRef.current && current > maxIzlenenRef.current + 1) {
            player.setCurrentTime(maxIzlenenRef.current);
          }
        });
      });
      player.onEnded(() => {
        if (izlemeBitirildiRef.current) return;
        player.getDuration((sure: number) => {
          if (izlemeBitirildiRef.current) return;
          if (maxIzlenenRef.current < sure - 0.5) {
            player.setCurrentTime(maxIzlenenRef.current);
            player.play();
            return;
          }
          izlemeBitirildiRef.current = true;
          void handleBitir();
        });
      });
    });

    return () => {
      ilerlemeKaydet(true);
      player.destroy();
      if (playerRef.current === player) playerRef.current = null;
    };
  }, [handleBitir, hata, ilerlemeKaydet, oynaticiHazir, video.gonderim_id, video.video_url]);

  const handleOynat = async () => {
    if (!video.video_url || baslatiliyorRef.current) return;
    if (izlemeIdRef.current) {
      oynat();
      return;
    }

    baslatiliyorRef.current = true;
    setIslemLoading(true);
    try {
      const res = await fetch("/eczanem/api/izleme/baslat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gonderim_id: video.gonderim_id }),
      });
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "İzleme başlatılamadı.", d.adim, d.detay);
        return;
      }
      const yeniIzlemeId = d.izleme?.izleme_id as string | undefined;
      if (!yeniIzlemeId) {
        hata("İzleme başlatıldı ancak oturum bilgisi alınamadı.", "izleme başlangıcı");
        return;
      }
      setIzlemeId(yeniIzlemeId);
      izlemeIdRef.current = yeniIzlemeId;
      setIzlemeBasladi(true);
      const kaldigiKonum = Math.max(0, Number(d.izleme?.son_konum_saniye ?? video.son_konum_saniye ?? 0));
      sonKonumRef.current = kaldigiKonum;
      sonGonderilenKonumRef.current = kaldigiKonum;
      maxIzlenenRef.current = kaldigiKonum;
      if (kaldigiKonum > 0) playerRef.current?.setCurrentTime(kaldigiKonum);
      oynat();
    } catch {
      hata("İzleme başlatılamadı; bağlantınızı kontrol edip yeniden deneyin.", "izleme başlangıcı");
    } finally {
      baslatiliyorRef.current = false;
      setIslemLoading(false);
    }
  };

  const handleCevapGonder = async () => {
    if (!izlemeId || Object.keys(cevaplar).length < sorular.length) return;
    setIslemLoading(true);
    try {
      const cevapListesi = sorular.map((soru) => ({ soru_index: soru.soru_index, verilen_cevap: cevaplar[soru.soru_index] }));
      const res = await fetch("/eczanem/api/izleme/cevapla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ izleme_id: izlemeId, cevaplar: cevapListesi }),
      });
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "Cevaplar gönderilemedi.", d.adim, d.detay);
        return;
      }
      setCevapSonuclari(d.sonuclar ?? []);
      if (d.kazanilan_puan > 0) basari(`+${d.kazanilan_puan} cevap puanı kazandınız!`);
      if (d.puan_uyarisi) hata(d.puan_uyarisi, "puan kaydı");
      await onTamamlandi();
    } catch {
      hata("Cevaplar gönderilemedi; bağlantınızı kontrol edip yeniden deneyin.", "soru cevaplama");
    } finally {
      setIslemLoading(false);
    }
  };

  const tumuCevaplandi = sorular.length > 0 && Object.keys(cevaplar).length >= sorular.length;

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="ghost" size="sm" onClick={onKapat} className="w-fit px-0 text-xs font-extrabold text-[#61768c] hover:bg-transparent hover:text-[#237ac8]"><ArrowLeft className="size-4" /> Videolarıma dön</Button>

      <Card className="gap-0 overflow-hidden border-[#dfe7ef] py-0 shadow-sm">
        <CardHeader className="flex-row items-start justify-between gap-3 border-b border-[#e7edf3] px-4 py-4 md:px-5">
          <div className="min-w-0"><h2 className="truncate text-base font-extrabold text-[#203653]">{video.urun_adi}</h2>{video.teknik_adi && video.teknik_adi !== "-" && <p className="mt-1 truncate text-[11px] font-semibold text-[#8191a4]">{video.teknik_adi}</p>}{video.eczane_adi && <p className="mt-1 text-[10px] font-bold text-[#5f7893]">{video.eczane_adi}</p>}</div>
          <Badge variant="outline" className={izlemeTamamlandi ? "border-[#bde5d5] bg-[#edf9f4] font-extrabold text-[#157254]" : izlemeBasladi ? "border-[#c9dff1] bg-[#edf6fd] font-extrabold text-[#286fae]" : "border-[#e0e7ee] bg-[#f7f9fb] font-extrabold text-[#71849a]"}>{izlemeTamamlandi ? <BadgeCheck /> : <Play />}{izlemeTamamlandi ? "Tamamlandı" : izlemeBasladi ? "İzleniyor" : "Play ile başlayın"}</Badge>
        </CardHeader>

        {!video.video_url ? (
          <div className="px-5 py-12 text-center"><CircleAlert className="mx-auto size-8 text-[#b84c4c]" /><h3 className="mt-3 text-sm font-extrabold text-[#8f3636]">Video kaynağı bulunamadı</h3><p className="mt-1 text-xs font-semibold text-[#9a6969]">Eczanenizle iletişime geçin.</p></div>
        ) : (
          <div className="relative border-b border-[#e7edf3] bg-[#10233a]">
            <VideoCercevesi videoUrl={video.video_url} etkilesimKatmani={katmanAcik ? { ariaLabel: `${video.urun_adi} videosunu oynat`, onClick: () => void handleOynat(), yalnizPlayButonu: true } : null}>
              <iframe key={video.gonderim_id} ref={iframeRef} src={video.video_url} frameBorder="0" allowFullScreen allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" />
            </VideoCercevesi>
            {islemLoading && !izlemeBasladi && <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#10233a]/65 text-white"><span className="flex items-center gap-2 text-xs font-extrabold"><LoaderCircle className="size-4 animate-spin" /> İzleme hazırlanıyor…</span></div>}
          </div>
        )}

        <CardContent className="p-4 md:p-5">
          {!izlemeBasladi && !izlemeTamamlandi && !tamamlamaHatasi && <div className="flex items-start gap-2 rounded-xl border border-[#dce8f2] bg-[#f5f9fc] p-3 text-xs font-semibold leading-5 text-[#60758c]"><CircleHelp className="mt-0.5 size-4 shrink-0 text-[#4d8fc8]" /><p>İzleme kaydı yalnız yukarıdaki Play düğmesine bastığınızda başlar. Müşteri izlemesinde ileri sarma kapalıdır; videoyu tamamladığınızda puanınız otomatik eklenir.</p></div>}

          {tamamlamaHatasi && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#efcaca] bg-[#fff5f5] p-3 text-[#a74646]"><div className="flex items-start gap-2"><CircleAlert className="mt-0.5 size-4 shrink-0" /><p className="text-xs font-bold leading-5">{tamamlamaHatasi}</p></div><Button type="button" size="sm" variant="outline" onClick={() => void handleBitir()} disabled={islemLoading} className="h-8 border-[#e4b6b6] bg-white text-xs font-extrabold text-[#a74646]">Tamamlamayı yeniden dene</Button></div>}

          {izlemeTamamlandi && soruGosterilecek && sorular.length > 0 && cevapSonuclari.length === 0 && <div className="flex flex-col gap-4"><div><h3 className="text-sm font-extrabold text-[#263e5b]">Soruları cevaplayın</h3><p className="mt-1 text-[11px] font-semibold text-[#8191a4]">Her soru için bir seçenek işaretleyin.</p></div>{sorular.map((soru, index) => <div key={soru.soru_index} className="rounded-2xl border border-[#e0e7ee] bg-[#f8fafc] p-4"><p className="text-sm font-extrabold leading-5 text-[#40556d]">{index + 1}. {soru.soru_metni}</p><div className="mt-3 grid gap-2">{soru.secenekler.map((secenek) => { const secili = cevaplar[soru.soru_index] === secenek.harf; return <button type="button" key={secenek.harf} onClick={() => setCevaplar((mevcut) => ({ ...mevcut, [soru.soru_index]: secenek.harf }))} className={`rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition ${secili ? "border-[#6eaae0] bg-[#edf6fd] text-[#236fac] ring-1 ring-[#6eaae0]" : "border-[#dfe6ed] bg-white text-[#5e7186] hover:border-[#b8cddd] hover:bg-[#fbfdff]"}`}><span className="mr-2 inline-flex size-6 items-center justify-center rounded-lg bg-current/10">{secenek.harf}</span>{secenek.metin}</button>; })}</div></div>)}<div className="flex justify-end"><Button type="button" onClick={() => void handleCevapGonder()} disabled={!tumuCevaplandi || islemLoading} className="bg-[#237ac8] text-xs font-extrabold hover:bg-[#1d69ad]">{islemLoading ? <LoaderCircle className="animate-spin" /> : <BadgeCheck />} Cevapları gönder</Button></div></div>}

          {cevapSonuclari.length > 0 && <div className="flex flex-col gap-3"><h3 className="text-sm font-extrabold text-[#263e5b]">Sonuçlar</h3>{cevapSonuclari.map((sonuc) => <div key={sonuc.soru_index} className={`rounded-xl border px-3 py-2.5 text-xs font-extrabold ${sonuc.dogru_mu ? "border-[#bde5d5] bg-[#edf9f4] text-[#157254]" : "border-[#efcaca] bg-[#fff5f5] text-[#a74646]"}`}>{sonuc.dogru_mu ? "✓ Doğru" : `✕ Yanlış — Doğru cevap: ${sonuc.dogru_secenek ?? "-"}`}</div>)}<Button type="button" onClick={onKapat} className="self-end bg-[#237ac8] text-xs font-extrabold hover:bg-[#1d69ad]">Videolarıma dön</Button></div>}

          {izlemeTamamlandi && !soruGosterilecek && cevapSonuclari.length === 0 && <div className="rounded-2xl border border-[#bde5d5] bg-[#edf9f4] p-4 text-center"><BadgeCheck className="mx-auto size-7 text-[#16865f]" /><p className="mt-2 text-sm font-extrabold text-[#157254]">İzleme tamamlandı</p><Button type="button" variant="outline" size="sm" onClick={onKapat} className="mt-3 border-[#abd7c6] bg-white text-xs font-extrabold text-[#157254]">Videolarıma dön</Button></div>}
        </CardContent>
      </Card>
    </div>
  );
}
