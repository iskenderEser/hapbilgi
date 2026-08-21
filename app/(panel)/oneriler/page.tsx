// app/oneriler/page.tsx
"use client";

import { TUKETICI_ROLLER } from "@/lib/utils/roller";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { thumbnailUrlUret } from "@/lib/video/thumbnail";
import { useAuth } from "@/app/providers/AuthProvider";
import BmOneriTakibi, { type OneriKaydi } from "./_components/BmOneriTakibi";
import TmOneriTakibi, { type TmBmKaydi, type TmOneriKaydi } from "./_components/TmOneriTakibi";
import type { Periyot } from "@/lib/utils/raporUtils";
import { YenileButonu } from "@/components/ui/yenile-butonu";

export default function OnerilerPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const [oneriler, setOneriler] = useState<OneriKaydi[]>([]);
  const [tmOneriler, setTmOneriler] = useState<TmOneriKaydi[]>([]);
  const [tmBmler, setTmBmler] = useState<TmBmKaydi[]>([]);
  const [loading, setLoading] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [yenileTetik, setYenileTetik] = useState(0);
  const [periyot, setPeriyot] = useState<Periyot>("bu_ay");
  const { mesajlar, hata } = useHataMesaji();
  const hataRef = useRef(hata);
  const rolKucu = (kullanici?.rol ?? "").toLowerCase();
  const isBM = rolKucu === "bm";
  const isTM = rolKucu === "tm";
  const isUTT = TUKETICI_ROLLER.includes(rolKucu);

  useEffect(() => { hataRef.current = hata; }, [hata]);

  const handleBegeni = async (e: React.MouseEvent, yayin_id: string) => {
    e.stopPropagation();
    const res = await fetch("/izle/api/begeni", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ yayin_id }) });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Beğeni işlemi başarısız.", d.adim, d.detay); return; }
    setOneriler(prev => prev.map(o => o.yayin_id === yayin_id ? { ...o, begeni_mi: d.begeni_mi, begeni_sayisi: d.begeni_mi ? o.begeni_sayisi + 1 : o.begeni_sayisi - 1 } : o));
  };

  const handleFavori = async (e: React.MouseEvent, yayin_id: string) => {
    e.stopPropagation();
    const res = await fetch("/izle/api/favori", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ yayin_id }) });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Favori işlemi başarısız.", d.adim, d.detay); return; }
    setOneriler(prev => prev.map(o => o.yayin_id === yayin_id ? { ...o, favori_mi: d.favori_mi, favori_sayisi: d.favori_mi ? o.favori_sayisi + 1 : o.favori_sayisi - 1 } : o));
  };

  useEffect(() => {
    if (!kullanici?.id) return;
    let aktif = true;
    const veriCek = async () => {
      const url = isBM || isTM ? `/oneriler/api?periyot=${periyot}` : "/oneriler/api";
      const res = await fetch(url);
      const data = await res.json();
      if (!aktif) return;
      if (!res.ok) hataRef.current(data.hata ?? "Öneriler yüklenemedi.", data.adim, data.detay);
      else if (isTM) {
        setTmOneriler(data.oneriler ?? []);
        setTmBmler(data.bm_listesi ?? []);
      } else {
        setOneriler(data.oneriler ?? []);
      }
      setLoading(false);
      setYenileniyor(false);
    };
    void veriCek();
    return () => { aktif = false; };
  }, [isBM, isTM, kullanici?.id, periyot, yenileTetik]);

  const handlePeriyotDegistir = (yeniPeriyot: Periyot) => {
    if (yeniPeriyot === periyot) return;
    setLoading(true);
    setPeriyot(yeniPeriyot);
  };

  const formatTarihKisa = (tarih: string) => {
    const date = new Date(tarih);
    if (isNaN(date.getTime())) return "Geçersiz tarih";
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
  };

  const sureciGectiMi = (bitis: string) => new Date(bitis) < new Date();
  const henuzBaslamadiMi = (baslangic: string) => new Date(baslangic) > new Date();

  const kartDurumu = (o: OneriKaydi): { renk: string; etiket: string; soluk: boolean } => {
    if (o.izlendi_mi) return { renk: "#56aeff", etiket: "İzlendi", soluk: false };
    if (sureciGectiMi(o.oneri_bitis)) return { renk: "#bc2d0d", etiket: "Süresi Geçti", soluk: true };
    if (henuzBaslamadiMi(o.oneri_baslangic)) return { renk: "#f59e0b", etiket: `${formatTarihKisa(o.oneri_baslangic)}'da izleyebilirsiniz`, soluk: true };
    return { renk: "#737373", etiket: "İzlenecek", soluk: false };
  };

  if (authYukleniyor || !kullanici || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!isBM && !isTM && !isUTT) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 text-sm text-gray-600">
          Bu sayfaya yalnız TM, BM, UTT ve KD_UTT rolleri erişebilir.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0" style={{ fontFamily: "'Nunito', sans-serif" }}>

      <div className={isBM || isTM ? "" : "max-w-5xl mx-auto px-3 py-4 md:px-6 md:py-6 flex flex-col gap-5"}>

        <div className={isBM || isTM ? "mx-auto flex max-w-[1480px] justify-end px-3 pt-4 md:px-6 lg:px-8" : "flex justify-end"}>
          <YenileButonu yenileniyor={yenileniyor} onYenile={() => { setYenileniyor(true); setYenileTetik((deger) => deger + 1); }} />
        </div>

        {isBM && (
          <BmOneriTakibi
            oneriler={oneriler}
            periyot={periyot}
            onPeriyotDegistir={handlePeriyotDegistir}
          />
        )}

        {isTM && (
          <TmOneriTakibi
            oneriler={tmOneriler}
            bmler={tmBmler}
            periyot={periyot}
            onPeriyotDegistir={handlePeriyotDegistir}
          />
        )}

        {/* UTT — Kart Görünümü */}
        {isUTT && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">Gelen Öneriler</span>
              <span className="text-xs text-gray-500">{oneriler.length} öneri</span>
            </div>

            {oneriler.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">
                Henüz öneri gelmedi.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {oneriler.map((o) => {
                  const { renk, etiket, soluk } = kartDurumu(o);
                  const thumb = o.thumbnail_url ?? thumbnailUrlUret(o.video_url);
                  return (
                    <div key={o.oneri_id}
                      className="bg-white rounded-xl overflow-hidden transition-shadow duration-150"
                      style={{ border: `1.5px solid ${renk}`, opacity: soluk ? 0.6 : 1, cursor: soluk ? "default" : "pointer" }}
                      onClick={() => { if (!soluk) router.push(`/ana-sayfa?yayin_id=${o.yayin_id}&oneri_id=${o.oneri_id}`); }}
                      onMouseEnter={e => { if (!soluk) (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"; }}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "none"}>

                      {/* Thumbnail */}
                      <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16/9", background: "#b5d4f4" }}>
                        {thumb
                          ? <>
                              <img src={thumb} alt="thumbnail" className="w-full h-full object-cover" onError={(e) => {
                                const img = e.currentTarget as HTMLImageElement;
                                img.style.display = 'none';
                                const fallback = img.parentElement?.querySelector('.thumbnail-fallback') as HTMLElement | null;
                                if (fallback) fallback.style.display = 'block';
                              }} />
                              <div className="thumbnail-fallback w-full h-full absolute inset-0" style={{ display: 'none', background: "linear-gradient(135deg, #b5d4f4, #56aeff)" }} />
                            </>
                          : <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #b5d4f4, #56aeff)" }} />
                        }
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
                            <svg width="10" height="12" viewBox="0 0 10 12" fill="white"><path d="M0 0l10 6-10 6z" /></svg>
                          </div>
                        </div>
                        <div className="absolute top-2 left-2">
                          <span className="text-white rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: renk, fontSize: 10 }}>{etiket}</span>
                        </div>
                      </div>

                      {/* Bilgi */}
                      <div className="px-3 py-2.5 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-semibold text-gray-900 truncate">{o.urun_adi}</div>
                          <div className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">{o.teknik_adi}</div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs text-gray-500 truncate">
                            <span className="text-gray-400">Öneren:</span> {o.kullanici_adi}
                          </div>
                          <div className="text-xs flex-shrink-0" style={{ color: "#bc2d0d" }}>{formatTarihKisa(o.oneri_bitis)} tarihine kadar</div>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          {o.video_puani != null ? (
                            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5 text-xs text-gray-500">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#56aeff" strokeWidth="2">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </svg>
                              Video <span className="font-semibold text-gray-900 ml-0.5">{o.video_puani}</span>
                            </div>
                          ) : <div />}
                          <div className="flex items-center gap-2.5">
                            <div className="flex items-center gap-1 cursor-pointer" onClick={(e) => handleBegeni(e, o.yayin_id)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill={o.begeni_mi ? "#bc2d0d" : "none"} stroke="#bc2d0d" strokeWidth="2">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                              </svg>
                              <span className="text-xs" style={{ color: o.begeni_mi ? "#bc2d0d" : "#737373", fontWeight: o.begeni_mi ? 600 : 400 }}>{o.begeni_sayisi}</span>
                            </div>
                            <div className="flex items-center gap-1 cursor-pointer" onClick={(e) => handleFavori(e, o.yayin_id)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill={o.favori_mi ? "#56aeff" : "none"} stroke={o.favori_mi ? "#56aeff" : "#737373"} strokeWidth="2">
                                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                                <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                              </svg>
                              <span className="text-xs" style={{ color: o.favori_mi ? "#56aeff" : "#737373", fontWeight: o.favori_mi ? 600 : 400 }}>{o.favori_sayisi}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}
