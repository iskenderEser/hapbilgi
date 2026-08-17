// app/yayindaki-videolar/page.tsx
// "Yayındaki Videolar" sayfası. Navbar pill'inden gelinir; yalnız
// YAYINDAKI_VIDEO_GORENLER görür (rol bekçisi proxy.ts + bu sayfada tekrar).
// Adım 2 (iskelet): mevcut VideoBolumu ile düz liste + VideoOynatici (izleme
// modu, tuketici=false → puan/soru yok). Klasör gruplaması + kart favori/beğeni
// sonraki adımlarda.

"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import KlasorGrid from "./_components/KlasorGrid";
import { useListe, ListeArama } from "@/components/liste";
import VideoOynatici from "@/components/izle/VideoOynatici";
import { AnaSayfaVideo } from "@/lib/video/anaSayfaVideolari";
import { YayindakiVideo } from "@/lib/video/yayindakiVideolar";
import { useAuth } from "@/app/providers/AuthProvider";
import { URETICI_ROLLER, YAYINDAKI_VIDEO_GORENLER } from "@/lib/utils/roller";
import { departmanKey } from "@/lib/video/departman";
import BmOneriPaneli from "./_components/BmOneriPaneli";

function OzetKarti({
  etiket,
  deger,
  aciklama,
  renk,
  zemin,
  ikon,
}: {
  etiket: string;
  deger: number;
  aciklama: string;
  renk: string;
  zemin: string;
  ikon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#dfe7f1] bg-white px-3.5 py-3.5 shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ color: renk, backgroundColor: zemin }}>
          {ikon}
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#7a8da8]">{etiket}</span>
          <span className="mt-0.5 block text-xl font-extrabold leading-none text-[#243957]">{deger.toLocaleString("tr-TR")}</span>
          <span className="mt-1 block truncate text-[11px] text-[#7b8ca5]">{aciklama}</span>
        </span>
      </div>
    </div>
  );
}

