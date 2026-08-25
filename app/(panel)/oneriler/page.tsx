// app/oneriler/page.tsx
"use client";

import { TUKETICI_ROLLER } from "@/lib/utils/roller";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  Clock,
  Film,
  Heart,
  Inbox,
  Play,
  Sparkles,
} from "lucide-react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { thumbnailUrlUret } from "@/lib/video/thumbnail";
import { useAuth } from "@/app/providers/AuthProvider";
import BmOneriTakibi, { type OneriKaydi } from "./_components/BmOneriTakibi";
import TmOneriTakibi, { type TmBmKaydi, type TmOneriKaydi } from "./_components/TmOneriTakibi";
import type { Periyot } from "@/lib/utils/raporUtils";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import SayfaRehberi from "@/components/rehber/SayfaRehberi";

type UttOneriFiltresi = "tumu" | "izlenecek" | "tamamlanan" | "suresi_dolan";

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
  const [aktifFiltre, setAktifFiltre] = useState<UttOneriFiltresi>("tumu");

  const { mesajlar, hata } = useHataMesaji();
  const hataRef = useRef(hata);
  const rolKucu = (kullanici?.rol ?? "").toLowerCase();
  const isBM = rolKucu === "bm";
  const isTM = rolKucu === "tm";
  const isUTT = TUKETICI_ROLLER.includes(rolKucu);

  useEffect(() => {
    hataRef.current = hata;
  }, [hata]);

  const handleBegeni = async (e: React.MouseEvent, yayin_id: string) => {
    e.stopPropagation();
    const res = await fetch("/izle/api/begeni", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yayin_id }),
    });
    const d = await res.json();
    if (!res.ok) {
      hata(d.hata ?? "Beğeni işlemi başarısız.", d.adim, d.detay);
      return;
    }
    setOneriler((prev) =>
      prev.map((o) =>
        o.yayin_id === yayin_id
          ? {
              ...o,
              begeni_mi: d.begeni_mi,
              begeni_sayisi: d.begeni_mi ? o.begeni_sayisi + 1 : o.begeni_sayisi - 1,
            }
          : o
      )
    );
  };

  const handleFavori = async (e: React.MouseEvent, yayin_id: string) => {
    e.stopPropagation();
    const res = await fetch("/izle/api/favori", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yayin_id }),
    });
    const d = await res.json();
    if (!res.ok) {
      hata(d.hata ?? "Favori işlemi başarısız.", d.adim, d.detay);
      return;
    }
    setOneriler((prev) =>
      prev.map((o) =>
        o.yayin_id === yayin_id
          ? {
              ...o,
              favori_mi: d.favori_mi,
              favori_sayisi: d.favori_mi ? o.favori_sayisi + 1 : o.favori_sayisi - 1,
            }
          : o
      )
    );
  };

  useEffect(() => {
    if (!kullanici?.id) return;
    let aktif = true;
    const veriCek = async () => {
      const url = isBM || isTM ? `/oneriler/api?periyot=${periyot}` : "/oneriler/api";
      const res = await fetch(url);
      const data = await res.json();
      if (!aktif) return;
      if (!res.ok) {
        hataRef.current(data.hata ?? "Öneri takip listesi yüklenemedi.", data.adim, data.detay);
      } else if (isTM) {
        setTmOneriler(data.oneriler ?? []);
        setTmBmler(data.bm_listesi ?? []);
      } else {
        setOneriler(data.oneriler ?? []);
      }
      setLoading(false);
      setYenileniyor(false);
    };
    void veriCek();
    return () => {
      aktif = false;
    };
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

  const isTamamlandi = (o: OneriKaydi) => o.izlendi_mi;
  const isSuresiGecti = (o: OneriKaydi) => !o.izlendi_mi && new Date(o.oneri_bitis).getTime() < Date.now();
  const isHenuzBaslamadi = (o: OneriKaydi) => !o.izlendi_mi && new Date(o.oneri_baslangic).getTime() > Date.now();
  const isIzlenecek = (o: OneriKaydi) => !o.izlendi_mi && !isSuresiGecti(o) && !isHenuzBaslamadi(o);

  const izlenecekSayisi = useMemo(() => oneriler.filter(isIzlenecek).length, [oneriler]);
  const tamamlananSayisi = useMemo(() => oneriler.filter(isTamamlandi).length, [oneriler]);
  const suresiDolanSayisi = useMemo(() => oneriler.filter(isSuresiGecti).length, [oneriler]);
  const toplamSayisi = oneriler.length;

  const filtrelenmisOneriler = useMemo(() => {
    if (aktifFiltre === "izlenecek") return oneriler.filter(isIzlenecek);
    if (aktifFiltre === "tamamlanan") return oneriler.filter(isTamamlandi);
    if (aktifFiltre === "suresi_dolan") return oneriler.filter(isSuresiGecti);
    return oneriler;
  }, [aktifFiltre, oneriler]);

  const kartDurumu = (o: OneriKaydi): {
    metinRenk: string;
    zeminRenk: string;
    etiket: string;
    soluk: boolean;
  } => {
    if (o.izlendi_mi) {
      return { metinRenk: "#166534", zeminRenk: "#dcfce7", etiket: "İzlendi ✓", soluk: false };
    }
    if (isSuresiGecti(o)) {
      return { metinRenk: "#991b1b", zeminRenk: "#fee2e2", etiket: "Süresi Geçti", soluk: true };
    }
    if (isHenuzBaslamadi(o)) {
      return {
        metinRenk: "#854d0e",
        zeminRenk: "#fef9c3",
        etiket: `${formatTarihKisa(o.oneri_baslangic)}'da Açılacak`,
        soluk: true,
      };
    }
    return { metinRenk: "#1e40af", zeminRenk: "#dbeafe", etiket: "İzlenecek", soluk: false };
  };

  if (authYukleniyor || !kullanici || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <svg className="h-6 w-6 animate-spin text-gray-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!isBM && !isTM && !isUTT) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-sm text-gray-600">
          Bu sayfaya yalnız TM, BM, UTT ve KD_UTT rolleri erişebilir.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0" style={{ fontFamily: "'Nunito', sans-serif" }}>
      {/* BM Görünümü */}
      {isBM && (
        <BmOneriTakibi
          oneriler={oneriler}
          periyot={periyot}
          onPeriyotDegistir={handlePeriyotDegistir}
          yenileniyor={yenileniyor}
          onYenile={() => {
            setYenileniyor(true);
            setYenileTetik((deger) => deger + 1);
          }}
        />
      )}

      {/* TM Görünümü */}
      {isTM && (
        <TmOneriTakibi
          oneriler={tmOneriler}
          bmler={tmBmler}
          periyot={periyot}
          onPeriyotDegistir={handlePeriyotDegistir}
          yenileniyor={yenileniyor}
          onYenile={() => {
            setYenileniyor(true);
            setYenileTetik((deger) => deger + 1);
          }}
        />
      )}

      {/* UTT — Modern Dashboard Görünümü */}
      {isUTT && (
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
          {/* Header */}
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#3589d8]">
                <Sparkles className="h-3.5 w-3.5" /> T-Club Gelişim & Öneri Takibi
              </div>
              <div className="inline-flex items-center">
                <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">
                  Öneri Takibi
                </h1>
                <SayfaRehberi anahtar="oneriler" className="ml-1.5 -translate-y-1.5" />
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-5 text-[#6b7f9b]">
                Bölge Müdürünüz tarafından gelişiminize yönelik önerilen videoları süresi dolmadan tamamlayın ve öneri puanı kazanın.
              </p>
            </div>
            <YenileButonu
              yenileniyor={yenileniyor}
              onYenile={() => {
                setYenileniyor(true);
                setYenileTetik((deger) => deger + 1);
              }}
            />
          </header>

          {/* Stat / Filtre Kartları */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:gap-3">
            {[
              {
                id: "izlenecek" as const,
                label: "İzleme Bekleyen",
                deger: izlenecekSayisi,
                sub: "Süresi aktif öneriler",
                renk: "#c2410c",
                zemin: "#fff7ed",
              },
              {
                id: "tamamlanan" as const,
                label: "Tamamlananlar",
                deger: tamamlananSayisi,
                sub: "Öneri puanı kazanıldı",
                renk: "#16a34a",
                zemin: "#f0fdf4",
              },
              {
                id: "suresi_dolan" as const,
                label: "Süresi Dolanlar",
                deger: suresiDolanSayisi,
                sub: "Tamamlanmayanlar",
                renk: "#a33f32",
                zemin: "#fff1f0",
              },
              {
                id: "tumu" as const,
                label: "Toplam Öneri",
                deger: toplamSayisi,
                sub: "Tüm önerilen videolar",
                renk: "#237ac8",
                zemin: "#edf6fd",
              },
            ].map((kart) => {
              const secili = aktifFiltre === kart.id;
              return (
                <button
                  type="button"
                  key={kart.id}
                  onClick={() => setAktifFiltre(secili && kart.id !== "tumu" ? "tumu" : kart.id)}
                  className="group relative cursor-pointer rounded-2xl border border-[#dfe7f1] bg-white p-3 text-left shadow-[0_4px_14px_rgba(31,55,90,0.035)] transition-all hover:-translate-y-0.5 hover:shadow-md md:p-4"
                  style={
                    {
                      borderLeftWidth: "4px",
                      borderLeftColor: kart.renk,
                      boxShadow: secili ? `0 0 0 2px ${kart.renk}33, 0 8px 20px rgba(0,0,0,0.06)` : undefined,
                    } as CSSProperties
                  }
                >
                  <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    {kart.label}
                  </div>
                  <div className="mt-1 text-2xl font-extrabold text-gray-900 md:text-3xl">
                    {kart.deger}
                  </div>
                  <div className="mt-1 text-[11px] font-medium text-gray-500">{kart.sub}</div>
                </button>
              );
            })}
          </div>

          {/* Liste Başlığı & Filtre Bilgisi */}
          <div className="mt-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-[#172b4d]">
                {aktifFiltre === "izlenecek" && "İzleme Bekleyen Öneriler"}
                {aktifFiltre === "tamamlanan" && "Tamamlanan Öneriler"}
                {aktifFiltre === "suresi_dolan" && "Süresi Dolan Öneriler"}
                {aktifFiltre === "tumu" && "Tüm Gelen Öneriler"}
              </span>
              <span className="rounded-full bg-[#f0f4f9] px-2.5 py-0.5 text-xs font-bold text-[#566b87]">
                {filtrelenmisOneriler.length} video
              </span>
            </div>

            {aktifFiltre !== "tumu" && (
              <button
                type="button"
                onClick={() => setAktifFiltre("tumu")}
                className="cursor-pointer text-xs font-bold text-[#237ac8] hover:underline"
              >
                Tümünü Göster
              </button>
            )}
          </div>

          {/* Video Grid */}
          {filtrelenmisOneriler.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
              <Inbox className="mb-2 h-10 w-10 text-gray-300" />
              <p className="text-sm font-bold text-gray-600">Bu filtrede gösterilecek öneri bulunamadı.</p>
              <p className="mt-1 text-xs text-gray-400">
                {aktifFiltre !== "tumu"
                  ? "Filtreyi temizleyerek tüm önerileri görebilirsiniz."
                  : "Bölge Müdürünüz yeni bir video önerdiğinde burada listelenecektir."}
              </p>
              {aktifFiltre !== "tumu" && (
                <button
                  type="button"
                  onClick={() => setAktifFiltre("tumu")}
                  className="mt-3 text-xs font-bold text-[#237ac8] hover:underline"
                >
                  Tüm önerileri göster
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtrelenmisOneriler.map((o) => {
                const durumStil = kartDurumu(o);
                const thumb = o.thumbnail_url ?? thumbnailUrlUret(o.video_url);

                return (
                  <div
                    key={o.oneri_id}
                    className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white shadow-[0_4px_16px_rgba(31,55,90,0.04)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(31,55,90,0.09)]"
                    style={{
                      opacity: durumStil.soluk ? 0.75 : 1,
                      cursor: durumStil.soluk ? "default" : "pointer",
                    }}
                    onClick={() => {
                      if (!durumStil.soluk) {
                        router.push(`/ana-sayfa?yayin_id=${o.yayin_id}&oneri_id=${o.oneri_id}`);
                      }
                    }}
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-video w-full overflow-hidden bg-[#e8f1fa]">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={o.urun_adi}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            const img = e.currentTarget as HTMLImageElement;
                            img.style.display = "none";
                            const fallback = img.parentElement?.querySelector(
                              ".thumbnail-fallback"
                            ) as HTMLElement | null;
                            if (fallback) fallback.style.display = "flex";
                          }}
                        />
                      ) : null}

                      <div
                        className="thumbnail-fallback absolute inset-0 hidden items-center justify-center bg-gradient-to-br from-[#b5d4f4] to-[#56aeff] text-white"
                        style={{ display: thumb ? "none" : "flex" }}
                      >
                        <Film className="h-8 w-8 opacity-40" />
                      </div>

                      {/* Durum Rozeti (Sol Üst) */}
                      <div className="absolute left-2.5 top-2.5">
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[10px] font-extrabold shadow-sm"
                          style={{
                            color: durumStil.metinRenk,
                            backgroundColor: durumStil.zeminRenk,
                          }}
                        >
                          {durumStil.etiket}
                        </span>
                      </div>

                      {/* Bitiş Tarihi Rozeti (Sağ Üst) */}
                      <div className="absolute right-2.5 top-2.5">
                        <span className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                          <Clock className="h-3 w-3" />
                          {formatTarihKisa(o.oneri_bitis)}
                        </span>
                      </div>

                      {/* Play Butonu Overlay */}
                      {!durumStil.soluk && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#237ac8] shadow-lg">
                            <Play className="ml-0.5 h-5 w-5 fill-current" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* İçerik Bilgileri */}
                    <div className="flex flex-1 flex-col justify-between p-3.5">
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <h3 className="truncate text-sm font-extrabold text-[#172b4d]" title={o.urun_adi}>
                            {o.urun_adi}
                          </h3>
                        </div>
                        {o.teknik_adi && o.teknik_adi !== "-" && (
                          <p className="mt-0.5 truncate text-[11px] font-medium text-[#71859d]" title={o.teknik_adi}>
                            {o.teknik_adi}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-[#566b87]">
                          <span className="font-semibold text-[#8a9bb0]">Öneren:</span>
                          <span className="truncate font-bold text-[#35527a]">{o.kullanici_adi}</span>
                        </div>
                      </div>

                      {/* Alt Puan ve Etkileşim Çubuğu */}
                      <div className="mt-3.5 flex items-center justify-between border-t border-[#f0f4f9] pt-2.5">
                        {o.video_puani != null ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-[#f0f6ff] px-2 py-0.5 text-xs font-extrabold text-[#237ac8]">
                            ⭐ {o.video_puani} Puan
                          </span>
                        ) : (
                          <span />
                        )}

                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={(e) => handleBegeni(e, o.yayin_id)}
                            className="flex cursor-pointer items-center gap-1 text-xs font-bold transition-colors"
                            style={{ color: o.begeni_mi ? "#bc2d0d" : "#8a9bb0" }}
                            title={o.begeni_mi ? "Beğeniyi kaldır" : "Beğen"}
                          >
                            <Heart className={`h-3.5 w-3.5 ${o.begeni_mi ? "fill-current" : ""}`} />
                            <span>{o.begeni_sayisi}</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleFavori(e, o.yayin_id)}
                            className="flex cursor-pointer items-center gap-1 text-xs font-bold transition-colors"
                            style={{ color: o.favori_mi ? "#237ac8" : "#8a9bb0" }}
                            title={o.favori_mi ? "Favorilerden kaldır" : "Favoriye ekle"}
                          >
                            <Bookmark className={`h-3.5 w-3.5 ${o.favori_mi ? "fill-current" : ""}`} />
                            <span>{o.favori_sayisi}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}
