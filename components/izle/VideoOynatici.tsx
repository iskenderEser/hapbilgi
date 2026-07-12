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

interface OynaticiVideo {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  video_puani: number | null;
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
  dogru_mu: boolean;
  dogru_cevap: string;
}

interface Props {
  video: OynaticiVideo;
  tuketici: boolean;                 // sadece utt/kd_utt: izleme akışı + puan/soru. false → yalnızca oynatma.
  oneri_id?: string | null;          // öneri akışından geliyorsa öneri kimliği; yoksa null/undefined
  onKapat: () => void;
  onVeriYenile: () => void | Promise<void>;
  hata: (mesaj: string, adim?: string, detay?: any) => void;
  basari: (mesaj: string) => void;
  uyari: (mesaj: string) => void;
}

export default function VideoOynatici({ video, tuketici, oneri_id, onKapat, onVeriYenile, hata, basari, uyari }: Props) {
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
  const izlemeIdRef = useRef<string | null>(null);
  const izlemeBitirildiRef = useRef<boolean>(false);
  const baslatTetiklendiRef = useRef<string | null>(null);
  const videoSuresiRef = useRef<number>(0);
  const playerRef = useRef<VideoPlayer | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Video değiştiğinde: TÜM state sıfırlanır ve yeni baslat tetiklenir.
  // Aynı VideoOynatici örneği farklı videoyu oynattığında temiz başlangıç sağlar.
  useEffect(() => {
    if (!tuketici) return;
    if (!video.yayin_id) return;
    if (baslatTetiklendiRef.current === video.yayin_id) return;

    setIzlemeId(null);
    setIzlemeBasladi(false);
    setIzlemeTamamlandi(false);
    setSorular([]);
    setSoruGosterilecek(false);
    setCevaplar({});
    setCevapSonuclari([]);
    setKazanilanPuan(null);
    setIleriSarmaModal(false);
    setBekleyenSeekBitis(null);

    izlemeIdRef.current = null;
    izlemeBitirildiRef.current = false;
    maxIzlenenRef.current = 0;
    ileriSarilanToplamRef.current = 0;
    videoSuresiRef.current = 0;

    // Önceki player'ı temizle (varsa)
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    baslatTetiklendiRef.current = video.yayin_id;

    handleIzlemeBaslat();
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
    if (!tuketici || !izlemeBasladi || !iframeRef.current || !video.video_url) return;

    let player: VideoPlayer;
    try {
      player = createVideoPlayer(iframeRef.current, video.video_url);
    } catch (err: any) {
      hata(err?.message ?? "Video oynatıcı kurulamadı.", "createVideoPlayer", err);
      return;
    }
    playerRef.current = player;

    maxIzlenenRef.current = 0;
    ileriSarilanToplamRef.current = 0;

    player.onReady(() => {
      // Video süresini al — manuel bitiş kontrolü için
      player.getDuration((sure: number) => {
        if (sure && sure > 0) videoSuresiRef.current = sure;
      });

      // timeupdate — hem ileri sarma takibi hem manuel bitiş tespiti
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

      // İleri sarma — yalnız ileri_sarma_acik=true ise
      if (video.ileri_sarma_acik) {
        player.onSeeked(() => {
          player.getCurrentTime((current: number) => {
            if (current > maxIzlenenRef.current + 1) {
              setBekleyenSeekBitis(current);
              setIleriSarmaModal(true);
              player.setCurrentTime(maxIzlenenRef.current);
            }
          });
        });
      }

      // ended — yedek tetikleyici. Provider çalıştırırsa daha erken yakalar.
      player.onEnded(() => {
        if (izlemeBitirildiRef.current) return;
        izlemeBitirildiRef.current = true;
        handleIzlemeBitir();
      });
    });

    return () => {
      // Bileşen unmount veya dependency değişimi: player'ı temizle
      player.destroy();
      if (playerRef.current === player) playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [izlemeBasladi, video.yayin_id, tuketici, video.ileri_sarma_acik]);

  const handleIleriSarmaOnayla = async () => {
    if (!izlemeId || bekleyenSeekBitis === null) return;
    setIleriSarmaModal(false);
    const atlanan = bekleyenSeekBitis - maxIzlenenRef.current;
    const sure = videoSuresiRef.current;
    const saniyeBasiPuan = (video.video_puani ?? 0) > 0 && sure > 0 ? (video.video_puani! / sure) : 0;
    const kaybedilenPuan = Math.round(saniyeBasiPuan * atlanan);
    ileriSarilanToplamRef.current += atlanan;
    await fetch("/izle/api/ileri-sarma", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yayin_id: video.yayin_id, izleme_id: izlemeId, atlama_baslangic: Math.round(maxIzlenenRef.current), atlama_bitis: Math.round(bekleyenSeekBitis), atlanan_sure: Math.round(atlanan), kaybedilen_puan: kaybedilenPuan }),
    });
    if (playerRef.current) { playerRef.current.setCurrentTime(bekleyenSeekBitis); maxIzlenenRef.current = bekleyenSeekBitis; }
    setBekleyenSeekBitis(null);
  };

  const handleIleriSarmaReddet = () => { setIleriSarmaModal(false); setBekleyenSeekBitis(null); };

  const handleIzlemeBaslat = async () => {
    setIslemLoading(true);
    const body = oneri_id
      ? { yayin_id: video.yayin_id, izleme_turu: "oneri", oneri_id }
      : { yayin_id: video.yayin_id, izleme_turu: "kendi_kendine" };
    const res = await fetch("/izle/api/baslat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "İzleme başlatılamadı.", d.adim, d.detay); setIslemLoading(false); return; }
    setIzlemeId(d.izleme.izleme_id);
    izlemeIdRef.current = d.izleme.izleme_id;
    setIzlemeBasladi(true);
    setIslemLoading(false);
  };

  const handleIzlemeBitir = async () => {
    const id = izlemeIdRef.current ?? izlemeId;
    if (!id) return;
    setIslemLoading(true);
    const res = await fetch("/izle/api/bitir", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ izleme_id: id, ileri_sarilan_sure: ileriSarilanToplamRef.current }) });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "İzleme tamamlanamadı.", d.adim, d.detay); setIslemLoading(false); return; }
    setIzlemeTamamlandi(true); setSoruGosterilecek(d.soru_gosterilecek);
    if (!d.puan_kazanildi && !d.soru_gosterilecek) uyari(d.mesaj ?? "Puan kazanma saatleri dışında izlendi.");
    if (d.puan_uyarisi) uyari(d.puan_uyarisi); // B-08: puan yazım hatası kullanıcıya görünür
    if (d.ileri_sarildi) uyari("Video ileri sarıldığı için sorular gösterilmeyecek.");
    if (d.soru_gosterilecek) {
      const sRes = await fetch(`/izle/api/sorular?izleme_id=${id}`);
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
    if (d.puan_uyarisi) uyari(d.puan_uyarisi); // B-08: puan yazım hatası kullanıcıya görünür
    setIslemLoading(false); await onVeriYenile();
  };

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onKapat}
        className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-gray-500 text-sm p-0 w-fit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M15 19l-7-7 7-7" /></svg>
        Videolar
      </button>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Başlık */}
        <div className="px-4 md:px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-gray-900">{video.urun_adi}</div>
            <div className="text-xs text-gray-500 mt-1">{video.teknik_adi}</div>
          </div>
          {tuketici && video.ileri_sarma_acik && (
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
        {video.video_url && (
          <div className="border-b border-gray-100">
            <iframe key={video.yayin_id} ref={iframeRef} src={video.video_url} width="100%" height="400"
              frameBorder="0" allowFullScreen
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" />
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
    </div>
  );
}