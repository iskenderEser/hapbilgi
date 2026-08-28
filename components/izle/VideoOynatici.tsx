// components/izle/VideoOynatici.tsx
//
// VideoOynatici, izleme akışının React UI'sını yönetir:
//   - React state (izleme, sorular, cevaplar, puan)
//   - API çağrıları (baslat, bitir, cevap, sorular, ileri-sarma)
//   - UI render
//
// Video oynatma teknik detayları (playerjs, postMessage, vb.) `lib/video/videoPlayer`
// modülüne soyutlanmıştır. Bu sayede VideoOynatici hangi provider'ın (Bunny.net, Mux,
// Cloudflare Stream, vb.) kullanıldığını bilmek zorunda değildir; sadece soyut
// `VideoPlayer` arayüzünü kullanır.

"use client";

import { useEffect, useState, useRef } from "react";
import { createVideoPlayer, type VideoPlayer } from "@/lib/video/videoPlayer";
import { oynatmaBaslatilmaliMi } from "@/lib/izleme/baslat";
import VideoCercevesi from "@/components/video/VideoCercevesi";
import PodcastOynatici from "@/components/ogrenme-araci/PodcastOynatici";
import GorselOynatici from "@/components/ogrenme-araci/GorselOynatici";
import FlipPdfOynatici from "@/components/ogrenme-araci/FlipPdfOynatici";
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
  video_puani: number | null;
  ileri_sarma_acik: boolean;
  arac_id?: string | null;
  arac_turu?: "video" | "podcast" | "gorsel" | "flip_pdf";
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

// Puan kalemi — izleme akışında kazanılabilen puan türleri ve ablatif etiketleri.
interface PuanKalemi {
  tur: string;
  puan: number;
}

const PUAN_ETIKET: Record<string, string> = {
  izleme: "izlemeden",
  extra: "ekstra izlemeden",
  oneri: "öneriden",
  cevap: "doğru cevaplamadan",
};

// Kazanılan puan kalemlerinden birleşik, motive edici toast metni kurar.
// 0 puanlı kalemler gizlenir. Tek kalem: "İzlemeden 40 puan kazandınız. Tebrikler!"
// Çok kalem: "İzlemeden 40 puan ve doğru cevaplamadan 10 puan, toplam da 50 puan
// kazandınız. Tebrikler!". Kazanç yoksa null döner (toast atılmaz).
function puanMesaji(kalemler: PuanKalemi[]): string | null {
  const dolu = kalemler.filter((k) => k.puan > 0);
  if (dolu.length === 0) return null;

  const etiket = (tur: string) => PUAN_ETIKET[tur] ?? tur;
  const buyuk = (s: string) => s.charAt(0).toLocaleUpperCase("tr-TR") + s.slice(1);
  const parca = dolu.map((k, i) => `${i === 0 ? buyuk(etiket(k.tur)) : etiket(k.tur)} ${k.puan} puan`);

  if (parca.length === 1) return `${parca[0]} kazandınız. Tebrikler!`;

  const govde = parca.length === 2
    ? parca.join(" ve ")
    : `${parca.slice(0, -1).join(", ")} ve ${parca[parca.length - 1]}`;
  const toplam = dolu.reduce((t, k) => t + k.puan, 0);
  return `${govde}, toplam da ${toplam} puan kazandınız. Tebrikler!`;
}

interface Props {
  video: OynaticiVideo;
  tuketici: boolean;                 // sadece utt/kd_utt: izleme akışı + puan/soru. false → yalnızca oynatma.
  onizlemeYuzeyi?: boolean;          // BM katalog önizlemesi: ilk video yüzeyi tıklanabilir katmanla açılır.
  oneri_id?: string | null;          // öneri akışından geliyorsa öneri kimliği; yoksa null/undefined
  onKapat: () => void;
  onVeriYenile: () => void | Promise<void>;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
  uyari: (mesaj: string) => void;
}

