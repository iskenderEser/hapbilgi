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
import VideoCercevesi from "@/components/video/VideoCercevesi";

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
  // Sorulu akışta bitir'in döndürdüğü izleme/öneri puan kalemleri — cevap sonrası
  // birleşik toast'ta izleme + doğru cevaplama tek mesajda gösterilsin diye saklanır.
  const izlemeKalemleriRef = useRef<PuanKalemi[]>([]);

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
    izlemeKalemleriRef.current = [];
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
      // İzleme ilerleyişi, ileri sarma denetimi ve bitiş tespiti tek timeupdate
      // akışından yürür. Süre canlı payload'dan okunur (getDuration'a gerek yok);
      // video geç yüklense de kendini onarır ve ileri sarma puan kaybı bu süreye
      // bağlı olduğundan doğru beslenir.
      player.onTimeUpdate((data: { seconds: number; duration?: number }) => {
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
          if (current > maxIzlenenRef.current + 1) {
            setBekleyenSeekBitis(current);
            setIleriSarmaModal(true);
            player.setCurrentTime(maxIzlenenRef.current);
          }
        });
      });

      // ended — yedek bitiş tetikleyicisi (provider gönderirse daha erken yakalar).
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
  }, [izlemeBasladi, video.yayin_id, tuketici]);

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
    const bitirKalemleri: PuanKalemi[] = d.kazanilan_puanlar ?? [];
    if (d.soru_gosterilecek) {
      // İzleme/öneri kalemlerini sakla — toast cevap sonrası birleşik atılacak.
      izlemeKalemleriRef.current = bitirKalemleri;
      const sRes = await fetch(`/izle/api/sorular?izleme_id=${id}`);
      const sData = await sRes.json();
      if (!sRes.ok) { hata(sData.hata ?? "Sorular yüklenemedi.", sData.adim, sData.detay); }
      else { setSorular(sData.sorular ?? []); }
    } else {
      // Sorusuz akış — kazanç burada kesinleşir, birleşik mesaj hemen atılır.
      const toplam = bitirKalemleri.reduce((t, k) => t + k.puan, 0);
      setKazanilanPuan(toplam);
      const mesaj = puanMesaji(bitirKalemleri);
      if (mesaj) basari(mesaj);
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
        Videolar
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
        {video.video_url && (
          <div className="border-b border-gray-100">
            {/* Kutu artık videonun oranına göre çizilir (26.07 — VideoCercevesi).
                iframe burada kalır: ref playerjs'e bağlı, sarmalayıcı yalnız kutuyu kurar.
                width/height nitelikleri kalktı — ölçüyü CSS veriyor. */}
            <VideoCercevesi videoUrl={video.video_url}>
              <iframe key={video.yayin_id} ref={iframeRef} src={video.video_url}
                frameBorder="0" allowFullScreen
                allow="accelerometer; gyroscope; encrypted-media; picture-in-picture;" />
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
    </div>
  );
}
