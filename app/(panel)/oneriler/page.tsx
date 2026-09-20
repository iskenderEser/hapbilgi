// app/oneriler/page.tsx
"use client";

import { TUKETICI_ROLLER } from "@/lib/utils/roller";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Clock,
  FileText,
  Headphones,
  Heart,
  Inbox,
  Play,
  Star,
} from "lucide-react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { yayinThumbnailIstemciCoz } from "@/lib/ogrenmeAraci/thumbnailIstemci";
import { AracVarsayilanKapak } from "@/components/ogrenme-araci/AracVarsayilanKapak";
import { YayinTuruPill } from "@/components/ogrenme-araci/YayinTuruPill";
import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";
import { TUR_BASLIK, type IcerikTuru } from "@/lib/video/icerikTuru";
import { talepIdGoster } from "@/lib/utils/talepId";
import { YayinKarti } from "@/components/yayin/YayinKarti";
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

  const kalanSureHesapla = (o: OneriKaydi) => {
    if (o.izlendi_mi || isSuresiGecti(o) || isHenuzBaslamadi(o)) {
      return {
        metin: formatTarihKisa(o.oneri_bitis),
        sinif: "bg-black/60 text-white font-bold",
      };
    }
    const simdi = Date.now();
    const bitis = new Date(o.oneri_bitis).getTime();
    const kalanGun = Math.ceil((bitis - simdi) / (1000 * 60 * 60 * 24));

    if (kalanGun <= 1) {
      return {
        metin: "Bugün son",
        sinif: "bg-[#bc2d0d] text-white font-extrabold shadow-sm",
      };
    }
    if (kalanGun <= 3) {
      return {
        metin: `Son ${kalanGun} gün`,
        sinif: "bg-[#d97706] text-white font-extrabold shadow-sm",
      };
    }
    return {
      metin: formatTarihKisa(o.oneri_bitis),
      sinif: "bg-black/60 text-white font-bold",
    };
  };

  const hoverIkonu = (aracTuru?: string | null) => {
    if (aracTuru === "podcast") {
      return <Headphones className="h-5 w-5" />;
    }
    if (aracTuru === "flip_pdf") {
      return <BookOpen className="h-5 w-5" />;
    }
    if (aracTuru === "gorsel") {
      return <FileText className="h-5 w-5" />;
    }
    return <Play className="ml-0.5 h-5 w-5 fill-current" />;
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
              <div className="inline-flex items-center">
                <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">
                  Öneri Takibi
                </h1>
                <SayfaRehberi anahtar="oneriler" className="ml-1.5 -translate-y-1.5" />
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-5 text-[#6b7f9b]">
                Bölge Müdürünüz tarafından gelişiminize yönelik önerilen öğrenme içeriklerini süresi dolmadan tamamlayabilir ve öneri puanı kazanabilirsiniz.
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
                renk: "#237ac8",
                zemin: "#edf6fd",
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
                sub: "Tüm önerilen içerikler",
                renk: "#64748b",
                zemin: "#f8fafc",
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
                {filtrelenmisOneriler.length} içerik
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
                  : "Bölge Müdürünüz yeni bir içerik önerdiğinde burada listelenecektir."}
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
                const thumb = yayinThumbnailIstemciCoz(o);
                const kalanSure = kalanSureHesapla(o);

                return (
                  <YayinKarti
                    key={o.oneri_id}
                    yayin={o}
                    onClick={() => {
                      if (!durumStil.soluk) {
                        router.push(`/ana-sayfa?yayin_id=${o.yayin_id}&oneri_id=${o.oneri_id}`);
                      }
                    }}
                    onBegeni={(e) => handleBegeni(e, o.yayin_id)}
                    onFavori={(e) => handleFavori(e, o.yayin_id)}
                    solUstRozet={
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-bold shadow-sm"
                        style={{
                          color: durumStil.metinRenk,
                          backgroundColor: durumStil.zeminRenk,
                        }}
                      >
                        {durumStil.etiket}
                      </span>
                    }
                    sagUstEkRozet={
                      <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] backdrop-blur-sm ${kalanSure.sinif}`}>
                        <Clock className="h-3 w-3" />
                        {kalanSure.metin}
                      </span>
                    }
                    puanYaniRozet={
                      o.izlendi_mi ? (
                        <span
                          className="inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-extrabold text-[#0a1b39] shadow-[0_2px_8px_rgba(212,175,55,0.45),0_1px_3px_rgba(0,0,0,0.1)]"
                          style={{
                            background: "linear-gradient(to right, #d4af37 0%, #ecd077 50%, #fae896 100%)",
                          }}
                          title="Kazanılan öneri puanı: +10 Puan"
                        >
                          +10 Puan
                        </span>
                      ) : null
                    }
                    altEkIcerik={
                      <div className="mt-2 flex items-center gap-1 border-t border-gray-100 pt-1.5 text-[10px] text-gray-500">
                        <span className="font-semibold text-gray-400">Öneren:</span>
                        <span className="truncate font-bold text-[#35527a]">
                          {o.oneren_adi || o.kullanici_adi}
                        </span>
                      </div>
                    }
                    hoverOverlay={
                      !durumStil.soluk ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#237ac8] shadow-lg">
                            {hoverIkonu(o.arac_turu)}
                          </div>
                        </div>
                      ) : null
                    }
                    className={durumStil.soluk ? "cursor-default opacity-75" : ""}
                  />
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