export default function YayindakiVideolarPage() {
  const router = useRouter();
  const { kullanici, yukleniyor } = useAuth();
  const { mesajlar, hata, basari } = useHataMesaji();
  const [videolar, setVideolar] = useState<YayindakiVideo[]>([]);
  const [oneriModu, setOneriModu] = useState(false);
  const [secilenYayinlar, setSecilenYayinlar] = useState<YayindakiVideo[]>([]);
  const rolKucu = (kullanici?.rol ?? "").trim().toLowerCase();
  const bmMi = rolKucu === "bm";
  const katalogVideolari = oneriModu ? videolar.filter((video) => video.hedef_roller.includes("utt")) : videolar;

  // Yalnız ARAMA (İskender kararı 27.07): ekran klasör + kart ızgarası, satır
  // listesi değil; kademeli açma ızgarada ayrı bir iş. adim: Infinity → dilimleme yok.
  // Not: bu ekranın verisinde talep_no yok (yayın kaydından beslenir), bu yüzden
  // aranabilir alanlar ürün/eğitim adı ve teknik adıdır.
  const liste = useListe({
    veri: katalogVideolari,
    adim: Infinity,
    aramaAlanlari: [
      { anahtar: "ad", etiket: "Ürün / Eğitim", deger: (v: YayindakiVideo) => v.urun_adi },
      { anahtar: "teknik", etiket: "Teknik", deger: (v: YayindakiVideo) => v.teknik_adi },
    ],
  });
  const [aktifVideo, setAktifVideo] = useState<AnaSayfaVideo | null>(null);
  const [loading, setLoading] = useState(true);

  const ureticiBirimSayisi = new Set(videolar.map((video) => departmanKey(video.ureten_rol))).size;
  const toplamIzlenme = videolar.reduce((toplam, video) => toplam + video.izlenme_sayisi, 0);
  const toplamEtkilesim = videolar.reduce((toplam, video) => toplam + video.begeni_sayisi + video.favori_sayisi, 0);
  const toplamBegeni = videolar.reduce((toplam, video) => toplam + video.begeni_sayisi, 0);
  const toplamFavori = videolar.reduce((toplam, video) => toplam + video.favori_sayisi, 0);

  const oneriVideoSec = (video: YayindakiVideo) => {
    setSecilenYayinlar((mevcut) => {
      if (mevcut.some((secili) => secili.yayin_id === video.yayin_id)) {
        return mevcut.filter((secili) => secili.yayin_id !== video.yayin_id);
      }
      if (mevcut.length >= 3) {
        hata("Tek seferde en fazla 3 video önerilebilir.");
        return mevcut;
      }
      return [...mevcut, video];
    });
  };

  const oneriModunuKapat = () => {
    setSecilenYayinlar([]);
    setOneriModu(false);
  };

  useEffect(() => {
    if (aktifVideo) window.scrollTo({ top: 0, behavior: "auto" });
  }, [aktifVideo]);

  useEffect(() => {
    if (yukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    const rol = kullanici.rol?.trim().toLowerCase();
    if (!rol || !YAYINDAKI_VIDEO_GORENLER.includes(rol)) { router.replace("/ana-sayfa"); return; }
    if (URETICI_ROLLER.includes(rol)) { router.replace("/tum-yayinlar"); return; }

    const veriCek = async () => {
      setLoading(true);
      const res = await fetch("/yayindaki-videolar/api");
      const data = await res.json();
      if (!res.ok) hata(data.hata ?? "Videolar yüklenemedi.", data.adim, data.detay);
      else setVideolar(data.videolar ?? []);
      setLoading(false);
    };
    veriCek();
  }, [kullanici, yukleniyor, router]);

  if (yukleniyor || !kullanici) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg className="animate-spin" style={{ width: 24, height: 24, color: "#737373" }} fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#f5f8fc]" style={{ fontFamily: "'Nunito', sans-serif" }}>
      {aktifVideo ? (
        <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#dfe7f1] bg-white px-4 py-3 shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#4f7fb7]">Şirket kataloğu</p>
              <p className="truncate text-sm font-extrabold text-[#243957]">{aktifVideo.urun_adi} · {aktifVideo.teknik_adi}</p>
            </div>
            <span className="shrink-0 rounded-full bg-[#eef5fd] px-2.5 py-1 text-[10px] font-extrabold text-[#4479b7]">Salt görüntüleme</span>
          </div>
          <VideoOynatici
            key={aktifVideo.yayin_id}
            video={aktifVideo}
            tuketici={false}
            onizlemeYuzeyi={bmMi}
            onKapat={() => setAktifVideo(null)}
            onVeriYenile={() => {}}
            hata={() => {}}
            basari={() => {}}
            uyari={() => {}}
          />
        </div>
      ) : (
        <div className="mx-auto flex max-w-[1480px] flex-col gap-5 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
          <section aria-labelledby="sirket-yayinlari-baslik" className="flex flex-col gap-4">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#4f7fb7]">Ortak içerik kütüphanesi</p>
              <h1 id="sirket-yayinlari-baslik" className="mt-1 text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">
                Şirket Yayınları
              </h1>
              <p className="mt-1 max-w-3xl text-sm leading-5 text-[#6b7f9b]">
                Tüm üretici birimlerin yayındaki içeriklerini keşfedin; izlenme ve etkileşim eğilimlerini tek katalogda görün.
              </p>
            </div>

            {!loading && videolar.length > 0 && (
              <div aria-label="Şirket yayınları özeti" className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
                <OzetKarti
                  etiket="Yayındaki içerik"
                  deger={videolar.length}
                  aciklama="Şu anda erişime açık"
                  renk="#2e75b6"
                  zemin="#eef6ff"
                  ikon={<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M4 5h16v14H4z" /><path d="m10 9 5 3-5 3V9Z" /></svg>}
                />
                <OzetKarti
                  etiket="Üretici birim"
                  deger={ureticiBirimSayisi}
                  aciklama="Kataloğa içerik sağlıyor"
                  renk="#167453"
                  zemin="#ecfdf5"
                  ikon={<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M4 20V8l8-4 8 4v12" /><path d="M8 20v-5h8v5M8 10h.01M12 10h.01M16 10h.01" /></svg>}
                />
                <OzetKarti
                  etiket="Tamamlanan izleme"
                  deger={toplamIzlenme}
                  aciklama="Yayınların toplam erişimi"
                  renk="#6554c0"
                  zemin="#f2efff"
                  ikon={<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></svg>}
                />
                <OzetKarti
                  etiket="Toplam etkileşim"
                  deger={toplamEtkilesim}
                  aciklama={`${toplamBegeni} beğeni · ${toplamFavori} favori`}
                  renk="#c2410c"
                  zemin="#fff7ed"
                  ikon={<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /></svg>}
                />
              </div>
            )}
          </section>

          <div className="flex flex-col gap-3 rounded-2xl border border-[#dfe7f1] bg-white px-4 py-3.5 shadow-[0_6px_18px_rgba(31,55,90,0.035)] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-extrabold text-[#203653]">Yayın Kataloğu</h2>
              <p className="mt-0.5 text-xs text-[#7b8da5]">
                {oneriModu ? "UTT gelişim ihtiyacına uygun en fazla 3 videoyu seçin." : "Üretici birime göre ilerleyin veya içerik adı ve tekniğe göre arayın."}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {!loading && <span className="w-fit rounded-full bg-[#eef5fd] px-2.5 py-1 text-[10px] font-extrabold text-[#4479b7]">{liste.toplam} yayın</span>}
              <ListeArama arama={liste.arama} />
              {bmMi && (
                <button
                  type="button"
                  onClick={() => oneriModu ? oneriModunuKapat() : setOneriModu(true)}
                  className={`w-fit rounded-xl px-3 py-2 text-[11px] font-extrabold transition-colors ${oneriModu ? "border border-[#d9e4f0] bg-white text-[#617894] hover:bg-[#f5f8fc]" : "bg-[#2f7fc7] text-white hover:bg-[#256daf]"}`}
                >
                  {oneriModu ? "Öneri Seçimini Kapat" : "Video Önermek İstiyorum"}
                </button>
              )}
              {!oneriModu && <span className="w-fit rounded-full bg-[#f0f5fb] px-2.5 py-1 text-[10px] font-extrabold text-[#637b99]">Salt görüntüleme</span>}
            </div>
          </div>

          {oneriModu && bmMi && (
            <BmOneriPaneli
              videolar={secilenYayinlar}
              onVideoSec={(video) => setAktifVideo(video)}
              onVideoKaldir={(yayinId) => setSecilenYayinlar((mevcut) => mevcut.filter((video) => video.yayin_id !== yayinId))}
              onVazgec={oneriModunuKapat}
              onBasarili={oneriModunuKapat}
              hata={hata}
              basari={basari}
            />
          )}

          {loading ? (
            <div className="flex items-center justify-center rounded-2xl border border-[#dfe7f1] bg-white p-20">
              <svg className="animate-spin w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24">
                <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : liste.toplam === 0 ? (
            <div className="rounded-2xl border border-[#dfe7f1] bg-white py-16 text-center text-sm text-[#6b7f9b] shadow-[0_6px_18px_rgba(31,55,90,0.03)]">
              {videolar.length === 0 ? "Görüntülenecek yayında video yok." : "Aramanıza uyan video bulunamadı."}
            </div>
          ) : (
            <Suspense fallback={null}>
              <KlasorGrid
                videolar={liste.gorunen}
                onVideoSec={setAktifVideo}
                oneriModu={oneriModu}
                secilenYayinlar={secilenYayinlar.map((video) => video.yayin_id)}
                onOneriSec={oneriVideoSec}
              />
            </Suspense>
          )}
        </div>
      )}

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}