export default function VideoOynatici({ video, tuketici, onizlemeYuzeyi = false, oneri_id, onKapat, onVeriYenile, hata, basari, uyari }: Props) {
  const [izlemeId, setIzlemeId] = useState<string | null>(null);
  const [izlemeTamamlandi, setIzlemeTamamlandi] = useState(false);
  const [sorular, setSorular] = useState<Soru[]>([]);
  const [soruGosterilecek, setSoruGosterilecek] = useState(false);
  const [cevaplar, setCevaplar] = useState<Record<number, string>>({});
  const [cevapSonuclari, setCevapSonuclari] = useState<CevapSonucu[]>([]);
  const [kazanilanPuan, setKazanilanPuan] = useState<number | null>(null);
  const [islemLoading, setIslemLoading] = useState(false);
  const [ileriSarmaModal, setIleriSarmaModal] = useState(false);
  const [bekleyenSeekBitis, setBekleyenSeekBitis] = useState<number | null>(null);
  const [ilkOynatmaIstendi, setIlkOynatmaIstendi] = useState(false);
  const [mesaiDisiModal, setMesaiDisiModal] = useState(false);

  const maxIzlenenRef = useRef<number>(0);
  const izlemeIdRef = useRef<string | null>(null);
  // Mesai dışı: sunucu kayıt açmaz (izleme_id null). Bu modda video serbest oynar;
  // oturum kurma/sıfırlama döngüsü devre dışıdır (kayıt/puan/soru yok).
  const kayitsizModRef = useRef<boolean>(false);
  const izlemeBitirildiRef = useRef<boolean>(false);
  const baslatTetiklendiRef = useRef<string | null>(null);
  const baslatiliyorRef = useRef<boolean>(false);
  const baslatOlayIdRef = useRef<string | null>(null);
  const ileriSarmaOlayIdRef = useRef<string | null>(null);
  const videoSuresiRef = useRef<number>(0);
  const playerRef = useRef<VideoPlayer | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const ilkOynatmaIstendiRef = useRef(false);
  const playerHazirRef = useRef(false);
  const onizlemeEtkilesimi = useVideoEtkilesimKatmani({
    anahtar: video.yayin_id,
    playerRef,
    etkin: onizlemeYuzeyi && !tuketici,
  });
  // Sorulu akışta bitir'in döndürdüğü izleme/öneri puan kalemleri — cevap sonrası
  // birleşik toast'ta izleme + doğru cevaplama tek mesajda gösterilsin diye saklanır.
  const izlemeKalemleriRef = useRef<PuanKalemi[]>([]);

  // Video değiştiğinde tüm durum sıfırlanır. İzleme kaydı burada değil,
  // kullanıcının ilk gerçek oynatma olayında açılır.
  // Aynı VideoOynatici örneği farklı videoyu oynattığında temiz başlangıç sağlar.
  useEffect(() => {
    if (!tuketici) return;
    if (!video.yayin_id) return;
    if (baslatTetiklendiRef.current === video.yayin_id) return;

    setIzlemeId(null);
    setIzlemeTamamlandi(false);
    setSorular([]);
    setSoruGosterilecek(false);
    setCevaplar({});
    setCevapSonuclari([]);
    setKazanilanPuan(null);
    setIlkOynatmaIstendi(false);
    ilkOynatmaIstendiRef.current = false;
    setIleriSarmaModal(false);
    setBekleyenSeekBitis(null);

    izlemeIdRef.current = null;
    kayitsizModRef.current = false;
    izlemeBitirildiRef.current = false;
    baslatiliyorRef.current = false;
    baslatOlayIdRef.current = null;
    ileriSarmaOlayIdRef.current = null;
    izlemeKalemleriRef.current = [];
    maxIzlenenRef.current = 0;
    videoSuresiRef.current = 0;

    // Önceki player'ı temizle (varsa)
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    baslatTetiklendiRef.current = video.yayin_id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tuketici, video.yayin_id]);

  // VideoPlayer (lib) bağlantısı — manuel bitiş tespiti + ileri sarma + yedek ended event.
  //
  // ÖNEMLİ MİMARİ NOT:
  // Üçüncü taraf player event'lerine kritik mantık bağlamak güvenilir değil.
  // Bu nedenle bitiş tespiti kendi tarafımızda yapılır: getDuration + timeupdate
  // ile manuel kontrol. `onEnded` callback'i yedek olarak korunur — bazen erken
  // tetikleyici olabilir. İki yol da `izlemeBitirildiRef` ile korunur,
  // çift `bitir` çağrısı imkansız.
  useEffect(() => {
    if ((!tuketici && !onizlemeYuzeyi) || !iframeRef.current || !video.video_url) return;

    let player: VideoPlayer;
    try {
      player = createVideoPlayer(iframeRef.current, video.video_url);
    } catch (err: unknown) {
      const mesaj = err instanceof Error ? err.message : "Video oynatıcı kurulamadı.";
      hata(mesaj, "createVideoPlayer", err instanceof Error ? err.stack : String(err));
      return;
    }
    playerRef.current = player;

    if (!tuketici) {
      player.onReady(() => {
        onizlemeEtkilesimi.oynaticiHazir(player);
      });

      return () => {
        player.destroy();
        if (playerRef.current === player) playerRef.current = null;
      };
    }

    maxIzlenenRef.current = 0;

    player.onReady(() => {
      playerHazirRef.current = true;
      // Provider önceki konumu hatırlasa dahi her gerçek deneme sıfırdan başlar.
      // Bu sistem sıfırlaması ileri sarma sayılmaz.
      player.setCurrentTime(0);

      const gercekOynatmayiBaslat = () => {
        // Play kapısı (tüketici): play'e basılmadan otomatik başlamaz.
        if (tuketici && !ilkOynatmaIstendiRef.current) {
          player.pause();
          player.setCurrentTime(0);
          return;
        }
        // Mesai dışı kayıtsız mod: oturum kurulmaz, video serbest oynar.
        if (kayitsizModRef.current) return;
        if (!oynatmaBaslatilmaliMi({
          tuketici,
          izlemeId: izlemeIdRef.current,
          baslatiliyor: baslatiliyorRef.current,
        })) return;

        // Sunucu oturumu açılana kadar oynatma ilerlemez. Başarılı yanıttan sonra
        // yine sıfırdan başlatılır; yalın sayfa açılışı DB kaydı üretmez.
        player.pause();
        player.setCurrentTime(0);
        void handleIzlemeBaslat(player);
      };

      player.onPlay(gercekOynatmayiBaslat);

      // İzleme ilerleyişi, ileri sarma denetimi ve bitiş tespiti tek timeupdate
      // akışından yürür. Süre canlı payload'dan okunur (getDuration'a gerek yok);
      // video geç yüklense de kendini onarır ve ileri sarma puan kaybı bu süreye
      // bağlı olduğundan doğru beslenir.
      player.onTimeUpdate((data: { seconds: number; duration?: number }) => {
        // Bazı provider/sürümlerde play olayı kaçarsa ilk gerçek ilerleme güvenli
        // yedektir; oturum açılana kadar konumu sıfıra geri alır.
        if (!izlemeIdRef.current) {
          if (kayitsizModRef.current) return; // mesai dışı: serbest oynar, sıfırlama yok
          if (data.seconds > 0) gercekOynatmayiBaslat();
          return;
        }

        if (data.duration && data.duration > 0) {
          videoSuresiRef.current = data.duration;
        }

        // maxIzlenen = KESİNTİSİZ izlemeyle ulaşılan en ileri nokta. Yalnız normal
        // oynatma tik'lerinde (küçük artış) ilerler; ileri atlama büyük sıçrama
        // yarattığından buraya yazılmaz. Böylece atlanan konum "izlenmiş" sayılmaz
        // ve onSeeked atlamayı yakalayabilir (aksi halde maxIzlenen konuma yetişip
        // atlamayı gizlerdi).
        const ilerleme = data.seconds - maxIzlenenRef.current;
        if (ilerleme > 0 && ilerleme < 1.5) {
          maxIzlenenRef.current = data.seconds;
        }

        // Bitiş tespiti — üçüncü taraf 'ended' event'ine güvenmeden süreye göre.
        if (
          !izlemeBitirildiRef.current &&
          videoSuresiRef.current > 0 &&
          data.seconds >= videoSuresiRef.current - 0.5
        ) {
          izlemeBitirildiRef.current = true;
          handleIzlemeBitir();
        }
      });

      // İleri sarma denetimi: kullanıcı izlemediği bir noktaya (maxIzlenen'in
      // ilerisine) atlarsa video geri sarılır ve onay modalı açılır. Onaylarsa
      // atlanan süre kadar puan kaybıyla ileri gider (handleIleriSarmaOnayla),
      // reddederse kaldığı yerden devam eder.
      player.onSeeked(() => {
        player.getCurrentTime((current: number) => {
          if (!izlemeIdRef.current) {
            player.setCurrentTime(0);
            return;
          }
          if (current > maxIzlenenRef.current + 1) {
            setBekleyenSeekBitis(current);
            ileriSarmaOlayIdRef.current = crypto.randomUUID();
            setIleriSarmaModal(true);
            player.setCurrentTime(maxIzlenenRef.current);
            player.pause(); // ileri sarma algılandı: karar verilene kadar video durur
          }
        });
      });

      // ended — yedek bitiş tetikleyicisi (provider gönderirse daha erken yakalar).
      player.onEnded(() => {
        if (!izlemeIdRef.current || izlemeBitirildiRef.current) return;
        izlemeBitirildiRef.current = true;
        handleIzlemeBitir();
      });

      // Play butonuna player hazır olmadan basıldıysa, hazır olunca başlat.
      if (ilkOynatmaIstendiRef.current) void handleIzlemeBaslat(player);
    });

    return () => {
      // Bileşen unmount veya dependency değişimi: player'ı temizle
      playerHazirRef.current = false;
      player.destroy();
      if (playerRef.current === player) playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.yayin_id, tuketici, onizlemeYuzeyi]);

  const handleIleriSarmaOnayla = async () => {
    const id = izlemeIdRef.current ?? izlemeId;
    if (!id || bekleyenSeekBitis === null) return;
    setIleriSarmaModal(false);
    setIslemLoading(true);
    ileriSarmaOlayIdRef.current ??= crypto.randomUUID();

    try {
      const res = await fetch("/izle/api/ileri-sarma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          izleme_id: id,
          olay_id: ileriSarmaOlayIdRef.current,
          atlama_baslangic: maxIzlenenRef.current,
          atlama_bitis: bekleyenSeekBitis,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "İleri sarma kaydedilemedi.", d.adim, d.detay);
        setIleriSarmaModal(true);
        return;
      }

      if (playerRef.current) {
        playerRef.current.setCurrentTime(bekleyenSeekBitis);
        maxIzlenenRef.current = bekleyenSeekBitis;
        playerRef.current.play(); // onay: sarılan noktadan devam et
      }
      if ((d.kaybedilen_puan ?? 0) > 0) {
        uyari(`İleri sarma kaydedildi: ${d.kaybedilen_puan} puan kaybettiniz.`);
      } else {
        uyari("İleri sarma kaydedildi. Bu izleme için soru hakkı kapandı.");
      }
      setBekleyenSeekBitis(null);
      ileriSarmaOlayIdRef.current = null;
    } catch (err) {
      hata("İleri sarma kaydedilemedi.", "POST /izle/api/ileri-sarma", err instanceof Error ? err.stack : String(err));
      setIleriSarmaModal(true);
    } finally {
      setIslemLoading(false);
    }
  };

  const handleIleriSarmaReddet = () => {
    setIleriSarmaModal(false);
    setBekleyenSeekBitis(null);
    ileriSarmaOlayIdRef.current = null;
    playerRef.current?.play(); // ret: kaldığı yerden (maxIzlenen) devam et
  };

  // Play kapısı: kullanıcı oynat overlay'ine bastığında izleme başlatılır.
  const handleIlkOynatma = () => {
    if (ilkOynatmaIstendiRef.current) return;
    ilkOynatmaIstendiRef.current = true;
    setIlkOynatmaIstendi(true);
    if (playerHazirRef.current && playerRef.current) void handleIzlemeBaslat(playerRef.current);
  };

  const handleIzlemeBaslat = async (player: VideoPlayer) => {
    if (!oynatmaBaslatilmaliMi({
      tuketici,
      izlemeId: izlemeIdRef.current,
      baslatiliyor: baslatiliyorRef.current,
    })) return;

    baslatiliyorRef.current = true;
    setIslemLoading(true);
    baslatOlayIdRef.current ??= crypto.randomUUID();

    try {
      const body = {
        yayin_id: video.yayin_id,
        oneri_id: oneri_id ?? null,
        baslat_olay_id: baslatOlayIdRef.current,
      };
      const res = await fetch("/izle/api/baslat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "İzleme başlatılamadı.", d.adim, d.detay);
        player.setCurrentTime(0);
        return;
      }

      // Mesai dışı: sunucu kayıt açmadı (izleme_id null). Önce bilgilendirme
      // modalı çıkar; video oynatılmaz — kullanıcı Onayla derse kayıtsız oynar.
      if (!d.izleme?.izleme_id) {
        setMesaiDisiModal(true);
        return;
      }

      setIzlemeId(d.izleme.izleme_id);
      izlemeIdRef.current = d.izleme.izleme_id;
      player.setCurrentTime(0);
      player.play();
    } catch (err) {
      hata("İzleme başlatılamadı.", "POST /izle/api/baslat", err instanceof Error ? err.stack : String(err));
      player.setCurrentTime(0);
    } finally {
      baslatiliyorRef.current = false;
      setIslemLoading(false);
    }
  };

  // Mesai dışı modalı: Onayla → kayıtsız modda serbest oynat; Vazgeç → oynatma.
  const handleMesaiDisiOnayla = () => {
    setMesaiDisiModal(false);
    kayitsizModRef.current = true;
    playerRef.current?.play();
  };

  const handleIzlemeBitir = async () => {
    const id = izlemeIdRef.current ?? izlemeId;
    if (!id) return;
    setIslemLoading(true);
    try {
      const res = await fetch("/izle/api/bitir", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ izleme_id: id }) });
      const d = await res.json();
      if (!res.ok) {
        izlemeBitirildiRef.current = false;
        hata(d.hata ?? "İzleme tamamlanamadı.", d.adim, d.detay);
        return;
      }
      setIzlemeTamamlandi(true); setSoruGosterilecek(d.soru_gosterilecek);
      if (!d.puan_kazanildi && !d.soru_gosterilecek) uyari(d.mesaj ?? "Puan kazanma saatleri dışında izlendi.");
      if (d.puan_uyarisi) uyari(d.puan_uyarisi); // B-08: puan yazım hatası kullanıcıya görünür
      if (!d.soru_gosterilecek && d.soru_hakki_nedeni) {
        const nedenMesaji: Record<string, string> = {
          ileri_sarma: "Öğrenme içeriğinde ileri gidildiği için bu tamamlama sonunda sorular gösterilmeyecek.",
          yarim_deneme: "Bu turda daha önce yarım kalan bir deneme olduğu için sorular gösterilmeyecek.",
          tekrar_izleme: "Bu öğrenme içeriği bu turda daha önce tamamlandığı için sorular tekrar gösterilmeyecek.",
          puan_disinda: "Puan saatleri dışında tamamlandığı için sorular gösterilmeyecek.",
        };
        const mesaj = nedenMesaji[d.soru_hakki_nedeni];
        if (mesaj) uyari(mesaj);
      }
      const bitirKalemleri: PuanKalemi[] = d.kazanilan_puanlar ?? [];
      if (d.soru_gosterilecek) {
        // İzleme/öneri kalemlerini sakla — toast cevap sonrası birleşik atılacak.
        izlemeKalemleriRef.current = bitirKalemleri;
        const sRes = await fetch(`/izle/api/sorular?izleme_id=${id}`);
        const sData = await sRes.json();
        if (!sRes.ok) hata(sData.hata ?? "Sorular yüklenemedi.", sData.adim, sData.detay);
        else setSorular(sData.sorular ?? []);
      } else {
        // Sorusuz akış — kazanç burada kesinleşir, birleşik mesaj hemen atılır.
        const toplam = bitirKalemleri.reduce((t, k) => t + k.puan, 0);
        setKazanilanPuan(toplam);
        const mesaj = puanMesaji(bitirKalemleri);
        if (mesaj) basari(mesaj);
      }
    } catch (err) {
      izlemeBitirildiRef.current = false;
      hata("İzleme tamamlanamadı; yeniden denenecek.", "PUT /izle/api/bitir", err instanceof Error ? err.stack : String(err));
    } finally {
      setIslemLoading(false);
    }
  };

  const handleCevapGonder = async () => {
    if (!izlemeId || Object.keys(cevaplar).length < sorular.length) return;
    setIslemLoading(true);
    const cevapListesi = sorular.map(s => ({ soru_index: s.soru_index, verilen_cevap: cevaplar[s.soru_index] }));
    const res = await fetch("/izle/api/cevap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ izleme_id: izlemeId, cevaplar: cevapListesi }) });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Cevaplar gönderilemedi.", d.adim, d.detay); setIslemLoading(false); return; }
    setCevapSonuclari(d.sonuclar); setKazanilanPuan(d.kazanilan_puan);
    // Birleşik toast: izleme (bitir'de saklanan) + doğru cevaplama tek mesajda.
    // Cevap 0 ise cevap kalemi düşer (puanMesaji 0'ı gizler) → yalnız izleme kalır.
    const kalemler: PuanKalemi[] = [
      ...izlemeKalemleriRef.current,
      { tur: "cevap", puan: d.kazanilan_puan ?? 0 },
    ];
    const mesaj = puanMesaji(kalemler);
    if (mesaj) basari(mesaj);
    izlemeKalemleriRef.current = [];
    if (d.puan_uyarisi) uyari(d.puan_uyarisi); // B-08: puan yazım hatası kullanıcıya görünür
    setIslemLoading(false); await onVeriYenile();
  };

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onKapat}
        className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-gray-500 text-sm p-0 w-fit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M15 19l-7-7 7-7" /></svg>
        Öğrenme İçerikleri
      </button>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Başlık */}
        <div className="px-4 md:px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-gray-900">{video.urun_adi}</div>
            <div className="text-xs text-gray-500 mt-1">{video.teknik_adi}</div>
          </div>
        </div>

        {/* Video */}
        {video.arac_turu === "podcast" && video.arac_id && (
          <div className="border-b border-gray-100 p-4"><PodcastOynatici aracId={video.arac_id} yayinId={video.yayin_id} bagId={oneri_id} ileriSarmaAcik={video.ileri_sarma_acik} hata={hata} baslat={async () => { const r = await fetch("/izle/api/baslat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ yayin_id: video.yayin_id, oneri_id: oneri_id ?? null, baslat_olay_id: crypto.randomUUID() }) }); const d = await r.json(); if (!r.ok || !d.izleme?.izleme_id) throw new Error(d.hata ?? "Podcast dinlemesi başlatılamadı."); setIzlemeId(d.izleme.izleme_id); izlemeIdRef.current = d.izleme.izleme_id; return { izlemeId: d.izleme.izleme_id, ilerleme: d.izleme.ilerleme_durumu }; }} bitir={async (id) => { izlemeIdRef.current = id; await handleIzlemeBitir(); }} onTamamlandi={onVeriYenile} /></div>
        )}
        {video.arac_turu === "gorsel" && video.arac_id && <div className="border-b border-gray-100 p-4"><GorselOynatici aracId={video.arac_id} yayinId={video.yayin_id} bagId={oneri_id} hata={hata} baslat={async () => { const r = await fetch("/izle/api/baslat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ yayin_id: video.yayin_id, oneri_id: oneri_id ?? null, baslat_olay_id: crypto.randomUUID() }) }); const d = await r.json(); if (!r.ok || !d.izleme?.izleme_id) throw new Error(d.hata ?? "Görsel incelemesi başlatılamadı."); setIzlemeId(d.izleme.izleme_id); izlemeIdRef.current = d.izleme.izleme_id; return { izlemeId: d.izleme.izleme_id }; }} bitir={async (id) => { izlemeIdRef.current = id; await handleIzlemeBitir(); }} onTamamlandi={onVeriYenile} /></div>}
        {video.arac_turu === "flip_pdf" && video.arac_id && <div className="border-b border-gray-100 p-4"><FlipPdfOynatici aracId={video.arac_id} yayinId={video.yayin_id} bagId={oneri_id} hata={hata} baslat={async () => { const r = await fetch("/izle/api/baslat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ yayin_id: video.yayin_id, oneri_id: oneri_id ?? null, baslat_olay_id: crypto.randomUUID() }) }); const d = await r.json(); if (!r.ok || !d.izleme?.izleme_id) throw new Error(d.hata ?? "Flip PDF okuması başlatılamadı."); setIzlemeId(d.izleme.izleme_id); izlemeIdRef.current = d.izleme.izleme_id; return { izlemeId: d.izleme.izleme_id, ilerleme: d.izleme.ilerleme_durumu }; }} bitir={async (id) => { izlemeIdRef.current = id; await handleIzlemeBitir(); }} onTamamlandi={onVeriYenile} /></div>}
        {!(["podcast", "gorsel", "flip_pdf"].includes(video.arac_turu ?? "video")) && video.video_url && (
          <div className="border-b border-gray-100">
            {/* Kutu artık videonun oranına göre çizilir (26.07 — VideoCercevesi).
                iframe burada kalır: ref playerjs'e bağlı, sarmalayıcı yalnız kutuyu kurar.
                width/height nitelikleri kalktı — ölçüyü CSS veriyor. */}
            <VideoCercevesi
              videoUrl={video.video_url}
              etkilesimKatmani={
                onizlemeEtkilesimi.katmanAcik
                  ? { ariaLabel: `${video.urun_adi} videosunu oynat`, onClick: onizlemeEtkilesimi.oynat }
                  : tuketici && !ilkOynatmaIstendi
                    ? { ariaLabel: `${video.urun_adi} videosunu oynat`, onClick: handleIlkOynatma }
                    : null
              }
            >
              <iframe key={video.yayin_id} ref={iframeRef} src={video.video_url}
                frameBorder="0" allowFullScreen
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" />
            </VideoCercevesi>
          </div>
        )}

        {/* Aksiyon alanı — yalnızca tüketici (utt/kd_utt) */}
        {tuketici && (
          <div className="px-4 md:px-5 py-4">

            {/* Sorular */}
            {izlemeTamamlandi && soruGosterilecek && sorular.length > 0 && cevapSonuclari.length === 0 && (
              <div className="flex flex-col gap-4">
                <div className="text-sm font-semibold text-gray-900">Soruları Cevapla</div>
                {sorular.map((soru, i) => (
                  <div key={soru.soru_index} className="px-3 py-3.5 bg-gray-50 rounded-xl border border-gray-200">
                    <p className="text-sm text-gray-700 font-semibold mb-3">{i + 1}. {soru.soru_metni}</p>
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
                {/* Akışın sonu — dönüş yolu sonuçların altında, gözün olduğu yerde.
                    Üstteki "← Videolar" bağlantısı bağ sanılıp kaçırılabiliyordu. */}
                <div className="flex justify-end">
                  <button onClick={onKapat}
                    className="text-white border-none rounded-lg px-6 py-2.5 text-xs font-semibold cursor-pointer"
                    style={{ background: "#56aeff", fontFamily: "'Nunito', sans-serif" }}>
                    Videolara dön
                  </button>
                </div>
              </div>
            )}

            {/* Soru yok ama puan var */}
            {izlemeTamamlandi && !soruGosterilecek && kazanilanPuan !== null && kazanilanPuan > 0 && cevapSonuclari.length === 0 && (
              <div className="px-4 py-3.5 bg-blue-50 rounded-xl border border-blue-200 text-center">
                <span className="text-sm font-bold text-blue-700">+{kazanilanPuan} puan kazandınız!</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* İleri sarma uyarı modal — yalnızca tüketici */}
      {tuketici && ileriSarmaModal && (
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

      <AlertDialog open={mesaiDisiModal} onOpenChange={setMesaiDisiModal}>
        <AlertDialogContent className="max-w-sm border-[#dbe5ef] bg-white text-center">
          <AlertDialogHeader className="items-center text-center sm:text-center">
            <AlertDialogTitle className="text-[#203653]">Bilgilendirme</AlertDialogTitle>
            <AlertDialogDescription className="mx-auto max-w-[280px] text-center leading-6 text-[#687b90]">
              Mesai saatleri dışında izleme puanı verilmez ve sorular gösterilmez.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={handleMesaiDisiOnayla} className="bg-[#237ac8] hover:bg-[#1d69ad]">
              Onayla
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
